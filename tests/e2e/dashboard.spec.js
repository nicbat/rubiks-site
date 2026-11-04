import { test, expect, seed, saved, openProgress } from "./fixtures.js";
import { captureScreenshot } from "./screenshots.js";

const navigation = (page) =>
  page.getByRole("navigation", { name: "Main navigation" });

test("My learning is the single landing destination and preserves old links and history", async ({
  page,
}) => {
  for (const path of ["/", "/dashboard", "/home", "/#/dashboard", "/#/home"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/home$/);
    await expect(navigation(page).getByRole("button")).toHaveText([
      "My learning",
      "Courses",
      "Profile",
      "Timer",
      "About",
    ]);
    await expect(
      navigation(page).getByRole("button", {
        name: "My learning",
        exact: true,
      }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("heading", { name: "Continue learning", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(".study-card, .learning-starter, #practice-method"),
    ).toHaveCount(0);
    await expect(page.locator(".dashboard-today")).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Quick actions" }),
    ).toBeVisible();
  }
  await page
    .getByRole("button", { name: "View progress", exact: true })
    .click();
  await expect(page).toHaveURL(/\/progress$/);
  await expect(
    page.getByRole("heading", { name: "Activity heatmap" }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/home$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/progress$/);
  await page.getByRole("link", { name: "Last Layer" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "My learning", exact: true }),
  ).toHaveCount(1);
});

test("a new learner can start Beginner or CFOP without duplicate course panels", async ({
  page,
}) => {
  await page.goto("/home");
  await expect(
    page.getByRole("button", { name: "Open CFOP", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Start Beginner", exact: true })
    .click();
  await expect(page).toHaveURL(/\/courses\/beginner\//);
  await navigation(page)
    .getByRole("button", { name: "My learning", exact: true })
    .click();
  const resume = page.getByRole("group", { name: "Beginner", exact: true });
  await expect(
    resume.getByRole("button", { name: "Continue course" }),
  ).toHaveCount(1);
  await resume.getByRole("button", { name: "Continue course" }).click();
  await expect(page).toHaveURL(/\/courses\/beginner\//);
});

test("recent activity combines local dates and penalties, and tools retain their destinations", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-17T12:00:00") });
  await seed(page);
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
        solve("dnf", "2026-10-17", 20000, "dnf"),
      ]),
    );
  });
  await page.reload();
  await navigation(page)
    .getByRole("button", { name: "My learning", exact: true })
    .click();
  const recent = page.getByRole("region", {
    name: "Recent activity",
    exact: true,
  });
  await expect(page.locator(".dashboard-today dd")).toHaveText([
    "0",
    "2",
    "32.00",
  ]);
  await expect(recent.getByRole("listitem").first()).toHaveText(
    /2026-10-17.*0 practice attempts · 2 solves/,
  );
  const original = await saved(page);
  const tools = page.getByRole("navigation", { name: "Quick actions" });
  const viewCase = page
    .locator(".dashboard-case")
    .getByRole("button", { name: "View case", exact: true });
  await viewCase.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(viewCase).toBeFocused();
  for (const [name, url] of [
    ["Start timer", /\/timer$/],
    ["Browse algorithms", /\/library\//],
    ["PLL quiz", /\/pll-quiz$/],
  ]) {
    await tools.getByRole("button", { name, exact: true }).click();
    await expect(page).toHaveURL(url);
    await navigation(page)
      .getByRole("button", { name: "My learning", exact: true })
      .click();
  }
  expect(await saved(page)).toEqual(original);
});

for (const theme of ["light", "dark"])
  for (const viewport of [
    { width: 320, height: 720 },
    { width: 667, height: 375 },
  ])
    test(`consolidated learning actions fit ${viewport.width}x${viewport.height} ${theme}`, async ({
      page,
    }, info) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript(
        (theme) => localStorage.setItem("last-layer-theme", theme),
        theme,
      );
      await seed(page);
      const before = await saved(page);
      await navigation(page)
        .getByRole("button", { name: "My learning", exact: true })
        .click();
      for (const control of await page
        .locator("main button, main [role='combobox']")
        .all()) {
        await control.scrollIntoViewIfNeeded();
        const box = await control.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(-1);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      await captureScreenshot(page, {
        path: info.outputPath("my-learning.png"),
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Open learning set", exact: true })
        .click();
      await expect(page).toHaveURL(/\/home\/study$/);
      await expect(page.locator(".study-card")).toBeVisible();
      await page.goBack();
      await expect(page).toHaveURL(/\/home$/);
      const practice = page
        .getByRole("navigation", { name: "Quick actions" })
        .getByRole("button", { name: /^Hidden practice/ });
      await practice.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/home\/practice$/);
      await expect(
        page.getByRole("combobox", { name: "Practice method", exact: true }),
      ).toBeVisible();
      await expect(page.locator(".study-card, .dashboard-case")).toHaveCount(0);
      await page.reload();
      for (const control of await page
        .locator("main button, main [role='combobox']")
        .all()) {
        await control.scrollIntoViewIfNeeded();
        const box = await control.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(-1);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      await page.getByRole("button", { name: "Start hidden practice" }).click();
      await expect(page).toHaveURL(/\/practice$/);
      await expect(
        page.locator(
          ".answer-diagram, .trainer .algorithm, .trainer .case-occurrence",
        ),
      ).toHaveCount(0);
      expect(await saved(page)).toEqual(before);
      await page
        .getByRole("button", { name: "End practice", exact: true })
        .click();
      await expect(page).toHaveURL(/\/home\/practice$/);
      await openProgress(page);
      await expect(
        page.getByRole("heading", { name: "Activity heatmap" }),
      ).toBeVisible();
    });
