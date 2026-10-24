import { captureScreenshot } from "./screenshots.js";
import { test, expect, seed, saved } from "./fixtures.js";

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`learning diagram opens the focused case and restores focus at ${viewport.width}×${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await seed(page, {
      version: 2,
      selected: ["oll-5", "pll-T", "pll-Y"],
      variants: {},
      attempts: [],
    });
    const diagram = page.getByRole("button", {
      name: "View OLL 5 case",
      exact: true,
    });
    const study = page.locator(".study-card");
    await expect(diagram).toBeVisible();
    await expect(
      study.getByRole("heading", { name: "OLL 5", exact: true }),
    ).toBeVisible();
    for (const element of [
      study,
      diagram,
      study.locator(".study-body"),
      study.locator(".study-actions"),
    ]) {
      const bounds = await element.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(
        await element.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
    }
    const target = await diagram.boundingBox();
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.height).toBeGreaterThanOrEqual(44);
    if (viewport.width === 1440) {
      const card = await study.boundingBox();
      expect(card.height).toBeLessThan(300);
      const heading = await study.locator(".study-heading").boundingBox();
      const actions = await study.locator(".study-actions").boundingBox();
      expect(
        Math.abs(
          (heading.y + actions.y + actions.height) / 2 -
            (card.y + card.height / 2),
        ),
      ).toBeLessThan(16);
      const strip = await page.locator(".case-strip").boundingBox();
      const first = await page.locator(".mini-case").first().boundingBox();
      const last = await page.locator(".mini-case").last().boundingBox();
      expect(
        Math.abs(
          (first.x + last.x + last.width) / 2 - (strip.x + strip.width / 2),
        ),
      ).toBeLessThan(2);
    }
    await diagram.scrollIntoViewIfNeeded();
    for (const colorScheme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme });
      await captureScreenshot(page, {
        path: testInfo.outputPath(`learning-layout-${colorScheme}.png`),
        fullPage: true,
        scale: "css",
      });
    }
    await diagram.locator("svg").click();
    const dialog = page.getByRole("dialog", { name: "OLL 5", exact: true });
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole("button", { name: "Close case", exact: true })
      .click();
    await expect(diagram).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(diagram).toBeFocused();
    await page.getByRole("button", { name: /T perm.*Learning/ }).click();
    const nextDiagram = page.getByRole("button", {
      name: "View T perm case",
      exact: true,
    });
    await nextDiagram.focus();
    await page.keyboard.press("Space");
    await expect(
      page.getByRole("dialog", { name: "T perm", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(nextDiagram).toBeFocused();
    expect((await saved(page)).attempts).toEqual([]);
  });
}
