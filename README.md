# Last Layer

A static cube-learning app with Beginner and CFOP courses for 3×3. 2×2 Ortega and blindfolded are marked Work in progress / Coming soon. Known algorithm marks are shared across two-look and full CFOP; recognition confidence follows the exercise. No account, backend, database, or paid service is required. Progress lives in the current browser.

## Run locally

Requires Node.js 22.18+ (tested with Node 26).

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. For full verification (install test browsers once with `npx playwright install chromium firefox`):

```sh
npm run verify
npm run preview
```

Publish the `dist/` directory to any static host. Relative asset URLs support hosting under a subdirectory. No environment variables are needed. Fonts and cube diagrams are bundled locally; there are no runtime API calls.

## Contributing and agent guidance

Read [AGENTS.md](AGENTS.md) for shared repository practices. [CLAUDE.md](CLAUDE.md) imports the same instructions for Claude Code. [Testing and performance](docs/testing.md) documents the test matrix, failure reproduction, benchmark scope, and build budgets.

`npm run verify` runs Svelte diagnostics, domain/oracle tests, production browser tests (desktop Chromium, mobile Chromium, Firefox), and compressed bundle checks. `npm run benchmark` measures repeatable rendering CPU workloads. CI runs the same verification and uploads browser failure traces.

Compressed asset budgets are 160 KiB JavaScript and 18 KiB CSS across all emitted
chunks. These track transfer-size growth; they do not measure browser responsiveness.

## What you can do

- Learn your first 3×3 solve in eight Beginner lessons, with before/after diagrams, paused playable examples, and reversible completion marks. Courses are grouped by cube; Continue lists every started, unfinished course and Finished retains completed courses for review. Each course remembers its own place. Lesson completion means reviewed, not algorithm mastery.
- Open one CFOP workspace with Cross, F2L, OLL, and PLL sections. Switch Two-look / Full inside OLL and PLL, practise there, and resume from My learning.
- See upcoming 2×2 Ortega and blindfolded courses. The Ortega reference is prepared in the source (first face, seven OLL and five PBL algorithms), but both courses remain unavailable while work continues.
- Train two-sided PLL recognition in CFOP by matching six side stickers to one of four arrow diagrams with neutral side stickers. Names are secondary labels. The quiz covers all 21 PLL cases with varied AUF/viewpoints; session scores do not grant mastery.
- Choose a default display top color in Settings, optionally randomize it per case opening/question, or use Change color while studying. Case diagrams and algorithm previews use the same proper color scheme; timer and guide examples retain their stated orientation.
- Main navigation has My learning, Courses, Progress, and Timer. Algorithm library and Guides remain available in the footer. Open Settings as a popup over the current page; manage Cubes from there. Escape, the close button, or the backdrop returns to your page.
- Carry recognition progress automatically between identical full/two-look objectives. Known marks carry across both views for the same case and variant; partial-pattern recognition stays separate.

