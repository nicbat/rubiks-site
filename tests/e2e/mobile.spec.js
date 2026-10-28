import { captureScreenshot } from "./screenshots.js";
import { reviewSolve, deleteReviewedSolve } from "./fixtures.js";
import { closeSettings } from "./fixtures.js";
import {
  holdStartTimer,
  test,
  expect,
  seed,
  saved,
  openLibrary,
} from "./fixtures.js";

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`case action labels stay on one line when marked known at ${viewport.width}×${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await seed(page);
    await openLibrary(page);
    await page
      .getByRole("button", { name: "View Aa perm", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", { name: "Known", exact: true, pressed: false })
      .click();
    for (const selected of [false, true]) {
      if (selected)
        await dialog
          .getByRole("button", {
            name: "Learning set",
            exact: true,
            pressed: false,
          })
          .click();
      await expect(
        dialog.getByRole("button", { name: "Learning set", exact: true }),
      ).toHaveAttribute("aria-pressed", String(selected));
      await expect(
        dialog.getByRole("button", { name: "Known", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      const actions = dialog.locator(".dialog-actions");
      await actions.scrollIntoViewIfNeeded();
      const labels = await actions.getByRole("button").evaluateAll((buttons) =>
        buttons.map((button) => {
          const text = [...button.childNodes].find(
            (node) =>
              node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
          );
          const range = document.createRange();
          range.selectNodeContents(text);
          return {
            label: text.textContent,
            lines: range.getClientRects().length,
          };
        }),
      );
      for (const { label, lines } of labels)
        expect(lines, `${label} stays on one line`).toBe(1);
      await fits(page, dialog);
      await fits(page, actions);
      await touchTargets(actions);
    }
    for (const colorScheme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme });
      await captureScreenshot(page, {
        path: testInfo.outputPath(`known-actions-${colorScheme}.png`),
      });
    }
    await dialog
      .getByRole("button", { name: "Known", exact: true, pressed: true })
      .click();
    await expect(
      dialog.getByRole("button", {
        name: "Known",
        exact: true,
        pressed: false,
      }),
    ).toBeInViewport();
    const learning = dialog.getByRole("button", {
      name: "Learning set",
      exact: true,
    });
    await learning.focus();
    await page.keyboard.press("Space");
    await expect(learning).toHaveAttribute("aria-pressed", "false");
    const progress = await saved(page);
    expect(progress.selected).not.toContain("pll-Aa");
    expect(progress.attempts).toHaveLength(0);
  });
}

async function fits(page, scope = page.locator("html")) {
  expect(
    await scope.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    "Content fits its available width without horizontal clipping",
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "The page does not require horizontal scrolling",
  ).toBe(true);
}

async function touchTargets(scope) {
  const small = await scope
    .locator("button, summary, select, .setting-toggle, .file-label")
    .evaluateAll((elements) =>
      elements.flatMap((element) => {
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) return [];
        // docs/testing.md documents the compact heatmap as the sole 12px chart
        // exception. Enforce that geometry; ordinary controls still require 44px.
        const invalid = element.matches(
          ".activity-cell[data-action='activity-day']",
        )
          ? rect.width !== 12 || rect.height !== 12
          : rect.width < 44 || rect.height < 44;
        return invalid
          ? [
              {
                name:
                  element.getAttribute("aria-label") ||
                  element.textContent.trim(),
                width: rect.width,
                height: rect.height,
              },
            ]
          : [];
      }),
    );
  expect(
    small,
    "Touch controls provide 44px targets; compact heatmap cells retain their documented 12px geometry",
  ).toEqual([]);
}

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`mobile pages keep navigation and touch controls usable at ${viewport.width}×${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seed(page);
    for (const name of [
      "Dashboard",
      "My learning",
      "Algorithm library",
      "Progress",
      "Timer",
      "Guides",
      "Settings",
    ]) {
      await page.getByRole("button", { name, exact: true }).click();
      if (name === "Settings")
        await expect(
          page.getByRole("button", { name: "Close settings" }),
        ).toBeFocused();
      else await expect(page.getByRole("main")).toBeFocused();
      await fits(page);
      await touchTargets(page);
      const navigation = page.getByRole("navigation", {
        name: "Main navigation",
      });
      for (const button of await navigation.getByRole("button").all()) {
        await expect(button).toBeInViewport();
      }
      // Nav labels use the headings' pixel face and each fits on one line.
      const labels = await navigation.getByRole("button").evaluateAll((els) =>
        els.map((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          const lineHeight = parseFloat(getComputedStyle(el).fontSize) * 1.6;
          return {
            label: el.textContent.trim(),
            font: getComputedStyle(el).fontFamily,
            oneLine: range.getBoundingClientRect().height < lineHeight,
          };
        }),
      );
      for (const { label, font, oneLine } of labels) {
        expect(font, label).toContain("Silkscreen");
        expect(oneLine, `${label} stays on one line`).toBe(true);
      }
      if (name === "Algorithm library") {
        expect(
          await page
            .getByRole("searchbox", { name: "Search cases" })
            .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
          "Search text avoids focus zoom on phones",
        ).toBeGreaterThanOrEqual(16);
      }
      if (name === "Dashboard")
        await captureScreenshot(page, {
          path: testInfo.outputPath("mobile-dashboard.png"),
          fullPage: true,
        });
      if (name === "Algorithm library")
        await captureScreenshot(page, {
          path: testInfo.outputPath("mobile-library.png"),
          fullPage: true,
        });
      if (name === "Settings") {
        await page.getByRole("radio", { name: "Dark", exact: true }).check();
        await captureScreenshot(page, {
          path: testInfo.outputPath("mobile-settings-dark.png"),
          fullPage: true,
        });
      }
    }
  });
}

