// Fixed workloads; timings are diagnostic, never correctness assertions.
import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import { renderApp } from "../src/views.js";
import { emptyProgress, statusFor } from "../src/progress.js";
import { createAlgorithmRenderer } from "../src/algorithm.js";
const catalog = JSON.parse(
  readFileSync(new URL("../data/algorithms.json", import.meta.url)),
);
const triggers = JSON.parse(
  readFileSync(new URL("../data/triggers.json", import.meta.url)),
);
const byId = new Map(catalog.map((c) => [c.id, c]));
function context(count) {
  const progress = emptyProgress();
  progress.selected = catalog.map((c) => c.id);
  progress.attempts = Array.from({ length: count }, (_, i) => ({
    caseId: catalog[i % catalog.length].id,
    variant: 0,
    mode: "recognition",
    result: i % 7 ? "confident" : "effort",
    day: `2026-09-${String((i % 28) + 1).padStart(2, "0")}`,
    at: "2026-09-01T12:00:00Z",
  }));
  return {
    state: {
      progress,
      preferences: { pllArrows: true },
      view: "library",
      section: "OLL",
      query: "",
      group: "all",
    },
    catalog,
    byId,
    variant: (c) => c.preferredVariant,
    selected: () => catalog,
    status: (c) => statusFor(progress, c.id, c.preferredVariant),
    chunks: createAlgorithmRenderer(triggers),
  };
}
function bench(label, action, rounds = 20) {
  for (let i = 0; i < 3; i++) action();
  const samples = [];
  for (let i = 0; i < rounds; i++) {
    const start = performance.now();
    action();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  console.log(
    `${label}: median ${samples[Math.floor(rounds / 2)].toFixed(2)} ms; p95 ${samples[Math.min(rounds - 1, Math.floor(rounds * 0.95))].toFixed(2)} ms`,
  );
}
for (const count of [0, 100000]) {
  const ctx = context(count);
  bench(`OLL library (${count} attempts)`, () => renderApp(ctx));
  ctx.state.section = "PLL";
  bench(`PLL arrows (${count} attempts)`, () => renderApp(ctx));
  ctx.state.view = "progress";
  bench(`Progress (${count} attempts)`, () => renderApp(ctx));
}
