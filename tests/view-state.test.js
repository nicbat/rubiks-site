import { test } from "node:test";
import assert from "node:assert/strict";
import { snapshotViewState } from "../src/view-state.js";

test("view publication does not walk history and refreshes mutable UI boundaries", () => {
  const attempts = new Proxy(Array(100000), {
    get(target, key) {
      if (key === Symbol.iterator || /^\d+$/.test(String(key)))
        throw new Error("View publication must not scan history");
      return Reflect.get(target, key);
    },
  });
  const state = {
    progress: { attempts },
    preferences: { pllArrows: false },
    solves: [{ id: "solve", elapsed: 1234 }],
    session: { stage: "setup" },
    pllQuiz: { question: { answer: null } },
  };
  const first = snapshotViewState(state);
  state.solves[0].penalty = "+2";
  state.session.stage = "answer";
  state.preferences.pllArrows = true;
  state.pllQuiz.question.answer = "pll-T";
  const second = snapshotViewState(state);
  assert.equal(second.progress.attempts, attempts);
  assert.notEqual(first.progress, second.progress);
  assert.equal(first.solves[0].penalty, undefined);
  assert.equal(second.solves[0].penalty, "+2");
  assert.equal(first.session.stage, "setup");
  assert.equal(second.session.stage, "answer");
  assert.equal(first.preferences.pllArrows, false);
  assert.equal(second.preferences.pllArrows, true);
  assert.equal(first.pllQuiz.question.answer, null);
  assert.equal(second.pllQuiz.question.answer, "pll-T");
});
