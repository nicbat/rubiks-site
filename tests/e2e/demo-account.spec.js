import { captureScreenshot } from "./screenshots.js";
import {
  test,
  expect,
  openDemoSettings,
  closeSettings,
  openAccount,
} from "./fixtures.js";

async function demoPage(page, theme = "light") {
  const requests = [];
  for (const path of ["auth", "rest"])
    await page.route(`**/${path}/v1/**`, async (route) => {
      requests.push(route.request().url());
      await route.fulfill({ json: path === "rest" ? [] : {} });
    });
  await page.clock.install({ time: new Date("2026-10-17T19:00:00Z") });
  await page.addInitScript(
    ({ theme }) => {
      localStorage.setItem("last-layer-theme", theme);
      localStorage.setItem(
        "last-layer.preferences.v1",
        JSON.stringify({ testData: true }),
      );
      localStorage.setItem(
        "last-layer.progress.v2",
        JSON.stringify({
          version: 2,
          selected: ["pll-T"],
          variants: {},
          attempts: [],
        }),
      );
      localStorage.setItem(
        "last-layer.account.real-user.last-layer.progress.v2",
        "personal account canary",
      );
    },
    { theme },
  );
  await page.goto("/account");
  return requests;
}
const personalBytes = (page) =>
  page.evaluate(() => [
    localStorage.getItem("last-layer.progress.v2"),
    localStorage.getItem("last-layer.account.real-user.last-layer.progress.v2"),
  ]);
