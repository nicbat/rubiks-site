import { test, expect } from "./fixtures.js";

// Sticker tiles (colored chip per destination) belong to the main navigation
// only. The footer's reference links are framed keys of their own, with room
// inside the frame and space between them.
test("footer links are spaced keys without main-nav tiles", async ({
  page,
}) => {
  await page.goto("/#/home");
  const footer = page.getByRole("navigation", { name: "Reference and tools" });
  const links = footer.getByRole("button");
  await expect(links).toHaveCount(2);
  const boxes = [];
  for (const link of await links.all()) {
    const style = await link.evaluate((el) => {
      const css = getComputedStyle(el);
      return {
        chip: getComputedStyle(el, "::before").content,
        border: parseFloat(css.borderTopWidth),
        padding: parseFloat(css.paddingLeft),
        fits: el.scrollWidth <= el.clientWidth,
      };
    });
    expect(style.chip, "no main-nav chip").toBe("none");
    expect(style.border, "framed").toBeGreaterThan(0);
    expect(style.padding, "room inside the frame").toBeGreaterThanOrEqual(12);
    expect(style.fits).toBe(true);
    boxes.push(await link.boundingBox());
  }
  const [first, second] = boxes;
  const apart =
    second.y >= first.y + first.height ||
    second.x - (first.x + first.width) >= 8;
  expect(apart, "links do not run together").toBe(true);
  // The main navigation keeps its tiles.
  const main = page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button")
    .first();
  expect(
    await main.evaluate((el) => getComputedStyle(el, "::before").content),
  ).not.toBe("none");
});

// The header brand is a drawn wordmark; its link keeps the "Last Layer" name.
for (const viewport of [
  { width: 1280, height: 800 },
  { width: 667, height: 375 },
  { width: 320, height: 720 },
])
  test(`the wordmark names the brand link and fits the header at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/#/home");
    const brand = page.getByRole("link", { name: "Last Layer", exact: true });
    const wordmark = brand.locator("svg.wordmark");
    await expect(wordmark).toBeVisible();
    await expect(wordmark).toHaveAttribute("aria-hidden", "true");
    const [mark, header, tray] = await Promise.all([
      wordmark.boundingBox(),
      page.locator(".header").boundingBox(),
      page.locator(".header-actions").boundingBox(),
    ]);
    expect(mark.x).toBeGreaterThanOrEqual(header.x);
    expect(mark.x + mark.width).toBeLessThanOrEqual(header.x + header.width);
    expect(mark.y).toBeGreaterThanOrEqual(header.y);
    expect(mark.y + mark.height).toBeLessThanOrEqual(header.y + header.height);
    const clearOfTray =
      mark.x + mark.width <= tray.x || mark.y + mark.height <= tray.y;
    expect(clearOfTray, "wordmark clears the control tray").toBe(true);
  });
