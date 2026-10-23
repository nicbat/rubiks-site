import { readFile } from "node:fs/promises";
import {
  test,
  expect,
  seed,
  saved,
  progressFixture,
  importBackup,
} from "./fixtures.js";
const SOLVES = "last-layer.solves.v1",
  CUBES = "last-layer.cubes.v1";
const date = "2026-10-17";
async function populate(page) {
  await page.clock.install({ time: new Date("2026-10-17T19:00:00Z") });
  const p = progressFixture();
  p.attempts = [
    {
      caseId: "pll-T",
      variant: 0,
      mode: "recognition",
      result: "help",
      day: date,
      at: `${date}T18:00:00Z`,
    },
    {
      caseId: "pll-T",
      variant: 0,
      mode: "rehearsal",
      result: "effort",
      day: date,
      at: `${date}T18:01:00Z`,
    },
  ];
  await seed(page, p);
  await page.evaluate(
    ({ SOLVES, CUBES, date }) => {
      localStorage.setItem(
        CUBES,
        JSON.stringify({
          cubes: [
            { id: "cube-a", name: "Practice cube", description: "" },
            { id: "old", name: "Retired cube", description: "", deleted: true },
          ],
          defaultId: "cube-a",
        }),
      );
      localStorage.setItem(
        SOLVES,
        JSON.stringify(
          Array.from({ length: 12 }, (_, i) => ({
            id: `s${i}`,
            elapsed: (i + 20) * 1000,
            date: `${date}T18:${String(i).padStart(2, "0")}:00Z`,
            day: date,
            cubeId: i < 5 ? "old" : "cube-a",
            scramble: Array(10).fill("R U").join(" "),
            ...(i === 11
              ? { penalty: "dnf" }
              : i === 0
                ? { penalty: "+2" }
                : {}),
          })),
        ),
      );
    },
    { SOLVES, CUBES, date },
  );
  await page.goto("/#/progress");
  await page.reload();
}
async function choose(page, label, value) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: value, exact: true }).click();
}
test("local dashboard combines activity, preserves identities and filters solve history", async ({
  page,
}) => {
  await populate(page);
  const ids = (await saved(page)).attempts.map((a) => a.id);
  expect(new Set(ids).size).toBe(2);
  expect(ids.every(Boolean)).toBe(true);
  await expect(
    page.getByRole("group", { name: "Timer summary", exact: true }),
  ).toContainText(/12\s*Solves/);
  await page
    .getByRole("button", { name: "2026-10-17: 14 activities", exact: true })
    .click();
  await expect(page.locator(".activity-detail")).toContainText(
    /Hidden practice\s*1/,
  );
  await expect(page.locator(".activity-detail")).toContainText(
    /Rehearsals\s*1/,
  );
  const daily = page.getByRole("region", { name: "Selected day timer solves" });
  await expect(
    page
      .getByRole("group", { name: "Timer summary", exact: true })
      .getByText("Best single", { exact: true })
      .locator(".."),
  ).toContainText("0:21.00");
  await expect(
    page.getByRole("group", {
      name: "Solve timeline: select a solve to see details",
    }),
  ).toBeVisible();
  await expect(page.locator(".daily-distribution")).toHaveCount(0);
  await expect(daily.locator('[data-slot="chart"]')).toHaveCount(1);
  await expect(daily.getByRole("list", { name: "Chart legend" })).toHaveCount(
    1,
  );
  await expect(daily.locator(".individual-times")).toHaveCount(0);
  await expect(daily.locator(".chart-legend").first()).toContainText("ao12");
  await page.getByRole("link", { name: "Solve 12: DNF", exact: true }).click();
  const selected = page.getByRole("region", { name: "Selected solve details" });
  await expect(selected).toContainText("Solve 12");
  await expect(selected).toContainText("DNF");
  await selected.getByRole("button", { name: "Previous solve" }).click();
  await expect(selected).toContainText("Solve 11");
  await choose(page, "Day’s solves by cube", "Retired cube (deleted)");
  await expect(
    daily.getByText("Individual solves (5)", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Solve 12: DNF", exact: true }),
  ).toHaveCount(0);
  await choose(page, "Day’s solves by cube", "Not specified");
  await expect(daily).toContainText("No solves in this selection.");
  await choose(page, "Day’s solves by cube", "All cubes");
  await daily.getByText("Individual solves (12)", { exact: true }).click();
  await expect(
    daily.locator(".daily-results").getByRole("listitem"),
  ).toHaveCount(12);
  await expect(
    daily.getByRole("button", {
      name: "Review solve 0:22.00 (+2)",
      exact: true,
    }),
  ).toBeVisible();
  await expect(daily).toContainText("Retired cube");
  await expect(daily).toContainText("DNF");
  await page.getByRole("button", { name: "OLL 57 cases", exact: true }).click();
  await expect(page.locator("#case-map-OLL")).toBeHidden();
  await expect(page.locator("#case-map-PLL")).toBeVisible();
  await page
    .getByRole("button", { name: "OLL 57 cases", exact: true })
    .press("Enter");
  await expect(page.locator("#case-map-OLL")).toBeVisible();
  await page
    .getByRole("button", { name: "2026-10-16: 0 activities", exact: true })
    .click();
  await expect(daily).toHaveCount(0);
  await expect(page.locator(".activity-detail")).toContainText(
    /Timer solves\s*0/,
  );
  await expect(page.locator(".activity-detail")).toContainText(
    "No activity recorded on this day.",
  );
  await expect(
    page.getByRole("button", { name: "2026-10-16: 0 activities", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "T perm: Needs practice", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close case", exact: true }).click();
  await page.getByRole("button", { name: "Solves", exact: true }).click();
  await expect(
    page.getByRole("group", { name: "Solve timeline: open a solve to review" }),
  ).toBeVisible();
  await expect(page.locator("main")).toContainText("12 solves · 1 DNF");
  await choose(page, "Filter solves by cube", "Retired cube (deleted)");
  await expect(page.locator("main")).toContainText("5 solves · 0 DNF");
  await page.getByText("Recent results (5)", { exact: true }).click();
  await expect(
    page
      .locator(".recent-solves")
      .getByRole("button", { name: "Review solve 0:22.00 (+2)", exact: true }),
  ).toBeVisible();
  await choose(page, "Filter solves by cube", "Not specified");
  await expect(
    page.getByRole("heading", { name: "No solves in this selection" }),
  ).toBeVisible();
  await page.reload();
  expect((await saved(page)).attempts.map((a) => a.id)).toEqual(ids);
});
test("full backup round-trips solves and cubes; invalid files and cancellation preserve all data", async ({
  page,
}, testInfo) => {
  await populate(page);
  const original = await page.evaluate(() =>
    Object.fromEntries(Object.entries(localStorage)),
  );
  await page
    .getByRole("button", { name: "Backup & transfer", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export progress", exact: true })
    .click();
  const path = testInfo.outputPath("training-backup.json");
  await (await download).saveAs(path);
  const backup = JSON.parse(await readFile(path, "utf8"));
  expect(backup.solves).toHaveLength(12);
  expect(backup.cubeCollection.cubes[1]).toMatchObject({
    deleted: true,
    name: "Retired cube",
  });
  await page.getByLabel("Choose backup file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        ...backup,
        solves: [{ ...backup.solves[0], cubeId: "missing" }],
      }),
    ),
  });
  await expect(page.locator("#import-message")).toContainText("cube missing");
  await page.getByLabel("Choose backup file").setInputFiles(path);
  await expect(page.locator(".import-preview")).toContainText("12 solves");
  await page.getByRole("button", { name: "Close backup", exact: true }).click();
  expect(
    await page.evaluate(() => Object.fromEntries(Object.entries(localStorage))),
  ).toEqual(original);
  await importBackup(page, backup);
  await page.getByRole("button", { name: "Replace with this backup" }).click();
  await page.reload();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("last-layer.solves.v1")),
    ),
  ).toEqual(backup.solves);
  expect(await saved(page)).toEqual(backup.progress);
});
test("restore storage failure retains prior data and a successful retry clears the error", async ({
  page,
}) => {
  await populate(page);
  const before = await saved(page);
  await importBackup(page, {
    format: "last-layer-training",
    version: 1,
    progress: progressFixture(),
    solves: [],
    cubeCollection: { cubes: [], defaultId: null },
  });
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "last-layer.solves.v1") {
        Storage.prototype.setItem = original;
        throw new DOMException("full", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "Replace with this backup" }).click();
  await expect(page.locator("#import-message")).toContainText(
    "could not be saved",
  );
  expect(await saved(page)).toEqual(before);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("last-layer.solves.v1")).length,
    ),
  ).toBe(12);
  await page.getByRole("button", { name: "Replace with this backup" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  expect(await saved(page)).toEqual(progressFixture());
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("last-layer.solves.v1")),
    ),
  ).toEqual([]);
});
test("version-1 files preview conversion, reject bad records, and import learning without replacing solves", async ({
  page,
}) => {
  await populate(page);
  const before = await saved(page);
  const legacy = {
    version: 1,
    selected: ["pll-T"],
    variants: { "pll-Rb": 2 },
    known: { "pll-T": [0] },
    attempts: [
      {
        caseId: "pll-T",
        variant: 0,
        mode: "recognition",
        result: "confident",
        day: "2026-10-09",
        at: "2026-10-10T02:15:39Z",
      },
    ],
  };
  await importBackup(page, {
    ...legacy,
    attempts: [{ ...legacy.attempts[0], day: "2026-02-30" }],
  });
  await expect(page.locator("#import-message")).toContainText(
    "invalid practice result",
  );
  expect(await saved(page)).toEqual(before);
  const upload = () =>
    page.getByLabel("Choose backup file").setInputFiles({
      name: "legacy.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(legacy)),
    });
  await upload();
  await expect(page.locator(".import-preview")).toContainText(
    "Version 1 backup",
  );
  await expect(page.locator("#import-message")).toBeEmpty();
  await page.getByRole("button", { name: "Close backup", exact: true }).click();
  expect(await saved(page)).toEqual(before);
  const retained = await page.evaluate(() => [
    localStorage.getItem("last-layer.solves.v1"),
    localStorage.getItem("last-layer.cubes.v1"),
  ]);
  await importBackup(page, legacy);
  await page.getByRole("button", { name: "Replace with this backup" }).click();
  await page.reload();
  const restored = await saved(page);
  expect(restored).toMatchObject({ ...legacy, version: 2 });
  expect(restored.attempts[0].id).toBeTruthy();
  expect(
    await page.evaluate(() => [
      localStorage.getItem("last-layer.solves.v1"),
      localStorage.getItem("last-layer.cubes.v1"),
    ]),
  ).toEqual(retained);
});

