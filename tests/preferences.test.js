import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadPreferences,
  savePreferences,
  preferenceChange,
} from "../src/preferences.js";

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

test("the case color selector preserves saved choices and keeps physical setups independent", () => {
  const before = loadPreferences({
    getItem: () =>
      JSON.stringify({
        displayTop: "F",
        randomDisplay: true,
        randomLastLayer: true,
      }),
  });
  const fixed = preferenceChange(before, "case-color", "D");
  assert.equal(fixed.displayTop, "D");
  assert.equal(fixed.randomDisplay, false);
  assert.equal(fixed.randomLastLayer, true);
  assert.equal(before.displayTop, "F");
  assert.equal(before.randomDisplay, true);
  const random = preferenceChange(fixed, "case-color", "random");
  assert.equal(random.displayTop, "D", "library retains the last fixed color");
  assert.equal(random.randomDisplay, true);
  let raw;
  assert.equal(
    savePreferences(random, {
      setItem: (_, value) => {
        raw = value;
      },
    }),
    true,
  );
  assert.deepEqual(loadPreferences({ getItem: () => raw }), random);
  assert.equal(preferenceChange(random, "case-color", "invalid"), null);
});

test("time format choices carry existing preferences forward without changing saved solves", () => {
  const before = loadPreferences({
    getItem: () => '{"timerMinutes":false,"hideTimer":true}',
  });
  assert.equal(before.timerMinutes, false);
  const minutes = preferenceChange(before, "time-format", "minutes");
  assert.equal(minutes.timerMinutes, true);
  assert.equal(minutes.hideTimer, true);
  assert.equal(before.timerMinutes, false);
  const seconds = preferenceChange(minutes, "time-format", "seconds");
  assert.deepEqual(seconds, before);
  for (const [id, value] of [
    ["time-format", "other"],
    ["pll-arrows", "true"],
    ["unknown", true],
    ["__proto__", true],
  ])
    assert.equal(preferenceChange(before, id, value), null);
});

test("a failed preference save retains the previously stored preferences for recovery", () => {
  const raw = '{"displayTop":"F","randomDisplay":true}';
  const storage = {
    getItem: () => raw,
    setItem: () => {
      throw Error("Quota exceeded");
    },
  };
  const before = loadPreferences(storage);
  const next = preferenceChange(before, "case-color", "D");
  assert.equal(savePreferences(next, storage), false);
  assert.deepEqual(loadPreferences(storage), before);
  assert.equal(
    next.displayTop,
    "D",
    "the selected value can still apply for this tab",
  );
});
