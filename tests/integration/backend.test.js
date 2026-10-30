import { test } from "node:test";
import assert from "node:assert/strict";
import { profileSummary } from "../../src/profile-summary.js";
import { summaryFixture } from "../helpers/profile-summary-fixture.js";
import { createTestData } from "../../src/test-data.js";
import { randomUUID } from "node:crypto";
import catalog from "../../data/algorithms.json" with { type: "json" };
import { loadSupabase, dataApi, trainingRemote } from "../../src/supabase.js";
import { profileRemote } from "../../src/profiles.js";
import { createCloudSync } from "../../src/cloud-sync.js";
import { createSyncQueue } from "../../src/sync-queue.js";
import { emptyProgress, setKnown } from "../../src/progress.js";
import {
  trainingBackup,
  validateBackup,
  restoreBackup,
} from "../../src/training-backup.js";
import { mergeGuestTraining } from "../../src/training-merge.js";
import { STORAGE_KEY } from "../../src/progress.js";
import { SOLVES_KEY } from "../../src/solve-history.js";
import { CUBES_KEY } from "../../src/cubes.js";
import { backendConfig, closeClients, signIn } from "./helpers.js";

const memory = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};
const empty = () =>
  trainingBackup(emptyProgress(), [], { cubes: [], defaultId: null });
const solve = (id) => ({
  id,
  cubeId: null,
  elapsed: 15321,
  date: "2026-10-20T12:00:00Z",
  day: "2026-10-20",
  scramble: Array(10).fill("R U").join(" "),
});

