import { test as base, expect } from "@playwright/test";
export const STORAGE_KEY = "last-layer.progress.v1";
export const progressFixture = () => ({
  version: 1,
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
  await page.goto("/");
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: STORAGE_KEY, value: progress },
  );
  await page.reload();
}
export const saved = (page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
export async function openLibrary(page, section = "PLL") {
  await page
    .getByRole("button", { name: "Algorithm library", exact: true })
    .click();
  await page
    .getByRole("button", { name: new RegExp(`^${section}\\s*(6|10|21|57)$`) })
    .click();
}
export async function importBackup(page, value) {
  await page
    .getByRole("button", { name: "Backup and transfer local progress" })
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
