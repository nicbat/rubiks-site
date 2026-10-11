import { test } from "node:test";
import assert from "node:assert/strict";
import { caseDiagram } from "../src/case-diagram.js";

test("shared 2D case previews omit visible captions while retaining accessible orientation", () => {
  for (const section of ["OLL", "PLL"]) {
    const svg = caseDiagram(
      "R U R' U'",
      section,
      "Case viewed from above; front at bottom",
      { arrows: true },
    );
    assert.doesNotMatch(svg, /<text\b/);
    assert.match(svg, /aria-label="Case viewed from above; front at bottom"/);
    assert.equal([...svg.matchAll(/<rect\b/g)].length, 21);
  }
});
