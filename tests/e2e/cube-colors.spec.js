import { test, expect, seed } from "./fixtures.js";

// Standard BOY scheme rotated to the app's yellow-up, green-front grip.
// Literal display colors keep this independent of the shared renderer palette.
const centers = [
  { face: "U", position: [0, 1, 0], rgb: "rgb(255, 216, 74)" },
  { face: "D", position: [0, -1, 0], rgb: "rgb(255, 255, 255)" },
  { face: "F", position: [0, 0, 1], rgb: "rgb(71, 187, 160)" },
  { face: "B", position: [0, 0, -1], rgb: "rgb(98, 154, 224)" },
  { face: "R", position: [1, 0, 0], rgb: "rgb(245, 163, 75)" },
  { face: "L", position: [-1, 0, 0], rgb: "rgb(236, 102, 92)" },
];

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  for (const colorScheme of ["light", "dark"]) {
    test(`standard center colors in 3D and net at ${viewport.width}x${viewport.height} ${colorScheme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce", colorScheme });
      await seed(page);
      await page.getByRole("button", { name: "Guides", exact: true }).click();
      await page.getByRole("button", { name: "Notation", exact: true }).click();
      const player = page.getByRole("region", { name: "3D cube player" });
      await expect(
        player.getByRole("button", { name: "Play", exact: true }),
      ).toBeVisible();
      const net = page.getByRole("img", {
        name: "Before: solved cube",
        exact: true,
      });
      for (const { face, position, rgb } of centers) {
        const sticker = player.locator(
          `[data-position="${position}"][data-normal="${position}"]`,
        );
        // The rounded colored sticker sits on a complete opaque plastic face.
        await expect(sticker).toHaveCSS("background-color", "rgb(32, 40, 50)");
        expect(
          await sticker.evaluate(
            (el) => getComputedStyle(el, "::after").backgroundColor,
          ),
        ).toBe(rgb);
        await expect(
          net.locator(`[data-face="${face}"][data-row="1"][data-col="1"] rect`),
        ).toHaveCSS("fill", rgb);
        // Read actual CSS matrices, including cubie and face transforms. This
        // catches swapped physical faces even when data attributes are correct.
        const projected = await sticker.evaluate((el) => {
          const piece = new DOMMatrix(
            getComputedStyle(el.parentElement).transform,
          );
          const face = new DOMMatrix(getComputedStyle(el).transform);
          const matrix = piece.multiply(face);
          const p = new DOMPoint(0, 0, 0).matrixTransform(matrix);
          const n = new DOMPoint(0, 0, 1, 0).matrixTransform(matrix);
          return { p: [p.x, p.y, p.z], n: [n.x, n.y, n.z] };
        });
        const cssNormal = [position[0], -position[1], position[2]];
        cssNormal.forEach((value, axis) => {
          expect(projected.n[axis]).toBeCloseTo(value);
          expect(projected.p[axis]).toBeCloseTo(value * 72);
        });
      }
      await player.getByRole("img").focus();
      await page.keyboard.press("ArrowRight");
      await player.screenshot({
        path: testInfo.outputPath("standard-cube-colors.png"),
      });
      const bounds = await player.getByRole("img").boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    });
  }
}
