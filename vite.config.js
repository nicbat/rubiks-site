import { svelte } from "@sveltejs/vite-plugin-svelte";
import { textEditor } from "svelte-text-editor";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { readFile } from "node:fs/promises";
import { catalogModule } from "./scripts/pack-catalog.mjs";
export default defineConfig({
  base: "./",
  resolve: {
    alias: { $lib: fileURLToPath(new URL("./src/lib", import.meta.url)) },
  },
  plugins: [
    textEditor(),
    svelte(),
    tailwindcss(),
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
