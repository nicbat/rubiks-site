import { readFile } from "node:fs/promises";
import {
  test,
  expect,
  seed,
  progressFixture,
  openSettings,
  closeSettings,
  holdStartTimer,
  reviewSolve,
} from "./fixtures.js";

const keys = [
  "last-layer.progress.v2",
  "last-layer.solves.v1",
  "last-layer.cubes.v1",
  "last-layer.restore.v1",
];
const personalBytes = (page) =>
  page.evaluate((keys) => keys.map((key) => localStorage.getItem(key)), keys);
async function populate(page) {
  await page.clock.install({ time: new Date("2026-10-17T19:00:00Z") });
  await seed(page, progressFixture());
  await page.evaluate(() => {
    localStorage.setItem(
      "last-layer.cubes.v1",
      JSON.stringify({
        defaultId: "personal",
        cubes: [{ id: "personal", name: "My cube", description: "" }],
      }),
    );
    localStorage.setItem(
      "last-layer.solves.v1",
      JSON.stringify([
        {
          id: "personal-solve",
          cubeId: "personal",
          elapsed: 42000,
          date: "2026-10-16T18:00:00Z",
          day: "2026-10-16",
          scramble: Array(10).fill("R U").join(" "),
          notes: "Personal solve",
        },
      ]),
    );
  });
  await page.goto("/#/progress");
  await page.reload();
  return personalBytes(page);
}
async function setTestData(page, enabled) {
  await openSettings(page);
  await page
    .getByRole("checkbox", { name: "Enable test data", exact: true })
    .setChecked(enabled);
  await expect(page.locator("#test-data")).toBeFocused();
  await closeSettings(page);
  await expect(
    page.getByRole("status", { name: "Test data mode" }),
  ).toHaveCount(enabled ? 1 : 0);
}
async function exportData(page, testMode = true) {
  await page.getByRole("button", { name: /^Local progress/ }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export progress", exact: true })
    .click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(
    `last-layer-${testMode ? "test-data-" : ""}2026-10-17.json`,
  );
  const data = JSON.parse(await readFile(await file.path(), "utf8"));
  await page.getByRole("button", { name: "Close backup", exact: true }).click();
  return data;
}

test("test-data checkbox and label stay in sync with the active dataset after pointer and keyboard changes", async ({
  page,
}) => {
  const before = await populate(page);
  await openSettings(page);
  const toggle = page.getByRole("checkbox", {
    name: "Enable test data",
    exact: true,
  });
  const label = page.locator("label").filter({ has: toggle });
  const savedMode = () =>
    page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("last-layer.preferences.v1"))?.testData,
    );
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(toggle).toBeChecked();
  await expect(toggle.locator("svg")).toHaveCount(1);
  expect(await savedMode()).toBe(true);
  // Publishing another setting must retain the checkbox's selected state.
  await page
    .getByRole("checkbox", { name: "Hide timer while solving", exact: true })
    .click();
  await expect(toggle).toBeChecked();
  await expect(toggle.locator("svg")).toHaveCount(1);
  await label.click({ position: { x: 100, y: 22 } });
  await expect(toggle).not.toBeChecked();
  await expect(toggle.locator("svg")).toHaveCount(0);
  expect(await savedMode()).toBe(false);
  await toggle.focus();
  await toggle.press("Space");
  await expect(toggle).toBeChecked();
  await expect(toggle.locator("svg")).toHaveCount(1);
  expect(await savedMode()).toBe(true);
  await closeSettings(page);
  await expect(
    page.getByRole("status", { name: "Test data mode" }),
  ).toBeVisible();
  await page.reload();
  await openSettings(page);
  await expect(toggle).toBeChecked();
  await expect(toggle.locator("svg")).toHaveCount(1);
  await toggle.press("Space");
  await expect(toggle).not.toBeChecked();
  await closeSettings(page);
  await expect(
    page.getByRole("status", { name: "Test data mode" }),
  ).toHaveCount(0);
  expect(await personalBytes(page)).toEqual(before);
});

