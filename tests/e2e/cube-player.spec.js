import { cube3x3x3 } from "cubing/puzzles";
import { assertOracleFacelets } from "../helpers/cube-oracle.js";
import { test, expect, seed, saved, openLibrary } from "./fixtures.js";

test("notation repeats cumulatively with only play/pause and respects reduced motion", async ({
  page,
}, testInfo) => {
  await seed(page);
  const before = await saved(page);
  await expect(
    page.getByRole("region", { name: "3D cube player" }),
  ).toHaveCount(0);
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.getByRole("button", { name: "Guides", exact: true }).click();
  await page.getByRole("button", { name: "Notation", exact: true }).click();
  await page
    .locator('[data-action="guide-example"][data-id="notation"]')
    .click();
  const player = page.getByRole("region", { name: "3D cube player" });
  await expect(
    player.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.clock.runFor(350);
  await player.getByRole("button", { name: "Pause", exact: true }).click();
  await player
    .getByRole("img")
    .screenshot({ path: testInfo.outputPath("cube-mid-turn.png") });
  const layer = player.locator(".cube-layer");
  const paused = await layer.getAttribute("style");
  await page.clock.runFor(1200);
  await expect(layer).toHaveAttribute("style", paused);
  await expect(player.getByRole("button")).toHaveCount(1);
  await expect(player.getByLabel("Playback moves")).toHaveCount(0);
  await player.getByRole("button", { name: "Play", exact: true }).click();
  await page.clock.runFor(1950);
  await player.getByRole("button", { name: "Pause", exact: true }).click();
  const stickers = await player.locator("[data-color]").evaluateAll((els) =>
    els.map((el) => ({
      p: el.dataset.position.split(",").map(Number),
      n: el.dataset.normal.split(",").map(Number),
      color: el.dataset.color,
    })),
  );
  const puzzle = await cube3x3x3.kpuzzle();
  assertOracleFacelets(
    stickers,
    puzzle.defaultPattern().applyAlg("R2"),
    "two continuous R turns",
  );
  await player.getByRole("button", { name: "Play", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  // Deliver the media-query change on the controlled rendering clock.
  await page.clock.runFor(32);
  await expect(
    player.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await player.getByRole("img").focus();
  const angle = await player.locator(".cube-camera").getAttribute("style");
  await page.keyboard.press("ArrowRight");
  await expect(player.locator(".cube-camera")).not.toHaveAttribute(
    "style",
    angle,
  );
  expect(await saved(page)).toEqual(before);
  await page.screenshot({
    path: testInfo.outputPath("cube-notation.png"),
    fullPage: true,
  });
});

test("case panel plays, seeks and resets on variant changes", async ({
  page,
}, testInfo) => {
  await seed(page);
  await openLibrary(page);
  await page.getByRole("button", { name: "View T perm", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const player = dialog.getByRole("region", { name: "3D cube player" });
  await expect(
    player.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await player.getByRole("button", { name: "Next move", exact: true }).click();
  await expect(
    player.getByRole("button", { name: /Go to move 2:/ }),
  ).toHaveAttribute("aria-current", "step");
  await expect(
    player.getByRole("button", { name: "Next move", exact: true }),
  ).toBeFocused();
  await player.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(
    player.getByRole("button", { name: /Go to move 1:/ }),
  ).toHaveAttribute("aria-current", "step");
  await page.clock.install();
  await player.getByRole("button", { name: "Play", exact: true }).click();
  await page.clock.runFor(25000);
  await expect(player).toContainText("Complete");
  const stickers = await player
    .locator("[data-color]")
    .evaluateAll((els) =>
      els.map((el) => ({ n: el.dataset.normal, c: el.dataset.color })),
    );
  for (const normal of new Set(stickers.map((s) => s.n)))
    expect(
      new Set(stickers.filter((s) => s.n === normal).map((s) => s.c)).size,
    ).toBe(1);
  await dialog.screenshot({ path: testInfo.outputPath("cube-case-panel.png") });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await dialog.getByRole("button", { name: "Close case", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "3D cube player" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "View Ua perm", exact: true }).click();
  await player.getByRole("button", { name: "Next move", exact: true }).click();
  const oldAlgorithm = await player.getAttribute("data-algorithm");
  await page.getByRole("combobox", { name: "Your algorithm" }).click();
  await page.getByRole("option").nth(1).click();
  await expect(player).not.toHaveAttribute("data-algorithm", oldAlgorithm);
  await expect(
    player.getByRole("button", { name: /Go to move 1:/ }),
  ).toHaveAttribute("aria-current", "step");
  await expect(
    player.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
});

test("animation frames update only the moving layer and stop writing during the hold", async ({
  page,
}) => {
  await seed(page);
  await openLibrary(page);
  await page.getByRole("button", { name: "View T perm", exact: true }).click();
  const player = page.getByRole("region", { name: "3D cube player" });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await player.getByRole("button", { name: "Play", exact: true }).click();
  await page.clock.runFor(100);
  await player.evaluate((root) => {
    window.cubeMutations = [];
    window.cubeObserver = new MutationObserver((records) => {
      window.cubeMutations.push(
        ...records.map((record) => ({
          type: record.type,
          attribute: record.attributeName,
          layer: record.target.classList?.contains("cube-layer") ?? false,
        })),
      );
    });
    window.cubeObserver.observe(root, {
      subtree: true,
      attributes: true,
      childList: true,
      characterData: true,
    });
  });
  await page.clock.runFor(200);
  const mutations = await page.evaluate(() => window.cubeMutations.splice(0));
  expect(mutations.length).toBeGreaterThan(0);
  expect(
    mutations.every(
      (mutation) =>
        mutation.type === "attributes" &&
        mutation.attribute === "style" &&
        mutation.layer,
    ),
  ).toBe(true);
  await page.clock.runFor(400);
  await page.evaluate(() => window.cubeMutations.splice(0));
  await page.clock.runFor(30);
  expect(await page.evaluate(() => window.cubeMutations)).toEqual([]);
  await page.evaluate(() => window.cubeObserver.disconnect());
  await player.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(
    player.getByRole("button", { name: /Go to move 1:/ }),
  ).toHaveAttribute("aria-current", "step");
});

test("playback retains cube geometry across turns, seek and reset", async ({
  page,
}) => {
  await seed(page);
  await openLibrary(page);
  await page.getByRole("button", { name: "View T perm", exact: true }).click();
  const player = page.getByRole("region", { name: "3D cube player" });
  await player.evaluate((root) => {
    window.originalCubeFaces = [...root.querySelectorAll(".cube-face")];
  });
  for (let i = 0; i < 4; i++)
    await player
      .getByRole("button", { name: "Next move", exact: true })
      .click();
  await player.getByRole("button", { name: "Reset", exact: true }).click();
  expect(
    await player.evaluate((root) =>
      window.originalCubeFaces.every((face) => root.contains(face)),
    ),
  ).toBe(true);
  expect(await player.locator(".cube-face").count()).toBe(156);
  const puzzle = await cube3x3x3.kpuzzle();
  await page.getByRole("button", { name: "Close case", exact: true }).click();
  await page.getByRole("button", { name: "Guides", exact: true }).click();
  await page.getByRole("button", { name: "Notation", exact: true }).click();
  await page
    .locator('[data-action="guide-example"][data-id="notation"]')
    .click();
  await player.getByRole("button", { name: "Pause", exact: true }).click();
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  // Changing the move mounts a fresh solved timeline, then advance two M turns.
  await page.getByRole("button", { name: "M: Middle", exact: true }).click();
  await page.clock.runFor(2250);
  await player.getByRole("button", { name: "Pause", exact: true }).click();
  const stickers = await player.locator("[data-color]").evaluateAll((els) =>
    els.map((el) => ({
      p: el.dataset.position.split(",").map(Number),
      n: el.dataset.normal.split(",").map(Number),
      color: el.dataset.color,
    })),
  );
  assertOracleFacelets(
    stickers,
    puzzle.defaultPattern().applyAlg("M2"),
    "retained slice geometry",
  );
});

test("scrubber pauses playback, holds a mid-turn position, and steps whole moves by keyboard", async ({
  page,
}) => {
  await seed(page);
  const before = await saved(page);
  await openLibrary(page);
  await page.getByRole("button", { name: "View T perm", exact: true }).click();
  const player = page.getByRole("region", { name: "3D cube player" });
  const scrubber = player.getByRole("slider", { name: "Scrub through moves" });
  await expect(scrubber).toHaveAttribute("aria-valuetext", /^Move 1 of 14:/);
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await player.getByRole("button", { name: "Play", exact: true }).click();
  await page.clock.runFor(2000);
  expect(Number(await scrubber.inputValue())).toBeGreaterThan(0);
  const box = await scrubber.boundingBox();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.53, box.y + box.height / 2, {
    steps: 5,
  });
  await expect(
    player.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await page.mouse.up();
  const value = await scrubber.inputValue();
  expect(Number(value) % 1).not.toBe(0);
  const layer = player.locator(".cube-layer");
  const held = await layer.getAttribute("style");
  expect(held).toMatch(/rotate[XYZ]\(-?[1-9]/);
  await page.clock.runFor(3000);
  await expect(scrubber).toHaveValue(value);
  await expect(layer).toHaveAttribute("style", held);
  const index = Math.floor(Number(value));
  await expect(
    player.getByRole("button", {
      name: new RegExp(`Go to move ${index + 1}:`),
    }),
  ).toHaveAttribute("aria-current", "step");
  await scrubber.focus();
  await page.keyboard.press("ArrowRight");
  await expect(scrubber).toHaveValue(String(index + 1));
  await page.keyboard.press("ArrowLeft");
  await expect(scrubber).toHaveValue(String(index));
  await page.keyboard.press("End");
  await expect(scrubber).toHaveAttribute(
    "aria-valuetext",
    "Complete · 14 moves",
  );
  await expect(
    player.getByRole("button", { name: "Next move", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Home");
  await expect(scrubber).toHaveValue("0");
  await player.getByRole("button", { name: "Play", exact: true }).click();
  await page.clock.runFor(2000);
  expect(Number(await scrubber.inputValue())).toBeGreaterThan(0);
  expect(await saved(page)).toEqual(before);
});

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`cube icon controls are labeled and touch-sized at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme: "dark" });
    await seed(page);
    await openLibrary(page);
    await page
      .getByRole("button", { name: "View T perm", exact: true })
      .click();
    const player = page.getByRole("region", { name: "3D cube player" });
    for (const label of ["Play", "Previous move", "Next move", "Reset"]) {
      const button = player.getByRole("button", { name: label, exact: true });
      await expect(button).toHaveAttribute("title", label);
      await expect(button.locator("svg")).toBeVisible();
      await expect(button).toHaveText("");
      const bounds = await button.boundingBox();
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
    }
    const scrubber = player.getByRole("slider", {
      name: "Scrub through moves",
    });
    const scrubBounds = await scrubber.boundingBox();
    expect(scrubBounds.height).toBeGreaterThanOrEqual(44);
    expect(scrubBounds.x).toBeGreaterThanOrEqual(0);
    expect(scrubBounds.x + scrubBounds.width).toBeLessThanOrEqual(
      viewport.width,
    );
    const toggle = player.getByRole("button", { name: "Play", exact: true });
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(
      player.getByRole("button", { name: "Pause", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute("title", "Play");
    await player.screenshot({
      path: testInfo.outputPath("cube-icon-controls.png"),
    });
  });
}
