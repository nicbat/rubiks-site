import {
  test,
  expect,
  seed,
  openLibrary,
  openSettings,
  closeSettings,
} from "./fixtures.js";

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`styled dropdowns retain selection and keyboard controls at ${viewport.width}×${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seed(page);
    for (const theme of ["light", "dark"]) {
      await openSettings(page);
      await page
        .getByLabel(theme === "light" ? "Light" : "Dark", { exact: true })
        .check();
      await closeSettings(page);
      await openLibrary(page);
      const control = page.getByRole("combobox", { name: "Learning method" });
      await control.focus();
      await page.keyboard.press("ArrowDown");
      const options = page.getByRole("listbox", { name: "Learning method" });
      await expect(options).toBeVisible();
      await expect(control).toHaveAttribute("aria-expanded", "true");
      await expect(
        options.getByRole("option", { name: "Full OLL / PLL", exact: true }),
      ).toBeFocused();
      await expect(options.getByRole("option", { selected: true })).toHaveCSS(
        "font-weight",
        "700",
      );
      await expect(control).toHaveCSS("border-radius", "10px");
      expect(
        await options
          .getByRole("option", { selected: true })
          .evaluate((el) => getComputedStyle(el, "::after").content),
      ).toBe('"✓"');
      const bounds = await options.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      await page.screenshot({
        path: testInfo.outputPath(`dropdown-${theme}.png`),
      });
      await page.keyboard.press("End");
      await page.keyboard.press("Enter");
      await expect(control).toBeFocused();
      await expect(control).toHaveAttribute("aria-expanded", "false");
      await expect(control).toContainText("2-look");
      // Restore the first option so both theme passes start at the same selection.
      await control.press("ArrowDown");
      await page.keyboard.press("Home");
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "Guides", exact: true }).click();
      await page.getByRole("button", { name: "Notation", exact: true }).click();
      const move = page.getByRole("combobox", { name: "Move to preview" });
      await expect(move).toHaveCSS("border-radius", "10px");
      const size = await move.boundingBox();
      expect(size.height).toBeGreaterThanOrEqual(44);
      expect(size.x + size.width).toBeLessThanOrEqual(viewport.width);
      await move.click();
      await page.getByRole("option", { name: "M", exact: true }).click();
      await expect(
        page.getByRole("img", { name: "After M", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: "3D cube player", exact: true }),
      ).toBeVisible();
    }
  });
}
