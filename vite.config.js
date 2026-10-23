import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { readFile } from "node:fs/promises";
import { catalogModule } from "./scripts/pack-catalog.mjs";
import { supabaseConfig } from "./src/supabase.js";
import { localOrigin } from "./scripts/local-supabase.mjs";
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Vercel's native Supabase integration uses unprefixed names. Expose only
  // this explicit public allowlist; never set envPrefix to SUPABASE_.
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
  const key =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    "";
  const localMode =
    command === "serve" && ["demo", "guest", "backend"].includes(mode);
  if (localMode && mode === "backend") localOrigin(url);
  const publicConfig =
    localMode && mode !== "backend"
      ? null
      : supabaseConfig({
          VITE_SUPABASE_URL: url,
          VITE_SUPABASE_PUBLISHABLE_KEY: key,
        });
  return {
    define: {
      "import.meta.env.VITE_DEV_DATA_MODE": JSON.stringify(
        localMode ? mode : "",
      ),
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        publicConfig?.url || "",
      ),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        publicConfig?.key || "",
      ),
      // Normalize legacy configuration above, then expose only one key.
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(""),
    },
    base: "./",
    resolve: {
      alias: { $lib: fileURLToPath(new URL("./src/lib", import.meta.url)) },
    },
    plugins: [
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
  };
});
