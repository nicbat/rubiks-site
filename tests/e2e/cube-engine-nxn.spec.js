import { test, expect } from "@playwright/test";
import { build } from "vite";

const prefix = "/__cube-engine-nxn/";
let assets, probe;
test.beforeAll(async () => {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    plugins: [
      {
        name: "nxn-probe",
        resolveId(id) {
          if (id === "nxn-probe") return "\0nxn-probe";
        },
        load(id) {
          if (id === "\0nxn-probe")
            return `import "@last-layer/cube-engine/renderer.css"; export {solvedCube,applyAlg} from "@last-layer/cube-engine/core"; export {createCubePlayback} from "@last-layer/cube-engine/playback"; export {mountCubeRenderer} from "@last-layer/cube-engine/renderer";`;
        },
      },
    ],
    build: {
      write: false,
      rollupOptions: { input: "nxn-probe", preserveEntrySignatures: "strict" },
    },
  });
  probe =
    prefix +
    result.output.find((item) => item.type === "chunk" && item.isEntry)
      .fileName;
  assets = new Map(
    result.output.map((item) => [
      item.fileName,
      item.type === "chunk" ? item.code : item.source,
    ]),
  );
  assets.set(
    "index.html",
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">${result.output
      .filter((item) => item.fileName.endsWith(".css"))
      .map((item) => `<link rel="stylesheet" href="${prefix}${item.fileName}">`)
      .join(
        "",
      )}<style>body{margin:16px}#host{width:100%}</style></head><body><main id="host" aria-label="Cube example"></main></body></html>`,
  );
});

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`NxN geometry remains retained and bounded at ${viewport.width}×${viewport.height}`, async ({
    page,
    baseURL,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.route(`${baseURL}${prefix}**`, (route) => {
      const name =
        new URL(route.request().url()).pathname.slice(prefix.length) ||
        "index.html";
      return route.fulfill({
        body: assets.get(name) || "Missing fixture asset",
        status: assets.has(name) ? 200 : 404,
        contentType: name.endsWith(".js")
          ? "text/javascript"
          : name.endsWith(".css")
            ? "text/css"
            : "text/html",
      });
    });
    await page.goto(prefix);
    const result = await page.evaluate(async (url) => {
      const { solvedCube, applyAlg, createCubePlayback, mountCubeRenderer } =
        await import(url);
      const host = document.getElementById("host");
      const palette = {
        U: "#ffffff",
        R: "#ff0000",
        F: "#00ff00",
        D: "#ffff00",
        L: "#ff8800",
        B: "#0000ff",
      };
      const renderer = mountCubeRenderer(host, { palette });
      let previous;
      const results = [];
      for (const size of [3, 2, 4, 7, 3]) {
        const player = createCubePlayback(solvedCube(size), "Rw U");
        let reads = 0;
        const snapshot = player.snapshot;
        player.snapshot = (options) => {
          if (options?.includeCube !== false) reads++;
          return snapshot(options);
        };
        renderer.update(player);
        const piece = host.querySelector(".cube-piece");
        const rebuilt = previous ? piece !== previous : true;
        const stickers = [...host.querySelectorAll("[data-color]")];
        const counts = {
          pieces: host.querySelectorAll(".cube-piece").length,
          stickers: stickers.length,
        };
        const top = stickers.find((node) => node.dataset.color === "U");
        const topColor = getComputedStyle(
          top.firstElementChild,
        ).backgroundColor;
        player.toggle();
        player.tick(100);
        renderer.update(player);
        player.tick(100);
        renderer.update(player);
        const frameReads = reads;
        const retained = host.querySelector(".cube-piece") === piece;
        // A same-size replacement must update sticker state without replacing nodes.
        const replacement = createCubePlayback(
          applyAlg(solvedCube(size), "R"),
          "",
        );
        renderer.update(replacement);
        const retainedReplacement = host.querySelector(".cube-piece") === piece;
        const extent = (size - 1) / 2;
        const movedTop = host.querySelector(
          `[data-position="${extent},${extent},${extent}"][data-normal="0,1,0"]`,
        ).dataset.color;
        const bounds = [...host.querySelectorAll("[data-color]")].map((node) =>
          node.getBoundingClientRect(),
        );
        const within = bounds.every(
          (b) =>
            b.left >= 0 &&
            b.right <= innerWidth &&
            b.top >= 0 &&
            b.bottom <= innerHeight,
        );
        results.push({
          size,
          ...counts,
          rebuilt,
          frameReads,
          retained,
          retainedReplacement,
          movedTop,
          topColor,
          within,
        });
        previous = piece;
      }
      renderer.destroy();
      return { results, remaining: host.children.length };
    }, probe);
    for (const entry of result.results) {
      expect(entry).toEqual({
        size: entry.size,
        pieces: entry.size ** 3 - (entry.size - 2) ** 3,
        stickers: 6 * entry.size ** 2,
        rebuilt: true,
        frameReads: 1,
        retained: true,
        retainedReplacement: true,
        movedTop: "F",
        topColor: "rgb(255, 255, 255)",
        within: true,
      });
    }
    expect(result.remaining).toBe(0);
    if (
      process.env.LAST_LAYER_CAPTURE_REVIEW &&
      testInfo.project.name === "chromium"
    ) {
      for (const [size, theme] of [
        [2, "light"],
        [7, "dark"],
      ]) {
        await page.evaluate(
          async ({ url, size, theme }) => {
            const {
              solvedCube,
              applyAlg,
              createCubePlayback,
              mountCubeRenderer,
            } = await import(url);
            document.body.style.background =
              theme === "dark" ? "#15191e" : "#ffffff";
            const renderer = mountCubeRenderer(document.getElementById("host"));
            renderer.update(
              createCubePlayback(applyAlg(solvedCube(size), "R U F2"), ""),
            );
            globalThis.reviewRenderer = renderer;
          },
          { url: probe, size, theme },
        );
        await page.screenshot({
          path: testInfo.outputPath(
            `cube-${size}-${theme}-${viewport.width}x${viewport.height}.png`,
          ),
        });
        await page.evaluate(() => globalThis.reviewRenderer.destroy());
      }
    }
  });
}
