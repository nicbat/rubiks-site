// Read only literal data from upstream JavaScript; never execute downloaded code.
import { parse } from "acorn";
import { writeFile, readFile } from "node:fs/promises";
const literal = (n) => {
  if (n.type === "Literal") return n.value;
  if (n.type === "ArrayExpression") return n.elements.map(literal);
  throw Error("Expected literal array");
};
const catalog = [];
for (const section of ["OLL", "PLL"]) {
  const file = process.argv.includes("--cached")
    ? await readFile(`/tmp/jperm-${section.toLowerCase()}.js`, "utf8")
    : await (
        await fetch(`https://jperm.net/lib/${section.toLowerCase()}.js`)
      ).text();
  const declarations = parse(file, { ecmaVersion: "latest" }).body.flatMap(
    (n) => (n.type === "VariableDeclaration" ? n.declarations : []),
  );
  const cases = declarations.find((d) => d.id.name === "algsetAlgs").init
    .elements;
  const scrambles = literal(
    declarations.find((d) => d.id.name === "algsetScrambles").init,
  );
  for (const [index, node] of cases.entries()) {
    const fields = Object.fromEntries(
      node.properties.map((p) => [p.key.name, p.value]),
    );
    const name = literal(fields.name),
      algs = literal(fields.alg);
    catalog.push({
      id: `${section.toLowerCase()}-${name}`,
      section,
      name: section === "OLL" ? `OLL ${name}` : `${name} perm`,
      group: literal(fields.group),
      source: `https://jperm.net/algs/${section.toLowerCase()}`,
      preferredVariant: 0,
      algorithms: algs.map((moves, i) => ({
        label: i === 0 ? "Default" : `Alternative ${i}`,
        moves,
      })),
      setups: scrambles[index].slice(0, 16),
    });
  }
}
await writeFile(
  "data/algorithms.json",
  JSON.stringify(catalog, null, 2) + "\n",
);
console.log(`Imported ${catalog.length} cases`);
