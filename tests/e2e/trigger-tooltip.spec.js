import { test, expect, seed, openLibrary } from "./fixtures.js";

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`chunk tooltips and click disclosures coexist at ${viewport.width}×${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await seed(page);
    await expect(page.getByRole("main")).not.toContainText(
      "Tap a highlighted chunk",
    );
    await openLibrary(page);
    await page
      .getByRole("button", { name: "View T perm", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).not.toContainText("Tap a highlighted chunk");
    const chunk = dialog.locator(".trigger").first();
    const summary = chunk.locator("summary");
    const tooltip = chunk.locator(".trigger-tooltip");
    await expect(tooltip).toBeHidden();
    await summary.scrollIntoViewIfNeeded();
    if (await page.evaluate(() => matchMedia("(hover: hover)").matches)) {
      await summary.hover();
      await expect(tooltip).toBeVisible();
      await tooltip.hover();
      await expect(tooltip).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(tooltip).toBeHidden();
      await expect(dialog).toBeVisible();
      await page.mouse.move(0, 0);
    }
    await summary.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(summary).toBeFocused();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText("Sexy move");
    const bounds = await tooltip.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    for (const colorScheme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme });
      await page.screenshot({
        path: testInfo.outputPath(`chunk-tooltip-${colorScheme}.png`),
      });
    }
    await summary.click();
    await expect(chunk).toHaveAttribute("open", "");
    await expect(tooltip).toBeHidden();
    await expect(chunk.locator(":scope > span")).toBeVisible();
    await expect(chunk.locator(":scope > span")).toHaveText("Sexy move");
    await summary.click();
    await expect(chunk).not.toHaveAttribute("open", "");
    await page.getByRole("button", { name: "Close case", exact: true }).click();
    await page
      .getByRole("button", { name: "View Ua perm", exact: true })
      .click();
    await expect(dialog.locator(".trigger")).toHaveCount(0);
    await expect(dialog).not.toContainText("Tap a highlighted chunk");
    await page.getByRole("button", { name: "Close case", exact: true }).click();
    await page
      .getByRole("button", { name: "View Nb perm", exact: true })
      .click();
    const insert = dialog
      .locator(".trigger")
      .filter({
        has: page.locator('summary[aria-description="Inverse sexy move"]'),
      })
      .first();
    await insert.locator("summary").focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    const insertTooltip = insert.locator(".trigger-tooltip");
    await expect(insertTooltip).toBeVisible();
    expect(
      await insertTooltip.evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return range.getClientRects().length;
      }),
    ).toBe(1);
    await page.emulateMedia({ colorScheme: "dark" });
    const background = await insertTooltip.evaluate((el) =>
      getComputedStyle(el)
        .backgroundColor.match(/\d+/g)
        .slice(0, 3)
        .map(Number),
    );
    expect(
      Math.max(...background),
      "Dark theme uses a dark tooltip bubble",
    ).toBeLessThan(100);
    expect((await insertTooltip.boundingBox()).width).toBeGreaterThan(
      (await insert.boundingBox()).width,
    );
    await page.screenshot({
      path: testInfo.outputPath("wide-tooltip-dark.png"),
    });
  });
}
