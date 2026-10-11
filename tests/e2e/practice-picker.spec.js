import { test, expect, seed, saved, openLibrary } from "./fixtures.js";

const picker = (page) =>
  page.getByRole("dialog", { name: "Choose cases to practice", exact: true });
const opener = (page) =>
  page.getByRole("button", { name: "Practice these cases", exact: true });

async function choose(page, label, option) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function finish(page) {
  await page.getByRole("button", { name: "Ready to recognize" }).click();
  await page.getByRole("button", { name: "Finished", exact: true }).click();
}

test("practice picker cancellation restores focus and discards temporary selection", async ({
  page,
}) => {
  await seed(page);
  const before = await saved(page);
  await openLibrary(page, "OLL");
  for (const dismissal of ["escape", "close", "backdrop"]) {
    await opener(page).click();
    const dialog = picker(page);
    await expect(
      dialog.getByRole("button", {
        name: "Practice selected (0)",
        exact: true,
      }),
    ).toBeDisabled();
    await dialog.getByRole("checkbox", { name: "OLL 5", exact: true }).click();
    await expect(
      dialog.getByRole("button", {
        name: "Practice selected (1)",
        exact: true,
      }),
    ).toBeEnabled();
    if (dismissal === "escape") await page.keyboard.press("Escape");
    else if (dismissal === "close")
      await dialog
        .getByRole("button", { name: "Close practice picker" })
        .click();
    else await page.mouse.click(1, 1);
    await expect(dialog).not.toBeVisible();
    await expect(opener(page)).toBeFocused();
    expect(await saved(page)).toEqual(before);
  }
});

test("group selection supports mixed state and keyboard toggling", async ({
  page,
}) => {
  await seed(page);
  await openLibrary(page, "OLL");
  await opener(page).click();
  const dialog = picker(page);
  const group = dialog.getByRole("checkbox", { name: "Dot", exact: true });
  const first = dialog.getByRole("checkbox", { name: "OLL 1", exact: true });
  const other = dialog.getByRole("checkbox", { name: "OLL 5", exact: true });
  await expect(group).toHaveAttribute("aria-checked", "false");
  await first.click();
  await expect(group).toHaveAttribute("aria-checked", "mixed");
  await group.focus();
  await page.keyboard.press("Space");
  await expect(group).toBeFocused();
  await expect(group).toHaveAttribute("aria-checked", "true");
  for (const name of [
    "OLL 1",
    "OLL 2",
    "OLL 3",
    "OLL 4",
    "OLL 17",
    "OLL 18",
    "OLL 19",
    "OLL 20",
  ])
    await expect(
      dialog.getByRole("checkbox", { name, exact: true }),
    ).toBeChecked();
  await expect(other).not.toBeChecked();
  await expect(
    dialog.getByRole("button", { name: "Practice selected (8)", exact: true }),
  ).toBeEnabled();
  await page.keyboard.press("Enter");
  await expect(group).toHaveAttribute("aria-checked", "false");
  await expect(first).not.toBeChecked();
  await expect(
    dialog.getByRole("button", { name: "Practice selected (0)", exact: true }),
  ).toBeDisabled();
});