- Open Guides for a visual cross-planning guide and all 41 standard F2L cases grouped for lookup. Cross diagrams show relative alignment, moves that help two edges, preserving a pair, and an X-cross, with above/underneath views and short captions. Open one example at a time to load its 3D cube; closing it or leaving releases the player. F2L cards keep their grid layout while the selected case opens in a separate preview below its group, keeping your scroll position while you browse cases. Cards show static pair diagrams and algorithms; their case numbers follow the CubeSkills sheet, not other sites. Examples start paused and do not affect learning progress.
- Explore face, wide, slice, and rotation moves in Guides → Notation, with labeled before/after nets and a CSS 3D cube shown by default. Play/pause controls continuous turns: each repetition starts from the previous result.
- Open a case for a 3D algorithm player in a side panel (stacked on phones), with touch-sized icon controls for play/pause and stepping, clickable move highlighting, and drag or arrow-key viewing. Home and practice screens keep their compact diagrams. Reduced motion disables notation autoplay; playback stays local.
- Show setup moves in any case popup to build that case from a solved cube. Start yellow-up and green-front, then use U turns or rotate the cube to match the diagram.
- Choose any of the 57 OLL and 21 PLL cases for your learning set.
- Switch to 2-look OLL/PLL for a smaller, step-by-step curriculum.
- Collapse library groups and practice any filtered set without changing your learning set.
- Mark algorithms you already know, independently for each variant.
- Preview the current timer scramble with the cube icon beside Scramble; drag or use arrow keys to inspect its final state.
- Use the scramble timer with Space or touch controls. After finishing, choose +2 sec, DNF, or No penalty; edit penalties in history too. Averages trim the fastest and slowest result: one DNF is dropped, two produce DNF. Raw elapsed time is preserved.
- Browse OLL and PLL by group and view top-down diagrams. PLL permutation arrows are on by default; an explicitly saved off preference is respected.
- Switch algorithm variants; hover or focus common move chunks for a tooltip, or click to keep their names visible.
- Click the main learning diagram to open its case, or rehearse a chosen algorithm throughout the day.
- Practice hidden cases from your selected set, using varied setup sequences and optional random last-layer color.
- Set a light, dark, or system theme and PLL arrows on the Settings page.
- Record recognition and execution results, and review local progress. Inspect solve timeline tooltips by hover, touch, or keyboard (Left/Right, Home/End; Escape dismisses).
- Export/import JSON backups to transfer progress between devices manually.

Each person can use their own browser. There is no automatic synchronization or shared progress view in this version. Clearing browser storage deletes progress, so export a backup periodically. Changing the site's origin (including its port) uses a different browser storage area.

## Command palette

Press **Escape** or **Ctrl/Cmd+K**, or tap the **⌘ Commands** button in the header. Type words to filter destinations, use **↑/↓** to choose a result, and press **Enter** to open it. The search field keeps focus while arrow keys highlight a result; Enter opens that result (initially the first match). Escape or the close button dismisses the palette and restores focus.

Commands cover navigation, CFOP sections, reference guides, Settings, and backups. Existing dialogs and open selectors handle Escape first. Opening and closing Commands preserves hidden practice; commands are unavailable during a running solve.

## Navigation and links

Pages use hash-based URLs, so direct links and reloads work on static hosts without server rewrites. For example: `#/courses`, `#/cfop/pll/two-look`, `#/cfop/oll/full`, `#/library/pll/full`, `#/guides/f2l`, `#/timer`, and `#/cubes`. Browser Back/Forward restores the destination. Unknown links return to My learning.

Settings adds `?settings` to the current hash route, such as `#/timer?settings`. Opening it preserves the current page and active practice session; closing it restores focus. Preferences save immediately. Practice sessions and running timers remain temporary: reloading a practice route returns to My learning, and reloading the timer does not resume a running solve. Filters, case popups, and playback positions are not encoded in URLs.

## Practice rules

Start every hidden setup from a solved cube, yellow on top and green in front. In this grip, the standard color scheme has orange on the right, red on the left, blue at the back, and white underneath. This is the default display scheme. Display colors can change independently of physical setup instructions. Follow the setup while keeping the cube out of view, then bring it out to recognize and solve. The case and diagram remain hidden until you finish or ask for help. Hint use requires the “Needed help” result.

Hidden practice always randomizes the final layer adjustment. Adjacent turns of the same face are combined and cancellations removed, so setup length can vary. With **Randomize last-layer color** enabled, the setup places the case on any of the six colors, with a random orientation around that face. Face turns are remapped, including the final adjustment; no cube rotations are shown. Start yellow-up and green-front as usual, then find the last layer and bring it to the top to solve. Choices are independent, so colors can repeat. The setting and PLL arrow visibility are saved on the device; an existing enabled side-color preference carries over to the new setting.

