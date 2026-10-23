import {
  test,
  expect,
  openSettings,
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
  await page.goto("/#/account");
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
            'input:not([aria-hidden="true"]),textarea,button,label',
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
      await expect(page.locator(".profile-stats")).toBeVisible();
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
        .getByRole("textbox", { name: "Look up a username" })
        .fill("demo_private");
      await page
        .getByRole("button", { name: "View profile", exact: true })
        .click();
      await expect(
        page.getByText("This profile is unavailable.", { exact: true }),
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
  async function scenario(value, section = "overview") {
    await openSettings(page);
    await page
      .getByLabel("Demo account state", { exact: true })
      .selectOption(value);
    await openAccount(page, section);
  }
  await scenario("signed-out", "overview");
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("contributor@example.test");
  await page
    .getByRole("button", { name: "Send sign-in email", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Email code", exact: true })
    .fill("123456");
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await expect(
    page.getByText("contributor@example.test", { exact: true }),
  ).toBeVisible();
  await scenario("setup", "overview");
  await page
    .getByRole("textbox", { name: "Choose your username" })
    .fill("dev_learner");
  await page
    .getByRole("button", { name: "Create my page", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "@dev_learner", exact: true }),
  ).toBeVisible();
  await scenario("offline", "sync");
  await page.getByRole("button", { name: "Check sync", exact: true }).click();
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
  await scenario("error", "overview");
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
  await openSettings(page);
  await page
    .getByRole("button", { name: "Reset demo account", exact: true })
    .click();
  await openAccount(page);
  await expect(
    page.getByRole("link", { name: "@demo_learner", exact: true }),
  ).toBeVisible();
  expect(await personalBytes(page)).toEqual(before);
  expect(requests).toEqual([]);
  await openSettings(page);
  await page
    .getByRole("checkbox", { name: "Enable test data", exact: true })
    .uncheck();
  await openAccount(page);
  await expect(
    page.getByRole("button", { name: "Send sign-in email", exact: true }),
  ).toBeVisible();
  await closeSettings(page);
  expect(await personalBytes(page)).toEqual(before);
});
