import { captureScreenshot } from "./screenshots.js";
import { test, expect, seed, saved, openLibrary } from "./fixtures.js";

async function fits(scope) {
  const overflow = await scope.evaluate((root) => {
    const bounds = root.getBoundingClientRect();
    return [
      ...root.querySelectorAll(
        ".case-occurrence, .occurrence-note, .occurrence-note summary, .occurrence-note p, .occurrence-note a",
      ),
    ]
      .filter((el) => el.getBoundingClientRect().width)
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return (
          (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) ||
          rect.left < bounds.left - 1 ||
          rect.right > bounds.right + 1
        );
      })
      .map((el) => el.textContent);
  });
  expect(
    overflow,
    "Occurrence labels and explanations fit their content bounds",
  ).toEqual([]);
}

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`occurrence fractions, attribution and skip explanation remain usable at ${viewport.width}×${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await seed(page);
    const before = await saved(page);
    for (const [section, count, source, cases] of [
      [
        "OLL",
        57,
        "https://speedcubing.org/pages/full-oll",
        [
          ["OLL 20", "1/216"],
          ["OLL 1", "1/108"],
          ["OLL 2", "1/54"],
        ],
      ],
      [
        "PLL",
        21,
        "https://www.cubeskills.com/uploads/pdf/tutorials/pll-algorithms.pdf",
        [
          ["H perm", "1/72"],
          ["Z perm", "1/36"],
          ["Ua perm", "1/18"],
        ],
      ],
    ]) {
      await openLibrary(page, section);
      await expect(page.locator(".library-case .case-occurrence")).toHaveCount(
        count,
      );
      const note = page.getByRole("main").locator(".occurrence-note");
      const summary = note.locator("summary");
      await expect(note).not.toHaveAttribute("open");
      await summary.focus();
      await page.keyboard.press("Enter");
      await expect(note).toHaveAttribute("open", "");
      await expect(note).toContainText(
        section === "OLL"
          ? "OLL skip: 1/216 (top already oriented)"
          : "PLL skip: 1/72 (solved up to a U turn)",
      );
      await expect(note).toContainText(
        "Two-look steps and practice sets have different frequencies",
      );
      await expect(note.getByRole("link")).toHaveAttribute("href", source);
      expect((await summary.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await fits(page.getByRole("main"));
      // Search exercises a one-case pool without changing the fraction.
      for (const [name, fraction] of cases) {
        await page.getByRole("searchbox", { name: "Search cases" }).fill(name);
        const opener = page.getByRole("button", {
          name: `View ${name}`,
          exact: true,
        });
        await expect(opener.locator(".case-occurrence")).toHaveText(
          `Occurrence ${fraction}`,
        );
        await opener.click();
        const dialog = page.getByRole("dialog");
        await expect(dialog.locator(".case-occurrence")).toHaveText(
          `Occurrence ${fraction}`,
        );
        const detailNote = dialog.locator(".occurrence-note");
        await detailNote.locator("summary").focus();
        await page.keyboard.press("Space");
        await expect(detailNote).toHaveAttribute("open", "");
        await expect(detailNote.getByRole("link")).toBeVisible();
        await expect(detailNote.getByRole("link")).toHaveAttribute(
          "href",
          source,
        );
        await fits(dialog);
        if (name === "Ua perm") {
          await dialog
            .getByRole("combobox", { name: "Your algorithm" })
            .click();
          await page.getByRole("option").last().click();
          await expect(dialog.locator(".case-occurrence")).toHaveText(
            "Occurrence 1/18",
          );
        }
        if (name === cases[0][0]) {
          for (const colorScheme of ["light", "dark"]) {
            await page.emulateMedia({ colorScheme });
            await dialog.locator(".detail-intro").scrollIntoViewIfNeeded();
            await captureScreenshot(page, {
              path: testInfo.outputPath(`${section}-detail-${colorScheme}.png`),
            });
          }
        }
        await dialog.getByRole("button", { name: "Close case" }).click();
        await expect(opener).toBeFocused();
      }
      await page.getByRole("searchbox", { name: "Search cases" }).fill("");
      await page.getByRole("combobox", { name: "Filter by group" }).click();
      await page
        .getByRole("option", {
          name: section === "OLL" ? "Dot" : "Edges Only",
          exact: true,
        })
        .click();
      await page
        .getByRole("heading", { name: "Algorithm library", exact: true })
        .scrollIntoViewIfNeeded();
      for (const colorScheme of ["light", "dark"]) {
        await page.emulateMedia({ colorScheme });
        await captureScreenshot(page, {
          path: testInfo.outputPath(`${section}-library-${colorScheme}.png`),
          fullPage: true,
        });
      }
      // Svelte retains this disclosure across section changes. Close it with
      // the keyboard so the next section starts from the same known state.
      await summary.press("Space");
      await expect(note).not.toHaveAttribute("open");
    }
    await page.getByRole("combobox", { name: "Learning method" }).click();
    await page
      .getByRole("option", { name: "2-look OLL / PLL", exact: true })
      .click();
    await page.getByRole("searchbox", { name: "Search cases" }).fill("H perm");
    await expect(page.locator(".library-case .case-occurrence")).toHaveText(
      "Occurrence 1/72",
    );
    await expect(page.locator(".occurrence-note")).toContainText(
      "Full PLL probabilities",
    );
    await fits(page.getByRole("main"));
    const after = await saved(page);
    expect(after.selected).toEqual(before.selected);
    expect(after.attempts).toEqual(before.attempts);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  });
}

test("hidden practice reveals occurrence only with the answer", async ({
  page,
}) => {
  await seed(page, {
    version: 2,
    selected: ["pll-H"],
    variants: {},
    attempts: [],
  });
  await expect(page.locator(".study-card .case-occurrence")).toHaveText(
    "Occurrence 1/72",
  );
  await page.getByRole("button", { name: "Start hidden practice" }).click();
  await expect(page.locator(".case-occurrence")).toHaveCount(0);
  await expect(page.locator(".case-occurrence")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Reveal answer", exact: true })
    .click();
  await expect(page.locator(".case-occurrence")).toHaveText("Occurrence 1/72");
});