test("day deletion confirms all cubes, cancels safely, rolls back failed writes and persists only the chosen day", async ({
  page,
}) => {
  await populate(page);
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem("last-layer.progress.v2"));
    p.known = { "pll-Ua": [0] };
    p.attempts.push({
      ...p.attempts[0],
      id: "adjacent",
      day: "2026-10-16",
      at: "2026-10-16T18:00:00Z",
    });
    localStorage.setItem("last-layer.progress.v2", JSON.stringify(p));
    const solves = JSON.parse(localStorage.getItem("last-layer.solves.v1"));
    solves.push({
      ...solves[0],
      id: "adjacent-solve",
      day: "2026-10-16",
      date: "2026-10-17T01:00:00Z",
    });
    localStorage.setItem("last-layer.solves.v1", JSON.stringify(solves));
  });
  await page.reload();
  const before = await saved(page);
  const cubes = await page.evaluate(() =>
    localStorage.getItem("last-layer.cubes.v1"),
  );
  await page
    .getByRole("button", { name: "2026-10-17: 14 activities", exact: true })
    .click();
  await choose(page, "Day’s solves by cube", "Retired cube (deleted)");
  const remove = page.getByRole("button", {
    name: "Delete day’s activity",
    exact: true,
  });
  await remove.click();
  const confirmation = page.getByRole("group", {
    name: "Delete day confirmation",
  });
  await expect(confirmation).toContainText(
    "2 practice attempts and 12 timer solves",
  );
  await expect(
    confirmation.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await confirmation
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(remove).toBeFocused();
  expect(await saved(page)).toEqual(before);
  await remove.click();
  await page
    .getByRole("button", { name: "2026-10-16: 2 activities", exact: true })
    .click();
  await expect(confirmation).toHaveCount(0);
  await page
    .getByRole("button", { name: "2026-10-17: 14 activities", exact: true })
    .click();
  await remove.click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "last-layer.solves.v1") {
        Storage.prototype.setItem = original;
        throw new DOMException("full", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
  });
  await confirmation
    .getByRole("button", { name: "Delete this day", exact: true })
    .click();
  await expect(confirmation.getByRole("alert")).toContainText(
    "could not be deleted",
  );
  expect(await saved(page)).toEqual(before);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("last-layer.solves.v1")).length,
    ),
  ).toBe(13);
  await confirmation
    .getByRole("button", { name: "Delete this day", exact: true })
    .click();
  await expect(page.locator("#activity-detail-title")).toBeFocused();
  await expect(page.locator(".activity-detail")).toContainText(
    "No activity recorded",
  );
  await page.reload();
  const after = await saved(page);
  expect(after.attempts.map((a) => a.id)).toEqual(["adjacent"]);
  expect(after.known).toEqual(before.known);
  expect(after.selected).toEqual(before.selected);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("last-layer.solves.v1")).map((s) => s.id),
    ),
  ).toEqual(["adjacent-solve"]);
  expect(
    await page.evaluate(() => localStorage.getItem("last-layer.cubes.v1")),
  ).toBe(cubes);
  await expect(remove).toHaveCount(0);
});

