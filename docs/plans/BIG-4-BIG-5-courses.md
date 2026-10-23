# BIG-4 / BIG-5: editable courses and Beginner 3×3

## Goal

Build a static, browser-local course system that is easy to author. Ship Beginner
3×3 alongside CFOP, group available courses by puzzle, show all unfinished courses
under Continue, and retain completed courses under Finished.

## Accepted product decisions

- Beginner is a guided first solve, without quizzes or graded practice.
- Lessons contain a goal, holding instructions, examples, common mistakes, and a
  reversible completion button. Completion means reviewed, not algorithm mastery.
- Beginner follows notation/introduction, white cross, white corners, middle
  layer, yellow cross, yellow edge placement, corner placement, corner orientation.
- Use original teaching copy informed by the Ruwix beginner method. Link attribution.
- Keep 2×2 Ortega and 3×3 Blindfolded unavailable and labelled Coming soon.
- Opening a course starts it; preserve a separate resume position per course.
- Finish Beginner when all its lessons are reviewed. CFOP completion uses its
  existing guide reviews and learned algorithm objectives. Reopening a finished
  course does not restart it; reversing completion returns it to Continue.

## Content architecture

`content/courses/<id>/course.json` defines stable IDs, puzzle, title, description,
and ordered modules. `lessons/*.md` supplies prose; `examples.json` supplies
explicit cube setup and playback moves. Existing CFOP guide/library modules remain
references to their shared implementations and retain all existing IDs.

Compile Markdown at build/dev time into validated structured nodes. Use a real
Markdown parser as a development dependency. Render nodes declaratively with
Svelte; never execute content or inject authored raw HTML. Initially support
headings, paragraphs, lists, emphasis, links and inline code, plus a fenced `cube`
block containing JSON with an example ID. Reject unsupported blocks, unsafe URLs,
missing references, duplicate IDs and invalid move notation with source locations.
Bundle all content locally; no runtime fetches or third-party requests.

## Implementation steps

1. Create this plan in an isolated worktree based on current origin/main.
2. Add the content compiler, content folders, validation tests and authoring guide.
   Move CFOP/coming-soon definitions into their course folders; keep stable IDs.
3. Generalize opening/resuming and route restoration. Preserve all existing CFOP
   hashes; introduce validated course/lesson hashes for Beginner.
4. Add the shared Markdown lesson view and course navigation using existing UI,
   diagrams and paused explicit-setup cube players. Keep actions in main.js.
5. Add Beginner copy and independent cube-oracle regressions for every example,
   including stage outcomes and preservation of previously solved layers.
6. Add course summaries for Continue, puzzle sections and Finished. Reuse the
   existing single progress index and preserve saved history/variant IDs.
7. Extend validation/backups and tests for mixed courses, independent resumes,
   completion reversal, malformed imports and existing version-2 backups.
8. Add browser regressions for real navigation, reload/Back/Forward, completion,
   player cleanup, keyboard focus, and light/dark 320×720 / 667×375 layouts.
9. Run formatting, Svelte diagnostics, all Node tests and build/bundle checks.
   Ask before local browser verification as AGENTS.md requires; leave the full CI
   workflow intact. Do not raise budgets or weaken existing coverage.
10. Commit focused changes, push the branch, open a PR for BIG-4 and BIG-5 and
    retrieve the Vercel preview URL. Report verification limits accurately.

## Compatibility and acceptance

- Existing learning storage key/schema, CFOP routes, case IDs and variant indices
  remain compatible; extend accepted reviewed/resume IDs with authored lessons.
- Reviewing Beginner must never create known marks or practice attempts.
- Invalid/cancelled imports preserve all existing progress.
- A second available course works without a second hard-coded navigation branch.
- Continue lists both active courses; Finished remains accessible after reload and
  export/import. All controls and content fit supported mobile sizes.
- Work only in /tmp/last-layer-courses on nic/big-4-big-5-courses. Preserve the
  original checkout and its untracked supabase directory.
