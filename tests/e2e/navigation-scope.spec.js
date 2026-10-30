import { test, expect, closeSettings } from "./fixtures.js";

// Finds the current key's underline as painted: the pixels in the key's own
// color in a strip just below it, past its 3px drop shadow, decoded in the
// page from a CSS-pixel screenshot. Other keys and their drop shadows are
// left out, so a wrapped row below can't pass for the line. Returns the
// band's bounds in page coordinates, or null when nothing matches.
async function paintedUnderline(page, box, { fill, others }) {
  const clip = {
    x: Math.max(0, Math.floor(box.x) - 8),
    y: Math.ceil(box.y + box.height) + 4,
    width: Math.ceil(box.width) + 16,
    height: 12,
  };
  const png = await page.screenshot({
    clip,
    scale: "css",
    animations: "disabled",
  });
  return page.evaluate(
    async ({ data, clip, fill, others }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, image.width, image.height);
      const target = fill
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number);
      const covered = (x, y) =>
        others.some(
          (r) =>
            x >= r.left && x < r.right + 4 && y >= r.top && y < r.bottom + 4,
        );
      let band = null;
      for (let y = 0; y < image.height; y++)
        for (let x = 0; x < image.width; x++) {
          const i = (y * image.width + x) * 4;
          const near = target.every(
            (v, c) => Math.abs(pixels.data[i + c] - v) <= 32,
          );
          const [px, py] = [clip.x + x, clip.y + y];
          if (!near || covered(px, py)) continue;
          band ??= { left: px, right: px + 1, top: py, bottom: py + 1 };
          band.left = Math.min(band.left, px);
          band.right = Math.max(band.right, px + 1);
          band.top = Math.min(band.top, py);
          band.bottom = Math.max(band.bottom, py + 1);
        }
      return band;
    },
    { data: png.toString("base64"), clip, fill, others },
  );
}

// Sticker tiles (colored chip per destination) belong to the main navigation
// only. The footer's reference links and Backup and transfer are framed keys of
// their own, in the brand gradient and display face, with room inside the
// frame and space between them.
test("footer links are spaced brand keys without main-nav tiles", async ({
  page,
}) => {
  await page.goto("/home");
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
    await page.goto("/home");
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
    // Wide headers add a decorative status panel between the wordmark and
    // the controls: one light per cube face over a small label.
    const signal = page.locator(".header-signal");
    if (viewport.width > 1000) {
      await expect(signal).toBeVisible();
      await expect(signal).toHaveAttribute("aria-hidden", "true");
      await expect(signal.locator(".signal-lights i")).toHaveCount(6);
      await expect(signal).toHaveText("Speed cube trainer");
      const panel = await signal.boundingBox();
      expect(panel.x).toBeGreaterThanOrEqual(mark.x + mark.width);
      expect(panel.x + panel.width).toBeLessThanOrEqual(tray.x);
    } else await expect(signal).toBeHidden();
  });

