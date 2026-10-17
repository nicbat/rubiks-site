import { test } from "node:test";
import assert from "node:assert/strict";
import { createAlgorithmTokenizer } from "../src/algorithm.js";
import { render } from "svelte/server";
import Algorithm from "../src/components/Algorithm.svelte";
import { escape } from "../src/html.js";

test("longest trigger wins regardless of catalog order and preserves plain moves", () => {
  const chunks = createAlgorithmTokenizer([
    { name: "Short", moves: "R U R'" },
    { name: "Full", moves: "R U R' U'" },
    { name: "Empty", moves: "" },
  ]);
  assert.deepEqual(chunks("F (R U R' U') F'"), [
    { moves: "F" },
    { name: "Full", moves: "R U R' U'" },
    { moves: "F'" },
  ]);
});

test("trigger names remain data and shared HTML escaping cannot inject markup", () => {
  const name = '<img src=x onerror="alert(1)">';
  assert.deepEqual(createAlgorithmTokenizer([{ name, moves: "R" }])("R"), [
    { name, moves: "R" },
  ]);
  assert.equal(escape("&<>\"'"), "&amp;&lt;&gt;&quot;&#39;");
});

test("Svelte renders hostile trigger labels as inert text", () => {
  const name = '<img src=x onerror="alert(1)">';
  const tokenizer = createAlgorithmTokenizer([{ name, moves: "R" }]);
  const html = render(Algorithm, { props: { moves: "R", tokenizer } }).body;
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img src=x onerror=/);
  assert.match(html, /role="tooltip"/);
});
