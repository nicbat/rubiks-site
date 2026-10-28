import { test as base, expect } from "@playwright/test";
export const STORAGE_KEY = "last-layer.progress.v2";
export const progressFixture = () => ({
  version: 2,
  selected: ["pll-T", "pll-Ua"],
  variants: {},
  attempts: [],
});
export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    const localOrigin = new URL(baseURL).origin + "/";
    const errors = [],
      external = [],
      failed = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("request", (request) => {
      if (
        !request.url().startsWith(localOrigin) &&
        !request.url().startsWith("blob:")
      )
        external.push(request.url());
    });
    page.on("response", (response) => {
      if (response.status() >= 400)
        failed.push(`${response.status()} ${response.url()}`);
    });
    await use(page);
    expect(errors, "No unhandled errors or console errors").toEqual([]);
    expect(external, "No runtime requests to third-party services").toEqual([]);
    expect(failed, "No failed asset requests").toEqual([]);
  },
});
export { expect };
export async function seed(page, progress = progressFixture()) {
  await page.goto("/#/home");
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: STORAGE_KEY, value: progress },
  );
  await page.reload();
}
export const saved = (page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
export async function openSettings(page) {
  if (await page.locator("#sync-dialog").count())
    await page
      .getByRole("button", { name: "Close sync status", exact: true })
      .click();
  if (!(await page.locator("#settings-dialog").count()))
    await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Settings", exact: true }),
  ).toBeVisible();
}
export async function closeSettings(page) {
  if (await page.locator("#sync-dialog").count())
    await page
      .getByRole("button", { name: "Close sync status", exact: true })
      .click();
  const close = page.getByRole("button", {
    name: "Close settings",
    exact: true,
  });
  if (await close.count()) {
    await close.click();
    await expect(page.locator("#settings-dialog")).toHaveCount(0);
  }
}
export async function openAccount(page, section = "settings") {
  await closeSettings(page);
  if (section === "progress") {
    await openProgress(page);
    return;
  }
  await page
    .getByRole("link", { name: "My profile", exact: true })
    .first()
    .click();
  if (section === "profile") {
    await page.getByRole("link", { name: "Edit profile", exact: true }).click();
    await expect(page).toHaveURL(/#\/account\/profile\/edit$/);
  } else if (section !== "view") {
    await page
      .getByRole("link", { name: "Account settings", exact: true })
      .click();
    await expect(page).toHaveURL(/#\/account$/);
    if (section === "sync")
      await page
        .getByRole("button", { name: "Sync status", exact: true })
        .click();
    if (section === "management")
      await page.getByText("Account deletion", { exact: true }).click();
  }
}
export async function openDataSettings(page) {
  await closeSettings(page);
  await openSettings(page);
  await page
    .getByRole("heading", { name: "Data & backups", exact: true })
    .scrollIntoViewIfNeeded();
}
export async function openProgress(page) {
  await closeSettings(page);
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("button", { name: "Progress", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/progress$/);
}
export async function openLibrary(page, section = "PLL") {
  await closeSettings(page);
  await page
    .getByRole("button", { name: "Algorithm library", exact: true })
    .click();
  await page
    .getByRole("button", { name: new RegExp(`^${section}\\s*(6|10|21|57)$`) })
    .click();
}
export async function importBackup(page, value) {
  await page
    .getByRole("button", { name: "Backup and transfer training data" })
    .click();
  await page.getByLabel("Choose backup file").setInputFiles({
    name: "progress.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      typeof value === "string" ? value : JSON.stringify(value),
    ),
  });
}

export async function holdStartTimer(page) {
  const start = page.getByRole("button", {
    name: "Hold to start (Space)",
    exact: true,
  });
  await start.hover();
  await page.mouse.down();
  await page.clock.runFor(500);
  await expect(page.locator("#timer-status")).toHaveText("Release to start");
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: "Stop timer", exact: true }),
  ).toBeVisible();
}

export async function reviewSolve(page, time) {
  const rows = page.locator(".timer-history").getByRole("button", {
    name: time ? `Review solve ${time}` : /^Review solve /,
    exact: Boolean(time),
  });
  await rows.first().click();
  const dialog = page.getByRole("dialog", {
    name: "Solve details",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  return dialog;
}
export async function deleteReviewedSolve(page) {
  const dialog = page.getByRole("dialog", {
    name: "Solve details",
    exact: true,
  });
  await dialog
    .getByRole("button", { name: "Delete solve", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await dialog
    .getByRole("button", { name: "Delete solve", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
}
