import { test, expect, seed, saved, openLibrary } from "./fixtures.js";

async function choose(page, label, option) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("custom group popup supports keyboard, Escape and outside dismissal", async ({
  page,
}) => {
  await seed(page);
  await openLibrary(page);
  const control = page.getByRole("combobox", { name: "Filter by group" });
  await control.focus();
  await control.press("ArrowDown");
  await expect(
    page.getByRole("listbox", { name: "Filter by group" }),
  ).toBeVisible();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(control).toBeFocused();
  await expect(
    page.getByRole("listbox", { name: "Filter by group" }),
  ).not.toBeVisible();
  await control.click();
  await page.keyboard.press("Escape");
  await expect(control).toBeFocused();
  await expect(control).toHaveAttribute("aria-expanded", "false");
  await control.click();
  await page
    .getByRole("heading", { name: "Algorithm library", exact: true })
    .click();
  await expect(control).toHaveAttribute("aria-expanded", "false");
});

test("collapsed groups survive reload and search exposes matching cases", async ({
  page,
}) => {
  await seed(page);
  await openLibrary(page);
  const header = page.getByRole("button", { name: /Edges Only/ });
  await header.click();
  await expect(header).toHaveAttribute("aria-expanded", "false");
  await expect(header).toBeFocused();
  await expect(
    page.getByRole("button", { name: "View H perm", exact: true }),
  ).not.toBeVisible();
  await page.reload();
  await openLibrary(page);
  await expect(header).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("searchbox", { name: "Search cases" }).fill("H perm");
  await expect(
    page.getByRole("button", { name: "View H perm", exact: true }),
  ).toBeVisible();
  await page.getByRole("searchbox", { name: "Search cases" }).fill("");
  await header.click();
  await expect(
    page.getByRole("button", { name: "View H perm", exact: true }),
  ).toBeVisible();
});

test("2-look curriculum has staged PLL and OLL groups and persists", async ({
  page,
}) => {
  await seed(page);
  await openLibrary(page);
  await choose(page, "Learning method", "2-look OLL / PLL");
  await expect(page.locator(".library-case")).toHaveCount(6);
  await expect(page.locator(".group-heading")).toHaveCount(2);
  await expect(page.locator(".group-heading").first()).toContainText(
    "Position corners",
  );
  await page.getByRole("button", { name: /^OLL/ }).click();
  await expect(page.locator(".library-case")).toHaveCount(10);
  await expect(page.locator(".group-heading").first()).toContainText(
    "Yellow cross",
  );
  await page.reload();
  await openLibrary(page);
  await expect(
    page.getByRole("combobox", { name: "Learning method" }),
  ).toContainText("2-look");
  await expect(page.locator(".library-case")).toHaveCount(6);
});

