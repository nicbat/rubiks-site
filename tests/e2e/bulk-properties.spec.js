import { captureScreenshot } from "./screenshots.js";
import {
  test,
  expect,
  seed,
  saved,
  openLibrary,
  progressFixture,
} from "./fixtures.js";
import catalog from "../../data/algorithms.json" with { type: "json" };
import { recommendedVariant } from "../../src/learning-methods.js";

async function choose(page, label, value) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: value, exact: true }).click();
}
const toolbar = (page) =>
  page.getByRole("region", { name: "Bulk case properties" });
const pick = (page, name) =>
  page.getByRole("checkbox", { name: `Select ${name}`, exact: true });

test("bulk selection supports keyboard, mixed groups, collapsed cases, details and cancellation", async ({
  page,
}) => {
  await seed(page);
  await openLibrary(page);
  const before = await saved(page);
  await page.getByRole("button", { name: "Select cases", exact: true }).click();
  await expect(pick(page, "all matching")).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Apply to 0 cases" }),
  ).toBeDisabled();
  await pick(page, "H perm").focus();
  await page.keyboard.press("Space");
  await expect(pick(page, "H perm")).toBeChecked();
  await expect(pick(page, "H perm")).toBeFocused();
  await expect(pick(page, "Edges Only")).toHaveAttribute(
    "aria-checked",
    "mixed",
  );
  await pick(page, "Edges Only").check();
  await expect(toolbar(page)).toContainText("4 selected");
  await expect(pick(page, "Edges Only")).toBeChecked();
  await page.getByRole("button", { name: /Edges Only/ }).click();
  await expect(
    page.getByRole("button", { name: "View H perm", exact: true }),
  ).not.toBeVisible();
  await expect(toolbar(page)).toContainText("4 selected");
  await pick(page, "Edges Only").uncheck();
  await expect(toolbar(page)).toContainText("0 selected");
  await page.getByRole("button", { name: /Edges Only/ }).click();
  await pick(page, "H perm").check();
  await page.getByRole("button", { name: "View H perm", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "H perm", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close case" }).click();
  await expect(
    page.getByRole("button", { name: "View H perm", exact: true }),
  ).toBeFocused();
  await expect(pick(page, "H perm")).toBeChecked();
  await choose(page, "Known", "Mark known");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Select cases", exact: true }),
  ).toBeFocused();
  expect(await saved(page)).toEqual(before);
  await page.getByRole("button", { name: "Select cases", exact: true }).click();
  await expect(toolbar(page)).toContainText("0 selected");
});

test("bulk Apply sets explicit properties for the filtered chosen variants and persists", async ({
  page,
}) => {
  const progress = progressFixture();
  progress.variants = { "pll-Ua": 1 };
  progress.known = { "pll-Ua": [0], "oll-2": [0] };
  await seed(page, progress);
  await openLibrary(page);
  await choose(page, "Filter by group", "Edges Only");
  await page.getByRole("button", { name: "Select cases", exact: true }).click();
  await pick(page, "all matching").check();
  await expect(toolbar(page)).toContainText("4 selected");
  await expect(
    page.getByRole("button", { name: "Apply to 4 cases" }),
  ).toBeDisabled();
  await choose(page, "Known", "Mark known");
  await choose(page, "Learning set", "Add to learning set");
  await page.getByRole("button", { name: "Apply to 4 cases" }).click();
  await expect(toolbar(page)).toContainText("0 selected");
  await expect(pick(page, "all matching")).toBeFocused();
  const next = await saved(page);
  expect([...next.selected].sort()).toEqual(
    ["pll-T", "pll-Ua", "pll-Ub", "pll-H", "pll-Z"].sort(),
  );
  expect(next.known["pll-Ua"]).toEqual([0, 1]);
  expect(next.known["oll-2"]).toEqual([0]);
  expect(next.known["pll-T"]).toBeUndefined();
  expect(next.attempts).toEqual([]);
  expect(next.variants).toEqual(progress.variants);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Select cases", exact: true }),
  ).toBeVisible();
  expect(await saved(page)).toEqual(next);
  await choose(page, "Learning status", "Learned");
  await choose(page, "Filter by group", "Edges Only");
  await page.getByRole("button", { name: "Select cases", exact: true }).click();
  await pick(page, "all matching").check();
  await choose(page, "Known", "Remove known mark");
  await choose(page, "Learning set", "Remove from learning set");
  await page.getByRole("button", { name: "Apply to 4 cases" }).click();
  await expect(
    page.getByRole("heading", { name: "No matching cases" }),
  ).toBeVisible();
  await expect(toolbar(page)).toContainText("0 selected");
  const removed = await saved(page);
  expect(removed.selected).toEqual(["pll-T"]);
  expect(removed.known).toEqual({ "pll-Ua": [0], "oll-2": [0] });
  expect(removed.attempts).toEqual([]);
});

