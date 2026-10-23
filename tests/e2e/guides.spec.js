import { openSettings, closeSettings } from "./fixtures.js";
import { test, expect, seed, saved } from "./fixtures.js";

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
  { width: 1280, height: 900 },
]) {
  test(`guides load one cube on demand and release it at ${viewport.width}×${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seed(page);
    const before = await saved(page);
    await closeSettings(page);
    await page.getByRole("button", { name: "Guides", exact: true }).click();
    const player = page.getByRole("region", { name: "3D cube player" });
    await expect(player).toHaveCount(0);
    for (const section of ["Cross", "F2L"]) {
      await page.getByRole("button", { name: section, exact: true }).click();
      await expect(player).toHaveCount(0);
      if (section === "F2L") {
        await expect(page.locator(".f2l-card")).toHaveCount(41);
        const help = page.getByText("How to use these cases", { exact: true });
        await help.focus();
        await page.keyboard.press("Enter");
        await expect(page.locator(".f2l-help")).toHaveAttribute("open", "");
        await expect(page.locator(".f2l-help")).toContainText(
          "Case numbers follow the CubeSkills sheet",
        );
        await page.keyboard.press("Space");
        await expect(page.locator(".f2l-help")).not.toHaveAttribute("open");
        await expect(help).toBeFocused();
      }
      const examples = page.locator('[data-action="guide-example"]');
      if (section === "Cross") {
        await expect(page.locator(".cross-frame")).toHaveCount(12);
        await expect(page.locator(".cross-frame svg")).toHaveCount(24);
        for (const button of await page
          .locator(
            ".guide-example-actions button, .guide-example-actions summary",
          )
          .all()) {
          const box = await button.boundingBox();
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
        await page
          .locator(".guide-example")
          .first()
          .screenshot({ path: testInfo.outputPath("cross-light.png") });
      }
      if (section === "Cross" && viewport.width === 1280) {
        await page
          .locator(".cross-guide")
          .screenshot({ path: testInfo.outputPath("cross-desktop.png") });
      }
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
        .locator(
          ".guide-example, .cross-frame, .cross-frame svg, .cross-frame figcaption, .cross-comparison, .f2l-card, .cube-stage, .cube-controls",
        )
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
    await openSettings(page);
    await page.getByLabel("Dark", { exact: true }).check();
    await expect(player).toHaveCount(1);
    await closeSettings(page);
    await page
      .getByRole("button", { name: "My learning", exact: true })
      .click();
    await expect(player).toHaveCount(0);
    await closeSettings(page);
    await page.getByRole("button", { name: "Guides", exact: true }).click();
    await expect(player).toHaveCount(1);
    await page.getByRole("button", { name: "Cross", exact: true }).click();
    await expect(page.locator(".cross-frame svg")).toHaveCount(24);
    for (const card of await page.locator(".guide-example").all()) {
      const bounds = await card.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    }
    await page
      .locator(".guide-example")
      .nth(2)
      .screenshot({ path: testInfo.outputPath("cross-pair-dark.png") });
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
    const clickWithoutJump = async (button) => {
      await button.scrollIntoViewIfNeeded();
      const scrollBefore = await page.evaluate(() => window.scrollY);
      await button.click();
      expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
    };
    const second = cards.nth(1).getByRole("button");
    await clickWithoutJump(second);
    await expect(second).toBeFocused();
    await expect(second).toHaveAttribute("aria-expanded", "true");
    expect(await positions()).toEqual(before);
    const preview = group.getByRole("region", { name: /F2L case .* preview/ });
    await expect(preview).toBeVisible();
    const previewBox = await preview.boundingBox();
    const gridBox = await group.locator(".f2l-grid").boundingBox();
    expect(previewBox.y).toBeGreaterThanOrEqual(gridBox.y + gridBox.height);
    await page.screenshot({
      path: testInfo.outputPath("f2l-selection-position.png"),
    });
    expect(previewBox.x).toBeGreaterThanOrEqual(0);
    expect(previewBox.x + previewBox.width).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({
      path: testInfo.outputPath("f2l-second-light.png"),
      fullPage: true,
    });
    await clickWithoutJump(cards.nth(2).getByRole("button"));
    await expect(
      page.getByRole("region", { name: "3D cube player", exact: true }),
    ).toHaveCount(1);
    expect(await positions()).toEqual(before);
    await clickWithoutJump(cards.nth(2).getByRole("button"));
    await expect(preview).toHaveCount(0);
    expect(await positions()).toEqual(before);
    await openSettings(page);
    await page.getByLabel("Dark", { exact: true }).check();
    await closeSettings(page);
    await clickWithoutJump(second);
    await preview.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath("f2l-second-dark.png"),
      fullPage: true,
    });
  });
}
