import { cube3x3x3 } from "cubing/puzzles";
import { assertOracleFacelets } from "../helpers/cube-oracle.js";
import { test, expect, seed, saved, holdStartTimer } from "./fixtures.js";

test("scramble preview shows the exact current state without affecting the timer or progress", async ({
  page,
}, testInfo) => {
  // Stable scrambles in each isolated browser context; subsequent scrambles differ.
  await page.clock.install();
  await page.addInitScript(() => {
    let seed = 81273;
    Math.random = () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  });
  await seed(page);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  const before = await saved(page);
  const opener = page.getByRole("button", { name: "Preview scrambled cube" });
  const puzzle = await cube3x3x3.kpuzzle();
  let previous;
  for (let i = 0; i < 2; i++) {
    const scramble = await page.locator("#timer-scramble").textContent();
    if (previous) expect(scramble).not.toBe(previous);
    previous = scramble;
    await opener.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Scrambled cube" });
    await expect(dialog).toBeVisible();
    const stickers = await dialog.locator("[data-color]").evaluateAll((els) =>
      els.map((el) => ({
        p: el.dataset.position.split(",").map(Number),
        n: el.dataset.normal.split(",").map(Number),
        color: el.dataset.color,
      })),
    );
    expect(stickers).toHaveLength(54);
    assertOracleFacelets(
      stickers,
      puzzle.defaultPattern().applyAlg(scramble),
      scramble,
    );
    await expect(
      dialog.getByRole("button", { name: "Play", exact: true }),
    ).toHaveCount(0);
    const stage = dialog.getByRole("img");
    await stage.focus();
    const angle = await dialog.locator(".cube-camera").getAttribute("style");
    await page.keyboard.press("ArrowRight");
    await expect(dialog.locator(".cube-camera")).not.toHaveAttribute(
      "style",
      angle,
    );
    await page.keyboard.press("Space");
    await expect(page.locator("#timer-status")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Reset view" }).click();
    await expect(dialog.locator(".cube-camera")).toHaveAttribute(
      "style",
      angle,
    );
    if (!i)
      await dialog.screenshot({
        path: testInfo.outputPath("scramble-preview.png"),
      });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (!i) await page.keyboard.press("Escape");
    else
      await dialog
        .getByRole("button", { name: "Close scramble preview" })
        .click();
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
    await expect(page.locator("#timer-scramble")).toHaveText(scramble);
    if (!i)
      await page
        .getByRole("button", { name: "New scramble (Tab)", exact: true })
        .click();
  }
  expect(await saved(page)).toEqual(before);
  const currentScramble = await page.locator("#timer-scramble").textContent();
  await holdStartTimer(page);
  await expect(page.locator("#timer-scramble")).toHaveCount(0);
  await expect(opener).toHaveCount(0);
  await expect(page.locator("#timer-status")).toHaveText("Running");
  await page.getByRole("button", { name: "Stop timer", exact: true }).click();
  await expect(opener).toBeEnabled();
  await expect(page.locator("#timer-scramble")).toHaveText(currentScramble);
});
