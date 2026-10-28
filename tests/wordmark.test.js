import { test } from "node:test";
import assert from "node:assert/strict";
import { pixelate, wordmark } from "../src/wordmark.js";

const { cell, rows: letterRows } = wordmark;
const runs = (d) =>
  [...d.matchAll(/M(-?[\d.]+) (-?[\d.]+)h(-?[\d.]+)v([\d.]+)/g)].map((m) =>
    m.slice(1).map(Number),
  );
const onGrid = (n) => Math.abs(n / cell - Math.round(n / cell)) < 1e-3;

test("the wordmark is drawn entirely in whole grid cells", () => {
  const all = runs(wordmark.d);
  assert.ok(all.length > 50);
  for (const [x, y, width, height] of all) {
    assert.ok(onGrid(x) && onGrid(y), `run at ${x},${y} is on the grid`);
    assert.ok(onGrid(width) && width > 0, `run width ${width}`);
    assert.ok(Math.abs(height - cell) < 1e-3, `run height ${height}`);
  }
  assert.ok(Math.abs(wordmark.offset - cell) < 1e-3, "offset is one cell");
});

test("the grid keeps every letter's cap line and baseline", () => {
  const rows = new Set(runs(wordmark.d).map(([, y]) => Math.round(y / cell)));
  // Every row of the letters is drawn; nothing is dropped from either end.
  for (let row = 0; row < letterRows; row++)
    assert.ok(rows.has(row), `row ${row}`);
  // Only the A apexes rise above the cap line (by one row), and only the R's
  // blade drops below the baseline, down to 44 units.
  const outside = [...rows].filter((row) => row < 0 || row >= letterRows);
  for (const row of outside)
    assert.ok(row === -1 || (row >= letterRows && row * cell < 44), `${row}`);
  assert.ok(outside.includes(-1) && outside.some((row) => row >= letterRows));
});

test("a coarser grid draws fewer runs from the same letters", () => {
  assert.ok(pixelate(cell * 2).length < pixelate(cell).length);
});
