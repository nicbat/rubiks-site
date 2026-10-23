import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import { tokens, solvedCube } from "../src/cube.js";

export const contentRoot = new URL("../content/courses/", import.meta.url);
const identifier = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const validMoves = (moves) => {
  if (typeof moves !== "string") return false;
  try {
    tokens(moves);
    return true;
  } catch {
    return false;
  }
};
const pieceIds = new Set(
  solvedCube().map((sticker, _, stickers) =>
    stickers
      .filter((s) => s.p.every((v, i) => v === sticker.p[i]))
      .map((s) => s.color)
      .sort()
      .join(""),
  ),
);
function requireValue(condition, message) {
  if (!condition) throw Error(message);
}

// Compile a deliberately small Markdown vocabulary to declarative Svelte nodes.
// Authored HTML and executable component/code blocks never reach the application.
export function compileLesson(source, examples, filename = "lesson.md") {
  const header = source.match(
    /^---\r?\n(id: [a-z0-9-]+\r?\ntitle: [^\r\n]+)\r?\n---\r?\n/,
  );
  requireValue(header, `${filename}: expected frontmatter with id and title`);
  const [idLine, titleLine] = header[1].split(/\r?\n/);
  const id = idLine.slice(4),
    title = titleLine.slice(7).trim();
  requireValue(
    identifier.test(id) && title,
    `${filename}: invalid lesson identity`,
  );
  const body = source.slice(header[0].length);
  function nodes(tokens) {
    return tokens
      .filter((t) => t.type !== "space")
      .map((token) => {
        const line = source
          .slice(0, source.indexOf(token.raw, header[0].length))
          .split("\n").length;
        const fail = (message) => {
          throw Error(`${filename}:${line}: ${message}`);
        };
        switch (token.type) {
          case "text":
            return token.tokens
              ? { type: "inline", children: nodes(token.tokens) }
              : { type: "text", text: token.text };
          case "escape":
            return { type: "text", text: token.text };
          case "codespan":
            return { type: "code", text: token.text };
          case "br":
            return { type: "br" };
          case "paragraph":
          case "strong":
          case "em":
            return { type: token.type, children: nodes(token.tokens) };
          case "heading":
            if (token.depth < 2 || token.depth > 3)
              fail("use ## or ### headings; the lesson supplies its title");
            return {
              type: "heading",
              depth: token.depth,
              children: nodes(token.tokens),
            };
          case "list":
            if (token.items.some((item) => item.task))
              fail("task lists are not supported");
            return {
              type: "list",
              ordered: token.ordered,
              start: token.start || 1,
              items: token.items.map((item) => nodes(item.tokens)),
            };
          case "link":
            if (
              !/^https:\/\/[^\s]+$/.test(token.href) &&
              !/^#\/[a-z0-9/?=-]+$/.test(token.href)
            )
              fail("links must use HTTPS or an app hash route");
            return {
              type: "link",
              href: token.href,
              children: nodes(token.tokens),
            };
          case "code": {
            if (token.lang !== "cube")
              fail("only fenced cube blocks are supported");
            let value;
            try {
              value = JSON.parse(token.text);
            } catch {
              fail("invalid JSON in cube block");
            }
            if (
              !value ||
              Object.keys(value).join() !== "example" ||
              !Object.hasOwn(examples, value.example)
            )
              fail('unknown cube example; use { "example": "example-id" }');
            return { type: "cube", example: value.example };
          }
          default:
            fail(`unsupported Markdown: ${token.type}`);
        }
      });
  }
  return { id, title, nodes: nodes(marked.lexer(body)) };
}

