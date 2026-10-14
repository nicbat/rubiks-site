import { test } from "node:test";
import assert from "node:assert/strict";
import catalog from "../data/algorithms.json" with { type: "json" };
import { catalogModule, packCatalog } from "../scripts/pack-catalog.mjs";

test("build-time packing preserves every case, variant, and setup exactly", async () => {
  const before = structuredClone(catalog);
  const output = await import(
    `data:text/javascript;base64,${Buffer.from(catalogModule(catalog)).toString("base64")}`
  );
  assert.deepEqual(output.default, catalog);
  assert.deepEqual(catalog, before);
  assert.throws(
    () => packCatalog([{ setups: ["invalid"] }]),
    /Unsupported setup token/,
  );
});
