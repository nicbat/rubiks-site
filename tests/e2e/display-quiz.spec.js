import { captureScreenshot } from "./screenshots.js";
import { openSettings, closeSettings } from "./fixtures.js";
import { test, expect, seed, openLibrary, saved } from "./fixtures.js";

async function expectStickerColor(sticker, color) {
  // The colored sticker is inset on an opaque plastic face.
  await expect(sticker).toHaveCSS("background-color", "rgb(32, 40, 50)");
  await expect(sticker.locator(".cube-sticker")).toHaveCSS(
    "background-color",
    color,
  );
}

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`display colors and two-sided quiz at ${viewport.width}×${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await seed(page);
    await openSettings(page);
    await page.getByLabel("Default display top color").selectOption("D");
    await page.reload();
    await openLibrary(page);
    await page
      .getByRole("button", { name: "View T perm", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText("White on top; the diagram’s front is at the bottom."),
    ).toBeVisible();
    const top = dialog.locator('[data-position="0,1,0"][data-normal="0,1,0"]');
    await expectStickerColor(top, "rgb(255, 255, 255)");
    await dialog.getByRole("button", { name: "Change color" }).click();
    await expectStickerColor(top, "rgb(71, 187, 160)");
    await expect(
      dialog.getByRole("button", { name: "Change color" }),
    ).toBeFocused();
    await dialog.getByRole("button", { name: "Show setup moves" }).click();
    await expectStickerColor(top, "rgb(71, 187, 160)");
    await dialog.getByRole("button", { name: "Close case" }).click();
    await openSettings(page);
    await page.getByLabel("Randomize display color", { exact: true }).check();
    await openLibrary(page);
    await page
      .getByRole("button", { name: "View T perm", exact: true })
      .click();
    const color = await top.locator(".cube-sticker").getAttribute("style");
    await dialog.getByRole("button", { name: "Show setup moves" }).click();
    expect(await top.locator(".cube-sticker").getAttribute("style")).toBe(
      color,
    );
    await dialog.getByRole("button", { name: "Known", exact: true }).click();
    expect(await top.locator(".cube-sticker").getAttribute("style")).toBe(
      color,
    );
    await dialog.getByRole("button", { name: "Close case" }).click();
    const before = await saved(page);
    await closeSettings(page);
    await page.getByRole("button", { name: "Courses", exact: true }).click();
    await expect(
      page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("button"),
    ).toHaveText([
      "Dashboard",
      "My learning",
      "Courses",
      "Progress",
      "Timer",
      "About",
    ]);
    await expect(
      page.getByText("Work in progress", { exact: true }),
    ).toHaveCount(2);
    await expect(
      page.getByRole("button", { name: /Open (Blindfolded|2×2)/ }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Open CFOP", exact: true }).click();
    await page
      .getByRole("navigation", { name: "CFOP sections" })
      .getByRole("button", { name: "PLL", exact: true })
      .click();
    await page.getByRole("button", { name: "Start PLL quiz" }).click();
    await expect(
      page.getByRole("heading", { name: "Two-sided PLL recognition" }),
    ).toBeVisible();
    await expect(page.locator(".quiz-stickers span")).toHaveCount(6);
    await expect(page.locator(".quiz-choices button")).toHaveCount(4);
    await expect(page.locator(".quiz-choices button svg")).toHaveCount(4);
    for (const diagram of await page.locator(".quiz-choices svg").all()) {
      await expect(diagram.locator(".pll-arrows")).toHaveCount(1);
      const sides = diagram.locator('rect[width="12"], rect[height="12"]');
      await expect(sides).toHaveCount(12);
      expect(
        await sides.evaluateAll((els) =>
          els.every((el) =>
            el.getAttribute("fill").startsWith("var(--diagram-muted"),
          ),
        ),
      ).toBe(true);
      const box = await diagram.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(80);
      expect(box.height).toBeGreaterThanOrEqual(80);
    }
    await expect(page.locator(".quiz-result")).toHaveCount(0);
    await expect(
      page.locator(".answer-layout, .algorithm, .cube-player"),
    ).toHaveCount(0);
    for (const colorScheme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme });
      const bounds = await page
        .locator(".two-side-view, .quiz-choices, .quiz-choices button")
        .evaluateAll((els) =>
          els.every((el) => {
            const r = el.getBoundingClientRect();
            return (
              r.left >= 0 &&
              r.right <= innerWidth + 1 &&
              el.scrollWidth <= el.clientWidth + 1
            );
          }),
        );
      expect(bounds).toBe(true);
      await captureScreenshot(page, {
        path: testInfo.outputPath(`pll-quiz-${colorScheme}.png`),
        fullPage: true,
      });
    }
    await page
      .getByRole("group", { name: "PLL case diagrams" })
      .getByRole("button")
      .first()
      .click();
    await expect(page.locator(".quiz-result")).toBeVisible();
    await expect(page.getByRole("button", { name: "Next case" })).toBeFocused();
    await expect(page.locator(".quiz-choices button:enabled")).toHaveCount(0);
    await page.getByRole("button", { name: "Next case" }).click();
    await expect(page.locator(".quiz-result")).toHaveCount(0);
    expect((await saved(page)).attempts).toEqual(before.attempts);
    await closeSettings(page);
    await page.getByRole("button", { name: "Timer", exact: true }).click();
    await page
      .getByRole("button", { name: "Preview scrambled cube", exact: true })
      .click();
    await expectStickerColor(
      page.locator('[data-position="0,1,0"][data-normal="0,1,0"]'),
      "rgb(255, 216, 74)",
    );
  });
}
