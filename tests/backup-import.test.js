import { test } from "node:test";
import assert from "node:assert/strict";
import catalog from "../data/algorithms.json" with { type: "json" };
import { emptyProgress } from "../src/progress.js";
import {
  trainingBackup,
  restoreBackup,
  RESTORE_KEY,
} from "../src/training-backup.js";
import { mergeBackup, prepareBackupImport } from "../src/backup-import.js";
import { readFile } from "node:fs/promises";

const empty = () =>
  trainingBackup(emptyProgress(), [], { cubes: [], defaultId: null });
const attempt = (id, overrides = {}) => ({
  id,
  caseId: "pll-T",
  variant: 0,
  mode: "recognition",
  result: "confident",
  day: "2026-10-16",
  at: "2026-10-17T01:00:00Z",
  ...overrides,
});
const solve = (id, overrides = {}) => ({
  id,
  elapsed: 12345,
  date: "2026-10-17T01:00:00Z",
  day: "2026-10-16",
  scramble: Array(10).fill("R U").join(" "),
  ...overrides,
});

test("merging preserves whole current records, retired cubes, local dates and choices; adds independent history chronologically", () => {
  const current = empty(),
    incoming = empty();
  Object.assign(current.progress, {
    selected: ["pll-Rb", "pll-Ua"],
    variants: { "pll-Rb": 0 },
    known: { "pll-Rb": [0] },
    reviewed: ["cross"],
    activeCourse: "cfop",
    resume: { cfop: "full-pll" },
    attempts: [attempt("shared", { result: "help" }), attempt("current")],
  });
  Object.assign(incoming.progress, {
    selected: ["pll-Ua", "pll-Ub"],
    variants: { "pll-Rb": 1, "pll-Ub": 0 },
    known: { "pll-Rb": [1] },
    reviewed: ["f2l"],
    activeCourse: "beginner",
    resume: { cfop: "full-oll", beginner: "beginner-introduction" },
    attempts: [
      attempt("shared"),
      attempt("incoming", { at: "2026-10-16T01:00:00Z", day: "2026-10-15" }),
    ],
  });
  current.cubeCollection.cubes = [
    { id: "retired", name: "Retired", description: "", deleted: true },
  ];
  incoming.cubeCollection = {
    cubes: [
      { id: "retired", name: "Old name", description: "Old description" },
      { id: "new", name: "New cube", description: "" },
    ],
    defaultId: "new",
  };
  current.solves = [solve("shared")];
  incoming.solves = [
    solve("shared", { notes: "Older note", penalty: "+2" }),
    solve("new", { cubeId: "new" }),
  ];
  const original = structuredClone({ current, incoming });
  const { backup, summary } = mergeBackup(current, incoming, catalog);
  assert.deepEqual(backup.progress.selected, ["pll-Rb", "pll-Ua", "pll-Ub"]);
  assert.deepEqual(backup.progress.variants, { "pll-Rb": 0, "pll-Ub": 0 });
  assert.deepEqual(backup.progress.known, { "pll-Rb": [0, 1] });
  assert.deepEqual(backup.progress.reviewed, ["cross", "f2l"]);
  assert.equal(backup.progress.activeCourse, "cfop");
  assert.deepEqual(backup.progress.resume, {
    cfop: "full-pll",
    beginner: "beginner-introduction",
  });
  assert.deepEqual(
    backup.progress.attempts.map((a) => a.id),
    ["incoming", "shared", "current"],
  );
  assert.equal(backup.progress.attempts[0].day, "2026-10-15");
  assert.equal(backup.progress.attempts[1].result, "help");
  assert.deepEqual(backup.solves[0], current.solves[0]);
  assert.deepEqual(
    backup.cubeCollection.cubes[0],
    current.cubeCollection.cubes[0],
  );
  assert.equal(backup.cubeCollection.defaultId, null);
  assert.deepEqual(summary.added, {
    attempts: 1,
    selected: 1,
    reviewed: 1,
    known: 1,
    solves: 1,
    cubes: 1,
  });
  assert.equal(summary.duplicates, 3);
  assert.equal(summary.conflicts, 3);
  assert.deepEqual({ current, incoming }, original);
  const twice = mergeBackup(
    trainingBackup(backup.progress, backup.solves, backup.cubeCollection),
    incoming,
    catalog,
  );
  assert.deepEqual(twice.backup, backup);
  assert.ok(Object.values(twice.summary.added).every((count) => count === 0));
});

