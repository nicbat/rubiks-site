import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";
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

const markdown = new Marked({
  extensions: [
    {
      name: "courseLayout",
      level: "block",
      start(source) {
        return source.match(/^:::/m)?.index;
      },
      tokenizer(source) {
        if (!source.startsWith(":::")) return;
        const match = source.match(
          /^:::([a-z-]+)(?:[ \t]+([^\n]+))?\r?\n([\s\S]*?)\r?\n:::[ \t]*(?:\r?\n|$)/,
        );
        if (!match)
          return {
            type: "courseLayout",
            raw: source,
            kind: "invalid",
            tokens: [],
          };
        return {
          type: "courseLayout",
          raw: match[0],
          kind: match[1],
          label: match[2]?.trim(),
          tokens: this.lexer.blockTokens(match[3]),
        };
      },
    },
  ],
});

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
          case "courseLayout": {
            if (
              ![
                "intro",
                "fact",
                "practice",
                "note",
                "sources",
                "examples",
                "details",
              ].includes(token.kind)
            )
              fail("unknown or unclosed prose container");
            const children = nodes(token.tokens);
            if (children.some((node) => node.type === "layout"))
              fail("prose containers cannot be nested");
            if (["details", "examples"].includes(token.kind) !== !!token.label)
              fail(
                "only details/examples containers require a plain-text label",
              );
            if (!children.length) fail("prose containers cannot be empty");
            if (
              ["note", "sources"].includes(token.kind) &&
              (children.length !== 1 || children[0].type !== "paragraph")
            )
              fail("note/sources containers require one paragraph");
            if (
              token.kind === "examples" &&
              children.some((node) => node.type !== "cross-example")
            )
              fail("examples containers accept only cross-example blocks");
            return {
              type: "layout",
              kind: token.kind,
              ...(token.label ? { label: token.label } : {}),
              children: ["note", "sources"].includes(token.kind)
                ? children[0].children
                : children,
            };
          }
          case "code": {
            if (
              ![
                "cube",
                "cross-example",
                "f2l-cases",
                "algorithm-library",
              ].includes(token.lang)
            )
              fail(
                "unknown course block; use cube, cross-example, f2l-cases or algorithm-library",
              );
            let value;
            try {
              value = JSON.parse(token.text);
            } catch {
              fail(`invalid JSON in ${token.lang} block`);
            }
            if (token.lang === "f2l-cases") {
              if (
                !value ||
                Object.keys(value).join() !== "catalog" ||
                value.catalog !== "f2l"
              )
                fail('f2l-cases requires { "catalog": "f2l" }');
              return { type: "f2l-cases" };
            }
            if (token.lang === "algorithm-library") {
              if (
                !value ||
                Object.keys(value).sort().join() !== "method,section" ||
                !["OLL", "PLL"].includes(value.section) ||
                !["full", "two-look"].includes(value.method)
              )
                fail("algorithm-library requires a valid section and method");
              return {
                type: "algorithm-library",
                section: value.section,
                method: value.method,
              };
            }
            if (
              !value ||
              Object.keys(value).join() !== "example" ||
              !Object.hasOwn(examples, value.example)
            )
              fail('unknown cube example; use { "example": "example-id" }');
            if (
              (examples[value.example].kind === "sequence") !==
              (token.lang === "cross-example")
            )
              fail("example kind does not match the course block");
            return { type: token.lang, example: value.example };
          }
          default:
            fail(`unsupported Markdown: ${token.type}`);
        }
      });
  }
  return { id, title, nodes: nodes(markdown.lexer(body)) };
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
      const sequence = example?.kind === "sequence";
      const targets = sequence ? example.pieces : example?.targets;
      requireValue(
        identifier.test(id) &&
          !Object.hasOwn(result.examples, id) &&
          course.puzzle === "3x3" &&
          example &&
          typeof example.title === "string" &&
          example.title.trim() &&
          (!example.kind || sequence) &&
          validMoves(example.setup) &&
          validMoves(example.algorithm) &&
          tokens(example.algorithm).length > 0 &&
          (!example.view || example.view === "underneath") &&
          Array.isArray(targets) &&
          targets.length &&
          targets.every(
            (piece) =>
              typeof piece === "string" &&
              pieceIds.has([...piece].sort().join("")),
          ),
        `${file}: invalid cube example ${id}`,
      );
      if (sequence) {
        requireValue(
          typeof example.description === "string" &&
            typeof example.start === "string" &&
            Array.isArray(example.steps) &&
            example.steps.length &&
            example.steps.every(
              (step) =>
                step &&
                validMoves(step.moves) &&
                tokens(step.moves).length &&
                typeof step.text === "string",
            ) &&
            tokens(example.steps.map((step) => step.moves).join(" ")).join(
              " ",
            ) === tokens(example.algorithm).join(" ") &&
            (!example.comparison ||
              (typeof example.comparison.label === "string" &&
                validMoves(example.comparison.algorithm) &&
                tokens(example.comparison.algorithm).length)),
          `${file}: invalid sequence frames ${id}`,
        );
      } else
        requireValue(
          typeof example.caption === "string",
          `${file}: invalid cube caption ${id}`,
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
          kind: definition.kind || "lesson",
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
      let libraries = 0;
      const validateBlocks = (items) => {
        for (const node of items || []) {
          if (node.type === "algorithm-library") {
            libraries++;
            requireValue(
              module.kind === "algorithms" &&
                module.section === node.section &&
                module.method === node.method,
              `${file}: algorithm-library block does not match module scope ${module.id}`,
            );
          }
          validateBlocks(node.children);
          for (const item of node.items || []) validateBlocks(item);
        }
      };
      validateBlocks(module.nodes);
      if (module.nodes && module.kind === "algorithms")
        requireValue(
          libraries === 1,
          `${file}: algorithm module requires one algorithm-library block`,
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
