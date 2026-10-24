import { captureScreenshot } from "./screenshots.js";
import { test, expect, seed, openLibrary, saved } from "./fixtures.js";

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

async function expectPhysicalColors(player) {
  const actual = await player.locator("[data-color]").evaluateAll((faces) =>
    faces.map((face) => ({
      face: face.dataset.color,
      // Read the old pseudo-element too so the regression demonstrates the
      // original recoloring failure instead of merely requiring new markup.
      rgb: getComputedStyle(
        face.querySelector(".cube-sticker") || face,
        face.querySelector(".cube-sticker") ? null : "::after",
      ).backgroundColor,
    })),
  );
  expect(actual).toHaveLength(54);
  for (const { face, rgb } of centers) {
    const matching = actual.filter((sticker) => sticker.face === face);
    expect(matching).toHaveLength(9);
    expect(matching.every((sticker) => sticker.rgb === rgb)).toBe(true);
  }
}

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  for (const colorScheme of ["light", "dark"]) {
    test(`extension overrides preserve physical stickers at ${viewport.width}x${viewport.height} ${colorScheme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce", colorScheme });
      await seed(page);
      const before = await saved(page);
      await openLibrary(page, "OLL");
      await page
        .getByRole("button", { name: "View OLL 6", exact: true })
        .click();
      const player = page.getByRole("region", { name: "3D cube player" });
      await expectPhysicalColors(player);
      // Model Dark Reader's variable rewrite and important inline-override rule
      // locally, with no extension download, network dependency or shared profile.
      await page.addStyleTag({
        content: `
        .cube-stage { background-color: rgb(24, 26, 27) !important; }
        .cube-face[data-color]::after {
          background-color: var(--darkreader-background--sticker, rgb(24, 26, 27)) !important;
        }
        [data-darkreader-inline-bgcolor] {
          background-color: var(--darkreader-inline-bgcolor) !important;
        }
      `,
      });
      await player.locator("[data-color]").evaluateAll((faces) => {
        for (const face of faces) {
          face.style.setProperty("--darkreader-background--sticker", "#181a1b");
          const sticker = face.querySelector(".cube-sticker") || face;
          sticker.setAttribute("data-darkreader-inline-bgcolor", "");
          sticker.style.setProperty("--darkreader-inline-bgcolor", "#181a1b");
        }
      });
      await expect(player.locator(".cube-stage")).toHaveCSS(
        "background-color",
        "rgb(24, 26, 27)",
      );
      await expectPhysicalColors(player);
      await player
        .getByRole("button", { name: "Next move", exact: true })
        .click();
      await expect(player.getByRole("slider")).toHaveValue("1");
      await expectPhysicalColors(player);
      await player.getByRole("button", { name: "Reset", exact: true }).click();
      await expect(player.getByRole("slider")).toHaveValue("0");
      await expectPhysicalColors(player);
      await page
        .getByRole("button", { name: "Change color", exact: true })
        .click();
      await expectPhysicalColors(player);
      await page.emulateMedia({ forcedColors: "active" });
      await expectPhysicalColors(player);
      await page.emulateMedia({ forcedColors: "none" });
      await player.getByRole("img").focus();
      await page.keyboard.press("ArrowUp");
      await page.keyboard.press("ArrowUp");
      await page.keyboard.press("ArrowUp");
      await captureScreenshot(player, {
        path: testInfo.outputPath("extension-cube-colors.png"),
      });
      const bounds = await player.getByRole("img").boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      await page
        .getByRole("button", { name: "Close case", exact: true })
        .click();
      expect(await saved(page)).toEqual(before);
    });

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
        await expect(sticker.locator(".cube-sticker")).toHaveCSS(
          "background-color",
          rgb,
        );
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
      await captureScreenshot(player, {
        path: testInfo.outputPath("standard-cube-colors.png"),
      });
      const bounds = await player.getByRole("img").boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    });
  }
}
