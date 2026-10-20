import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderApp } from "../scripts/render-views.mjs";
import { emptyProgress, statusFor } from "../src/progress.js";
const catalog = JSON.parse(
  readFileSync(new URL("../data/algorithms.json", import.meta.url)),
);
function context() {
  const progress = emptyProgress();
  progress.selected.push("pll-T");
  const byId = new Map(catalog.map((c) => [c.id, c]));
  return {
    state: {
      progress,
      preferences: { pllArrows: true, randomLastLayer: true },
      view: "home",
      section: "PLL",
      query: "",
      group: "all",
    },
    catalog,
    byId,
    variant: (c) => c.preferredVariant,
    selected: () => progress.selected.map((id) => byId.get(id)),
    status: (c) => statusFor(progress, c.id, c.preferredVariant),
  };
}
test("timer history renders only the requested newest batch without reading older rows", () => {
  const ctx = context();
  ctx.state.view = "timer";
  ctx.state.timer = { status: "ready", elapsed: 0, scramble: "R U" };
  const solves = Array.from({ length: 125 }, (_, i) => ({
    id: `history-${i}`,
    elapsed: 10000 + i * 100,
    date: new Date(Date.UTC(2026, 9, 17, 12, 0, i)).toISOString(),
    scramble: "R U",
  }));
  for (const [total, limit, expected] of [
    [125, undefined, 50],
    [0, undefined, 0],
    [49, undefined, 49],
    [50, undefined, 50],
    [51, undefined, 50],
    [125, 100, 100],
    [125, 150, 125],
  ]) {
    ctx.state.solves = solves.slice(0, total);
    ctx.state.timerHistoryLimit = limit;
    const html = renderApp(ctx);
    assert.equal(
      [...html.matchAll(/data-review-scope="timer"/g)].length,
      expected,
    );
    assert.equal(html.includes('id="timer-history-more"'), total > expected);
    assert.match(html, new RegExp(`Solve history \\(${total}\\)`));
    if (total) {
      assert.match(html, new RegExp(`Showing ${expected} of ${total} solves`));
      assert.match(html, new RegExp(`<ol[^>]+start="${total}"`));
      assert.match(html, new RegExp(`id="timer-solve-history-${total - 1}"`));
      if (total > expected)
        assert.doesNotMatch(
          html,
          new RegExp(`id="timer-solve-history-${total - expected - 1}"`),
        );
    }
  }
  ctx.state.timerHistoryLimit = undefined;
  ctx.state.solves = new Proxy(solves, {
    get(target, key, receiver) {
      if (typeof key === "string" && /^\d+$/.test(key) && Number(key) < 75)
        throw Error(
          "Older history rows must not be read to render the latest 50",
        );
      return Reflect.get(target, key, receiver);
    },
  });
  assert.equal(
    [...renderApp(ctx).matchAll(/data-review-scope="timer"/g)].length,
    50,
  );
  ctx.state.timer.status = "running";
  const more = renderApp(ctx).match(
    /<button\b[^>]*\bid="timer-history-more"[^>]*>/,
  )[0];
  assert.match(more, / disabled(?:=""|\s|>)/);
});

test("hidden practice with arrows enabled does not reveal case or diagram before answer", () => {
  const ctx = context();
  ctx.state.view = "practice";
  for (const stage of ["setup", "recognize"]) {
    ctx.state.session = {
      caseId: "pll-T",
      mode: "recognition",
      stage,
      setup: "R U",
      completed: 0,
    };
    const html = renderApp(ctx);
    assert.match(html, /Last Layer/);
    assert.doesNotMatch(html, /T perm|pll-arrows|class="algorithm"/);
  }
  ctx.state.session.stage = "answer";
  assert.match(renderApp(ctx), /T perm/);
  assert.match(renderApp(ctx), /pll-arrows/);
});
test("both libraries retain every group heading with all groups selected", () => {
  const ctx = context();
  ctx.state.view = "library";
  for (const section of ["OLL", "PLL"]) {
    ctx.state.section = section;
    const groups = new Set(
      catalog.filter((c) => c.section === section).map((c) => c.group),
    );
    const html = renderApp(ctx);
    assert.equal(
      [...html.matchAll(/class="group-heading"/g)].length,
      groups.size,
    );
  }
});

test("bulk selection exposes case and mixed group checkboxes without replacing case details", () => {
  const ctx = context();
  ctx.state.view = "library";
  ctx.state.bulkEdit = {
    selected: ["pll-H"],
    known: "keep",
    learningSet: "keep",
  };
  const html = renderApp(ctx);
  assert.match(
    html,
    /aria-label="Select H perm"[^>]*aria-checked="true"|aria-checked="true"[^>]*aria-label="Select H perm"/,
  );
  assert.match(
    html,
    /aria-label="Select Edges Only"[^>]*aria-checked="mixed"|aria-checked="mixed"[^>]*aria-label="Select Edges Only"/,
  );
  assert.match(html, /aria-label="View H perm"/);
  assert.match(html, /Apply to 1 case/);
  assert.match(html, /1 selected/);
  ctx.state.bulkEdit = null;
  assert.doesNotMatch(renderApp(ctx), /aria-label="Select H perm"/);
});

test("two-look cases retain complete diagrams alongside stage aliases", () => {
  const ctx = context();
  ctx.state.method = "two-look";
  ctx.state.view = "library";
  let html = renderApp(ctx);
  assert.match(html, /aria-label="View T perm"/);
  assert.match(html, /class="case-alias">Adjacent swap/);
  ctx.state.detail = "pll-T";
  html = renderApp(ctx);
  assert.doesNotMatch(html, /Ignore the gray pieces/);
  const twoLookSvg = html.match(/<svg viewBox="0 0 138 138"[^]*?<\/svg>/)[0];
  assert.match(twoLookSvg, /data-kind="edge"/);
  assert.match(twoLookSvg, /data-kind="corner"/);
  assert.match(html, /https:\/\/jperm.net\/algs\/2look\/pll/);
  ctx.state.method = "full";
  html = renderApp(ctx);
  assert.doesNotMatch(html, /class="case-alias"|Ignore the gray pieces/);
  const fullT = html.match(
    /<button class="case-open"[^>]+aria-label="View T perm">(<svg[^]*?<\/svg>)/,
  )[1];
  assert.equal(twoLookSvg, fullT);
});

test("home falls back to a current learning case when previous focus is outside the selected pool", () => {
  const ctx = context();
  ctx.state.focusId = "pll-Ga";
  const html = renderApp(ctx);
  assert.match(html, /class="study-heading"><h2>T perm/);
  assert.doesNotMatch(html, /class="study-heading"><h2>Ga perm/);
});

test("every case popup discloses its verified catalog setup only when expanded", () => {
  const ctx = context();
  for (const c of catalog) {
    ctx.state.detail = c.id;
    ctx.state.detailSetupVisible = false;
    let html = renderApp(ctx);
    assert.match(
      html,
      /aria-expanded="false" aria-controls="case-setup-content"/,
    );
    assert.match(html, /id="case-setup-content" hidden/);
    ctx.state.detailSetupVisible = true;
    html = renderApp(ctx);
    assert.match(
      html,
      /aria-expanded="true" aria-controls="case-setup-content"/,
    );
    assert.doesNotMatch(html, /id="case-setup-content" hidden/);
    const setup = html.match(/aria-label="Case setup moves">([^<]+)</)[1];
    // Catalog setups are independently verified for case equivalence and F2L.
    assert.equal(setup.replaceAll("&#39;", "'"), c.setups[0]);
  }
});