A reveal shows your chosen display color and algorithm, not necessarily the colors or orientation produced by the setup. Match the pattern regardless of color, with the last layer on top; adjust that face or rotate the cube as needed. OLL setups may leave a PLL case after orientation; finish solving the whole cube before the next setup.

Imported attempts are validated for real calendar dates and timezone-qualified timestamps, then ordered chronologically before replacing any progress.

A case becomes **Confident** after confident recognition and execution on three distinct local calendar dates since the most recent difficult recognition attempt. “Needed help” and “Solved with effort” reset that sequence. Rehearsals add to practice totals but do not earn confident days. Each algorithm variant has its own history.

## Two-look learning and timer

Open **Courses → CFOP → OLL or PLL → Two-look**. OLL has three yellow-cross cases followed by seven corner-orientation cases; PLL has two corner-position cases followed by four edge-position cases. Diagrams show the complete case, including pieces not involved in the current learning step. Skip a step when its pieces are already solved. Saved algorithm choices take priority over two-look recommendations. Corner-orientation OLL cases with an oriented cross and edge-only PLL cases share recognition progress automatically for matching variants. Two-look line/L/dot and corner-positioning PLL have separate recognition objectives: the same moves can be familiar without full-pattern recognition. Known marks apply to the same algorithm variant in both views, including T/Y PLL and line/L/dot OLL. Marking or unmarking it updates both views without copying attempts. Different variants remain independent.

**Practice these cases** opens a temporary case picker using the current section, method, group, search, and learning-status filters. Click individual diagrams or a group heading to select cases, then choose **Practice selected**. **Practice all** starts every case shown in the picker, regardless of the selection. Closing the picker discards the selection without changing your learning set. Learned includes “Already known” and earned “Confident” status for the currently chosen variant. With all learning statuses shown, the library and each group display learned/total counts. Skipping and recording a result stay within that set. Collapsing a group only changes its display; it does not remove cases from the practice set.

**Learning set** and **Known** in a case's detail are toggles; a checkmark and highlighted button indicate an active status. **Known** records a reversible declaration for the chosen case and variant across both two-look and full CFOP. It does not add practice attempts or confident days. Reviewed Cross/F2L guides share their mark across courses; reviews remain distinct from practice confidence.

Choose **Select cases** in OLL/PLL or the Algorithm library to edit several cases together.
Select individual cases, groups, or **Select all matching** the current filters, including
collapsed groups. Set **Known** and/or **Learning set**, then choose **Apply** to save both
properties together. Known uses each case's chosen algorithm variant; removing a known
mark preserves earned confidence and practice history. Applying successfully clears the
selection; failed saves preserve the original progress and your choices for retry.
Changing filters, section, or learning method clears the selection and property choices.
**Clear selection** resets the choices; **Done** or leaving the page discards unapplied edits.

The Cubes page keeps a simple list of names and optional descriptions. The first cube becomes the default; **Make default** changes it. The timer starts with that default after a reload and keeps your chosen cube during the session. Choose a cube before starting a solve, or open a row in **Solve history** and change **Cube for this solve** afterward. Renaming a cube updates its name in history. Delete removes a cube from the list and future choices while retaining its name on past solves. Deleting the default selects the next remaining cube, or no cube if the list is empty. Older solves remain “Not specified” until assigned. Cube records and timer history are stored locally and included in new training backups.

The Timer page generates 20 random face turns locally. These are not competition random-state scrambles. Hold Space for half a second until the “Release to start” cue, then release to begin. Tap Space to stop. A short early release does not start a solve. The scramble hides while running. After finishing, press Tab or tap Next scramble before starting another solve; further Space presses leave the result unchanged. Tab keeps its normal focus behavior in other controls, and Shift+Tab always moves focus backward. Hold the start button for the same half-second, then release when the cue appears; tap Stop to finish. The two decorative start lights show red at rest or while holding, yellow when ready to release, and green while running, even with the timer hidden. New scramble (Tab) refreshes the scramble before starting; Next scramble (Tab) advances after a solve. Navigating away stops the timer. Completed solves save locally with their date and scramble. Open Solve history and select a result to review or delete it; Backspace deletes the just-finished solve. Recent averages of 5 and 12 exclude one fastest and one slowest time, and each window shows its best solve. Turn off Show minutes on timer in Settings for total seconds. Enable Hide timer while solving to conceal the running time until you stop; this is off by default. Navigating away freezes an unfinished timer without saving it as a completed solve. Timer history is separate from learning progress and is included in new training backups.

