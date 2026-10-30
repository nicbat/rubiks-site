import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { starterGroups, updateCaseSelection } from "../src/case-selection.js";

const catalog = JSON.parse(
  readFileSync(new URL("../data/algorithms.json", import.meta.url)),
);
test("starter groups expose bounded existing curricula without altering the catalog", () => {
  const before = JSON.stringify(catalog);
  const groups = starterGroups(catalog);
  assert.deepEqual(
    groups.map((g) => g.cases.length),
    [3, 7, 2, 4],
  );
  assert.deepEqual(
    groups[0].cases.map((c) => c.id),
    ["oll-45", "oll-44", "oll-2"],
  );
  assert.deepEqual(
    groups[2].cases.map((c) => c.id),
    ["pll-T", "pll-Y"],
  );
  assert.equal(new Set(groups.map((g) => g.index)).size, 4);
  assert.equal(
    new Set(groups.flatMap((g) => g.cases.map((c) => c.id))).size,
    16,
  );
  assert.equal(JSON.stringify(catalog), before);
});
test("temporary selection supports explicit all/clear, deduplication and scope changes immutably", () => {
  const selected = ["pll-T", "pll-Y", "outside"];
  const eligible = ["pll-T", "pll-Y", "pll-Ua"];
  const ids = ["pll-Ua", "pll-Ua", "unknown"];
  assert.deepEqual(updateCaseSelection(selected, ids, true, eligible), [
    "pll-T",
    "pll-Y",
    "pll-Ua",
  ]);
  assert.deepEqual(updateCaseSelection(selected, ["pll-Y"], false, eligible), [
    "pll-T",
  ]);
  assert.deepEqual(
    updateCaseSelection(selected, eligible, false, eligible),
    [],
  );
  assert.deepEqual(updateCaseSelection(selected, [], true, ["pll-Y"]), [
    "pll-Y",
  ]);
  assert.deepEqual(selected, ["pll-T", "pll-Y", "outside"]);
  assert.deepEqual(ids, ["pll-Ua", "pll-Ua", "unknown"]);
});
