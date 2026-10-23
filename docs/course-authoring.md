# Editing courses

Each course lives in `content/courses/<course-id>/`. The app bundles these files
locally. No content server, runtime Markdown parser or online player is required.

```text
content/courses/beginner/
  course.json             # Course identity and ordered module list
  examples.json           # Explicit cube setups, moves and highlighted pieces
  lessons/
    introduction.md       # One Markdown file per lesson
    white-cross.md
    ...
```

## Edit a lesson

Open its Markdown file. Keep the `id` unchanged; progress and direct links use it.
The simple frontmatter has exactly these two fields, in this order:

````markdown
---
id: beginner-white-cross
title: White cross
---

## Your goal

Make a **white cross** with matching side colors.

1. Match an edge to its side center.
2. Turn that face halfway.

```cube
{ "example": "beginner-cross" }
```
````

Use `##` / `###` headings, paragraphs, ordered/unordered lists, bold, italics,
inline code, HTTPS links, and app hash links. The lesson viewer supplies the page
and lesson headings, navigation and completion buttons. A fenced `cube` block
references an example from that course's `examples.json`.

Images, raw HTML, arbitrary code, task lists, tables, and embedded Svelte/JavaScript
are intentionally unsupported. The compiler fails on unsupported Markdown instead
of silently omitting it. Add shared renderer support and coverage before adding a
new block kind. Content renders through Svelte nodes, not authored HTML injection.

## Edit cube examples

Examples are JSON objects keyed by stable example ID:

```json
{
  "beginner-cross": {
    "title": "Bring an edge down",
    "caption": "White underneath, green at the front. Match the side color first.",
    "setup": "F2",
    "algorithm": "F2",
    "targets": ["DF", "DR", "DB", "DL"],
    "view": "underneath"
  }
}
```

`setup` builds the starting state from the app's solved yellow-up, green-front
cube. `algorithm` is the sequence demonstrated from that state. These are separate
explicit values, not runtime inverses. `targets` lists piece identities to highlight
in the static before/after diagrams. The optional `view: "underneath"` changes only
the static diagram viewpoint; playback retains the stated grip. Omit it for the
normal yellow-up view. Show example mounts one paused player; Hide, changing lesson
or leaving the page releases it.

Keep algorithms in JSON. When adding an example, extend
`tests/beginner-examples.test.js` (or the appropriate course's independent tests)
with expected starting pieces, stage outcomes and preservation of earlier layers.
A sequence followed by its inverse is not enough verification.

## Add or reorder lessons

`course.json` contains `id`, `puzzle` (`3x3` or `2x2`), `title`, `description`, and
an ordered `modules` array. A Markdown module has this shape:

```json
{ "id": "beginner-white-cross", "file": "lessons/white-cross.md" }
```

The module ID must equal its Markdown frontmatter ID and be globally unique.
Reordering modules or editing prose preserves progress. Removing or renaming IDs
requires an explicit tested migration because old backups refer to them.

Existing CFOP modules use `kind: "guide"` with `guide: "cross" | "f2l"`, or
`kind: "algorithms"` with `section: "OLL" | "PLL"` and
`method: "full" | "two-look"`. These reuse the existing guides/library. The inactive
Ortega reference retains its `kind: "lessons"` module and legacy review IDs.
Set `status: "coming-soon"` to keep a course unavailable.

## Progress and validation

Opening an available course records its own resume module. Reviewing a Markdown
lesson records its module ID in existing version-2 `reviewed` data. Completion is
reversible and never grants algorithm marks or practice confidence. Continue lists
started, unfinished courses. Finished is derived from completion of all modules;
CFOP uses its actual guide reviews and learned algorithm objectives. Reopening a
finished course preserves completion; undoing a review returns it to Continue.

Old version-2 backups remain valid. Course IDs, module membership and review IDs
are validated before import replacement. No new storage key or schema version is
needed for the additional authored IDs. A backup containing new lesson IDs requires
a version of the app that knows those lessons.

`npm run dev` watches authored files and reloads the page. `npm run build` and
Node tests use the same compiler. Errors identify the course/lesson filename (and
Markdown line where applicable). The Markdown parser is a development dependency
and is excluded from browser assets.

Run `npm run check`, `npm test`, and `npm run test:build`. Ask for browser-test
approval before running `npm run test:e2e` or `npm run verify`, as AGENTS.md requires.
