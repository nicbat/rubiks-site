import { cube3x3x3 } from "cubing/puzzles";
import { assertOracleFacelets } from "../helpers/cube-oracle.js";
import { test, expect, seed, saved, openLibrary } from "./fixtures.js";

async function scrub(player, value) {
  await player
    .getByRole("slider", { name: "Scrub through moves" })
    .evaluate((el, position) => {
      el.value = position;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
}

async function assertShell(player) {
  const geometry = await player.locator(".cube-scene").evaluate((root) => {
    const pieces = [...root.querySelectorAll(".cube-piece")];
    const origin = new DOMMatrix(
      getComputedStyle(pieces.find((el) => el.dataset.cubie === "0,0,1"))
        .transform,
    );
    const neighbor = new DOMMatrix(
      getComputedStyle(pieces.find((el) => el.dataset.cubie === "1,0,1"))
        .transform,
    );
    const spacing = Math.abs(neighbor.m41 - origin.m41);
    return {
      spacing,
      faces: [...root.querySelectorAll(".cube-face")].map((el) => {
        const style = getComputedStyle(el);
        const matrix = new DOMMatrix(style.transform);
        const center = new DOMPoint(0, 0, 0).matrixTransform(matrix);
        const normal = new DOMPoint(0, 0, 1, 0).matrixTransform(matrix);
        return {
          visible: style.display !== "none",
          width: parseFloat(style.width),
          height: parseFloat(style.height),
          offset:
            center.x * normal.x + center.y * normal.y + center.z * normal.z,
          radius: style.borderRadius,
          background: style.backgroundColor,
        };
      }),
    };
  });
  expect(geometry.faces).toHaveLength(156);
  for (const face of geometry.faces) {
    expect(
      face.width,
      "Opaque faces span the full distance between cubie centres",
    ).toBe(geometry.spacing);
    expect(face.height).toBe(geometry.spacing);
    // Browsers omit computed transforms for internal faces removed from layout.
    // Check each such face's offset when its turn exposes it instead.
    if (face.visible)
      expect(
        face.offset,
        "Faces meet on the common cubie boundary",
      ).toBeCloseTo(geometry.spacing / 2);
    expect(
      face.radius,
      "Rounding the plastic shell would reopen corner holes",
    ).toBe("0px");
    expect(face.background).toBe("rgb(32, 40, 50)");
  }
}

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`solid cube shell survives wide-move scrubbing and view reset at ${viewport.width}×${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await seed(page);
    const before = await saved(page);
    await openLibrary(page, "OLL");
    await page.getByRole("button", { name: "View OLL 6", exact: true }).click();
    const player = page.getByRole("region", { name: "3D cube player" });
    const stage = player.getByRole("img");
    await expect(player.locator(".cube-position")).toHaveText("Move 1 of 7: r");
    await assertShell(player);
    const original = await player.locator(".cube-camera").getAttribute("style");
    await stage.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowUp");
    await expect(player.locator(".cube-camera")).not.toHaveAttribute(
      "style",
      original,
    );
    await player
      .getByRole("button", { name: "Reset view", exact: true })
      .click();
    await expect(player.locator(".cube-camera")).toHaveAttribute(
      "style",
      original,
    );
    const puzzle = await cube3x3x3.kpuzzle();
    for (const position of [0, 0.5, 1, 6.5, 7, 0]) {
      await scrub(player, position);
      await expect(player.getByRole("slider")).toHaveValue(String(position));
      await assertShell(player);
      if (position === 0.5 || position === 6.5) {
        const matrix = await player.locator(".cube-layer").evaluate((el) => {
          const m = new DOMMatrix(getComputedStyle(el).transform);
          return { cos: m.m22, sin: m.m23 };
        });
        expect(matrix.cos).toBeCloseTo(Math.SQRT1_2);
        expect(matrix.sin).toBeCloseTo(
          (position === 0.5 ? 1 : -1) * Math.SQRT1_2,
        );
        await expect(player.locator(".cube-layer .cube-piece")).toHaveCount(17);
        await stage.focus();
        await page.keyboard.press("ArrowLeft");
        const layer = await player.locator(".cube-layer").getAttribute("style");
        await player
          .getByRole("button", { name: "Reset view", exact: true })
          .click();
        await expect(player.locator(".cube-camera")).toHaveAttribute(
          "style",
          original,
        );
        await expect(player.locator(".cube-layer")).toHaveAttribute(
          "style",
          layer,
        );
        await expect(player.getByRole("slider")).toHaveValue(String(position));
      }
      // Full move positions are checked against an independent cube engine;
      // partial turns keep exactly the completed moves in their sticker state.
      const moves = ["r", "U2", "R'", "U'", "R", "U'", "r'"];
      const completed = moves.slice(0, Math.floor(position)).join(" ");
      const initial = puzzle.defaultPattern().applyAlg("r U R' U R U2 r'");
      const stickers = await player.locator("[data-color]").evaluateAll((els) =>
        els.map((el) => ({
          p: el.dataset.position.split(",").map(Number),
          n: el.dataset.normal.split(",").map(Number),
          color: el.dataset.color,
        })),
      );
      assertOracleFacelets(
        stickers,
        initial.applyAlg(completed),
        `OLL 6 at ${position}`,
      );
      for (const colorScheme of ["light", "dark"]) {
        await page.emulateMedia({ colorScheme });
        await stage.screenshot({
          path: testInfo.outputPath(`cube-${position}-${colorScheme}.png`),
        });
      }
    }
    await player.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(player.getByRole("slider")).toHaveValue("0");
    await player
      .getByRole("button", { name: "Next move", exact: true })
      .click();
    await expect(player.getByRole("slider")).toHaveValue("1");
    await player
      .getByRole("button", { name: "Previous move", exact: true })
      .click();
    await expect(player.getByRole("slider")).toHaveValue("0");
    expect(await saved(page)).toEqual(before);
  });
}