test("test mode switches all training views, isolates edits and timer saves, and resets on reload", async ({
  page,
}) => {
  const before = await populate(page);
  await setTestData(page, true);
  const samples = await exportData(page);
  expect(samples.solves.length).toBeGreaterThan(7000);
  expect(samples.progress.attempts.length).toBeGreaterThan(2000);
  await expect(page.locator("#case-map-PLL")).toContainText("Already known");
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await page
    .getByText(`Solve history (${samples.solves.length})`, { exact: true })
    .click();
  const review = await reviewSolve(page);
  await review.getByLabel("Notes (optional)").fill("Sample edit only");
  await page
    .getByRole("button", { name: "Close solve details", exact: true })
    .click();
  await holdStartTimer(page);
  await page.clock.runFor(23450);
  await page.getByRole("button", { name: "Stop timer", exact: true }).click();
  const edited = await exportData(page);
  expect(edited.solves).toHaveLength(samples.solves.length + 1);
  expect(edited.solves.some((s) => s.notes === "Sample edit only")).toBe(true);
  expect(await personalBytes(page)).toEqual(before);
  await setTestData(page, false);
  await expect(
    page.getByText("Solve history (1)", { exact: true }),
  ).toBeVisible();
  expect((await exportData(page, false)).solves[0].notes).toBe(
    "Personal solve",
  );
  await setTestData(page, true);
  expect((await exportData(page)).solves).toHaveLength(edited.solves.length);
  await page.reload();
  await expect(
    page.getByRole("status", { name: "Test data mode" }),
  ).toBeVisible();
  expect((await exportData(page)).solves).toHaveLength(samples.solves.length);
  await setTestData(page, false);
  await page.reload();
  await expect(
    page.getByRole("status", { name: "Test data mode" }),
  ).toHaveCount(0);
  expect(await personalBytes(page)).toEqual(before);
});

test("deleting a sample day and importing a backup affect only the active test dataset", async ({
  page,
}) => {
  const before = await populate(page);
  await setTestData(page, true);
  const samples = await exportData(page);
  await page
    .getByRole("button", { name: /^2026-10-17: \d+ activities$/ })
    .click();
  await page
    .getByRole("button", { name: "Delete day’s activity", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete this day", exact: true })
    .click();
  const deleted = await exportData(page);
  expect(deleted.solves.some((s) => s.day === "2026-10-17")).toBe(false);
  expect(deleted.progress.attempts.some((a) => a.day === "2026-10-17")).toBe(
    false,
  );
  expect(await personalBytes(page)).toEqual(before);
  samples.solves = samples.solves.slice(-2);
  await page.getByRole("button", { name: /^Local progress/ }).click();
  await expect(page.getByRole("dialog")).toContainText("imports replace only");
  await page.getByLabel("Choose backup file").setInputFiles({
    name: "samples.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(samples)),
  });
  await page
    .getByRole("button", { name: "Replace with this backup", exact: true })
    .click();
  expect((await exportData(page)).solves).toHaveLength(2);
  expect(await personalBytes(page)).toEqual(before);
  await setTestData(page, false);
  expect((await exportData(page, false)).solves).toHaveLength(1);
});

test("test data settings and populated progress fit portrait and short landscape in both themes", async ({
  page,
}, testInfo) => {
  const before = await populate(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["light", "dark"]) {
    for (const viewport of [
      { width: 320, height: 720 },
      { width: 667, height: 375 },
    ]) {
      await page.setViewportSize(viewport);
      await page.evaluate(
        (theme) => localStorage.setItem("last-layer-theme", theme),
        theme,
      );
      await page.reload();
      await openSettings(page);
      const toggle = page.getByRole("checkbox", {
        name: "Enable test data",
        exact: true,
      });
      await toggle.setChecked(true);
      await toggle.scrollIntoViewIfNeeded();
      const label = await page
        .locator("label")
        .filter({ has: toggle })
        .boundingBox();
      expect(label.height).toBeGreaterThanOrEqual(44);
      expect(label.x).toBeGreaterThanOrEqual(0);
      expect(label.x + label.width).toBeLessThanOrEqual(viewport.width);
      await page.screenshot({
        path: testInfo.outputPath(
          `test-settings-${theme}-${viewport.width}.png`,
        ),
      });
      await closeSettings(page);
      await page
        .getByRole("button", { name: /^2026-10-17: \d+ activities$/ })
        .click();
      await expect(
        page.getByRole("region", { name: "Selected day timer solves" }),
      ).toContainText("Individual solves (36)");
      await page.getByRole("button", { name: "Solves", exact: true }).click();
      const bounds = await page
        .locator(
          "main .dashboard-toolbar, main .activity-detail, main [data-slot='chart'], [aria-label='Test data mode']",
        )
        .evaluateAll((els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect();
            return { left: r.left, right: r.right };
          }),
        );
      for (const r of bounds) {
        expect(r.left).toBeGreaterThanOrEqual(0);
        expect(r.right).toBeLessThanOrEqual(viewport.width);
      }
      await page.screenshot({
        path: testInfo.outputPath(
          `test-progress-${theme}-${viewport.width}.png`,
        ),
        fullPage: true,
      });
      await setTestData(page, false);
      expect(await personalBytes(page)).toEqual(before);
    }
  }
});
