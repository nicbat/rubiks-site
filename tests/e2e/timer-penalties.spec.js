import { captureScreenshot } from "./screenshots.js";
import { reviewSolve } from "./fixtures.js";
import { test, expect, holdStartTimer } from "./fixtures.js";

const saved = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("last-layer.solves.v1")));
const displayed = (milliseconds) => {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}.${String(Math.floor(milliseconds / 10) % 100).padStart(2, "0")}`;
};

test("finished penalties are reversible, persisted, and leave raw time unchanged", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/home");
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await expect(page.getByRole("group", { name: "Solve penalty" })).toHaveCount(
    0,
  );
  await holdStartTimer(page);
  await expect(page.getByRole("group", { name: "Solve penalty" })).toHaveCount(
    0,
  );
  await page.clock.runFor(1230);
  await page.getByRole("button", { name: "Stop timer", exact: true }).click();
  const [raw] = await saved(page);
  const controls = page.getByRole("group", { name: "Solve penalty" }).first();
  await controls.getByRole("button", { name: "+2 sec", exact: true }).click();
  await expect(page.getByLabel("Solve time", { exact: true })).toHaveText(
    displayed(raw.elapsed + 2000),
  );
  await expect(
    controls.getByRole("button", { name: "+2 sec", exact: true }),
  ).toBeFocused();
  expect(await saved(page)).toEqual([{ ...raw, penalty: "+2" }]);
  await controls.getByRole("button", { name: "DNF", exact: true }).click();
  await expect(page.getByLabel("Solve time", { exact: true })).toHaveText(
    "DNF",
  );
  expect(await saved(page)).toEqual([{ ...raw, penalty: "dnf" }]);
  await controls
    .getByRole("button", { name: "No penalty", exact: true })
    .click();
  await expect(page.getByLabel("Solve time", { exact: true })).toHaveText(
    displayed(raw.elapsed),
  );
  expect(await saved(page)).toEqual([raw]);
  await controls.getByRole("button", { name: "+2 sec", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await page.getByText("Solve history (1)", { exact: true }).click();
  const history = page.locator(".timer-history");
  await expect(
    history.getByRole("button", {
      name: `Review solve ${displayed(raw.elapsed + 2000)} (+2)`,
      exact: true,
    }),
  ).toBeVisible();
  const dialog = await reviewSolve(page);
  await dialog.getByRole("button", { name: "DNF", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "DNF", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    dialog.getByRole("button", { name: "DNF", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Close solve details" }).click();
  await holdStartTimer(page);
  await expect(
    history.getByRole("button", { name: /^Review solve / }),
  ).toBeDisabled();
});

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  for (const theme of ["light", "dark"]) {
    test(`penalty controls and DNF averages at ${viewport.width} in ${theme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: theme });
      await page.goto("/home");
      await page.evaluate(() =>
        localStorage.setItem(
          "last-layer.solves.v1",
          JSON.stringify(
            [1000, 2000, 3000, 4000, 5000].map((elapsed, i) => ({
              id: String(i),
              elapsed,
              date: "2026-10-10T12:00:00.000Z",
              scramble: Array(10).fill("R U").join(" "),
            })),
          ),
        ),
      );
      await page.reload();
      await page.getByRole("button", { name: "Timer", exact: true }).click();
      await page.getByText("Solve history (5)", { exact: true }).click();
      const history = page.locator(".timer-history");
      const stats = page.getByRole("region", {
        name: "Recent solve statistics",
      });
      let dialog = await reviewSolve(page, "0:05.00");
      await dialog.getByRole("button", { name: "DNF", exact: true }).click();
      await page.getByRole("button", { name: "Close solve details" }).click();
      await expect(stats).toContainText("Average: 0:03.00");
      dialog = await reviewSolve(page, "0:04.00");
      await dialog.getByRole("button", { name: "DNF", exact: true }).click();
      await page.getByRole("button", { name: "Close solve details" }).click();
      await expect(stats).toContainText("Average: DNF");
      for (const button of await history.getByRole("button").all()) {
        const box = await button.boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      }
      await captureScreenshot(page, {
        path: testInfo.outputPath("timer-penalties.png"),
        fullPage: true,
      });
      await history
        .getByRole("button", { name: "Review solve DNF", exact: true })
        .nth(1)
        .click();
      await dialog
        .getByRole("button", { name: "No penalty", exact: true })
        .click();
      await page.getByRole("button", { name: "Close solve details" }).click();
      await expect(stats).toContainText("Average: 0:03.00");
    });
  }
}
