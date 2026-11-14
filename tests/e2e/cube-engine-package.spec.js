import { test, expect } from "@playwright/test";
import { build } from "vite";
import { fileURLToPath } from "node:url";

const prefix = "/__cube-engine-example/";
let assets, probePath;
test.beforeAll(async () => {
  const result = await build({
    root: fileURLToPath(
      new URL("../../examples/cube-engine/", import.meta.url),
    ),
    configFile: false,
    base: prefix,
    logLevel: "silent",
    plugins: [
      {
        name: "renderer-probe",
        resolveId(id) {
          if (id === "renderer-probe") return "\0renderer-probe";
        },
        load(id) {
          if (id === "\0renderer-probe")
            return `export { solvedCube, applyAlg } from "@last-layer/cube-engine/core"; export { createCubePlayback } from "@last-layer/cube-engine/playback"; export { mountCubeRenderer } from "@last-layer/cube-engine/renderer";`;
        },
      },
    ],
    build: {
      write: false,
      rollupOptions: {
        preserveEntrySignatures: "strict",
        input: {
          example: fileURLToPath(
            new URL("../../examples/cube-engine/index.html", import.meta.url),
          ),
          probe: "renderer-probe",
        },
      },
    },
  });
  probePath =
    prefix +
    result.output.find((item) => item.type === "chunk" && item.name === "probe")
      .fileName;
  assets = new Map(
    result.output.map((item) => [
      item.fileName,
      item.type === "chunk" ? item.code : item.source,
    ]),
  );
});

test.beforeEach(async ({ page, baseURL }) => {
  await page.route(`${baseURL}${prefix}**`, async (route) => {
    const name =
      new URL(route.request().url()).pathname.slice(prefix.length) ||
      "index.html";
    const body = assets.get(name);
    if (body === undefined)
      return route.fulfill({ status: 404, body: "Missing fixture asset" });
    await route.fulfill({
      body,
      contentType: name.endsWith(".js")
        ? "text/javascript"
        : name.endsWith(".css")
          ? "text/css"
          : "text/html",
    });
  });
  await page.goto(prefix);
});

test("standalone controls and renderer dispose and remount cleanly", async ({
  page,
}) => {
  const stage = page.locator("[data-cube-engine]");
  await expect(stage).toHaveCount(1);
  await expect(stage.locator("[data-color]")).toHaveCount(54);
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Move 1 of 4");
  await page.getByRole("button", { name: "Previous move" }).click();
  await expect(page.getByRole("status")).toHaveText("Move 0 of 4");
  const camera = stage.locator(".cube-camera");
  await page.getByRole("button", { name: "Rotate right" }).click();
  await expect(camera).toHaveCSS("transform", /matrix3d/);
  await expect(camera).toHaveAttribute("style", /rotateY\(-20deg\)/);
  await page.getByRole("group", { name: /^Cube view/ }).press("ArrowLeft");
  await expect(camera).toHaveAttribute("style", /rotateY\(-35deg\)/);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dispose player" }).click();
  await expect(stage).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Remount player" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remount player" }).click();
  await expect(stage).toHaveCount(1);
  await expect(stage.locator("[data-color]")).toHaveCount(54);
  await expect(page.getByRole("status")).toHaveText("Move 0 of 4");
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Move 1 of 4");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Move 0 of 4");
});

test("renderer isolates lifecycle, controller identity, and frame snapshots", async ({
  page,
}) => {
  const result = await page.evaluate(async (url) => {
    const { solvedCube, applyAlg, createCubePlayback, mountCubeRenderer } =
      await import(url);
    const host = document.createElement("div");
    const sibling = document.createElement("span");
    sibling.textContent = "Consumer content";
    host.append(sibling);
    document.body.append(host);
    const renderer = mountCubeRenderer(host);
    const first = createCubePlayback(solvedCube(), "R");
    let fullReads = 0;
    const snapshot = first.snapshot;
    first.snapshot = (options) => {
      if (options?.includeCube !== false) fullReads++;
      return snapshot(options);
    };
    renderer.update(first);
    const initialReads = fullReads;
    const colors = () =>
      [...host.querySelectorAll("[data-color]")]
        .map((node) => node.dataset.color)
        .join("");
    const before = colors();
    first.toggle();
    first.tick(100);
    renderer.update(first);
    first.tick(100);
    renderer.update(first);
    const frameReads = fullReads - initialReads;
    const second = createCubePlayback(applyAlg(solvedCube(), "U"), "R");
    renderer.update(second);
    const changed = before !== colors();
    renderer.destroy();
    renderer.destroy();
    renderer.update(second);
    const keptSibling =
      host.childNodes.length === 1 && host.firstChild === sibling;
    host.remove();
    return { initialReads, frameReads, changed, keptSibling };
  }, probePath);
  expect(result).toEqual({
    initialReads: 1,
    frameReads: 0,
    changed: true,
    keptSibling: true,
  });
});
