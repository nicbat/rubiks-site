import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { compile, compileModule } from "svelte/compiler";
const lib = new URL("../src/lib/", import.meta.url);
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("$lib/"))
      specifier = new URL(specifier.slice(5), lib).href;
    if (specifier.endsWith("utils.js") && specifier.startsWith(lib.href))
      specifier = specifier.replace(/\.js$/, ".ts");
    if (specifier.endsWith(".json"))
      context = { ...context, importAttributes: { type: "json" } };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".svelte") || url.endsWith(".svelte.js")) {
      const source = readFileSync(new URL(url), "utf8");
      const compiled = url.endsWith(".svelte")
        ? compile(source, {
            filename: new URL(url).pathname,
            generate: "server",
          })
        : compileModule(source, {
            filename: new URL(url).pathname,
            generate: "server",
          });
      return { format: "module", source: compiled.js.code, shortCircuit: true };
    }
    if (url.endsWith(".json"))
      context = { ...context, importAttributes: { type: "json" } };
    return next(url, context);
  },
});
