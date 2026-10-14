import { defineConfig } from "vite";
import { readFile } from "node:fs/promises";
import { catalogModule } from "./scripts/pack-catalog.mjs";
export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "compact-catalog-setups",
      apply: "build",
      enforce: "pre",
      async resolveId(source, importer) {
        if (source.endsWith("/data/algorithms.json") && importer)
          return "\0compact-catalog";
      },
      async load(id) {
        if (id === "\0compact-catalog")
          return catalogModule(
            JSON.parse(
              await readFile(
                new URL("./data/algorithms.json", import.meta.url),
                "utf8",
              ),
            ),
          );
      },
    },
  ],
});
