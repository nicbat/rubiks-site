import { test, expect, openSettings } from "./fixtures.js";

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`Settings headings, reading panel and selectors keep the site styling at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      localStorage.setItem(
        "last-layer.preferences.v1",
        JSON.stringify({ testData: true }),
      );
    });
    await page.goto("/settings");
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(
      nav.getByRole("button", { name: "Settings", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page
        .getByRole("banner")
        .getByRole("button", { name: "Settings", exact: true }),
    ).toHaveCount(0);
    const spacing = await page.locator(".settings-card").evaluate((card) => {
      const panel = card.getBoundingClientRect();
      const nav = document.querySelector(".nav-wrap").getBoundingClientRect();
      return {
        left: panel.left - nav.left,
        right: panel.right - nav.right,
        gap: panel.top - nav.bottom,
      };
    });
    expect(Math.abs(spacing.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(spacing.right)).toBeLessThanOrEqual(1);
    expect(spacing.gap).toBeGreaterThanOrEqual(20);
    expect(spacing.gap).toBeLessThanOrEqual(32);
    await page.getByText("Advanced", { exact: true }).click();
    const settings = page.getByRole("region", {
      name: "Settings",
      exact: true,
    });
    for (const theme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      const cards = settings.locator('[data-slot="card"].settings-card');
      await expect(cards).toHaveCount(1);
      for (const card of await cards.all()) {
        const surface = await card.evaluate((element) => {
          const style = getComputedStyle(element);
          const box = element.getBoundingClientRect();
          return {
            background: style.backgroundColor,
            gradient: style.backgroundImage,
            top: style.getPropertyValue("--edge-top").trim(),
            bottom: style.getPropertyValue("--edge-bottom").trim(),
            brandTop: style.getPropertyValue("--brand-top").trim(),
            brandBottom: style.getPropertyValue("--brand-bottom").trim(),
            padding: parseFloat(style.paddingLeft),
            left: box.left,
            right: box.right,
          };
        });
        expect(
          surface.background,
          `${theme}: reading surface is opaque`,
        ).toMatch(/^rgb\(/);
        expect(surface.gradient).toContain("linear-gradient");
        expect(surface.top).toBe(surface.brandTop);
        expect(surface.bottom).toBe(surface.brandBottom);
        expect(surface.padding).toBeGreaterThanOrEqual(16);
        expect(surface.left).toBeGreaterThanOrEqual(0);
        expect(surface.right).toBeLessThanOrEqual(viewport.width);
      }
      for (const heading of await settings.getByRole("heading").all()) {
        expect(
          await heading.evaluate(
            (element) => getComputedStyle(element).fontFamily,
          ),
        ).toContain("Silkscreen");
      }
      const selectors = [
        page.locator(".theme-options"),
        ...(await settings.getByRole("combobox").all()),
      ];
      expect(selectors).toHaveLength(4);
      for (const selector of selectors) {
        await selector.scrollIntoViewIfNeeded();
        const corners = await selector.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const contains = (x, y) =>
            element.contains(document.elementFromPoint(x, y));
          return {
            topLeft: contains(box.left + 1.5, box.top + 1.5),
            topRight: contains(box.right - 1.5, box.top + 1.5),
            bottomLeft: contains(box.left + 1.5, box.bottom - 1.5),
            bottomRight: contains(box.right - 1.5, box.bottom - 1.5),
          };
        });
        expect(corners).toEqual({
          topLeft: true,
          topRight: false,
          bottomLeft: false,
          bottomRight: true,
        });
      }
      for (const dropdown of await settings.getByRole("combobox").all()) {
        // Raised key shadows add a dark inset stripe across native dropdowns.
        expect(
          await dropdown.evaluate(
            (element) => getComputedStyle(element).boxShadow,
          ),
        ).not.toContain("inset");
        if (viewport.width === 1280) {
          await dropdown.hover();
          expect(
            await dropdown.evaluate(
              (element) => getComputedStyle(element).boxShadow,
            ),
          ).not.toContain("inset");
        }
      }
      await page.getByLabel("Time format", { exact: true }).focus();
      await expect(
        page.getByLabel("Time format", { exact: true }),
      ).toBeFocused();
    }
  });

  test(`theme positions switch on a pointer click at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.goto("/home");
    await openSettings(page);
    const group = page.getByRole("radiogroup", { name: "Color theme" });
    for (const [name, theme] of [
      ["Dark", "dark"],
      ["Light", "light"],
      ["System", "light"],
    ]) {
      // Click where a person would: the visible position label.
      const label = group.getByText(name, { exact: true });
      await label.scrollIntoViewIfNeeded();
      const box = await label.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await expect(
        group.getByRole("radio", { name, exact: true }),
      ).toBeChecked();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const cell = group
        .locator(".theme-option")
        .filter({ has: page.getByRole("radio", { name, exact: true }) });
      const geometry = await cell.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const target = element
          .querySelector('[role="radio"]')
          .getBoundingClientRect();
        const contains = (x, y) =>
          element.contains(document.elementFromPoint(x, y));
        return {
          corners: {
            topLeft: contains(box.left + 1.5, box.top + 1.5),
            topRight: contains(box.right - 1.5, box.top + 1.5),
            bottomLeft: contains(box.left + 1.5, box.bottom - 1.5),
            bottomRight: contains(box.right - 1.5, box.bottom - 1.5),
          },
          width: target.width,
          height: target.height,
        };
      });
      expect(geometry.corners).toEqual({
        topLeft: true,
        topRight: false,
        bottomLeft: false,
        bottomRight: true,
      });
      expect(geometry.width).toBeGreaterThanOrEqual(44);
      expect(geometry.height).toBeGreaterThanOrEqual(44);
    }
  });
}

test("toggle caps sit centered in their tracks when off and on", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/home");
  await openSettings(page);
  const toggle = page.getByRole("checkbox", {
    name: "Show PLL movement arrows",
  });
  for (const state of ["on", "off"]) {
    if (state === "on") await toggle.check();
    else await toggle.uncheck();
    const gaps = await toggle.evaluate((button) => {
      const track = button.querySelector(".checkbox-indicator");
      const cap = getComputedStyle(track, "::after");
      const border = (side) => parseFloat(cap[`border${side}Width`]);
      const outer = (size, a, b) =>
        cap.boxSizing === "border-box"
          ? parseFloat(cap[size])
          : parseFloat(cap[size]) + border(a) + border(b);
      const height = outer("height", "Top", "Bottom");
      const width = outer("width", "Left", "Right");
      const shift = new DOMMatrixReadOnly(cap.transform).m41;
      const top = parseFloat(cap.top);
      const left = parseFloat(cap.left) + shift;
      return {
        top,
        bottom: track.clientHeight - top - height,
        left,
        right: track.clientWidth - left - width,
      };
    });
    expect(gaps.bottom, `${state}: vertical gaps match`).toBeCloseTo(gaps.top);
    expect(gaps.top).toBeGreaterThanOrEqual(0);
    // The cap rests against one end with the same gap it keeps vertically.
    const end = state === "on" ? gaps.right : gaps.left;
    expect(end, `${state}: end gap matches`).toBeCloseTo(gaps.top);
  }
});
