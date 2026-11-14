import test from "node:test";
import assert from "node:assert/strict";
import { build } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

test("public cube engine entrypoints import without a browser", async () => {
  assert.equal(typeof globalThis.document, "undefined");
  const [
    { solvedCube, applyAlg, colorAt },
    { createCubePlayback },
    { mountCubeRenderer },
  ] = await Promise.all([
    import("@last-layer/cube-engine/core"),
    import("@last-layer/cube-engine/playback"),
    import("@last-layer/cube-engine/renderer"),
  ]);
  const cube = solvedCube();
  assert.equal(cube.length, 54);
  const turned = applyAlg(cube, "R");
  // Independent sticker destination: R sends the upper-right front sticker to U.
  assert.equal(colorAt(turned, [1, 1, -1], [0, 1, 0]), "F");
  assert.equal(colorAt(cube, [1, 1, -1], [0, 1, 0]), "U");
  const playback = createCubePlayback(cube, "R");
  playback.seek(1);
  assert.deepEqual(playback.snapshot().cube, turned);
  assert.equal(typeof mountCubeRenderer, "function");
});

test("framework-free public consumer builds without application or solver modules", async () => {
  const modules = new Set();
  const result = await build({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: [
      {
        name: "inspect-consumer-boundary",
        moduleParsed(info) {
          modules.add(info.id.replaceAll("\\", "/"));
        },
      },
    ],
    build: {
      write: false,
      rollupOptions: { input: `${root}examples/cube-engine/index.html` },
    },
  });
  assert.ok(
    [...modules].some((id) => id.includes("/packages/cube-engine/")),
    "Build must consume the actual package",
  );
  const prohibited = [...modules].filter(
    (id) =>
      id.startsWith(`${root}src/`) ||
      /\/packages\/cube-engine\/(?:scramble|worker)\//.test(id) ||
      /(?:\.svelte(?:\?|$)|\/node_modules\/(?:svelte|cubing)\/|\/solvers?\/)/.test(
        id,
      ),
  );
  assert.deepEqual(
    prohibited,
    [],
    "Consumer must not bundle the application, Svelte, cubing.js, or solvers",
  );
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(
    (bundle) => bundle.output,
  );
  assert.ok(
    outputs.some(
      (item) => item.type === "asset" && item.fileName.endsWith(".css"),
    ),
    "Renderer styles must ship through the public CSS export",
  );
  assert.ok(
    outputs.some(
      (item) => item.type === "asset" && item.fileName.endsWith(".html"),
    ),
    "Consumer must build independently as HTML",
  );
});
