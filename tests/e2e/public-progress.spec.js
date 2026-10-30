import { captureScreenshot } from "./screenshots.js";
import { test, expect } from "./fixtures.js";

for (const theme of ["light", "dark"])
  for (const viewport of [
    { width: 320, height: 720 },
    { width: 667, height: 375 },
  ]) {
    test(`find a learner and read only their summary at ${viewport.width}x${viewport.height} in ${theme}`, async ({
      page,
    }, info) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript(
        ({ theme }) => {
          localStorage.setItem("last-layer-theme", theme);
          localStorage.setItem(
            "last-layer.preferences.v1",
            JSON.stringify({ testData: true }),
          );
        },
        { theme },
      );
      await page.goto("/account/profile");
      await expect(
        page.getByRole("heading", { name: "Demo Learner", exact: true }),
      ).toBeVisible();
      await expect(
        page
          .getByRole("navigation", { name: "Main navigation" })
          .getByRole("button"),
      ).toHaveText([
        "Dashboard",
        "My learning",
        "Courses",
        "Progress",
        "Timer",
        "About",
      ]);
      await page
        .getByRole("link", { name: "Find a learner", exact: true })
        .click();
      await expect(page).toHaveURL(/\/people$/);
      const lookup = page.getByRole("textbox", {
        name: "Look up a username",
        exact: true,
      });
      await lookup.fill("demo_friend");
      await lookup.press("Enter");
      await expect(page).toHaveURL(/\/u\/demo_friend$/);
      await expect(
        page.getByRole("heading", { name: "Demo Friend", exact: true }),
      ).toBeVisible();
      await expect(page.getByText(/Full CFOP confidence/)).toContainText(
        "Demo training",
      );
      const activity = page.getByRole("group", {
        name: "Activity summary",
        exact: true,
      });
      const timer = page.getByRole("group", {
        name: "Timer summary",
        exact: true,
      });
      await expect(activity).toContainText("320");
      await expect(timer).toContainText("240");
      await expect(
        page.getByRole("heading", { name: "All-time progress", exact: true }),
      ).toBeVisible();
      await expect(
        page.locator(
          "#profile-lookup-form, .activity-heatmap, .daily-solves, .case-map",
        ),
      ).toHaveCount(0);
      for (const group of [activity, timer]) {
        await group.scrollIntoViewIfNeeded();
        const bounds = await group
          .locator("strong, span")
          .evaluateAll((nodes) =>
            nodes.map((el) => {
              const rect = el.getBoundingClientRect();
              return { left: rect.left, right: rect.right };
            }),
          );
        for (const bound of bounds) {
          expect(bound.left).toBeGreaterThanOrEqual(0);
          expect(bound.right).toBeLessThanOrEqual(viewport.width);
        }
      }
      const find = page.getByRole("link", {
        name: "Find a learner",
        exact: true,
      });
      expect((await find.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await captureScreenshot(page, {
        path: info.outputPath("public-summary.png"),
        fullPage: true,
      });
      await find.click();
      await lookup.fill("demo_private");
      await page
        .getByRole("button", { name: "View profile", exact: true })
        .click();
      await expect(
        page.getByText("Statistics are private.", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("group", { name: "Activity summary", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("heading", {
          name: "Private Stats Learner",
          exact: true,
        }),
      ).toBeVisible();
      const privateBounds = await page.locator(".profile-page").boundingBox();
      expect(privateBounds.x).toBeGreaterThanOrEqual(0);
      expect(privateBounds.x + privateBounds.width).toBeLessThanOrEqual(
        viewport.width,
      );
      await captureScreenshot(page, {
        path: info.outputPath("private-stats-profile.png"),
        fullPage: true,
      });
      await page.goBack();
      await expect(
        page.getByRole("heading", { name: "Find a learner", exact: true }),
      ).toBeVisible();
      await page.goBack();
      await expect(
        page.getByRole("heading", { name: "Demo Friend", exact: true }),
      ).toBeVisible();
    });
  }
