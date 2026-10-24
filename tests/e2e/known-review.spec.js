import {
  test,
  expect,
  seed,
  saved,
  progressFixture,
  openLibrary,
} from "./fixtures.js";

async function choose(page, name, option) {
  const control = page.getByRole("combobox", { name, exact: true });
  await control.click();
  await page.getByRole("option", { name: option, exact: true }).click();
  await expect(control).toBeFocused();
}
async function review(page, section = "Both") {
  await choose(page, "Practice cases", "Review known");
  await choose(page, "Practice section", section);
  await page.getByRole("button", { name: "Start hidden practice" }).click();
}
async function finish(page) {
  await expect(page.locator(".answer-diagram")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Relearn this case", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Ready to recognize" }).click();
  await expect(page.locator(".answer-diagram")).toHaveCount(0);
  await page.getByRole("button", { name: "Finished", exact: true }).click();
}
const fixture = () => ({
  ...progressFixture(),
  selected: [],
  variants: { "oll-27": 0, "pll-Y": 1 },
  known: { "pll-Y": [1] },
  attempts: [20, 21, 22].map((day) => ({
    id: `confident-${day}`,
    caseId: "oll-27",
    variant: 0,
    mode: "recognition",
    result: "confident",
    day: `2026-10-${day}`,
    at: `2026-10-${day}T12:00:00Z`,
  })),
});

