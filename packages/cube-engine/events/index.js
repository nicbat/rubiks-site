// Stable physical/event identities. App labels and release gates live in the app.
const definitions = [
  ["222", "2x2", 2],
  ["333", "3x3", 3],
  ["444", "4x4", 4],
  ["555", "5x5", 5],
  ["666", "6x6", 6],
  ["777", "7x7", 7],
  ["333oh", "3x3", 3],
  ["333bf", "3x3", 3],
  ["444bf", "4x4", 4],
  ["555bf", "5x5", 5],
];
export const CUBE_EVENTS = Object.freeze(
  definitions.map(([id, puzzleId, size]) =>
    Object.freeze({ id, puzzleId, size, blindfolded: id.endsWith("bf") }),
  ),
);
export const EVENT_IDS = Object.freeze(CUBE_EVENTS.map(({ id }) => id));
export const PUZZLE_IDS = Object.freeze([
  ...new Set(CUBE_EVENTS.map(({ puzzleId }) => puzzleId)),
]);
const events = new Map(CUBE_EVENTS.map((event) => [event.id, event]));
export const getEventDefinition = (id) => events.get(id);
export const isEventId = (id) => events.has(id);
export const isPuzzleId = (id) => PUZZLE_IDS.includes(id);
