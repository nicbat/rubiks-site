import { test, expect, openLibrary } from "./fixtures.js";

test("G-perm diagrams show outlined corner and edge triangles in both themes", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("PLL arrows", { exact: true }).check();
  for (const theme of ["Light", "Dark"]) {
    await page.getByLabel(theme, { exact: true }).check();
    await openLibrary(page);
    for (const name of ["Ga", "Gb", "Gc", "Gd"]) {
      const button = page.getByRole("button", {
        name: `View ${name} perm`,
        exact: true,
      });
      await expect(
        button.locator('.pll-arrow[data-kind="corner"]'),
      ).toHaveCount(3);
      await expect(button.locator('.pll-arrow[data-kind="edge"]')).toHaveCount(
        3,
      );
      await expect(button.locator(".pll-arrow-outline")).toHaveCount(6);
      await button.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.locator(".pll-arrow-outline")).toHaveCount(6);
      await dialog.screenshot({
        path: testInfo.outputPath(`${name}-${theme}.png`),
      });
      await page
        .getByRole("button", { name: "Close case", exact: true })
        .click();
    }
    await page.getByRole("button", { name: "Settings", exact: true }).click();
  }
  await page.getByLabel("PLL arrows", { exact: true }).uncheck();
  await openLibrary(page);
  await expect(page.locator(".pll-arrows")).toHaveCount(0);
});
