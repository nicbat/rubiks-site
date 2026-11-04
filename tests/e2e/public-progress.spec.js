import { captureScreenshot } from "./screenshots.js";
import { test, expect, seed } from "./fixtures.js";

async function expectProfileBounds(page, width) {
  for (const control of await page
    .locator("main a, main button, main input:not([type=hidden])")
    .all()) {
    if (!(await control.isVisible())) continue;
    await control.scrollIntoViewIfNeeded();
    const bounds = await control.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
}

async function expectWorkspaceHeader(page, width) {
  const header = page.locator("main .personal-workspace-header");
  await expect(header).toHaveCount(1);
  const tabs = header.getByRole("navigation", { name: "Your workspace" });
  await expect(tabs.getByRole("link")).toHaveText(["Profile", "Progress"]);
  await expect(tabs.locator('[aria-current="page"]')).toHaveCount(1);
  const layout = await header.evaluate((root) => {
    const rect = (el) => el.getBoundingClientRect().toJSON();
    return {
      title: rect(root.querySelector("h1")),
      tabs: rect(root.querySelector("nav")),
      content: [...root.querySelectorAll("h1,p,a,button")].map(rect),
      links: [...root.querySelectorAll("nav a")].map((el) => {
        const style = getComputedStyle(el);
        return {
          frame: parseFloat(style.borderLeftWidth),
          background: style.backgroundImage,
          height: el.getBoundingClientRect().height,
        };
      }),
    };
  });
  expect(layout.tabs.top).toBeGreaterThanOrEqual(layout.title.bottom);
  for (const bounds of layout.content) {
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(width);
  }
  for (const link of layout.links) {
    expect(link.frame, "page tabs have no button frame").toBe(0);
    expect(link.background, "page tabs have no key background").toBe("none");
    expect(link.height).toBeGreaterThanOrEqual(44);
  }
}

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
      const workspace = page.getByRole("navigation", {
        name: "Your workspace",
      });
      await expectWorkspaceHeader(page, viewport.width);
      await workspace
        .getByRole("link", { name: "Progress", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Progress", exact: true }),
      ).toBeVisible();
      await expect(
        workspace.getByRole("link", { name: "Progress", exact: true }),
      ).toHaveAttribute("aria-current", "page");
      await expectWorkspaceHeader(page, viewport.width);
      await workspace
        .getByRole("link", { name: "Profile", exact: true })
        .click();
      await expectProfileBounds(page, viewport.width);
      await captureScreenshot(page, {
        path: info.outputPath("personal-profile.png"),
        fullPage: true,
      });
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
      await expect(lookup).toBeFocused();
      await lookup.fill("demo_friend");
      await page.keyboard.press("Escape");
      await expect(page).toHaveURL(/\/account\/profile$/);
      await expect(
        page.getByRole("link", { name: "Find a learner", exact: true }),
      ).toBeFocused();
      await page
        .getByRole("link", { name: "Find a learner", exact: true })
        .click();
      await expect(lookup).toHaveValue("demo_friend");
      await expect(lookup).toBeFocused();
      await expectProfileBounds(page, viewport.width);
      await lookup.focus();
      await captureScreenshot(page, {
        path: info.outputPath("profile-lookup.png"),
        fullPage: true,
      });
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
      await page
        .getByRole("link", { name: "Back to lookup", exact: true })
        .click();
      await expect(lookup).toBeFocused();
      await expect(lookup).toHaveValue("demo_friend");
      await lookup.press("Enter");
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
      await expectProfileBounds(page, viewport.width);
      await page.goBack();
      await expect(
        page.getByRole("heading", { name: "Find a learner", exact: true }),
      ).toBeVisible();
      await expect(lookup).toBeFocused();
      await expect(lookup).toHaveValue("demo_private");
      await page.goBack();
      await expect(
        page.getByRole("heading", { name: "Demo Friend", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("link", { name: "Back to my profile", exact: true })
        .click();
      await expect(
        page.getByRole("link", { name: "Find a learner", exact: true }),
      ).toBeFocused();
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
      const preview = page.getByRole("group", {
        name: "Visitor preview",
        exact: true,
      });
      await expect(preview).toContainText("Demo Learner");
      await expect(preview).not.toContainText("Private draft bio");
      await expect(preview).toContainText("Statistics are private.");
      await page
        .getByRole("button", { name: "Make stats public", exact: true })
        .click();
      await expect(
        preview.getByRole("group", { name: "Activity summary", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Make stats private", exact: true })
        .click();
      await expect(
        preview.getByRole("group", { name: "Activity summary", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("textbox", { name: "Display name", exact: true }),
      ).toHaveValue("Unsaved learner name");
    });

    test(`guest profile and legacy lookup return to private progress at ${viewport.width}x${viewport.height} in ${theme}`, async ({
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
      await expect(
        page.getByRole("textbox", { name: "Email", exact: true }),
      ).toBeVisible();
      const find = page.getByRole("link", {
        name: "Find a learner",
        exact: true,
      });
      await expect(find).toBeFocused();
      await expectWorkspaceHeader(page, viewport.width);
      await expectProfileBounds(page, viewport.width);
      await captureScreenshot(page, {
        path: info.outputPath("guest-profile.png"),
        fullPage: true,
      });
      await page
        .getByRole("navigation", { name: "Your workspace" })
        .getByRole("link", { name: "Progress", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Progress", exact: true }),
      ).toBeVisible();
      await expectWorkspaceHeader(page, viewport.width);
      await expect(
        page.getByRole("heading", { name: "Your cases", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: "Email", exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("navigation", { name: "Your workspace" })
        .getByRole("link", { name: "Profile", exact: true })
        .click();
      await find.click();
      await expect(lookup).toBeFocused();
      await expect(lookup).toHaveValue("learner_123");
      await page.goBack();
      await expect(find).toBeFocused();
      await page.goForward();
      await expect(lookup).toBeFocused();
      await expect(lookup).toHaveValue("learner_123");
    });
  }