for (const theme of ["light", "dark"])
  for (const viewport of [
    { width: 320, height: 720 },
    { width: 667, height: 375 },
  ])
    test(`dashboard actions and chart tooltips fit ${viewport.width}x${viewport.height} ${theme}`, async ({
      page,
    }, testInfo) => {
      await populate(page);
      await page.setViewportSize(viewport);
      await page.evaluate(
        (theme) => localStorage.setItem("last-layer-theme", theme),
        theme,
      );
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Activity heatmap" }),
      ).toBeVisible();
      await expect(page.locator(".activity-cell")).toHaveCount(365);
      const geometry = await page.locator(".activity-heatmap").boundingBox();
      expect(geometry.height).toBeLessThan(130);
      const cell = await page.locator(".activity-cell").first().boundingBox();
      expect(cell.width).toBe(12);
      expect(cell.height).toBe(12);
      await expect(
        page.locator(".heatmap-week-label").filter({ hasText: "Sep" }),
      ).toHaveCount(1);
      await page
        .getByRole("button", { name: "Last 3 months", exact: true })
        .click();
      await expect(page.locator(".activity-cell")).toHaveCount(365);
      const heatmap = page.getByRole("region", {
        name: "Daily activity heatmap",
      });
      expect(
        await heatmap.evaluate((el) => el.scrollWidth > el.clientWidth),
      ).toBe(true);
      await page
        .getByRole("button", { name: "2026-10-17: 14 activities", exact: true })
        .click();
      await expect(page.locator(".activity-detail")).toContainText(
        /Timer solves\s*12/,
      );
      await page
        .getByRole("button", { name: "Last month", exact: true })
        .click();
      await expect(
        page.locator('.activity-cell[aria-pressed="true"]'),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "2026-10-17: 14 activities", exact: true })
        .click();
      await expect(
        page.getByRole("button", {
          name: "2026-10-17: 14 activities",
          exact: true,
        }),
      ).toHaveAttribute("aria-pressed", "true");
      const check = async () => {
        const bounds = await page.locator("main").evaluate((root) =>
          [
            ...root.querySelectorAll(
              'button,[role="combobox"],svg,section,[data-slot="chart"],.chart-legend',
            ),
          ]
            .filter(
              (el) =>
                el.getBoundingClientRect().width &&
                !el.closest(".activity-heatmap"),
            )
            .map((el) => ({
              name: el.getAttribute("aria-label") || el.tagName,
              left: el.getBoundingClientRect().left,
              right: el.getBoundingClientRect().right,
              height: el.getBoundingClientRect().height,
              width: el.getBoundingClientRect().width,
              button: el.tagName === "BUTTON",
            })),
        );
        for (const b of bounds) {
          expect(b.left, b.name).toBeGreaterThanOrEqual(0);
          expect(b.right, b.name).toBeLessThanOrEqual(viewport.width);
          if (b.button) {
            expect(b.height, b.name).toBeGreaterThanOrEqual(44);
            expect(b.width, b.name).toBeGreaterThanOrEqual(44);
          }
        }
      };
      await page
        .getByRole("button", { name: "Delete day’s activity", exact: true })
        .click();
      await expect(
        page.getByRole("group", { name: "Delete day confirmation" }),
      ).toContainText("12 timer solves");
      await check();
      await page
        .getByRole("button", { name: "Delete this day", exact: true })
        .scrollIntoViewIfNeeded();
      await page
        .getByRole("group", { name: "Delete day confirmation" })
        .screenshot({
          path: testInfo.outputPath(
            `delete-day-${theme}-${viewport.width}.png`,
          ),
        });
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(
        page.getByRole("button", {
          name: "Delete day’s activity",
          exact: true,
        }),
      ).toBeFocused();
      await check();
      const inspector = page.getByRole("application", {
        name: "Inspect solve timeline: use Left and Right arrow keys",
        exact: true,
      });
      await inspector.focus();
      await inspector.press("End");
      const tip = inspector.getByRole("tooltip");
      await expect(tip).toContainText("Solve 12");
      await tip.scrollIntoViewIfNeeded();
      const tipBounds = await tip.boundingBox();
      expect(tipBounds.x).toBeGreaterThanOrEqual(0);
      expect(tipBounds.x + tipBounds.width).toBeLessThanOrEqual(viewport.width);
      expect(tipBounds.y).toBeGreaterThanOrEqual(0);
      expect(tipBounds.y + tipBounds.height).toBeLessThanOrEqual(
        viewport.height,
      );
      const plotBounds = await inspector.boundingBox();
      expect(tipBounds.y).toBeGreaterThanOrEqual(plotBounds.y);
      expect(tipBounds.y + tipBounds.height).toBeLessThanOrEqual(
        plotBounds.y + plotBounds.height,
      );
      await inspector.screenshot({
        path: testInfo.outputPath(
          `chart-tooltip-${theme}-${viewport.width}.png`,
        ),
      });
      await inspector.press("Escape");
      await inspector.scrollIntoViewIfNeeded();
      if (testInfo.project.name === "mobile-chromium")
        await inspector.tap({ position: { x: 60, y: 170 } });
      else await inspector.click({ position: { x: 60, y: 170 } });
      await expect(inspector.getByRole("tooltip")).toContainText("Solve");
      await page.keyboard.press("Escape");
      await expect(inspector.getByRole("tooltip")).toHaveCount(0);
      await page.screenshot({
        path: testInfo.outputPath(`learning-${theme}-${viewport.width}.png`),
        fullPage: true,
      });
      await page.getByText("Custom dates", { exact: true }).click();
      await page.getByLabel("From", { exact: true }).fill("2026-10-17");
      await page.getByLabel("Through", { exact: true }).fill("2026-10-17");
      await page
        .getByRole("button", { name: "Apply dates", exact: true })
        .click();
      await expect(
        page.getByRole("region", { name: "Period timer solves", exact: true }),
      ).toContainText("Individual solves (12)");
      await check();
      const summaryBox = await page
        .getByRole("group", { name: "Timer summary", exact: true })
        .boundingBox();
      const heatmapBox = await page
        .getByRole("region", { name: "Daily activity heatmap", exact: true })
        .boundingBox();
      const filtersBox = await page
        .getByRole("group", { name: "Time range", exact: true })
        .boundingBox();
      const graphBox = await inspector.boundingBox();
      expect(summaryBox.y + summaryBox.height).toBeLessThan(heatmapBox.y);
      expect(heatmapBox.y + heatmapBox.height).toBeLessThan(filtersBox.y);
      expect(filtersBox.y + filtersBox.height).toBeLessThan(graphBox.y);
      const graphPanel = await page.locator(".daily-charts").boundingBox();
      expect(graphBox.width).toBeGreaterThanOrEqual(graphPanel.width - 1);
      for (const control of [
        page.getByLabel("From", { exact: true }),
        page.getByLabel("Through", { exact: true }),
      ]) {
        const bounds = await control.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        expect(
          await control.evaluate((el) =>
            Number.parseFloat(getComputedStyle(el).fontSize),
          ),
        ).toBeGreaterThanOrEqual(16);
      }
      await page.locator(".dashboard-range-toolbar").screenshot({
        path: testInfo.outputPath(
          `custom-range-${theme}-${viewport.width}.png`,
        ),
      });
      await page
        .getByRole("group", { name: "Timer summary", exact: true })
        .screenshot({
          path: testInfo.outputPath(
            `timer-summary-${theme}-${viewport.width}.png`,
          ),
        });
      await page.getByRole("button", { name: "Solves", exact: true }).click();
      await check();
      await page.screenshot({
        path: testInfo.outputPath(`solves-${theme}-${viewport.width}.png`),
        fullPage: true,
      });
    });