test("mobile filters, case player and backup remain reachable in short dialogs", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await seed(page);
  await openLibrary(page);
  await page.getByRole("combobox", { name: "Filter by group" }).click();
  await touchTargets(page.getByRole("listbox"));
  await page.getByRole("option", { name: "Edges Only", exact: true }).click();
  await expect(page.locator(".library-case")).toHaveCount(4);
  await page.getByRole("searchbox", { name: "Search cases" }).fill("Ua");
  const opener = page.getByRole("button", {
    name: "View Ua perm",
    exact: true,
  });
  await opener.click();
  const dialog = page.getByRole("dialog");
  await fits(page, dialog);
  await touchTargets(dialog);
  const clippedFaces = await dialog.locator(".cube-stage").evaluate((stage) => {
    const bounds = stage.getBoundingClientRect();
    return [...stage.querySelectorAll(".cube-face")].filter((face) => {
      // Interior surfaces intentionally removed from layout cannot be clipped.
      if (getComputedStyle(face).display === "none") return false;
      const rect = face.getBoundingClientRect();
      return rect.left < bounds.left - 1 || rect.right > bounds.right + 1;
    }).length;
  });
  expect(clippedFaces, "3D cube geometry fits the narrow stage").toBe(0);
  await captureScreenshot(page, {
    path: testInfo.outputPath("mobile-case.png"),
    fullPage: true,
  });
  const next = dialog.getByRole("button", { name: "Next move", exact: true });
  await next.click();
  await expect(next).toBeInViewport();
  await expect(
    dialog.getByRole("button", { name: /Go to move 2:/ }),
  ).toHaveAttribute("aria-current", "step");
  await page.setViewportSize({ width: 667, height: 375 });
  await fits(page, dialog);
  await dialog.getByRole("combobox", { name: "Your algorithm" }).click();
  const lastVariant = dialog.getByRole("option").last();
  await lastVariant.scrollIntoViewIfNeeded();
  await expect(lastVariant).toBeInViewport();
  await lastVariant.click();
  await dialog
    .getByRole("button", { name: "Known", exact: true, pressed: false })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Known", exact: true, pressed: true }),
  ).toBeInViewport();
  await page.getByRole("button", { name: "Close case", exact: true }).click();
  await expect(opener).toBeFocused();
  await page
    .getByRole("button", { name: "Backup and transfer training data" })
    .click();
  await fits(page, dialog);
  const before = await saved(page);
  await page.getByLabel("Choose backup file").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(before)),
  });
  const replace = page.getByRole("button", {
    name: "Replace with this backup",
  });
  await replace.scrollIntoViewIfNeeded();
  await expect(replace).toBeInViewport();
  await fits(page, dialog);
  await captureScreenshot(page, {
    path: testInfo.outputPath("mobile-backup-landscape.png"),
  });
  await page.getByRole("button", { name: "Close backup" }).click();
  expect(await saved(page)).toEqual(before);
});

