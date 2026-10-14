// Lossless build-time encoding: the editable JSON and all setup choices stay intact.
export const setupMoves = [
  "U",
  "U2",
  "U'",
  "R",
  "R2",
  "R'",
  "F",
  "F2",
  "F'",
  "D",
  "D2",
  "D'",
  "L",
  "L2",
  "L'",
  "B",
  "B2",
  "B'",
];
export function packCatalog(catalog) {
  return catalog.map((c) => ({
    ...c,
    setups: c.setups.map((setup) =>
      setup
        .split(" ")
        .map((move) => {
          const index = setupMoves.indexOf(move);
          if (index < 0) throw Error(`Unsupported setup token: ${move}`);
          return String.fromCharCode(65 + index);
        })
        .join(""),
    ),
  }));
}
export function catalogModule(catalog) {
  return `const moves=${JSON.stringify(setupMoves)};export default ${JSON.stringify(packCatalog(catalog))}.map(c=>({...c,setups:c.setups.map(s=>Array.from(s,t=>moves[t.charCodeAt(0)-65]).join(" "))}));`;
}
