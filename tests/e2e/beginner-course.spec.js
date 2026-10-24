import { captureScreenshot } from "./screenshots.js";
import { test, expect, seed, saved, importBackup } from "./fixtures.js";

const lessonIds = [
  "introduction",
  "white-cross",
  "white-corners",
  "middle-layer",
  "yellow-cross",
  "yellow-edges",
  "yellow-corners",
  "orient-corners",
].map((id) => `beginner-${id}`);
const openCourses = async (page) =>
  page.getByRole("button", { name: "Courses", exact: true }).click();
const openBeginner = async (page) => {
  await openCourses(page);
  await page
    .getByRole("button", { name: "Open Beginner", exact: true })
    .click();
};

test("Beginner and CFOP resume independently through reload, home, Back and Forward", async ({
  page,
}) => {
  await seed(page);
  await openCourses(page);
  await page.getByRole("button", { name: "Open CFOP", exact: true }).click();
  await page
    .getByRole("navigation", { name: "CFOP sections" })
    .getByRole("button", { name: "F2L", exact: true })
    .click();
  await openBeginner(page);
  await page
    .getByRole("button", { name: "Mark complete", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Lesson complete", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Next lesson", exact: true }).click();
  await expect(page.locator("#main")).toBeFocused();
  await expect(page).toHaveURL(/#\/courses\/beginner\/beginner-white-cross$/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "White cross", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "My learning", exact: true }).click();
  await expect(page).toHaveURL(/#\/home$/);
  const ongoing = page.getByRole("region", { name: "Courses in progress" });
  await expect(
    ongoing.getByRole("button", { name: "Continue course", exact: true }),
  ).toHaveCount(2);
  await ongoing
    .getByRole("group", { name: "CFOP", exact: true })
    .getByRole("button")
    .click();
  await expect(page.locator(".f2l-card")).toHaveCount(41);
  await page.goBack();
  await expect(page).toHaveURL(/#\/home$/);
  await page.goForward();
  await expect(page).toHaveURL(/#\/cfop\/f2l$/);
  await openCourses(page);
  await page
    .getByRole("group", { name: "Beginner", exact: true })
    .getByRole("button")
    .click();
  await expect(
    page.getByRole("heading", { name: "White cross", exact: true }),
  ).toBeVisible();
  expect((await saved(page)).resume).toEqual({
    beginner: "beginner-white-cross",
    cfop: "f2l",
  });
  expect((await saved(page)).attempts).toEqual([]);
});

test("finishing, reviewing and undoing a lesson updates Finished without granting mastery and round-trips backups", async ({
  page,
}) => {
  await seed(page, {
    version: 2,
    selected: [],
    variants: {},
    attempts: [],
    activeCourse: "beginner",
    resume: { beginner: lessonIds.at(-1), cfop: "cross" },
    reviewed: lessonIds.slice(0, -1),
  });
  await page.goto(`/#/courses/beginner/${lessonIds.at(-1)}`);
  await page
    .getByRole("button", { name: "Mark complete", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Course finished" }),
  ).toBeVisible();
  await openCourses(page);
  const finished = page.getByRole("region", { name: "Finished courses" });
  await expect(
    finished.getByRole("heading", { name: "Beginner", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Courses in progress" })
      .getByRole("group", { name: "Beginner", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await finished
    .getByRole("button", { name: "Review Beginner", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Turn yellow corners", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Lesson complete", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Mark complete", exact: true }),
  ).toBeFocused();
  await openCourses(page);
  await expect(finished).toHaveCount(0);
  await expect(
    page.getByRole("group", { name: "Beginner", exact: true }),
  ).toBeVisible();
  const before = await saved(page);
  expect(before.reviewed).toEqual(lessonIds.slice(0, -1));
  expect(before.known).toBeUndefined();
  expect(before.attempts).toEqual([]);
  await importBackup(page, { ...before, reviewed: lessonIds });
  await page
    .getByRole("button", { name: "Replace with this backup", exact: true })
    .click();
  await openCourses(page);
  await expect(finished).toBeVisible();
  const restored = await saved(page);
  await importBackup(page, { ...restored, resume: { beginner: "full-pll" } });
  await expect(page.locator("#import-message")).toContainText(
    "unknown course module",
  );
  expect(await saved(page)).toEqual(restored);
});

test("lesson examples open on demand, pause, step and clean up on navigation", async ({
  page,
}) => {
  await seed(page);
  await openBeginner(page);
  await expect(
    page.getByRole("region", { name: "3D cube player" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Show example", exact: true }).click();
  const player = page.getByRole("region", { name: "3D cube player" });
  await expect(
    player.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await player.getByRole("button", { name: "Next move", exact: true }).click();
  await expect(
    player.getByRole("slider", { name: "Scrub through moves" }),
  ).toHaveValue("1");
  await page.getByRole("button", { name: "Hide example", exact: true }).click();
  await expect(player).toHaveCount(0);
  await page.getByRole("button", { name: "Show example", exact: true }).click();
  await page.getByRole("button", { name: "Next lesson", exact: true }).click();
  await expect(player).toHaveCount(0);
  await page.getByRole("button", { name: "Show example", exact: true }).click();
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await expect(page).toHaveURL(/#\/progress$/);
  await expect(player).toHaveCount(0);
  expect((await saved(page)).reviewed).toBeUndefined();
});

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  for (const colorScheme of ["light", "dark"]) {
    test(`Beginner actions and populated course lists fit ${viewport.width}×${viewport.height} ${colorScheme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await seed(page, {
        version: 2,
        selected: [],
        variants: {},
        attempts: [],
        activeCourse: "beginner",
        resume: { beginner: lessonIds.at(-1), cfop: "full-pll" },
        reviewed: lessonIds.slice(0, -1),
      });
      await openCourses(page);
      await bounds(page);
      await captureScreenshot(page, {
        path: testInfo.outputPath("continue.png"),
        fullPage: true,
      });
      await page
        .getByRole("group", { name: "Beginner", exact: true })
        .getByRole("button")
        .click();
      const contrast = await page
        .locator('.course-sections [aria-current="step"]')
        .evaluate((element) => {
          const style = getComputedStyle(element);
          const luminance = (color) => {
            const [r, g, b] = color
              .match(/[\d.]+/g)
              .slice(0, 3)
              .map((value) => {
                const channel = Number(value) / 255;
                return channel <= 0.04045
                  ? channel / 12.92
                  : ((channel + 0.055) / 1.055) ** 2.4;
              });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
          };
          const colors = [
            luminance(style.color),
            luminance(style.backgroundColor),
          ];
          return (Math.max(...colors) + 0.05) / (Math.min(...colors) + 0.05);
        });
      expect(
        contrast,
        "Selected lesson text remains readable in the active theme",
      ).toBeGreaterThanOrEqual(4.5);
      await page
        .getByRole("button", { name: "Show example", exact: true })
        .click();
      await page
        .getByRole("region", { name: "3D cube player" })
        .getByRole("button", { name: "Next move", exact: true })
        .click();
      await bounds(page);
      await captureScreenshot(page, {
        path: testInfo.outputPath("lesson-player.png"),
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Mark complete", exact: true })
        .click();
      await openCourses(page);
      await expect(
        page.getByRole("region", { name: "Finished courses" }),
      ).toBeVisible();
      await bounds(page);
      await captureScreenshot(page, {
        path: testInfo.outputPath("finished.png"),
        fullPage: true,
      });
    });
  }
}
async function bounds(page) {
  const failures = await page
    .locator(
      ".course-card, .course-card button, .course-continue, .course-continue button, .course-sections, .course-sections button, .course-lesson, .course-lesson h2, .course-lesson p, .lesson-diagrams, .lesson-diagrams figure, .lesson-completion, .lesson-pagination, .cube-player, .cube-stage, .cube-controls button, .cube-moves button",
    )
    .evaluateAll((elements) =>
      elements.flatMap((element) => {
        const r = element.getBoundingClientRect();
        if (!r.width || !r.height) return [];
        if (
          r.left < -1 ||
          r.right > innerWidth + 1 ||
          element.scrollWidth > element.clientWidth + 1
        )
          return [element.className || element.textContent.slice(0, 60)];
        if (element.tagName === "BUTTON" && (r.height < 44 || r.width < 44))
          return ["small target: " + element.textContent];
        return [];
      }),
    );
  expect(failures).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