test(
  "real local Auth, Data API, RLS and sync work together",
  { timeout: 90000 },
  async (t) => {
    const clients = [];
    const config = backendConfig();
    const runId = randomUUID().replaceAll("-", "").slice(0, 12);
    let owner, other, profiles, outsider, guestProfiles, guestApi, remote;
    t.after(() => closeClients(clients));

    await t.test(
      "seeded accounts sign in through delivered email codes and have valid populated backups",
      async () => {
        const seeded = await signIn("learner@example.test", clients);
        const profile = await profileRemote(
          seeded.client,
          seeded.id,
          config,
        ).own();
        assert.equal(profile.username, "local_learner");
        assert.equal(profile.is_public, false);
        const row = await trainingRemote(
          seeded.client,
          seeded.id,
          config,
        ).read();
        const backup = validateBackup(row.payload, catalog);
        assert.equal(backup.solves.length, 30);
        assert.deepEqual(backup.progress.selected, ["pll-T", "pll-Ua"]);
        const guest = await loadSupabase(config);
        clients.push(guest);
        guestProfiles = profileRemote(guest, null, config);
        guestApi = dataApi(guest, null, config);
        assert.equal(
          (await guestProfiles.find("local_friend")).stats.solve_count,
          30,
        );
        assert.equal((await guestProfiles.find("local_private")).stats, null);
      },
    );
    await t.test(
      "new accounts require a unique username before uploading; sessions refresh",
      async () => {
        owner = await signIn(`owner-${runId}@example.test`, clients);
        other = await signIn(`other-${runId}@example.test`, clients);
        profiles = profileRemote(owner.client, owner.id, config);
        outsider = profileRemote(other.client, other.id, config);
        remote = trainingRemote(owner.client, owner.id, config);
        assert.equal(await profiles.own(), null);
        await assert.rejects(remote.write(empty(), 0));
        assert.equal((await profiles.claim(`test_${runId}`)).is_public, false);
        assert.deepEqual(
          (await profiles.find(`test_${runId}`)).stats,
          profileSummary(empty(), catalog),
        );
        await assert.rejects(outsider.claim(`test_${runId}`), /already taken/);
        await outsider.claim(`other_${runId}`);
        const refreshed = await owner.client.auth.refreshSession();
        assert.equal(refreshed.error, null);
        assert.equal(refreshed.data.session.user.id, owner.id);
      },
    );
    await t.test(
      "private records are hidden and another user cannot forge ownership",
      async () => {
        assert.equal(await remote.write(empty(), 0), 1);
        assert.equal((await outsider.find(`test_${runId}`)).stats, null);
        assert.equal((await guestProfiles.find(`test_${runId}`)).stats, null);
        // Withhold only the summary RPC; exercise fallback through real grants/RLS.
        const fallback = (account) =>
          profileRemote(account.client, account.id, config, (url, options) =>
            url.endsWith("/rpc/profile_for_username")
              ? Promise.resolve(
                  Response.json({ code: "PGRST202" }, { status: 404 }),
                )
              : fetch(url, options),
          );
        for (const account of [owner, other]) {
          const profile = await fallback(account).find(`test_${runId}`);
          assert.equal(profile?.username, `test_${runId}`);
          assert.equal(profile.stats, null);
        }
        const otherApi = dataApi(other.client, other.id, config);
        await assert.rejects(
          guestApi.call("profiles?select=user_id,username&is_public=eq.false"),
          (error) => error.code === "42501",
        );
        assert.equal(
          (
            await guestApi.call(
              `profiles?select=username&username=eq.test_${runId}`,
            )
          )[0].username,
          `test_${runId}`,
        );
        assert.deepEqual(
          await otherApi.call(
            `profiles?select=user_id,username&username=eq.test_${runId}`,
          ),
          [],
        );
        const ownIds = await otherApi.call("profiles?select=user_id,username");
        assert.deepEqual(ownIds, [
          { user_id: other.id, username: `other_${runId}` },
        ]);
        assert.deepEqual(
          await otherApi.call(
            `training_snapshots?select=revision,payload&user_id=eq.${owner.id}`,
          ),
          [],
        );
        await assert.rejects(
          guestApi.call("training_snapshots?select=revision,payload"),
          (error) => error.code === "42501",
        );
        await assert.rejects(
          otherApi.call(
            "profiles",
            { user_id: owner.id, username: `forged_${runId}` },
            "POST",
          ),
        );
        assert.equal(
          await otherApi.call("rpc/profile_stats_for_username", {
            profile_username: `test_${runId}`,
          }),
          null,
        );
      },
    );
    await t.test(
      "two independent device caches save, reconnect, merge and resolve conflicting edits",
      async () => {
        const secondClient = await loadSupabase(config);
        clients.push(secondClient);
        const current = await owner.client.auth.getSession();
        assert.equal(
          (await secondClient.auth.setSession(current.data.session)).error,
          null,
        );
        function device(client) {
          let local = empty(),
            offline = false,
            busy = false;
          const actual = trainingRemote(client, owner.id, config);
          const engine = createCloudSync({
            catalog,
            storage: memory(),
            canReplace: () => !busy,
            read: () => structuredClone(local),
            replace: (value) => {
              local = structuredClone(value);
            },
            isPristine: () =>
              !local.solves.length && !local.cubeCollection.cubes.length,
            remote: {
              read: () => {
                if (offline) throw Error("Device offline");
                return actual.read();
              },
              write: (value, revision) => {
                if (offline) throw Error("Device offline");
                return actual.write(value, revision);
              },
            },
          });
          const queue = createSyncQueue(engine);
          t.after(() => {
            queue.cancel();
            engine.cancel();
            actual.cancel();
          });
          return {
            engine,
            queue,
            get value() {
              return local;
            },
            set offline(value) {
              offline = value;
            },
            set busy(value) {
              busy = value;
            },
          };
        }
        const a = device(owner.client),
          b = device(secondClient);
        await a.queue.request();
        await b.queue.request();
        a.value.solves.push(solve("device-a"));
        await a.queue.request();
        assert.equal((await remote.read()).payload.solves.length, 1);
        await b.queue.request();
        assert.equal(b.value.solves[0].id, "device-a");
        b.offline = true;
        b.value.solves.push(solve("device-b"));
        await b.queue.request();
        assert.equal(b.engine.snapshot.status, "error");
        assert.equal(b.value.solves.length, 2);
        a.value.progress.selected.push("pll-T");
        await a.queue.request();
        b.offline = false;
        b.busy = true;
        await b.queue.request();
        assert.equal(b.engine.snapshot.pendingReason, "incoming");
        assert.equal(b.value.progress.selected.includes("pll-T"), false);
        assert.equal((await remote.read()).payload.solves.length, 2);
        const acknowledgedRevision = (await remote.read()).revision;
        await b.queue.request();
        assert.equal((await remote.read()).revision, acknowledgedRevision);
        b.busy = false;
        await b.queue.request();
        assert.equal(b.engine.snapshot.status, "synced");
        await a.queue.request();
        assert.deepEqual(
          new Set(a.value.solves.map((s) => s.id)),
          new Set(["device-a", "device-b"]),
        );
        assert.ok(b.value.progress.selected.includes("pll-T"));
        a.value.solves.find((s) => s.id === "device-a").notes = "first device";
        b.value.solves.find((s) => s.id === "device-a").notes = "second device";
        await a.queue.request();
        await b.queue.request();
        assert.equal(b.engine.snapshot.status, "conflict");
        await b.queue.request("cloud");
        assert.equal(b.engine.snapshot.status, "synced");
        assert.equal(
          b.value.solves.find((s) => s.id === "device-a").notes,
          "first device",
        );
        assert.equal(
          await remote.write(empty(), 0),
          null,
          "Stale compare-and-swap cannot overwrite cloud changes",
        );
      },
    );
    await t.test(
      "OLL and PLL learning state survives real Supabase upload, fresh-device restore and removals",
      async () => {
        const original = await remote.read();
        let first = structuredClone(original.payload);
        const progress = {
          ...emptyProgress(),
          selected: ["oll-27", "pll-Y"],
          variants: { "oll-27": 0, "pll-Y": 1 },
          transfers: [{ caseId: "oll-2", variant: 0, method: "full" }],
          twoLookKnown: { "pll-T": [0] },
          attempts: [
            {
              id: "oll-attempt",
              caseId: "oll-27",
              variant: 0,
              method: "full",
              mode: "recognition",
              result: "confident",
              at: "2026-10-28T01:00:00Z",
              day: "2026-10-27",
            },
            {
              id: "pll-attempt",
              caseId: "pll-Y",
              variant: 1,
              method: "two-look",
              mode: "recognition",
              result: "effort",
              at: "2026-10-29T01:00:00Z",
              day: "2026-10-28",
            },
          ],
        };
        setKnown(progress, "oll-27", 0, true);
        setKnown(progress, "pll-Y", 1, true);
        function device(read, replace, pristine = false) {
          const engine = createCloudSync({
            remote,
            storage: memory(),
            catalog,
            read,
            replace,
            isPristine: () => pristine,
          });
          t.after(() => engine.cancel());
          return createSyncQueue(engine);
        }
        const a = device(
          () => first,
          (value) => {
            first = value;
          },
          true,
        );
        await a.request();
        first.progress = progress;
        await a.request();
        assert.deepEqual((await remote.read()).payload.progress, progress);
        let second = empty();
        const b = device(
          () => second,
          (value) => {
            second = value;
          },
          true,
        );
        await b.request();
        assert.deepEqual(
          second.progress,
          progress,
          "A fresh computer restores all OLL/PLL fields, including local calendar days",
        );
        setKnown(second.progress, "oll-27", 0, false);
        setKnown(second.progress, "pll-Y", 1, false);
        second.progress.selected = ["pll-Y"];
        await b.request();
        await a.request();
        assert.deepEqual(
          first.progress,
          second.progress,
          "Unmarks and deselection also reach the first computer",
        );
        assert.equal(first.progress.known, undefined);
        assert.deepEqual(first.progress.twoLookKnown, { "pll-T": [0] });
        const current = await remote.read();
        assert.ok(await remote.write(original.payload, current.revision));
      },
    );
    await t.test(
      "malformed and oversized writes are rejected without replacing the saved snapshot",
      async () => {
        const before = await remote.read();
        for (const payload of [
          { ...empty(), version: 99 },
          { ...empty(), padding: "x".repeat(20_000_001) },
        ]) {
          await assert.rejects(
            remote.write(payload, before.revision),
            (error) => error.status === 400 && error.code === "23514",
          );
          assert.deepEqual(await remote.read(), before);
        }
      },
    );
    await t.test(
      "guest transfer is repeatable and an exported account backup restores on a fresh device",
      async () => {
        const before = await remote.read();
        const guest = empty();
        guest.solves.push(solve("guest-transfer"));
        const originalGuest = structuredClone(guest);
        const merged = mergeGuestTraining(empty(), before.payload, guest);
        assert.deepEqual(mergeGuestTraining(empty(), merged, guest), merged);
        assert.deepEqual(guest, originalGuest);
        const revision = await remote.write(merged, before.revision);
        assert.equal(revision, before.revision + 1);
        const exported = JSON.stringify({
          ...merged,
          account: { username: `test_${runId}` },
        });
        const restored = validateBackup(JSON.parse(exported), catalog);
        const storage = memory();
        restoreBackup(storage, restored);
        const engine = createCloudSync({
          catalog,
          storage,
          remote,
          read: () =>
            trainingBackup(
              JSON.parse(storage.getItem(STORAGE_KEY)),
              JSON.parse(storage.getItem(SOLVES_KEY)),
              JSON.parse(storage.getItem(CUBES_KEY)),
            ),
          replace: (value) => restoreBackup(storage, value),
        });
        await engine.sync();
        assert.equal(engine.snapshot.status, "synced");
        assert.equal(engine.snapshot.result, "unchanged");
        assert.equal((await remote.read()).revision, revision);
      },
    );
    await t.test(
      "database summaries agree with domain rules for populated, changed and empty histories",
      async () => {
        const original = await remote.read();
        const data = summaryFixture();
        const sample = createTestData(
          catalog,
          new Date("2026-10-17T19:00:00Z"),
        );
        const changes = [
          data,
          {
            ...data,
            progress: {
              ...data.progress,
              transfers: [{ caseId: "oll-2", variant: 0, method: "full" }],
            },
          },
          trainingBackup(sample.progress, sample.solves, sample.cubeCollection),
          empty(),
        ];
        let revision = original.revision;
        for (const payload of changes) {
          const valid = validateBackup(payload, catalog);
          revision = await remote.write(
            trainingBackup(valid.progress, valid.solves, valid.cubeCollection),
            revision,
          );
          const found = await profiles.find(`test_${runId}`);
          assert.deepEqual(found.stats, profileSummary(payload, catalog));
          assert.deepEqual(
            Object.keys(found).sort(),
            [
              "username",
              "is_public",
              "display_name",
              "bio",
              "learning_goal",
              "avatar_id",
              "stats",
            ].sort(),
          );
          assert.ok(!JSON.stringify(found).includes("private summary canary"));
        }
        await remote.write(original.payload, revision);
      },
    );
    await t.test(
      "statistics privacy hides the summary immediately while the account stays discoverable",
      async () => {
        await profiles.save({
          display_name: "Integration Learner",
          bio: "Public biography",
          learning_goal: "Full PLL",
          share_stats: false,
        });
        await profiles.visibility(true);
        await assert.rejects(
          guestApi.call(`profiles?select=user_id&username=eq.test_${runId}`),
          (error) => error.code === "42501",
        );
        assert.deepEqual(
          await dataApi(other.client, other.id, config).call(
            `profiles?select=user_id&username=eq.test_${runId}`,
          ),
          [],
        );
        assert.equal(
          (await outsider.find(`test_${runId}`)).bio,
          "Public biography",
        );
        assert.equal(
          (await guestProfiles.find(`test_${runId}`)).bio,
          "Public biography",
        );

        assert.equal(
          (await guestProfiles.find(`test_${runId}`)).stats.solve_count,
          3,
        );
        await profiles.visibility(false);
        assert.equal((await guestProfiles.find(`test_${runId}`)).stats, null);
        assert.equal((await outsider.find(`test_${runId}`)).stats, null);
        assert.equal(
          (await guestProfiles.find(`test_${runId}`)).bio,
          "Public biography",
        );
        assert.equal(
          (await profiles.find(`test_${runId}`)).stats.solve_count,
          3,
        );
      },
    );
    await t.test(
      "deletion removes account data and invalidates its access without harming another user",
      async () => {
        await assert.rejects(outsider.deleteAccount(`test_${runId}`));
        await assert.rejects(profiles.deleteAccount("wrong_confirmation"));
        await profiles.deleteAccount(`test_${runId}`);
        assert.equal(await profiles.own(), null);
        assert.equal(await remote.read(), null);
        await assert.rejects(profiles.claim(`revived_${runId}`));
        const session = await owner.client.auth.getSession();
        const checked = await owner.client.auth.getUser(
          session.data.session.access_token,
        );
        assert.ok(
          checked.error,
          "Auth no longer recognizes the deleted account",
        );
        assert.equal((await outsider.own()).username, `other_${runId}`);
      },
    );
  },
);
