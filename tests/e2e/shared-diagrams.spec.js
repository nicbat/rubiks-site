import { test, expect, seed, openLibrary } from "./fixtures.js";

async function checkPreviews(root, width) {
  const previews = root.getByRole("img", {
    name: /viewed from above; front at bottom/,
  });
  expect(await previews.count()).toBeGreaterThan(0);
  await expect(previews.locator("text")).toHaveCount(0);
  for (const preview of await previews.all()) {
    const bounds = await preview.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    const stickers = preview.locator("rect");
    await expect(stickers).toHaveCount(21);
  }
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 667, height: 375 },
]) {
  test(`shared 2D previews have no visible front caption across pages at ${viewport.width}×${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await seed(page);
    for (const colorScheme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme });
      await page
        .getByRole("button", { name: "My learning", exact: true })
        .click();
      await checkPreviews(page.getByRole("main"), viewport.width);
      await page.getByRole("button", { name: "Start hidden practice" }).click();
      await expect(
        page.getByRole("main").getByRole("img", { name: /viewed from above/ }),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "Ready to recognize" }).click();
      await page.getByRole("button", { name: "Finished", exact: true }).click();
      await checkPreviews(page.getByRole("main"), viewport.width);
      await page.getByRole("button", { name: "Progress", exact: true }).click();
      await checkPreviews(page.getByRole("main"), viewport.width);
      await openLibrary(page);
      await checkPreviews(page.getByRole("main"), viewport.width);
      await page
        .getByRole("button", { name: "View T perm", exact: true })
        .click();
      await checkPreviews(page.getByRole("dialog"), viewport.width);
      await page
        .getByRole("button", { name: "Close case", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Practice these cases", exact: true })
        .click();
      const picker = page.getByRole("dialog", {
        name: "Choose cases to practice",
        exact: true,
      });
      await checkPreviews(picker, viewport.width);
      await page.getByRole("button", { name: "Close practice picker" }).click();
      await page.screenshot({
        path: testInfo.outputPath(`shared-diagrams-${colorScheme}.png`),
        fullPage: true,
      });
    }
  });
}
