import {
  test,
  expect,
  openAccount,
  openSettings,
  closeSettings,
  seed,
} from "./fixtures.js";

test("legacy Progress URLs canonicalize without an extra Back entry and retain Settings", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await page.evaluate(() => {
    location.hash = "/progress?settings";
  });
  await expect(page).toHaveURL(/#\/account\/progress\?settings$/);
  await expect(
    page.getByRole("dialog", { name: "Settings", exact: true }),
  ).toBeVisible();
  await closeSettings(page);
  await expect(
    page.getByRole("heading", { name: "Progress", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#\/timer$/);
  await page.goForward();
  await expect(page).toHaveURL(/#\/account\/progress$/);
});

test("Settings backup returns to its opener without changing hidden practice", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("button", { name: "Start hidden practice" }).click();
  const moves = await page
    .getByLabel("Setup moves", { exact: true })
    .textContent();
  await openSettings(page);
  const opener = page
    .getByRole("dialog", { name: "Settings", exact: true })
    .getByRole("button", { name: "Backup & transfer", exact: true });
  await opener.click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(
    page.getByRole("dialog", { name: "Backup & transfer", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await closeSettings(page);
  await expect(page.getByLabel("Setup moves", { exact: true })).toHaveText(
    moves,
  );
  await expect(
    page.getByRole("button", { name: /Ready to recognize/ }),
  ).toBeVisible();
  await expect(page.locator(".practice-panel .case-diagram")).toHaveCount(0);
});

for (const theme of ["light", "dark"])
  for (const viewport of [
    { width: 320, height: 720 },
    { width: 667, height: 375 },
  ]) {
    test(`Account sections, drafts and visitor preview at ${viewport.width}x${viewport.height} in ${theme}`, async ({
      page,
    }, info) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.clock.install({ time: new Date("2026-10-17T19:00:00Z") });
      await page.addInitScript(
        ({ theme }) => {
          localStorage.setItem("last-layer-theme", theme);
          localStorage.setItem(
            "last-layer.preferences.v1",
            JSON.stringify({ testData: true }),
          );
          localStorage.setItem(
            "last-layer.account.personal.last-layer.progress.v2",
            "private storage canary",
          );
        },
        { theme },
      );
      await page.goto("/#/account");
      const sections = page.getByRole("navigation", {
        name: "Account sections",
        exact: true,
      });
      await expect(sections.getByRole("link")).toHaveCount(4);
      await expect(
        page.getByRole("heading", { name: "Activity heatmap", exact: true }),
      ).toBeVisible();
      await page.screenshot({ path: info.outputPath("account-overview.png") });
      await sections
        .getByRole("link", { name: "Profile", exact: true })
        .click();
      const preview = page.getByRole("region", {
        name: "Visitor preview",
        exact: true,
      });
      await expect(
        preview.getByText("This profile is unavailable.", { exact: true }),
      ).toBeVisible();
      await expect(preview.locator(".profile-stats")).toHaveCount(0);
      const bio = page.getByRole("textbox", { name: "Bio", exact: true });
      const draft = "Unsaved " + "long_bio_".repeat(28);
      await bio.fill(draft);
      await page
        .getByRole("textbox", { name: "Display name", exact: true })
        .fill("Learner".repeat(8));
      await expect(
        page.getByText("You have unsaved profile changes.", { exact: true }),
      ).toBeVisible();
      await sections
        .getByRole("link", { name: "Sync and data", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Delete account", exact: true })
        .click();
      await expect(
        page.getByRole("textbox", {
          name: "Type demo_learner to confirm",
          exact: true,
        }),
      ).toBeFocused();
      await page
        .getByRole("button", { name: "Keep account", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Delete account", exact: true }),
      ).toBeFocused();
      await sections
        .getByRole("link", { name: "Profile", exact: true })
        .click();
      await expect(bio).toHaveValue(draft);
      await page
        .getByRole("button", { name: "Make profile public", exact: true })
        .click();
      await expect(
        preview.getByText("Practising a little every day.", { exact: true }),
      ).toBeVisible();
      await expect(preview.getByText(draft, { exact: true })).toHaveCount(0);
      await page
        .getByRole("checkbox", {
          name: "Show statistics on my public profile",
          exact: true,
        })
        .check();
      await expect(preview.locator(".profile-stats")).toHaveCount(0);
      await page
        .getByRole("button", { name: "Save profile", exact: true })
        .click();
      await expect(preview.getByText(draft, { exact: true })).toBeVisible();
      await expect(preview.locator(".profile-stats")).toBeVisible();
      const bounds = await page.locator(".account-workspace").evaluate((root) =>
        [
          ...root.querySelectorAll(
            'input:not([aria-hidden="true"]),textarea,button,a,h1,h2,h3,p,dt,dd',
          ),
        ]
          .filter((el) => el.getClientRects().length)
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {
              left: r.left,
              right: r.right,
              height: r.height,
              control: el.matches("input,textarea,button,a"),
              font: parseFloat(getComputedStyle(el).fontSize),
              field: el.matches("input,textarea"),
            };
          }),
      );
      for (const b of bounds) {
        expect(b.left).toBeGreaterThanOrEqual(0);
        expect(b.right).toBeLessThanOrEqual(viewport.width);
        if (b.control) expect(b.height).toBeGreaterThanOrEqual(44);
        if (b.field) expect(b.font).toBeGreaterThanOrEqual(16);
      }
      await bio.scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath("account-profile.png") });
      await openAccount(page, "progress");
      await page.getByRole("button", { name: "Solves", exact: true }).click();
      await page.getByRole("button", { name: "Account", exact: true }).click();
      await sections
        .getByRole("link", { name: "Progress", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Solves", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await openSettings(page);
      await expect(
        page.locator("#settings-dialog #profile-edit-form"),
      ).toHaveCount(0);
      const backup = page
        .getByRole("dialog", { name: "Settings", exact: true })
        .getByRole("button", { name: "Backup & transfer", exact: true });
      await backup.scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath("account-settings.png") });
      await closeSettings(page);
      expect(
        await page.evaluate(() =>
          localStorage.getItem(
            "last-layer.account.personal.last-layer.progress.v2",
          ),
        ),
      ).toBe("private storage canary");
    });
  }
