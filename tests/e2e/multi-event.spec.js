// Run only with playwright.events.config.js: this exercises the explicitly
// enabled development flow, never production or a shared browser profile.
import { readFile } from "node:fs/promises";
import { captureScreenshot } from "./screenshots.js";
import {
  test,
  expect,
  holdStartTimer,
  openSettings,
  closeSettings,
} from "./fixtures.js";

const localKey = "last-layer.training.v2";
const legacyScramble = Array(10).fill("R U").join(" ");
const legacySolve = {
  id: "legacy-333",
  elapsed: 9000,
  date: "2026-10-20T12:00:00Z",
  day: "2026-10-20",
  scramble: legacyScramble,
};
const legacyKeys = {
  "last-layer.progress.v2": JSON.stringify({
    version: 2,
    selected: [],
    variants: {},
    attempts: [],
  }),
  "last-layer.solves.v1": JSON.stringify([legacySolve]),
  "last-layer.cubes.v1": JSON.stringify({ cubes: [], defaultId: null }),
};
async function seedLegacy(page) {
  await page.addInitScript((entries) => {
    if (sessionStorage.getItem("multi-event-fixture")) return;
    for (const [key, value] of Object.entries(entries))
      localStorage.setItem(key, value);
    sessionStorage.setItem("multi-event-fixture", "ready");
  }, legacyKeys);
}
const saved = (page) =>
  page.evaluate((key) => {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value).payload : null;
  }, localKey);
