import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { openSettings, closeSettings } from "../e2e/fixtures.js";
import { backendConfig, emailCode } from "../integration/helpers.js";

const config = backendConfig();
async function signIn(page, email) {
  await page.goto("/");
  await openSettings(page);
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page
    .getByRole("button", { name: "Send sign-in email", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Email code", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Email code", exact: true })
    .fill(await emailCode(email));
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Choose your username", exact: true }),
  ).toBeVisible();
}
async function setup(page, username) {
  await page
    .getByRole("textbox", { name: "Choose your username", exact: true })
    .fill(username);
  await page
    .getByRole("button", { name: "Create my page", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: `@${username}`, exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Synced.", { exact: true })).toBeVisible();
}
async function sync(page) {
  await openSettings(page);
  await page.getByRole("button", { name: "Sync now", exact: true }).click();
  await expect(page.getByText("Synced.", { exact: true })).toBeVisible();
}
async function addCube(page, name, upload = true) {
  await openSettings(page);
  await page.getByRole("button", { name: "Cubes", exact: true }).click();
  if ((await page.locator("#cube-editor").getAttribute("open")) === null)
    await page.locator("#cube-editor > summary").click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(name);
  const uploaded = upload
    ? page.waitForResponse(
        async (response) =>
          response.url().endsWith("/rest/v1/rpc/save_training_snapshot") &&
          response.ok() &&
          response
            .request()
            .postDataJSON()
            ?.payload?.cubeCollection?.cubes.some(
              (cube) => cube.name === name,
            ) &&
          Number.isSafeInteger(await response.json()),
      )
    : null;
  await page.getByRole("button", { name: "Add cube", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  if (uploaded) await uploaded;
}

test.beforeEach(async ({ context }) => {
  // Allow real requests only to this test's local app and local Supabase.
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (
      url.startsWith("blob:") ||
      ["http://127.0.0.1:4176", config.url].includes(new URL(url).origin)
    )
      return route.continue();
    throw Error("Unexpected external request in isolated integration test.");
  });
});

test("real email sign-in, required username, profile visibility, reload and deletion", async ({
  page,
  browser,
}) => {
  const id = randomUUID().replaceAll("-", "").slice(0, 12);
  const username = `browser_${id}`;
  await signIn(page, `${username}@example.test`);
  await setup(page, username);
  await page
    .getByRole("textbox", { name: "Display name", exact: true })
    .fill("Browser Learner");
  await page
    .getByRole("textbox", { name: "Bio", exact: true })
    .fill("Saved through the real Data API.");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByText("Profile saved.", { exact: true })).toBeVisible();
  await page.reload();
  await openSettings(page);
  await expect(
    page.getByRole("textbox", { name: "Bio", exact: true }),
  ).toHaveValue("Saved through the real Data API.");
  const visitor = await browser.newContext();
  try {
    const anon = await visitor.newPage();
    await anon.goto(`http://127.0.0.1:4176/#/u/${username}`);
    await expect(
      anon.getByText("This profile is unavailable.", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Make profile public", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Make profile private", exact: true }),
    ).toBeVisible();
    await anon.reload();
    await expect(
      anon.getByRole("heading", { name: "Browser Learner", exact: true }),
    ).toBeVisible();
    await expect(anon.locator(".profile-stats")).toHaveCount(0);
    await page
      .getByRole("checkbox", {
        name: "Show statistics on my public profile",
        exact: true,
      })
      .check();
    await page
      .getByRole("button", { name: "Save profile", exact: true })
      .click();
    await expect(
      page.getByText("Profile saved.", { exact: true }),
    ).toBeVisible();
    await anon.reload();
    await expect(anon.locator(".profile-stats")).toBeVisible();
    await page
      .getByRole("button", { name: "Delete account", exact: true })
      .click();
    await page
      .getByRole("textbox", {
        name: `Type ${username} to confirm`,
        exact: true,
      })
      .fill(username);
    await page
      .getByRole("button", {
        name: "Permanently delete my account",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", { name: "Send sign-in email", exact: true }),
    ).toBeVisible();
    await anon.reload();
    await expect(
      anon.getByText("This profile is unavailable.", { exact: true }),
    ).toBeVisible();
    await anon.goto("http://127.0.0.1:4176/#/u/local_friend");
    await expect(
      anon.getByRole("heading", { name: "Local Friend", exact: true }),
    ).toBeVisible();
  } finally {
    await visitor.close();
  }
});

test("two browser contexts upload real changes, preserve offline work and reconcile after reconnect", async ({
  page,
  browser,
}) => {
  const id = randomUUID().replaceAll("-", "").slice(0, 12);
  await signIn(page, `devices-${id}@example.test`);
  await setup(page, `devices_${id}`);
  const authKey = `last-layer.auth.${new URL(config.url).host}`;
  // Reuse the verified login, as a saved authenticated Playwright state; training
  // and sync metadata are deliberately absent on the second fresh device.
  const auth = await page.evaluate((key) => localStorage.getItem(key), authKey);
  expect(auth).not.toBeNull();
  const other = await browser.newContext();
  try {
    await other.addInitScript(
      ({ key, value }) => localStorage.setItem(key, value),
      { key: authKey, value: auth },
    );
    const second = await other.newPage();
    await second.goto("http://127.0.0.1:4176/");
    await sync(second);
    await closeSettings(second);
    await addCube(page, "First device cube");
    await sync(page);
    await sync(second);
    await second.getByRole("button", { name: "Cubes", exact: true }).click();
    await expect(
      second.getByRole("heading", { name: "First device cube", exact: true }),
    ).toBeVisible();
    await other.setOffline(true);
    await addCube(second, "Offline device cube", false);
    await addCube(page, "Online device cube");
    await sync(page);
    await other.setOffline(false);
    await sync(second);
    await sync(page);
    await page.getByRole("button", { name: "Cubes", exact: true }).click();
    for (const name of [
      "First device cube",
      "Offline device cube",
      "Online device cube",
    ])
      await expect(
        page.getByRole("heading", { name, exact: true }),
      ).toBeVisible();
  } finally {
    await other.close();
  }
});