test("heatmap deselection restores the selected period and presets clear the day override", async ({
  page,
}) => {
  await populate(page);
  await page.evaluate(() => {
    const key = "last-layer.solves.v1";
    const records = JSON.parse(localStorage.getItem(key));
    records.unshift({
      ...records[0],
      id: "old-solve",
      date: "2020-01-01T18:00:00Z",
      day: "2020-01-01",
      elapsed: 1000,
      penalty: undefined,
    });
    localStorage.setItem(key, JSON.stringify(records));
  });
  await page.reload();
  const overall = page.getByRole("region", {
    name: "Period timer solves",
    exact: true,
  });
  await expect(overall).toContainText("Individual solves (12)");
  await page.getByRole("button", { name: "All time", exact: true }).click();
  await expect(overall).toContainText("Individual solves (13)");
  const day = page.getByRole("button", {
    name: "2026-10-17: 14 activities",
    exact: true,
  });
  await day.click();
  await expect(
    page.getByRole("region", { name: "Selected day timer solves" }),
  ).toContainText("Individual solves (12)");
  await day.click();
  await expect(overall).toContainText("Individual solves (13)");
  await day.click();
  await page
    .getByRole("button", { name: "Last 3 months", exact: true })
    .click();
  await expect(overall).toContainText("Individual solves (12)");
  await expect(page.locator('.activity-cell[aria-pressed="true"]')).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Delete day’s activity", exact: true }),
  ).toHaveCount(0);
  await day.click();
  await page.getByRole("button", { name: "All days", exact: true }).click();
  await expect(overall).toContainText("Individual solves (12)");
});