test("narrow practice, timer history and notation controls complete their flows", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(page);
  await page.getByRole("button", { name: "Start hidden practice" }).click();
  await fits(page);
  await touchTargets(page.getByRole("main"));
  await page.getByRole("button", { name: "Ready to recognize" }).click();
  await page.getByText("Show setup moves again", { exact: true }).click();
  await fits(page);
  await page.getByRole("button", { name: "Show hint", exact: true }).click();
  await touchTargets(page.getByRole("main"));
  await fits(page);
  await page.getByRole("button", { name: "Needed help", exact: true }).click();
  expect((await saved(page)).attempts).toHaveLength(1);
  await closeSettings(page);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await page.clock.install();
  await holdStartTimer(page);
  await page.clock.runFor(1250);
  await page.getByRole("button", { name: "Stop timer", exact: true }).click();
  await page.getByText("Solve history (1)", { exact: true }).click();
  await fits(page);
  await touchTargets(page.getByRole("main"));
  await reviewSolve(page);
  await deleteReviewedSolve(page);
  await expect(
    page.getByText("Solve history (0)", { exact: true }),
  ).toBeVisible();
  await closeSettings(page);
  await page.getByRole("button", { name: "Guides", exact: true }).click();
  await page.getByRole("button", { name: "Notation", exact: true }).click();
  const move = page.getByLabel("Move to preview");
  expect(
    await move.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    "Move selector avoids focus zoom on phones",
  ).toBeGreaterThanOrEqual(16);
  await move.selectOption("z");
  await page.getByRole("button", { name: "z2 Double", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "After z2", exact: true }),
  ).toBeVisible();
  await fits(page);
  await touchTargets(page.getByRole("main"));
  await captureScreenshot(page, {
    path: testInfo.outputPath("mobile-notation.png"),
    fullPage: true,
  });
});

test("mobile solve history stays open when deleting a middle solve", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await seed(page);
  await page.evaluate(() =>
    localStorage.setItem(
      "last-layer.solves.v1",
      JSON.stringify(
        [1, 2, 3].map((n) => ({
          id: String(n),
          elapsed: n * 1000,
          date: "2026-10-10T12:00:00.000Z",
          scramble: Array(10).fill("R U").join(" "),
        })),
      ),
    ),
  );
  await page.reload();
  await closeSettings(page);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await page.getByText("Solve history (3)", { exact: true }).click();
  await reviewSolve(page, "0:02.00");
  await deleteReviewedSolve(page);
  await expect(
    page.getByRole("button", { name: "Review solve 0:03.00", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review solve 0:01.00", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review solve 0:02.00", exact: true }),
  ).toHaveCount(0);
  await fits(page);
});

test("short landscape dropdown options and repeated case actions stay reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await seed(page);
  await openLibrary(page);
  await page.getByRole("combobox", { name: "Filter by group" }).click();
  const option = page.getByRole("option", {
    name: "Diagonal Corner Swap",
    exact: true,
  });
  await option.scrollIntoViewIfNeeded();
  await expect(option).toBeInViewport();
  await option.click();
  await page.getByRole("button", { name: "View V perm", exact: true }).click();
  const dialog = page.getByRole("dialog");
  for (const pressed of [false, true]) {
    const action = dialog.getByRole("button", {
      name: "Known",
      exact: true,
      pressed,
    });
    await action.scrollIntoViewIfNeeded();
    expect(await dialog.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await action.click();
    await expect(
      dialog.getByRole("button", {
        name: "Known",
        exact: true,
        pressed: !pressed,
      }),
    ).toBeInViewport();
    expect(await dialog.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  }
});

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`random last-layer practice fits ${viewport.width}×${viewport.height}`, async ({
    page,
  }, testInfo) => {
    const { applyAlg, solvedCube, f2lSolved, topOriented } =
      await import("../../src/cube.js");
    await page.setViewportSize(viewport);
    await seed(page);
    // Fixed choices select a non-yellow layer and a non-empty layer adjustment.
    await page.evaluate(() => {
      crypto.getRandomValues = (array) => {
        array.fill(1);
        return array;
      };
    });
    const toggle = page.getByRole("checkbox", {
      name: "Randomize last-layer color",
    });
    await toggle.check();
    await page.getByRole("button", { name: "Start hidden practice" }).click();
    await expect(toggle).toBeChecked();
    const setup = await page.getByLabel("Setup moves").textContent();
    const cube = applyAlg(solvedCube(), setup);
    expect(f2lSolved(cube)).toBe(false);
    expect(f2lSolved(applyAlg(cube, "x"))).toBe(true);
    expect(topOriented(applyAlg(cube, "x"))).toBe(true);
    await fits(page, page.locator(".trainer"));
    await touchTargets(page.locator(".trainer"));
    for (const colorScheme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme });
      await captureScreenshot(page, {
        path: testInfo.outputPath(`last-layer-${colorScheme}.png`),
        fullPage: true,
      });
    }
    await page.getByRole("button", { name: "Ready to recognize" }).click();
    await expect(page.locator(".answer-diagram")).toHaveCount(0);
    await fits(page, page.locator(".trainer"));
    await page.getByRole("button", { name: "Show hint" }).click();
    await expect(page.locator(".answer-diagram")).toBeVisible();
    await fits(page, page.locator(".trainer"));
    await page.reload();
    await expect(toggle).toBeChecked();
  });
}
