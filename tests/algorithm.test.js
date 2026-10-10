import { test } from "node:test";
import assert from "node:assert/strict";
import { createAlgorithmRenderer } from "../src/algorithm.js";
import { escape } from "../src/html.js";

test("longest trigger wins regardless of catalog order and preserves plain moves", () => {
  const chunks = createAlgorithmRenderer([
    { name: "Short", moves: "R U R'" },
    { name: "Full", moves: "R U R' U'" },
    { name: "Empty", moves: "" },
  ]);
  const html = chunks("F (R U R' U') F'");
  assert.match(html, /<span>Full<\/span>/);
  assert.doesNotMatch(html, /Short|Empty/);
  assert.match(html, /plain-moves">F<\/span>/);
  assert.match(html, /plain-moves">F&#39;<\/span>/);
});

test("trigger names and shared HTML escaping cannot inject markup", () => {
  const chunks = createAlgorithmRenderer([
    { name: '<img src=x onerror="alert(1)">', moves: "R" },
  ]);
  assert.doesNotMatch(chunks("R"), /<img/);
  assert.match(chunks("R"), /&lt;img/);
  assert.equal(escape("&<>\"'"), "&amp;&lt;&gt;&quot;&#39;");
});
