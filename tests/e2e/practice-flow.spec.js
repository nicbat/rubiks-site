import { captureScreenshot } from "./screenshots.js";
import { test, expect, seed, saved, openLibrary } from "./fixtures.js";

async function choose(page, label, option) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

for (const source of ["library", "cfop"])
  for (const custom of [false, true])
    test(`${source} ${custom ? "custom" : "direct"} practice returns to its filters, scroll and opener`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 600 });
      await seed(page);
      await page.goto(`/#/${source}/pll/two-look`);
      await choose(page, "Filter by group", "2. Position edges");
      await choose(page, "Learning status", "Unlearned");
      const search = page.getByRole("searchbox", { name: "Search cases" });
      await search.fill("Ua");
      const before = await saved(page);
      const opener = page.getByRole("button", {
        name: custom ? "Choose cases…" : "Practice shown (1)",
        exact: true,
      });
      await opener.scrollIntoViewIfNeeded();
      await opener.focus();
      const scroll = await page.evaluate(() => scrollY);
      await opener.press("Enter");
      if (custom) {
        const dialog = page.getByRole("dialog", {
          name: "Choose cases to practice",
          exact: true,
        });
        await dialog
          .getByRole("checkbox", { name: "Ua perm", exact: true })
          .click();
        await dialog
          .getByRole("button", { name: "Practice selected (1)", exact: true })
          .click();
      }
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "Set up & solve", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Ready to recognize" }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Try another setup", exact: true })
        .click();
      expect(await saved(page)).toEqual(before);
      await page
        .getByRole("button", { name: "Reveal answer", exact: true })
        .click();
      await expect(page.locator(".trainer h1")).toHaveText("Ua perm");
      await expect(
        page.getByRole("button", { name: "Needed help", exact: true }),
      ).toBeFocused();
      await page
        .getByRole("button", { name: "Solved with effort", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Reveal answer", exact: true }),
      ).toBeVisible();
      const after = await saved(page);
      expect(after.selected).toEqual(before.selected);
      expect(after.attempts).toHaveLength(1);
      expect(after.attempts[0]).toMatchObject({
        caseId: "pll-Ua",
        method: "two-look",
        result: "effort",
      });
      await page
        .getByRole("button", { name: "End practice", exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`#/${source}/pll/two-look$`));
      await expect(search).toHaveValue("Ua");
      await expect(
        page.getByRole("combobox", { name: "Filter by group", exact: true }),
      ).toContainText("2. Position edges");
      await expect(
        page.getByRole("combobox", { name: "Learning status", exact: true }),
      ).toContainText("Unlearned");
      await expect(opener).toBeFocused();
      await expect
        .poll(() => page.evaluate(() => scrollY))
        .toBeCloseTo(scroll, 0);
      if (source === "cfop")
        await expect(
          page.getByRole("button", { name: "Two-look", exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
      else
        await expect(
          page.getByRole("combobox", { name: "Learning method", exact: true }),
        ).toContainText("2-look");
    });

test("direct practice includes collapsed matching groups and disables empty starts", async ({
  page,
}) => {
  await seed(page);
  await openLibrary(page, "OLL");
  await choose(page, "Filter by group", "Square Shape");
  const group = page.getByRole("button", { name: /Square Shape.*learned/ });
  await group.click();
  await expect(group).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("button", { name: "View OLL 5", exact: true }),
  ).toBeHidden();
  await page.evaluate(() => {
    crypto.getRandomValues = (array) => {
      array.fill(0);
      return array;
    };
  });
  await page
    .getByRole("button", { name: "Practice shown (2)", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Reveal answer", exact: true })
    .click();
  await expect(page.locator(".trainer h1")).toHaveText("OLL 5");
  await page.getByRole("button", { name: "End practice", exact: true }).click();
  await expect(group).toHaveAttribute("aria-expanded", "false");
  await page
    .getByRole("searchbox", { name: "Search cases" })
    .fill("missing case");
  await expect(
    page.getByRole("button", { name: "Practice shown (0)", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Choose cases…", exact: true }),
  ).toBeDisabled();
});

for (const helped of [false, true])
  test(`a failed ${helped ? "helped" : "normal"} rating preserves the answer and retries once`, async ({
    page,
  }) => {
    await seed(page);
    const before = await saved(page);
    await page
      .getByRole("button", { name: "Start hidden practice", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: helped ? "Need help" : "Reveal answer",
        exact: true,
      })
      .click();
    const answer = await page.locator(".trainer h1").textContent();
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      window.ratingWrites = 0;
      Storage.prototype.setItem = function (key, value) {
        if (key === "last-layer.progress.v2" && ++window.ratingWrites === 1)
          throw new DOMException("Full", "QuotaExceededError");
        return original.call(this, key, value);
      };
    });
    const rating = page.getByRole("button", {
      name: helped ? "Needed help" : "Solved with effort",
      exact: true,
    });
    await rating.click();
    await expect(page.getByRole("alert")).toContainText(
      "could not save progress",
    );
    await expect(page.locator(".trainer h1")).toHaveText(answer);
    await expect(page.locator(".practice-top")).toContainText("0 completed");
    expect(await saved(page)).toEqual(before);
    if (helped)
      await expect(
        page.getByRole("button", {
          name: "Recognized & solved confidently",
          exact: true,
        }),
      ).toBeDisabled();
    await rating.click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.locator(".practice-top")).toContainText("1 completed");
    await expect(
      page.getByRole("button", { name: "Reveal answer", exact: true }),
    ).toBeVisible();
    const after = await saved(page);
    expect(after.attempts).toHaveLength(1);
    expect(after.attempts[0]).toMatchObject({
      result: helped ? "help" : "effort",
      mode: "recognition",
    });
    expect(await page.evaluate(() => window.ratingWrites)).toBe(2);
  });

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
])
  for (const colorScheme of ["light", "dark"])
    test(`direct practice and reveal fit ${viewport.width}×${viewport.height} in ${colorScheme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await seed(page);
      await openLibrary(page, "OLL");
      await page.getByRole("searchbox", { name: "Search cases" }).fill("OLL 5");
      async function fits(locator) {
        for (const element of await locator.all()) {
          await element.evaluate((el) =>
            el.scrollIntoView({
              block: "center",
              inline: "center",
              behavior: "instant",
            }),
          );
          const box = await element.boundingBox();
          expect(box.x).toBeGreaterThanOrEqual(-1);
          expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
          expect(
            await element.evaluate(
              (el) => el.scrollWidth <= el.clientWidth + 1,
            ),
          ).toBe(true);
          if (await element.evaluate((el) => el.tagName === "BUTTON")) {
            expect(box.width).toBeGreaterThanOrEqual(44);
            expect(box.height).toBeGreaterThanOrEqual(44);
          }
        }
      }
      await fits(page.locator(".library-heading-actions button"));
      await page
        .getByRole("button", { name: "Practice shown (1)", exact: true })
        .click();
      await fits(
        page.locator(
          ".trainer .scramble, .trainer button, .practice-top button",
        ),
      );
      const setup = page.getByLabel("Setup moves", { exact: true });
      const moves = await setup.textContent();
      await page
        .getByRole("button", { name: "Hide setup moves", exact: true })
        .click();
      await expect(setup).toBeHidden();
      await expect(
        page.locator(".answer-diagram, .algorithm, .case-occurrence"),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Show setup moves", exact: true })
        .click();
      await expect(setup).toHaveText(moves);
      await captureScreenshot(page, {
        path: testInfo.outputPath("setup-and-solve.png"),
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Need help", exact: true })
        .click();
      await fits(page.locator(".answer-layout, .ratings button"));
      await captureScreenshot(page, {
        path: testInfo.outputPath("answer-and-rate.png"),
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Needed help", exact: true })
        .click();
      await expect(setup).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Hide setup moves", exact: true }),
      ).toHaveAttribute("aria-expanded", "true");
      await page
        .getByRole("button", { name: "End practice", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Practice shown (1)", exact: true }),
      ).toBeFocused();
      expect((await saved(page)).attempts).toHaveLength(1);
    });