test("chart tooltips inspect penalties and rolling averages without changing solves", async ({
  page,
}) => {
  await populate(page);
  const before = await page.evaluate(
    (key) => localStorage.getItem(key),
    SOLVES,
  );
  const plot = page.getByRole("application", {
    name: "Inspect solve timeline: use Left and Right arrow keys",
    exact: true,
  });
  await plot.focus();
  const tooltip = plot.getByRole("tooltip");
  await expect(tooltip).toContainText("Solve 1 (+2)");
  await expect(tooltip).toContainText("0:22.00");
  await expect(tooltip).toContainText("—");
  await plot.press("End");
  await expect(tooltip).toContainText("Solve 12");
  await expect(tooltip).toContainText("DNF");
  await expect(tooltip).toContainText("0:29.00");
  await expect(tooltip).toContainText("0:25.60");
  await plot.press("Escape");
  await expect(tooltip).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await plot.press("Home");
  const point = page.getByRole("link", { name: "Solve 12: DNF", exact: true });
  await point.focus();
  await expect(tooltip).toContainText("Solve 12");
  await point.press("Enter");
  await expect(
    page.getByRole("region", { name: "Selected solve details" }),
  ).toContainText("Solve 12");
  await choose(page, "Period’s solves by cube", "Retired cube (deleted)");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), SOLVES)).toBe(
    before,
  );
  await page.getByRole("button", { name: "Solves", exact: true }).click();
  await page.getByRole("link", { name: "Solve 12: DNF", exact: true }).hover();
  await expect(page.getByRole("tooltip")).toContainText("Solve 12");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