export function compileCourses(root = contentRoot) {
  const result = { courses: [], modules: [], examples: {} };
  const seen = new Set();
  const entries = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));
  const base = root instanceof URL ? fileURLToPath(root) : root;
  for (const entry of entries) {
    const directory = join(base, entry.name);
    const file = join(directory, "course.json");
    const { modules, ...course } = JSON.parse(readFileSync(file, "utf8"));
    requireValue(
      course.id === entry.name &&
        identifier.test(course.id) &&
        typeof course.title === "string" &&
        course.title.trim() &&
        typeof course.description === "string" &&
        ["3x3", "2x2"].includes(course.puzzle) &&
        (!course.status || course.status === "coming-soon") &&
        Array.isArray(modules),
      `${file}: invalid course definition`,
    );
    let examples = {};
    if (readdirSync(directory).includes("examples.json"))
      examples = JSON.parse(
        readFileSync(join(directory, "examples.json"), "utf8"),
      );
    requireValue(
      examples && typeof examples === "object" && !Array.isArray(examples),
      `${file}: invalid examples`,
    );
    for (const [id, example] of Object.entries(examples)) {
      requireValue(
        identifier.test(id) &&
          !Object.hasOwn(result.examples, id) &&
          course.puzzle === "3x3" &&
          example &&
          typeof example.title === "string" &&
          example.title.trim() &&
          typeof example.caption === "string" &&
          validMoves(example.setup) &&
          validMoves(example.algorithm) &&
          tokens(example.algorithm).length > 0 &&
          (!example.view || example.view === "underneath") &&
          Array.isArray(example.targets) &&
          example.targets.length &&
          example.targets.every(
            (piece) =>
              typeof piece === "string" &&
              pieceIds.has([...piece].sort().join("")),
          ),
        `${file}: invalid cube example ${id}`,
      );
      result.examples[id] = example;
    }
    const moduleIds = [];
    for (const definition of modules) {
      let module = { ...definition, puzzle: course.puzzle };
      if (definition.file) {
        requireValue(
          /^lessons\/[a-z0-9-]+\.md$/.test(definition.file),
          `${file}: invalid lesson filename`,
        );
        const lessonFile = join(directory, definition.file);
        module = {
          ...module,
          ...compileLesson(
            readFileSync(lessonFile, "utf8"),
            examples,
            lessonFile,
          ),
          kind: "lesson",
        };
        requireValue(
          module.id === definition.id,
          `${lessonFile}: lesson ID does not match course.json`,
        );
      }
      requireValue(
        identifier.test(module.id) &&
          !seen.has(module.id) &&
          typeof module.title === "string" &&
          module.title.trim() &&
          ["guide", "algorithms", "lessons", "lesson"].includes(module.kind),
        `${file}: invalid or duplicate module ${module.id}`,
      );
      if (module.kind === "guide")
        requireValue(
          ["cross", "f2l"].includes(module.guide),
          `${file}: unknown guide`,
        );
      if (module.kind === "algorithms")
        requireValue(
          ["OLL", "PLL"].includes(module.section) &&
            ["full", "two-look"].includes(module.method),
          `${file}: invalid algorithm scope`,
        );
      seen.add(module.id);
      moduleIds.push(module.id);
      result.modules.push(module);
    }
    requireValue(
      course.status || moduleIds.length,
      `${file}: available course needs modules`,
    );
    result.courses.push({ ...course, modules: moduleIds });
  }
  return result;
}

export function courseContentPlugin() {
  const id = "\0course-content";
  return {
    name: "course-content",
    resolveId(source) {
      if (source === "virtual:course-content") return id;
    },
    load(source) {
      if (source !== id) return;
      const content = compileCourses();
      const watch = (directory) => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          const path = join(directory, entry.name);
          if (entry.isDirectory()) watch(path);
          else this.addWatchFile(path);
        }
      };
      watch(fileURLToPath(contentRoot));
      return `export default ${JSON.stringify(content)}`;
    },
    handleHotUpdate({ file, server }) {
      if (!file.startsWith(fileURLToPath(contentRoot))) return;
      const module = server.moduleGraph.getModuleById(id);
      if (module) server.moduleGraph.invalidateModule(module);
      server.ws.send({ type: "full-reload" });
      return [];
    },
  };
}