test("legacy attempts get repeatable file identities, retain identical repeated attempts and do not collide with other backups", async () => {
  const legacy = {
    ...emptyProgress(),
    version: 1,
    attempts: [attempt(undefined), attempt(undefined)],
  };
  const original = structuredClone(legacy);
  const first = await prepareBackupImport(legacy, catalog);
  const replay = await prepareBackupImport(
    JSON.parse(JSON.stringify(legacy)),
    catalog,
  );
  assert.deepEqual(first, replay);
  assert.equal(first.legacyAttempts, 2);
  assert.notEqual(first.progress.attempts[0].id, first.progress.attempts[1].id);
  const { backup } = mergeBackup(empty(), first, catalog);
  const current = trainingBackup(backup.progress, [], {
    cubes: [],
    defaultId: null,
  });
  assert.equal(
    mergeBackup(current, replay, catalog).backup.progress.attempts.length,
    2,
  );
  const other = await prepareBackupImport(
    { ...legacy, selected: ["pll-T"] },
    catalog,
  );
  assert.equal(
    mergeBackup(current, other, catalog).backup.progress.attempts.length,
    4,
  );
  assert.deepEqual(legacy, original);
  await assert.rejects(() =>
    prepareBackupImport(
      { ...legacy, attempts: [attempt(undefined, { day: "2026-02-30" })] },
      catalog,
    ),
  );
});

test("learning-only merge and failed full save retain existing solves and cubes", () => {
  const current = empty();
  current.solves = [solve("current")];
  current.progress.selected = ["pll-T"];
  const { backup } = mergeBackup(
    current,
    { ...emptyProgress(), selected: ["pll-Ua"] },
    catalog,
  );
  assert.equal(backup.solves, undefined);
  assert.equal(backup.cubeCollection, undefined);
  const values = new Map([
    ["last-layer.solves.v1", "original solves"],
    ["last-layer.cubes.v1", "original cubes"],
  ]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  };
  restoreBackup(storage, backup);
  assert.equal(values.get("last-layer.solves.v1"), "original solves");
  assert.equal(values.get("last-layer.cubes.v1"), "original cubes");
  const before = new Map(values);
  const write = storage.setItem;
  let writes = 0;
  storage.setItem = (k, v) => {
    if (++writes === 3) throw Error("quota");
    return write(k, v);
  };
  assert.throws(
    () => restoreBackup(storage, mergeBackup(current, empty(), catalog).backup),
    /quota/,
  );
  assert.deepEqual(values, before);
  assert.equal(storage.getItem(RESTORE_KEY), null);
});

test("merged totals still enforce import limits and malformed references never create a candidate", () => {
  const current = empty(),
    incoming = empty();
  current.progress.attempts = Array.from({ length: 60000 }, (_, i) =>
    attempt(`a-${i}`),
  );
  incoming.progress.attempts = Array.from({ length: 40001 }, (_, i) =>
    attempt(`b-${i}`),
  );
  assert.throws(
    () => mergeBackup(current, incoming, catalog),
    /too many attempts/,
  );
  assert.throws(
    () =>
      mergeBackup(
        empty(),
        { ...empty(), solves: [solve("bad", { cubeId: "missing" })] },
        catalog,
      ),
    /cube missing/,
  );
  assert.throws(
    () =>
      mergeBackup(
        empty(),
        { ...emptyProgress(), attempts: [attempt(undefined)] },
        catalog,
      ),
    /legacy/,
  );
});