async function choose(page, name, option) {
  await page.getByRole("combobox", { name, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
async function openTimer(page) {
  await seedLegacy(page);
  await page.goto("/timer?trainingV2=1");
  await expect(
    page.getByRole("combobox", { name: "Solve event", exact: true }),
  ).toBeVisible();
}
async function ready(page) {
  await expect(
    page.getByRole("button", { name: "Hold to start (Space)", exact: true }),
  ).toBeEnabled({ timeout: 90000 });
}
async function finishSolve(page, milliseconds) {
  await holdStartTimer(page);
  await expect(
    page.getByRole("combobox", { name: "Solve event", exact: true }),
  ).toBeDisabled();
  await page.clock.runFor(milliseconds);
  await page.getByRole("button", { name: "Stop timer", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Next scramble (N)", exact: true }),
  ).toBeVisible();
}
const stat = (page, group, label) =>
  page
    .getByRole("group", { name: group, exact: true })
    .locator(":scope > div")
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator("strong");
async function importFull(page, payload) {
  await openSettings(page);
  await page
    .getByRole("button", {
      name: "Backup and transfer training data",
      exact: true,
    })
    .click();
  await page.getByLabel("Choose backup file").setInputFiles({
    name: "multi-event.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(payload)),
  });
  await expect(
    page.getByRole("button", { name: "Replace with this backup", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Replace with this backup", exact: true })
    .click();
  await expect
    .poll(async () => (await saved(page))?.solves.map((solve) => solve.id))
    .toEqual(payload.solves.map((solve) => solve.id));
}
function importedSolve(id, eventId, elapsed, minute) {
  return {
    id,
    eventId,
    elapsed,
    date: `2026-10-20T12:${String(minute).padStart(2, "0")}:00Z`,
    day: "2026-10-20",
    scramble: "R U F2",
    scrambleGrip: { up: "white", front: "green" },
    scrambleProvenance: {
      id: "fixture-source",
      version: "1",
      method: "random-state",
    },
  };
}
function mixedBackup() {
  return {
    format: "last-layer-training",
    version: 2,
    progress: { version: 2, selected: [], variants: {}, attempts: [] },
    cubeCollection: { cubes: [], defaultsByEvent: {} },
    solves: [
      importedSolve("two-fast", "222", 1000, 0),
      importedSolve("regular-fast", "333", 10000, 1),
      importedSolve("two-slow", "222", 2000, 2),
      importedSolve("regular-slow", "333", 20000, 3),
      importedSolve("oh", "333oh", 30000, 4),
    ],
  };
}

test("real workers migrate legacy solves and record distinct 2x2 and one-handed identities", async ({
  page,
}) => {
  test.setTimeout(180000);
  await openTimer(page);
  await ready(page);
  const migrated = await saved(page);
  expect(migrated.version).toBe(2);
  expect(migrated.solves[0]).toMatchObject({
    ...legacySolve,
    eventId: "333",
    scrambleGrip: { up: "yellow", front: "green" },
  });
  expect(migrated.solves[0]).not.toHaveProperty("scrambleProvenance");
  await page.clock.install();
  for (const [eventId, label, milliseconds] of [
    ["222", "2×2", 1250],
    ["333oh", "3×3 one-handed", 2350],
  ]) {
    await choose(page, "Solve event", label);
    await ready(page);
    await expect(
      page.getByText("Hold white on top, green in front.", { exact: true }),
    ).toBeVisible();
    const scramble = await page.locator("#timer-scramble").textContent();
    await finishSolve(page, milliseconds);
    await expect
      .poll(
        async () =>
          (await saved(page)).solves.filter(
            (solve) => solve.eventId === eventId,
          ).length,
      )
      .toBe(1);
    const recorded = (await saved(page)).solves.find(
      (solve) => solve.eventId === eventId,
    );
    expect(recorded.scramble).toBe(scramble.trim());
    expect(recorded.scrambleGrip).toEqual({ up: "white", front: "green" });
    expect(recorded.scrambleProvenance.method).toBe("random-state");
    expect(recorded.elapsed).toBeGreaterThanOrEqual(milliseconds);
    await expect(
      page.getByText("Solve history (1)", { exact: true }),
    ).toBeVisible();
  }
  expect(
    (await saved(page)).solves.map((solve) => solve.eventId).sort(),
  ).toEqual(["222", "333", "333oh"].sort());
  const originals = await page.evaluate(
    (keys) =>
      Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])),
    Object.keys(legacyKeys),
  );
  expect(originals).toEqual(legacyKeys);
});

test("loading blocks timer start and event changes discard the old pending scramble", async ({
  page,
}) => {
  test.setTimeout(180000);
  let release;
  let blockedWorkers = 0;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route(
    (url) => url.pathname.endsWith("/worker/entry.js"),
    async (route) => {
      blockedWorkers++;
      await gate;
      await route.continue();
    },
  );
  try {
    await openTimer(page);
    await expect.poll(() => blockedWorkers).toBeGreaterThan(0);
    await expect(page.locator("#timer-scramble")).toHaveText(
      "Generating scramble…",
    );
    await expect(
      page.getByRole("button", { name: "Hold to start (Space)", exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("Space");
    await expect(
      page.getByRole("button", { name: "Stop timer", exact: true }),
    ).toHaveCount(0);
    await choose(page, "Solve event", "2×2");
    await expect(
      page.getByRole("combobox", { name: "Solve event", exact: true }),
    ).toContainText("2×2");
  } finally {
    release();
  }
  await ready(page);
  await page.clock.install();
  await finishSolve(page, 1200);
  await expect.poll(async () => (await saved(page)).solves.length).toBe(2);
  expect((await saved(page)).solves.at(-1).eventId).toBe("222");
});

test("profile combines activity but keeps event records and individual history separate", async ({
  page,
}) => {
  test.setTimeout(180000);
  await openTimer(page);
  await importFull(page, mixedBackup());
  await closeSettings(page);
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(
    stat(page, "Activity summary", "Solves · all events"),
  ).toHaveText("5");
  await expect(
    stat(page, "Activity summary", "Time solving · all events"),
  ).toHaveText("00:01:03");
  for (const [label, count, best] of [
    ["3×3", "2", "0:10.00"],
    ["2×2", "2", "0:01.00"],
    ["3×3 one-handed", "1", "0:30.00"],
  ]) {
    await choose(page, "Solve event", label);
    await expect(stat(page, "Timer summary", "Solves")).toHaveText(count);
    await expect(stat(page, "Timer summary", "Best single")).toHaveText(best);
    await expect(stat(page, "Timer summary", "Best ao5")).toHaveText("—");
    await expect(
      stat(page, "Activity summary", "Solves · all events"),
    ).toHaveText("5");
    await expect(
      page.getByText(`Individual solves (${count})`, { exact: true }),
    ).toBeVisible();
  }
});

test("v2 export/import preserves events, original scramble bytes, equipment defaults and grips", async ({
  page,
}) => {
  test.setTimeout(180000);
  await openTimer(page);
  const payload = mixedBackup();
  payload.cubeCollection = {
    cubes: [
      { id: "two-cube", name: "Pocket cube", description: "", puzzleId: "2x2" },
    ],
    defaultsByEvent: { 222: "two-cube" },
  };
  payload.solves[0].cubeId = "two-cube";
  await importFull(page, payload);
  await openSettings(page);
  await page
    .getByRole("button", {
      name: "Backup and transfer training data",
      exact: true,
    })
    .click();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export progress", exact: true })
    .click();
  const download = await downloading;
  const exported = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(exported).toEqual(payload);
  await page.getByRole("button", { name: "Close backup", exact: true }).click();
  await importFull(page, { ...payload, solves: [] });
  await importFull(page, exported);
  expect(await saved(page)).toEqual(payload);
});

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`2x2 preview and event controls fit ${viewport.width}x${viewport.height} with the white-up grip`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(180000);
    await page.setViewportSize(viewport);
    await page.emulateMedia({
      colorScheme: viewport.width === 320 ? "light" : "dark",
    });
    await openTimer(page);
    await choose(page, "Solve event", "2×2");
    await ready(page);
    await page
      .getByRole("button", { name: "Preview scrambled cube", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Scrambled cube",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    const dialogBounds = await dialog.boundingBox();
    expect(dialogBounds.x).toBeGreaterThanOrEqual(0);
    expect(dialogBounds.y).toBeGreaterThanOrEqual(0);
    expect(dialogBounds.x + dialogBounds.width).toBeLessThanOrEqual(
      viewport.width + 1,
    );
    expect(dialogBounds.y + dialogBounds.height).toBeLessThanOrEqual(
      viewport.height + 1,
    );
    await expect(
      dialog.getByText(
        "After the current scramble · white on top, green in front.",
        { exact: true },
      ),
    ).toBeVisible();
    const player = dialog.getByRole("region", {
      name: "3D cube player",
      exact: true,
    });
    await expect(player).toHaveAttribute("data-puzzle-size", "2");
    await expect(player.locator("[data-color]")).toHaveCount(24);
    await expect(
      player.locator('[data-color="U"] .cube-sticker').first(),
    ).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(
      player.locator('[data-color="R"] .cube-sticker').first(),
    ).toHaveCSS("background-color", "rgb(236, 102, 92)");
    await captureScreenshot(page, {
      path: testInfo.outputPath("event-preview.png"),
      fullPage: true,
    });
    const stage = player.getByRole("img", {
      name: "Interactive 3D cube. Drag or use arrow keys to change the view.",
      exact: true,
    });
    await stage.focus();
    await page.keyboard.press("ArrowRight");
    const close = dialog.getByRole("button", {
      name: "Close scramble preview",
      exact: true,
    });
    await close.scrollIntoViewIfNeeded();
    const bounds = await close.boundingBox();
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
    await close.click();
    await expect(
      page.getByRole("button", { name: "Preview scrambled cube", exact: true }),
    ).toBeFocused();
    const event = page.getByRole("combobox", {
      name: "Solve event",
      exact: true,
    });
    await event.scrollIntoViewIfNeeded();
    const eventBounds = await event.boundingBox();
    expect(eventBounds.height).toBeGreaterThanOrEqual(44);
    expect(eventBounds.x).toBeGreaterThanOrEqual(0);
    expect(eventBounds.x + eventBounds.width).toBeLessThanOrEqual(
      viewport.width + 1,
    );
    await event.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("option", { name: /Multi-blind/ }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(event).toBeFocused();
    await captureScreenshot(page, {
      path: testInfo.outputPath("event-timer.png"),
      fullPage: true,
    });
  });
}

test("bulk selection uses the selected event's visible rows even after many newer other-event solves", async ({
  page,
}) => {
  test.setTimeout(180000);
  await openTimer(page);
  const payload = mixedBackup();
  payload.solves = [
    importedSolve("older-two", "222", 1000, 0),
    ...Array.from({ length: 60 }, (_, index) => ({
      ...importedSolve(`newer-333-${index}`, "333", 10000, 1),
      date: new Date(Date.UTC(2026, 9, 21, 0, index)).toISOString(),
      day: "2026-10-21",
    })),
  ];
  await importFull(page, payload);
  await closeSettings(page);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await choose(page, "Solve event", "2×2");
  await page.getByText("Solve history (1)", { exact: true }).click();
  await page
    .getByRole("button", { name: "Select solves", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Select shown solves (1)", exact: true })
    .check();
  await expect(page.getByText("1 selected", { exact: true })).toBeVisible();
  await choose(page, "Solve event", "3×3");
  await expect(
    page.getByRole("button", { name: "Delete selected", exact: true }),
  ).toHaveCount(0);
  expect((await saved(page)).solves.length).toBe(61);
});

test("Backspace during a pending finished-solve save preserves the accepted solve", async ({
  page,
}) => {
  test.setTimeout(180000);
  await openTimer(page);
  await choose(page, "Solve event", "2×2");
  await ready(page);
  await page.clock.install();
  await holdStartTimer(page);
  const lockName = "last-layer.training.v2:guest:false";
  await page.evaluate(
    (name) =>
      new Promise((held, reject) => {
        void navigator.locks
          .request(name, async () => {
            await new Promise((release) => {
              window.releasePendingSolveTestLock = release;
              held();
            });
          })
          .catch(reject);
      }),
    lockName,
  );
  try {
    await page.clock.runFor(1500);
    await page.getByRole("button", { name: "Stop timer", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(async (name) => {
          const locks = await navigator.locks.query();
          return locks.pending.some((lock) => lock.name === name);
        }, lockName),
      )
      .toBe(true);
    expect((await saved(page)).solves.length).toBe(1);
    await page.keyboard.press("Backspace");
    await expect(
      page.getByRole("button", { name: "Next scramble (N)", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Solve history (2)", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Solve history (1)", { exact: true }),
    ).toBeVisible();
  } finally {
    await page.evaluate(() => {
      window.releasePendingSolveTestLock();
      delete window.releasePendingSolveTestLock;
    });
  }
  await expect.poll(async () => (await saved(page)).solves.length).toBe(2);
  const recorded = (await saved(page)).solves.at(-1);
  expect(recorded.eventId).toBe("222");
  expect(recorded.elapsed).toBeGreaterThanOrEqual(1500);
  await expect(
    page.getByRole("alert").filter({
      hasText: /could not|unsaved|save is still|Keep this tab open/i,
    }),
  ).toHaveCount(0);
});

test("larger-cube and blindfolded workers prepare correctly sized previews while 4x4 stays unavailable", async ({
  page,
}) => {
  test.setTimeout(300000);
  await openTimer(page);
  await ready(page);
  const selector = page.getByRole("combobox", {
    name: "Solve event",
    exact: true,
  });
  await selector.click();
  for (const label of ["4×4 — coming soon", "4×4 blindfolded — coming soon"]) {
    await expect(
      page.getByRole("option", { name: label, exact: true }),
    ).toBeDisabled();
  }
  await page.keyboard.press("Escape");

  for (const [label, size] of [
    ["5×5", 5],
    ["6×6", 6],
    ["7×7", 7],
    ["3×3 blindfolded", 3],
    ["5×5 blindfolded", 5],
  ]) {
    await choose(page, "Solve event", label);
    await ready(page);
    await expect(selector).toContainText(label);
    await expect(page.locator("#timer-scramble")).toHaveText(
      /^[URFDLBwxyz0-9' ]+$/,
    );
    await page
      .getByRole("button", { name: "Preview scrambled cube", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Scrambled cube",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    const player = dialog.getByRole("region", {
      name: "3D cube player",
      exact: true,
    });
    await expect(player).toHaveAttribute("data-puzzle-size", String(size));
    await expect(player.locator("[data-color]")).toHaveCount(6 * size * size);
    await expect(player).toHaveAttribute("data-scramble-up", "white");
    await expect(player).toHaveAttribute("data-scramble-front", "green");
    await dialog
      .getByRole("button", { name: "Close scramble preview", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
  }
  // Preparing and inspecting a scramble never creates a recorded solve.
  expect((await saved(page)).solves.map((solve) => solve.id)).toEqual([
    legacySolve.id,
  ]);
});
