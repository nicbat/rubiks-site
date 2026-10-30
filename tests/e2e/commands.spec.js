import { captureScreenshot } from "./screenshots.js";
import { test, expect, seed, saved } from "./fixtures.js";

test("commands search, keyboard navigation, dismissal and settings priority", async ({
  page,
}) => {
  await page.goto("/home");
  const opener = page.getByRole("button", { name: "Commands", exact: true });
  await opener.focus();
  await page.keyboard.press("Escape");
  const search = page.getByRole("combobox", { name: "Search commands" });
  await expect(search).toBeFocused();
  await expect(search).toHaveAttribute(
    "aria-controls",
    await page
      .getByRole("listbox", { name: "Commands", exact: true })
      .getAttribute("id"),
  );
  await page.keyboard.press("ArrowUp");
  const backup = page.getByRole("option", {
    name: "Backup & transfer",
    exact: true,
  });
  await expect(backup).toHaveAttribute("aria-selected", "true");
  await expect(search).toBeFocused();
  await expect(search).toHaveAttribute(
    "aria-activedescendant",
    await backup.getAttribute("id"),
  );
  await page.keyboard.press("Tab");
  // Native modal dialogs allow focus into browser chrome, but never the inert page.
  await expect(page.locator(".shell :focus")).toHaveCount(0);
  await search.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Close commands" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(search).toBeFocused();
  await search.fill("pll two");
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("option", { name: "CFOP · PLL · Two-look", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(search).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/cfop\/pll\/two-look$/);
  await page.keyboard.press("Control+k");
  await search.fill("nothing matches");
  await expect(
    page.getByRole("status").filter({ hasText: "No matching commands" }),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(search).toBeVisible();
  await page.keyboard.press("Escape");
  await opener.click();
  await page.getByRole("button", { name: "Close commands" }).click();
  await expect(opener).toBeFocused();
  await page.keyboard.press("Meta+k");
  await expect(search).toBeFocused();
  await page.keyboard.press("Escape");
  await opener.click();
  await search.fill("settings");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("commands preserve hidden practice and do not interrupt a running timer", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("button", { name: "Start hidden practice" }).click();
  const setup = await page
    .getByLabel("Setup moves", { exact: true })
    .textContent();
  const before = await saved(page);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Commands", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Setup moves", { exact: true })).toHaveText(
    setup,
  );
  expect(await saved(page)).toEqual(before);
  await page.goto("/timer");
  await page.clock.install();
  await page.locator("#main").focus();
  await page.keyboard.down("Space");
  await page.clock.runFor(600);
  await page.keyboard.up("Space");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  await page.getByRole("button", { name: "Commands", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Stop timer", exact: true }),
  ).toBeVisible();
});

for (const [width, height] of [
  [320, 720],
  [667, 375],
  [1280, 900],
]) {
  for (const colorScheme of ["light", "dark"]) {
    test(`commands fit ${width}x${height} ${colorScheme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme });
      await page.goto("/home");
      await page.getByRole("button", { name: "Commands", exact: true }).click();
      const dialog = page.getByRole("dialog", {
        name: "Commands",
        exact: true,
      });
      await expect(dialog).toBeVisible();
      const paletteTheme = await appearance(dialog);
      const bounds = await dialog.boundingBox();
      expect(bounds.width).toBeLessThanOrEqual(512);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
      expect(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      const close = page.getByRole("button", { name: "Close commands" });
      const box = await close.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
      const search = page.getByRole("combobox", { name: "Search commands" });
      await expect(search).toBeFocused();
      const searchBox = await search.boundingBox();
      expect(searchBox.height).toBeGreaterThanOrEqual(44);
      // Default Command starts directly with search, without a tall app header.
      expect(searchBox.y - bounds.y).toBeLessThanOrEqual(4);
      const list = page.getByRole("listbox", { name: "Commands", exact: true });
      expect((await list.boundingBox()).height).toBeLessThanOrEqual(300);
      const firstOption = page.getByRole("option").first();
      await expect(firstOption).toHaveCSS("font-size", "14px");
      expect((await firstOption.boundingBox()).height).toBeGreaterThanOrEqual(
        44,
      );
      expect(searchBox.x + searchBox.width).toBeLessThanOrEqual(
        bounds.x + bounds.width,
      );
      await expect(
        page.locator('[data-slot="command-input-wrapper"] svg'),
      ).toBeVisible();
      await captureScreenshot(page, {
        path: testInfo.outputPath("commands.png"),
      });
      await page
        .getByRole("option", { name: "Backup & transfer", exact: true })
        .click();
      await expect(
        page
          .getByRole("dialog")
          .getByRole("heading", { name: "Backup & transfer" }),
      ).toBeVisible();
      expect(await appearance(page.getByRole("dialog"))).toEqual(paletteTheme);
    });
  }
}

async function appearance(locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      color: style.color,
      font: style.fontFamily,
    };
  });
}
