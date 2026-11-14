import { getCubeEvent, isEventId } from "./cube-events.js";
import { validateCubeCollectionV2 } from "./training-v2.js";

export function cubesForEvent(cubes, eventId, { deleted = false } = {}) {
  if (!isEventId(eventId)) throw Error("Choose a valid solve event.");
  return cubes.filter(
    (cube) =>
      (deleted || !cube.deleted) &&
      cube.puzzleId === getCubeEvent(eventId).puzzleId,
  );
}
export function setEventDefault(collection, eventId, cubeId) {
  if (!isEventId(eventId)) throw Error("Choose a valid solve event.");
  const defaultsByEvent = { ...collection.defaultsByEvent };
  if (cubeId === null) delete defaultsByEvent[eventId];
  else defaultsByEvent[eventId] = cubeId;
  return validateCubeCollectionV2({ ...collection, defaultsByEvent });
}
export function deleteEventCube(collection, id) {
  return validateCubeCollectionV2({
    cubes: collection.cubes.map((cube) =>
      cube.id === id ? { ...cube, deleted: true } : { ...cube },
    ),
    defaultsByEvent: Object.fromEntries(
      Object.entries(collection.defaultsByEvent).filter(
        ([, value]) => value !== id,
      ),
    ),
  });
}
export function saveEventCube(collection, cube, solves) {
  const previous = collection.cubes.find((item) => item.id === cube.id);
  if (
    previous?.puzzleId !== cube.puzzleId &&
    solves.some((solve) => solve.cubeId === cube.id)
  )
    throw Error("A cube with recorded solves cannot change puzzle type.");
  const defaultsByEvent = Object.fromEntries(
    Object.entries(collection.defaultsByEvent).filter(
      ([eventId, id]) =>
        id !== cube.id || getCubeEvent(eventId).puzzleId === cube.puzzleId,
    ),
  );
  return validateCubeCollectionV2({
    cubes: previous
      ? collection.cubes.map((item) => (item.id === cube.id ? cube : item))
      : [...collection.cubes, cube],
    defaultsByEvent,
  });
}
export function withEventSolveEquipment(solves, ids, cubeId, collection) {
  const chosen = new Set(ids);
  const cube =
    cubeId === null
      ? null
      : collection.cubes.find((item) => item.id === cubeId && !item.deleted);
  if (cubeId !== null && !cube) throw Error("Choose an available cube.");
  for (const solve of solves)
    if (
      chosen.has(solve.id) &&
      cube &&
      cube.puzzleId !== getCubeEvent(solve.eventId)?.puzzleId
    )
      throw Error("This cube does not match the solve event.");
  return solves.map((solve) =>
    chosen.has(solve.id) ? { ...solve, cubeId } : solve,
  );
}
