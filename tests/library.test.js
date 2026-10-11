import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { libraryGroups, learnedStatus } from "../src/library.js";
import { createProgressIndex } from "../src/progress-index.js";
import { emptyProgress } from "../src/progress.js";
const catalog = JSON.parse(
  readFileSync(new URL("../data/algorithms.json", import.meta.url)),
);

test("learned filters include known or confident chosen variants, not selected or rehearsed cases", () => {
  const progress = emptyProgress();
  progress.selected = ["pll-Y"];
  progress.known = { "pll-T": [0], "pll-Ua": [1] };
  progress.attempts = [1, 2, 3].map((day) => ({
    caseId: "pll-H",
    variant: 0,
    mode: "recognition",
    result: "confident",
    day: `2026-10-0${day}`,
  }));
  progress.attempts.push({
    caseId: "pll-Z",
    variant: 0,
    mode: "rehearsal",
    result: "confident",
    day: "2026-10-03",
  });
  const index = createProgressIndex(progress);
  const known = (c) => learnedStatus(index.statusFor(c.id, 0));
  const ids = (opts) =>
    libraryGroups(catalog, { section: "PLL", ...opts }, known).flatMap((g) =>
      g.cases.map((c) => c.id),
    );
  assert.deepEqual(
    new Set(ids({ learned: "learned" })),
    new Set(["pll-T", "pll-H"]),
  );
  assert.equal(ids({ learned: "unlearned" }).length, 19);
  assert.deepEqual(ids({ learned: "learned", group: "Edges Only" }), ["pll-H"]);
  assert.deepEqual(ids({ learned: "learned", query: "T perm" }), ["pll-T"]);
  assert.equal(ids({ learned: "all" }).length, 21);
  assert.equal(learnedStatus(index.statusFor("pll-Ua", 1)), true);
  assert.deepEqual(ids({ method: "two-look", learned: "learned" }).sort(), [
    "pll-H",
    "pll-T",
  ]);
});
