# BIG-36: fewer screens in practice

[Linear issue](https://linear.app/goscas/issue/BIG-36/cube-make-the-practice-flow-a-lot-less-screens)

Status: discussion draft. This PR records the current flow and a proposed first
change; it does not change the app. The owner confirmed that both getting into
practice and advancing through each case need attention.

## What we already have

- **My learning** combines course resume, a learning-set study card, case
  thumbnails and a Hidden practice card. Hidden practice already starts directly
  with Learning set / Review known and Both / OLL / PLL choices on the page.
- **CFOP OLL/PLL and the Algorithm library** share the same case browser,
  Full / Two-look scope, search, group and learning-status filters. “Practice
  these cases” always opens another case-selection dialog, including when the
  learner wants every case already shown. The dialog supports individual/group
  selection and Practice selected / Practice all without editing the learning set.
- **Case details** already include diagrams, the chosen algorithm, a 3D player,
  optional setup moves, Known and Learning set toggles. Rehearse closes this
  dialog and opens a separate practice page with the diagram, algorithm and a
  repetition button.
- **Hidden practice** has three stages: Set up → Recognize & solve → Rate.
  “Ready to recognize” opens a screen with instructions and a mystery cube;
  “Finished” reveals the answer and ratings. Rating already records the attempt
  and starts the next setup, with no separate Next screen.
- **PLL recognition quiz** is a separate visual drill with four diagram choices
  and a session score. It is reached from CFOP PLL and does not award mastery.

These are code-level observations at `origin/main` commit `5265424`, not findings
from a new browser walkthrough. Relevant sources are `Home.svelte`,
`Library.svelte`, `PracticePicker.svelte`, `CaseDialog.svelte`, `Practice.svelte`,
`PllQuiz.svelte` and the session actions in `src/main.js`.

## Where the friction comes from

We have useful practice modes, but they sit behind different entry points and
repeat information across surfaces. The main opportunities are the mandatory
second case picker and the intermediate Recognize & solve screen. Rehearsal
also moves away from the case view that already contains the learning tools.

The distinction between studying an algorithm, rehearsing it, and recognizing
an unseen case remains useful: they award different kinds of progress. We can
keep those distinctions while reducing navigation.

## Proposed first change

### Start from the context the learner has already chosen

Keep My learning's direct start, with the current choices and matching count
visible. In CFOP and the library, offer **Practice shown (N)** to start the
filtered pool immediately, plus **Choose cases…** for a custom subset using the
existing picker. An empty pool disables starting. Starting practice never edits
the learning set or Known marks.

Keep temporary practice selection separate from **Select cases**, whose existing
purpose is bulk editing saved properties. Labels should make that distinction
clear without introducing another setup page.

### Use two stages per hidden case

Proposed loop:

1. **Set up & solve.** Show the setup and a short instruction to keep the cube out
   of sight while setting up, then bring it into view and solve. Offer optional
   Hide setup / Show setup on this same surface. Keep **Try another setup**,
   **Reveal answer** and **Need help** available.
2. **Answer & rate.** Reveal the diagram and algorithm alongside the existing
   three ratings. A successful rating saves once and opens the next setup.
   Need help reveals the answer and permits only the Needed help rating.

No case name, group, occurrence, diagram, algorithm, arrows or revealing
accessible label may appear before reveal. Setup visibility is independent of
answer visibility. The separate Ready to recognize transition goes away.

From an already configured My learning card, the current path is Start → Ready
to recognize → Finished → rating. The proposal is Start → Reveal answer →
rating. Each later case drops from three required actions to two. In a filtered
library, starting every shown case also drops from two actions to one. These
counts exclude changing options and physically setting up/solving the cube.

### Return to the place practice started

Remember the originating My learning or library/CFOP context in memory. End
practice returns there with section, method, filters and scroll/focus restored.
Currently CFOP can return to its module, while standalone-library practice exits
to My learning. Reload still ends temporary practice; no resume schema is needed.

## Possible follow-up

Keep rehearsal in the existing case detail, beside its algorithm and player, with
**Record a repetition** and a session count. My learning's Practice algorithm
button could open that same detail. This would remove the separate rehearsal
page while retaining variant-specific repetitions that do not earn confidence.
Decide whether to include this after discussing the two larger cuts above.

Keep the PLL quiz as a distinct drill for now. Making it easier to find is useful,
but adding a universal practice-mode chooser would add a decision to every start.
Courses and reference guides can keep their existing places during this change.

## Contracts and implementation checks

- Preserve physical setup generation, colors, case IDs, variant indices,
  Full / Two-look recognition objectives and the existing confidence rules.
- Preserve fixed session pools, skip without logging, explicit known-review
  relearning and hint grading. Keep the revealed case and choices available when
  saving fails; advance only after a successful save, without duplicate attempts.
- Keep active-practice sync deferral, Settings preservation and dataset-change
  cleanup. Derive pools through existing library/hidden-practice helpers and the
  shared progress index; keep controller actions in `main.js`.
- Extend rendering/domain regressions for hidden content, pool scope and save
  behavior. Update affected browser flows for direct/custom starts, reveal/help,
  rating/next, exit context, keyboard focus and empty pools. Reuse existing picker,
  known-review, course, app, route and mobile coverage rather than deleting it.
- Before browser review, run formatting and `npm run verify:fast`. Then request
  approval for affected browser specs and inspect 320px portrait and 667×375
  landscape in light/dark themes using an isolated server. This discussion draft
  requires only Markdown formatting and diff checks.

## Decisions for discussion

The recommended first implementation is direct starts, the two-stage hidden loop,
and reliable return navigation. The remaining design choice is whether inline
rehearsal belongs in this first change or a small follow-up. Also confirm whether
an optional Hide setup control is enough, or whether the dedicated setup-hiding
transition should remain available for learners who prefer it.
