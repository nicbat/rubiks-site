import { test, expect, seed, openLibrary } from "./fixtures.js";

async function checkPreviews(root, width) {
  const previews = root.getByRole("img", {
    name: /viewed from above; front at bottom/,
  });
  await expect(previews).not.toHaveCount(0);
  await expect(previews.locator("text")).toHaveCount(0);
  // Inspect every SVG in one browser call. Per-diagram protocol round trips
  // exhausted Firefox's deadline before later picker/theme checks could run.
  const diagrams = await previews.evaluateAll((elements) =>
    elements.map((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        left: bounds.left,
        right: bounds.right,
        stickers: element.querySelectorAll("rect").length,
      };
    }),
  );
  expect(diagrams.length).toBeGreaterThan(0);
  for (const diagram of diagrams) {
    expect(diagram.left).toBeGreaterThanOrEqual(0);
    expect(diagram.right).toBeLessThanOrEqual(width);
    expect(diagram.stickers).toBe(21);
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
