import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCaseDiagramRenderer } from "../src/case-diagram.js";
import { caseCube } from "../src/cube.js";
import { diagram } from "../src/diagram.js";
import { createProgressIndex } from "../src/progress-index.js";
import { emptyProgress, statusFor } from "../src/progress.js";
const catalog = JSON.parse(
  readFileSync(new URL("../data/algorithms.json", import.meta.url)),
);

test("cached diagrams equal uncached diagrams for every catalog variant, both arrow settings, cold and warm", () => {
  const render = createCaseDiagramRenderer();
  for (const c of catalog)
    for (const variant of c.algorithms)
      for (const arrows of [false, true]) {
        const label = `${c.name} <front> "&"`;
        const expected = diagram(caseCube(variant.moves), c.section, label, {
          arrows,
        });
        assert.equal(
          render(variant.moves, c.section, label, { arrows }),
          expected,
        );
        assert.equal(
          render(variant.moves, c.section, label, { arrows }),
          expected,
        );
      }
});
test("diagram cache keys include algorithm edits, section, accessible label, and arrows", () => {
  const render = createCaseDiagramRenderer(2);
  const c = catalog.find((c) => c.id === "pll-T");
  const moves = c.algorithms[0].moves;
  for (const [algorithm, section, label, arrows] of [
    [moves, "PLL", "Original", true],
    [moves, "PLL", "Renamed <script>", true],
    [moves, "OLL", "Original", true],
    [moves, "PLL", "Original", false],
    ["R U", "PLL", "Original", true],
    [moves, "PLL", "Original", true], // evicted entry is recreated correctly
  ])
    assert.equal(
      render(algorithm, section, label, { arrows }),
      diagram(caseCube(algorithm), section, label, { arrows }),
    );
  assert.throws(() => render("invalid", "PLL", "Original"), /Invalid move/);
  assert.equal(
    render(moves, "PLL", "Original", { arrows: true }),
    diagram(caseCube(moves), "PLL", "Original", { arrows: true }),
  );
  for (const invalid of [0, -1, Infinity, 1.5, "2"])
    assert.throws(() => createCaseDiagramRenderer(invalid), RangeError);
});
test("progress index matches reference status across case/variant histories and recognition resets", () => {
  const progress = emptyProgress();
  progress.selected = ["pll-T"];
  progress.attempts = Array.from({ length: 10000 }, (_, i) => ({
    caseId: catalog[i % catalog.length].id,
    variant: i % 3,
    mode: i % 5 ? "recognition" : "rehearsal",
    result: i % 17 ? "confident" : i % 2 ? "effort" : "help",
    day: `day-${i % 31}`,
  }));
  const index = createProgressIndex(progress);
  for (const c of catalog)
    for (let variant = 0; variant < 4; variant++)
      assert.deepEqual(
        index.statusFor(c.id, variant),
        statusFor(progress, c.id, variant),
      );
  assert.equal(index.practiceDays, 31);
  assert.equal(
    index.attemptsOn("day-0"),
    progress.attempts.filter((a) => a.day === "day-0").length,
  );
  assert.equal(index.attemptsOn("missing"), 0);
  assert.equal(index.hasAttempts("missing"), false);
  assert.equal(index.isSelected("pll-T"), true);
  assert.equal(index.isSelected("oll-1"), false);
});
test("progress snapshots refresh after in-place edits, new attempts, selected changes and imports", () => {
  const progress = emptyProgress();
  const first = createProgressIndex(progress);
  progress.selected.push("pll-T");
  progress.attempts.push(
    ...[1, 2, 3].map((day) => ({
      caseId: "pll-T",
      variant: 0,
      mode: "recognition",
      result: "confident",
      day: String(day),
    })),
  );
  const confident = createProgressIndex(progress);
  assert.equal(first.statusFor("pll-T").label, "Not started");
  assert.equal(confident.statusFor("pll-T").label, "Confident");
  progress.attempts[2].result = "help";
  assert.equal(createProgressIndex(progress).statusFor("pll-T").days, 0);
  assert.equal(confident.statusFor("pll-T").days, 3);
  progress.attempts = [];
  assert.equal(
    createProgressIndex(progress).statusFor("pll-T").label,
    "Learning",
  );
  assert.equal(
    createProgressIndex(emptyProgress()).statusFor("pll-T").label,
    "Not started",
  );
  const leaked = confident.statusFor("pll-T");
  leaked.days = 500;
  assert.equal(confident.statusFor("pll-T").days, 3);
});
test("100000-attempt index reads history once; repeated lookups do not scan it", () => {
  let visits = 0;
  let variantReads = 0;
  const attempt = {
    caseId: "pll-T",
    get variant() {
      variantReads++;
      return 0;
    },
    mode: "recognition",
    result: "confident",
    day: "2026-10-01",
  };
  const progress = {
    selected: ["pll-T"],
    attempts: {
      *[Symbol.iterator]() {
        for (let i = 0; i < 100000; i++) {
          visits++;
          yield attempt;
        }
      },
    },
  };
  const index = createProgressIndex(progress);
  assert.equal(visits, 100000);
  assert.equal(variantReads, 100000, "resolve each attempt variant only once");
  for (let i = 0; i < 1000; i++) {
    assert.deepEqual(index.statusFor("pll-T"), {
      label: "Needs practice",
      days: 1,
      attempts: 100000,
    });
    assert.equal(index.attemptsOn(attempt.day), 100000);
    assert.equal(index.hasAttempts("pll-T"), true);
  }
  assert.equal(visits, 100000);
});

// Exercise shared and partial recognition, linked summaries, rehearsals and resets
// independently of the index implementation using the reference history scanner.
test("mixed objective snapshots match reference status and refresh transfer edits", () => {
  const progress = emptyProgress();
  progress.selected = ["pll-T", "pll-Ua"];
  let seed = 0x51e17e;
  const choose = (values) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return values[(seed >>> 16) % values.length];
  };
  progress.attempts = Array.from({ length: 2000 }, (_, i) => ({
    caseId: choose(["pll-T", "pll-Ua", "oll-2"]),
    variant: choose([0, 1]),
    mode: choose(["recognition", "recognition", "rehearsal"]),
    method: choose(["full", "two-look"]),
    result: choose(["confident", "confident", "confident", "help", "effort"]),
    day: `day-${Math.floor(i / 4)}`,
  }));
  const unlinked = createProgressIndex(progress);
  const original = structuredClone(progress);
  for (const transfers of [
    [{ caseId: "pll-T", variant: 0, method: "full" }],
    [
      { caseId: "pll-T", variant: 0, method: "two-look" },
      { caseId: "oll-2", variant: 1, method: "full" },
    ],
    [],
  ]) {
    progress.transfers = transfers;
    const index = createProgressIndex(progress);
    for (const id of ["pll-T", "pll-Ua", "oll-2", "missing"])
      for (const variant of [0, 1, 2])
        for (const method of ["full", "two-look"]) {
          assert.deepEqual(
            index.statusFor(id, variant, method),
            statusFor(progress, id, variant, method),
          );
          assert.deepEqual(
            unlinked.statusFor(id, variant, method),
            statusFor(original, id, variant, method),
          );
        }
  }
});
