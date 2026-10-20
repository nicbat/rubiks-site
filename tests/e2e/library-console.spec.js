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
}
