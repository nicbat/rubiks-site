import { readFile } from "node:fs/promises";
import {
  test,
  expect,
  holdStartTimer,
  deleteReviewedSolve,
  openSettings,
  closeSettings,
  progressFixture,
} from "./fixtures.js";

const key = "last-layer.solves.v1";
const records = () =>
  Array.from({ length: 125 }, (_, index) => ({
    id: `s${String(index).padStart(3, "0")}`,
    elapsed: index === 0 ? 100 : (index + 1) * 1000,
    date: new Date(Date.UTC(2026, 9, 16, 18, 0, index)).toISOString(),
    day: "2026-10-16",
    scramble: Array(10).fill("R U").join(" "),
  }));
const rows = (page) =>
  page.locator(".timer-history").getByRole("button", {
    name: /^Review solve /,
  });
const more = (page) =>
  page.getByRole("button", { name: "Show more", exact: true });
const saved = (page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
const rowIds = (page) =>
  rows(page).evaluateAll((buttons) =>
    buttons.map((button) => button.dataset.id),
  );
async function setup(page, theme = "light") {
  await page.goto("/");
  await page.evaluate(
    ({ key, solves, theme }) => {
      localStorage.setItem(key, JSON.stringify(solves));
      localStorage.setItem("last-layer-theme", theme);
    },
    { key, solves: records(), theme },
  );
  await page.goto("/#/timer");
  await page.reload();
  await page.getByText("Solve history (125)", { exact: true }).click();
  await expect(rows(page)).toHaveCount(50);
}
async function expectShowing(page, shown, total) {
  await expect(page.locator(".timer-history").getByRole("status")).toHaveText(
    `Showing ${shown} of ${total} solves.`,
  );
}

test("history pages newest first without truncating exports, and preserves expanded reviews and deletion focus", async ({
  page,
}) => {
  await setup(page);
  const newestFirst = records().reverse();
  expect(await rowIds(page)).toEqual(newestFirst.slice(0, 50).map((s) => s.id));
  await expectShowing(page, 50, 125);
  await expect(more(page)).toHaveAttribute(
    "aria-controls",
    "timer-history-list",
  );
  const stats = page.getByRole("region", { name: "Recent solve statistics" });
  await expect(stats).toContainText("Average: 2:03.00");
  await expect(stats).toContainText("Best: 2:01.00");
  await expect(stats).toContainText("Average: 1:59.50");
  await expect(stats).toContainText("Best: 1:54.00");

  await page
    .getByRole("button", {
      name: "Backup and transfer local progress",
      exact: true,
    })
    .click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export progress", exact: true })
    .click();
  const file = await download;
  const exported = JSON.parse(await readFile(await file.path(), "utf8"));
  expect(exported.solves).toEqual(records());
  await page.getByRole("button", { name: "Close backup", exact: true }).click();
  await expect(rows(page)).toHaveCount(50);

  await more(page).click();
  await expect(rows(page)).toHaveCount(100);
  await expectShowing(page, 100, 125);
  expect(await rowIds(page)).toEqual(
    newestFirst.slice(0, 100).map((s) => s.id),
  );
  await expect(more(page)).toBeFocused();
  const edited = page.locator("#timer-solve-s025");
  await edited.click();
  const dialog = page.getByRole("dialog", {
    name: "Solve details",
    exact: true,
  });
  await dialog.getByLabel("Notes (optional)").fill("Older page note");
  await dialog.getByRole("button", { name: "+2 sec", exact: true }).click();
  await page
    .getByRole("button", { name: "Close solve details", exact: true })
    .click();
  await expect(rows(page)).toHaveCount(100);
  await expect(edited).toBeFocused();
  await expect(edited).toHaveAccessibleName("Review solve 0:28.00 (+2)");
  await expect(edited).toContainText("Note");
  expect((await saved(page)).find((s) => s.id === "s025")).toMatchObject({
    notes: "Older page note",
    elapsed: 26000,
    penalty: "+2",
  });

  await edited.click();
  await deleteReviewedSolve(page);
  await expect(rows(page)).toHaveCount(100);
  await expect(page.locator("#timer-solve-s024")).toBeFocused();
  await expectShowing(page, 100, 124);
  const remaining = newestFirst.filter((s) => s.id !== "s025");
  expect(await rowIds(page)).toEqual(remaining.slice(0, 100).map((s) => s.id));
  await more(page).focus();
  await more(page).press("Enter");
  await expect(rows(page)).toHaveCount(124);
  await expectShowing(page, 124, 124);
  await expect(more(page)).toHaveCount(0);
  await expect(page.locator("#timer-solve-s000")).toBeFocused();
  expect(await rowIds(page)).toEqual(remaining.map((s) => s.id));
  expect(await saved(page)).toHaveLength(124);
});

test("new solves retain the expanded limit while running disables pagination, and returning to Timer resets to the latest fifty", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-17T19:00:00Z") });
  await setup(page);
  await more(page).click();
  await expect(rows(page)).toHaveCount(100);
  await holdStartTimer(page);
  await expect(more(page)).toBeDisabled();
  await expect(rows(page).first()).toBeDisabled();
  await expect(rows(page)).toHaveCount(100);
  await page.clock.fastForward(2345);
  await page.getByRole("button", { name: "Stop timer", exact: true }).click();
  await expect(rows(page)).toHaveCount(100);
  await expectShowing(page, 100, 126);
  await expect(more(page)).toBeEnabled();
  const all = await saved(page);
  const added = all.find((solve) => !records().some((s) => s.id === solve.id));
  expect(added.elapsed).toBeGreaterThanOrEqual(2345);
  expect(await rowIds(page)).toEqual(
    all
      .slice(-100)
      .reverse()
      .map((s) => s.id),
  );
  await page.getByRole("button", { name: "Courses", exact: true }).click();
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  const summary = page.getByText("Solve history (126)", { exact: true });
  if (
    !(await page.locator(".timer-history").evaluate((details) => details.open))
  ) {
    await summary.click();
  }
  await expect(rows(page)).toHaveCount(50);
  await expectShowing(page, 50, 126);
  expect(await rowIds(page)).toEqual(
    all
      .slice(-50)
      .reverse()
      .map((s) => s.id),
  );
  expect((await rowIds(page))[0]).toBe(added.id);
});

