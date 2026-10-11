export const CUBES_KEY = "last-layer.cubes.v1";

export function validateCubes(value) {
  if (!value || !Array.isArray(value.cubes)) throw Error("Invalid cubes");
  const ids = new Set();
  const cubes = value.cubes.map((cube) => {
    if (
      !cube ||
      typeof cube.id !== "string" ||
      !cube.id ||
      ids.has(cube.id) ||
      typeof cube.name !== "string" ||
      !cube.name.trim() ||
      cube.name.length > 100 ||
      (cube.deleted !== undefined && typeof cube.deleted !== "boolean") ||
      typeof cube.description !== "string" ||
      cube.description.length > 1000
    )
      throw Error("Invalid cube");
    ids.add(cube.id);
    return {
      id: cube.id,
      name: cube.name.trim(),
      description: cube.description,
      ...(cube.deleted ? { deleted: true } : {}),
    };
  });
  if (
    value.defaultId !== null &&
    !cubes.some((c) => c.id === value.defaultId && !c.deleted)
  )
    throw Error("Invalid default cube");
  return { cubes, defaultId: value.defaultId };
}

// Retain deleted records solely so historical solve references keep their names.
export function deleteCube(collection, id) {
  const cubes = collection.cubes.map((cube) =>
    cube.id === id ? { ...cube, deleted: true } : { ...cube },
  );
  return {
    cubes,
    defaultId:
      collection.defaultId === id
        ? (cubes.find((cube) => !cube.deleted)?.id ?? null)
        : collection.defaultId,
  };
}
