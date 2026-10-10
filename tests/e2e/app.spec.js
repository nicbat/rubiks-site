import {
  test,
  expect,
  seed,
  saved,
  openLibrary,
  progressFixture,
  STORAGE_KEY,
  importBackup,
} from "./fixtures.js";

test("first visit, group filtering, search, selection and reload", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Start hidden practice" }),
  ).toBeDisabled();
  await openLibrary(page);
  await expect(page.locator(".library-case")).toHaveCount(21);
  await expect(page.locator(".group-heading")).toHaveCount(3);
  await page
    .getByRole("combobox", { name: "Filter by group" })
    .selectOption("Edges Only");
  await expect(page.locator(".library-case")).toHaveCount(4);
  await page
    .getByRole("combobox", { name: "Filter by group" })
    .selectOption("all");
  const search = page.getByRole("searchbox", { name: "Search cases" });
  await search.fill("T perm");
  await expect(
    page.getByRole("button", { name: "View T perm", exact: true }),
  ).toBeVisible();
  await search.fill("no such case");
  await expect(
    page.getByRole("heading", { name: "No matching cases" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page
    .getByRole("button", { name: "Add T perm to learning set", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".study-heading")).toContainText("T perm");
  expect((await saved(page)).selected).toEqual(["pll-T"]);
  await openLibrary(page, "OLL");
  await expect(page.locator(".library-case")).toHaveCount(57);
  await search.fill("27");
  await expect(page.locator(".group-heading")).toContainText("Cross");
});

test("variant changes, trigger disclosure and arrow preference survive reload", async ({
  page,
}) => {
  await seed(page);
  await openLibrary(page);
  await page.getByRole("button", { name: /PLL arrows/ }).click();
  await expect(page.locator(".pll-arrows")).toHaveCount(21);
  await page.getByRole("button", { name: "View Ua perm", exact: true }).click();
  await page.getByLabel("Your algorithm").selectOption("1");
  await expect(page.getByLabel("Your algorithm")).toHaveValue("1");
  await page.getByRole("button", { name: "Close case", exact: true }).click();
  await page.getByRole("button", { name: "View T perm", exact: true }).click();
  await page.locator("dialog .trigger summary").first().click();
  await expect(page.locator("dialog .trigger[open]")).toContainText(
    "Sexy move",
  );
  await page.getByRole("button", { name: "Close case", exact: true }).click();
  await page.reload();
  await openLibrary(page);
  await expect(
    page.getByRole("button", { name: /PLL arrows/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "View Ua perm", exact: true }).click();
  await expect(page.getByLabel("Your algorithm")).toHaveValue("1");
  await page
    .getByRole("button", { name: /PLL arrows/ })
    .last()
    .click();
  await expect(page.locator("dialog .pll-arrows")).toHaveCount(0);
});

test("hidden practice hides solutions, skip does not log, and a hint cannot earn confidence", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("checkbox", { name: "Randomize side" }).check();
  await page.getByRole("button", { name: "Start hidden practice" }).click();
  await expect(
    page.getByRole("checkbox", { name: "Randomize side" }),
  ).toBeChecked();
  await expect(
    page.locator(".algorithm,.pll-arrows,.answer-diagram"),
  ).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText(/T perm|Ua perm/);
  expect(await page.locator(".scramble").textContent()).not.toMatch(/[xyz]/);
  await page.getByRole("button", { name: "Try another setup" }).click();
  expect((await saved(page)).attempts).toHaveLength(0);
  await page.getByRole("button", { name: "Ready to recognize" }).click();
  await expect(page.locator("main")).not.toContainText(/T perm|Ua perm/);
  await page.getByRole("button", { name: "Show hint" }).click();
  await expect(
    page.getByRole("button", {
      name: "Recognized & solved confidently",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Solved with effort", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Needed help", exact: true }).click();
  expect((await saved(page)).attempts).toMatchObject([
    { result: "help", mode: "recognition" },
  ]);
  await page.getByRole("button", { name: "Ready to recognize" }).click();
  await page.getByRole("button", { name: "Finished", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Recognized & solved confidently",
      exact: true,
    })
    .click();
  expect((await saved(page)).attempts).toHaveLength(2);
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "Randomize side" }),
  ).toBeChecked();
});

test("rehearsal records repetitions without earning confident recognition days", async ({
  page,
}) => {
  await seed(page);
  await page
    .getByRole("button", { name: "Practice algorithm", exact: true })
    .click();
  await page.getByRole("button", { name: "Record a repetition" }).click();
  await page.getByRole("button", { name: "Record a repetition" }).click();
  const data = await saved(page);
  expect(data.attempts).toHaveLength(2);
  expect(data.attempts.every((a) => a.mode === "rehearsal")).toBe(true);
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await expect(page.locator(".progress-stats strong").first()).toHaveText("2");
  await expect(page.locator(".day-dots .filled")).toHaveCount(0);
});

