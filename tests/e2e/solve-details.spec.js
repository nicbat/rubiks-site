import { openProgress } from "./fixtures.js";
import { cube3x3x3 } from "cubing/puzzles";
import { assertOracleFacelets } from "../helpers/cube-oracle.js";
import {
  test,
  expect,
  reviewSolve,
  deleteReviewedSolve,
  holdStartTimer,
  importBackup,
} from "./fixtures.js";

const key = "last-layer.solves.v1";
const records = () => [
  {
    id: "old",
    cubeId: "retired",
    elapsed: 12340,
    date: "2026-10-10T12:00:00Z",
    day: "2026-10-10",
    scramble: Array(10).fill("R U").join(" "),
  },
  {
    id: "new",
    cubeId: "main",
    elapsed: 23450,
    date: "2026-10-11T12:00:00Z",
    day: "2026-10-11",
    scramble: Array(10).fill("F D'").join(" "),
  },
];
const cubes = {
  defaultId: "main",
  cubes: [
    { id: "main", name: "Main cube", description: "" },
    { id: "travel", name: "Travel cube", description: "" },
    { id: "retired", name: "Old cube", description: "", deleted: true },
  ],
};
const saved = (page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
async function setup(page, longName = false) {
  await page.goto("/");
  await page.evaluate(
    ({ solves, cubes }) => {
      localStorage.setItem("last-layer.solves.v1", JSON.stringify(solves));
      localStorage.setItem("last-layer.cubes.v1", JSON.stringify(cubes));
    },
    {
      solves: records(),
      cubes: longName
        ? {
            ...cubes,
            cubes: cubes.cubes.map((c) => ({
              ...c,
              name: (c.name + " long cube name".repeat(6)).slice(0, 100),
            })),
          }
        : cubes,
    },
  );
  await page.goto("/#/timer");
  await page.reload();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByText("Solve history (2)", { exact: true }).click();
}

test("finished solve review is optional and leaves Next scramble and timer shortcuts intact", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/#/timer");
  const scramble = await page.locator("#timer-scramble").textContent();
  await holdStartTimer(page);
  await page.clock.runFor(1234);
  await page.getByRole("button", { name: "Stop timer", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const review = page.getByRole("button", {
    name: "Review solve",
    exact: true,
  });
  await expect(
    page.getByRole("button", { name: "Next scramble (Tab)" }),
  ).toBeVisible();
  await review.click();
  const dialog = page.getByRole("dialog", { name: "Solve details" });
  await expect(dialog).toContainText(scramble);
  const notes = dialog.getByLabel("Notes (optional)");
  await notes.fill("Cross pause");
  await notes.press("End");
  await notes.press("Space");
  await notes.press("Backspace");
  await notes.press("Tab");
  expect((await saved(page))[0].notes).toBe("Cross pause");
  await page.keyboard.press("Escape");
  await expect(review).toBeFocused();
  await page.getByRole("button", { name: "Next scramble (Tab)" }).click();
  await expect(
    page.getByRole("button", { name: "Hold to start (Space)" }),
  ).toBeVisible();
  expect(await saved(page)).toHaveLength(1);
});

test("deleting the just-finished solve with history collapsed returns focus to the timer", async ({
  page,
}) => {
  await page.clock.install();
  await setup(page);
  await page.getByText("Solve history (2)", { exact: true }).click();
  await holdStartTimer(page);
  await page.clock.runFor(1500);
  await page.getByRole("button", { name: "Stop timer", exact: true }).click();
  await page.getByRole("button", { name: "Review solve", exact: true }).click();
  await deleteReviewedSolve(page);
  await expect(
    page.getByRole("button", { name: "Hold to start (Space)", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".timer-history")).not.toHaveAttribute("open");
  expect(await saved(page)).toEqual(records());
});

test("saved solve details share cube styling, preview exact historical stickers, and persist notes", async ({
  page,
}) => {
  await setup(page);
  const before = await saved(page);
  const row = page.getByRole("button", {
    name: "Review solve 0:12.34",
    exact: true,
  });
  const dialog = await reviewSolve(page, "0:12.34");
  const picker = dialog.getByRole("combobox", { name: "Cube for this solve" });
  await expect(picker).toHaveAttribute("data-slot", "select-trigger");
  await expect(picker).toContainText("Old cube");
  await picker.focus();
  await picker.press("ArrowDown");
  await expect(
    page.getByRole("option", { name: "Old cube", exact: true }),
  ).toBeVisible();
  await picker.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(picker).toBeFocused();
  await picker.click();
  await page.getByRole("option", { name: "Travel cube", exact: true }).click();
  await expect(picker).toBeFocused();
  await expect(picker).toContainText("Travel cube");
  await picker.click();
  await expect(
    page.getByRole("option", { name: "Old cube", exact: true }),
  ).toHaveCount(0);
  await picker.press("Escape");
  await expect(page.locator("#timer-cube")).toContainText("Main cube");
  await dialog
    .getByRole("button", { name: "Preview cube", exact: true })
    .click();
  const player = dialog.getByRole("region", { name: "3D cube player" });
  const stickers = await player.locator("[data-color]").evaluateAll((els) =>
    els.map((el) => ({
      p: el.dataset.position.split(",").map(Number),
      n: el.dataset.normal.split(",").map(Number),
      color: el.dataset.color,
    })),
  );
  const puzzle = await cube3x3x3.kpuzzle();
  assertOracleFacelets(
    stickers,
    puzzle.defaultPattern().applyAlg(before[0].scramble),
    "saved solve scramble",
  );
  const notes = dialog.getByLabel("Notes (optional)");
  const text = "Cross pause\nTry <b>slow turns</b> 🧊";
  await notes.fill(text);
  await expect(notes).toBeFocused();
  await expect(notes).toHaveValue(text);
  await expect(dialog.locator("b")).toHaveCount(0);
  const after = await saved(page);
  expect(after).toEqual([
    { ...before[0], cubeId: "travel", notes: text },
    before[1],
  ]);
  await page.keyboard.press("Escape");
  await expect(row).toBeFocused();
  await expect(row).toContainText("Note");
  await expect(
    page.getByRole("region", { name: "3D cube player" }),
  ).toHaveCount(0);
  await reviewSolve(page, "0:23.45");
  await expect(notes).toHaveValue("");
  await expect(
    dialog.getByRole("region", { name: "3D cube player" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByText("Solve history (2)", { exact: true }).click();
  await reviewSolve(page, "0:12.34");
  await expect(notes).toHaveValue(text);
  await notes.fill("");
  expect((await saved(page))[0]).not.toHaveProperty("notes");
});

test("note write failures retain drafts and stored bytes, retry succeeds, and failed deletion preserves the solve", async ({
  page,
}) => {
  await setup(page);
  const original = await saved(page);
  const dialog = await reviewSolve(page, "0:12.34");
  await page.evaluate(() => {
    window.rejectSolveWrites = true;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "last-layer.solves.v1" && window.rejectSolveWrites)
        throw new DOMException("Full", "QuotaExceededError");
      return setItem.call(this, key, value);
    };
  });
  await dialog.getByLabel("Notes (optional)").fill("Keep my draft");
  await expect(dialog.locator("#solve-save-status")).toContainText(
    "couldn’t be saved",
  );
  expect(await saved(page)).toEqual(original);
  await page.keyboard.press("Escape");
  await reviewSolve(page, "0:12.34");
  await expect(dialog.getByLabel("Notes (optional)")).toHaveValue(
    "Keep my draft",
  );
  await dialog
    .getByRole("button", { name: "Delete solve", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Delete solve", exact: true })
    .click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Notes (optional)")).toHaveValue(
    "Keep my draft",
  );
  expect(await saved(page)).toEqual(original);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.evaluate(() => (window.rejectSolveWrites = false));
  await dialog.getByRole("button", { name: "Retry saving" }).click();
  await expect(dialog.locator("#solve-save-status")).toContainText(
    "Saved on this device",
  );
  expect((await saved(page))[0].notes).toBe("Keep my draft");
  await deleteReviewedSolve(page);
  await expect(
    page.getByText("Solve history (1)", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review solve 0:23.45", exact: true }),
  ).toBeFocused();
  expect(await saved(page)).toEqual([original[1]]);
});

test("copy scramble reports success and clipboard failures without losing notes", async ({
  page,
}) => {
  await setup(page);
  const dialog = await reviewSolve(page, "0:12.34");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value) => {
          window.copiedScramble = value;
        },
      },
    }),
  );
  await dialog.getByRole("button", { name: "Copy scramble" }).click();
  await expect(
    dialog.getByRole("status").filter({ hasText: "Scramble copied." }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.copiedScramble)).toBe(
    records()[0].scramble,
  );
  await page.evaluate(
    () =>
      (navigator.clipboard.writeText = async () => {
        throw Error("Denied");
      }),
  );
  await dialog.getByRole("button", { name: "Copy scramble" }).click();
  await expect(dialog).toContainText("Copy unavailable");
  expect(await saved(page)).toEqual(records());
});

test("notes survive browser backup restore, and malformed note imports preserve existing data", async ({
  page,
}) => {
  await setup(page);
  await reviewSolve(page, "0:12.34");
  await page.getByLabel("Notes (optional)").fill("Saved in backup");
  await page.keyboard.press("Escape");
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Backup and transfer training data" })
    .click();
  await page.getByRole("button", { name: "Export progress" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const backup = JSON.parse(Buffer.concat(chunks).toString());
  expect(backup.solves[0].notes).toBe("Saved in backup");
  await page.getByRole("button", { name: "Close backup" }).click();
  await reviewSolve(page, "0:12.34");
  await page.getByLabel("Notes (optional)").fill("Newer draft");
  await page.keyboard.press("Escape");
  const beforeBadImport = await saved(page);
  await importBackup(page, {
    ...backup,
    solves: [{ ...backup.solves[0], notes: {} }],
  });
  await expect(page.locator("#import-message")).toContainText(
    "Invalid solve history",
  );
  expect(await saved(page)).toEqual(beforeBadImport);
  await page.getByLabel("Choose backup file").setInputFiles({
    name: "valid.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.getByRole("button", { name: "Replace with this backup" }).click();
  await page.goto("/#/timer");
  await page.getByText("Solve history (2)", { exact: true }).click();
  await reviewSolve(page, "0:12.34");
  await expect(page.getByLabel("Notes (optional)")).toHaveValue(
    "Saved in backup",
  );
});

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  for (const theme of ["light", "dark"]) {
    test(`solve details, dropdown and preview fit ${viewport.width}x${viewport.height} ${theme}`, async ({
      page,
    }, testInfo) => {
      await page.clock.install({ time: new Date("2026-10-17T19:00:00Z") });
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await setup(page, true);
      const dialog = await reviewSolve(page, "0:12.34");
      const picker = dialog.getByRole("combobox", {
        name: "Cube for this solve",
      });
      await picker.click();
      const option = page.getByRole("option", { name: /^Travel cube/ });
      await option.scrollIntoViewIfNeeded();
      const box = await option.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      await option.click();
      await dialog
        .getByRole("button", { name: "Preview cube", exact: true })
        .click();
      const image = dialog.getByRole("img", { name: /cube/i });
      await image.scrollIntoViewIfNeeded();
      await image.focus();
      const camera = dialog.locator(".cube-camera");
      const angle = await camera.getAttribute("style");
      await image.press("ArrowRight");
      await expect(camera).not.toHaveAttribute("style", angle);
      await page.screenshot({ path: testInfo.outputPath("solve-preview.png") });
      const notes = dialog.getByLabel("Notes (optional)");
      await notes.fill("Long note ".repeat(60));
      expect(
        await notes.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      ).toBeGreaterThanOrEqual(16);
      for (const field of [
        picker,
        notes,
        dialog.getByRole("button", { name: "Delete solve", exact: true }),
        dialog.getByRole("button", { name: "Close solve details" }),
      ]) {
        await field.scrollIntoViewIfNeeded();
        const bounds = await field.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
        expect(bounds.height).toBeGreaterThanOrEqual(44);
      }
      await notes.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath("solve-notes.png") });
      expect(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      const close = dialog.getByRole("button", { name: "Close solve details" });
      const closeBox = await close.boundingBox();
      expect(closeBox.y).toBeGreaterThanOrEqual(0);
      expect(closeBox.y + closeBox.height).toBeLessThanOrEqual(viewport.height);
      await dialog
        .getByRole("button", { name: "Delete solve", exact: true })
        .click();
      await expect(
        dialog.getByRole("button", { name: "Cancel", exact: true }),
      ).toBeFocused();
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await close.click();
      await expect(
        page.getByRole("button", { name: "Review solve 0:12.34", exact: true }),
      ).toBeFocused();
      await page.screenshot({
        path: testInfo.outputPath("solve-history.png"),
        fullPage: true,
      });
      await openProgress(page);
      const overall = page.getByRole("region", {
        name: "All-time timer solves",
        exact: true,
      });
      await overall.getByText("Individual solves (2)", { exact: true }).click();
      const dailyRow = page.locator("#daily-solve-old");
      await dailyRow.click();
      await expect(notes).toHaveValue("Long note ".repeat(60));
      await notes.scrollIntoViewIfNeeded();
      const noteBounds = await notes.boundingBox();
      expect(noteBounds.x).toBeGreaterThanOrEqual(0);
      expect(noteBounds.x + noteBounds.width).toBeLessThanOrEqual(
        viewport.width,
      );
      await page.screenshot({
        path: testInfo.outputPath("progress-review.png"),
      });
      await close.click();
      await expect(dailyRow).toBeFocused();
      await page.getByRole("button", { name: "Solves", exact: true }).click();
      const trends = page.getByRole("region", {
        name: "Solve trends",
        exact: true,
      });
      await trends.getByText("Recent results (2)", { exact: true }).click();
      const recentRow = page.locator("#recent-solve-old");
      await recentRow.click();
      await expect(notes).toHaveValue("Long note ".repeat(60));
      await close.click();
      await expect(recentRow).toBeFocused();
      const rowBounds = await recentRow.boundingBox();
      expect(rowBounds.x).toBeGreaterThanOrEqual(0);
      expect(rowBounds.x + rowBounds.width).toBeLessThanOrEqual(viewport.width);
      expect(rowBounds.height).toBeGreaterThanOrEqual(44);
      await page.screenshot({
        path: testInfo.outputPath("progress-history.png"),
        fullPage: true,
      });
    });
  }
}

test("Progress histories share solve reviews, keep the right opener focused, and refresh filtered results", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-17T19:00:00Z") });
  await setup(page);
  const original = await saved(page);
  await openProgress(page);
  const overall = page.getByRole("region", {
    name: "All-time timer solves",
    exact: true,
  });
  await overall.getByText("Individual solves (2)", { exact: true }).click();
  await page.getByRole("button", { name: "Solves", exact: true }).click();
  const trends = page.getByRole("region", {
    name: "Solve trends",
    exact: true,
  });
  await trends.getByText("Recent results (2)", { exact: true }).click();
  const recent = page.locator("#recent-solve-old");
  const daily = page.locator("#daily-solve-old");
  await expect(recent).toHaveAccessibleDescription(/Old cube/);
  await recent.click();
  const dialog = page.getByRole("dialog", {
    name: "Solve details",
    exact: true,
  });
  await dialog.getByLabel("Notes (optional)").fill("Reviewed from Progress");
  await dialog.getByRole("button", { name: "+2 sec", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Preview cube", exact: true })
    .click();
  await expect(
    dialog.getByRole("region", { name: "3D cube player" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close solve details" }).click();
  await expect(recent).toBeFocused();
  for (const row of [recent, daily]) {
    await expect(row).toContainText("0:14.34");
    await expect(row).toContainText("Note");
    await expect(row).toContainText("+2");
  }
  await page.getByRole("combobox", { name: "Filter solves by cube" }).click();
  await page
    .getByRole("option", { name: "Old cube (deleted)", exact: true })
    .click();
  await recent.click();
  const cube = dialog.getByRole("combobox", { name: "Cube for this solve" });
  await cube.click();
  await page.getByRole("option", { name: "Travel cube", exact: true }).click();
  await page.getByRole("button", { name: "Close solve details" }).click();
  await expect(
    trends.getByRole("heading", { name: "No solves in this selection" }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Filter solves by cube" }),
  ).toBeFocused();
  await expect(daily).toContainText("Travel cube");
  await page.getByRole("combobox", { name: "Filter solves by cube" }).click();
  await page.getByRole("option", { name: "Travel cube", exact: true }).click();
  const point = trends.getByRole("link", {
    name: "Solve 1: 0:14.34 (+2)",
    exact: true,
  });
  await point.click();
  await expect(dialog.getByLabel("Notes (optional)")).toHaveValue(
    "Reviewed from Progress",
  );
  await page.keyboard.press("Escape");
  await expect(point).toBeFocused();
  await point.click();
  await deleteReviewedSolve(page);
  await expect(
    page.getByRole("combobox", { name: "Filter solves by cube" }),
  ).toBeFocused();
  await expect(trends).toContainText("0 solves");
  expect(await saved(page)).toEqual([original[1]]);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await page.getByText("Solve history (1)", { exact: true }).click();
  await expect(page.locator("#timer-solve-new")).toBeVisible();
});

test("daily chart reviews preserve selection, and deleting the only solve returns focus to the day", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-17T19:00:00Z") });
  await setup(page);
  await openProgress(page);
  await page
    .getByRole("button", { name: "2026-10-10: 1 activities", exact: true })
    .click();
  const region = page.getByRole("region", {
    name: "Selected day timer solves",
  });
  await region
    .getByRole("button", { name: "Review solve", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Solve details" });
  await dialog.getByLabel("Notes (optional)").fill("Selected day note");
  await page.keyboard.press("Escape");
  await expect(
    region.getByRole("button", { name: "Review solve", exact: true }),
  ).toBeFocused();
  await expect(
    region.getByRole("region", { name: "Selected solve details" }),
  ).toContainText("Solve 1");
  await region.getByText("Individual solves (1)", { exact: true }).click();
  await page.locator("#daily-solve-old").click();
  await expect(dialog.getByLabel("Notes (optional)")).toHaveValue(
    "Selected day note",
  );
  await deleteReviewedSolve(page);
  await expect(region).toHaveCount(0);
  await expect(page.locator("#activity-detail-title")).toBeFocused();
  await expect(page.locator(".activity-detail")).toContainText(
    "No activity recorded on this day",
  );
  expect((await saved(page)).map((solve) => solve.id)).toEqual(["new"]);
});
