import { captureScreenshot } from "./screenshots.js";
import { openSettings, closeSettings } from "./fixtures.js";
import { test, expect, seed, saved } from "./fixtures.js";

test("notation explores moves with keyboard and mobile controls without changing progress", async ({
  page,
}, testInfo) => {
  await seed(page);
  const before = await saved(page);
  const nav = page.getByRole("button", { name: "Guides", exact: true });
  await nav.focus();
  await page.keyboard.press("Enter");
  await expect(nav).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("main")).toBeFocused();
  await page.getByRole("button", { name: "Notation", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Move notation", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "After R", exact: true }),
  ).toBeVisible();
  await captureScreenshot(page, {
    path: testInfo.outputPath("notation-light.png"),
    fullPage: true,
  });
  if (testInfo.project.name === "mobile-chromium") {
    await page.getByLabel("Move to preview").focus();
    await page.getByLabel("Move to preview").selectOption("M");
    await expect(page.getByLabel("Move to preview")).toBeFocused();
  } else {
    const move = page.getByRole("button", { name: "M: Middle", exact: true });
    await move.focus();
    await page.keyboard.press("Enter");
    await expect(move).toBeFocused();
  }
  await page.getByRole("button", { name: "M' Prime", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "After M'", exact: true }),
  ).toBeVisible();
  const after = page.getByRole("img", { name: "After M'", exact: true });
  // M' sends the green front center to the top while leaving outer layers fixed.
  await expect(
    after.locator('[data-face="U"][data-row="1"][data-col="1"]'),
  ).toHaveAttribute("data-color", "F");
  await expect(
    after.locator('[data-face="U"][data-row="1"][data-col="0"]'),
  ).toHaveAttribute("data-color", "U");
  await page.getByRole("button", { name: "M2 Double", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "After M2", exact: true }),
  ).toBeVisible();
  await openSettings(page);
  await page.getByLabel("Dark", { exact: true }).check();
  await closeSettings(page);
  await nav.click();
  await expect(
    page.getByRole("region", { name: "3D cube player", exact: true }),
  ).toHaveCount(1);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("img", { name: "After M2", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "J Perm’s move guide" }),
  ).toHaveAttribute("href", "https://jperm.net/3x3/moves");
  const wide = page.getByRole("button", {
    name: "r: Right wide · Rw",
    exact: true,
  });
  await wide.click();
  await expect(wide).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("img", { name: "After r2", exact: true }),
  ).toBeVisible();
  expect(await saved(page)).toEqual(before);
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(page.getByLabel("Move to preview")).toBeVisible();
  await page.getByLabel("Move to preview").selectOption("z");
  await expect(
    page.getByRole("img", { name: "After z2", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await captureScreenshot(page, {
    path: testInfo.outputPath("notation-mobile-dark.png"),
    fullPage: true,
  });
});
