import { captureScreenshot } from "./screenshots.js";
import {
  test,
  expect,
  holdStartTimer,
  openSettings,
  closeSettings,
} from "./fixtures.js";

for (const viewport of [
  { width: 320, height: 568 },
  { width: 667, height: 375 },
]) {
  test(`start lights leave room for long solve times at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.clock.install();
    await page.goto("/#/timer");
    await holdStartTimer(page);
    await page.clock.fastForward(600000);
    await page.getByRole("button", { name: "Stop timer", exact: true }).click();
    await expect(page.getByLabel("Solve time")).toHaveText(/^10:00\.\d{2}$/);
    for (const minutes of [true, false]) {
      if (!minutes) {
        await openSettings(page);
        await page.getByLabel("Show minutes on timer").uncheck();
        await closeSettings(page);
        await expect(page.getByLabel("Solve time")).toHaveText(/^600\.\d{2}$/);
      }
      // The digits fit their window beside the lights, not just the boxes.
      expect(
        await page
          .getByLabel("Solve time")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      const row = await page.locator(".timer-clock-row").boundingBox();
      for (const item of await page.locator(".timer-clock-row > *").all()) {
        const box = await item.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(row.x);
        expect(box.x + box.width).toBeLessThanOrEqual(row.x + row.width);
      }
      await captureScreenshot(page.locator(".timer-clock-panel"), {
        path: testInfo.outputPath(
          minutes ? "long-minutes.png" : "long-seconds.png",
        ),
      });
    }
  });
}

// The clock's faceplate legend is decoration: its mode readout follows the
// start lights for sighted users, while the status line and clock carry the
// meaning for assistive tech.
for (const viewport of [
  { width: 320, height: 568 },
  { width: 667, height: 375 },
]) {
  test(`faceplate legend and countdown track the timer without moving the panel at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.clock.install();
    await page.goto("/#/timer");
    const panel = page.locator(".timer-clock-panel");
    const legend = panel.locator(".timer-legend");
    await expect(legend).toHaveAttribute("aria-hidden", "true");
    await expect(legend.locator(".timer-mode")).toHaveText("Standby");

    // The scramble bar stays put and counts down with the lights, so the
    // clock panel never moves during a start.
    const bar = page.locator(".timer-scramble");
    const countdown = bar.locator(".timer-countdown");
    const scramble = page.locator("#timer-scramble");
    let before;
    const unmoved = async () => {
      expect(await bar.boundingBox()).toEqual(before.bar);
      expect(await panel.boundingBox()).toEqual(before.panel);
    };
    await expect(countdown).toHaveCount(0);
    const start = page.getByRole("button", {
      name: "Hold to start (Space)",
      exact: true,
    });
    // Hovering may scroll, so measure from there.
    await start.hover();
    before = { bar: await bar.boundingBox(), panel: await panel.boundingBox() };
    await page.mouse.down();
    await expect(legend.locator(".timer-mode")).toHaveText("Hold");
    await expect(bar).toHaveAttribute("data-countdown", "red");
    await expect(countdown).toHaveText("Ready…");
    await expect(scramble).not.toBeVisible();
    await unmoved();
    await page.clock.runFor(500);
    await expect(legend.locator(".timer-mode")).toHaveText("Armed");
    await expect(bar).toHaveAttribute("data-countdown", "yellow");
    await expect(countdown).toHaveText("Set…");
    await unmoved();
    await page.mouse.up();
    await expect(legend.locator(".timer-mode")).toHaveText("Run");
    await expect(bar).toHaveAttribute("data-countdown", "green");
    await expect(countdown).toHaveText("SOLVE!");
    await expect(countdown).toHaveAttribute("aria-hidden", "true");
    await unmoved();
    await page.getByRole("button", { name: "Stop timer", exact: true }).click();
    await expect(legend.locator(".timer-mode")).toHaveText("Done");
    await expect(countdown).toHaveCount(0);
    await expect(scramble).toBeVisible();

    const box = await panel.boundingBox();
    for (const item of await panel.locator(".timer-legend > *").all()) {
      const part = await item.boundingBox();
      expect(part.x).toBeGreaterThanOrEqual(box.x);
      expect(part.x + part.width).toBeLessThanOrEqual(box.x + box.width);
    }
    // The decorative vent sits between the window and the start key.
    const vent = panel.locator(".timer-vent");
    await expect(vent).toHaveAttribute("aria-hidden", "true");
    const [clockBox, ventBox, toggleBox] = await Promise.all([
      page.getByLabel("Solve time").boundingBox(),
      vent.boundingBox(),
      page.locator("#timer-toggle").boundingBox(),
    ]);
    expect(ventBox.y).toBeGreaterThanOrEqual(clockBox.y + clockBox.height);
    expect(ventBox.y + ventBox.height).toBeLessThanOrEqual(toggleBox.y);
    expect(ventBox.x).toBeGreaterThanOrEqual(box.x);
    expect(ventBox.x + ventBox.width).toBeLessThanOrEqual(box.x + box.width);
  });
}
