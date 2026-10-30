import { captureScreenshot } from "./screenshots.js";
import {
  test,
  expect,
  seed,
  saved,
  openSettings,
  closeSettings,
} from "./fixtures.js";

test("CFOP links reload and browser history restores sections and methods", async ({
  page,
}) => {
  await page.goto("/cfop/pll/two-look");
  await expect(
    page.getByRole("heading", { name: "CFOP", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".library-case")).toHaveCount(6);
  await page.getByRole("button", { name: "Full", exact: true }).click();
  await expect(page).toHaveURL(/\/cfop\/pll\/full$/);
  await expect(page.locator(".library-case")).toHaveCount(21);
  await page
    .getByRole("navigation", { name: "CFOP sections" })
    .getByRole("button", { name: "OLL", exact: true })
    .click();
  await expect(page).toHaveURL(/\/cfop\/oll\/full$/);
  await page.reload();
  await expect(page.locator(".library-case")).toHaveCount(57);
  await page.goBack();
  await expect(page.locator(".library-case")).toHaveCount(21);
  await page.goBack();
  await expect(page.locator(".library-case")).toHaveCount(6);
  await page.goForward();
  await expect(page.locator(".library-case")).toHaveCount(21);
});

test("settings keeps the current practice and Back/Forward controls the popup", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("button", { name: "Start hidden practice" }).click();
  const setup = await page
    .getByLabel("Setup moves", { exact: true })
    .textContent();
  const before = await saved(page);
  await openSettings(page);
  await expect(page).toHaveURL(/\/practice\?settings$/);
  await page.getByLabel("PLL arrows", { exact: true }).uncheck();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Setup moves", { exact: true })).toHaveText(
    setup,
  );
  await expect(page.locator(".header-settings")).toBeFocused();
  await page.goForward();
  await expect(
    page.getByRole("dialog", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Setup moves", { exact: true })).toHaveText(
    setup,
  );
  expect(await saved(page)).toEqual(before);
});

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`settings popup fits and preserves page at ${viewport.width}×${viewport.height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport);
    await page.goto("/library/oll/two-look?settings");
    const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
    await expect(dialog).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Close settings" }),
    ).toBeFocused();
    await page.getByLabel("Hide timer while solving").check();
    await page.getByLabel("Default display top color").selectOption("F");
    await page.reload();
    await expect(page.getByLabel("Hide timer while solving")).toBeChecked();
    await expect(page.getByLabel("Default display top color")).toHaveValue("F");
    for (const theme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme: theme });
      await dialog.evaluate((el) => (el.scrollTop = 0));
      await expect(
        page.getByRole("button", { name: "Close settings" }),
      ).toBeInViewport();
      expect(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      const bounds = await dialog.boundingBox();
      expect(bounds.height).toBeLessThanOrEqual(viewport.height);
      await captureScreenshot(page, {
        path: info.outputPath(`settings-${theme}.png`),
      });
    }
    await closeSettings(page);
    await expect(page.locator(".library-case")).toHaveCount(10);
    await openSettings(page);
    await page.getByRole("button", { name: "Cubes", exact: true }).click();
    await expect(page).toHaveURL(/\/cubes$/);
    await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: "Back to Settings" }).click();
    await expect(dialog).toBeVisible();
    await closeSettings(page);
    await expect(
      page.getByRole("button", { name: "Back to Settings" }),
    ).toBeFocused();
  });
}

test("invalid links recover safely and practice reload never fabricates a session", async ({
  page,
}) => {
  for (const hash of ["/unknown", "/%E0%A4%A"]) {
    await page.goto(`/${hash}`);
    await expect(
      page.getByRole("heading", { name: "Dashboard", exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page.goto("/practice");
  await expect(
    page.getByRole("heading", { name: "Choose cases to practice" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("the site opens on the dashboard and the brand returns there", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await expect(
    navigation.getByRole("button", { name: "Dashboard", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await navigation
    .getByRole("button", { name: "My learning", exact: true })
    .click();
  await expect(page).toHaveURL(/\/home$/);
  await page.getByRole("link", { name: "Last Layer" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
});

test("settings traps keyboard focus and backdrop closes it without leaving the timer", async ({
  page,
}) => {
  await page.goto("/timer");
  await openSettings(page);
  await page.keyboard.press("Shift+Tab");
  expect(
    await page.evaluate(
      () => !!document.activeElement.closest("#settings-dialog"),
    ),
  ).toBe(true);
  await page.mouse.click(2, 2);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/timer$/);
  await expect(page.locator(".header-settings")).toBeFocused();
});

test("old hash links become clean nested routes and reload their local assets", async ({
  page,
}) => {
  await page.goto("/#/cfop/pll/two-look?settings");
  await expect(page).toHaveURL(/\/cfop\/pll\/two-look\?settings$/);
  await expect(
    page.getByRole("dialog", { name: "Settings", exact: true }),
  ).toBeVisible();
  await closeSettings(page);
  await page.reload();
  await expect(page.locator(".library-case")).toHaveCount(6);
  await page
    .getByRole("banner")
    .getByRole("link", { name: "My profile", exact: true })
    .click();
  await expect(page).toHaveURL(/\/account\/profile$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/cfop\/pll\/two-look$/);
});