async function populateRangeHistory(page) {
  await populate(page);
  await page.evaluate(() => {
    const days = [
      "2020-01-01",
      "2026-07-19",
      "2026-07-20",
      "2026-09-17",
      "2026-09-18",
      "2026-10-10",
      "2026-10-11",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ];
    const records = days.map((day, i) => ({
      id: `period-${i}`,
      day,
      date: `${day}T18:00:00Z`,
      elapsed: 20000 + i * 1000,
      scramble: Array(10).fill("R U").join(" "),
      cubeId: "cube-a",
    }));
    records.push({
      id: "legacy-local-day",
      date: "2026-10-18T01:00:00Z",
      elapsed: 33000,
      scramble: Array(10).fill("R U").join(" "),
      cubeId: "cube-a",
    });
    localStorage.setItem("last-layer.solves.v1", JSON.stringify(records));
  });
  await page.reload();
}

test("five preset buttons filter the summary, graph and both solve histories together", async ({
  page,
}) => {
  await populateRangeHistory(page);
  await page.getByRole("button", { name: "Solves", exact: true }).click();
  const period = page.getByRole("region", {
    name: "Period timer solves",
    exact: true,
  });
  const trends = page.getByRole("region", {
    name: "Solve trends",
    exact: true,
  });
  const filters = page.getByRole("group", { name: "Time range", exact: true });
  await expect(filters.getByRole("button")).toHaveCount(5);
  await expect(
    page.getByRole("combobox", { name: "Activity period" }),
  ).toHaveCount(0);
  for (const [label, count] of [
    ["Last day", 2],
    ["Last week", 4],
    ["Last month", 6],
    ["Last 3 months", 8],
    ["All time", 10],
  ]) {
    const preset = filters.getByRole("button", { name: label, exact: true });
    await preset.click();
    await expect(preset).toHaveAttribute("aria-pressed", "true");
    await expect(preset).toBeFocused();
    await expect(filters.locator('[aria-pressed="true"]')).toHaveCount(1);
    await expect(
      page.getByRole("group", { name: "Timer summary", exact: true }),
    ).toContainText(new RegExp(`\\b${count}\\s*Solves`));
    await expect(
      period.getByText(`Individual solves (${count})`, { exact: true }),
    ).toBeVisible();
    await expect(trends).toContainText(`${count} solves · 0 DNF`);
    await expect(period.locator(".solve-point")).toHaveCount(count);
    await expect(trends.locator(".solve-point")).toHaveCount(count);
    await expect(
      page.locator(".individual-times,.daily-distribution,.distribution-bar"),
    ).toHaveCount(0);
    await expect(page.locator(".activity-cell")).toHaveCount(365);
  }
});