test("export/import preserves history, confirms replacement and rejects bad files without losing data", async ({
  page,
}, testInfo) => {
  await seed(page);
  await page
    .getByRole("button", { name: "Practice algorithm", exact: true })
    .click();
  await page.getByRole("button", { name: "Record a repetition" }).click();
  await page
    .getByRole("button", { name: "Backup and transfer local progress" })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export progress" }).click();
  const download = await downloadPromise,
    path = testInfo.outputPath("progress.json");
  await download.saveAs(path);
  const before = await saved(page);
  await page.getByLabel("Choose backup file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{"),
  });
  await expect(page.locator("#import-message")).toContainText("not valid JSON");
  expect(await saved(page)).toEqual(before);
  await page.getByLabel("Choose backup file").setInputFiles(path);
  await expect(
    page.getByRole("button", { name: "Replace with this backup" }),
  ).toBeVisible();
  expect(await saved(page)).toEqual(before);
  await page.getByRole("button", { name: "Replace with this backup" }).click();
  expect(await saved(page)).toEqual(before);
  const replacement = progressFixture();
  replacement.selected = ["oll-27"];
  await importBackup(page, replacement);
  expect((await saved(page)).selected).toEqual(before.selected);
  await page.getByRole("button", { name: "Replace with this backup" }).click();
  expect(await saved(page)).toEqual(replacement);
  await expect(page.locator(".study-heading")).toContainText("OLL 27");
});

test("invalid calendar dates cannot be imported and overwrite saved progress", async ({
  page,
}) => {
  await seed(page);
  const before = await saved(page),
    bad = progressFixture();
  bad.attempts = [
    {
      caseId: "pll-T",
      variant: 0,
      mode: "recognition",
      result: "confident",
      day: "2026-02-30",
      at: "2026-03-02T12:00:00.000Z",
    },
  ];
  await importBackup(page, bad);
  await expect(page.locator("#import-message")).toContainText(
    "invalid practice result",
  );
  await expect(
    page.getByRole("button", { name: "Replace with this backup" }),
  ).toHaveCount(0);
  expect(await saved(page)).toEqual(before);
});

test("corrupt storage is retained until an explicit change; blocked writes show a recoverable warning", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(
    (key) => localStorage.setItem(key, "broken"),
    STORAGE_KEY,
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("could not be loaded");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
  ).toBe("broken");
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await page.reload();
  await openLibrary(page);
  await page
    .getByRole("button", { name: "Add T perm to learning set", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "could not save progress",
  );
  await page.getByRole("button", { name: "My learning", exact: true }).click();
  await expect(page.locator(".study-heading")).toContainText("T perm");
});

test("light/dark/system theme persists and responds to system changes", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const theme = page.getByRole("combobox", { name: "Color theme" });
  await theme.selectOption("light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await theme.selectOption("system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await theme.selectOption("dark");
  await page
    .getByRole("button", { name: "Algorithm library", exact: true })
    .click();
  await expect(theme).toHaveValue("dark");
});

test("keyboard search preserves cursor and dialog Escape restores the opener", async ({
  page,
}) => {
  await seed(page);
  await openLibrary(page);
  const search = page.getByRole("searchbox", { name: "Search cases" });
  await search.fill("T");
  await search.press("Home");
  await search.press("Delete");
  await search.pressSequentially("Ua");
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("Ua");
  const opener = page.getByRole("button", {
    name: "View Ua perm",
    exact: true,
  });
  await opener.focus();
  await opener.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(opener).toBeFocused();
});

test("layout has no horizontal overflow at narrow and wide widths, including dialogs", async ({
  page,
}) => {
  await seed(page);
  await openLibrary(page);
  await page.getByRole("button", { name: /PLL arrows/ }).click();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `library width ${width}`,
    ).toBe(true);
    await page
      .getByRole("button", { name: "View T perm", exact: true })
      .click();
    expect(
      await page
        .locator("dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
      `dialog width ${width}`,
    ).toBe(true);
    await page.getByRole("button", { name: "Close case", exact: true }).click();
  }
});

test("closing the backup dialog cancels a pending file read without replacing data or throwing", async ({
  page,
}) => {
  await seed(page);
  const before = await saved(page);
  await page.evaluate(() => {
    const original = File.prototype.text;
    File.prototype.text = function () {
      const file = this;
      return new Promise((resolve, reject) => {
        window.releaseImport = () => original.call(file).then(resolve, reject);
      });
    };
  });
  await page
    .getByRole("button", { name: "Backup and transfer local progress" })
    .click();
  await page.getByLabel("Choose backup file").setInputFiles({
    name: "late.json",
    mimeType: "application/json",
    buffer: Buffer.from("{invalid"),
  });
  await page.getByRole("button", { name: "Close backup" }).click();
  await page.evaluate(() => window.releaseImport());
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await saved(page)).toEqual(before);
});

test("a slower older file cannot replace the latest backup selection", async ({
  page,
}) => {
  await seed(page);
  const first = progressFixture(),
    latest = progressFixture();
  first.selected = ["pll-H"];
  latest.selected = ["oll-27"];
  await page.evaluate(() => {
    const original = File.prototype.text;
    File.prototype.text = function () {
      if (this.name !== "slow.json") return original.call(this);
      const file = this;
      return new Promise((resolve) => {
        window.releaseOldImport = () => original.call(file).then(resolve);
      });
    };
  });
  await page
    .getByRole("button", { name: "Backup and transfer local progress" })
    .click();
  const file = page.getByLabel("Choose backup file");
  await file.setInputFiles({
    name: "slow.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(first)),
  });
  await file.setInputFiles({
    name: "latest.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(latest)),
  });
  await expect(
    page.getByRole("button", { name: "Replace with this backup" }),
  ).toBeVisible();
  await page.evaluate(() => window.releaseOldImport());
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await page.getByRole("button", { name: "Replace with this backup" }).click();
  expect(await saved(page)).toEqual(latest);
});