test("replacing a backup and switching datasets reset expanded history without losing personal solves", async ({
  page,
}) => {
  await setup(page);
  await more(page).click();
  await expect(rows(page)).toHaveCount(100);
  await page
    .getByRole("button", {
      name: "Backup and transfer local progress",
      exact: true,
    })
    .click();
  await page.getByLabel("Choose backup file").setInputFiles({
    name: "full-history.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format: "last-layer-training",
        version: 1,
        progress: progressFixture(),
        solves: records(),
        cubeCollection: { defaultId: null, cubes: [] },
      }),
    ),
  });
  await page
    .getByRole("button", { name: "Replace with this backup", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await page.getByText("Solve history (125)", { exact: true }).click();
  await expect(rows(page)).toHaveCount(50);
  await expectShowing(page, 50, 125);
  await more(page).click();
  await expect(rows(page)).toHaveCount(100);

  await openSettings(page);
  await page
    .getByRole("checkbox", { name: "Enable test data", exact: true })
    .setChecked(true);
  await closeSettings(page);
  await expect(rows(page)).toHaveCount(50);
  await more(page).click();
  await expect(rows(page)).toHaveCount(100);
  await openSettings(page);
  await page
    .getByRole("checkbox", { name: "Enable test data", exact: true })
    .setChecked(false);
  await closeSettings(page);
  await expect(rows(page)).toHaveCount(50);
  await expectShowing(page, 50, 125);
  expect(await saved(page)).toEqual(records());
});

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  for (const theme of ["light", "dark"]) {
    test(`history pagination supports keyboard and fits ${viewport.width}x${viewport.height} in ${theme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await setup(page, theme);
      await more(page).focus();
      await more(page).press("Enter");
      await expect(rows(page)).toHaveCount(100);
      await expect(more(page)).toBeFocused();
      await more(page).scrollIntoViewIfNeeded();
      await expect(more(page)).toBeInViewport();
      const button = await more(page).boundingBox();
      expect(button.height).toBeGreaterThanOrEqual(44);
      expect(button.width).toBeGreaterThanOrEqual(44);
      expect(button.x).toBeGreaterThanOrEqual(0);
      expect(button.x + button.width).toBeLessThanOrEqual(viewport.width);
      for (const row of await rows(page).all()) {
        const box = await row.boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      }
      await page.screenshot({
        path: testInfo.outputPath("history-show-more.png"),
      });
      await more(page).press("Space");
      await expect(rows(page)).toHaveCount(125);
      await expectShowing(page, 125, 125);
      await expect(more(page)).toHaveCount(0);
      const oldest = page.getByRole("button", {
        name: "Review solve 0:00.10",
        exact: true,
      });
      await expect(oldest).toBeFocused();
      await expect(oldest).toBeInViewport();
      await page.screenshot({
        path: testInfo.outputPath("history-last-page.png"),
      });
      await oldest.press("Enter");
      await expect(
        page.getByRole("dialog", { name: "Solve details", exact: true }),
      ).toContainText("0:00.10");
      await page
        .getByRole("button", { name: "Close solve details", exact: true })
        .click();
      await expect(oldest).toBeFocused();
      await expect(rows(page)).toHaveCount(125);
    });
  }
}