test("filters and destinations clear bulk scope while clear and Done discard unapplied choices", async ({
  page,
}) => {
  await seed(page);
  await openLibrary(page);
  const before = await saved(page);
  await page.getByRole("button", { name: "Select cases", exact: true }).click();
  await pick(page, "H perm").check();
  await page.getByRole("searchbox", { name: "Search cases" }).fill("perm");
  await expect(toolbar(page)).toContainText("0 selected");
  await pick(page, "H perm").check();
  await choose(page, "Filter by group", "Edges Only");
  await expect(toolbar(page)).toContainText("0 selected");
  await pick(page, "H perm").check();
  await choose(page, "Learning status", "Unlearned");
  await expect(toolbar(page)).toContainText("0 selected");
  await pick(page, "H perm").check();
  await choose(page, "Learning method", "2-look OLL / PLL");
  await expect(toolbar(page)).toContainText("0 selected");
  await pick(page, "all matching").check();
  await choose(page, "Known", "Mark known");
  await page.getByRole("button", { name: /^OLL\s*10$/ }).click();
  await expect(toolbar(page)).toContainText("0 selected");
  await expect(
    page.getByRole("combobox", { name: "Known", exact: true }),
  ).toContainText("Leave unchanged");
  await page.getByRole("searchbox", { name: "Search cases" }).fill("");
  await pick(page, "all matching").check();
  await page
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  await expect(toolbar(page)).toContainText("0 selected");
  await pick(page, "all matching").check();
  await page.getByRole("button", { name: "My learning", exact: true }).click();
  await openLibrary(page, "OLL");
  await expect(toolbar(page)).toHaveCount(0);
  expect((await saved(page)).selected).toEqual(before.selected);
  expect((await saved(page)).known).toEqual(before.known);
});

