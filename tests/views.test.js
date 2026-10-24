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

test("timer bulk mode labels selection as shown rows and keeps reviews, mixed state and running guards", () => {
  const ctx = context();
  ctx.state.view = "timer";
  ctx.state.timer = { status: "ready", elapsed: 0, scramble: "R U" };
  ctx.state.solves = Array.from({ length: 55 }, (_, i) => ({
    id: `s${i}`,
    elapsed: 1000,
    date: "2026-10-10T12:00:00Z",
    scramble: "R U",
  }));
  const markup = () => renderApp(ctx).replace(/\s+/g, " ");
  let html = markup();
  assert.match(html, /Select solves/);
  assert.doesNotMatch(html, /Select shown solves/);
  ctx.state.timerBulkEdit = { selected: ["s54"], cubeId: "keep" };
  html = markup();
  assert.match(html, /Select shown solves \(50\)/);
  assert.match(html, /Only selects the rows shown below/);
  assert.match(html, /1 selected/);
  assert.match(html, /id="timer-select-shown"[^>]*aria-checked="mixed"/);
  assert.match(html, /id="timer-select-s54"[^>]*aria-checked="true"/);
  assert.doesNotMatch(html, /id="timer-select-s4"/);
  assert.equal([...html.matchAll(/data-review-scope="timer"/g)].length, 50);
  assert.match(
    html.match(/<button[^>]*data-action="timer-bulk-apply"[^>]*>/)[0],
    / disabled/,
  );
  ctx.state.timerHistoryLimit = 100;
  ctx.state.timerBulkEdit = {
    selected: ["s54"],
    cubeId: "",
    confirmDelete: true,
    failed: true,
  };
  html = markup();
  assert.match(html, /Select shown solves \(55\)/);
  assert.match(html, /Delete 1 solve\?/);
  assert.match(html, /Your history and selection are preserved/);
  ctx.state.timer.status = "running";
  html = markup();
  for (const action of [
    "timer-select-mode",
    "timer-bulk-apply",
    "timer-bulk-delete",
    "timer-bulk-delete-confirm",
    "timer-bulk-clear",
  ])
    assert.match(
      html.match(new RegExp(`<button[^>]*data-action="${action}"[^>]*>`))[0],
      / disabled/,
    );
  assert.match(
    html.match(/<button[^>]*id="timer-select-s54"[^>]*>/)[0],
    / disabled/,
  );
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
    assert.doesNotMatch(
      html,
      /T perm|pll-arrows|class="algorithm"|case-occurrence|About occurrence/,
    );
  }
  ctx.state.session.stage = "answer";
  assert.match(renderApp(ctx), /T perm/);
  assert.match(renderApp(ctx), /pll-arrows/);
});

test("libraries and every case detail show reduced occurrence with separate probability attribution", () => {
  const ctx = context();
  ctx.state.view = "library";
  for (const section of ["OLL", "PLL"]) {
    ctx.state.section = section;
    const html = renderApp(ctx);
    const cases = catalog.filter((c) => c.section === section);
    assert.equal(
      [...html.matchAll(/class="case-occurrence"/g)].length,
      cases.length,
    );
    assert.match(html, /About occurrence/);
    assert.match(html, /including skips/);
    assert.match(
      html,
      /Two-look steps and practice sets have\s+different frequencies/,
    );
    assert.match(
      html,
      section === "OLL" ? /OLL skip: 1\/216/ : /PLL skip: 1\/72/,
    );
    for (const c of cases) {
      ctx.state.detail = c.id;
      const dialog = renderApp(ctx).split('id="detail-dialog"')[1];
      assert.equal([...dialog.matchAll(/class="case-occurrence"/g)].length, 1);
      assert.match(dialog, /Probability source:/);
      assert.match(dialog, /Algorithm source: J Perm/);
      assert.match(
        dialog,
        section === "OLL"
          ? /https:\/\/speedcubing.org\/pages\/full-oll/
          : /https:\/\/www.cubeskills.com\/uploads\/pdf\/tutorials\/pll-algorithms.pdf/,
      );
    }
    ctx.state.detail = null;
  }
});

