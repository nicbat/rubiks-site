import { test, expect, seed, importBackup } from "./fixtures.js";
import { captureScreenshot } from "./screenshots.js";
import { readFile } from "node:fs/promises";

const learning = {
  version: 2,
  selected: ["oll-27"],
  attempts: [],
  variants: { "pll-Y": 1 },
  known: { "oll-27": [0], "pll-Y": [1] },
};
for (const theme of ["light", "dark"])
  for (const viewport of [
    { width: 320, height: 720 },
    { width: 667, height: 375 },
  ]) {
    test(`origin recovery exports current and earlier learning at ${viewport.width}x${viewport.height} ${theme}`, async ({
      page,
      browser,
    }, info) => {
      await page.setViewportSize(viewport);
      await seed(page, learning);
      const earlier = JSON.stringify({ ...learning, version: 1 });
      await page.evaluate(
        ({ theme, earlier }) => {
          localStorage.setItem("last-layer-theme", theme);
          localStorage.setItem("last-layer.progress.v1", earlier);
        },
        { theme, earlier },
      );
      await page.goto("/home?recover-origin=1");
      const recovery = page.getByRole("region", {
        name: "Recover browser progress",
        exact: true,
      });
      await expect(recovery).toBeVisible();
      await expect(
        recovery.getByRole("link", {
          name: "Continue at lastlayer.net",
          exact: true,
        }),
      ).toHaveAttribute("href", "https://lastlayer.net/home");
      for (const node of await recovery.locator("h2,p,button,a").all()) {
        await node.scrollIntoViewIfNeeded();
        const bounds = await node.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
      }
      await captureScreenshot(page, {
        path: info.outputPath("origin-recovery.png"),
        fullPage: true,
      });
      const legacyDownload = page.waitForEvent("download");
      await recovery
        .getByRole("button", { name: "Export earlier learning", exact: true })
        .click();
      const legacyPath = info.outputPath("earlier-learning.json");
      await (await legacyDownload).saveAs(legacyPath);
      expect(JSON.parse(await readFile(legacyPath, "utf8"))).toEqual(learning);
      expect(
        await page.evaluate(() =>
          localStorage.getItem("last-layer.progress.v1"),
        ),
      ).toBe(earlier);
      await recovery
        .getByRole("button", { name: "Backup and transfer", exact: true })
        .click();
      const dialog = page.getByRole("dialog", {
        name: "Backup & transfer",
        exact: true,
      });
      await dialog
        .getByText("Recover progress from another address", { exact: true })
        .click();
      for (const host of ["cube.nicbat.com", "www.lastlayer.net"])
        await expect(
          dialog.getByRole("link", { name: host, exact: true }),
        ).toHaveAttribute("href", `https://${host}/?recover-origin=1`);
      const backupDownload = page.waitForEvent("download");
      await dialog
        .getByRole("button", { name: "Export progress", exact: true })
        .click();
      const backupPath = info.outputPath("current-training.json");
      await (await backupDownload).saveAs(backupPath);
      const backup = JSON.parse(await readFile(backupPath, "utf8"));
      expect(backup.progress).toEqual(learning);
      const destination = await browser.newContext();
      try {
        const second = await destination.newPage();
        await second.goto(new URL("/", page.url()).href);
        await importBackup(second, backup);
        await second
          .getByRole("button", { name: "Merge with current data", exact: true })
          .click();
        expect(
          await second.evaluate(() =>
            JSON.parse(localStorage.getItem("last-layer.progress.v2")),
          ),
        ).toEqual(learning);
      } finally {
        await destination.close();
      }
    });
  }
