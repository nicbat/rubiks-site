import { test, expect, seed, saved } from "./fixtures.js";

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`guides load one cube on demand and release it at ${viewport.width}×${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seed(page);
    const before = await saved(page);
    await page.getByRole("button", { name: "Guides", exact: true }).click();
    const player = page.getByRole("region", { name: "3D cube player" });
    await expect(player).toHaveCount(0);
    for (const section of ["Cross", "F2L"]) {
      await page.getByRole("button", { name: section, exact: true }).click();
      await expect(player).toHaveCount(0);
      if (section === "F2L")
        await expect(page.locator(".f2l-card")).toHaveCount(41);
      const examples = page.locator('[data-action="guide-example"]');
      const first = examples.first();
      await first.focus();
      await page.keyboard.press("Enter");
      await expect(first).toBeFocused();
      await expect(first).toHaveAttribute("aria-expanded", "true");
      await expect(player).toHaveCount(1);
      await expect(
        player.getByRole("button", { name: "Play", exact: true }),
      ).toBeVisible();
      const start = await player
        .locator("[data-color]")
        .evaluateAll((els) =>
          els
            .map((el) =>
              [el.dataset.position, el.dataset.normal, el.dataset.color].join(
                ":",
              ),
            )
            .sort(),
        );
      await player
        .getByRole("button", { name: "Next move", exact: true })
        .click();
      expect(
        await player
          .locator("[data-color]")
          .evaluateAll((els) =>
            els
              .map((el) =>
                [el.dataset.position, el.dataset.normal, el.dataset.color].join(
                  ":",
                ),
              )
              .sort(),
          ),
      ).not.toEqual(start);
      await player.getByRole("button", { name: "Reset", exact: true }).click();
      expect(
        await player
          .locator("[data-color]")
          .evaluateAll((els) =>
            els
              .map((el) =>
                [el.dataset.position, el.dataset.normal, el.dataset.color].join(
                  ":",
                ),
              )
              .sort(),
          ),
      ).toEqual(start);
      await page.screenshot({
        path: testInfo.outputPath(`guides-${section}-light.png`),
        fullPage: true,
      });
      const bounds = await page
        .locator(".guide-example, .f2l-card, .cube-stage, .cube-controls")
        .evaluateAll((els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect();
            return { left: r.left, right: r.right };
          }),
        );
      expect(bounds.length).toBeGreaterThan(0);
      for (const r of bounds) {
        expect(r.left).toBeGreaterThanOrEqual(0);
        expect(r.right).toBeLessThanOrEqual(viewport.width);
      }
      const second = examples.nth(1);
      await second.click();
      await expect(player).toHaveCount(1);
      await expect(first).toHaveAttribute("aria-expanded", "false");
      await second.click();
      await expect(second).toBeFocused();
      await expect(player).toHaveCount(0);
    }
    await page.getByRole("button", { name: "Notation", exact: true }).click();
    await expect(player).toHaveCount(1);
    await page.getByRole("button", { name: "Hide 3D notation cube" }).click();
    await expect(player).toHaveCount(0);
    await page.getByRole("button", { name: "Show 3D notation cube" }).click();
    await expect(player).toHaveCount(1);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(player).toHaveCount(0);
    await page.getByLabel("Dark", { exact: true }).check();
    await page.getByRole("button", { name: "Guides", exact: true }).click();
    await expect(player).toHaveCount(1);
    await page.getByRole("button", { name: "F2L", exact: true }).click();
    await page.locator('[data-action="guide-example"]').first().click();
    await page.screenshot({
      path: testInfo.outputPath("guides-f2l-dark.png"),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(await saved(page)).toEqual(before);
  });
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`F2L second-case preview preserves the group grid at ${viewport.width}×${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seed(page);
    await page.getByRole("button", { name: "Guides", exact: true }).click();
    await page.getByRole("button", { name: "F2L", exact: true }).click();
    const group = page.locator(".f2l-group").first();
    const cards = group.locator(".f2l-card");
    const positions = () =>
      cards.evaluateAll((els) => {
        const origin = els[0].closest(".f2l-grid").getBoundingClientRect();
        // Firefox's viewport subtraction has subpixel floating-point noise.
        const pixel = (value) => Math.round(value * 100) / 100;
        return els.map((el) => {
          const r = el.getBoundingClientRect();
          return {
            x: pixel(r.x - origin.x),
            y: pixel(r.y - origin.y),
            width: pixel(r.width),
            height: pixel(r.height),
          };
        });
      });
    const before = await positions();
    const second = cards.nth(1).getByRole("button");
    await second.click();
    await expect(second).toBeFocused();
    await expect(second).toHaveAttribute("aria-expanded", "true");
    expect(await positions()).toEqual(before);
    const preview = group.getByRole("region", { name: /F2L case .* preview/ });
    await expect(preview).toBeVisible();
    const previewBox = await preview.boundingBox();
    const gridBox = await group.locator(".f2l-grid").boundingBox();
    expect(previewBox.y).toBeGreaterThanOrEqual(gridBox.y + gridBox.height);
    expect(previewBox.y).toBeGreaterThanOrEqual(-1);
    expect(previewBox.y).toBeLessThan(viewport.height);
    await page.screenshot({
      path: testInfo.outputPath("f2l-preview-visible.png"),
    });
    expect(previewBox.x).toBeGreaterThanOrEqual(0);
    expect(previewBox.x + previewBox.width).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({
      path: testInfo.outputPath("f2l-second-light.png"),
      fullPage: true,
    });
    await cards.nth(2).getByRole("button").click();
    await expect(
      page.getByRole("region", { name: "3D cube player", exact: true }),
    ).toHaveCount(1);
    expect(await positions()).toEqual(before);
    await cards.nth(2).getByRole("button").click();
    await expect(preview).toHaveCount(0);
    expect(await positions()).toEqual(before);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByLabel("Dark", { exact: true }).check();
    await page.getByRole("button", { name: "Guides", exact: true }).click();
    await second.click();
    await preview.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath("f2l-second-dark.png"),
      fullPage: true,
    });
  });
}
