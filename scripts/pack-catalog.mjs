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
  const algorithmMoves = [
    ...new Set(
      catalog.flatMap((c) => c.algorithms.flatMap((a) => a.moves.split(" "))),
    ),
  ];
  // Reversing setup tokens exposes common suffixes to the shared dictionary.
  const rows = packCatalog(catalog).map((c) =>
    keys.map((key) =>
      key === "setups"
        ? c[key].map((s) => [...s].reverse().join("")).join(" ")
        : key === "algorithms"
          ? c[key].map((a) => ({
              ...a,
              moves: a.moves
                .split(" ")
                .map((m) => String.fromCharCode(65 + algorithmMoves.indexOf(m)))
                .join(""),
            }))
          : c[key],
    ),
  );
  // Share frequent move pairs across setups without changing their order.
  const setupIndex = keys.indexOf("setups");
  const tokens =
    "abcdefghijklmnopqrstuvwxyzSTUVWXYZ0123456789!#$%&()*+,-./:;<=>?@[]^_{|}~";
  const dictionary = [];
  for (let i = 0; i < tokens.length; i++) {
    const pairs = new Map();
    for (const row of rows) {
      for (const match of row[setupIndex].matchAll(/(?=([^ ]{2}))/g))
        pairs.set(match[1], (pairs.get(match[1]) || 0) + 1);
    }
    const pair = [...pairs].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!pair) break;
    dictionary.push(pair);
    for (const row of rows)
      row[setupIndex] = row[setupIndex].replaceAll(pair, tokens[i]);
  }
  return `const algorithmMoves=${JSON.stringify(algorithmMoves)},tokens=${JSON.stringify(tokens)},dictionary=${JSON.stringify(dictionary)},moves=${JSON.stringify(setupMoves)},keys=${JSON.stringify(keys)};export default ${JSON.stringify(rows)}.map(row=>{const c=Object.fromEntries(keys.map((key,i)=>[key,row[i]]));return {...c,algorithms:c.algorithms.map(a=>({...a,moves:Array.from(a.moves,t=>algorithmMoves[t.charCodeAt(0)-65]).join(" ")})),setups:c.setups.split(" ").map(s=>Array.from([...dictionary.reduceRight((s,p,i)=>s.replaceAll(tokens[i],()=>p),s)].reverse(),t=>moves[t.charCodeAt(0)-65]).join(" "))}});`;
}
