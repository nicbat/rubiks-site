import { captureScreenshot } from "./screenshots.js";
import { test, expect, seed } from "./fixtures.js";

async function expectBounds(page, selector, width) {
  for (const control of await page.locator(selector).all()) {
    if (!(await control.isVisible())) continue;
    await control.scrollIntoViewIfNeeded();
    const box = await control.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    if (await control.evaluate((el) => el.matches("a,button,input,summary"))) {
      // Firefox can report a 44px target as 43.999969 after scrolling.
      // Normalize floating-point noise while retaining the 44px minimum.
      expect(Math.round(box.height * 1000) / 1000).toBeGreaterThanOrEqual(44);
    }
  }
}
const timerSummary = (page) =>
  page.getByRole("group", { name: "Timer summary", exact: true });
const solveCount = (page) =>
  timerSummary(page)
    .getByText("Solves", { exact: true })
    .locator("..")
    .locator("strong");

for (const theme of ["light", "dark"])
  for (const viewport of [
    { width: 320, height: 720 },
    { width: 667, height: 375 },
  ]) {
    test(`one Profile combines saved identity and private progress at ${viewport.width}x${viewport.height} in ${theme}`, async ({
      page,
    }, info) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.clock.install({ time: new Date("2026-10-17T19:00:00Z") });
      await page.addInitScript((theme) => {
        localStorage.setItem("last-layer-theme", theme);
        localStorage.setItem(
          "last-layer.preferences.v1",
          JSON.stringify({ testData: true }),
        );
      }, theme);
      await page.goto("/account/profile");
      await expect(page).toHaveURL(/\/progress$/);
      await expect(
        page.getByRole("heading", { name: "Profile", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Demo Learner", exact: true }),
      ).toBeVisible();
      await expect(page.locator(".header-account,.workspace-tabs")).toHaveCount(
        0,
      );
      await expect(
        page
          .getByRole("banner")
          .getByRole("button", { name: "Check sync", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /Make stats (public|private)/ }),
      ).toHaveCount(0);
      const syncOpener = page.getByRole("button", {
        name: "Sync status",
        exact: true,
      });
      await syncOpener.click();
      await page
        .getByRole("button", { name: "Check sync", exact: true })
        .click();
      await expect(page.locator("#toast")).toHaveText(
        "Demo changes stay in this tab. No cloud requests.",
      );
      await page
        .getByRole("button", { name: "Close sync status", exact: true })
        .click();
      await expect(syncOpener).toBeFocused();
      await expect(
        page
          .getByRole("navigation", { name: "Main navigation" })
          .getByRole("button", { name: "Profile", exact: true }),
      ).toHaveAttribute("aria-current", "page");
      await expect(
        page.getByRole("group", { name: "Activity summary", exact: true }),
      ).toHaveCount(1);
      await expect(timerSummary(page)).toHaveCount(1);
      await expect(
        page.getByRole("button", { name: "All time", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      const total = await solveCount(page).textContent();
      const allTimeStats = await timerSummary(page).textContent();
      expect(Number(total)).toBeGreaterThan(1000);
      await page
        .getByRole("button", { name: "Last month", exact: true })
        .click();
      await expect(solveCount(page)).not.toHaveText(total);
      await expect(
        page.getByRole("region", { name: "Training progress", exact: true }),
      ).toContainText(/\d{4}-\d{2}-\d{2} – \d{4}-\d{2}-\d{2}/);
      await page.getByRole("button", { name: "All time", exact: true }).click();
      await expect(solveCount(page)).toHaveText(total);
      await expectBounds(
        page,
        ".personal-profile a,.personal-profile button,.personal-profile h1,.personal-profile h2,.personal-profile p,.personal-profile summary",
        viewport.width,
      );
      await captureScreenshot(page, {
        path: info.outputPath("combined-profile.png"),
        fullPage: true,
      });
      await page
        .getByRole("link", { name: "Edit profile", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Display name", exact: true })
        .fill("Unsaved learner name");
      await page
        .getByRole("textbox", { name: "Bio", exact: true })
        .fill("Private draft bio");
      await page
        .getByRole("button", { name: "Ocean cube", exact: true })
        .click();
      await page
        .getByRole("link", { name: "Back to my profile", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Demo Learner", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Private draft bio", { exact: true }),
      ).toHaveCount(0);
      const find = page.getByRole("link", {
        name: "Find a learner",
        exact: true,
      });
      await find.click();
      const lookup = page.getByRole("textbox", {
        name: "Look up a username",
        exact: true,
      });
      await expect(lookup).toBeFocused();
      await lookup.fill("demo_friend");
      await page.keyboard.press("Escape");
      await expect(page).toHaveURL(/\/progress$/);
      await expect(find).toBeFocused();
      await find.click();
      await expect(lookup).toBeFocused();
      await expect(lookup).toHaveValue("demo_friend");
      await expectBounds(
        page,
        ".profile-page a,.profile-page button,.profile-page input",
        viewport.width,
      );
      await captureScreenshot(page, {
        path: info.outputPath("profile-lookup.png"),
        fullPage: true,
      });
      await lookup.press("Enter");
      await expect(page).toHaveURL(/\/u\/demo_friend$/);
      await expect(
        page.getByRole("heading", { name: "Demo Friend", exact: true }),
      ).toBeVisible();
      await expect(solveCount(page)).toHaveText("240");
      await expect(
        page.locator(
          ".activity-heatmap,.daily-solves,.case-map,#profile-edit-form",
        ),
      ).toHaveCount(0);
      await page
        .getByRole("link", { name: "Back to lookup", exact: true })
        .click();
      await expect(lookup).toBeFocused();
      await expect(lookup).toHaveValue("demo_friend");
      await lookup.fill("demo_private");
      await lookup.press("Enter");
      await expect(
        page.getByText("Statistics are private.", { exact: true }),
      ).toBeVisible();
      await expect(timerSummary(page)).toHaveCount(0);
      await captureScreenshot(page, {
        path: info.outputPath("private-visitor.png"),
        fullPage: true,
      });
      await page.goBack();
      await expect(lookup).toBeFocused();
      await expect(lookup).toHaveValue("demo_private");
      await page.goForward();
      await expect(
        page.getByText("Statistics are private.", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("link", { name: "Back to my profile", exact: true })
        .click();
      await expect(find).toBeFocused();
      await expect(solveCount(page)).toHaveText(total);
      await page
        .getByRole("button", { name: "Copy profile link", exact: true })
        .click();
      await expect(
        page.getByText(/Profile link copied|Copy this profile link/),
      ).toBeVisible();
      await page
        .getByRole("link", { name: "Edit profile", exact: true })
        .click();
      await expect(
        page.getByRole("textbox", { name: "Display name", exact: true }),
      ).toHaveValue("Unsaved learner name");
      await expect(
        page.getByRole("textbox", { name: "Bio", exact: true }),
      ).toHaveValue("Private draft bio");
      await expect(
        page.getByRole("button", { name: "Ocean cube", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await page.getByText("View as a visitor", { exact: true }).click();
      const preview = page.locator('details[aria-label="Visitor preview"]');
      await expect(preview).toContainText("Demo Learner");
      await expect(preview).not.toContainText("Private draft bio");
      await expect(preview).toContainText("Statistics are private.");
      await page
        .getByRole("button", { name: "Make stats public", exact: true })
        .click();
      await expect(
        preview.getByRole("group", { name: "Timer summary", exact: true }),
      ).toHaveText(allTimeStats);
      await page
        .getByRole("button", { name: "Make stats private", exact: true })
        .click();
      await expect(
        preview.getByRole("group", { name: "Timer summary", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("textbox", { name: "Display name", exact: true }),
      ).toHaveValue("Unsaved learner name");
    });

    test(`guest Profile and legacy lookup retain private training at ${viewport.width}x${viewport.height} in ${theme}`, async ({
      page,
    }, info) => {
      await page.setViewportSize(viewport);
      await page.addInitScript(
        (theme) => localStorage.setItem("last-layer-theme", theme),
        theme,
      );
      await seed(page);
      await page.goto("/#/people");
      await expect(page).toHaveURL(/\/people$/);
      const lookup = page.getByRole("textbox", {
        name: "Look up a username",
        exact: true,
      });
      await expect(lookup).toBeFocused();
      await lookup.fill("learner_123");
      await page
        .getByRole("link", { name: "Back to my profile", exact: true })
        .click();
      await expect(page).toHaveURL(/\/progress$/);
      const find = page.getByRole("link", {
        name: "Find a learner",
        exact: true,
      });
      await expect(find).toBeFocused();
      await expect(
        page.getByRole("heading", { name: "Your cases", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: "Email", exact: true }),
      ).not.toBeVisible();
      await page
        .getByText("Sign in to sync across devices", { exact: true })
        .click();
      await expect(
        page.getByRole("textbox", { name: "Email", exact: true }),
      ).toBeVisible();
      await expectBounds(
        page,
        ".personal-profile a,.personal-profile button,.personal-profile input,.personal-profile summary",
        viewport.width,
      );
      await captureScreenshot(page, {
        path: info.outputPath("guest-profile.png"),
        fullPage: true,
      });
      await find.click();
      await expect(lookup).toBeFocused();
      await expect(lookup).toHaveValue("learner_123");
      await page.goBack();
      await expect(find).toBeFocused();
      await page.goForward();
      await expect(lookup).toBeFocused();
      await page.goto("/#/account/profile");
      await expect(page).toHaveURL(/\/progress$/);
      await expect(
        page.getByRole("heading", { name: "Profile", exact: true }),
      ).toBeVisible();
    });
  }
