import test from "node:test";
import assert from "node:assert/strict";
import { render } from "svelte/server";
import Timer from "../src/components/Timer.svelte";
import Cubes from "../src/components/Cubes.svelte";
const solves = [
  {
    id: "two",
    eventId: "222",
    elapsed: 3000,
    date: "2026-10-17T12:00:00Z",
    scramble: "R U F",
    cubeId: "small",
  },
  {
    id: "three",
    eventId: "333",
    elapsed: 30000,
    date: "2026-10-17T12:01:00Z",
    scramble: "R U F",
    cubeId: "regular",
  },
];
const cubes = [
  { id: "small", puzzleId: "2x2", name: "Small cube", description: "" },
  { id: "regular", puzzleId: "3x3", name: "Regular cube", description: "" },
];
function show(extra = {}) {
  return render(Timer, {
    props: {
      status: "ready",
      scramble: "R U F",
      elapsed: 0,
      eventId: "222",
      solves,
      cubes,
      scrambleGrip: { up: "white", front: "green" },
      eventOptions: [
        { value: "222", label: "2×2" },
        { value: "444", label: "4×4 · Coming soon", disabled: true },
      ],
      ...extra,
    },
  }).body;
}
test("timer statistics, equipment and history stay scoped to the selected event", () => {
  const html = show();
  assert.match(html, /Hold white on top, green in front/);
  assert.match(html, /Solve history \(1\)/);
  assert.match(html, /data-id="two"/);
  assert.doesNotMatch(html, /data-id="three"|0:30\.00/);
  assert.match(show({ eventId: "333" }), /data-id="three"/);
});
test("loading and error timer states cannot expose a startable or previewable scramble", () => {
  const loading = show({ status: "loading", scramble: null });
  assert.match(loading, /Generating scramble/);
  for (const action of ["timer-toggle", "scramble-preview"]) {
    const button = loading.match(
      new RegExp(`<button[^>]*data-action="${action}"[^>]*>`),
    )[0];
    assert.match(button, /disabled/);
  }
  assert.match(
    show({
      status: "error",
      scramble: null,
      error: { code: "GENERATION_FAILED" },
    }),
    /Retry scramble/,
  );
  const blocked = show({ error: { code: "START_BLOCKED" } });
  assert.match(blocked, /Training data is not ready/);
  assert.doesNotMatch(blocked, /generation failed|Retry scramble/);
});
test("equipment editor exposes puzzle identity and per-event defaults without legacy default fallback", () => {
  const html = render(Cubes, {
    props: {
      cubes,
      defaultsByEvent: { 222: "small", "333oh": "regular" },
      eventId: "333oh",
    },
  }).body;
  assert.match(html, /Default cube event/);
  assert.match(html, /Default for 3×3 one-handed/);
  assert.match(html, /name="puzzleId"/);
  assert.doesNotMatch(
    html,
    /<button[^>]*data-action="equipment-default"[^>]*data-id="small"/,
  );
});