test("already-known marks survive reload without creating attempts and stay variant-specific", async ({
  page,
}) => {
  await seed(page);
  await openLibrary(page);
  await page.getByRole("button", { name: "View Ua perm", exact: true }).click();
  await page
    .getByRole("button", { name: "Known", exact: true, pressed: false })
    .click();
  await expect(page.getByRole("dialog").locator(".badge")).toHaveText(
    "Already known",
  );
  expect((await saved(page)).attempts).toHaveLength(0);
  await page.getByRole("combobox", { name: "Your algorithm" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Your algorithm" }),
  ).toBeFocused();
  await page.getByRole("combobox", { name: "Your algorithm" }).click();
  await page.getByRole("option").nth(1).click();
  await expect(
    page.getByRole("button", { name: "Known", exact: true, pressed: false }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Your algorithm" }).click();
  await page.getByRole("option").nth(0).click();
  await page.reload();
  await openLibrary(page);
  await page.getByRole("button", { name: "View Ua perm", exact: true }).click();
  await expect(page.getByRole("dialog").locator(".badge")).toHaveText(
    "Already known",
  );
  await page
    .getByRole("button", { name: "Known", exact: true, pressed: true })
    .click();
  await expect(page.getByRole("dialog").locator(".badge")).not.toHaveText(
    "Already known",
  );
  expect((await saved(page)).attempts).toHaveLength(0);
});

test("filtered practice uses OLL dots through skip and grading without changing the learning set", async ({
  page,
}) => {
  await seed(page);
  const before = (await saved(page)).selected;
  await openLibrary(page, "OLL");
  await choose(page, "Filter by group", "Dot");
  const names = await page.locator(".library-case h3").allTextContents();
  expect(names.length).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Practice these cases" }).click();
  await page
    .getByRole("button", {
      name: `Practice all (${names.length})`,
      exact: true,
    })
    .click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Try another setup" }).click();
    await page.getByRole("button", { name: "Ready to recognize" }).click();
    await page.getByRole("button", { name: "Finished", exact: true }).click();
    expect(names).toContain(await page.locator(".trainer h1").textContent());
    await page
      .getByRole("button", { name: "Solved with effort", exact: true })
      .click();
  }
  const after = await saved(page);
  expect(after.selected).toEqual(before);
  expect(after.attempts).toHaveLength(3);
  expect(after.attempts.every((a) => a.caseId.startsWith("oll-"))).toBe(true);
});

test("learned counts and filters include confidence and known marks, and constrain practice", async ({
  page,
}) => {
  await seed(page, {
    version: 1,
    selected: [],
    variants: {},
    known: { "pll-T": [0] },
    attempts: [1, 2, 3].map((day) => ({
      caseId: "pll-H",
      variant: 0,
      result: "confident",
      mode: "recognition",
      day: `2026-10-0${day}`,
      at: `2026-10-0${day}T12:00:00Z`,
    })),
  });
  await openLibrary(page);
  await expect(page.locator(".library-meta")).toContainText("2 / 21 learned");
  await expect(page.getByRole("button", { name: /Edges Only/ })).toContainText(
    "1 / 4 learned",
  );
  await choose(page, "Learning status", "Learned");
  await expect(page.locator(".library-case")).toHaveCount(2);
  await choose(page, "Filter by group", "Adjacent Corner Swap");
  await expect(page.locator(".library-case")).toHaveCount(1);
  await page.getByRole("button", { name: "Practice these cases" }).click();
  await page
    .getByRole("button", { name: "Practice all (1)", exact: true })
    .click();
  await page.getByRole("button", { name: "Ready to recognize" }).click();
  await page.getByRole("button", { name: "Show hint" }).click();
  await expect(
    page.getByRole("heading", { name: "T perm", exact: true }),
  ).toBeVisible();
  await openLibrary(page);
  await choose(page, "Filter by group", "All groups");
  await choose(page, "Learning status", "Unlearned");
  await expect(page.locator(".library-case")).toHaveCount(19);
  await expect(
    page.getByRole("button", { name: "View T perm", exact: true }),
  ).toHaveCount(0);
});

test("algorithm choice persists across learning modes and reloads", async ({
  page,
}) => {
  await seed(page);
  await openLibrary(page, "OLL");
  await page.getByRole("button", { name: "View OLL 2", exact: true }).click();
  const control = page.getByRole("combobox", { name: "Your algorithm" });
  await control.click();
  const chosen = await page.getByRole("option").last().textContent();
  await page.getByRole("option").last().click();
  const selectedVariant = (await saved(page)).variants["oll-2"];
  await page.getByRole("button", { name: "Close case" }).click();
  await choose(page, "Learning method", "2-look OLL / PLL");
  await page.getByRole("button", { name: "View OLL 2", exact: true }).click();
  await expect(control).toContainText(chosen);
  await page.reload();
  await openLibrary(page, "OLL");
  await page.getByRole("button", { name: "View OLL 2", exact: true }).click();
  await expect(control).toContainText(chosen);
  expect((await saved(page)).variants["oll-2"]).toBe(selectedVariant);
});

test("settings lives in the header and random-side help has its own line", async ({
  page,
}) => {
  await seed(page);
  await expect(
    page.getByRole("navigation").getByRole("button", { name: "Settings" }),
  ).toHaveCount(0);
  await page
    .locator("header.header")
    .getByRole("button", { name: "Settings" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "My learning", exact: true }).click();
  await page.getByRole("button", { name: "Start hidden practice" }).click();
  const label = await page.locator(".side-option label").boundingBox();
  const help = await page.locator("#random-side-help").boundingBox();
  expect(help.y).toBeGreaterThanOrEqual(label.y + label.height);
});
