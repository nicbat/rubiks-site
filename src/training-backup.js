import { STORAGE_KEY, validateProgress } from "./progress.js";
import { SOLVES_KEY, validateSolves } from "./solve-history.js";
import { CUBES_KEY, validateCubes } from "./cubes.js";

export const RESTORE_KEY = "last-layer.restore.v1";
const keys = [STORAGE_KEY, SOLVES_KEY, CUBES_KEY];
export function trainingBackup(progress, solves, cubeCollection) {
  return {
    format: "last-layer-training",
    version: 1,
    progress,
    solves,
    cubeCollection,
  };
}
export function validateBackup(value, catalog) {
  if (
    value?.format === undefined &&
    value?.version === 1 &&
    !Array.isArray(value)
  )
    return {
      progress: validateProgress({ ...value, version: 2 }, catalog),
      legacyVersion: 1,
    };
  if (value?.format !== "last-layer-training")
    return { progress: validateProgress(value, catalog) };
  if (value.version !== 1) throw Error("Unsupported training backup version.");
  const progress = validateProgress(value.progress, catalog);
  const solves = validateSolves(value.solves);
  const cubeCollection = validateCubes(value.cubeCollection);
  const ids = new Set(cubeCollection.cubes.map((c) => c.id));
  if (solves.some((s) => s.cubeId && !ids.has(s.cubeId)))
    throw Error("A solve refers to a cube missing from this backup.");
  return { progress, solves, cubeCollection };
}
// Journal the original bytes before any replacement. Removal is the commit point.
// Interrupted restores roll back on the next load, before any records are read.
export function recoverRestore(storage) {
  const raw = storage.getItem(RESTORE_KEY);
  if (raw === null) return;
  const previous = JSON.parse(raw);
  if (
    !Array.isArray(previous) ||
    previous.length !== keys.length ||
    previous.some((v) => v !== null && typeof v !== "string")
  )
    throw Error("Invalid restore journal");
  keys.forEach((key, i) =>
    previous[i] === null
      ? storage.removeItem(key)
      : storage.setItem(key, previous[i]),
  );
  storage.removeItem(RESTORE_KEY);
}
export function restoreBackup(storage, backup) {
  recoverRestore(storage);
  const previous = keys.map((key) => storage.getItem(key));
  const changes = [[STORAGE_KEY, JSON.stringify(backup.progress)]];
  if (backup.solves)
    changes.push(
      [SOLVES_KEY, JSON.stringify(backup.solves)],
      [CUBES_KEY, JSON.stringify(backup.cubeCollection)],
    );
  storage.setItem(RESTORE_KEY, JSON.stringify(previous));
  try {
    for (const [key, value] of changes) storage.setItem(key, value);
    storage.removeItem(RESTORE_KEY);
  } catch (error) {
    try {
      recoverRestore(storage);
    } catch {
      /* Journal remains for next load. */
    }
    throw error;
  }
}
