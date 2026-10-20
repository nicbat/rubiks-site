import { test, expect, openSettings } from "./fixtures.js";

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`theme positions switch on a pointer click at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.goto("/");
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
    }
  });
}

test("toggle caps sit centered in their tracks when off and on", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await openSettings(page);
  const toggle = page.getByRole("checkbox", { name: "PLL arrows" });
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