Timer history initially shows the latest 50 solves, newest first. **Show more** adds
50 older solves at a time. Reviewing, editing, deleting, and recording solves keep
the expanded limit; leaving Timer, replacing a backup, or switching test data resets
it to 50. Statistics and exports always use the full history.

## Course progress and backups

Course learning starts fresh in `last-layer.progress.v2`. Version-1 browser storage is left untouched. Version-1 export files can be explicitly imported: the preview converts them to version 2 while retaining selected cases, algorithm variants, known marks, and original practice dates. Attempts without a recognition method use full recognition. Timer solves, cubes, and device settings keep their existing storage. New exports contain version-2 learning data, including shared known marks, legacy two-look marks and recognition links, reviewed lessons, the active course, and each course’s last opened module.

Legacy two-look known marks count as shared algorithm knowledge. Updating a mark consolidates that variant into the shared field; old recognition links remain supported in backups but are no longer exposed in the interface.

Attempts record the method and a snapshot of the variant being practised. In version-2 files, an omitted method means full recognition. Imports validate course/module/lesson references and sharing links before replacing anything. Imported progress can restore course selection and resume positions, but never an in-progress practice session. New training backups wrap version-2 learning progress together with timer history and cubes, including deleted cubes referenced by history. Older learning-only backups are still accepted and leave solves and cubes untouched. Display settings remain device-local.

Courses live in `content/courses/<id>/`, with JSON identities/order, Markdown lessons,
and JSON cube examples. Markdown compiles to validated Svelte-rendered nodes during
development/build; the parser is excluded from browser assets. See
[Course authoring](docs/course-authoring.md) for the supported Markdown and cube
blocks. Existing CFOP routes and saved IDs remain compatible; Beginner links use
`#/courses/beginner/beginner-white-cross`. The inactive 2×2 reference has its own
JSON catalog and independently checked algorithms. It does not use the 3×3 renderer
or grant 3×3 recognition mastery. Interactive puzzle support still requires its
own mechanics, diagrams, and practice rules.

## Local tracking dashboard

Progress combines hidden practice, rehearsals, and timer solves in a selectable activity heatmap. Weeks run across and weekdays run down;
color intensity shows daily activity, and selecting a square shows the day’s breakdown. Time solving appears alongside Practice attempts, Active days and Confident cases as `hh:mm:ss` (raw elapsed time, with hours continuing beyond 24). The other timer statistics sit above the heatmap. A single full-width graph shows dimmed individual-solve dots and ao5/ao12 lines, without a line connecting individual solves or a bar chart. Below it, a full-width toolbar groups **Last day**, **Last week**, **Last month**, **Last 3 months**, and **All time**, followed by a vertical separator and the cube filter; controls wrap on phones. Presets include today and cover 1, 7, 30, or 90 local calendar dates; Last month is the default. Custom dates are not offered. The heatmap always shows the latest 365 days with month labels.
The compact contribution grid uses 12px day squares and scrolls horizontally on phones. Confidence is all-time and follows the
current recognition method and algorithm variant. The OLL/PLL case map opens the existing
case details without changing confidence rules. OLL and PLL can be collapsed independently.
Select a heatmap day and choose **Delete day’s activity** to review and remove all practice attempts and timer solves for that local date, across all cubes. Confirmation is required; other dates, selected cases, known marks, and cubes are kept. Deletion recalculates confidence and statistics and cannot be undone without a backup. Failed writes preserve the previous data.

