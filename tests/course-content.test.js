import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  compileCourses,
  compileLesson,
  contentRoot,
} from "../scripts/compile-courses.mjs";
import {
  courseById,
  moduleById,
  courseExamples,
  moduleExampleIds,
  courseSummary,
} from "../src/courses.js";
import { createProgressIndex } from "../src/progress-index.js";
import { emptyProgress, validateProgress, setKnown } from "../src/progress.js";
import { recommendedVariant } from "../src/learning-methods.js";
import { renderCourseLesson, renderCourses } from "../scripts/render-views.mjs";
import catalog from "../data/algorithms.json" with { type: "json" };

const source = (body) => `---\nid: lesson-id\ntitle: A lesson\n---\n\n${body}`;
const summary = (course, progress) =>
  courseSummary(
    courseById(course),
    progress,
    createProgressIndex(progress),
    catalog,
    (c, method) => progress.variants[c.id] ?? recommendedVariant(c, method),
  );
const summaries = (progress) =>
  Object.fromEntries(
    ["beginner", "cfop"].map((id) => [id, summary(id, progress)]),
  );

test("Markdown compiles to safe declarative prose and referenced examples without executable HTML", () => {
  const lesson = compileLesson(
    source(
      '## Goal\n\n**Try** a *turn* and `R`.\n\n1. Read [Notation](#/guides/notation).\n2. Then try it.\n\n```cube\n{"example":"beginner-turn"}\n```',
    ),
    courseExamples,
  );
  assert.equal(lesson.id, "lesson-id");
  assert.deepEqual(moduleExampleIds(lesson), ["beginner-turn"]);
  assert.deepEqual(
    lesson.nodes.map((n) => n.type),
    ["heading", "paragraph", "list", "cube"],
  );
  for (const body of [
    "<script>alert(1)</script>",
    'Inline <img src="https://example.com/track">',
    "[bad](javascript:alert)",
    "[bad](//example.com)",
    "[bad](data:text/html,test)",
    "![remote](https://example.com/image.png)",
    "# Duplicate page title",
    "```js\nconsole.log(1)\n```",
    '```cube\n{"example":"missing"}\n```',
    "```cube\ninvalid JSON\n```",
    '```cube\n{"example":"beginner-turn","setup":"R"}\n```',
  ])
    assert.throws(
      () => compileLesson(source(body), courseExamples, "bad.md"),
      /bad.md:\d+:/,
    );
  assert.throws(
    () => compileLesson("## No identity", courseExamples),
    /frontmatter/,
  );
});

