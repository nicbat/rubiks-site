import { test } from "node:test";
import assert from "node:assert/strict";
import { loadPreferences, savePreferences } from "../src/preferences.js";

test("hidden timer defaults off, validates booleans and round-trips", () => {
  let raw = null;
  const storage = {
    getItem: () => raw,
    setItem: (_, value) => {
      raw = value;
    },
  };
  assert.equal(loadPreferences(storage).hideTimer, false);
  raw = '{"hideTimer":"true"}';
  assert.equal(loadPreferences(storage).hideTimer, false);
  savePreferences({ hideTimer: true }, storage);
  assert.equal(loadPreferences(storage).hideTimer, true);
  raw = "broken";
  assert.equal(loadPreferences(storage).hideTimer, false);
});

test("PLL arrows default on and preserve an explicitly saved off preference", () => {
  let raw = null;
  const storage = {
    getItem: () => raw,
    setItem: (_, value) => {
      raw = value;
    },
  };
  for (const value of [null, "{}", "broken", '{"pllArrows":"false"}']) {
    raw = value;
    assert.equal(loadPreferences(storage).pllArrows, true);
  }
  savePreferences({ pllArrows: false }, storage);
  assert.equal(loadPreferences(storage).pllArrows, false);
  savePreferences({ pllArrows: true }, storage);
  assert.equal(loadPreferences(storage).pllArrows, true);
  assert.equal(
    loadPreferences({
      getItem() {
        throw new Error("Unavailable");
      },
    }).pllArrows,
    true,
  );
});
