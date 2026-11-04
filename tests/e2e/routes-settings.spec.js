import { captureScreenshot } from "./screenshots.js";
import {
  test,
  expect,
  seed,
  saved,
  openSettings,
  closeSettings,
  holdStartTimer,
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

test("settings keeps the current practice and Back/Forward opens the Settings page", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("button", { name: "Start hidden practice" }).click();
  const setup = await page
    .getByLabel("Setup moves", { exact: true })
    .textContent();
  const before = await saved(page);
  await openSettings(page);
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByLabel("Setup moves", { exact: true })).toHaveCount(0);
  await page.getByRole("heading", { name: "Settings", exact: true }).press("r");
  await page.getByLabel("Show PLL movement arrows", { exact: true }).uncheck();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Setup moves", { exact: true })).toHaveText(
    setup,
  );
  await expect(page.locator(".header-settings")).toBeFocused();
  await page.goForward();
  await expect(
    page.getByRole("region", { name: "Settings", exact: true }),
  ).toBeVisible();
  await closeSettings(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Setup moves", { exact: true })).toHaveText(
    setup,
  );
  expect(await saved(page)).toEqual(before);
});

test("Settings cannot interrupt an active solve through the gear or browser history", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/timer");
  await openSettings(page);
  await closeSettings(page);
  await holdStartTimer(page);
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeDisabled();
  await page.goForward();
  await expect(page).toHaveURL(/\/timer$/);
  await expect(
    page.getByRole("button", { name: "Stop timer", exact: true }),
  ).toBeVisible();
  await page.clock.runFor(1230);
  await page.getByRole("button", { name: "Stop timer", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("last-layer.solves.v1")).length,
    ),
  ).toBe(1);
});

test("Settings keeps save failures visible and retries without changing training data", async ({
  page,
}) => {
  await seed(page);
  const before = await saved(page);
  await openSettings(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.restoreSettingsStorage = () => {
      Storage.prototype.setItem = original;
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === "last-layer.preferences.v1")
        throw new DOMException("Full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.getByLabel("Case top color").selectOption("F");
  await expect(page.locator("#settings-page").getByRole("alert")).toContainText(
    "could not be saved",
  );
  await page.getByRole("radio", { name: "Dark", exact: true }).check();
  await expect(page.locator("#settings-page").getByRole("alert")).toContainText(
    "could not be saved",
  );
  await page.evaluate(() => window.restoreSettingsStorage());
  await page.getByLabel("Time format").selectOption("seconds");
  await expect(page.locator("#settings-page").getByRole("alert")).toHaveCount(
    0,
  );
  await page.reload();
  await expect(page.getByLabel("Case top color")).toHaveValue("F");
  await expect(page.getByLabel("Time format")).toHaveValue("seconds");
  expect(await saved(page)).toEqual(before);
});

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`Settings page saves preferences and fits at ${viewport.width}×${viewport.height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport);
    await page.goto("/settings");
    const settings = page.getByRole("region", {
      name: "Settings",
      exact: true,
    });
    await expect(settings).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".settings-advanced")).not.toHaveAttribute(
      "open",
      "",
    );
    await page.getByLabel("Hide timer while solving").check();
    await page.getByLabel("Case top color").selectOption("F");
    await page.getByLabel("Time format").selectOption("seconds");
    await page.reload();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByLabel("Hide timer while solving")).toBeChecked();
    await expect(page.getByLabel("Case top color")).toHaveValue("F");
    await expect(page.getByLabel("Time format")).toHaveValue("seconds");
    for (const theme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme: theme });
      await page.getByText("Advanced", { exact: true }).click();
      await page.getByLabel("Use demo data", { exact: true }).check();
      const bounds = await settings.evaluate((root) =>
        [...root.querySelectorAll("button,select,label,summary,h1,h2,p")]
          .filter((el) => el.checkVisibility())
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {
              name: el.textContent?.trim().slice(0, 40) || el.id,
              left: r.left,
              right: r.right,
              height: r.height,
              control: el.matches(
                "button,select,.settings-row-copy label,summary",
              ),
              field: el.matches("select"),
              font: parseFloat(getComputedStyle(el).fontSize),
            };
          }),
      );
      for (const b of bounds) {
        expect(b.left, b.name).toBeGreaterThanOrEqual(0);
        expect(b.right, b.name).toBeLessThanOrEqual(viewport.width);
        if (b.control) expect(b.height, b.name).toBeGreaterThanOrEqual(44);
        if (b.field) expect(b.font, b.name).toBeGreaterThanOrEqual(16);
      }
      await page.getByLabel("Use demo data", { exact: true }).uncheck();
      await page.getByText("Advanced", { exact: true }).click();
      await page
        .getByRole("heading", { name: "Settings", exact: true })
        .scrollIntoViewIfNeeded();
      await captureScreenshot(page, {
        path: info.outputPath(`settings-${theme}.png`),
        fullPage: true,
      });
    }
    await page
      .getByRole("button", { name: "Manage cubes", exact: true })
      .click();
    await expect(page).toHaveURL(/\/cubes$/);
    await page.getByRole("button", { name: "Back to Settings" }).click();
    await expect(settings).toBeVisible();
    await closeSettings(page);
    await expect(
      page.getByRole("button", { name: "Back to Settings" }),
    ).toBeFocused();
  });
}

test("invalid links recover safely and practice reload never fabricates a session", async ({
  page,
}) => {
  for (const path of ["/unknown", "/%E0%A4%A"]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Dashboard", exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page.goto("/practice");
  await expect(
    page.getByRole("heading", { name: "Start with a few cases" }),
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

test("Settings uses page keyboard navigation and returns to the timer without starting it", async ({
  page,
}) => {
  await page.goto("/timer");
  const scramble = await page.locator("#timer-scramble").textContent();
  await openSettings(page);
  await page.getByRole("heading", { name: "Settings", exact: true }).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Commands", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await closeSettings(page);
  await expect(page).toHaveURL(/\/timer$/);
  await expect(page.locator(".header-settings")).toBeFocused();
  await expect(page.locator("#timer-scramble")).toHaveText(scramble);
  await expect(
    page.getByRole("button", { name: "Hold to start (Space)", exact: true }),
  ).toBeVisible();
});

test("old hash links become clean nested routes and reload their local assets", async ({
  page,
}) => {
  await page.goto("/#/cfop/pll/two-look?settings");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(
    page.getByRole("region", { name: "Settings", exact: true }),
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
