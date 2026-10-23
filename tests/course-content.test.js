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
  moduleProgress,
} from "../src/courses.js";
import { createProgressIndex } from "../src/progress-index.js";
import { emptyProgress, validateProgress, setKnown } from "../src/progress.js";
import { recommendedVariant } from "../src/learning-methods.js";
import {
  renderCourseLesson,
  renderCourses,
  renderCourseContent,
  renderGuides,
} from "../scripts/render-views.mjs";
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

test("all six CFOP modules use Markdown while retaining review, practice and route identities", () => {
  const cfop = courseById("cfop");
  assert.deepEqual(cfop.modules, [
    "cross",
    "f2l",
    "two-look-oll",
    "two-look-pll",
    "full-oll",
    "full-pll",
  ]);
  for (const id of cfop.modules) {
    const module = moduleById(id);
    assert.equal(module.file, `lessons/${id}.md`);
    assert.ok(module.nodes.length > 0);
    if (module.kind === "algorithms") {
      assert.deepEqual(module.nodes, [
        {
          type: "algorithm-library",
          section: module.section,
          method: module.method,
        },
      ]);
      assert.equal(
        moduleProgress(
          module,
          emptyProgress(),
          createProgressIndex(emptyProgress()),
          catalog,
          recommendedVariant,
        ).total,
        module.method === "full"
          ? module.section === "OLL"
            ? 57
            : 21
          : module.section === "OLL"
            ? 10
            : 6,
      );
    } else assert.equal(module.kind, "guide");
  }
  const progress = {
    ...emptyProgress(),
    activeCourse: "cfop",
    resume: { cfop: "two-look-oll" },
    reviewed: ["cross", "f2l"],
  };
  assert.deepEqual(
    validateProgress(structuredClone(progress), catalog),
    progress,
  );
  assert.equal(summary("cfop", progress).done, 2);
});

test("authored CFOP prose drives both the course and footer Guides without replacing specialized controls", () => {
  for (const id of ["cross", "f2l"]) {
    const module = moduleById(id);
    const original = module.nodes;
    const sourceFile = new URL(
      `../content/courses/cfop/${module.file}`,
      import.meta.url,
    );
    const source = readFileSync(sourceFile, "utf8");
    const replacement = "Authored teaching text from Markdown";
    const changed = source.replace(
      id === "cross"
        ? "Four ideas for fewer moves and a smoother first pair."
        : "White down, green front.",
      replacement,
    );
    try {
      module.nodes = compileLesson(changed, courseExamples).nodes;
      for (const embedded of [false, true]) {
        const html = renderGuides({ section: id, embedded });
        assert.match(html, new RegExp(replacement));
        if (id === "cross") {
          assert.equal((html.match(/class="cross-frame"/g) || []).length, 12);
          assert.equal((html.match(/class="f2l-diagram"/g) || []).length, 24);
          assert.match(html, /aria-label="Cross planning examples"/);
          assert.match(html, /Setup moves/);
        } else {
          assert.equal((html.match(/class="f2l-card"/g) || []).length, 41);
          assert.match(html, /<summary>How to use these cases<\/summary>/);
          assert.match(html, /aria-label="F2L case groups"/);
        }
        assert.doesNotMatch(html, /class="cube-player"/);
        assert.match(html, /target="_blank" rel="noreferrer"/);
        assert.doesNotMatch(html, /Mark complete|Previous lesson|Next lesson/);
      }
    } finally {
      module.nodes = original;
    }
  }
});

test("CFOP container and catalog blocks are validated instead of executing authored code", () => {
  const lesson = compileLesson(
    source(
      ':::intro\n## Plan\n\nRead the example.\n:::\n\n:::details More help\nKeep white underneath.\n:::\n\n```cross-example\n{"example":"cross-relative"}\n```\n\n```f2l-cases\n{"catalog":"f2l"}\n```\n\n```algorithm-library\n{"section":"PLL","method":"two-look"}\n```',
    ),
    courseExamples,
  );
  assert.deepEqual(
    lesson.nodes.map((node) => node.type),
    ["layout", "layout", "cross-example", "f2l-cases", "algorithm-library"],
  );
  const html = renderCourseContent({ nodes: lesson.nodes.slice(0, 3) });
  assert.match(html, /class="guide-intro"/);
  assert.match(html, /<details class="f2l-help"><summary>More help<\/summary>/);
  for (const body of [
    ":::unknown\nWords\n:::",
    ":::intro\nUnclosed",
    ":::note\n## Heading\n:::",
    ":::note\nFirst.\n\nSecond.\n:::",
    ":::details\nMissing summary\n:::",
    ":::examples Examples\nOrdinary prose\n:::",
    ":::intro\n:::note\nNested\n:::\n:::",
    ":::fact\n<script>alert(1)</script>\n:::",
    '```cross-example\n{"example":"beginner-turn"}\n```',
    '```cube\n{"example":"cross-relative"}\n```',
    '```f2l-cases\n{"catalog":"unknown"}\n```',
    '```f2l-cases\n{"catalog":"f2l","url":"https://example.com"}\n```',
    '```algorithm-library\n{"section":"CROSS","method":"full"}\n```',
    '```algorithm-library\n{"section":"PLL","method":"invented"}\n```',
  ])
    assert.throws(
      () => compileLesson(source(body), courseExamples, "cfop.md"),
      /cfop.md:\d+:/,
    );
});

test("authored algorithm scope and sequence frames must agree with the module and moves", () => {
  const root = mkdtempSync(join(tmpdir(), "cfop-authoring-"));
  try {
    cpSync(contentRoot, root, { recursive: true });
    const lessonFile = join(root, "cfop", "lessons", "two-look-oll.md");
    const originalLesson = readFileSync(lessonFile, "utf8");
    writeFileSync(lessonFile, originalLesson.replace('"OLL"', '"PLL"'));
    assert.throws(() => compileCourses(root), /does not match module scope/);
    writeFileSync(
      lessonFile,
      originalLesson.replace(
        "```algorithm-library",
        "Extra editable teaching text.\n\n```algorithm-library",
      ),
    );
    assert.equal(
      compileCourses(root).modules.find(
        (module) => module.id === "two-look-oll",
      ).nodes[0].type,
      "paragraph",
    );
    writeFileSync(lessonFile, originalLesson);
    const exampleFile = join(root, "cfop", "examples.json");
    const examples = JSON.parse(readFileSync(exampleFile, "utf8"));
    for (const change of [
      (e) => e.steps.pop(),
      (e) => (e.steps[0].moves = "invalid"),
      (e) => (e.steps[0].text = null),
      (e) => (e.comparison.algorithm = "invalid"),
    ]) {
      const changed = structuredClone(examples);
      change(changed["cross-relative"]);
      writeFileSync(exampleFile, JSON.stringify(changed));
      assert.throws(() => compileCourses(root), /invalid sequence frames/);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
