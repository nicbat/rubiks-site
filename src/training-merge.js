// Three-way merge against the exact copy last shared with this device. Absence
// relative to that copy is a deletion, including after several offline weeks.
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
      return Object.fromEntries(
        [...keys].sort().flatMap((key) => {
          const value = merge(
            old?.[key],
            a?.[key],
            b?.[key],
            path ? `${path}.${key}` : key,
          );
          return value === undefined ? [] : [[key, value]];
        }),
      );
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
  if (
    !value.cubeCollection.cubes.some(
      (cube) => cube.id === value.cubeCollection.defaultId && !cube.deleted,
    )
  )
    value.cubeCollection = { ...value.cubeCollection, defaultId: null };
  return { value, conflicts };
}
