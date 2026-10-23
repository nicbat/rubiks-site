import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeTraining } from "../src/training-merge.js";
import { trainingBackup } from "../src/training-backup.js";
import { emptyProgress } from "../src/progress.js";
import catalog from "../data/algorithms.json" with { type: "json" };
import { validateBackup } from "../src/training-backup.js";

const backup = () =>
  trainingBackup(emptyProgress(), [], { cubes: [], defaultId: null });
const solve = (id, notes = "") => ({
  id,
  elapsed: 12345,
  date: "2026-10-20T12:00:00Z",
  day: "2026-10-20",
  scramble: Array(10).fill("R U").join(" "),
  notes,
});
const attempt = (id) => ({
  id,
  caseId: "pll-T",
  variant: 0,
  result: "confident",
  mode: "recognition",
  at: "2026-10-20T12:00:00Z",
  day: "2026-10-20",
});
test("offline phone and laptop additions combine without duplication or changing their local calendar days", () => {
  const base = backup(),
    phone = backup(),
    laptop = backup();
  phone.solves.push(solve("phone"));
  laptop.solves.push(solve("laptop"));
  phone.progress.attempts.push(attempt("phone-attempt"));
  laptop.progress.attempts.push(attempt("laptop-attempt"));
  const merged = mergeTraining(base, phone, laptop);
  assert.deepEqual(merged.conflicts, []);
  assert.deepEqual(
    merged.value.solves.map((value) => value.id),
    ["laptop", "phone"],
  );
  assert.deepEqual(
    merged.value.progress.attempts.map((value) => value.id),
    ["laptop-attempt", "phone-attempt"],
  );
  assert.equal(merged.value.solves[1].day, "2026-10-20");
  assert.deepEqual(
    mergeTraining(base, merged.value, laptop).value,
    merged.value,
  );
});
test("a deletion stays deleted while unrelated offline records are added", () => {
  const base = backup();
  base.solves = [solve("deleted"), solve("kept")];
  const phone = structuredClone(base),
    laptop = structuredClone(base);
  phone.solves = [solve("kept"), solve("phone-new")];
  laptop.solves.push(solve("laptop-new"));
  const merged = mergeTraining(base, phone, laptop);
  assert.deepEqual(merged.conflicts, []);
  assert.deepEqual(
    merged.value.solves.map((value) => value.id),
    ["kept", "laptop-new", "phone-new"],
  );
});
test("conflict choices affect conflicting fields and keep independent activity from both devices", () => {
  const base = backup();
  base.solves = [solve("shared", "old")];
  const phone = structuredClone(base),
    laptop = structuredClone(base);
  phone.solves[0].notes = "phone note";
  laptop.solves[0].notes = "laptop note";
  phone.solves.push(solve("phone-new"));
  laptop.solves.push(solve("laptop-new"));
  assert.deepEqual(mergeTraining(base, phone, laptop).conflicts, [
    "solves[shared].notes",
  ]);
  for (const choice of ["device", "cloud"]) {
    const merged = mergeTraining(base, phone, laptop, choice);
    assert.equal(merged.value.solves.length, 3);
    assert.equal(
      merged.value.solves.find((value) => value.id === "shared").notes,
      choice === "device" ? "phone note" : "laptop note",
    );
  }
});
test("different fields of the same solve merge, while deletion versus editing needs a choice", () => {
  const base = backup();
  base.solves = [solve("shared")];
  const phone = structuredClone(base),
    laptop = structuredClone(base);
  phone.solves[0].notes = "new note";
  laptop.solves[0].penalty = "+2";
  const merged = mergeTraining(base, phone, laptop);
  assert.deepEqual(merged.conflicts, []);
  assert.equal(merged.value.solves[0].notes, "new note");
  assert.equal(merged.value.solves[0].penalty, "+2");
  phone.solves = [];
  assert.deepEqual(mergeTraining(base, phone, laptop).conflicts, [
    "solves[shared]",
  ]);
  assert.equal(
    mergeTraining(base, phone, laptop, "device").value.solves.length,
    0,
  );
  assert.equal(
    mergeTraining(base, phone, laptop, "cloud").value.solves.length,
    1,
  );
});
test("learning selections, known marks and reviewed lessons merge additions and removals", () => {
  const base = backup();
  base.progress.selected = ["pll-T"];
  base.progress.known = { "pll-T": [0] };
  base.progress.reviewed = ["cross"];
  const phone = structuredClone(base),
    laptop = structuredClone(base);
  phone.progress.selected = [];
  delete phone.progress.known;
  delete phone.progress.reviewed;
  laptop.progress.selected.push("pll-Ua");
  laptop.progress.known["pll-Ua"] = [0];
  laptop.progress.reviewed.push("f2l");
  const merged = mergeTraining(base, phone, laptop);
  assert.deepEqual(merged.conflicts, []);
  assert.deepEqual(merged.value.progress.selected, ["pll-Ua"]);
  assert.deepEqual(merged.value.progress.known, { "pll-Ua": [0] });
  assert.deepEqual(merged.value.progress.reviewed, ["f2l"]);
});
test("ID collisions and anonymous legacy histories are not silently deduplicated", () => {
  const base = backup(),
    phone = backup(),
    laptop = backup();
  phone.solves = [solve("same", "phone")];
  laptop.solves = [solve("same", "laptop")];
  assert.equal(mergeTraining(base, phone, laptop).conflicts.length, 1);
  phone.progress.attempts = [attempt("a")];
  delete phone.progress.attempts[0].id;
  laptop.progress.attempts = [attempt("b")];
  delete laptop.progress.attempts[0].id;
  laptop.progress.attempts[0].result = "help";
  assert.ok(
    mergeTraining(base, phone, laptop).conflicts.includes("progress.attempts"),
  );
});
test("removed cubes retain a deleted historical label for independently added solves without mutating inputs", () => {
  const base = backup();
  base.cubeCollection = {
    cubes: [{ id: "cube", name: "Main", description: "" }],
    defaultId: "cube",
  };
  const phone = structuredClone(base),
    laptop = structuredClone(base);
  phone.cubeCollection = { cubes: [], defaultId: null };
  laptop.solves = [{ ...solve("new"), cubeId: "cube" }];
  const before = JSON.stringify([base, phone, laptop]);
  const merged = mergeTraining(base, phone, laptop);
  assert.deepEqual(merged.conflicts, []);
  assert.equal(merged.value.cubeCollection.cubes[0].deleted, true);
  assert.equal(merged.value.cubeCollection.defaultId, null);
  assert.equal(merged.value.solves[0].cubeId, "cube");
  assert.equal(JSON.stringify([base, phone, laptop]), before);
});