Selected days show solve count, best single, median, best ao5/ao12, recorded solving time,
mean and middle 50% excluding DNF, +2 counts, and DNF rate. Selecting a heatmap date drills
into that day; choosing a date preset clears the day selection. The shared date/cube filters
apply to the graph, statistics and both solve lists.

Click or tap a dot (or select a history row) to open that solve’s full details inline below
the graph toolbar. Hover and keyboard focus only inspect the chart tooltip; they do not
select a solve. Inline controls support penalties, cube assignment, notes, copy, confirmed
deletion and save retry. Previous/Next traverse all filtered solves, including ones omitted
from the bounded graph sample. **Show cube** / **Hide cube** stays set as you browse solves,
and the visible preview updates to each selected scramble. Clearing filters or selecting a
different day clears the selected solve. Timer reviews continue using the existing dialog.

Learning content is always visible below the tracking section; there is no Learning/Solves
switch or repeated solve-statistics panel. Up to 50 individual results appear below the
graph. Bests and summary statistics use the entire selection. Averages include penalties
and drop one fastest and one slowest result. DNF points appear above the time axis. These
are personal training statistics using the app's random-turn scrambles.

New attempts get permanent IDs; existing attempts receive IDs once when loaded and saved.
New solves retain a local calendar date alongside their timestamp. Older solves have no
original local date and are grouped using the current device's timezone. Missing measurements
are not invented. Quiz history, timed algorithm drills, session summaries, and cloud sync
are not part of this first dashboard release.

New exports use `{ format: "last-layer-training", version: 1, progress, solves,
cubeCollection }`. Import previews distinguish full training replacement from learning-only
replacement. All records and cube references are validated before confirmation. A restore
journal preserves the previous stored bytes until all writes succeed; interrupted restores
roll back before training data is read on the next load. Storage failures retain the prior
records and show an error. Keep a backup before clearing browser data.

`dashboard.js` contains DOM-independent activity and solve summaries. Daily learning counts
come from `progress-index.js`'s existing single history scan. `training-backup.js` owns the
versioned backup envelope, validation, and recoverable storage replacement. Views remain
declarative, and `main.js` owns interactions. No backend or runtime service is used.

## Test data

Enable **Settings → Test data → Enable test data** to explore a populated app without
changing your personal training data. The seeded dataset backfills 18 months (roughly
9,800 solves and 4,300 practice attempts), including rest days, improving solve times,
+2/DNF penalties, notes, active/retired/unassigned cubes, algorithm variants, known
marks, reviewed guides, and varied OLL/PLL confidence. Dates follow the local calendar
and end today. Progress, Timer, courses, and the library use the same active dataset.

A banner identifies test mode. Sample edits, new solves, imports, and day deletions
stay in memory and survive toggling within the tab. Turning test data off restores
your personal data, including unsaved changes in that tab. The toggle is saved as a
device preference; reloading while enabled regenerates the sample dataset. Exports
use the active dataset and sample files include `test-data` in their filename.
Display preferences and themes remain device settings. Switching datasets ends
temporary practice and clears the timer result; switching is disabled during a solve.

`test-data.js` generates the DOM-independent fixture with a fixed seed.
`training-storage.js` routes normal writes and restore journals to either browser
storage or an isolated in-memory store. Sample data never replaces stored personal
training records.

## Configure algorithms

`data/algorithms.json` is the source of truth. A case looks like:

```json
{
  "id": "pll-T",
  "section": "PLL",
  "name": "T perm",
  "group": "Adjacent Corner Swap",
  "source": "https://jperm.net/algs/pll",
  "preferredVariant": 0,
  "algorithms": [
    { "label": "Default", "moves": "R U R' U' R' F R2 U' R' U' R U R' F'" }
  ],
  "setups": ["A verified setup sequence goes here"]
}
```

