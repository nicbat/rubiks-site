import { captureScreenshot } from "./screenshots.js";
import { test, expect, seed, openLibrary } from "./fixtures.js";

// Panel styling must not clip popups: every option a menu shows has to be the
// element that receives a pointer at its center, not the panel or the page.
for (const viewport of [
  { width: 1280, height: 800 },
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`library filter menus are not clipped by their panel at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seed(page);
    await openLibrary(page);
    for (const name of [
      "Learning method",
      "Learning status",
      "Filter by group",
    ]) {
      const control = page.getByRole("combobox", { name });
      await control.scrollIntoViewIfNeeded();
      await control.click();
      const list = page.getByRole("listbox", { name });
      await expect(list).toBeVisible();
      const blocked = await list.evaluate((listbox) => {
        const area = listbox.getBoundingClientRect();
        return [...listbox.querySelectorAll('[role="option"]')].flatMap(
          (option) => {
            const r = option.getBoundingClientRect();
            const x = r.left + r.width / 2;
            const y = r.top + r.height / 2;
            // Only options scrolled into the list's own viewport are reachable.
            if (y < area.top || y > area.bottom || y < 0 || y > innerHeight)
              return [];
            const hit = document.elementFromPoint(x, y);
            return option.contains(hit) ? [] : [option.textContent.trim()];
          },
        );
      });
      expect(blocked).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(list).not.toBeVisible();
    }
  });

  for (const colorScheme of ["light", "dark"]) {
    test(`course and library group menus stay above cards at ${viewport.width}×${viewport.height} ${colorScheme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce", colorScheme });
      await seed(page);
      for (const destination of ["cfop", "library"]) {
        await page.goto(`/#/${destination}/oll/full`);
        const control = page.getByRole("combobox", { name: "Filter by group" });
        // Leave room below the control so desktop menus overlap actual cards,
        // rather than flipping above the console and missing the regression.
        await control.evaluate((el) => el.scrollIntoView({ block: "start" }));
        await control.click();
        const list = page.getByRole("listbox", { name: "Filter by group" });
        await expect(list).toBeVisible();
        const coverage = await list.evaluate((listbox) => {
          const area = listbox.getBoundingClientRect();
          const cards = [...document.querySelectorAll(".library-case")].map(
            (card) => card.getBoundingClientRect(),
          );
          const blocked = [];
          let overlaps = 0;
          for (const option of listbox.querySelectorAll('[role="option"]')) {
            const r = option.getBoundingClientRect();
            const top = Math.max(r.top, area.top, 0);
            const bottom = Math.min(r.bottom, area.bottom, innerHeight);
            if (bottom <= top) continue;
            const points = [[r.left + r.width / 2, (top + bottom) / 2]];
            for (const card of cards) {
              const left = Math.max(r.left, card.left);
              const right = Math.min(r.right, card.right);
              const overlapTop = Math.max(top, card.top);
              const overlapBottom = Math.min(bottom, card.bottom);
              if (right > left && overlapBottom > overlapTop) {
                overlaps++;
                points.push([
                  (left + right) / 2,
                  (overlapTop + overlapBottom) / 2,
                ]);
              }
            }
            for (const [x, y] of points) {
              if (!option.contains(document.elementFromPoint(x, y)))
                blocked.push(option.textContent.trim());
            }
          }
          return { blocked, overlaps };
        });
        expect(
          coverage.blocked,
          `${destination} options receive pointer hits`,
        ).toEqual([]);
        if (viewport.width === 1280)
          expect(
            coverage.overlaps,
            "Menu actually covers case cards",
          ).toBeGreaterThan(0);
        await captureScreenshot(page, {
          path: testInfo.outputPath(`${destination}-group-${colorScheme}.png`),
        });
        await page.getByRole("option", { name: "Dot", exact: true }).click();
        await expect(control).toContainText("Dot");
        await expect(control).toBeFocused();
        await expect(list).not.toBeVisible();
      }
    });
  }
}
