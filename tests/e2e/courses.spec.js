import { openProgress } from "./fixtures.js";
import { captureScreenshot } from "./screenshots.js";
import { closeSettings } from "./fixtures.js";
import {
  test,
  expect,
  seed,
  saved,
  openLibrary,
  importBackup,
} from "./fixtures.js";

async function course(page, name) {
  await closeSettings(page);
  await page.getByRole("button", { name: "Courses", exact: true }).click();
  await page.getByRole("button", { name: `Open ${name}`, exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}
async function module(page, name) {
  const section = name.endsWith("OLL")
    ? "OLL"
    : name.endsWith("PLL")
      ? "PLL"
      : name;
  await page
    .getByRole("navigation", { name: "CFOP sections" })
    .getByRole("button", { name: section, exact: true })
    .click();
  if (["OLL", "PLL"].includes(section))
    await page
      .getByRole("button", {
        name: name.startsWith("Two-look") ? "Two-look" : "Full",
        exact: true,
      })
      .click();
}
async function mark(page, name) {
  await page.getByRole("button", { name: `View ${name}`, exact: true }).click();
  await page.getByRole("button", { name: "Known", exact: true }).click();
  await page.getByRole("button", { name: "Close case" }).click();
}

test("one workspace shares learned marks across two-look and full without transfer controls", async ({
  page,
}) => {
  await seed(page);
  await course(page, "CFOP");
  await expect(
    page.getByRole("navigation", { name: "CFOP sections" }).getByRole("button"),
  ).toHaveCount(4);
  await expect(page.locator(".course-modules")).toHaveCount(0);
  await module(page, "Two-look PLL");
  await expect(page.locator(".library-case")).toHaveCount(6);
  await mark(page, "T perm");
  await mark(page, "Y perm");
  await page.getByRole("button", { name: "Full", exact: true }).click();
  await expect(page.locator(".library-case")).toHaveCount(21);
  await expect(page.locator(".library-meta")).toContainText("2 / 21 learned");
  await page.getByRole("button", { name: "View T perm", exact: true }).click();
  await expect(page.getByRole("dialog").locator(".badge")).toHaveText(
    "Already known",
  );
  await expect(
    page.getByRole("button", { name: /recognition progress/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Known", exact: true }).click();
  await page.getByRole("button", { name: "Close case" }).click();
  await page.getByRole("button", { name: "Two-look", exact: true }).click();
  await expect(page.locator(".library-meta")).toContainText("1 / 6 learned");
  await module(page, "Two-look OLL");
  await mark(page, "OLL 45");
  await page.getByRole("button", { name: "Full", exact: true }).click();
  await page.getByRole("button", { name: "View OLL 45", exact: true }).click();
  await expect(page.getByRole("dialog").locator(".badge")).toHaveText(
    "Already known",
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "View OLL 45", exact: true }),
  ).toBeFocused();
  expect((await saved(page)).attempts).toHaveLength(0);
  await page.reload();
  await expect(
    page.getByRole("navigation", { name: "CFOP sections" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "My learning", exact: true }).click();
  await page.getByRole("button", { name: "Continue course" }).click();
  await expect(
    page.getByRole("button", { name: "Full", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".library-meta")).toContainText("1 / 57 learned");
});

test("CFOP reviews resume and backup round-trips; future courses stay unavailable", async ({
  page,
}) => {
  await seed(page);
  await course(page, "CFOP");
  await module(page, "F2L");
  await expect(page.locator(".f2l-card")).toHaveCount(41);
  await page
    .getByRole("button", { name: "Mark reviewed", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reviewed", exact: true }),
  ).toBeFocused();
  const before = await saved(page);
  expect(before.reviewed).toEqual(["f2l"]);
  expect(before.known).toBeUndefined();
  await page.reload();
  await expect(
    page.getByRole("navigation", { name: "CFOP sections" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "My learning", exact: true }).click();
  await page.getByRole("button", { name: "Continue course" }).click();
  await expect(
    page.getByRole("button", { name: "Reviewed", exact: true }),
  ).toBeVisible();
  await importBackup(page, {
    ...before,
    reviewed: [...before.reviewed, "cross"],
  });
  await page.getByRole("button", { name: "Replace with this backup" }).click();
  await course(page, "CFOP");
  await module(page, "Cross");
  await expect(
    page.getByRole("button", { name: "Reviewed", exact: true }),
  ).toBeVisible();
  expect((await saved(page)).attempts).toEqual([]);
  await closeSettings(page);
  await page.getByRole("button", { name: "Courses", exact: true }).click();
  await expect(page.getByText("Work in progress", { exact: true })).toHaveCount(
    2,
  );
  await expect(
    page.getByRole("button", { name: /Open (2×2|Blindfolded)/ }),
  ).toHaveCount(0);
});

test("course practice records its context and stays in its module across grading", async ({
  page,
}) => {
  await seed(page);
  await course(page, "CFOP");
  await module(page, "Two-look OLL");
  await page
    .getByRole("button", { name: "Practice shown (10)", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Set up & solve" }),
  ).toBeVisible();
  await expect(page.locator(".answer-layout")).toHaveCount(0);
  await page.getByRole("button", { name: "Need help" }).click();
  await expect(
    page.getByRole("button", { name: "Recognized & solved confidently" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Needed help" }).click();
  const p = await saved(page);
  expect(p.attempts).toHaveLength(1);
  expect(p.attempts[0]).toMatchObject({
    method: "two-look",
    mode: "recognition",
    result: "help",
  });
  expect([
    "oll-45",
    "oll-44",
    "oll-2",
    "oll-27",
    "oll-26",
    "oll-21",
    "oll-22",
    "oll-23",
    "oll-24",
    "oll-25",
  ]).toContain(p.attempts[0].caseId);
  await expect(
    page.getByRole("heading", { name: "Set up & solve" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "End practice" }).click();
  await expect(
    page.getByRole("navigation", { name: "CFOP sections" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Two-look", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await openProgress(page);
  await expect(
    page.getByRole("group", { name: "Activity summary", exact: true }),
  ).toContainText("/ 10");
});

test("switching modules clears incompatible filters and restores each module method", async ({
  page,
}) => {
  await seed(page);
  await openLibrary(page);
  await page.getByRole("combobox", { name: "Filter by group" }).click();
  await page.getByRole("option", { name: "Edges Only", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search cases" }).fill("Ua");
  await course(page, "CFOP");
  await module(page, "Two-look PLL");
  await closeSettings(page);
  await page
    .getByRole("button", { name: "Algorithm library", exact: true })
    .click();
  await expect(page.locator(".library-case")).toHaveCount(6);
  await expect(
    page.getByRole("searchbox", { name: "Search cases" }),
  ).toHaveValue("");
  await importBackup(page, {
    ...(await saved(page)),
    activeCourse: "cfop",
  });
  await page.getByRole("button", { name: "Replace with this backup" }).click();
  await course(page, "CFOP");
  await module(page, "Full PLL");
  await expect(page.locator(".library-case")).toHaveCount(21);
});

test("old progress is ignored, and invalid course imports preserve current data", async ({
  page,
}) => {
  await page.goto("/#/home");
  await page.evaluate(() =>
    localStorage.setItem(
      "last-layer.progress.v1",
      JSON.stringify({
        version: 1,
        selected: ["oll-27"],
        variants: {},
        attempts: [],
      }),
    ),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Choose cases to practice" }),
  ).toBeVisible();
  await course(page, "CFOP");
  const before = await saved(page);
  await importBackup(page, { ...before, reviewed: ["unknown"] });
  await expect(page.locator("#import-message")).toContainText("unknown lesson");
  expect(await saved(page)).toEqual(before);
  await expect(
    page.getByRole("button", { name: "Replace with this backup" }),
  ).toHaveCount(0);
});

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`CFOP workspace and learned controls fit ${viewport.width}×${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seed(page);
    for (const theme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme: theme });
      await closeSettings(page);
      await page.getByRole("button", { name: "Courses", exact: true }).click();
      await assertBounds(page);
      await captureScreenshot(page, {
        path: testInfo.outputPath(`courses-${theme}.png`),
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Open CFOP", exact: true })
        .click();
      await assertBounds(page);
      await module(page, "Two-look OLL");
      await assertBounds(page);
      await captureScreenshot(page, {
        path: testInfo.outputPath(`workspace-${theme}.png`),
      });
      await page
        .getByRole("button", { name: "View OLL 45", exact: true })
        .click();
      await page.getByRole("button", { name: "Known", exact: true }).click();
      await assertBounds(page);
      await captureScreenshot(page, {
        path: testInfo.outputPath(`learned-${theme}.png`),
      });
      await page.getByRole("button", { name: "Close case" }).click();
      await closeSettings(page);
      await page.getByRole("button", { name: "Courses", exact: true }).click();
      await expect(
        page.getByText("Work in progress", { exact: true }),
      ).toHaveCount(2);
      await assertBounds(page);
      await captureScreenshot(page, {
        path: testInfo.outputPath(`blindfolded-${theme}.png`),
        fullPage: true,
      });
    }
  });
}
async function assertBounds(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const problems = await page
    .locator(
      ".course-card, .cfop-sections, .cfop-sections button, .library-console, .library-filters, .library-toolbar, .progress-sharing, .course-continue, .guide-intro, .cross-fact, .guide-note, .guide-example, .cross-frame, .cross-frame figcaption, .cross-comparison, .f2l-reference, .f2l-help, .f2l-card, .f2l-preview, .f2l-index, nav[aria-label='Main navigation'] button",
    )
    .evaluateAll((els) =>
      els.flatMap((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return [];
        return r.left < 0 ||
          r.right > innerWidth + 1 ||
          el.scrollWidth > el.clientWidth + 1
          ? [el.textContent.slice(0, 80)]
          : [];
      }),
    );
  expect(problems).toEqual([]);
  const small = await page
    .locator(
      ".course-card button, .cfop-sections button, .library-filters button, .guide-example-actions button, .guide-example-actions summary, .f2l-case-open",
    )
    .evaluateAll((els) =>
      els
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width && r.height && (r.width < 44 || r.height < 44);
        })
        .map((el) => el.textContent),
    );
  expect(small).toEqual([]);
}

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  for (const theme of ["light", "dark"]) {
    test(`Markdown CFOP retains its guide and library layout at ${viewport.width}×${viewport.height} ${theme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
      await seed(page);
      await course(page, "CFOP");
      await expect(
        page.locator(".course-lesson, .lesson-pagination"),
      ).toHaveCount(0);
      await expect(page.locator(".guide-intro")).toContainText(
        "Four ideas for fewer moves and a smoother first pair",
      );
      await expect(page.locator(".cross-frame")).toHaveCount(12);
      const first = page.locator(".guide-example").first();
      await first
        .getByRole("button", {
          name: "Show 3D example: Align at the end",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("region", { name: "3D cube player" }),
      ).toHaveCount(1);
      await page
        .getByRole("button", { name: "Next move", exact: true })
        .click();
      await assertBounds(page);
      await captureScreenshot(first, {
        path: testInfo.outputPath("cfop-cross-example.png"),
      });
      await module(page, "F2L");
      await expect(
        page.getByRole("region", { name: "3D cube player" }),
      ).toHaveCount(0);
      await expect(page.locator(".f2l-card")).toHaveCount(41);
      await page.getByText("How to use these cases", { exact: true }).click();
      await expect(page.locator(".f2l-help")).toHaveAttribute("open", "");
      await page
        .getByRole("button", { name: "Mark reviewed", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Reviewed", exact: true }),
      ).toBeFocused();
      await page.locator(".f2l-card").nth(1).getByRole("button").click();
      await expect(page.locator(".f2l-preview")).toHaveCount(1);
      await assertBounds(page);
      await captureScreenshot(page.locator(".f2l-group").first(), {
        path: testInfo.outputPath("cfop-f2l-grid.png"),
      });
      await module(page, "Two-look OLL");
      await expect(page.locator(".library-case")).toHaveCount(10);
      await expect(
        page.getByRole("region", { name: "3D cube player" }),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "Full", exact: true }).click();
      await expect(page.locator(".library-case")).toHaveCount(57);
      await module(page, "Full PLL");
      await expect(page.locator(".library-case")).toHaveCount(21);
      await page.getByRole("button", { name: "Two-look", exact: true }).click();
      await expect(page.locator(".library-case")).toHaveCount(6);
      await expect(
        page.getByRole("button", { name: "Start PLL quiz", exact: true }),
      ).toBeVisible();
      await assertBounds(page);
      await captureScreenshot(page.locator(".library-console"), {
        path: testInfo.outputPath("cfop-library-console.png"),
      });
      const progress = await saved(page);
      expect(progress.reviewed).toEqual(["f2l"]);
      expect(progress.known).toBeUndefined();
      expect(progress.attempts).toEqual([]);
      expect(progress.resume.cfop).toBe("two-look-pll");
    });
  }
}
