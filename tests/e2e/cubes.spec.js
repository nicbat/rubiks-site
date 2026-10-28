import { captureScreenshot } from "./screenshots.js";
import { reviewSolve } from "./fixtures.js";
import { openSettings, closeSettings } from "./fixtures.js";
import { test, expect, holdStartTimer } from "./fixtures.js";

async function addCube(page, name, description = "") {
  if (
    !(await page.locator("#cube-editor").getAttribute("open")) &&
    !(await page.getByLabel("Name", { exact: true }).isVisible())
  )
    await page.locator("#cube-editor summary").click();
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Description (optional)").fill(description);
  await page.getByRole("button", { name: "Add cube", exact: true }).click();
}

test("cube defaults, session choices, edits and retroactive assignments persist", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/#/home");
  await openSettings(page);
  await page.getByRole("button", { name: "Cubes", exact: true }).click();
  await addCube(page, "Main", "Smooth and quiet");
  await addCube(page, "Travel");
  await page.getByRole("button", { name: "Make default" }).click();
  await page.reload();
  await closeSettings(page);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  const picker = page.getByRole("combobox", { name: "Cube", exact: true });
  await expect(picker).toContainText("Travel");
  await picker.click();
  await page.getByRole("option", { name: "Main", exact: true }).click();
  await picker.press("Space");
  await picker.press("Escape");
  await expect(
    page.getByRole("button", { name: "Hold to start (Space)", exact: true }),
  ).toBeVisible();
  await holdStartTimer(page);
  await expect(picker).toBeDisabled();
  await page.clock.runFor(1200);
  await page.getByRole("button", { name: "Stop timer", exact: true }).click();
  await page.getByText("Solve history (1)", { exact: true }).click();
  await reviewSolve(page);
  const historyPicker = page.getByRole("combobox", {
    name: "Cube for this solve",
  });
  await expect(historyPicker).toContainText("Main");
  await historyPicker.focus();
  await historyPicker.click();
  await page.getByRole("option", { name: "Travel", exact: true }).click();
  await expect(historyPicker).toBeFocused();
  await page.getByRole("button", { name: "Close solve details" }).click();
  await expect(picker).toContainText("Main");
  await openSettings(page);
  await page.getByRole("button", { name: "Cubes", exact: true }).click();
  await page.getByRole("button", { name: "Edit Travel", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Travel updated");
  await page.getByRole("button", { name: "Save cube" }).click();
  await page.reload();
  await closeSettings(page);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await page.getByText("Solve history (1)", { exact: true }).click();
  await reviewSolve(page);
  await expect(historyPicker).toContainText("Travel updated");
  await historyPicker.click();
  await page
    .getByRole("option", { name: "Not specified", exact: true })
    .click();
  await page.reload();
  await closeSettings(page);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await page.getByText("Solve history (1)", { exact: true }).click();
  await reviewSolve(page);
  await expect(historyPicker).toContainText("Not specified");
});

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`cubes and history fit ${viewport.width}x${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.clock.install();
    await page.setViewportSize(viewport);
    await page.emulateMedia({
      colorScheme: viewport.width === 320 ? "light" : "dark",
    });
    await page.goto("/#/home");
    await openSettings(page);
    await page.getByRole("button", { name: "Cubes", exact: true }).click();
    await addCube(page, "Long cube name ".repeat(6), "Description".repeat(80));
    await page.locator("#cube-editor summary").click();
    for (const locator of [
      page.getByRole("navigation").getByRole("button"),
      page.locator(".cube-card"),
      page.locator(".cube-field input, .cube-field textarea"),
    ]) {
      for (const element of await locator.all()) {
        const box = await element.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      }
    }
    await captureScreenshot(page, {
      path: testInfo.outputPath("cubes.png"),
      fullPage: true,
    });
    await page.locator("#cube-editor summary").click();
    await page.getByRole("button", { name: /^Delete Long cube/ }).click();
    const confirm = page.getByRole("button", {
      name: "Delete cube",
      exact: true,
    });
    await expect(confirm).toBeFocused();
    const confirmBox = await confirm.boundingBox();
    expect(confirmBox.height).toBeGreaterThanOrEqual(44);
    expect(confirmBox.x + confirmBox.width).toBeLessThanOrEqual(viewport.width);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await closeSettings(page);
    await page.getByRole("button", { name: "Timer", exact: true }).click();
    await holdStartTimer(page);
    await page.getByRole("button", { name: "Stop timer", exact: true }).click();
    await page.getByText("Solve history (1)", { exact: true }).click();
    await reviewSolve(page);
    await page.getByRole("combobox", { name: "Cube for this solve" }).click();
    await page
      .getByRole("option", { name: "Not specified", exact: true })
      .click();
    for (const field of await page
      .getByRole("dialog")
      .getByRole("combobox")
      .all()) {
      const box = await field.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    }
    await captureScreenshot(page, {
      path: testInfo.outputPath("timer-cubes.png"),
      fullPage: true,
    });
  });
}

test("unreadable cube storage is preserved and failed writes are reported", async ({
  page,
}) => {
  await page.goto("/#/home");
  await page.evaluate(() =>
    localStorage.setItem("last-layer.cubes.v1", "broken"),
  );
  await page.reload();
  await openSettings(page);
  await page.getByRole("button", { name: "Cubes", exact: true }).click();
  await addCube(page, "Main");
  await expect(page.getByRole("alert")).toContainText(
    "Cubes could not be saved",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("last-layer.cubes.v1")),
  ).toBe("broken");
});

test("failed cube writes keep edits in this tab without replacing saved cubes", async ({
  page,
}) => {
  await page.goto("/#/home");
  await openSettings(page);
  await page.getByRole("button", { name: "Cubes", exact: true }).click();
  await addCube(page, "Original");
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "last-layer.cubes.v1")
        throw new DOMException("Full", "QuotaExceededError");
      return setItem.call(this, key, value);
    };
  });
  await addCube(page, "Unsaved");
  await expect(
    page.getByRole("heading", { name: "Unsaved", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "Cubes could not be saved",
  );
  await page.reload();
  await openSettings(page);
  await page.getByRole("button", { name: "Cubes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Original", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Unsaved", exact: true }),
  ).toHaveCount(0);
});

test("delete cubes with cancellation, preserved history, default fallback and keyboard focus", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/#/home");
  await openSettings(page);
  await page.getByRole("button", { name: "Cubes", exact: true }).click();
  await addCube(page, "Main");
  await addCube(page, "Travel");
  await closeSettings(page);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  const picker = page.getByRole("combobox", { name: "Cube", exact: true });
  await expect(picker).toHaveCSS("border-top-width", "0px");
  await picker.focus();
  await expect(picker).toBeFocused();
  await holdStartTimer(page);
  await page.getByRole("button", { name: "Stop timer", exact: true }).click();
  await openSettings(page);
  await page.getByRole("button", { name: "Cubes", exact: true }).click();
  await page.getByRole("button", { name: "Delete Main", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Delete cube", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Delete Main", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Delete Main", exact: true }).click();
  await page.getByRole("button", { name: "Delete cube", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Main", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Edit Travel", exact: true }),
  ).toBeFocused();
  await page.reload();
  await closeSettings(page);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await expect(picker).toContainText("Travel");
  await expect(
    page
      .locator("#timer-cube-options")
      .getByRole("option", { name: "Main", exact: true }),
  ).toHaveCount(0);
  await page.getByText("Solve history (1)", { exact: true }).click();
  await reviewSolve(page);
  await expect(
    page.getByRole("combobox", { name: "Cube for this solve" }),
  ).toContainText("Main");
  await page.getByRole("button", { name: "Close solve details" }).click();
  await openSettings(page);
  await page.getByRole("button", { name: "Cubes", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete Travel", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete cube", exact: true }).click();
  await expect(page.locator("#cube-editor summary")).toBeFocused();
  await closeSettings(page);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await expect(picker).toContainText("Not specified");
});

test("timer cube menu is compact, keyboard accessible, and fits a narrow phone", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/#/home");
  await openSettings(page);
  await page.getByRole("button", { name: "Cubes", exact: true }).click();
  await addCube(page, "GAN 12", "Main speedcube");
  await addCube(page, "RS3M", "Travel cube");
  await captureScreenshot(page, {
    path: testInfo.outputPath("cube-list.png"),
    fullPage: true,
  });
  await closeSettings(page);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  const picker = page.getByRole("combobox", { name: "Cube", exact: true });
  await expect(picker).toHaveCSS("border-top-width", "0px");
  await picker.focus();
  await picker.press("ArrowDown");
  const option = page.getByRole("option", { name: "RS3M", exact: true });
  await expect(option).toBeVisible();
  const menu = await page.getByRole("listbox", { name: "Cube" }).boundingBox();
  expect(menu.x).toBeGreaterThanOrEqual(0);
  expect(menu.x + menu.width).toBeLessThanOrEqual(320);
  await captureScreenshot(page, {
    path: testInfo.outputPath("cube-menu.png"),
    fullPage: true,
  });
  await picker.press("Escape");
  await expect(option).not.toBeVisible();
  await expect(picker).toBeFocused();
  await captureScreenshot(page, {
    path: testInfo.outputPath("timer-picker.png"),
    fullPage: true,
  });
});