test("both signup and returning-user email templates include a code and a sign-in link", async () => {
  const template = await readFile(
    new URL("../supabase/templates/sign-in-code.html", import.meta.url),
    "utf8",
  );
  const config = await readFile(
    new URL("../supabase/config.toml", import.meta.url),
    "utf8",
  );
  assert.match(template, /\{\{\s*\.Token\s*\}\}/);
  assert.match(template, /href="\{\{\s*\.ConfirmationURL\s*\}\}"/);
  for (const type of ["magic_link", "confirmation"])
    assert.match(
      config,
      new RegExp(
        `\\[auth.email.template.${type}\\][\\s\\S]*?content_path = "./supabase/templates/sign-in-code.html"`,
      ),
    );
});

test("guest progress needs review only while the account lacks transferable records or learning marks", async () => {
  const { hasUnmergedGuestProgress } = await import("../src/backup-import.js");
  const account = trainingBackup(emptyProgress(), [], {
    cubes: [],
    defaultId: null,
  });
  const guest = trainingBackup(
    { ...emptyProgress(), selected: ["oll-27"], known: { "pll-Y": [1] } },
    [],
    { cubes: [], defaultId: null },
  );
  assert.equal(hasUnmergedGuestProgress(account, guest, catalog), true);
  const combined = mergeBackup(account, guest, catalog).backup;
  assert.equal(
    hasUnmergedGuestProgress(
      trainingBackup(
        combined.progress,
        combined.solves,
        combined.cubeCollection,
      ),
      guest,
      catalog,
    ),
    false,
  );
});

test("guest comparison ignores reordered or older shared records while retaining account edits and input bytes", async () => {
  const { guestTransferPreview } = await import("../src/backup-import.js");
  const account = empty();
  account.progress.selected = ["pll-Ua", "pll-T"];
  account.progress.attempts = [attempt("shared", { result: "help" })];
  account.solves = [solve("shared", { notes: "Current note" })];
  const guest = structuredClone(account);
  guest.progress.selected.reverse();
  guest.progress.attempts[0].result = "confident";
  guest.solves[0].notes = "Old note";
  const before = structuredClone({ account, guest });
  const preview = guestTransferPreview(account, guest, catalog);
  assert.equal(preview.hasChanges, false);
  assert.equal(preview.summary.duplicates, 2);
  assert.equal(preview.summary.conflicts, 2);
  assert.deepEqual(preview.backup.solves, account.solves);
  assert.deepEqual(preview.backup.progress.attempts, account.progress.attempts);
  assert.deepEqual({ account, guest }, before);
});

test("guest comparison includes metadata-only choices, course positions and recognition links in its exact additions", async () => {
  const { guestTransferPreview, hasUnmergedGuestProgress } =
    await import("../src/backup-import.js");
  const account = empty();
  const guest = empty();
  Object.assign(guest.progress, {
    variants: { "pll-Y": 1 },
    activeCourse: "cfop",
    resume: { cfop: "full-pll" },
    transfers: [{ caseId: "oll-2", variant: 0, method: "full" }],
  });
  assert.equal(hasUnmergedGuestProgress(account, guest, catalog), true);
  const preview = guestTransferPreview(account, guest, catalog);
  assert.deepEqual(preview.summary.added, {
    attempts: 0,
    selected: 0,
    reviewed: 0,
    known: 0,
    solves: 0,
    cubes: 0,
    variants: 1,
    resume: 1,
    transfers: 1,
    activeCourse: 1,
  });
  const combined = trainingBackup(
    preview.backup.progress,
    preview.backup.solves,
    preview.backup.cubeCollection,
  );
  assert.equal(
    guestTransferPreview(combined, guest, catalog).hasChanges,
    false,
  );
  const differentChoices = structuredClone(guest);
  differentChoices.progress.variants["pll-Y"] = 0;
  differentChoices.progress.resume.cfop = "full-oll";
  differentChoices.progress.activeCourse = "beginner";
  assert.equal(
    guestTransferPreview(combined, differentChoices, catalog).hasChanges,
    false,
    "Account choices are kept when no new information is added",
  );
});
