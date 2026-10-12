import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderApp } from "../src/views.js";
import { createAlgorithmRenderer } from "../src/algorithm.js";
import { emptyProgress, statusFor } from "../src/progress.js";
const catalog = JSON.parse(
  readFileSync(new URL("../data/algorithms.json", import.meta.url)),
);
const triggers = JSON.parse(
  readFileSync(new URL("../data/triggers.json", import.meta.url)),
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
    chunks: createAlgorithmRenderer(triggers),
  };
}
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
      /Two-look steps and practice sets have different frequencies/,
    );
    assert.match(
      html,
      section === "OLL" ? /OLL skip: 1\/216/ : /PLL skip: 1\/72/,
    );
    for (const c of cases) {
      ctx.state.detail = c.id;
      const dialog = renderApp(ctx).split('<dialog id="detail-dialog"')[1];
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
    renderApp(ctx).split('<dialog id="detail-dialog"')[1],
    /Occurrence 1\/72/,
  );
  ctx.variant = (c) => c.algorithms.length - 1;
  assert.match(
    renderApp(ctx).split('<dialog id="detail-dialog"')[1],
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