test("all course folders compile; invalid content fails with the authored filename", () => {
  const compiled = compileCourses();
  assert.equal(
    compiled.courses.find((c) => c.id === "beginner").modules.length,
    8,
  );
  const root = mkdtempSync(join(tmpdir(), "course-authoring-"));
  try {
    cpSync(contentRoot, root, { recursive: true });
    const manifest = join(root, "beginner", "course.json");
    const original = readFileSync(manifest, "utf8");
    const mutate = (fn) => {
      const value = JSON.parse(original);
      fn(value);
      writeFileSync(manifest, JSON.stringify(value));
    };
    mutate((c) => c.modules.push(c.modules[0]));
    assert.throws(() => compileCourses(root), /duplicate module/);
    mutate((c) => (c.modules[0].file = "../cfop/course.json"));
    assert.throws(() => compileCourses(root), /invalid lesson filename/);
    mutate((c) => (c.modules[0].id = "different-id"));
    assert.throws(() => compileCourses(root), /ID does not match/);
    writeFileSync(manifest, original);
    const examples = join(root, "beginner", "examples.json");
    const originalExamples = JSON.parse(readFileSync(examples, "utf8"));
    for (const bad of [
      { setup: "not a move" },
      { algorithm: "xw" },
      { algorithm: "" },
      { targets: ["UD"] },
      { view: "unknown" },
    ]) {
      const value = structuredClone(originalExamples);
      Object.assign(value["beginner-turn"], bad);
      writeFileSync(examples, JSON.stringify(value));
      assert.throws(
        () => compileCourses(root),
        /beginner\/course.json: invalid cube example/,
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Beginner and CFOP have independent resumes; review completion reverses and never grants mastery", () => {
  const progress = {
    ...emptyProgress(),
    activeCourse: "beginner",
    resume: { beginner: "beginner-white-cross", cfop: "two-look-pll" },
  };
  assert.equal(summary("beginner", progress).started, true);
  assert.equal(summary("cfop", progress).started, true);
  assert.equal(summary("beginner", progress).finished, false);
  progress.reviewed = [...courseById("beginner").modules];
  assert.deepEqual(summary("beginner", progress), {
    done: 8,
    total: 8,
    started: true,
    finished: true,
  });
  assert.equal(summary("cfop", progress).done, 0);
  assert.equal(createProgressIndex(progress).isKnown("pll-T", 0), false);
  assert.equal(
    createProgressIndex(progress).statusFor("pll-T", 0, "full").days,
    0,
  );
  assert.deepEqual(progress.attempts, []);
  assert.equal(progress.known, undefined);
  assert.deepEqual(
    validateProgress(structuredClone(progress), catalog),
    progress,
  );
  for (const invalid of [
    { ...progress, resume: { beginner: "full-oll" } },
    { ...progress, reviewed: [...progress.reviewed, "beginner-missing"] },
    { ...progress, resume: { cfop: "beginner-white-cross" } },
  ])
    assert.throws(() => validateProgress(invalid, catalog));
  progress.reviewed.pop();
  assert.equal(summary("beginner", progress).finished, false);
  assert.equal(summary("beginner", progress).done, 7);
  assert.deepEqual(progress.resume, {
    beginner: "beginner-white-cross",
    cfop: "two-look-pll",
  });
});

test("CFOP completion follows actual guide and variant objectives, independently of course visits", () => {
  const progress = emptyProgress();
  assert.equal(summary("cfop", progress).started, false);
  progress.reviewed = ["cross", "f2l"];
  assert.equal(summary("cfop", progress).started, true);
  assert.equal(summary("cfop", progress).finished, false);
  for (const c of catalog)
    for (let variant = 0; variant < c.algorithms.length; variant++)
      setKnown(progress, c.id, variant, true);
  assert.equal(summary("cfop", progress).finished, true);
  for (
    let variant = 0;
    variant < catalog.find((c) => c.id === "pll-T").algorithms.length;
    variant++
  )
    setKnown(progress, "pll-T", variant, false);
  assert.equal(summary("cfop", progress).finished, false);
  assert.deepEqual(progress.attempts, []);
});

test("course pages show both resumable courses, puzzle grouping, finished reviews and lazy cube examples", () => {
  const progress = {
    ...emptyProgress(),
    activeCourse: "beginner",
    resume: { beginner: "beginner-middle-layer", cfop: "full-pll" },
  };
  let html = renderCourses({ progress, summaries: summaries(progress) });
  assert.match(html, /aria-label="3×3 courses"/);
  assert.match(html, /aria-label="Courses in progress"/);
  assert.equal((html.match(/>Continue course</g) || []).length, 2);
  assert.doesNotMatch(html, /aria-label="Finished courses"/);
  assert.doesNotMatch(html, /data-id="ortega"|data-id="blindfolded"/);
  progress.reviewed = [...courseById("beginner").modules];
  html = renderCourses({ progress, summaries: summaries(progress) });
  assert.match(html, /aria-label="Finished courses"/);
  assert.equal((html.match(/>Continue course</g) || []).length, 1);
  for (const id of courseById("beginner").modules) {
    const module = moduleById(id);
    const props = {
      courseId: "beginner",
      moduleId: id,
      progress,
      summary: summary("beginner", progress),
    };
    const closed = renderCourseLesson(props);
    assert.doesNotMatch(closed, /class="cube-player"/);
    assert.match(closed, /aria-pressed="true"/);
    assert.match(closed, /Course finished/);
    for (const example of moduleExampleIds(module)) {
      const open = renderCourseLesson({ ...props, example });
      assert.equal((open.match(/class="cube-player"/g) || []).length, 1);
      assert.match(open, /data-cube-mode="lesson"/);
      assert.match(open, /aria-expanded="true"/);
    }
  }
});