test("failed bulk saves preserve progress, selection and choices for retry", async ({
  page,
}) => {
  await seed(page);
  await openLibrary(page);
  const before = await saved(page);
  await page.getByRole("button", { name: "Select cases", exact: true }).click();
  await pick(page, "H perm").check();
  await pick(page, "Z perm").check();
  await choose(page, "Known", "Mark known");
  await choose(page, "Learning set", "Add to learning set");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.failBulkSave = true;
    window.bulkWrites = 0;
    Storage.prototype.setItem = function (key, value) {
      if (key === "last-layer.progress.v2") {
        window.bulkWrites++;
        if (window.failBulkSave)
          throw new DOMException("Full", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "Apply to 2 cases" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "could not save progress",
  );
  expect(await saved(page)).toEqual(before);
  await expect(toolbar(page)).toContainText("2 selected");
  await expect(
    page.getByRole("combobox", { name: "Known", exact: true }),
  ).toContainText("Mark known");
  await expect(
    page
      .locator(".library-case")
      .filter({
        has: page.getByRole("heading", { name: "H perm", exact: true }),
      })
      .locator(".badge"),
  ).not.toHaveText("Already known");
  await page.evaluate(() => {
    window.failBulkSave = false;
  });
  await page.getByRole("button", { name: "Apply to 2 cases" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(toolbar(page)).toContainText("0 selected");
  expect((await saved(page)).known).toEqual({ "pll-H": [0], "pll-Z": [0] });
  expect((await saved(page)).attempts).toEqual(before.attempts);
  expect(await page.evaluate(() => window.bulkWrites)).toBe(2);
});

test("case edits remove selections that leave the active learned filter", async ({
  page,
}) => {
  const progress = progressFixture();
  progress.known = { "pll-Ua": [0], "pll-H": [0] };
  await seed(page, progress);
  await openLibrary(page);
  await choose(page, "Learning status", "Learned");
  await page.getByRole("button", { name: "Select cases", exact: true }).click();
  await pick(page, "all matching").check();
  await page.getByRole("button", { name: "View Ua perm", exact: true }).click();
  await page.getByRole("combobox", { name: "Your algorithm" }).click();
  await page.getByRole("option").nth(1).click();
  await page.getByRole("button", { name: "Close case" }).click();
  await expect(toolbar(page)).toContainText("1 selected");
  await expect(pick(page, "Ua perm")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Done", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "View H perm", exact: true }).click();
  await page.getByRole("button", { name: "Known", exact: true }).click();
  await page.getByRole("button", { name: "Close case" }).click();
  await expect(toolbar(page)).toContainText("0 selected");
  await expect(
    page.getByRole("button", { name: "Done", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Apply to 0 cases" }),
  ).toBeDisabled();
});

test("CFOP two-look bulk marks use recommended variants and appear in full OLL", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/cfop/oll/two-look");
  await page.getByRole("button", { name: "Select cases", exact: true }).click();
  await pick(page, "all matching").check();
  await choose(page, "Known", "Mark known");
  await page.getByRole("button", { name: "Apply to 10 cases" }).click();
  const next = await saved(page);
  expect(Object.keys(next.known)).toHaveLength(10);
  const c = catalog.find((c) => c.id === "oll-2");
  const variant = recommendedVariant(c, "two-look");
  expect(next.known[c.id]).toEqual([variant]);
  expect(next.attempts).toEqual([]);
  await page.getByRole("button", { name: "Full", exact: true }).click();
  await expect(toolbar(page)).toContainText("0 selected");
  await page.getByRole("button", { name: "View OLL 2", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const control = dialog.getByRole("combobox", { name: "Your algorithm" });
  await control.click();
  await page.getByRole("option").nth(variant).click();
  await expect(
    dialog.getByRole("button", { name: "Known", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  for (const theme of ["light", "dark"]) {
    test(`bulk controls fit ${viewport.width}x${viewport.height} in ${theme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await seed(page);
      await page.goto("/cfop/pll/full");
      await page
        .getByRole("button", { name: "Select cases", exact: true })
        .click();
      await pick(page, "all matching").check();
      await choose(page, "Known", "Mark known");
      await choose(page, "Learning set", "Add to learning set");
      const controls = toolbar(page).locator("button, label");
      for (const control of await controls.all()) {
        await control.scrollIntoViewIfNeeded();
        const box = await control.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
        expect(box.height).toBeGreaterThanOrEqual(44);
        if (await control.evaluate((el) => el.tagName === "BUTTON")) {
          expect(box.width).toBeGreaterThanOrEqual(44);
        }
      }
      await toolbar(page).scrollIntoViewIfNeeded();
      await captureScreenshot(page, {
        path: testInfo.outputPath("bulk-properties.png"),
      });
      await page.getByRole("button", { name: "Apply to 21 cases" }).click();
      await expect(toolbar(page)).toContainText("0 selected");
      const checkbox = pick(page, "H perm");
      await checkbox.scrollIntoViewIfNeeded();
      await checkbox.check();
      await page
        .getByRole("button", { name: "View H perm", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Known", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await page.getByRole("button", { name: "Close case" }).click();
      await checkbox.scrollIntoViewIfNeeded();
      const card = page.locator(".library-case").filter({ has: checkbox });
      const box = await card.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      await captureScreenshot(page, {
        path: testInfo.outputPath("bulk-selected-card.png"),
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });
  }
}
