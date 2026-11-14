import { getCubeEvent } from "./cube-events.js";

// Three-way merge against the local version whose edits were acknowledged.
// Incoming changes may still be unapplied. Absence relative to the local
// baseline is a deletion, including after several offline weeks.
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
const equal = (a, b) => canonical(a) === canonical(b);
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value);
export function mergeTraining(base, device, cloud, choice) {
  const version = base.version;
  if (
    device.version !== version ||
    cloud.version !== version ||
    ![undefined, 1, 2].includes(version)
  )
    throw Error("Normalize training versions before merging.");
  const conflicts = [];
  const recordLists = new Set([
    "solves",
    "progress.attempts",
    "cubeCollection.cubes",
  ]);
  const setList = (path) =>
    ["progress.selected", "progress.reviewed", "progress.transfers"].includes(
      path,
    ) || /^progress\.(known|twoLookKnown)\.[^.]+$/.test(path);
  const containers = new Set([
    "progress.known",
    "progress.twoLookKnown",
    "progress.variants",
    "progress.resume",
  ]);
  function conflict(a, b, path) {
    conflicts.push(path);
    return choice === "cloud" ? b : a;
  }
  function merge(old, a, b, path) {
    if (equal(a, b)) return a;
    if (equal(a, old)) return b;
    if (equal(b, old)) return a;
    if (setList(path)) {
      const keyed = (values) =>
        new Map((values || []).map((value) => [canonical(value), value]));
      const before = keyed(old),
        left = keyed(a),
        right = keyed(b);
      return [...new Set([...before.keys(), ...left.keys(), ...right.keys()])]
        .sort()
        .flatMap((key) => {
          const keep = merge(
            before.has(key),
            left.has(key),
            right.has(key),
            `${path}.member`,
          );
          return keep
            ? [left.get(key) ?? right.get(key) ?? before.get(key)]
            : [];
        });
    }
    if (recordLists.has(path) && Array.isArray(a) && Array.isArray(b)) {
      // Old exports without IDs cannot safely distinguish duplicate attempts.
      if ([...(old || []), ...a, ...b].some((value) => !value.id))
        return conflict(a, b, path);
      const keyed = (values) =>
        new Map((values || []).map((value) => [value.id, value]));
      const before = keyed(old),
        left = keyed(a),
        right = keyed(b);
      return [...new Set([...before.keys(), ...left.keys(), ...right.keys()])]
        .sort()
        .flatMap((key) => {
          const value = merge(
            before.get(key),
            left.get(key),
            right.get(key),
            `${path}[${key}]`,
          );
          return value === undefined ? [] : [value];
        });
    }
    if (
      (object(a) && object(b) && (old === undefined || object(old))) ||
      containers.has(path)
    ) {
      const keys = new Set([
        ...Object.keys(old || {}),
        ...Object.keys(a || {}),
        ...Object.keys(b || {}),
      ]);
      let identity = {};
      if (version === 2 && /^solves\[.*\]$/.test(path)) {
        const fields = [
          "eventId",
          "scramble",
          "scrambleGrip",
          "scrambleProvenance",
        ];
        const pick = (value) =>
          Object.fromEntries(
            fields
              .filter((field) => value?.[field] !== undefined)
              .map((field) => [field, value[field]]),
          );
        const before = pick(old),
          left = pick(a),
          right = pick(b);
        // Identity is one observation. Mixing an event edit with another side's
        // scramble/grip/generator would invent a solve that neither recorded.
        identity =
          equal(left, right) || equal(right, before)
            ? left
            : equal(left, before)
              ? right
              : conflict(left, right, `${path}.scrambleIdentity`);
        for (const field of fields) keys.delete(field);
      }
      return {
        ...Object.fromEntries(
          [...keys].sort().flatMap((key) => {
            const value = merge(
              old?.[key],
              a?.[key],
              b?.[key],
              path ? `${path}.${key}` : key,
            );
            return value === undefined ? [] : [[key, value]];
          }),
        ),
        ...identity,
      };
    }
    return conflict(a, b, path);
  }
  const value = structuredClone(merge(base, device, cloud, ""));
  // Imported backups may physically remove a cube. Preserve a deleted label
  // when an independently added solve still refers to that historical cube.
  const ids = new Set(value.cubeCollection.cubes.map((cube) => cube.id));
  for (const solve of value.solves) {
    if (!solve.cubeId || ids.has(solve.cubeId)) continue;
    const original = [device, cloud, base]
      .flatMap((copy) => copy.cubeCollection.cubes)
      .find((cube) => cube.id === solve.cubeId);
    if (original) {
      value.cubeCollection = {
        ...value.cubeCollection,
        cubes: [...value.cubeCollection.cubes, { ...original, deleted: true }],
      };
      ids.add(original.id);
    }
  }
  if (version === 2) {
    reconcileEquipmentV2(value, [base, device, cloud], choice, conflicts);
  } else if (
    !value.cubeCollection.cubes.some(
      (cube) => cube.id === value.cubeCollection.defaultId && !cube.deleted,
    )
  )
    value.cubeCollection = { ...value.cubeCollection, defaultId: null };
  return { value, conflicts };
}

