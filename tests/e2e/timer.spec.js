import { reviewSolve, deleteReviewedSolve } from "./fixtures.js";
import { openSettings, closeSettings } from "./fixtures.js";
import { test, expect, holdStartTimer } from "./fixtures.js";

// Reads the rendered start lights: which lamp glows on each side, by colour.
async function expectStartLights(page, expected) {
  await expect
    .poll(() =>
      page.locator(".timer-light").evaluateAll((lights) =>
        lights.map((light) => {
          const lit = [...light.children].filter(
            (lamp) => getComputedStyle(lamp).boxShadow !== "none",
          );
          if (lit.length !== 1) return `${lit.length} lit`;
          const [r, g, b] = getComputedStyle(lit[0])
            .backgroundColor.match(/\d+/g)
            .map(Number);
          if (r > 200 && g < 120 && b < 120) return "red";
          if (r > 200 && g > 180 && b < 100) return "yellow";
          if (g > 150 && r < 100 && b < 150) return "green";
          return `rgb(${r}, ${g}, ${b})`;
        }),
      ),
    )
    .toEqual([expected, expected]);
}

test("solve timer supports Space, stable hundredths, and next scramble", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await closeSettings(page);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await page.getByRole("heading", { name: "Timer", exact: true }).click();
  const clock = page.getByLabel("Solve time");
  const scramble = await page.locator("#timer-scramble").textContent();
  await expect(clock).toHaveText("0:00.00");
  await expectStartLights(page, "red");
  await page.keyboard.down("Space");
  await page.clock.runFor(250);
  await expect(page.locator("#timer-status")).toHaveText("Keep holding…");
  await expectStartLights(page, "red");
  await page.clock.runFor(250);
  await expect(page.locator("#timer-status")).toHaveText("Release to start");
  await expectStartLights(page, "yellow");
  await page.keyboard.down("Space");
  await page.keyboard.up("Space");
  await expect(
    page.getByRole("button", { name: "Stop timer", exact: true }),
  ).toBeVisible();
  await expectStartLights(page, "green");
  await expect(
    page.getByRole("button", { name: "New scramble (Tab)", exact: true }),
  ).toHaveCount(0);
  await page.clock.runFor(1250);
  await expect(clock).toHaveText(/^0:01\.\d{2}$/);
  await page.keyboard.press("Space");
  await expectStartLights(page, "red");
  const result = await clock.textContent();
  await expect(page.locator("#timer-status")).toHaveCount(0);
  await page.clock.runFor(1000);
  await expect(clock).toHaveText(result);
  await page.keyboard.press("Space");
  await page.keyboard.down("Space");
  await page.clock.runFor(1000);
  await page.keyboard.up("Space");
  await expect(clock).toHaveText(result);
  await expect(page.locator("#timer-scramble")).toHaveText(scramble);
  await expect(
    page.getByText("Solve history (1)", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(clock).toHaveText("0:00.00");
  await expect(page.locator("#timer-scramble")).not.toHaveText(scramble);
  await page.keyboard.down("Space");
  await page.clock.runFor(500);
  await page.keyboard.up("Space");
  await expect(
    page.getByRole("button", { name: "Stop timer", exact: true }),
  ).toBeVisible();
});

test("timer touch controls work and navigation stops the clock", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await closeSettings(page);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await holdStartTimer(page);
  await page.clock.runFor(2340);
  await closeSettings(page);
  await page.getByRole("button", { name: "My learning", exact: true }).click();
  await page.clock.runFor(10000);
  await closeSettings(page);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Next scramble (Tab)", exact: true }),
  ).toBeVisible();
  const result = await page.getByLabel("Solve time").textContent();
  await page.clock.runFor(2000);
  await expect(page.getByLabel("Solve time")).toHaveText(result);
  await page
    .getByRole("button", { name: "Next scramble (Tab)", exact: true })
    .click();
  await holdStartTimer(page);
  await page.clock.runFor(350);
  await page.getByRole("button", { name: "Stop timer", exact: true }).click();
  await expect(page.getByLabel("Solve time")).toHaveText(/^0:00\.\d{2}$/);
});

