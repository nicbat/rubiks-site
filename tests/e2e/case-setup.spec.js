import { captureScreenshot } from "./screenshots.js";
import { test, expect, seed, saved, openLibrary } from "./fixtures.js";

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`case setup disclosure works at ${viewport.width}×${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await seed(page);
    const before = await saved(page);
    for (const section of ["PLL", "OLL"]) {
      await openLibrary(page, section);
      const opener = page.getByRole("button", { name: /^View / }).first();
      await opener.click();
      const dialog = page.getByRole("dialog");
      const moves = dialog.getByLabel("Case setup moves");
      await expect(moves).toBeHidden();
      const show = dialog.getByRole("button", {
        name: "Show setup moves",
        exact: true,
      });
      await show.focus();
      await page.keyboard.press("Enter");
      await expect(moves).toBeVisible();
      const sequence = await moves.textContent();
      expect(sequence).toMatch(/^[URFDLB2' ]+$/);
      const hide = dialog.getByRole("button", {
        name: "Hide setup moves",
        exact: true,
      });
      await expect(hide).toBeFocused();
      await expect(hide).toHaveAttribute("aria-expanded", "true");
      await dialog.getByRole("combobox", { name: "Your algorithm" }).click();
      await dialog.getByRole("option").last().click();
      await expect(moves).toBeVisible();
      await expect(moves).toHaveText(sequence);
      await dialog.getByRole("button", { name: "Known", exact: true }).click();
      await expect(moves).toHaveText(sequence);
      await dialog.getByRole("button", { name: "Known", exact: true }).click();
      for (const colorScheme of ["light", "dark"]) {
        await page.emulateMedia({ colorScheme });
        await moves.scrollIntoViewIfNeeded();
        const bounds = await moves.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const dialog = el.closest("dialog");
          const d = dialog.getBoundingClientRect();
          return {
            left: r.left,
            right: r.right,
            dialogLeft: d.left,
            dialogRight: d.right,
            fits:
              el.scrollWidth <= el.clientWidth + 1 &&
              dialog.scrollWidth <= dialog.clientWidth + 1,
          };
        });
        expect(bounds.fits).toBe(true);
        expect(bounds.left).toBeGreaterThanOrEqual(
          Math.max(0, bounds.dialogLeft),
        );
        expect(bounds.right).toBeLessThanOrEqual(
          Math.min(viewport.width, bounds.dialogRight),
        );
        await captureScreenshot(page, {
          path: testInfo.outputPath(`${section}-setup-${colorScheme}.png`),
        });
      }
      await hide.click();
      await expect(moves).toBeHidden();
      const target = await show.boundingBox();
      expect(target.height).toBeGreaterThanOrEqual(44);
      await show.click();
      await dialog
        .getByRole("button", { name: "Close case", exact: true })
        .click();
      await expect(opener).toBeFocused();
      await opener.click();
      await expect(moves).toBeHidden();
      await page.keyboard.press("Escape");
      await expect(opener).toBeFocused();
    }
    const after = await saved(page);
    expect(after.selected).toEqual(before.selected);
    expect(after.attempts).toEqual(before.attempts);
  });
}