test("known review filters both sections, tracks ratings and retains the session pool", async ({
  page,
}) => {
  await seed(page, fixture());
  await choose(page, "Practice cases", "Review known");
  await expect(page.locator(".practice-panel").getByRole("status")).toHaveText(
    "2 cases available",
  );
  await choose(page, "Practice section", "OLL");
  await expect(page.locator(".practice-panel").getByRole("status")).toHaveText(
    "1 case available",
  );
  await page.getByRole("button", { name: "Start hidden practice" }).click();
  await page.getByRole("button", { name: "Try another setup" }).click();
  expect((await saved(page)).attempts).toHaveLength(3);
  await finish(page);
  await expect(page.locator(".trainer h1")).toHaveText("OLL 27");
  await page
    .getByRole("button", { name: "Solved with effort", exact: true })
    .click();
  await finish(page);
  await expect(page.locator(".trainer h1")).toHaveText("OLL 27");
  await page
    .getByRole("button", {
      name: "Recognized & solved confidently",
      exact: true,
    })
    .click();
  const after = await saved(page);
  expect(
    after.attempts.slice(3).map(({ caseId, result, method, variant }) => ({
      caseId,
      result,
      method,
      variant,
    })),
  ).toEqual([
    { caseId: "oll-27", result: "effort", method: "full", variant: 0 },
    { caseId: "oll-27", result: "confident", method: "full", variant: 0 },
  ]);
  expect(after.selected).toEqual([]);
  await page.getByRole("button", { name: "End practice" }).click();
  await expect(
    page.getByRole("combobox", { name: "Practice cases", exact: true }),
  ).toContainText("Review known");
  await expect(
    page.getByRole("combobox", { name: "Practice section", exact: true }),
  ).toContainText("OLL");
  await expect(
    page.getByRole("button", { name: "Start hidden practice" }),
  ).toBeDisabled();
  await choose(page, "Practice section", "PLL");
  await page.getByRole("button", { name: "Start hidden practice" }).click();
  await page.getByRole("button", { name: "Ready to recognize" }).click();
  await page.getByRole("button", { name: "Show hint", exact: true }).click();
  await expect(page.locator(".trainer h1")).toHaveText("Y perm");
  await expect(
    page.getByRole("button", { name: "Solved with effort", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", {
      name: "Recognized & solved confidently",
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Needed help", exact: true }).click();
  expect((await saved(page)).attempts.at(-1)).toMatchObject({
    caseId: "pll-Y",
    variant: 1,
    result: "help",
    method: "full",
  });
});

test("relearn removes explicit knowledge only for the reviewed variant and persists", async ({
  page,
}) => {
  const progress = fixture();
  progress.known["pll-Y"] = [0, 1];
  progress.twoLookKnown = { "pll-Y": [1] };
  await seed(page, progress);
  await review(page, "PLL");
  await finish(page);
  await page
    .getByRole("button", { name: "Relearn this case", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "My learning", exact: true }),
  ).toBeVisible();
  const after = await saved(page);
  expect(after.known).toEqual({ "pll-Y": [0] });
  expect(after.twoLookKnown).toBeUndefined();
  expect(after.selected).toEqual(["pll-Y"]);
  expect(after.attempts.slice(0, 3)).toEqual(progress.attempts);
  expect(after.attempts.at(-1)).toMatchObject({
    caseId: "pll-Y",
    variant: 1,
    mode: "recognition",
    result: "help",
  });
  await expect(
    page.getByRole("button", { name: "Start hidden practice" }),
  ).toBeDisabled();
  await page.reload();
  expect(await saved(page)).toEqual(after);
  await choose(page, "Practice section", "PLL");
  await page.getByRole("button", { name: "Start hidden practice" }).click();
  await finish(page);
  await expect(page.locator(".trainer h1")).toHaveText("Y perm");
  await expect(
    page.getByRole("button", { name: "Relearn this case", exact: true }),
  ).toHaveCount(0);
});

test("relearning earned confidence removes the case from a continuing mixed review", async ({
  page,
}) => {
  await seed(page, fixture());
  await page.evaluate(() => {
    crypto.getRandomValues = (array) => {
      array.fill(0);
      return array;
    };
  });
  await review(page);
  await finish(page);
  await expect(page.locator(".trainer h1")).toHaveText("OLL 27");
  await page
    .getByRole("button", { name: "Relearn this case", exact: true })
    .click();
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Try another setup" }).click();
    await finish(page);
    await expect(page.locator(".trainer h1")).toHaveText("Y perm");
    await page
      .getByRole("button", {
        name: "Recognized & solved confidently",
        exact: true,
      })
      .click();
  }
  const after = await saved(page);
  expect(after.selected).toEqual(["oll-27"]);
  expect(after.attempts[3]).toMatchObject({ caseId: "oll-27", result: "help" });
  await page.getByRole("button", { name: "End practice" }).click();
  await expect(page.locator(".practice-panel").getByRole("status")).toHaveText(
    "1 case available",
  );
});

test("relearning save failure preserves marks, history and revealed case for retry", async ({
  page,
}) => {
  await seed(page, fixture());
  const before = await saved(page);
  await review(page, "PLL");
  await finish(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.failReviewSave = true;
    window.reviewWrites = 0;
    Storage.prototype.setItem = function (key, value) {
      if (key === "last-layer.progress.v2") {
        window.reviewWrites++;
        if (window.failReviewSave)
          throw new DOMException("Full", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
  });
  await page
    .getByRole("button", { name: "Relearn this case", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "could not save progress",
  );
  await expect(page.locator(".trainer h1")).toHaveText("Y perm");
  expect(await saved(page)).toEqual(before);
  await page.evaluate(() => {
    window.failReviewSave = false;
  });
  await page
    .getByRole("button", { name: "Relearn this case", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  const after = await saved(page);
  expect(after.selected).toEqual(["pll-Y"]);
  expect(after.attempts).toHaveLength(before.attempts.length + 1);
  expect(after.known).toBeUndefined();
  expect(await page.evaluate(() => window.reviewWrites)).toBe(2);
});

test("two-look review uses the saved method and chosen variants", async ({
  page,
}) => {
  const progress = fixture();
  progress.known["oll-5"] = [0];
  await seed(page, progress);
  await openLibrary(page);
  await choose(page, "Learning method", "2-look OLL / PLL");
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("button", { name: "My learning", exact: true })
    .click();
  await review(page, "PLL");
  await finish(page);
  await page
    .getByRole("button", { name: "Relearn this case", exact: true })
    .click();
  expect((await saved(page)).attempts.at(-1)).toMatchObject({
    caseId: "pll-Y",
    variant: 1,
    method: "two-look",
  });
  await choose(page, "Practice section", "OLL");
  // OLL 5 is known, but outside the two-look curriculum.
  await expect(page.locator(".practice-panel").getByRole("status")).toHaveText(
    "1 case available",
  );
});

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  for (const colorScheme of ["light", "dark"]) {
    test(`known review fits ${viewport.width}×${viewport.height} in ${colorScheme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await seed(page, fixture());
      await choose(page, "Practice cases", "Review known");
      const section = page.getByRole("combobox", {
        name: "Practice section",
        exact: true,
      });
      await section.click();
      const option = page.getByRole("option", { name: "PLL", exact: true });
      await expect(option).toBeInViewport();
      await option.click();
      for (const control of await page
        .locator(".practice-panel button, .practice-panel label")
        .all()) {
        await control.scrollIntoViewIfNeeded();
        const box = await control.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
      await page.locator(".practice-options").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: testInfo.outputPath("review-options.png"),
        animations: "disabled",
      });
      await page.getByRole("button", { name: "Start hidden practice" }).click();
      await finish(page);
      const relearn = page.getByRole("button", {
        name: "Relearn this case",
        exact: true,
      });
      await relearn.scrollIntoViewIfNeeded();
      await expect(relearn).toBeInViewport();
      for (const element of await page
        .locator(
          ".trainer .answer-layout, .trainer .ratings button, .trainer .relearn-case",
        )
        .all()) {
        const box = await element.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(
          await element.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        ).toBe(true);
      }
      await page.screenshot({
        path: testInfo.outputPath("review-reveal.png"),
        animations: "disabled",
      });
      await relearn.focus();
      await page.keyboard.press("Enter");
      await expect(page.locator("#main")).toBeFocused();
      await expect(
        page.getByRole("button", { name: "Start hidden practice" }),
      ).toBeDisabled();
      expect((await saved(page)).selected).toEqual(["pll-Y"]);
    });
  }
}
