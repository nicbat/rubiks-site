import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import catalog from "../../data/algorithms.json" with { type: "json" };
import { summaryFixture } from "../helpers/profile-summary-fixture.js";
import { profileSummaryV2 } from "../../src/profile-summary.js";
import {
  migrateTrainingBackupV1,
  validateTrainingBackupV2,
} from "../../src/training-v2.js";
import { dataApi, trainingRemote } from "../../src/supabase.js";
import { profileRemote } from "../../src/profiles.js";
import { backendConfig, closeClients, signIn } from "./helpers.js";

const events = [
  "222",
  "333",
  "444",
  "555",
  "666",
  "777",
  "333oh",
  "333bf",
  "444bf",
  "555bf",
];
function multiEventFixture() {
  const data = migrateTrainingBackupV1(summaryFixture(), catalog);
  data.solves = Array.from({ length: 14 }, (_, round) =>
    events.map((eventId, eventIndex) => ({
      id: `${eventId}-${round}`,
      eventId,
      elapsed: (round + 1) * (eventIndex + 1) * 1000,
      date: new Date(Date.UTC(2026, 9, 8 + round, 0, eventIndex)).toISOString(),
      ...(round % 2 === 0
        ? { day: `2026-10-${String(7 + round).padStart(2, "0")}` }
        : {}),
      scramble: eventId.endsWith("bf") ? "R U2 F' x" : "R U2 F'",
      scrambleGrip: { up: "white", front: "green" },
      ...(round === 0
        ? { penalty: "+2" }
        : round >= 12
          ? { penalty: "dnf" }
          : {}),
      notes: "multi-event private canary",
    })),
  ).flat();
  data.solves.push({
    ...data.solves[0],
    id: "extended-date",
    eventId: "333",
    date: "0000-02-29T12:34:56.123+23:00",
    day: "0000-02-29",
    scrambleProvenance: {
      id: "engine\u0085",
      version: "1",
      method: "random-state",
    },
  });
  const missingDay = { ...data.solves.at(-1), id: "extended-date-utc" };
  delete missingDay.day;
  data.solves.push(missingDay);
  data.progress.attempts.push({
    ...data.progress.attempts.at(-1),
    at: "0000-02-29T12:34:56.123+23:00",
    day: "0000-02-29",
  });
  return validateTrainingBackupV2(data, catalog);
}

test(
  "real server v2 summaries match domain rules and retain legacy reader/privacy behavior",
  { timeout: 90000 },
  async (t) => {
    const clients = [];
    t.after(() => closeClients(clients));
    const id = randomUUID().replaceAll("-", "").slice(0, 12);
    const owner = await signIn(`events-${id}@example.test`, clients);
    const config = backendConfig();
    const profiles = profileRemote(owner.client, owner.id, config);
    const username = `events_${id}`;
    await profiles.claim(username);
    const api = dataApi(owner.client, owner.id, config);
    const remote = trainingRemote(owner.client, owner.id, config);
    const legacy = summaryFixture();
    let revision = await remote.write(legacy, 0);
    const before = await api.call("rpc/profile_for_username", {
      profile_username: username,
    });
    assert.deepEqual(
      before.stats,
      profileSummaryV2(migrateTrainingBackupV1(legacy, catalog), catalog),
    );
    assert.deepEqual(
      (await profiles.find(username)).stats,
      profileSummaryV2(migrateTrainingBackupV1(legacy, catalog), catalog),
    );
    const data = multiEventFixture();
    revision = await remote.write(data, revision);
    for (const payload of [
      data,
      { ...data, solves: data.solves.slice(0, 10) },
      { ...data, solves: [] },
    ]) {
      revision = await remote.write(payload, revision);
      const projected = await api.call("rpc/profile_for_username", {
        profile_username: username,
      });
      const summary = await api.call("rpc/profile_stats_for_username", {
        profile_username: username,
      });
      const expected = profileSummaryV2(payload, catalog);
      assert.deepEqual(projected.stats, expected);
      for (const key of Object.keys(expected))
        assert.deepEqual(summary[key], expected[key], key);
      assert.deepEqual(
        Object.keys(summary).sort(),
        [
          ...Object.keys(expected),
          "ao5_ms",
          "ao12_ms",
          "ao5_dnf",
          "ao12_dnf",
          "known_count",
          "updated_at",
        ].sort(),
      );
      assert.deepEqual(
        Object.keys(projected).sort(),
        [
          "username",
          "is_public",
          "avatar_id",
          "display_name",
          "bio",
          "learning_goal",
          "stats",
        ].sort(),
      );
      assert.ok(!JSON.stringify(projected).includes("private canary"));
      assert.ok(!JSON.stringify(summary).includes("private canary"));
    }
    const saved = await remote.read();
    await assert.rejects(remote.write(legacy, revision), { code: "23514" });
    await assert.rejects(
      api.call(
        `training_snapshots?user_id=eq.${owner.id}`,
        { payload: legacy },
        "PATCH",
      ),
      { code: "23514" },
    );
    assert.deepEqual(await remote.read(), saved);
    const guest = dataApi(null, null, config);
    assert.equal(
      (
        await guest.call("rpc/profile_for_username", {
          profile_username: username,
        })
      ).stats,
      null,
    );
    assert.equal(
      await guest.call("rpc/profile_stats_for_username", {
        profile_username: username,
      }),
      null,
    );
  },
);
