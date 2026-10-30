import { captureScreenshot } from "./screenshots.js";
import {
  test,
  expect,
  seed,
  saved,
  openLibrary,
  openSettings,
  closeSettings,
  importBackup,
} from "./fixtures.js";

async function choose(page, label, option) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("the exact setup remains visible after reveal and 1/2/3 rate only a revealed answer", async ({
  page,
}) => {
  await seed(page);
  await page
    .getByRole("button", { name: "Start hidden practice", exact: true })
    .click();
  for (const key of ["1", "2", "3"]) await page.keyboard.press(key);
  expect((await saved(page)).attempts).toHaveLength(0);
  for (const [key, result] of [
    ["1", "help"],
    ["2", "effort"],
    ["3", "confident"],
  ]) {
    const moves = await page
      .getByLabel("Setup moves", { exact: true })
      .textContent();
    await page
      .getByRole("button", { name: "Hide setup moves", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Reveal answer", exact: true })
      .click();
    await expect(page.getByLabel("Setup moves", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Setup moves", { exact: true })).toHaveText(
      moves,
    );
    const before = await saved(page);
    await page.locator("#main").dispatchEvent("keydown", { key, repeat: true });
    await page.keyboard.press(`Control+${key}`);
    expect(await saved(page)).toEqual(before);
    await openSettings(page);
    await page.keyboard.press(key);
    expect(await saved(page)).toEqual(before);
    await closeSettings(page);
    await page.keyboard.press(key);
    expect((await saved(page)).attempts.at(-1)).toMatchObject({
      result,
      mode: "recognition",
    });
    expect((await saved(page)).attempts).toHaveLength(
      before.attempts.length + 1,
    );
    await expect(
      page.getByRole("button", { name: "Reveal answer", exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Need help", exact: true }).click();
  const before = await saved(page);
  await page.keyboard.press("2");
  await page.keyboard.press("3");
  expect(await saved(page)).toEqual(before);
  await page.keyboard.press("1");
  expect((await saved(page)).attempts.at(-1).result).toBe("help");
});

test("empty learning chooses starters explicitly, preserves a failed save and adds without granting mastery", async ({
  page,
}) => {
  await seed(page, {
    version: 2,
    selected: [],
    variants: { "pll-Y": 1 },
    known: { "pll-Y": [1] },
    attempts: [],
  });
  const before = await saved(page);
  const starter = page.locator(".learning-starter");
  const add = starter.getByRole("button", {
    name: "Add selected to learning set",
    exact: true,
  });
  await expect(add).toBeDisabled();
  await choose(page, "Starter group", "PLL · Position corners");
  const y = starter.getByRole("checkbox", { name: "Y perm", exact: true });
  await y.check();
  await expect(
    starter.getByRole("checkbox", {
      name: "PLL · Position corners",
      exact: true,
    }),
  ).toHaveAttribute("aria-checked", "mixed");
  await starter
    .getByRole("button", { name: "Select all (2)", exact: true })
    .click();
  await expect(
    starter.getByRole("checkbox", { name: "T perm", exact: true }),
  ).toBeChecked();
  await starter
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  await expect(add).toBeDisabled();
  await starter.getByText("Y perm", { exact: true }).click();
  await expect(y).toBeChecked();
  expect(await saved(page)).toEqual(before);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.starterWrites = 0;
    Storage.prototype.setItem = function (key, value) {
      if (key === "last-layer.progress.v2" && ++window.starterWrites === 1)
        throw new DOMException("Full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await add.click();
  await expect(page.getByRole("alert")).toContainText(
    "could not save progress",
  );
  await expect(y).toBeChecked();
  expect(await saved(page)).toEqual(before);
  await add.click();
  await expect(page.locator(".learning-starter")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Start hidden practice", exact: true }),
  ).toBeFocused();
  expect(await saved(page)).toEqual({ ...before, selected: ["pll-Y"] });
  expect(await page.evaluate(() => window.starterWrites)).toBe(2);
  await page.reload();
  expect((await saved(page)).selected).toEqual(["pll-Y"]);
});

test("starter group changes and leaving My learning discard unapplied selections", async ({
  page,
}) => {
  await seed(page, { version: 2, selected: [], variants: {}, attempts: [] });
  const before = await saved(page);
  await page.getByRole("checkbox", { name: "OLL 45", exact: true }).check();
  await choose(page, "Starter group", "PLL · Position edges");
  const add = page.getByRole("button", {
    name: "Add selected to learning set",
    exact: true,
  });
  await expect(add).toBeDisabled();
  await page.getByRole("checkbox", { name: "Ua perm", exact: true }).check();
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("button", { name: "Courses", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("button", { name: "My learning", exact: true })
    .click();
  await expect(add).toBeDisabled();
  expect(await saved(page)).toEqual(before);
});

test("pool previews follow learning/known, section and two-look choices and disappear during practice", async ({
  page,
}) => {
  await seed(page, {
    version: 2,
    selected: ["pll-T", "oll-27"],
    variants: {},
    known: { "pll-Y": [0], "oll-5": [0] },
    attempts: [],
  });
  await openLibrary(page);
  await choose(page, "Learning method", "2-look OLL / PLL");
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("button", { name: "My learning", exact: true })
    .click();
  await page.getByText("Preview cases (2)", { exact: true }).click();
  const preview = page.getByRole("region", {
    name: "Cases in this practice pool",
    exact: true,
  });
  await expect(preview.getByRole("listitem")).toHaveCount(2);
  await expect(preview).toContainText("T perm");
  await expect(preview).toContainText("OLL 27");
  await choose(page, "Practice cases", "Review known");
  await expect(page.locator(".practice-preview summary")).toHaveText(
    "Preview cases (1)",
  );
  await expect(preview.getByRole("listitem")).toHaveCount(1);
  await expect(preview).toContainText("Y perm");
  await expect(preview).not.toContainText("OLL 5");
  await choose(page, "Practice section", "OLL");
  await expect(page.locator(".practice-preview")).toHaveCount(0);
  await choose(page, "Practice section", "PLL");
  await page
    .getByRole("button", { name: "Start hidden practice", exact: true })
    .click();
  await expect(
    page.locator(".practice-preview, .case-diagram, .algorithm"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Need help", exact: true }).click();
  await expect(page.locator(".trainer h1")).toHaveText("Y perm");
});

for (const source of ["library", "cfop"])
  for (const custom of [false, true])
    test(`${source} ${custom ? "custom" : "direct"} practice returns to its filters, scroll and opener`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 600 });
      await seed(page);
      await page.goto(`/${source}/pll/two-look`);
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
      await seed(page, {
        version: 2,
        selected: [],
        variants: {},
        attempts: [],
      });
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
      await fits(
        page.locator(
          ".learning-starter .practice-pick-case, .learning-starter button, .learning-starter label",
        ),
      );
      await page.getByRole("checkbox", { name: "OLL 45", exact: true }).check();
      const indicator = page.locator(
        ".learning-starter .checkbox-indicator:has(svg)",
      );
      const mark = await indicator.locator("svg").boundingBox();
      const bounds = await indicator.boundingBox();
      expect(mark.width).toBeLessThanOrEqual(bounds.width);
      expect(mark.height).toBeLessThanOrEqual(bounds.height);

      await captureScreenshot(page, {
        path: testInfo.outputPath("starter-selection.png"),
        fullPage: true,
      });
      await page
        .getByRole("button", {
          name: "Add selected to learning set",
          exact: true,
        })
        .click();
      await page.getByText("Preview cases (1)", { exact: true }).click();
      await fits(
        page.locator(".practice-preview-scroll, .practice-preview-grid li"),
      );
      await captureScreenshot(page, {
        path: testInfo.outputPath("practice-pool-preview.png"),
        fullPage: true,
      });
      await openLibrary(page, "OLL");
      await choose(page, "Filter by group", "Square Shape");
      await page.getByRole("searchbox", { name: "Search cases" }).fill("OLL 5");
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
      await expect(setup).toBeVisible();
      await expect(setup).toHaveText(moves);
      await fits(page.locator(".revealed-setup"));
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

test("R/H and adding a revealed case preserve grading, retry safely and avoid consecutive repeats", async ({
  page,
}) => {
  await seed(page, { version: 2, selected: [], variants: {}, attempts: [] });
  await openLibrary(page, "OLL");
  await choose(page, "Filter by group", "Square Shape");
  await page.evaluate(() => {
    crypto.getRandomValues = (array) => {
      array.fill(0);
      return array;
    };
  });
  await page
    .getByRole("button", { name: "Practice shown (2)", exact: true })
    .click();
  await openSettings(page);
  await page.keyboard.press("r");
  await closeSettings(page);
  await expect(page.locator(".answer-layout")).toHaveCount(0);
  await page.keyboard.press("r");
  await expect(page.locator(".trainer h1")).toHaveText("OLL 5");
  const before = await saved(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.addWrites = 0;
    Storage.prototype.setItem = function (key, value) {
      if (key === "last-layer.progress.v2" && ++window.addWrites === 1)
        throw new DOMException("Full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  const add = page.getByRole("button", {
    name: "Add to learning set",
    exact: true,
  });
  await add.click();
  await expect(page.getByRole("alert")).toContainText(
    "could not save progress",
  );
  expect(await saved(page)).toEqual(before);
  await expect(page.locator(".trainer h1")).toHaveText("OLL 5");
  await add.click();
  expect(await saved(page)).toEqual({ ...before, selected: ["oll-5"] });
  await expect(
    page.getByRole("button", { name: "Needed help", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "In your learning set", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("2");
  await page.keyboard.press("h");
  await expect(page.locator(".trainer h1")).toHaveText("OLL 6");
  await page.keyboard.press("3");
  expect((await saved(page)).attempts).toHaveLength(1);
  await page.keyboard.press("1");
  await page.keyboard.press("r");
  await expect(page.locator(".trainer h1")).toHaveText("OLL 5");
  expect((await saved(page)).selected).toEqual(["oll-5"]);
  expect((await saved(page)).attempts.map((a) => a.caseId)).toEqual([
    "oll-5",
    "oll-6",
  ]);
});

for (const populated of [false, true])
  test(`backup replacement clears starter drafts after ${populated ? "populated" : "empty"} restore`, async ({
    page,
  }) => {
    const empty = { version: 2, selected: [], variants: {}, attempts: [] };
    await seed(page, empty);
    const choice = page.getByRole("checkbox", { name: "OLL 45", exact: true });
    await choice.check();
    await importBackup(page, empty);
    await page
      .getByRole("button", { name: "Close backup", exact: true })
      .click();
    await expect(choice).toBeChecked();
    await importBackup(page, {
      ...empty,
      selected: populated ? ["pll-T"] : [],
    });
    await page
      .getByRole("button", { name: "Replace with this backup", exact: true })
      .click();
    if (populated) {
      await expect(page.locator(".learning-starter")).toHaveCount(0);
      // Stay on My learning through both restores, so navigation cannot clear
      // an otherwise invisible draft and conceal the regression.
      await importBackup(page, empty);
      await page
        .getByRole("button", { name: "Replace with this backup", exact: true })
        .click();
    }
    await expect(choice).not.toBeChecked();
    await expect(
      page.getByRole("button", {
        name: "Add selected to learning set",
        exact: true,
      }),
    ).toBeDisabled();
  });
