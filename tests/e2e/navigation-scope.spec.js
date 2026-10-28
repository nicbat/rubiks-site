import { test, expect } from "./fixtures.js";

// Sticker tiles (colored chip per destination) belong to the main navigation
// only. The footer's reference links and Backup and transfer are framed keys of
// their own, in the brand gradient and display face, with room inside the
// frame and space between them.
test("footer links are spaced brand keys without main-nav tiles", async ({
  page,
}) => {
  await page.goto("/#/home");
  const footer = page.getByRole("navigation", { name: "Reference and tools" });
  const links = footer.getByRole("button");
  await expect(links).toHaveCount(2);
  const backup = page.getByRole("button", {
    name: "Backup and transfer training data",
  });
  // Spelled out: Silkscreen's ampersand reads like a dollar sign.
  await expect(backup).toHaveText("Backup and transfer");
  const boxes = [];
  for (const key of [...(await links.all()), backup]) {
    const style = await key.evaluate((el) => {
      const css = getComputedStyle(el);
      return {
        chip: getComputedStyle(el, "::before").content,
        border: parseFloat(css.borderTopWidth),
        borderColor: css.borderTopColor,
        background: css.backgroundImage,
        font: css.fontFamily,
        padding: parseFloat(css.paddingLeft),
        fits: el.scrollWidth <= el.clientWidth,
      };
    });
    expect(style.chip, "no main-nav chip").toBe("none");
    expect(style.border, "framed").toBeGreaterThan(0);
    // The frame is the brand gradient showing through a clear border.
    expect(style.borderColor).toBe("rgba(0, 0, 0, 0)");
    expect(style.background).toContain(
      "linear-gradient(rgb(255, 42, 109), rgb(157, 60, 255))",
    );
    expect(style.font).toContain("Silkscreen");
    expect(style.padding, "room inside the frame").toBeGreaterThanOrEqual(12);
    expect(style.fits).toBe(true);
    boxes.push(await key.boundingBox());
  }
  // Hovering keeps the gradient frame instead of a solid border.
  if (await page.evaluate(() => matchMedia("(hover: hover)").matches)) {
    await backup.hover();
    await expect(backup).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
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

// The header brand is a flame-wrapped mark and a drawn wordmark; its link
// keeps the "Last Layer" name.
for (const viewport of [
  { width: 1280, height: 800 },
  { width: 667, height: 375 },
  { width: 320, height: 720 },
])
  test(`the brand logo and wordmark fit the header at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/#/home");
    const brand = page.getByRole("link", { name: "Last Layer", exact: true });
    const wordmark = brand.locator("svg.wordmark");
    await expect(wordmark).toBeVisible();
    await expect(wordmark).toHaveAttribute("aria-hidden", "true");
    const logo = brand.locator(".brand-logo");
    await expect(logo).toHaveAttribute("aria-hidden", "true");
    await expect(logo.locator("svg.brand-flame")).toBeVisible();
    await expect(logo.locator(".brand-mark i")).toHaveCount(4);
    const [mark, header, tray, logoBox] = await Promise.all([
      wordmark.boundingBox(),
      page.locator(".header").boundingBox(),
      page.locator(".header-actions").boundingBox(),
      logo.boundingBox(),
    ]);
    // The flame overhangs the logo but stays inside the header and clear of
    // the wordmark.
    const fire = await logo.locator("svg.brand-flame").boundingBox();
    expect(fire.x).toBeGreaterThanOrEqual(header.x);
    expect(fire.y).toBeGreaterThanOrEqual(header.y);
    expect(fire.y + fire.height).toBeLessThanOrEqual(header.y + header.height);
    expect(fire.x + fire.width).toBeLessThanOrEqual(mark.x);
    expect(logoBox.y).toBeGreaterThanOrEqual(header.y);
    expect(mark.x).toBeGreaterThanOrEqual(header.x);
    expect(mark.x + mark.width).toBeLessThanOrEqual(header.x + header.width);
    expect(mark.y).toBeGreaterThanOrEqual(header.y);
    expect(mark.y + mark.height).toBeLessThanOrEqual(header.y + header.height);
    const clearOfTray =
      mark.x + mark.width <= tray.x || mark.y + mark.height <= tray.y;
    expect(clearOfTray, "wordmark clears the control tray").toBe(true);
  });

// About is the sixth destination: one centered panel of short copy.
for (const viewport of [
  { width: 1280, height: 800 },
  { width: 320, height: 720 },
])
  test(`about opens from the nav as a centered panel at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/#/home");
    const navigation = page.getByRole("navigation", {
      name: "Main navigation",
    });
    await navigation
      .getByRole("button", { name: "About", exact: true })
      .click();
    await expect(page).toHaveURL(/#\/about$/);
    await expect(
      navigation.getByRole("button", { name: "About", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("heading", { name: "About", exact: true, level: 1 }),
    ).toBeVisible();
    const panel = page.getByRole("region", { name: "Last Layer" });
    await expect(panel).toContainText("3×3");
    await expect(panel).toHaveCSS("text-align", "center");
    const [box, main] = await Promise.all([
      panel.boundingBox(),
      page.getByRole("main").boundingBox(),
    ]);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(
      Math.abs(box.x + box.width / 2 - (main.x + main.width / 2)),
      "panel is centered in the page",
    ).toBeLessThan(2);
  });