// A valid edit on each device can produce an invalid combination: one device
// reclassifies an unused cube while the other independently records a solve on
// it. Resolve those linked records together, never relabel or detach a solve.
function reconcileEquipmentV2(value, sources, choice, conflicts) {
  const cubes = new Map(
    value.cubeCollection.cubes.map((cube) => [cube.id, cube]),
  );
  const affected = new Set();
  const conflictingDefaults = new Set();
  const report = (path) => {
    if (!conflicts.includes(path)) conflicts.push(path);
  };
  for (const solve of value.solves) {
    if (solve.cubeId == null) continue;
    const cube = cubes.get(solve.cubeId);
    if (!cube || cube.puzzleId !== getCubeEvent(solve.eventId)?.puzzleId) {
      affected.add(solve.cubeId);
      report(`solves[${solve.id}].cubeId`);
      report(`cubeCollection.cubes[${solve.cubeId}].puzzleId`);
    }
  }
  for (const [eventId, id] of Object.entries(
    value.cubeCollection.defaultsByEvent,
  )) {
    const cube = cubes.get(id);
    if (!cube || cube.deleted) {
      delete value.cubeCollection.defaultsByEvent[eventId];
    } else if (cube.puzzleId !== getCubeEvent(eventId)?.puzzleId) {
      affected.add(id);
      conflictingDefaults.add(eventId);
      report(`cubeCollection.defaultsByEvent.${eventId}`);
      report(`cubeCollection.cubes[${id}].puzzleId`);
    }
  }
  if (!affected.size) return;
  const directlyConflicting = new Set(affected);

  const copies = [...sources, value];
  const records = new Map();
  const defaults = new Map();
  for (const copy of copies) {
    for (const solve of copy.solves) {
      if (!records.has(solve.id)) records.set(solve.id, new Set());
      if (solve.cubeId != null) records.get(solve.id).add(solve.cubeId);
    }
    for (const [eventId, id] of Object.entries(
      copy.cubeCollection.defaultsByEvent,
    )) {
      if (!defaults.has(eventId)) defaults.set(eventId, new Set());
      defaults.get(eventId).add(id);
    }
  }
  // Include alternate references for the same solve/default, so a selected
  // side's valid record cannot point outside the component being restored.
  const connections = new Map();
  for (const ids of [...records.values(), ...defaults.values()])
    for (const id of ids) {
      if (!connections.has(id)) connections.set(id, []);
      connections.get(id).push(ids);
    }
  const pending = [...affected];
  const visited = new Set();
  for (let index = 0; index < pending.length; index++)
    for (const ids of connections.get(pending[index]) || []) {
      if (visited.has(ids)) continue;
      visited.add(ids);
      for (const id of ids)
        if (!affected.has(id)) {
          affected.add(id);
          pending.push(id);
        }
    }
  const selected = sources[choice === "cloud" ? 2 : 1];
  const selectedCubeIds = new Set(
    selected.cubeCollection.cubes.map((cube) => cube.id),
  );
  value.cubeCollection.cubes = [
    ...value.cubeCollection.cubes.filter(
      (cube) =>
        !affected.has(cube.id) ||
        (!directlyConflicting.has(cube.id) && !selectedCubeIds.has(cube.id)),
    ),
    ...structuredClone(
      selected.cubeCollection.cubes.filter((cube) => affected.has(cube.id)),
    ),
  ].sort((a, b) => a.id.localeCompare(b.id, "en"));
  const resolvedCubes = new Map(
    value.cubeCollection.cubes.map((cube) => [cube.id, cube]),
  );
  const selectedSolves = new Map(
    selected.solves.map((solve) => [solve.id, solve]),
  );
  value.solves = value.solves.flatMap((solve) => {
    const cube = resolvedCubes.get(solve.cubeId);
    if (
      solve.cubeId == null ||
      cube?.puzzleId === getCubeEvent(solve.eventId)?.puzzleId
    )
      return [solve];
    const replacement = selectedSolves.get(solve.id);
    return replacement ? [structuredClone(replacement)] : [];
  });
  for (const [eventId, ids] of defaults) {
    if (![...ids].some((id) => affected.has(id))) continue;
    const currentId = value.cubeCollection.defaultsByEvent[eventId];
    const currentCube = resolvedCubes.get(currentId);
    if (
      !conflictingDefaults.has(eventId) &&
      (currentId === undefined ||
        (currentCube &&
          !currentCube.deleted &&
          currentCube.puzzleId === getCubeEvent(eventId)?.puzzleId))
    )
      continue;
    const id = selected.cubeCollection.defaultsByEvent[eventId];
    if (id === undefined) delete value.cubeCollection.defaultsByEvent[eventId];
    else value.cubeCollection.defaultsByEvent[eventId] = id;
  }
}

export function mergeGuestTraining(base, device, guest) {
  const merged = mergeTraining(base, device, guest, "device");
  // Without IDs, choosing the account's entire attempt list would silently
  // discard guest practice. Guest initialization can migrate IDs safely first.
  if (merged.conflicts.includes("progress.attempts"))
    throw Error(
      "Guest practice history needs an upgrade. Export both backups, then sign out and reload before retrying the transfer.",
    );
  return merged.value;
}