test("custom dates are inclusive, reject reversed or incomplete ranges, and preserve data", async ({
  page,
}) => {
  await populateRangeHistory(page);
  const before = await page.evaluate(() =>
    Object.fromEntries(Object.entries(localStorage)),
  );
  await page.getByText("Custom dates", { exact: true }).click();
  await page.getByLabel("From", { exact: true }).fill("2026-10-10");
  await page.getByLabel("Through", { exact: true }).fill("2026-10-16");
  await page.getByRole("button", { name: "Apply dates", exact: true }).click();
  await expect(
    page
      .getByRole("group", { name: "Time range", exact: true })
      .locator('[aria-pressed="true"]'),
  ).toHaveCount(0);
  const period = page.getByRole("region", {
    name: "Period timer solves",
    exact: true,
  });
  await expect(period).toContainText("Individual solves (3)");
  await expect(page.locator("#dashboard-period-label")).toContainText(
    "2026-10-10 – 2026-10-16",
  );
  await page.getByRole("button", { name: "Solves", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Solve trends", exact: true }),
  ).toContainText("3 solves · 0 DNF");
  await page.getByLabel("From", { exact: true }).fill("2026-10-17");
  await page.getByRole("button", { name: "Apply dates", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Start date must be on or before end date",
  );
  await expect(page.getByLabel("From", { exact: true })).toHaveValue(
    "2026-10-17",
  );
  await expect(period).toContainText("Individual solves (3)");
  await page.getByLabel("From", { exact: true }).fill("");
  await page.getByRole("button", { name: "Apply dates", exact: true }).click();
  await expect(page.getByLabel("From", { exact: true })).toBeFocused();
  await expect(period).toContainText("Individual solves (3)");
  await page.getByLabel("From", { exact: true }).fill("2026-10-11");
  await page.getByLabel("Through", { exact: true }).fill("2026-10-11");
  await page.getByRole("button", { name: "Apply dates", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(period).toContainText("Individual solves (1)");
  await page.getByRole("button", { name: "Last week", exact: true }).click();
  await expect(period).toContainText("Individual solves (4)");
  expect(
    await page.evaluate(() => Object.fromEntries(Object.entries(localStorage))),
  ).toEqual(before);
});