The setup placeholder above is explanatory, not valid cube notation. Keep the verified setups already in the catalog when changing your preferred algorithm. Append alternative algorithms to the `algorithms` array and change `preferredVariant` if desired. Keep case IDs and existing variant positions stable: saved progress refers to them. A browser's selected variant overrides `preferredVariant`.

OLL/PLL algorithms omit initial `y` regrips: the diagram starts in the grip used by the first remaining move. Internal rotations remain part of the algorithm. PLL sequences include the finishing layer adjustment so the displayed permutation solves completely; arrows show its actual piece destinations. G perms show a three-corner cycle and a three-edge cycle with the matching two-piece block fixed. Light outlines separate overlapping arrows.

Diagrams are computed directly from the selected algorithm, including slice moves, wide moves, and rotations. Different variants can still use different starting grips; removing a leading regrip does not force unrelated finger tricks into the same orientation. Randomized physical practice may still require a final adjustment relative to your cube’s centers. All variants for a case must solve the same case (up to cube/top-layer orientation). Run `npm test` after catalog changes; it checks every variant and every setup. The parser supports standard space-separated move notation and parentheses for grouping, not commutator syntax.

`data/triggers.json` defines named move chunks. The longest matching chunk wins; file order breaks ties. Patterns are parsed once when the app starts. Unmatched moves remain readable in plain notation. Change this file to use your own chunk names.

## Sources and maintenance

