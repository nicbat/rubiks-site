import { test, expect } from "./fixtures.js";

// Framed rectangles are dog-eared at the top right and bottom left. Each
// angled edge must match the straight frame, and hover lighting must treat it
// like any other edge.

async function courseCard(page, { theme = "dark", hover = true } = {}) {
  await page.setViewportSize({ width: 1024, height: 760 });
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.goto("/#/courses");
  const card = page.locator(".course-card").first();
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  if (hover)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
  else await page.mouse.move(1, 1);
  const frame = await card.evaluate((el) => ({
    width: parseFloat(getComputedStyle(el).borderBottomWidth),
    cut: parseFloat(getComputedStyle(el).getPropertyValue("--cut")),
  }));
  const corners = {
    topRight: { x: box.x + box.width, y: box.y, dx: -1, dy: 1 },
    bottomLeft: { x: box.x, y: box.y + box.height, dx: 1, dy: -1 },
  };
  return { box, frame, corners };
}

// Reads RGB pixels from a CSS-pixel screenshot of the region around a
// corner, decoding the PNG in the page.
async function pixels(page, corner, coordinates) {
  const clip = { x: corner.x - 40, y: corner.y - 40, width: 80, height: 80 };
  const png = await page.screenshot({ clip, scale: "css" });
  return page.evaluate(
    async ({ data, clip, coordinates }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      return coordinates.map(([x, y]) =>
        Array.from(
          context
            .getImageData(Math.floor(x - clip.x), Math.floor(y - clip.y), 1, 1)
            .data.slice(0, 3),
        ),
      );
    },
    { data: png.toString("base64"), clip, coordinates },
  );
}

const brightness = (rgb) => Math.max(...rgb);
// A point `along` px in from the corner along both of its edges.
const near = ({ x, y, dx, dy }, along) => [x + dx * along, y + dy * along];

test("hovered panel glow follows both dog-eared corners", async ({ page }) => {
  const { corners } = await courseCard(page);
  for (const [name, corner] of Object.entries(corners)) {
    // Points beyond the 45° cut: past its midpoint, just outside the edge
    // near the corner, and the square corner itself.
    const outside = await pixels(page, corner, [
      near(corner, 3),
      [corner.x + corner.dx * 4, corner.y - corner.dy * 2],
      [corner.x - corner.dx, corner.y - corner.dy],
    ]);
    // The dark page is black with faint grid lines; any edge, ring or glow
    // pixel is far brighter.
    for (const [index, rgb] of outside.entries())
      expect(
        brightness(rgb),
        `${name} point ${index} shows page only`,
      ).toBeLessThan(48);
  }
});

test("each angled edge is as thick as the straight frame", async ({ page }) => {
  // Light mode at rest: a black frame on a white panel and pale page, with no
  // glow to blur the measurement.
  const { box, frame, corners } = await courseCard(page, {
    theme: "light",
    hover: false,
  });
  const span = Array.from({ length: 16 }, (_, i) => i);
  const bottom = box.y + box.height;
  // A vertical scan across the bottom frame, well away from both corners.
  const across = span.map((i) => [box.x + box.width / 2, bottom - 12 + i]);
  // Coverage sums how much of the black frame each scan crosses: 0 for the
  // white panel or pale page, 1 for a fully dark frame pixel, partial for
  // antialiased edge pixels.
  const coverage = (row) =>
    row.reduce((sum, rgb) => {
      const level = Math.max(...rgb);
      return sum + Math.min(1, Math.max(0, (215 - level) / (215 - 10)));
    }, 0);
  const straightWidth = coverage(
    await pixels(page, { x: across[0][0], y: bottom }, across),
  );
  expect(straightWidth).toBeGreaterThan(frame.width - 0.75);
  for (const [name, corner] of Object.entries(corners)) {
    // A horizontal scan across the angled edge, halfway along the cut.
    const y = corner.y + (corner.dy * frame.cut) / 2;
    const x = corner.x + (corner.dx * frame.cut) / 2;
    const diagonal = span.map((i) => [x - 8 + i, y]);
    // A horizontal scan crosses a 45° line √2 times its perpendicular width.
    const angledWidth =
      coverage(await pixels(page, corner, diagonal)) / Math.SQRT2;
    expect(angledWidth, `${name} edge matches the frame`).toBeGreaterThan(
      straightWidth - 0.6,
    );
    expect(angledWidth).toBeLessThan(straightWidth + 0.6);
  }
});

