// Additive schema foundation only. Production storage/sync still writes v1 until
// server downgrade guards, recovery journals and all readers support v2.
import { EVENT_IDS, isPuzzleId, getCubeEvent } from "./cube-events.js";
import { validDay, validTimestamp } from "./dates.js";
import { MAX_SOLVE_NOTES_LENGTH } from "./solve-history.js";
import { validateProgress } from "./progress.js";
import { validateBackup } from "./training-backup.js";

export const TRAINING_BACKUP_VERSION = 2;
export const LEGACY_SCRAMBLE_GRIP = Object.freeze({
  up: "yellow",
  front: "green",
});
import {
  validateEventScramble,
  validateScrambleGrip,
  validateScrambleProvenance,
} from "@last-layer/cube-engine/scramble";
const solveFields = [
  "id",
  "cubeId",
  "elapsed",
  "penalty",
  "date",
  "day",
  "scramble",
  "notes",
];
const cubeFields = ["id", "name", "description", "deleted"];
const backupFields = [
  "format",
  "version",
  "progress",
  "solves",
  "cubeCollection",
];
function record(value, fields, label) {
  if (
    !value ||
    typeof value !== "object" ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null) ||
    Object.keys(value).some((key) => !fields.includes(key))
  )
    throw Error(`Invalid ${label}`);
}
function nonempty(value) {
  return typeof value === "string" && value.length > 0;
}