The 41-case F2L reference comes from [CubeSkills’ F2L sheet](https://www.cubeskills.com/uploads/pdf/tutorials/f2l.pdf) by Feliks Zemdegs and Andy Klise. Local case numbers follow the sheet’s reading order. `data/f2l.json` is separate from the last-layer importer; static pair diagrams are generated locally.

Algorithm sequences, case classifications, and setup sequences come from [J Perm's OLL](https://jperm.net/algs/oll) and [PLL](https://jperm.net/algs/pll) trainers. The catalog contains 16 setup sequences per case, with a randomly chosen final U adjustment during practice. The UI and generated SVG diagrams are original to this app.

`node scripts/import-jperm.mjs` regenerates the catalog from upstream literal data. **This overwrites catalog customizations**; review the Git diff before committing. It parses the source with Acorn and does not execute downloaded JavaScript. It requires network access only when explicitly run. Preserve the local leading-regrip and PLL finishing-adjustment corrections when reviewing an import; the normalization and completion tests guard them. `scripts/normalize-algorithms.mjs` exports an offline leading-`y` cleanup helper and is not runtime code.

Tests validate case coverage, variant equivalence, setup equivalence, progress rules, and backup validation. An independent cubing.js check verifies that every setup preserves F2L and that PLL setups keep the top oriented. Cubing.js is a development dependency only, not part of the app bundle.

## Svelte UI

The entire UI uses Svelte 5 on Vite. Shared Button, Input, Textarea, Label, Checkbox,
Select, NativeSelect, RadioGroup, Card, Badge, Chart, Command and Dialog components live in `src/lib/components/ui`
and follow shadcn-svelte's source-owned model. The command palette uses the default
shadcn layout with Last Layer's shared colors and typography. All controls support
light/dark/system themes and phone touch targets. `components.json` configures
registry additions; see the UI directory's README and MIT license before changing them.

Application state and actions stay in `main.js`. It publishes reactive render inputs
through `app-model.svelte.js`; `view-state.js` refreshes mutable UI boundaries without
copying the attempt history. Svelte owns the page DOM. The specialised cube renderer
owns its scene and animation controls, and AbortController releases handlers when
players change. Only locally generated SVG/icon markup uses `@html`.

The app remains browser-local and statically hosted, with the same hash URLs, storage
keys, backups, catalog IDs and variant indices. This migration needs no data conversion.

Physical 3D stickers use retained child elements with literal inline `!important`
background colors, preserving white and the other puzzle colors against dark-mode
extension stylesheet overrides. The renderer retains that priority when recoloring
after moves. Sticker colors also remain identifiable in forced-colors mode; the
surrounding player and controls continue to use the shared theme.

## Code layout

- `src/main.js`: application state, persistence orchestration, DOM events, and focus management.
- `content/courses/` / `scripts/compile-courses.mjs`: editable course manifests, Markdown lessons, JSON examples, and a shared build/test compiler with source validation.
- `src/courses.js` / `src/components/Courses.svelte` / `src/components/CourseLesson.svelte` / `src/courses.css`: reusable definitions, scoped case pools, course summaries, progress, declarative lessons, course pages and availability.
- `src/two-by-two.js` / `src/components/TwoByTwo.svelte` / `data/two-by-two.json`: Ortega reference and reviewable lessons.
- `src/display-colors.js`: proper color relabeling shared by diagrams and algorithm players.
- `src/pll-quiz.js` / `src/components/PllQuiz.svelte`: independent question generation and visual PLL choices.
- `scripts/pack-catalog.mjs`: lossless production-only catalog field/setup encoding, preserving the editable JSON and every setup; tested by a complete round trip.
- `src/commands.js`: command definitions and word filtering; `src/components/CommandPalette.svelte` composes shadcn Command primitives. Bits UI manages search/selection keyboard behavior; `main.js` owns application actions and opening/closing focus.
- `src/components/AppView.svelte` / `src/icons.js`: page and dialog markup, shared UI components, and icons.
- `src/cube.js`: facelet mechanics, move parsing, case construction, and case equivalence.
- `src/cube-player.js`: public 3D player API. Pages use `src/components/CubePlayer.svelte` with `id`, `mode`, and `algorithm` props with a stable instance ID and `notation`, `algorithm`, `scramble`, or `lesson` mode. Lesson mode additionally accepts an explicit `setup` and starts paused from that state; mode determines controls, starting state, and autoplay; algorithm playback holds 100 ms between 650 ms turns, while notation holds 450 ms; `main.js` mounts playback with `createPlayerPlayback` and a `createCubeRenderer` per DOM root.
- `src/cube-playback.js` / `src/cube-player-view.js` / `src/cube-player-renderer.js` / `src/cube-player.css`: private timeline, geometry, DOM projection, and styling. Event handling and scheduling stay in `main.js`; the renderer owns only its per-mount draw cache, has no listeners or timers, and writes only changed values. Cube elements persist across moves; only colors, layer membership, and exposed inner faces change. Full cube snapshots remain defensive copies.
- `src/f2l.js` / `src/components/F2L.svelte` / `src/f2l-diagram.js` / `data/f2l.json`: full F2L reference, center-normalized setups, and local static pair previews.
- `src/components/Guides.svelte` / `src/guides.css` / `data/guides.json`: declarative Cross/F2L lessons and on-demand examples; lesson setups and solutions are separate from the OLL/PLL catalog.
- `src/components/Notation.svelte` / `src/notation.css`: interactive 3×3 notation reference; demonstration state and events live in `main.js`.
- `src/diagram.js` / `src/pll-arrows.js`: SVG diagrams and PLL piece movement.
- `src/case-diagram.js`: shared 2D case-preview API for learning, library, progress, practice, detail, and the practice picker. It caches immutable SVG strings from `diagram.js`; previews have no visible orientation caption and retain orientation in their accessible labels.
- `src/progress-index.js`: one history scan per render for shared, separate, and explicitly linked recognition summaries. Activity totals count each attempt once.
- `src/algorithm.js` / `src/html.js`: DOM-independent trigger tokenization and trusted SVG HTML escaping; `Algorithm.svelte` renders text and disclosures.
- `src/practice.js`: random setup selection and last-layer color/orientation remapping.
- `src/learning-methods.js` / `data/learning-methods.json`: full and two-look curricula and recommended variants.
- `src/library.js`: shared library filtering and filtered practice pools.
- `src/components/PracticePicker.svelte` / `src/practice-picker.css`: grouped temporary practice selection; selection and session events live in `main.js`.
- `src/components/SelectControl.svelte`: shared shadcn/Bits UI selector with keyboard navigation.
- `src/cubes.js` / `src/components/Cubes.svelte`: validated local cube records, default selection, and cube management/pickers. Timer solves optionally reference a stable cube ID; old solve records remain compatible.
- `src/solve-timer.js` / `src/solve-history.js` / `src/components/Timer.svelte` / `src/timer.css`: scramble generation, stopwatch state, validated local solve history, recent statistics, and timer UI.
- `src/progress.js` / `src/dates.js`: progress validation, shared calendar/timestamp validation, and confidence rules.
- `src/preferences.js` / `src/theme.js`: device preferences and theme behavior.
- `src/tokens.css` / `src/style.css` / `src/theme.css`: design tokens (light/dark palettes, cube colors, and the self-hosted Silkscreen, Martian Mono, Saira, and DSEG7 fonts), layout, and theme controls. Components read token variables; themes change only the values in `tokens.css`.

Views receive current state and read-only helpers; they do not mutate progress. UI primitives forward actions to the controller through Svelte context. Cube mechanics and practice generation have no DOM dependency. Tests also compare side rotation with cubing.js and verify PLL arrow destinations.

## Deliberately left for later

Accounts and sync, cross/F2L practice, interactive blindfolded drills, 2×2 players/practice, automatic learning recommendations, an in-app algorithm editor.

## Future ideas

See [docs/ideas.md](docs/ideas.md) for deferred ideas, including shared progress, learning recommendations, trigger drills, cross, and F2L.

Timer history retains `last-layer.solves.v1`: optional `penalty` is `"+2"` or `"dnf"`; absence means no penalty. `elapsed` always stores the raw milliseconds. Device preferences add validated `displayTop` (U/D/F/B/R/L) and boolean `randomDisplay`.

Progress opens with no heatmap day selected and shows all-time timer charts. Click a day
to inspect it; click it again or choose All days to return to all-time. The activity-period
selector only controls the summary totals and does not restrict these all-time charts.
The full-history timeline retains endpoints and each bucket’s fastest, slowest and DNF
results in a bounded overview; averages are sampled at those points. All statistics and
the histogram use every matching solve. Day charts retain the latest-200 display limit.

## Reviewing timer solves

After stopping, **Review solve** opens the just-finished result without advancing the
scramble. History rows show time, cube, date, and penalty/note indicators; select any
row to open the same details dialog. Cube assignment and penalties update that solve
only. Deleted cubes retain their historical names and can be replaced or cleared.

The dialog shows the exact saved scramble, with **Copy scramble** and an on-demand
interactive **Preview cube**. The preview shows the scrambled starting state, not a
replay of the solve. Closing it releases the player and returns focus to the opener.

Optional plain-text notes save as you type (up to 5,000 characters), including line
breaks. A failed save keeps the draft in the current tab, reports the failure in the
dialog, and offers **Retry saving**. Keep that tab open or export a backup before
reloading. Delete is confirmed inside details; failed deletion preserves the solve.
The Backspace shortcut still deletes the just-finished solve outside dialogs and
editable controls.

Solve storage remains `last-layer.solves.v1` with an optional string `notes`; older
records and training backups without notes remain compatible. New full training
backups include notes, and import validation rejects invalid or oversized notes
before replacing data. Learning-only backups continue to leave solves untouched.

Progress's **Individual solves** list and graph dots open the full review inline below
the graph toolbar, with Previous/Next and retained Show/Hide cube state. Timer uses the
native review dialog. Notes and penalty badges appear in the history rows. Edits and
deletions refresh the graph, statistics and cube filter; a deleted final solve or cube
reassignment outside the filter returns focus to the graph filter.

`SolveHistoryRow.svelte` owns the shared declarative row presentation;
`SolveDetails.svelte` owns shared review fields, and `SolveDialog.svelte` hosts them for Timer. Their actions and persistence
remain in `main.js`.
