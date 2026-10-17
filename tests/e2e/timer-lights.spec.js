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
      const row = await page.locator(".timer-clock-row").boundingBox();
      for (const item of await page.locator(".timer-clock-row > *").all()) {
        const box = await item.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(row.x);
        expect(box.x + box.width).toBeLessThanOrEqual(row.x + row.width);
      }
      await page
        .locator(".timer-clock-panel")
        .screenshot({
          path: testInfo.outputPath(
            minutes ? "long-minutes.png" : "long-seconds.png",
          ),
        });
    }
  });
}