test("hover lighting is the same outside straight and angled edges", async ({
  page,
}) => {
  const { box, frame, corners } = await courseCard(page);
  const step = 4 / Math.SQRT2;
  // The darkest pixel in a 3×3 patch ignores 1px grid lines; only a halo
  // lifts the whole patch.
  const patch = ([x, y]) =>
    [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => [x + dx, y + dy]));
  const floor = async (corner, point) =>
    Math.min(...(await pixels(page, corner, patch(point))).map(brightness));
  // 4px out from the right frame, away from the corner.
  const right = { x: box.x + box.width, y: box.y + 30 };
  const besideStraight = await floor(right, [right.x + 4, right.y]);
  for (const [name, corner] of Object.entries(corners)) {
    // 4px out from the middle of the angled edge along its normal.
    const [x, y] = near(corner, frame.cut / 2);
    const beyondAngle = await floor(corner, [
      x - corner.dx * step,
      y - corner.dy * step,
    ]);
    expect(
      Math.abs(besideStraight - beyondAngle),
      `${name} halo matches the straight edge`,
    ).toBeLessThan(12);
  }
});

test("the header, its controls, nav keys, buttons and panels share the dog-ear", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 760 });
  await page.goto("/#/courses");
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  const targets = {
    header: page.locator(".header"),
    "header controls": page.locator(".header-actions"),
    "settings key": page.getByRole("button", { name: "Settings" }),
    "current nav key": navigation.getByRole("button", { name: "Courses" }),
    "course card": page.locator(".course-card").first(),
    "card button": page.locator(".course-card .secondary").first(),
  };
  for (const [name, target] of Object.entries(targets)) {
    await target.scrollIntoViewIfNeeded();
    // Clipped areas do not receive hits, so hit-testing 1.5px inside each
    // corner shows which corners are cut.
    const hits = await target.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const inside = (x, y) => el.contains(document.elementFromPoint(x, y));
      return {
        topLeft: inside(r.left + 1.5, r.top + 1.5),
        topRight: inside(r.right - 1.5, r.top + 1.5),
        bottomLeft: inside(r.left + 1.5, r.bottom - 1.5),
        bottomRight: inside(r.right - 1.5, r.bottom - 1.5),
      };
    });
    expect(hits, name).toEqual({
      topLeft: true,
      topRight: false,
      bottomLeft: false,
      bottomRight: true,
    });
  }
});

test("dark nav keys have no bottom band and frame and glow in their own color", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 760 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/#/courses");
  await page.mouse.move(1, 1);
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  for (const key of await navigation.getByRole("button").all()) {
    const { frame, chip } = await key.evaluate((el) => ({
      frame: getComputedStyle(el).borderBottomColor,
      // The current key fills its face with the color and inks its chip.
      chip: el.hasAttribute("aria-current")
        ? getComputedStyle(el).backgroundColor
        : getComputedStyle(el, "::before").backgroundColor,
    }));
    expect(frame, await key.textContent()).toBe(chip);
  }

  // Just inside the bottom frame, the face runs right down to the border.
  const noBottomBand = async (key, state) => {
    const box = await key.boundingBox();
    const x = box.x + box.width / 2;
    const bottom = box.y + box.height;
    const face = await pixels(page, { x, y: bottom }, [
      [x, bottom - 9],
      [x, bottom - 6],
      [x, bottom - 4],
      [x, bottom - 3],
    ]);
    // Hover glow may brighten the edge; a band would darken it.
    for (const rgb of face.slice(1))
      expect(
        Math.max(...face[0]) - Math.max(...rgb),
        `no dark band above the bottom frame ${state}`,
      ).toBeLessThan(10);
  };
  await noBottomBand(
    navigation.getByRole("button", { name: "My learning" }),
    "at rest",
  );

  // Touch devices have no hover state.
  if (!(await page.evaluate(() => matchMedia("(hover: hover)").matches)))
    return;
  // Timer is last, so nothing else lights the page beside it.
  const timer = navigation.getByRole("button", { name: "Timer" });
  const box = await timer.boundingBox();
  const right = box.x + box.width;
  const cut = await timer.evaluate((el) =>
    parseFloat(getComputedStyle(el).getPropertyValue("--cut")),
  );
  const corner = { x: right, y: box.y };
  const step = 4 / Math.SQRT2;
  const points = [
    // 6px in from the right frame, at mid-height.
    [right - 6, box.y + box.height / 2],
    // 4px out from the right frame, and 4px out from the angled edge.
    [right + 4, box.y + box.height / 2],
    [right - cut / 2 + step, box.y + cut / 2 - step],
  ];
  const before = await pixels(page, corner, points);
  await timer.hover();
  await expect
    .poll(
      async () => {
        const [inside] = await pixels(page, corner, points);
        return inside[0] - before[0][0];
      },
      { message: "Timer glows red inside its frame" },
    )
    .toBeGreaterThan(20);
  const [inside, besideStraight, beyondAngle] = await pixels(
    page,
    corner,
    points,
  );
  const rise = inside.map((v, i) => v - before[0][i]);
  expect(rise.indexOf(Math.max(...rise)), "Timer glow is red").toBe(0);
  // Outside, the straight and angled edges light the page alike.
  expect(
    Math.abs(Math.max(...besideStraight) - Math.max(...beyondAngle)),
    "halo matches on straight and angled edges",
  ).toBeLessThan(12);
  await noBottomBand(timer, "on hover");
});