// About is the sixth destination: a centered title panel, then three
// numbered features, each with a decorative screen that fits beside or above
// its copy.
for (const viewport of [
  { width: 1280, height: 800 },
  { width: 320, height: 720 },
  { width: 667, height: 375 },
])
  test(`about opens from the nav as a centered panel at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/home");
    const navigation = page.getByRole("navigation", {
      name: "Main navigation",
    });
    await navigation
      .getByRole("button", { name: "About", exact: true })
      .click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(
      navigation.getByRole("button", { name: "About", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("heading", { name: "About", exact: true, level: 1 }),
    ).toHaveCount(1);
    const panel = page.getByRole("region", {
      name: "Last Layer",
      exact: true,
    });
    await expect(panel).toContainText("speedcubers");
    await expect(panel).toHaveCSS("text-align", "center");
    const features = page
      .getByRole("region", { name: "Why Last Layer?" })
      .getByRole("listitem");
    await expect(features).toHaveCount(3);
    for (const feature of await features.all()) {
      await expect(feature.getByRole("heading", { level: 3 })).toBeVisible();
      const screen = feature.locator(".about-screen");
      await expect(screen).toHaveAttribute("aria-hidden", "true");
      await expect(screen.locator("svg, .about-lcd").first()).toBeVisible();
      for (const part of [feature, screen]) {
        const bounds = await part.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      }
    }
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

// The highlighted nav button already names each top-level page, so its h1 is
// for assistive tech only and the page starts with content (or a slim row of
// page actions) right under the nav. Only the current button is underlined,
// in its own color, without touching a wrapped row below.
for (const viewport of [
  { width: 1280, height: 800 },
  { width: 320, height: 720 },
  { width: 667, height: 375 },
])
  test(`top-level pages are named by an underlined nav button, not a visible title, at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/home");
    await closeSettings(page);
    const navigation = page.getByRole("navigation", {
      name: "Main navigation",
    });
    for (const label of [
      "Dashboard",
      "My learning",
      "Courses",
      "Progress",
      "Timer",
      "About",
    ]) {
      const button = navigation.getByRole("button", {
        name: label,
        exact: true,
      });
      await button.click();
      await expect(button).toHaveAttribute("aria-current", "page");
      const key = await button.evaluate((el) => {
        const style = getComputedStyle(el);
        const others = [...el.parentElement.children].filter((b) => b !== el);
        return {
          fill: style.backgroundColor,
          cut: parseFloat(style.getPropertyValue("--cut")),
          glow: getComputedStyle(el, "::after").boxShadow,
          // The underline is paint only: the key has no layout overflow.
          overflow:
            el.scrollWidth > el.clientWidth ||
            el.scrollHeight > el.clientHeight,
          others: others.map((b) => b.getBoundingClientRect().toJSON()),
          othersUnderlined: others.filter(
            (b) => getComputedStyle(b, "::after").content !== "none",
          ).length,
        };
      });
      const keyBox = await button.boundingBox();
      const band = await paintedUnderline(page, keyBox, key);
      expect(band, `${label} underline is painted`).not.toBeNull();
      expect(key.overflow, `${label} key has no layout overflow`).toBe(false);
      expect(band.bottom - band.top).toBeGreaterThanOrEqual(2);
      // The line runs from the start of the bottom-left chamfer to the
      // bottom-right corner, so neither end is clipped.
      expect(
        Math.abs(band.left - (keyBox.x + key.cut)),
        `${label} underline starts at the chamfer`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(band.right - (keyBox.x + keyBox.width)),
        `${label} underline ends at the corner`,
      ).toBeLessThanOrEqual(1);
      // A soft glow falls further down than the line.
      const [line, glow] = [
        ...key.glow.matchAll(/(-?[\d.]+)px (-?[\d.]+)px ([\d.]+)px/g),
      ].map(([, , y, blur]) => ({ y: Number(y), blur: Number(blur) }));
      expect(glow.y, `${label} underline glows downward`).toBeGreaterThan(
        line.y,
      );
      expect(glow.blur).toBeGreaterThan(0);
      expect(
        key.others.some(
          (r) =>
            r.left < band.right &&
            r.right > band.left &&
            r.top < band.bottom &&
            r.bottom > band.top,
        ),
        `${label} underline clears other keys`,
      ).toBe(false);
      expect(key.othersUnderlined).toBe(0);
      const title = page.getByRole("heading", { level: 1 });
      await expect(title).toHaveCount(1);
      await expect(title).toHaveAccessibleName(label);
      const box = await title.boundingBox();
      expect(
        box.width,
        `${label} title is visually hidden`,
      ).toBeLessThanOrEqual(1);
      expect(
        box.height,
        `${label} title is visually hidden`,
      ).toBeLessThanOrEqual(1);
    }
    // Page actions that shared the old title row stay in reach.
    await navigation
      .getByRole("button", { name: "Progress", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Backup & transfer", exact: true }),
    ).toBeInViewport();
  });
