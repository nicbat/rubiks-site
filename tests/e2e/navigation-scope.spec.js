import { test, expect } from "./fixtures.js";

// Sticker tiles (colored chip per destination) belong to the main navigation
// only. The footer's reference links are framed keys of their own, with room
// inside the frame and space between them.
test("footer links are spaced keys without main-nav tiles", async ({
  page,
}) => {
  await page.goto("/");
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