// Return detached, chronological records; missing event/grip never implies 333.
export function validateSolvesV2(value) {
  if (!Array.isArray(value) || value.length > 100000)
    throw Error("Invalid solve history");
  const ids = new Set();
  return value
    .map((solve) => {
      record(
        solve,
        [...solveFields, "eventId", "scrambleGrip", "scrambleProvenance"],
        "solve history",
      );
      if (
        !nonempty(solve.id) ||
        ids.has(solve.id) ||
        (solve.cubeId !== undefined &&
          solve.cubeId !== null &&
          !nonempty(solve.cubeId)) ||
        !Number.isFinite(solve.elapsed) ||
        solve.elapsed < 0 ||
        !validTimestamp(solve.date) ||
        (solve.day !== undefined && !validDay(solve.day)) ||
        (solve.penalty !== undefined &&
          !["+2", "dnf"].includes(solve.penalty)) ||
        (solve.notes !== undefined &&
          (typeof solve.notes !== "string" ||
            solve.notes.length > MAX_SOLVE_NOTES_LENGTH))
      )
        throw Error("Invalid solve history");
      validateEventScramble(solve.eventId, solve.scramble);
      record(solve.scrambleGrip, ["up", "front"], "scramble grip");
      if (solve.scrambleProvenance !== undefined)
        record(
          solve.scrambleProvenance,
          ["id", "version", "method"],
          "scramble provenance",
        );
      const scrambleGrip = validateScrambleGrip(solve.scrambleGrip);
      const scrambleProvenance =
        solve.scrambleProvenance === undefined
          ? undefined
          : validateScrambleProvenance(solve.scrambleProvenance);
      ids.add(solve.id);
      return {
        id: solve.id,
        ...(solve.cubeId !== undefined ? { cubeId: solve.cubeId } : {}),
        elapsed: solve.elapsed,
        ...(solve.penalty !== undefined ? { penalty: solve.penalty } : {}),
        date: solve.date,
        ...(solve.day !== undefined ? { day: solve.day } : {}),
        scramble: solve.scramble,
        ...(solve.notes !== undefined ? { notes: solve.notes } : {}),
        eventId: solve.eventId,
        scrambleGrip,
        ...(scrambleProvenance ? { scrambleProvenance } : {}),
      };
    })
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

// Defaults must name live equipment of the event puzzle. Deleted equipment is
// retained for historical references, but cannot become an active default.
export function validateCubeCollectionV2(value) {
  record(value, ["cubes", "defaultsByEvent"], "cube collection");
  if (!Array.isArray(value.cubes) || value.cubes.length > 100000)
    throw Error("Invalid cubes");
  const ids = new Map();
  const cubes = value.cubes.map((cube) => {
    record(cube, [...cubeFields, "puzzleId"], "cube");
    if (
      !nonempty(cube.id) ||
      ids.has(cube.id) ||
      typeof cube.name !== "string" ||
      !cube.name.trim() ||
      cube.name.length > 100 ||
      typeof cube.description !== "string" ||
      cube.description.length > 1000 ||
      (cube.deleted !== undefined && typeof cube.deleted !== "boolean") ||
      !isPuzzleId(cube.puzzleId)
    )
      throw Error("Invalid cube");
    const result = {
      id: cube.id,
      name: cube.name,
      description: cube.description,
      ...(cube.deleted !== undefined ? { deleted: cube.deleted } : {}),
      puzzleId: cube.puzzleId,
    };
    ids.set(cube.id, result);
    return result;
  });
  record(value.defaultsByEvent, EVENT_IDS, "default cubes");
  const defaultsByEvent = {};
  for (const [eventId, id] of Object.entries(value.defaultsByEvent)) {
    const cube = ids.get(id);
    if (
      !nonempty(id) ||
      !cube ||
      cube.deleted ||
      cube.puzzleId !== getCubeEvent(eventId).puzzleId
    )
      throw Error("Invalid default cube");
    defaultsByEvent[eventId] = id;
  }
  return { cubes, defaultsByEvent };
}

// Validate the complete v2 envelope, including cross-record puzzle references.
// Unknown envelope/solve/equipment metadata fails instead of being discarded.
export function validateTrainingBackupV2(value, catalog) {
  record(value, backupFields, "training backup");
  if (value.format !== "last-layer-training" || value.version !== 2)
    throw Error("Unsupported training backup version.");
  const progress = validateProgress(value.progress, catalog);
  const solves = validateSolvesV2(value.solves);
  const cubeCollection = validateCubeCollectionV2(value.cubeCollection);
  const cubes = new Map(cubeCollection.cubes.map((cube) => [cube.id, cube]));
  for (const solve of solves) {
    if (solve.cubeId == null) continue;
    const cube = cubes.get(solve.cubeId);
    if (!cube || cube.puzzleId !== getCubeEvent(solve.eventId).puzzleId)
      throw Error("A solve refers to missing or incompatible equipment.");
  }
  return {
    format: "last-layer-training",
    version: 2,
    progress,
    solves,
    cubeCollection,
  };
}

// Call only after verifying the original snapshot fingerprint. This pure
// conversion neither reads/writes storage nor projects v2 back into v1.
export function migrateTrainingBackupV1(value, catalog) {
  record(value, backupFields, "training backup");
  if (value.format !== "last-layer-training" || value.version !== 1)
    throw Error("Expected a version-1 training backup.");
  if (Array.isArray(value.solves))
    for (const solve of value.solves)
      record(solve, solveFields, "legacy solve");
  record(
    value.cubeCollection,
    ["cubes", "defaultId"],
    "legacy cube collection",
  );
  if (Array.isArray(value.cubeCollection.cubes))
    for (const cube of value.cubeCollection.cubes)
      record(cube, cubeFields, "legacy cube");
  const validated = validateBackup(value, catalog);
  return validateTrainingBackupV2(
    {
      format: "last-layer-training",
      version: 2,
      progress: validated.progress,
      solves: validated.solves.map((solve) => ({
        ...solve,
        eventId: "333",
        scrambleGrip: { ...LEGACY_SCRAMBLE_GRIP },
      })),
      cubeCollection: {
        cubes: validated.cubeCollection.cubes.map((cube) => ({
          ...cube,
          puzzleId: "3x3",
        })),
        defaultsByEvent:
          validated.cubeCollection.defaultId === null
            ? {}
            : { 333: validated.cubeCollection.defaultId },
      },
    },
    catalog,
  );
}
