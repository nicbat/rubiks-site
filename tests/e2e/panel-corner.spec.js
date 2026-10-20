import { test, expect } from "./fixtures.js";

// The chamfered corner must stay cut while a panel glows on hover: nothing
// of the square frame, ring or glow may paint beyond the angled edge.
test("hovered panel glow follows the chamfered corner", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 760 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/#/courses");
  const card = page.locator(".course-card").first();
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  // Points beyond the 45° cut: past its midpoint, just below the bottom edge
  // near the corner, and the square corner itself.
  const points = [
    [right - 3, bottom - 3],
    [right - 4, bottom + 2],
    [right + 1, bottom + 1],
  ];
  const clip = { x: right - 16, y: bottom - 16, width: 24, height: 24 };
  const png = await page.screenshot({ clip, scale: "css" });
  const pixels = await page.evaluate(
    async ({ data, clip, points }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      return points.map(([x, y]) =>
        Array.from(
          context
            .getImageData(Math.round(x - clip.x), Math.round(y - clip.y), 1, 1)
            .data.slice(0, 3),
        ),
      );
    },
    { data: png.toString("base64"), clip, points },
  );
  // The dark page is black with faint grid lines; any edge, ring or glow
  // pixel is far brighter.
  for (const [index, rgb] of pixels.entries())
    expect(Math.max(...rgb), `point ${index} shows page only`).toBeLessThan(48);
});
