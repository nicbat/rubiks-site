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
  const keys = [...new Set(catalog.flatMap((c) => Object.keys(c)))];
  if (
    catalog.some(
      (c) =>
        Object.keys(c).length !== keys.length ||
        keys.some((key) => !Object.hasOwn(c, key)),
    )
  )
    throw Error("Catalog cases must share the same fields");
  const rows = packCatalog(catalog).map((c) =>
    keys.map((key) => (key === "setups" ? c[key].join(" ") : c[key])),
  );
  return `const moves=${JSON.stringify(setupMoves)},keys=${JSON.stringify(keys)};export default ${JSON.stringify(rows)}.map(row=>{const c=Object.fromEntries(keys.map((key,i)=>[key,row[i]]));return {...c,setups:c.setups.split(" ").map(s=>Array.from(s,t=>moves[t.charCodeAt(0)-65]).join(" "))}});`;
}