test("occurrence remains a full-stage probability across filters, variants and two-look lessons", () => {
  const ctx = context();
  assert.match(renderApp(ctx), /Occurrence 1\/18/);
  ctx.state.view = "library";
  ctx.state.query = "H perm";
  assert.match(renderApp(ctx), /Occurrence 1\/72/);
  ctx.state.query = "";
  ctx.state.method = "two-look";
  ctx.state.detail = "pll-H";
  ctx.variant = () => 0;
  assert.match(
    renderApp(ctx).split('id="detail-dialog"')[1],
    /Occurrence 1\/72/,
  );
  ctx.variant = (c) => c.algorithms.length - 1;
  assert.match(
    renderApp(ctx).split('id="detail-dialog"')[1],
    /Occurrence 1\/72/,
  );
  ctx.state.detail = null;
  ctx.state.view = "practice";
  ctx.state.session = {
    caseId: "pll-H",
    mode: "recognition",
    stage: "answer",
    completed: 0,
  };
  assert.match(renderApp(ctx), /Occurrence 1\/72/);
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

test("Progress orders statistics, heatmap, graph and combined filters without custom dates or a duplicate chart", async () => {
  const { shiftDay } = await import("../src/dashboard.js");
  const { dayKey } = await import("../src/progress.js");
  const today = dayKey();
  const ctx = context();
  ctx.state.view = "progress";
  ctx.state.dashboard = { range: "7", tab: "solves", day: null, cube: "all" };
  ctx.state.solves = [-7, -6, 0, 1].map((offset, i) => ({
    id: `range-${i}`,
    day: shiftDay(today, offset),
    date: `${shiftDay(today, offset)}T12:00:00Z`,
    elapsed: 20000 + i * 1000,
    scramble: Array(10).fill("R U").join(" "),
  }));
  const html = renderApp(ctx);
  assert.match(html, /Individual solves \(2\)/);
  assert.match(html, /<strong>2<\/strong><span>Solves<\/span>/);
  assert.doesNotMatch(html, /data-id="range-[03]"/);
  for (const label of [
    "Last day",
    "Last week",
    "Last month",
    "Last 3 months",
    "All time",
  ])
    assert.match(html, new RegExp(`>${label}</button>`));
  assert.equal([...html.matchAll(/data-action="dashboard-range"/g)].length, 5);
  assert.equal(
    [...html.matchAll(/class="solve-chart daily-timeline"/g)].length,
    1,
  );
  assert.match(html, /id="case-map-title"/);
  assert.doesNotMatch(
    html,
    /aria-label="Progress view"|data-action="dashboard-tab"|solve-trends-title|Recent results/,
  );
  assert.doesNotMatch(
    html,
    /Custom dates|Selected period activity|daily-distribution|individual-times|dashboard-range-start/,
  );
  const stats = html.indexOf('aria-label="Timer summary"');
  const heatmap = html.indexOf('aria-label="Daily activity heatmap"');
  const graph = html.indexOf('class="solve-chart daily-timeline"');
  const ranges = html.indexOf('aria-label="Time range"');
  const cube = html.indexOf('id="dashboard-cube"');
  assert.ok(
    stats < heatmap && heatmap < graph && graph < ranges && ranges < cube,
  );
});

test("Progress places raw hh:mm:ss solving duration with activity and always shows learning content", async () => {
  const { dayKey } = await import("../src/progress.js");
  const today = dayKey();
  const ctx = context();
  ctx.state.view = "progress";
  // A stale view selection must not bring the removed Solves section back.
  ctx.state.dashboard = { range: "all", tab: "solves", cube: "all" };
  ctx.state.solves = [
    {
      id: "duration-a",
      day: today,
      date: `${today}T12:00:00Z`,
      elapsed: 3600999,
      penalty: "+2",
      scramble: "R U",
    },
    {
      id: "duration-b",
      day: today,
      date: `${today}T12:01:00Z`,
      elapsed: 60001,
      penalty: "dnf",
      scramble: "R U",
    },
  ];
  const html = renderApp(ctx);
  const activity = html.slice(
    html.indexOf('aria-label="Activity summary"'),
    html.indexOf('aria-label="Timer summary"'),
  );
  assert.match(
    activity,
    /<strong>01:01:01<\/strong><span>Time solving<\/span>/,
  );
  for (const label of ["Practice attempts", "Active days", "Confident cases"])
    assert.ok(activity.includes(label));
  assert.equal([...html.matchAll(/<span>Time solving<\/span>/g)].length, 1);
  assert.match(html, /id="case-map-OLL"/);
  assert.match(html, /id="case-map-PLL"/);
  assert.doesNotMatch(
    html,
    /data-action="dashboard-tab"|solve-trends-title|Recent results/,
  );
});
