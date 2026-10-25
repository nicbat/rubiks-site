import { test, expect } from "./fixtures.js";

// Panels have one chamfered corner. Its angled edge must match the straight
// frame, and hover lighting must treat it like any other edge.

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
  return { box, frame };
}

// Reads RGB pixels from a CSS-pixel screenshot of the region around the
// corner, decoding the PNG in the page.
async function pixels(page, box, coordinates) {
  const clip = {
    x: box.x + box.width - 60,
    y: box.y + box.height - 60,
    width: 72,
    height: 72,
  };
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

test("hovered panel glow follows the chamfered corner", async ({ page }) => {
  const { box } = await courseCard(page);
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  // Points beyond the 45° cut: past its midpoint, just below the bottom edge
  // near the corner, and the square corner itself.
  const outside = await pixels(page, box, [
    [right - 3, bottom - 3],
    [right - 4, bottom + 2],
    [right + 1, bottom + 1],
  ]);
  // The dark page is black with faint grid lines; any edge, ring or glow
  // pixel is far brighter.
  for (const [index, rgb] of outside.entries())
    expect(brightness(rgb), `point ${index} shows page only`).toBeLessThan(48);
});

test("the angled edge is as thick as the straight frame", async ({ page }) => {
  // Light mode at rest: a black frame on a white panel and pale page, with no
  // glow to blur the measurement.
  const { box, frame } = await courseCard(page, {
    theme: "light",
    hover: false,
  });
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  const span = Array.from({ length: 16 }, (_, i) => i);
  // A vertical scan across the bottom frame, well away from the corner.
  const across = span.map((i) => [right - 40, bottom - 12 + i]);
  // A horizontal scan across the angled edge, halfway along the cut.
  const y = bottom - frame.cut / 2;
  const diagonal = span.map((i) => [right - frame.cut / 2 - 8 + i, y]);
  const [straight, angled] = await Promise.all([
    pixels(page, box, across),
    pixels(page, box, diagonal),
  ]);
  // Coverage sums how much of the black frame each scan crosses: 0 for the
  // white panel or pale page, 1 for a fully dark frame pixel, partial for
  // antialiased edge pixels.
  const coverage = (row) =>
    row.reduce((sum, rgb) => {
      const level = Math.max(...rgb);
      return sum + Math.min(1, Math.max(0, (215 - level) / (215 - 10)));
    }, 0);
  const straightWidth = coverage(straight);
  // A horizontal scan crosses a 45° line √2 times its perpendicular width.
  const angledWidth = coverage(angled) / Math.SQRT2;
  expect(straightWidth).toBeGreaterThan(frame.width - 0.75);
  expect(angledWidth, "angled edge matches the frame").toBeGreaterThan(
    straightWidth - 0.6,
  );
  expect(angledWidth).toBeLessThan(straightWidth + 0.6);
});

test("hover lighting is the same outside straight and angled edges", async ({
  page,
}) => {
  const { box, frame } = await courseCard(page);
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  const step = 4 / Math.SQRT2;
  // The darkest pixel in a 3×3 patch ignores 1px grid lines; only a halo
  // lifts the whole patch.
  const patch = ([x, y]) =>
    [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => [x + dx, y + dy]));
  const floor = async (point) =>
    Math.min(...(await pixels(page, box, patch(point))).map(brightness));
  // 4px below the bottom frame, away from the corner, and 4px out from the
  // middle of the angled edge along its normal.
  const belowStraight = await floor([right - 40, bottom + 4]);
  const beyondAngle = await floor([
    right - frame.cut / 2 + step,
    bottom - frame.cut / 2 + step,
  ]);
  expect(
    Math.abs(belowStraight - beyondAngle),
    "halo matches on both kinds of edge",
  ).toBeLessThan(12);
});