test("dark filled keys glow inside, so the light follows their cut corners", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 760 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  // Outside, the page beside a straight edge and beyond an angled edge
  // match; a box-shadow halo would light only the first.
  const evenOutside = async (key, state) => {
    const box = await key.boundingBox();
    const right = box.x + box.width;
    const cut = await key.evaluate((el) =>
      parseFloat(getComputedStyle(el).getPropertyValue("--cut")),
    );
    const step = 4 / Math.SQRT2;
    const [besideStraight, beyondAngle] = await pixels(
      page,
      { x: right, y: box.y },
      [
        [right + 4, box.y + box.height / 2],
        [right - cut / 2 + step, box.y + cut / 2 - step],
      ],
    );
    expect(
      Math.abs(Math.max(...besideStraight) - Math.max(...beyondAngle)),
      `${await key.textContent()} glow is even ${state}`,
    ).toBeLessThan(12);
  };

  await page.goto("/#/courses");
  await page.mouse.move(1, 1);
  await evenOutside(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: "Courses" }),
    "on the current page",
  );

  await page.goto("/#/home");
  await page.mouse.move(1, 1);
  const explore = page.getByRole("button", { name: "Explore courses" });
  await evenOutside(explore, "at rest");
  if (await page.evaluate(() => matchMedia("(hover: hover)").matches)) {
    await explore.hover();
    await evenOutside(explore, "on hover");
  }
});

test("the header is framed like the nav keys in each theme", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 760 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/#/courses");
  const header = page.locator(".header");
  const navKey = page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Timer" });
  const keyWidth = await navKey.evaluate(
    (el) => getComputedStyle(el).borderTopWidth,
  );
  // By day: the nav keys' frame width, a black frame and the same hard
  // offset shadow.
  await expect(header).toHaveCSS("border-top-width", keyWidth);
  await expect(header).toHaveCSS("border-top-color", "rgb(10, 10, 10)");
  await expect(header).toHaveCSS("box-shadow", /3px 3px 0px/);
  // By night: the cube's white sticker, with no shadow.
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(header).toHaveCSS("border-top-color", "rgb(244, 244, 240)");
  await expect(header).toHaveCSS("border-top-width", keyWidth);
  await expect(header).toHaveCSS("box-shadow", "none");
  // Its control tray and keys share that frame width; the tray is white by
  // night and the keys stay neutral, with no nav sticker colors.
  const tray = page.locator(".header-actions");
  const keys = tray.locator(".icon-button");
  await expect(tray).toHaveCSS("border-top-width", keyWidth);
  await expect(tray).toHaveCSS("border-top-color", "rgb(244, 244, 240)");
  for (const key of await keys.all()) {
    await expect(key).toHaveCSS("border-top-width", keyWidth);
    await expect(key).toHaveCSS("border-top-color", "rgb(107, 107, 116)");
  }
});
