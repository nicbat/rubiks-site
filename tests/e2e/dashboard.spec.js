import { test, expect } from "./fixtures.js";

const panel = (page, name) => page.getByRole("region", { name, exact: true });

test("a new learner picks a first path from the dashboard", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
  const next = panel(page, "Where do you want to start?");
  await expect(next.getByRole("heading", { level: 3 })).toHaveText([
    "New to the cube?",
    "Already solving?",
  ]);
  await expect(next.getByRole("button", { name: /Open CFOP/ })).toBeVisible();
  await next.getByRole("button", { name: /Start Beginner/ }).click();
  await expect(page).toHaveURL(/\/courses\/beginner\//);
});

test("a returning learner continues the active course", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "last-layer.preferences.v1",
      JSON.stringify({ testData: true }),
    ),
  );
  await page.goto("/dashboard");
  const step = page.getByRole("button", { name: /^Continue / });
  await expect(step).toBeVisible();
  await expect(
    page.getByRole("img", { name: /sections complete$/ }),
  ).toBeVisible();
  await step.click();
  await expect(page).not.toHaveURL(/\/dashboard$/);
});

test("today's numbers count today's solves, the streak and the best time", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-17T12:00:00") });
  await page.goto("/dashboard");
  await page.evaluate(() => {
    const solve = (id, day, elapsed, penalty) => ({
      id,
      cubeId: null,
      elapsed,
      date: `${day}T10:00:00Z`,
      day,
      scramble: Array(10).fill("R U").join(" "),
      ...(penalty ? { penalty } : {}),
    });
    localStorage.setItem(
      "last-layer.solves.v1",
      JSON.stringify([
        solve("yesterday", "2026-10-16", 50000),
        solve("plus-two", "2026-10-17", 30000, "+2"),
        solve("plain", "2026-10-17", 45000),
        solve("dnf", "2026-10-17", 20000, "dnf"),
      ]),
    );
  });
  await page.reload();
  const today = panel(page, "Today");
  const value = (label) =>
    today.locator("div").filter({ hasText: label }).locator("dd");
  await expect(value("Practice attempts")).toHaveText("0");
  await expect(value("Day streak")).toHaveText("2");
  // The +2 solve is the best; the DNF does not count.
  await expect(value("Best solve")).toHaveText("32.00");
});

test("the case of the day opens its case and returns focus", async ({
  page,
}) => {
  await page.goto("/dashboard");
  const view = page.getByRole("button", { name: /View case/ });
  const name = await page
    .locator(".dashboard-case")
    .getByRole("heading", { level: 2 })
    .textContent();
  await view.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(name);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(view).toBeFocused();
});

test("quick actions open their destinations", async ({ page }) => {
  await page.goto("/dashboard");
  const actions = page.getByRole("navigation", { name: "Quick actions" });
  for (const [name, url] of [
    ["Hidden practice", /\/home$/],
    ["Start timer", /\/timer$/],
    ["Algorithm library", /\/library\//],
    ["PLL quiz", /\/pll-quiz$/],
  ]) {
    await actions.getByRole("button", { name: new RegExp(`^${name}`) }).click();
    await expect(page).toHaveURL(url);
    await page.goto("/dashboard");
  }
});
