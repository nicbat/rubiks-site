import { captureScreenshot } from "./screenshots.js";
import {
  test,
  expect,
  holdStartTimer,
  openSettings,
  closeSettings,
} from "./fixtures.js";

const key = "last-layer.solves.v1";
const cubeName =
  "A very long cube name for older solves and small phone screens";
const records = () =>
  Array.from({ length: 55 }, (_, i) => ({
    id: `s${i}`,
    elapsed: 1000 * (i + 1),
    date: new Date(Date.UTC(2026, 9, 20, 12, 0, i)).toISOString(),
    day: "2026-10-20",
    scramble: Array(10).fill("R U").join(" "),
    ...(i === 54
      ? { cubeId: "deleted", penalty: "+2", notes: "Keep my note" }
      : {}),
  }));
const history = (page) => page.locator(".timer-history");
const toolbar = (page) =>
  page.getByRole("region", { name: "Bulk solve actions" });
const pick = (page, n) =>
  history(page).getByRole("checkbox", {
    name: `Select solve ${n}`,
    exact: true,
  });
const shown = (page, n) =>
  page.getByRole("checkbox", {
    name: `Select shown solves (${n})`,
    exact: true,
  });
const button = (page, name) =>
  history(page).getByRole("button", { name, exact: true });
const saved = (page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
async function choose(page, name, touch = false) {
  const control = toolbar(page).getByRole("combobox", {
    name: "Cube for selected solves",
  });
  if (touch) await control.tap();
  else await control.click();
  await expect(
    page.getByRole("option", { name: "Retired cube", exact: true }),
  ).toHaveCount(0);
  const option = page.getByRole("option", { name, exact: true });
  if (touch) await option.tap();
  else await option.click();
}
async function setup(page, theme = "light") {
  await page.goto("/#/home");
  await page.evaluate(
    ({ key, solves, cubeName, theme }) => {
      localStorage.setItem(key, JSON.stringify(solves));
      localStorage.setItem(
        "last-layer.cubes.v1",
        JSON.stringify({
          defaultId: "keep",
          cubes: [
            { id: "keep", name: cubeName, description: "" },
            {
              id: "deleted",
              name: "Retired cube",
              description: "",
              deleted: true,
            },
          ],
        }),
      );
      localStorage.setItem("last-layer-theme", theme);
    },
    { key, solves: records(), cubeName, theme },
  );
  await page.goto("/#/timer");
  await page.reload();
  await page.getByText("Solve history (55)", { exact: true }).click();
  await button(page, "Select solves").click();
}

test("shown selection is explicit, mixed and keyboard accessible; pagination retains selections and reviews", async ({
  page,
}) => {
  await setup(page);
  await expect(shown(page, 50)).toBeFocused();
  await expect(button(page, "Apply cube")).toBeDisabled();
  await expect(button(page, "Delete selected")).toBeDisabled();
  await expect(toolbar(page)).toContainText(
    "Only selects the rows shown below",
  );
  await pick(page, 55).focus();
  await pick(page, 55).press("Space");
  await expect(pick(page, 55)).toBeFocused();
  await expect(shown(page, 50)).toHaveAttribute("aria-checked", "mixed");
  await shown(page, 50).check();
  await expect(toolbar(page)).toContainText("50 selected");
  expect(await saved(page)).toEqual(records());
  await button(page, "Show more").click();
  await expect(shown(page, 55)).toHaveAttribute("aria-checked", "mixed");
  await expect(pick(page, 1)).not.toBeChecked();
  await expect(toolbar(page)).toContainText("50 selected");
  await page.locator("#timer-solve-s54").click();
  await expect(
    page.getByRole("dialog", { name: "Solve details", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close solve details", exact: true })
    .click();
  await expect(page.locator("#timer-solve-s54")).toBeFocused();
  await expect(pick(page, 55)).toBeChecked();
  await button(page, "Clear selection").click();
  await expect(shown(page, 55)).not.toBeChecked();
  await expect(toolbar(page)).toContainText("0 selected");
  await shown(page, 55).check();
  await expect(toolbar(page)).toContainText("55 selected");
  await button(page, "Done").click();
  await expect(button(page, "Select solves")).toBeFocused();
  await expect(toolbar(page)).toHaveCount(0);
  expect(await saved(page)).toEqual(records());
});

test("bulk cube assignment and clearing preserve results and persist only selected solves", async ({
  page,
}) => {
  await setup(page);
  await pick(page, 55).check();
  await pick(page, 53).check();
  await choose(page, cubeName);
  expect(await saved(page)).toEqual(records());
  await button(page, "Apply cube").click();
  const assigned = records().map((s) =>
    ["s54", "s52"].includes(s.id) ? { ...s, cubeId: "keep" } : s,
  );
  expect(await saved(page)).toEqual(assigned);
  await expect(toolbar(page)).toContainText("0 selected");
  await expect(shown(page, 50)).toBeFocused();
  await pick(page, 55).check();
  await choose(page, "Not specified");
  await button(page, "Apply cube").click();
  assigned[54].cubeId = null;
  expect(await saved(page)).toEqual(assigned);
  await page.reload();
  await page.getByText("Solve history (55)", { exact: true }).click();
  await expect(page.locator("#timer-solve-s54")).toContainText("Not specified");
  await expect(page.locator("#timer-solve-s52")).toContainText(cubeName);
});

test("deletion confirms its count, cancels safely, recomputes statistics and can remove all history", async ({
  page,
}) => {
  await setup(page);
  await pick(page, 55).check();
  await pick(page, 53).check();
  await button(page, "Delete selected").click();
  await expect(button(page, "Cancel")).toBeFocused();
  await expect(toolbar(page)).toContainText(
    "Delete 2 solves? This cannot be undone.",
  );
  await button(page, "Cancel").click();
  await expect(button(page, "Delete selected")).toBeFocused();
  expect(await saved(page)).toEqual(records());
  await button(page, "Delete selected").click();
  // Changing the selection invalidates the earlier confirmation.
  await pick(page, 53).uncheck();
  await expect(
    page.getByRole("group", { name: "Confirm bulk deletion" }),
  ).toHaveCount(0);
  await button(page, "Delete selected").click();
  await button(page, "Delete 1 solve").click();
  expect(await saved(page)).toEqual(records().slice(0, -1));
  await expect(
    page.getByRole("region", { name: "Recent solve statistics" }),
  ).toContainText("Average: 0:52.00");
  await button(page, "Show more").click();
  await shown(page, 54).check();
  await button(page, "Delete selected").click();
  await button(page, "Delete 54 solves").click();
  await expect(history(page)).toContainText("No solves yet.");
  await expect(
    page.getByText("Solve history (0)", { exact: true }),
  ).toBeFocused();
  expect(await saved(page)).toEqual([]);
});

for (const action of ["cube", "delete"]) {
  test(`failed bulk ${action} writes preserve live history, selection and one-write retry`, async ({
    page,
  }) => {
    await setup(page);
    await pick(page, 55).check();
    await pick(page, 54).check();
    if (action === "cube") await choose(page, cubeName);
    else await button(page, "Delete selected").click();
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      window.failSolveWrite = true;
      window.solveWrites = 0;
      Storage.prototype.setItem = function (key, value) {
        if (key === "last-layer.solves.v1") {
          window.solveWrites++;
          if (window.failSolveWrite)
            throw new DOMException("Full", "QuotaExceededError");
        }
        return original.call(this, key, value);
      };
    });
    const apply = () =>
      button(
        page,
        action === "cube" ? "Apply cube" : "Delete 2 solves",
      ).click();
    await apply();
    await expect(toolbar(page).getByRole("alert")).toContainText(
      "Your history and selection are preserved",
    );
    expect(await saved(page)).toEqual(records());
    await expect(toolbar(page)).toContainText("2 selected");
    await expect(page.locator("#timer-solve-s54")).toContainText(
      "Retired cube",
    );
    await expect(
      history(page).getByRole("button", { name: /^Review solve / }),
    ).toHaveCount(50);
    expect(await page.evaluate(() => window.solveWrites)).toBe(1);
    await page.evaluate(() => {
      window.failSolveWrite = false;
    });
    await apply();
    await expect(toolbar(page).getByRole("alert")).toHaveCount(0);
    await expect(toolbar(page)).toContainText("0 selected");
    const expected =
      action === "cube"
        ? records().map((s) =>
            ["s54", "s53"].includes(s.id) ? { ...s, cubeId: "keep" } : s,
          )
        : records().slice(0, -2);
    expect(await saved(page)).toEqual(expected);
    expect(await page.evaluate(() => window.solveWrites)).toBe(2);
  });
}

test("running disables bulk editing; new solves stay unselected and deleting the current result resets the timer", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-23T19:00:00Z") });
  await setup(page);
  await pick(page, 55).check();
  await choose(page, cubeName);
  await holdStartTimer(page);
  for (const name of [
    "Done",
    "Apply cube",
    "Delete selected",
    "Clear selection",
    "Show more",
  ])
    await expect(button(page, name)).toBeDisabled();
  await expect(shown(page, 50)).toBeDisabled();
  await expect(pick(page, 55)).toBeDisabled();
  await page.clock.fastForward(1250);
  await page.getByRole("button", { name: "Stop timer", exact: true }).click();
  await expect(pick(page, 56)).not.toBeChecked();
  await expect(pick(page, 55)).toBeChecked();
  await button(page, "Clear selection").click();
  await pick(page, 56).check();
  await button(page, "Delete selected").click();
  await button(page, "Delete 1 solve").click();
  await expect(
    page.getByRole("button", { name: "Hold to start (Space)", exact: true }),
  ).toBeVisible();
  expect(await saved(page)).toEqual(records());
});

test("leaving Timer and switching datasets discard unapplied selections", async ({
  page,
}) => {
  await setup(page);
  await pick(page, 55).check();
  await choose(page, cubeName);
  await page.getByRole("button", { name: "Courses", exact: true }).click();
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await expect(toolbar(page)).toHaveCount(0);
  if (!(await history(page).evaluate((el) => el.open)))
    await page.getByText("Solve history (55)", { exact: true }).click();
  await button(page, "Select solves").click();
  await expect(toolbar(page)).toContainText("0 selected");
  await pick(page, 55).check();
  await openSettings(page);
  await page
    .getByRole("checkbox", { name: "Enable test data", exact: true })
    .check();
  await closeSettings(page);
  await expect(toolbar(page)).toHaveCount(0);
  await openSettings(page);
  await page
    .getByRole("checkbox", { name: "Enable test data", exact: true })
    .uncheck();
  await closeSettings(page);
  expect(await saved(page)).toEqual(records());
  await expect(toolbar(page)).toHaveCount(0);
});

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  for (const theme of ["light", "dark"]) {
    test(`bulk solve actions fit ${viewport.width}x${viewport.height} in ${theme}`, async ({
      page,
      isMobile,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await setup(page, theme);
      if (isMobile) await pick(page, 55).tap();
      else await pick(page, 55).check();
      await choose(page, cubeName, isMobile);
      for (const control of await toolbar(page)
        .locator("button, label")
        .all()) {
        // Center before measuring: nearest-edge scrolling can leave a fractional
        // CSS pixel outside the viewport after Chromium rounds the scroll offset.
        await control.evaluate((element) =>
          element.scrollIntoView({
            block: "center",
            inline: "nearest",
            behavior: "instant",
          }),
        );
        const box = await control.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      }
      await toolbar(page).scrollIntoViewIfNeeded();
      await captureScreenshot(toolbar(page), {
        path: testInfo.outputPath("bulk-solve-toolbar.png"),
      });
      const row = page.locator("#timer-history-list li").first();
      const box = await row.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      await button(page, "Apply cube").click();
      await expect(page.locator("#timer-solve-s54")).toContainText(cubeName);
      await captureScreenshot(row, {
        path: testInfo.outputPath("bulk-solve-assigned-row.png"),
      });
      if (isMobile) await pick(page, 55).tap();
      else await pick(page, 55).check();
      await button(page, "Delete selected").click();
      await button(page, "Cancel").scrollIntoViewIfNeeded();
      await expect(button(page, "Cancel")).toBeInViewport();
      await captureScreenshot(toolbar(page), {
        path: testInfo.outputPath("bulk-solve-confirm.png"),
      });
      await button(page, "Cancel").click();
      await button(page, "Done").click();
      expect((await saved(page)).at(-1)).toMatchObject({
        cubeId: "keep",
        penalty: "+2",
        notes: "Keep my note",
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });
  }
}
