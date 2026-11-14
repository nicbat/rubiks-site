// Hex-only palette values are safe to embed in scene markup and portable to CSS.
export const defaultPalette = Object.freeze({
  U: "#ffd84a",
  D: "#ffffff",
  R: "#f5a34b",
  L: "#ec665c",
  F: "#47bba0",
  B: "#629ae0",
});
export function resolvePalette(input = defaultPalette) {
  const result = {};
  for (const face of Object.keys(defaultPalette)) {
    const value = input[face];
    if (
      typeof value !== "string" ||
      !/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)
    )
      throw new TypeError(
        "Palette must provide a hexadecimal color for each face",
      );
    result[face] = value;
  }
  return Object.freeze(result);
}
