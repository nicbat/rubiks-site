import { test, expect } from "@playwright/test";
import { build } from "vite";
import { puzzles } from "cubing/puzzles";

const prefix = "/__cube-engine-worker/";
let assets, probe, puzzle, shallowStates;
const stateKey = (pattern) => JSON.stringify(pattern.patternData.CORNERS);

test.beforeAll(async () => {
  const built = await build({
    configFile: false,
    base: prefix,
    logLevel: "silent",
    worker: { format: "es" },
    plugins: [
      {
        name: "worker-browser-probe",
        resolveId(id) {
          if (id === "worker-browser-probe") return "\0worker-browser-probe";
        },
        load(id) {
          if (id === "\0worker-browser-probe")
            return `import "@last-layer/cube-engine/renderer.css";
          export {createScrambleProvider} from "@last-layer/cube-engine/worker";
          export {validateScrambleResult} from "@last-layer/cube-engine/scramble";
          export {solvedCube,applyAlg} from "@last-layer/cube-engine/core";
          export {createCubePlayback} from "@last-layer/cube-engine/playback";
          export {mountCubeRenderer} from "@last-layer/cube-engine/renderer";`;
        },
      },
    ],
    build: {
      write: false,
      rollupOptions: {
        input: "worker-browser-probe",
        preserveEntrySignatures: "strict",
      },
    },
  });
  probe =
    prefix +
    built.output.find((item) => item.type === "chunk" && item.isEntry).fileName;
  assets = new Map(
    built.output.map((item) => [
      item.fileName,
      item.type === "chunk" ? item.code : item.source,
    ]),
  );
  assets.set(
    "index.html",
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">${built.output
      .filter((item) => item.fileName.endsWith(".css"))
      .map((item) => `<link rel="stylesheet" href="${prefix}${item.fileName}">`)
      .join(
        "",
      )}<style>body{margin:16px}</style></head><body><main id="host" aria-label="Generated cube"></main></body></html>`,
  );
  // Independent cubing.js enumeration verifies exclusion without consulting the
  // generator's own distances. Assertions never depend on a random sequence.
  puzzle = await puzzles["2x2x2"].kpuzzle();
  let frontier = [puzzle.defaultPattern()];
  shallowStates = new Set(frontier.map(stateKey));
  for (let depth = 0; depth < 3; depth++) {
    const next = [];
    for (const pattern of frontier)
      for (const move of ["R", "R2", "R'", "U", "U2", "U'", "F", "F2", "F'"]) {
        const candidate = pattern.applyAlg(move),
          key = stateKey(candidate);
        if (shallowStates.has(key)) continue;
        shallowStates.add(key);
        next.push(candidate);
      }
    frontier = next;
  }
  expect(shallowStates.size).toBe(385);
});

test("real module worker generates, renders, cancels, retries and destroys", async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const assetRequests = [];
  await page.route(`${baseURL}${prefix}**`, (route) => {
    const name =
      new URL(route.request().url()).pathname.slice(prefix.length) ||
      "index.html";
    assetRequests.push(name);
    return route.fulfill({
      status: assets.has(name) ? 200 : 404,
      body: assets.get(name) || "Missing worker fixture asset",
      contentType: name.endsWith(".js")
        ? "text/javascript"
        : name.endsWith(".css")
          ? "text/css"
          : "text/html",
    });
  });
  await page.goto(prefix);
  const result = await page.evaluate(async (url) => {
    const {
      createScrambleProvider,
      validateScrambleResult,
      solvedCube,
      applyAlg,
      createCubePlayback,
      mountCubeRenderer,
    } = await import(url);
    // No createWorker or entropy injection: this exercises the emitted module
    // worker and secure browser randomness on the isolated same-origin server.
    const provider = createScrambleProvider();
    const controller = new AbortController();
    const cancelled = provider
      .generateScramble({ eventId: "222", signal: controller.signal })
      .catch((error) => ({ code: error.code, name: error.name }));
    controller.abort();
    const cancellation = await cancelled;
    const generated = validateScrambleResult(
      await provider.generateScramble({ eventId: "222" }),
      "222",
    );
    const host = document.getElementById("host");
    const renderer = mountCubeRenderer(host, {
      palette: {
        U: "#ffffff",
        R: "#ff0000",
        F: "#00ff00",
        D: "#ffff00",
        L: "#ff8800",
        B: "#0000ff",
      },
    });
    renderer.update(
      createCubePlayback(applyAlg(solvedCube(2), generated.algorithm), ""),
    );
    const stickers = [...host.querySelectorAll("[data-color]")].map((node) => ({
      color: node.dataset.color,
      position: node.dataset.position,
      normal: node.dataset.normal,
    }));
    const pending = provider
      .generateScramble({ eventId: "222" })
      .catch((error) => ({ code: error.code }));
    provider.destroy();
    provider.destroy();
    const destroyed = await pending;
    const afterDestroy = await provider
      .generateScramble({ eventId: "222" })
      .catch((error) => ({ code: error.code }));
    // A distinct consumer starts cleanly after the previous provider is gone.
    const retry = createScrambleProvider();
    const regenerated = validateScrambleResult(
      await retry.generateScramble({ eventId: "222" }),
      "222",
    );
    retry.destroy();
    return {
      generated,
      regenerated,
      stickers,
      cancellation,
      destroyed,
      afterDestroy,
    };
  }, probe);
  expect(result.cancellation).toEqual({ code: "ABORTED", name: "AbortError" });
  expect(result.destroyed).toEqual({ code: "ABORTED" });
  expect(result.afterDestroy).toEqual({ code: "GENERATION_FAILED" });
  await expect(page.locator("[data-cube-engine] [data-color]")).toHaveCount(24);
  for (const generated of [result.generated, result.regenerated]) {
    expect(generated.generator).toEqual({
      id: "last-layer-222-fixed-dbl",
      version: "1",
      method: "random-state",
    });
    expect(generated.grip).toEqual({ up: "white", front: "green" });
    const pattern = puzzle.defaultPattern().applyAlg(generated.algorithm);
    expect(shallowStates.has(stateKey(pattern))).toBe(false);
    expect(pattern.patternData.CORNERS.pieces[6]).toBe(6);
    expect(pattern.patternData.CORNERS.orientation[6]).toBe(0);
  }
  // Read each rendered corner against the independent oracle's corner ordering.
  const corners = ["URF", "UBR", "ULB", "UFL", "DFR", "DLF", "DBL", "DRB"];
  const normals = {
    U: [0, 1, 0],
    R: [1, 0, 0],
    F: [0, 0, 1],
    D: [0, -1, 0],
    L: [-1, 0, 0],
    B: [0, 0, -1],
  };
  const pattern = puzzle.defaultPattern().applyAlg(result.generated.algorithm)
    .patternData.CORNERS;
  for (const [index, faces] of corners.entries()) {
    const position = [...faces]
      .reduce(
        (p, face) => p.map((v, axis) => v + normals[face][axis] / 2),
        [0, 0, 0],
      )
      .join(",");
    for (const [offset, face] of [...faces].entries()) {
      const expected =
        corners[pattern.pieces[index]][
          (offset - pattern.orientation[index] + 3) % 3
        ];
      const sticker = result.stickers.find(
        (s) => s.position === position && s.normal === normals[face].join(","),
      );
      expect(sticker?.color).toBe(expected);
    }
  }
  expect(assetRequests.some((name) => /entry-.*\.js$/.test(name))).toBe(true);
  expect(assetRequests.some((name) => /two-by-two-.*\.js$/.test(name))).toBe(
    true,
  );
});
