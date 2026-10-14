import { openSettings } from "./fixtures.js";
import { test, expect, seed, saved, openLibrary } from "./fixtures.js";

async function stickers(player) {
  return player.locator("[data-color]").evaluateAll((elements) =>
    elements.map((el) => ({
      p: el.dataset.position.split(",").map(Number),
      n: el.dataset.normal,
      color: el.dataset.color,
    })),
  );
}
function solved(stickers) {
  return [...new Set(stickers.map((s) => s.n))].every(
    (normal) =>
      new Set(stickers.filter((s) => s.n === normal).map((s) => s.color))
        .size === 1,
  );
}

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`algorithms use the shown grip and finish PLL at ${viewport.width}×${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seed(page);
    await openLibrary(page);
    await page
      .getByRole("button", { name: "View Ua perm", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    const player = dialog.getByRole("region", { name: "3D cube player" });
    await page.getByRole("combobox", { name: "Your algorithm" }).click();
    await page.getByRole("option").nth(2).click();
    await expect(
      player.getByLabel("Playback moves").getByRole("button").first(),
    ).toHaveText("R2");
    await expect(player).not.toHaveAttribute("data-algorithm", /^y/);
    await page.getByRole("button", { name: "Close case", exact: true }).click();
    await page.reload();
    await openLibrary(page);
    await page
      .getByRole("button", { name: "View Ua perm", exact: true })
      .click();
    expect((await saved(page)).variants["pll-Ua"]).toBe(2);
    await expect(
      player.getByLabel("Playback moves").getByRole("button").first(),
    ).toHaveText("R2");
    await page.getByRole("button", { name: "Close case", exact: true }).click();
    for (const [name, final] of [
      ["Z", "U'"],
      ["Ra", "U'"],
      ["Rb", "U"],
    ]) {
      await page
        .getByRole("button", { name: `View ${name} perm`, exact: true })
        .click();
      if (name === "Z") {
        const initial = await stickers(player);
        const centers = Object.fromEntries(
          initial
            .filter((s) => s.p.filter(Boolean).length === 1)
            .map((s) => [s.n, s.color]),
        );
        const corners = initial.filter(
          (s) => s.p[1] === 1 && s.p.every((v) => v !== 0),
        );
        expect(corners).toHaveLength(12);
        for (const corner of corners)
          expect(corner.color).toBe(centers[corner.n]);
      }
      const moves = player.getByLabel("Playback moves").getByRole("button");
      await expect(moves.last()).toHaveText(final);
      await moves.last().click();
      expect(solved(await stickers(player))).toBe(false);
      await player
        .getByRole("button", { name: "Next move", exact: true })
        .click();
      await expect(player.locator(".cube-position")).toContainText("Complete");
      expect(solved(await stickers(player))).toBe(true);
      expect((await saved(page)).attempts).toEqual([]);
      await player.getByRole("button", { name: "Reset", exact: true }).click();
      if (name !== "Rb")
        await page
          .getByRole("button", { name: "Close case", exact: true })
          .click();
    }
    for (const theme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme: theme });
      await player
        .getByRole("button", { name: "Next move", exact: true })
        .scrollIntoViewIfNeeded();
      await expect(
        player.getByRole("button", { name: "Next move", exact: true }),
      ).toBeInViewport();
      expect(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`pll-alignment-${theme}.png`),
      });
    }
  });
}

test("PLL arrows start enabled and an explicit off choice survives reload", async ({
  page,
}) => {
  await seed(page);
  await openLibrary(page);
  await expect(page.locator(".pll-arrows")).toHaveCount(21);
  await openSettings(page);
  const toggle = page.getByRole("checkbox", {
    name: "PLL arrows",
    exact: true,
  });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await page.reload();
  await openLibrary(page);
  await expect(page.locator(".pll-arrows")).toHaveCount(0);
  await openSettings(page);
  await expect(toggle).not.toBeChecked();
});
