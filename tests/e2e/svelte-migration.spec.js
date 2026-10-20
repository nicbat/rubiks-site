import { test, expect, seed, openSettings } from "./fixtures.js";

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`retained practice controls and placeholders at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await seed(page);
    await page.getByRole("button", { name: "Start hidden practice" }).click();
    await page.getByRole("button", { name: "Ready to recognize" }).click();
    await expect(page.locator(".mystery-cube > i")).toHaveCount(9);
    await expect(page.locator(".mystery-cube")).toHaveText("?");
    await expect(page.locator(".answer-diagram, .algorithm")).toHaveCount(0);
    const setup = await page.locator(".setup-reminder").textContent();
    await openSettings(page);
    const arrows = page.getByLabel("PLL arrows", { exact: true });
    await arrows.uncheck();
    await arrows.check();
    await expect(arrows).toBeChecked();
    // The small visual indicator sits inside a generous, neutral touch target.
    // A native button border must not become a second box around the checkbox.
    await expect(arrows).toHaveCSS("border-top-width", "0px");
    const target = await arrows.boundingBox();
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({
      path: testInfo.outputPath("settings-checkboxes.png"),
    });
    await page.keyboard.press("Escape");
    await expect(page.locator(".setup-reminder")).toHaveText(setup);
    const mystery = await page.locator(".mystery-cube").boundingBox();
    expect(mystery.x).toBeGreaterThanOrEqual(0);
    expect(mystery.x + mystery.width).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({
      path: testInfo.outputPath("hidden-practice-svelte.png"),
      fullPage: true,
    });
  });
}

test("cube editor clears submitted and cancelled drafts; names remain inert text", async ({
  page,
}) => {
  await page.goto("/#/cubes");
  const name = page.getByLabel("Name", { exact: true });
  const description = page.getByLabel("Description (optional)");
  const hostile = '<img src=x onerror="alert(1)">';
  await name.fill(hostile);
  await description.fill("First description");
  await page.getByRole("button", { name: "Add cube", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: hostile, exact: true }),
  ).toBeVisible();
  await expect(page.locator(".cube-list img")).toHaveCount(0);
  await page.locator("#cube-editor summary").click();
  await expect(name).toHaveValue("");
  await expect(description).toHaveValue("");
  await name.fill("Cancelled draft");
  await description.fill("Cancelled description");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.locator("#cube-editor summary").click();
  await expect(name).toHaveValue("");
  await expect(description).toHaveValue("");
});

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`shared theme radios stay reactive and reachable at ${viewport.width}x${viewport.height}`, async ({
    page,
    context,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await openSettings(page);
    const group = page.getByRole("radiogroup", { name: "Color theme" });
    const system = group.getByRole("radio", { name: "System", exact: true });
    const light = group.getByRole("radio", { name: "Light", exact: true });
    const dark = group.getByRole("radio", { name: "Dark", exact: true });
    await expect(system).toBeChecked();
    await system.focus();
    await page.keyboard.press("ArrowRight");
    await expect(light).toBeFocused();
    await expect(light).toBeChecked();
    await page.keyboard.press("ArrowRight");
    await expect(dark).toBeChecked();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(group.getByRole("radio", { checked: true })).toHaveCount(1);

    // Another tab changes the preference while this mounted control stays open.
    const other = await context.newPage();
    await other.goto("/");
    await other.evaluate(() =>
      localStorage.setItem("last-layer-theme", "light"),
    );
    await expect(light).toBeChecked();
    await expect(dark).not.toBeChecked();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await other.evaluate(() => localStorage.removeItem("last-layer-theme"));
    await expect(system).toBeChecked();
    await other.close();

    for (const theme of ["dark", "light"]) {
      await page.emulateMedia({ colorScheme: theme });
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(system).toBeChecked();
      for (const radio of [system, light, dark]) {
        await radio.scrollIntoViewIfNeeded();
        const box = await radio.boundingBox();
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      }
      await page.screenshot({
        path: testInfo.outputPath(`theme-radios-${theme}.png`),
      });
    }
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Settings", exact: true }),
    ).toHaveCount(0);
    await openSettings(page);
    await expect(system).toBeChecked();
    await dark.check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
}
