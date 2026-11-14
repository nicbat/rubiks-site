import { CUBE_EVENTS } from "@last-layer/cube-engine/events";
export {
  EVENT_IDS,
  PUZZLE_IDS,
  isEventId,
  isPuzzleId,
} from "@last-layer/cube-engine/events";

const labels = {
  "333oh": "3×3 one-handed",
  "333bf": "3×3 blindfolded",
  "444bf": "4×4 blindfolded",
  "555bf": "5×5 blindfolded",
};
// Planned is a delivery scope, not permission for production writers to save v2.
export const CUBE_EVENT_REGISTRY = Object.freeze(
  CUBE_EVENTS.map((event) =>
    Object.freeze({
      ...event,
      label: labels[event.id] ?? `${event.size}×${event.size}`,
      availability: "planned",
      statistics: Object.freeze({ averages: !event.blindfolded }),
    }),
  ),
);
export const COMING_SOON_EVENTS = Object.freeze(
  [
    ["333mbf", "Multi-blind"],
    ["pyram", "Pyraminx"],
    ["skewb", "Skewb"],
    ["minx", "Megaminx"],
    ["clock", "Clock"],
  ].map(([id, label]) =>
    Object.freeze({ id, label, availability: "coming-soon" }),
  ),
);
const registry = new Map(
  [...CUBE_EVENT_REGISTRY, ...COMING_SOON_EVENTS].map((event) => [
    event.id,
    event,
  ]),
);
export const getCubeEvent = (id) => registry.get(id);