for (const theme of ["light", "dark"])
  for (const viewport of [
    { width: 320, height: 720 },
    { width: 667, height: 375 },
  ]) {
    test(`fake account and profile work locally at ${viewport.width}x${viewport.height} in ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const requests = await demoPage(page, theme);
      const before = await personalBytes(page);
      await expect(
        page.getByText("learner@example.test", { exact: true }),
      ).toBeVisible();
      await openAccount(page, "profile");
      await page
        .getByRole("textbox", { name: "Bio", exact: true })
        .fill("Demo profile edits only.");
      await page
        .getByRole("button", { name: "Save profile", exact: true })
        .click();
      await expect(
        page.getByText("Profile saved in demo.", { exact: true }),
      ).toBeVisible();
      const bounds = await page.locator(".account-settings").evaluate((root) =>
        Array.from(
          root.querySelectorAll(
            'input:not([type="hidden"]):not([aria-hidden="true"]),textarea,button,label',
          ),
        ).map((el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, height: r.height };
        }),
      );
      for (const bound of bounds) {
        expect(bound.left).toBeGreaterThanOrEqual(0);
        expect(bound.right).toBeLessThanOrEqual(viewport.width);
        expect(bound.height).toBeGreaterThanOrEqual(44);
      }
      await page
        .getByRole("link", { name: "@demo_learner", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Demo Learner", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Demo profile edits only.", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("group", { name: "Timer summary", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("link", { name: "Find a learner", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Look up a username" })
        .fill("demo_friend");
      await page
        .getByRole("button", { name: "View profile", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Demo Friend", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("link", { name: "Find a learner", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Look up a username" })
        .fill("demo_private");
      await page
        .getByRole("button", { name: "View profile", exact: true })
        .click();
      await expect(
        page.getByText("Statistics are private.", { exact: true }),
      ).toBeVisible();
      expect(await personalBytes(page)).toEqual(before);
      expect(requests).toEqual([]);
    });
  }
test("demo sign-in, setup, failures, deletion and reset never touch real services or saved training", async ({
  page,
}) => {
  const requests = await demoPage(page);
  const before = await personalBytes(page);
  async function scenario(value, section = "settings") {
    await openDemoSettings(page);
    await page
      .getByRole("combobox", { name: "Demo account state", exact: true })
      .selectOption(value);
    await openAccount(page, section);
  }
  await scenario("signed-out");
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("contributor@example.test");
  await page
    .getByRole("button", { name: "Continue with email", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Email code", exact: true })
    .fill("123456");
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await expect(
    page.getByText("contributor@example.test", { exact: true }),
  ).toBeVisible();
  await scenario("setup");
  await page
    .getByRole("textbox", { name: "Choose your username" })
    .fill("dev_learner");
  await page
    .getByRole("button", { name: "Finish account setup", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "@dev_learner", exact: true }),
  ).toBeVisible();
  await scenario("offline", "sync");
  await page
    .getByRole("dialog", { name: "Sync status", exact: true })
    .getByRole("button", { name: "Check sync", exact: true })
    .click();
  await expect(
    page
      .locator("#sync-dialog")
      .getByText("Demo is offline. Changes stay in this tab.", { exact: true }),
  ).toBeVisible();
  await scenario("conflict", "sync");
  await page
    .getByRole("button", { name: "Use cloud edits", exact: true })
    .click();
  await expect(
    page.getByText("Saved in demo. No cloud requests.", { exact: true }),
  ).toBeVisible();
  await scenario("error");
  await page
    .locator(".account-settings")
    .getByRole("button", { name: "Try again", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "@demo_learner", exact: true }),
  ).toBeVisible();
  await openAccount(page, "management");
  await page
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Type demo_learner to confirm", exact: true })
    .fill("demo_learner");
  await page
    .getByRole("button", { name: "Permanently delete my account", exact: true })
    .click();
  await expect(
    page.getByText(
      "Demo account deleted. Sample training and your real data are kept.",
      { exact: true },
    ),
  ).toBeVisible();
  await openDemoSettings(page);
  await page
    .getByRole("button", { name: "Reset demo account", exact: true })
    .click();
  await openAccount(page);
  await expect(
    page.getByRole("link", { name: "@demo_learner", exact: true }),
  ).toBeVisible();
  expect(await personalBytes(page)).toEqual(before);
  expect(requests).toEqual([]);
  await openDemoSettings(page);
  await page
    .getByRole("checkbox", { name: "Use demo data", exact: true })
    .uncheck();
  await openAccount(page);
  await expect(
    page.getByRole("button", { name: "Continue with email", exact: true }),
  ).toBeVisible();
  await closeSettings(page);
  expect(await personalBytes(page)).toEqual(before);
});

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  for (const theme of ["light", "dark"]) {
    test(`new-account demo follows email, code and username setup at ${viewport.width}x${viewport.height} in ${theme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      const requests = await demoPage(page, theme);
      const before = await personalBytes(page);
      // The demo signup preview lives with account management.
      await openAccount(page);
      await page
        .getByRole("button", { name: "Preview new account", exact: true })
        .click();
      const email = page.getByRole("textbox", { name: "Email", exact: true });
      const username = page.getByRole("textbox", {
        name: "Choose your username",
        exact: true,
      });
      await expect(email).toBeFocused();
      await expect(username).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: "@demo_learner", exact: true }),
      ).toHaveCount(0);
      await email.fill("new@example.test");
      await page
        .getByRole("button", { name: "Continue with email", exact: true })
        .click();
      const code = page.getByRole("textbox", {
        name: "Email code",
        exact: true,
      });
      await expect(code).toBeFocused();
      await code.fill("000000");
      await page
        .getByRole("button", { name: "Verify code", exact: true })
        .click();
      await expect(page.getByRole("alert")).toContainText("123456");
      await expect(username).toHaveCount(0);
      await code.fill("123 456");
      await page
        .getByRole("button", { name: "Verify code", exact: true })
        .click();
      await expect(username).toBeFocused();
      await expect(
        page.getByText("new@example.test", { exact: true }),
      ).toBeVisible();
      await username.fill("admin");
      const finish = page.getByRole("button", {
        name: "Finish account setup",
        exact: true,
      });
      await finish.click();
      const error = page.getByRole("alert");
      await expect(error).toContainText("reserved");
      const dangerColor =
        theme === "light" ? "rgb(176, 22, 30)" : "rgb(255, 107, 125)";
      await expect(username).toHaveAttribute("aria-invalid", "true");
      await expect(username).toHaveCSS("border-top-color", dangerColor);
      await expect(error).toHaveCSS("color", dangerColor);
      await expect(username).toBeFocused();
      await expect(username).toHaveValue("admin");
      // The input's focus outline must remain visible alongside its error border.
      await expect(username).toHaveCSS("outline-style", "solid");
      await captureScreenshot(page, {
        path: testInfo.outputPath(`username-invalid-${theme}.png`),
        fullPage: true,
      });
      await username.fill("My_New_Account");
      await expect(username).toHaveAttribute("aria-invalid", "false");
      await expect(username).not.toHaveCSS("border-top-color", dangerColor);
      await expect(error).toHaveCount(0);
      await expect(
        page.getByText("@my_new_account", { exact: true }),
      ).toBeVisible();
      for (const control of [username, finish]) {
        await control.scrollIntoViewIfNeeded();
        const bounds = await control.boundingBox();
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
      }
      await captureScreenshot(page, {
        path: testInfo.outputPath(`new-account-${theme}.png`),
        fullPage: true,
      });
      await finish.click();
      await expect(
        page.getByRole("link", { name: "@my_new_account", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Demo Learner", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByText("new@example.test", { exact: true }),
      ).toBeVisible();
      const transfer = page.getByRole("region", {
        name: "Guest progress transfer",
        exact: true,
      });
      await expect(transfer).toBeVisible();
      await transfer
        .getByRole("button", { name: "Keep separate", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Continue learning", exact: true })
        .click();
      await expect(page).toHaveURL(/\/dashboard$/);
      expect(requests).toEqual([]);
      expect(await personalBytes(page)).toEqual(before);
    });
  }
}