test("seeded independent edits converge in either device order without losing deletions or additions", () => {
  // Reproducible LCG seed. Each old record has a single editing device, so
  // the expected result is the union of those final records plus new records.
  let seed = 0x21ac2026;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  for (let run = 0; run < 100; run++) {
    const base = backup();
    base.solves = Array.from({ length: 20 }, (_, i) =>
      solve(`old-${i}`, "original"),
    );
    const phone = structuredClone(base),
      laptop = structuredClone(base),
      expected = [];
    for (let i = 0; i < base.solves.length; i++) {
      const target = i % 2 ? phone : laptop;
      const id = `old-${i}`;
      if (random() < 0.35)
        target.solves = target.solves.filter((record) => record.id !== id);
      else {
        const updated = target.solves.find((record) => record.id === id);
        if (random() < 0.5) updated.notes = `run ${run}, record ${i}`;
        if (random() < 0.5) updated.penalty = "+2";
        expected.push(structuredClone(updated));
      }
    }
    for (const [name, target] of [
      ["phone", phone],
      ["laptop", laptop],
    ]) {
      for (let i = 0; i < 3; i++) {
        const added = solve(`${name}-${i}`);
        target.solves.push(added);
        expected.push(added);
      }
    }
    const before = JSON.stringify([base, phone, laptop]);
    const forward = mergeTraining(base, phone, laptop),
      reverse = mergeTraining(base, laptop, phone);
    assert.deepEqual(forward.conflicts, []);
    assert.deepEqual(forward.value, reverse.value);
    assert.deepEqual(
      forward.value.solves,
      expected.sort((a, b) => a.id.localeCompare(b.id, "en")),
    );
    assert.doesNotThrow(() => validateBackup(forward.value, catalog));
    assert.equal(JSON.stringify([base, phone, laptop]), before);
  }
});