test("timer digits keep equal rendered widths", async ({ page }) => {
  await page.goto("/");
  await closeSettings(page);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await expect(page.getByLabel("Solve time")).toHaveCSS(
    "font-family",
    /monospace/,
  );
  const widths = await page.getByLabel("Solve time").evaluate((clock) => {
    const sample = clock.cloneNode();
    sample.removeAttribute("id");
    sample.style.position = "absolute";
    sample.style.visibility = "hidden";
    sample.style.width = "max-content";
    clock.parentElement.append(sample);
    const widths = ["11.11", "88.88", "00.00", "23.59"].map((value) => {
      sample.textContent = value;
      return sample.getBoundingClientRect().width;
    });
    sample.remove();
    return widths;
  });
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(0.1);
});

test("solves persist, minutes setting persists, and Backspace removes only the finished solve", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await closeSettings(page);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await holdStartTimer(page);
  await page.clock.fastForward(61230);
  await page.getByRole("button", { name: "Stop timer", exact: true }).click();
  await expect(page.getByLabel("Solve time", { exact: true })).toHaveText(
    /^1:01\.\d{2}$/,
  );
  await expect(
    page.getByText("Solve history (1)", { exact: true }),
  ).toBeVisible();
  await openSettings(page);
  await page.getByLabel("Show minutes on timer").uncheck();
  await page.reload();
  await openSettings(page);
  await expect(page.getByLabel("Show minutes on timer")).not.toBeChecked();
  await closeSettings(page);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await expect(
    page.getByText("Solve history (1)", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Solve time", { exact: true })).toHaveText(
    "00.00",
  );
  await holdStartTimer(page);
  await page.clock.runFor(1230);
  await page.keyboard.press("Backspace");
  await expect(
    page.getByRole("button", { name: "Stop timer", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stop timer", exact: true }).click();
  await expect(
    page.getByText("Solve history (2)", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Backspace");
  await expect(
    page.getByText("Solve history (1)", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Solve time", { exact: true })).toHaveText(
    "00.00",
  );
  await page.keyboard.press("Backspace");
  await page.getByText("Solve history (1)", { exact: true }).click();
  await reviewSolve(page);
  await deleteReviewedSolve(page);
  await page.reload();
  await closeSettings(page);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await expect(
    page.getByText("Solve history (0)", { exact: true }),
  ).toBeVisible();
});
test("unreadable solve storage is preserved when a new solve finishes", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem("last-layer.solves.v1", "broken"),
  );
  await page.reload();
  await closeSettings(page);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await holdStartTimer(page);
  await page.getByRole("button", { name: "Stop timer", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("could not be saved");
  expect(
    await page.evaluate(() => localStorage.getItem("last-layer.solves.v1")),
  ).toBe("broken");
});

test("impossible solve dates trigger recovery without overwriting saved history", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  const stored = JSON.stringify([
    {
      id: "invalid-date",
      elapsed: 1234,
      date: "2026-02-30T12:00:00Z",
      scramble: Array(10).fill("R U").join(" "),
    },
  ]);
  await page.evaluate(
    (value) => localStorage.setItem("last-layer.solves.v1", value),
    stored,
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Solve history could not be loaded",
  );
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await expect(
    page.getByText("Solve history (0)", { exact: true }),
  ).toBeVisible();
  await holdStartTimer(page);
  await page.getByRole("button", { name: "Stop timer", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("could not be saved");
  expect(
    await page.evaluate(() => localStorage.getItem("last-layer.solves.v1")),
  ).toBe(stored);
});

test("history updates recent statistics after deletion and fits narrow screens", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "last-layer.solves.v1",
      JSON.stringify(
        Array.from({ length: 12 }, (_, i) => ({
          id: String(i),
          elapsed: (i + 1) * 1000,
          date: "2026-10-10T12:00:00.000Z",
          scramble: Array(10).fill("R U").join(" "),
        })),
      ),
    ),
  );
  await page.reload();
  await closeSettings(page);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  const stats = page.getByRole("region", { name: "Recent solve statistics" });
  await expect(stats).toContainText("Average: 0:10.00");
  await expect(stats).toContainText("Best: 0:08.00");
  await expect(stats).toContainText("Average: 0:06.50");
  await page.getByText("Solve history (12)", { exact: true }).click();
  await page.setViewportSize({ width: 320, height: 720 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await reviewSolve(page, "0:12.00");
  await deleteReviewedSolve(page);
  await expect(stats).toContainText("Average: 0:09.00");
  await expect(stats).toContainText("Average: —");
});

test("failed solve writes retain the result in this tab", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "last-layer.solves.v1")
        throw new DOMException("Full", "QuotaExceededError");
      return setItem.call(this, key, value);
    };
  });
  await closeSettings(page);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await holdStartTimer(page);
  await page.getByRole("button", { name: "Stop timer", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("could not be saved");
  await expect(
    page.getByText("Solve history (1)", { exact: true }),
  ).toBeVisible();
});

test("hide timer setting defaults off, persists, conceals live time and reveals the saved result", async ({
  page,
}) => {
  await page.clock.install();
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");
  await openSettings(page);
  const setting = page.getByLabel("Hide timer while solving");
  await expect(setting).not.toBeChecked();
  await setting.check();
  await page.reload();
  await openSettings(page);
  await expect(setting).toBeChecked();
  await closeSettings(page);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await holdStartTimer(page);
  await page.clock.runFor(12340);
  await expect(page.getByLabel("Solve time", { exact: true })).toHaveCount(0);
  await expect(page.locator("#timer-status")).toHaveText("Running");
  await expectStartLights(page, "green");
  await page.getByRole("button", { name: "Stop timer", exact: true }).click();
  await expect(page.getByLabel("Solve time", { exact: true })).toHaveText(
    /^0:12\.\d{2}$/,
  );
  await page.getByText("Solve history (1)", { exact: true }).click();
  await expect(page.locator(".timer-history")).toContainText("0:12.");
  await openSettings(page);
  await setting.uncheck();
  await page.setViewportSize({ width: 667, height: 375 });
  await closeSettings(page);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await page
    .getByRole("button", { name: "Next scramble (Tab)", exact: true })
    .click();
  await holdStartTimer(page);
  await page.clock.runFor(2000);
  await expect(page.getByLabel("Solve time", { exact: true })).toHaveText(
    /^0:02\.\d{2}$/,
  );
});

test("Space hold cancels early or on blur, starts on release and hides the scramble until stopped", async ({
  page,
}, testInfo) => {
  await page.clock.install();
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");
  await openSettings(page);
  await page.getByLabel("Hide timer while solving").check();
  await closeSettings(page);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await page.getByRole("heading", { name: "Timer", exact: true }).click();
  await page.keyboard.down("Space");
  await page.clock.runFor(200);
  await page.keyboard.up("Space");
  await expect(page.locator("#timer-status")).toHaveCount(0);
  await page.keyboard.down("Space");
  await page.clock.runFor(500);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.keyboard.up("Space");
  await expect(page.locator("#timer-status")).toHaveCount(0);
  await page.keyboard.down("Space");
  await page.clock.runFor(500);
  await expect(page.locator("#timer-status")).toHaveText("Release to start");
  await expect(page.locator("#timer-scramble")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("timer-armed.png"),
    fullPage: true,
  });
  await page.keyboard.up("Space");
  await expect(page.locator("#timer-scramble")).not.toBeVisible();
  await expect(page.getByLabel("Solve time", { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("timer-hidden.png"),
    fullPage: true,
  });
  await page.clock.runFor(2340);
  await page.keyboard.press("Space");
  await expect(page.getByLabel("Solve time", { exact: true })).toHaveText(
    /^0:02\.\d{2}$/,
  );
  await expect(page.locator("#timer-scramble")).toBeVisible();
  await expect(
    page.getByText("Solve history (1)", { exact: true }),
  ).toBeVisible();
});

test("Tab keeps control focus navigation and advances from the finished timer button", async ({
  page,
}) => {
  await page.clock.install();
  await page.setViewportSize({ width: 667, height: 375 });
  await page.goto("/");
  await closeSettings(page);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await holdStartTimer(page);
  await page.clock.runFor(1200);
  await page.getByRole("button", { name: "Stop timer", exact: true }).click();
  const result = await page
    .getByLabel("Solve time", { exact: true })
    .textContent();
  const next = page.getByRole("button", {
    name: "Next scramble (Tab)",
    exact: true,
  });
  await expect(next).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByLabel("Solve time", { exact: true })).toHaveText(
    result,
  );
  await page.keyboard.press("Shift+Tab");
  await expect(next).not.toBeFocused();
  await expect(page.getByLabel("Solve time", { exact: true })).toHaveText(
    result,
  );
  await page.getByRole("combobox", { name: "Cube", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Solve time", { exact: true })).toHaveText(
    result,
  );
  await expect(
    page.getByRole("button", { name: "Preview scrambled cube" }),
  ).toBeFocused();
  await next.focus();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Hold to start (Space)", exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("Solve time", { exact: true })).toHaveText(
    "0:00.00",
  );
  const scramble = await page.locator("#timer-scramble").textContent();
  await page.keyboard.press("Tab");
  await expect(page.locator("#timer-scramble")).not.toHaveText(scramble);
  await expect(page.locator("#timer-status")).toHaveCount(0);
  await expect(
    page.getByText("Solve history (1)", { exact: true }),
  ).toBeVisible();
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 667, height: 375 },
]) {
  for (const theme of ["light", "dark"]) {
    test(`timer button holds, cancels and advances at ${viewport.width}×${viewport.height} in ${theme}`, async ({
      page,
    }, testInfo) => {
      await page.clock.install();
      await page.clock.pauseAt(new Date());
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: theme });
      await page.goto("/");
      await closeSettings(page);
      await page.getByRole("button", { name: "Timer", exact: true }).click();
      const start = page.getByRole("button", {
        name: "Hold to start (Space)",
        exact: true,
      });
      await start.click();
      await expect(page.locator("#timer-status")).toHaveCount(0);
      await start.hover();
      await page.mouse.down();
      await page.clock.runFor(499);
      await expectStartLights(page, "red");
      await page.mouse.up();
      await expect(page.locator("#timer-status")).toHaveCount(0);
      await expectStartLights(page, "red");
      await start.hover();
      await page.mouse.down();
      await page.clock.runFor(500);
      await page.mouse.move(0, 0);
      await page.mouse.up();
      await expect(page.locator("#timer-status")).toHaveCount(0);
      // Touch cancellation must abandon even an armed hold.
      await start.dispatchEvent("pointerdown", {
        pointerId: 42,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
      });
      await page.clock.runFor(500);
      await expectStartLights(page, "yellow");
      await start.dispatchEvent("pointercancel", {
        pointerId: 42,
        pointerType: "touch",
        isPrimary: true,
      });
      await expect(page.locator("#timer-status")).toHaveCount(0);
      await expectStartLights(page, "red");
      const box = await start.boundingBox();
      const touch = {
        pointerId: 43,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        clientX: box.x + box.width / 2,
        clientY: box.y + box.height / 2,
      };
      await start.dispatchEvent("pointerdown", touch);
      const holdingBox = await start.boundingBox();
      expect(holdingBox.y).toBe(box.y);
      expect(holdingBox.height).toBe(box.height);
      await page.clock.runFor(500);
      await expect(page.locator("#timer-status")).toHaveText(
        "Release to start",
      );
      const armedBox = await start.boundingBox();
      expect(armedBox.y).toBe(box.y);
      expect(armedBox.height).toBe(box.height);
      await start.dispatchEvent("pointerup", touch);
      await expect(page.locator("#timer-status")).toHaveText("Running");
      await expectStartLights(page, "green");
      // One light sits on each side of the readout, inside the viewport.
      const [left, clockBox, right] = await Promise.all([
        page.locator(".timer-light").first().boundingBox(),
        page.getByLabel("Solve time").boundingBox(),
        page.locator(".timer-light").last().boundingBox(),
      ]);
      expect(left.x).toBeGreaterThanOrEqual(0);
      expect(left.x + left.width).toBeLessThanOrEqual(clockBox.x);
      expect(right.x).toBeGreaterThanOrEqual(clockBox.x + clockBox.width);
      expect(right.x + right.width).toBeLessThanOrEqual(viewport.width);
      for (const light of [left, right])
        expect(
          Math.abs(
            light.y + light.height / 2 - (clockBox.y + clockBox.height / 2),
          ),
          "Light is vertically centred on the readout",
        ).toBeLessThan(2);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.locator(".timer-clock-panel").screenshot({
        path: testInfo.outputPath("timer-running.png"),
      });
      await page.clock.runFor(1230);
      await page
        .getByRole("button", { name: "Stop timer", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "New scramble (Tab)", exact: true }),
      ).toHaveCount(0);
      const next = page.getByRole("button", {
        name: "Next scramble (Tab)",
        exact: true,
      });
      for (const button of [
        next,
        page.getByRole("button", {
          name: "Review solve",
          exact: true,
        }),
      ]) {
        const bounds = await button.boundingBox();
        expect(bounds.width).toBeGreaterThanOrEqual(44);
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      }
      await page.screenshot({
        path: testInfo.outputPath("timer-finished.png"),
        fullPage: true,
      });
      await next.click();
      await expect(page.getByLabel("Solve time")).toHaveText("0:00.00");
      await expect(start).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath("timer-ready.png"),
        fullPage: true,
      });
    });
  }
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 667, height: 375 },
]) {
  test(`Tab refreshes the initial scramble without starting a solve at ${viewport.width}×${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.clock.install();
    await page.addInitScript(() => {
      let seed = 81273;
      Math.random = () =>
        (seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32;
    });
    await page.setViewportSize(viewport);
    await page.goto("/");
    await closeSettings(page);
    await page.getByRole("button", { name: "Timer", exact: true }).click();
    const scramble = page.locator("#timer-scramble");
    const initial = await scramble.textContent();
    await page.getByRole("heading", { name: "Timer", exact: true }).click();
    await page.keyboard.press("Tab");
    await expect(scramble).not.toHaveText(initial);
    await expect(page.locator("#timer-status")).toHaveCount(0);
    await expect(page.getByLabel("Solve time")).toHaveText("0:00.00");
    await expect(
      page.getByText("Solve history (0)", { exact: true }),
    ).toBeVisible();
    const fresh = await scramble.textContent();
    const newScramble = page.getByRole("button", {
      name: "New scramble (Tab)",
      exact: true,
    });
    await newScramble.focus();
    await page.keyboard.press("Tab");
    await expect(scramble).not.toHaveText(fresh);
    await expect(newScramble).toBeFocused();
    const current = await scramble.textContent();
    await page.keyboard.press("Shift+Tab");
    await expect(scramble).toHaveText(current);
    await page.getByRole("combobox", { name: "Cube", exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Preview scrambled cube" }),
    ).toBeFocused();
    await expect(scramble).toHaveText(current);
    const bounds = await newScramble.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({
      path: testInfo.outputPath("timer-ready-tab.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Hold to start (Space)", exact: true })
      .focus();
    await page.keyboard.down("Space");
    await page.clock.runFor(500);
    await page.keyboard.press("Tab");
    await page.keyboard.up("Space");
    await expect(page.locator("#timer-status")).toHaveCount(0);
    await expect(scramble).not.toHaveText(current);
    await expect(
      page.getByText("Solve history (0)", { exact: true }),
    ).toBeVisible();
  });
}