test("one selected case stays in the session across skipping and grading", async ({
  page,
}) => {
  await seed(page);
  const before = (await saved(page)).selected;
  await openLibrary(page, "OLL");
  await opener(page).click();
  await picker(page)
    .getByRole("checkbox", { name: "OLL 5", exact: true })
    .click();
  await picker(page)
    .getByRole("button", { name: "Practice selected (1)", exact: true })
    .click();
  await expect(picker(page)).not.toBeVisible();
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Try another setup" }).click();
    await expect(page.locator(".answer-diagram")).toHaveCount(0);
    await finish(page);
    await expect(
      page.getByRole("heading", { name: "OLL 5", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Solved with effort", exact: true })
      .click();
  }
  const after = await saved(page);
  expect(after.selected).toEqual(before);
  expect(after.attempts.map((attempt) => attempt.caseId)).toEqual([
    "oll-5",
    "oll-5",
  ]);
});

test("picker uses search results and all starts the filtered pool despite partial selection", async ({
  page,
}) => {
  await seed(page);
  const before = (await saved(page)).selected;
  await openLibrary(page, "OLL");
  await choose(page, "Filter by group", "Square Shape");
  await page.getByRole("searchbox", { name: "Search cases" }).fill("OLL 5");
  await opener(page).click();
  const dialog = picker(page);
  await expect(dialog.getByRole("checkbox")).toHaveCount(2);
  await expect(
    dialog.getByRole("checkbox", { name: "OLL 5", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("checkbox", { name: "OLL 6", exact: true }),
  ).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Practice all (1)", exact: true })
    .click();
  await finish(page);
  await expect(
    page.getByRole("heading", { name: "OLL 5", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Solved with effort", exact: true })
    .click();
  expect((await saved(page)).selected).toEqual(before);
  expect((await saved(page)).attempts[0].caseId).toBe("oll-5");
  await openLibrary(page, "OLL");
  await page.getByRole("searchbox", { name: "Search cases" }).fill("");
  await choose(page, "Filter by group", "Square Shape");
  await opener(page).click();
  await dialog.getByRole("checkbox", { name: "OLL 6", exact: true }).click();
  // Fixed first-index choices make an accidental selected-only pool observable.
  await page.evaluate(() => {
    crypto.getRandomValues = (array) => {
      array.fill(0);
      return array;
    };
  });
  await dialog
    .getByRole("button", { name: "Practice all (2)", exact: true })
    .click();
  await finish(page);
  await expect(
    page.getByRole("heading", { name: "OLL 5", exact: true }),
  ).toBeVisible();
  expect((await saved(page)).selected).toEqual(before);
});

for (const { section, total, group, names } of [
  {
    section: "OLL",
    total: 10,
    group: "1. Yellow cross",
    names: ["OLL 45", "OLL 44", "OLL 2"],
  },
  {
    section: "PLL",
    total: 6,
    group: "1. Position corners",
    names: ["T perm", "Y perm"],
  },
]) {
  test(`2-look ${section} picker keeps curriculum groups and case scope`, async ({
    page,
  }) => {
    await seed(page);
    await openLibrary(page, section);
    await choose(page, "Learning method", "2-look OLL / PLL");
    await opener(page).click();
    const dialog = picker(page);
    await expect(dialog.getByRole("checkbox")).toHaveCount(total + 2);
    await expect(
      dialog.getByRole("button", {
        name: `Practice all (${total})`,
        exact: true,
      }),
    ).toBeEnabled();
    await dialog.getByRole("checkbox", { name: group, exact: true }).click();
    for (const name of names)
      await expect(
        dialog.getByRole("checkbox", { name, exact: true }),
      ).toBeChecked();
    await dialog
      .getByRole("button", {
        name: `Practice selected (${names.length})`,
        exact: true,
      })
      .click();
    await finish(page);
    expect(names).toContain(await page.locator(".trainer h1").textContent());
  });
}

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`practice picker controls and content fit ${viewport.width}×${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await seed(page);
    await openLibrary(page, "OLL");
    await opener(page).click();
    const dialog = picker(page);
    const controls = dialog.locator("button");
    const bounds = await controls.evaluateAll((buttons) =>
      buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          name: button.getAttribute("aria-label") || button.textContent,
          width: rect.width,
          height: rect.height,
          fits: button.scrollWidth <= button.clientWidth + 1,
        };
      }),
    );
    for (const control of bounds) {
      expect(control.width, control.name).toBeGreaterThanOrEqual(44);
      expect(control.height, control.name).toBeGreaterThanOrEqual(44);
      expect(control.fits, control.name).toBe(true);
    }
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    const last = dialog.getByRole("checkbox").last();
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    await last.click();
    await expect(last).toBeChecked();
    const start = dialog.getByRole("button", {
      name: "Practice selected (1)",
      exact: true,
    });
    await start.scrollIntoViewIfNeeded();
    await expect(start).toBeInViewport();
    for (const colorScheme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme });
      await page.screenshot({
        path: testInfo.outputPath(`practice-picker-${colorScheme}.png`),
        animations: "disabled",
      });
    }
    const close = dialog.getByRole("button", {
      name: "Close practice picker",
      exact: true,
    });
    await close.scrollIntoViewIfNeeded();
    await expect(close).toBeInViewport();
    await close.click();
    await expect(opener(page)).toBeFocused();
  });
}
