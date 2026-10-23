# Testing and performance

## Run checks

```sh
npm ci
npm run dev               # Frontend preview: sample training and fake account
npm run dev:guest         # Guest frontend with normal browser storage, no backend
npm run dev:backend       # Real local Auth/database + frontend (Docker required)
npm run test:integration  # Disposable real backend: SQL + Auth/Data API + sync
npm run test:integration:e2e # Above plus Chromium against the real backend
npx playwright install chromium firefox
npm run check            # Svelte diagnostics and TypeScript component props
npm test                 # Node domain, oracle, rendering, cache, and import tests
npm run test:e2e         # Build, then isolated production-browser tests
npm run test:build       # Build and compressed asset budgets
npm run verify           # Svelte diagnostics + unit + mocked browser flows + build budgets
npm run test:coverage    # Coverage report to help find gaps, not a quality score
npm run benchmark       # Repeatable rendering CPU measurements
```

On a fresh Linux machine, Playwright may need system libraries: `npx playwright install --with-deps chromium firefox`. CI installs these explicitly. Browser downloads are development setup only. Guest use makes no runtime third-party requests; optional account use talks to the configured Supabase project.

Playwright owns port **4174** by default (`LAST_LAYER_TEST_PORT=4175 npm run verify` selects another isolated port), refuses to reuse an existing server, and stops its server afterward. The external-request guard uses the configured `baseURL` so a separate local run can use an isolated port without allowing third-party requests. Each test gets an isolated browser context; tests never touch the user's preview on 4173 or personal progress. Projects cover desktop Chromium, mobile Chromium, and desktop Firefox. No retries are enabled; CI rejects focused tests. Reports, traces, screenshots, and test backup files are ignored by Git. CI uploads failure artifacts for seven days.

The Node coverage report covers modules loaded by the unit suite; it does not include browser-only event handlers. Use the E2E suite for those paths rather than treating the Node aggregate as whole-app coverage.

Use `npx playwright show-report playwright-report/port-4174` for the browser report (substitute the chosen test port for isolated runs). Reports and test artifacts are separated by port. Reproduce a specific browser test with `npm run test:e2e -- --project=firefox --grep 'test name'`. Use `node --test tests/progress.test.js` for a focused domain check.

## Contracts worth protecting

| Area                      | Required evidence                                                                                                                                                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Moves and cube state      | All 54 stickers against an independent cubing.js oracle; exact geometry/color counts; rotations, slices, wide moves, suffixes, inverse/order identities; reproducible mixed sequences.                                                        |
| Catalog and hidden setups | Stable unique IDs, valid variants, 57 distinct OLL/21 PLL cases, every stored setup, all six last-layer colors, four side remaps, and four layer adjustments; F2L and the intended case preserved after bringing the chosen layer to the top. |
| PLL arrows                | Known permutation directions/destinations; ignore incidental AUF; variants and arrows-off/OLL behavior; no hidden-stage leaks.                                                                                                                |
| Progress                  | Distinct local dates, hint/effort reset, rehearsal exclusion, variant isolation, chronological imports, invalid real calendar dates and timestamps, malformed records, size limits, no mutation of input.                                     |
| Browser state             | Selection/variants/settings survive reload; valid backup round-trip and explicit replacement; invalid/cancelled imports preserve data; storage errors are recoverable.                                                                        |
| Interaction               | Hidden practice → reveal → grading, hint cannot earn confidence, skip does not log, themes follow explicit/system choice, dialog keyboard focus, group/search behavior and mobile overflow.                                                   |
| Performance               | Cached output equals uncached output; bounded cache, complete keys, eviction, fresh history snapshots, and a deterministic single-scan check for large histories.                                                                             |

Add a regression when fixing a bug. Demonstrate it fails on the old behavior, then passes with the fix. Assertions should describe the user/domain contract, not private implementation details. A test that uses the same wrong move table as the code is not an independent oracle. Keep hand-authored known permutations and the external engine checks.

Avoid giant snapshots and cosmetic wording assertions. Use exact labels only where they identify a user action. Prefer state transitions, persisted data, accessible controls, piece states, and error recovery. Async browser assertions must wait for observable state, not `waitForTimeout`.

A test failure is evidence to investigate. Do not remove the check, loosen its expected result, increase retries, or add an arbitrary timeout to conceal a regression. Change expectations only when the intended behavior genuinely changes, and explain why.

## Additional feature contracts

- **Guides:** Visual cross lessons have hand-specified edge destinations at every frame, pair preservation/insertion checks, a verified shorter alternative, and oracle-checked stickers for both diagram viewpoints. Cross/F2L setups and every solution step are checked against cubing.js. Assert solved cross edges, target pairs, preserved slots, and a still-unsolved last layer, independently of inverse identities. Browser checks cover Guides navigation, lazy mounting (including Notation), one example at a time, step/reset, close and navigation cleanup, focus, unchanged progress, and 320px portrait / 667×375 landscape screenshots in both themes.

- **Mobile UI:** `tests/e2e/mobile.spec.js` exercises 320px portrait and short landscape layouts. Check navigation, touch target dimensions, input text size, cube/content and dialog bounds, reachable dropdown options, and complete practice/timer/notation interactions. Case edits preserve dialog scroll position; deleting solves keeps history expanded and moves focus to a remaining delete control or its summary. Inspect screenshots in both themes after layout changes; document width alone can miss clipped dialog content. Browser emulation cannot verify physical iOS keyboard, safe-area, or gesture behavior; keep browser zoom enabled and follow up on devices when available.

- **Shared 2D case previews:** all learning, library, progress, revealed-practice, detail, and picker previews use `case-diagram.js` / `diagram.js`. Keep visible captions absent and accessible orientation labels present; check narrow portrait and short landscape bounds in both themes.

- **PLL arrow diagrams:** all G-perm variants retain directed corner/edge three-cycles across AUFs; independent fixtures check exact destinations, other PLL shapes stay unchanged, and each arrow has its own outline beneath its shaft and heads.
- **Cube colors:** the standard BOY scheme in the app’s yellow-up, green-front grip has orange-right, red-left, blue-back, and white-down. Browser regressions assert literal displayed center colors in the 3D player and unfolded net, verify physical center positions/normals from CSS matrices, and capture narrow portrait / short landscape in both themes.
- **Solid 3D cubies:** opaque square body faces meet at the full cubie boundary; only colored stickers have rounded corners. Check actual CSS matrices and face extents against neighboring cubie spacing, including OLL 6's initial, partial wide-turn, completed, scrubbed-back, and reset states. Preserve oracle sticker checks, retained geometry, phone/landscape screenshots in both themes, and camera reset without altering playback position.
- **3D playback:** public API modes must pair the correct controls with the correct starting state (solved for notation, case for algorithms, final scramble for preview); preserve stable instance IDs and reject unknown modes. Check algorithm and notation pacing independently. Icon controls retain accessible labels, keyboard focus, and 44px targets in narrow portrait and short landscape. Mobile geometry bounds checks exclude only internal surfaces deliberately removed from layout. Assert geometry element identity survives turns/reset and inner surfaces render only at moving-layer boundaries. check rendered stickers and animated layer endpoints against the independent oracle, including CSS coordinate handedness for face/wide/slice/rotation moves. Every catalog variant must play from its case to solved. Cover pause/resume, seek, cumulative notation repeats without resetting between turns, notation-only play/pause controls, variant changes, reduced motion, keyboard viewing, mobile layout, and player cleanup on navigation.
- **Notation reference:** compare all 54 rendered net stickers with the independent cube oracle for every move and suffix. Browser checks cover selection, keyboard focus, mobile controls, themes, and unchanged learning progress.
- **Case setup disclosure:** every OLL/PLL popup exposes a verified catalog setup. Browser checks cover keyboard show/hide, stable moves across variant/status changes, reset on reopening, unchanged progress, and readable portrait/landscape bounds in both themes.
- **Case actions and chunks:** compact status toggles expose their pressed state and keep labels on one line at laptop, narrow portrait, and short landscape sizes. Chunk names appear on hover/focus, dismiss with Escape, and stay visible inline after clicking without a duplicate tooltip.
- **Known algorithms:** marks are reversible and variant-specific, round-trip through validated backups, migrate version-1 learning backups only on explicit import, and never fabricate practice history.
- **Bulk case properties:** `tests/bulk-properties.test.js` covers simultaneous explicit Known/learning-set updates, mixed starting values, current variants, shared/legacy known marks, unchanged fields, retained confidence/history, immutable candidates and validated backup compatibility. `tests/views.test.js` checks selected/mixed checkbox semantics alongside case details; its bulk regression fails against the pre-feature view. `tests/e2e/bulk-properties.spec.js` covers keyboard/group/all-matching selection, collapsed groups, filter/method/section/navigation scope changes, cancellation, detail focus, simultaneous add/remove, learned-filter disappearance, reload persistence, CFOP two-look defaults and single-write save failure/retry. Its mobile matrix uses real actions and bounds plus screenshots at 320×720 and 667×375 in both themes. Run browser checks only after approval.
- **Two-look learning:** preserve catalog IDs and variant history. Verify both stages against the independent cube engine across every stored setup; show the same complete case diagram in full and two-look modes. Diagram cache keys include every rendering option.
- **Practice setup simplification:** combine adjacent face turns and cascading cancellations, including the final layer adjustment. Verify all catalog setups across colors, sides, and adjustments retain their exact independent-oracle sticker states and have no consecutive turns of the same face.
- **Filtered practice:** the active library filters, including learned/unlearned status for the chosen variant, define the picker scope. Test individual and mixed-state group selection, empty-selection disabling, selected versus all pools, two-look groups, cancellation/focus restoration, and narrow/landscape bounds. Next/skip and grading stay in the chosen pool without modifying the learning set.
- **Learning layout:** the main diagram opens the current case by click or keyboard and restores focus on close. Keep the study body vertically centered and compact on laptops; check populated home cards and thumbnail strips at 320px and short landscape widths.
- **Settings and library:** verify theme/arrow persistence, collapsed groups, custom popup keyboard navigation, Escape/outside dismissal, and narrow layouts.
- **Cube tracking:** validate cube records and default references, preserve legacy unassigned solves, and round-trip stable cube IDs. Browser tests cover default/override selection, disabled changes while timing, retroactive reassignment and clearing, renaming, deletion/cancellation, default fallback, retained history names, reloads, unreadable storage, and populated portrait/landscape layouts.
- **Solve timer:** inject a monotonic clock and seeded scramble choices for unit tests. Browser tests advance Playwright's clock instead of sleeping. Check the 500ms Space hold/release threshold, early release and interrupted holds, Space repeats/editable targets, ignored Space presses after stopping, Tab generating a new scramble in ready or stopped states without starting or recording a solve, while preserving normal control/Shift+Tab focus navigation, hidden running scramble, frozen hundredths after stop, pointer hold/release (mouse and touch), early release, cancellation and release outside the button, no duplicate New scramble after finishing, and navigation cleanup. Check hidden-timer preference persistence (off by default), no live time in the DOM while hidden, final-time reveal, minute boundaries, seconds-only preference persistence, saved solve history, trimmed recent averages, deletion, and preservation of unreadable storage. Scramble previews must match all 54 oracle stickers for the current scramble, refresh after a new scramble, restore opener focus, and leave the timer/progress unchanged; the preview button is disabled during a solve. Decorative start lights on both sides of the readout show red at rest and while holding, yellow when armed, and green while running (including with the timer hidden); browser checks read the rendered lamp colours and their placement in narrow portrait and short landscape. Scrambles are random face turns, not WCA random states.

Learning progress and timer solve history share calendar/timestamp validation in `src/dates.js`. Storage regressions reject impossible dates and timestamps without an explicit timezone while retaining valid leap days and offset-qualified timestamps unchanged.

## Performance measurements

`npm run benchmark` uses fixed catalog/progress fixtures, three warmups, and twenty timed samples. It reports median and p95 for HTML generation in Node with 0 and 100,000 attempts, plus Timer with 0 and 10,000 solves. It includes index construction and rendering, but excludes network, DOM insertion, layout, and paint. Compare on the same machine/runtime; do not turn these timings into flaky CI thresholds.

`node scripts/benchmark-cube.mjs` measures 6,000 playback frames at a simulated 60 Hz (100 seconds of continuous R turns), including metadata reads and scene HTML generation at move boundaries. It uses three warmups and twenty samples. On Node 26.11.1, Linux x64, Intel i9-11900H, avoiding full cube snapshots on each frame reduced median CPU time from 43.34 ms to 14.17 ms (p95 49.00 ms to 18.05 ms). This excludes browser DOM work, layout, and paint. The browser mutation regression separately requires frames to change only the moving layer, with no DOM writes during the end-of-turn hold; these operation checks avoid timing thresholds.

Playback metadata reads omit cube data; full snapshots retain independent copies of stickers and their vectors. The mounted player retains its last drawn values and current layer element, clearing those references on remount. Controls and camera updates follow state changes instead of animation frames.

The initial optimization measured warmed medians on Node 26 on the development machine:

| Workload                            |   Before |   After |
| ----------------------------------- | -------: | ------: |
| OLL library, no history             | 10.71 ms | 0.61 ms |
| PLL library with arrows, no history |  5.11 ms | 0.29 ms |
| Progress, 100,000 attempts          | 98.91 ms | 8.81 ms |

Cached SVGs are immutable strings in a bounded LRU. Progress summaries are rebuilt from the current history once per render, so imports, new attempts, and variant choices cannot reuse stale history. Tests assert behavior and work counts, not these particular speeds.

Build budgets allow **192 KiB gzip JavaScript** and **18 KiB gzip CSS** (see the owner-approved revisions below). They count all emitted JS/CSS, catch accidental large runtime dependencies, and check relative asset paths. These are maintenance guardrails, not browser responsiveness targets. Increase a budget only for a reviewed scope change with the measured delta documented.

## Agent instruction files

`AGENTS.md` is the shared source of repository practices. `CLAUDE.md` imports it using Claude Code's documented import syntax. See the [Codex repository-instruction guide](https://learn.chatgpt.com/docs/agent-configuration/agents-md) and [Claude Code memory/import guide](https://code.claude.com/docs/en/memory). Keep one set of rules to prevent drift.

### Retained cube rendering and pacing

The renderer retains the 26 cubies and 156 face elements across turns, reassigning colors and layer membership. Internal faces are hidden unless exposed by the current turn: a face/wide turn renders 71 surfaces instead of 156; a slice renders 88, and a static cube or whole-cube rotation renders 54. Browser regressions preserve element identity through stepping/reset and compare repeated slice moves with the independent oracle. Algorithm turns last 650 ms with a 100 ms hold; notation retains its 450 ms hold.

A six-second headless Chromium T-perm sample on Linux x64 / i9-11900H measured frame-interval p95 of 50 ms before and 33.4 ms after retaining elements and hiding internal surfaces; medians were 16.7 ms in both samples. These short samples are diagnostic, not a guaranteed FPS improvement, and exclude the later pacing change. No long tasks were observed.

The Node 26.11.1 geometry fixture (`node scripts/benchmark-cube.mjs`, 6,000 simulated frames, three warmups/twenty samples) measured median 13.14 → 15.19 ms and p95 15.60 → 21.03 ms: extra surface metadata raises full HTML-generation cost. This fixture deliberately regenerates HTML at boundaries; the browser no longer does so. It does not measure browser paint. Before/after `npm run benchmark` medians (ms) were OLL/PLL/progress 0.51/0.22/0.38 → 0.69/0.43/0.63 with empty history, and 6.10/6.25/6.21 → 7.69/7.58/6.80 with 100,000 attempts. These page workloads were unchanged; concurrent machine load limits timing comparisons. Structural browser assertions, not timing thresholds, guard the optimization.

### Guides and full F2L reference

The expanded reference intentionally raises the JavaScript budget from 40 to 48 KiB. A comparison build without the guide content/view measured about 39.7 KiB gzip; the full 41-case catalog, local static previews, and lesson player measured about 43.4 KiB after removing the superseded tutorial content. This is a transfer-size allowance for the requested content, not a browser memory limit. CSS remains capped at 10 KiB. Three-dimensional players are created only on request, one guide example at a time; removing or replacing them releases previous player references.

### Courses and shared recognition

Course tests cover shared F2L references/review marks, module-scoped practice, matching-variant OLL/PLL recognition carryover, partial-pattern confidence separation, shared known marks (including legacy two-look marks), legacy directional links, variant isolation, chronological resets, and activity counted once. The reference status function and indexed summaries must agree; preserve the single-history-scan regression. Blindfolded remains unavailable/coming soon. Ortega reference tests exhaustively cover OLL corner orientation with all bottom permutations and explicit independent PBL fixtures; reading grants no algorithm mastery.

Learning storage starts fresh at version 2; the old storage key remains untouched. Explicit file imports accept version-1 learning backups and validate them before converting to version 2, preserving local dates, variants, and known marks. Browser checks verify old storage is ignored and bad imports preserve current data. Version-2 backups round-trip courses, resume positions, reviews, recognition links, method attribution, and existing learning data. Import validation rejects incompatible references, invalid methods and variants, duplicate links, and unknown lessons.

`tests/e2e/courses.spec.js` exercises the four-section CFOP workspace, Two-look / Full selection, T/Y and line-OLL known marks appearing in both views, unmarking, reload/resume, focus restoration, shared F2L reviews, unavailable future courses, backups, hidden answers, hint grading, and scoped practice returning to the workspace. It captures light/dark screenshots and checks actual content bounds and touch targets at 320×720 portrait and 667×375 landscape. Screenshots are saved under the runner’s isolated `test-results/port-4174/` output directories. Run `npm run verify` before delivery.

## Display colors, recognition quiz, and timer penalties

`tests/display-quiz.test.js` checks all six display schemes against cubing.js rotations, immutable inputs, color-sensitive diagram caches, validated preferences, and all 21 PLL questions across four AUFs, four viewpoints, and six colors. No two different PLL cases may have the same six visible stickers and center references. All stickers are also compared with the independent engine. Injected choices make question/choice sampling deterministic.

`tests/e2e/display-quiz.spec.js` covers fixed/random display preferences, stable colors through study actions, matching 2D/3D colors, unchanged yellow timer previews, four arrow-diagram answers with neutral side stickers, hidden quiz results, keyboard focus, isolated scoring, and phone/landscape light/dark bounds/screenshots. `tests/e2e/timer-penalties.spec.js` covers reversible penalties, raw elapsed preservation, persistence, history editing/focus, disabled editing while running, and one versus two DNF averages. Unit checks reject malformed penalties and preserve old solve records.

The Vite production plugin losslessly packs setup move tokens; source JSON, case IDs, variant indices, and every setup remain unchanged. `tests/catalog-pack.test.js` imports the generated module and compares the entire catalog, and rejects unsupported tokens. No dependencies or budget increases are needed.

Measured on Linux x64, Node 26.11.1, Intel i9-11900H: the production setup encoding reduced the feature build from 50,711 to 48,692 bytes gzip JS at the time of comparison. Final features remain within the unchanged 48 KiB JS / 10 KiB CSS limits. `npm run benchmark` before/after medians for OLL/PLL/progress were 0.95/0.42/0.78 → 1.03/0.41/0.79 ms with no attempts, and 60.77/61.16/63.08 → 62.76/62.38/62.73 ms with 100,000 attempts. These are Node HTML-generation workloads, not browser paint or loading measurements; concurrent test activity limits timing comparisons. Packing changes production transfer representation, not rendering logic.

## Algorithm starting grips and PLL completion

`tests/algorithm-normalization.test.js` rejects leading `y` regrips in the last-layer catalog and checks concrete Ua/Aa sticker states and an OLL 5 orientation pattern against independent physical setups. It verifies internal rotations and finger-trick grouping survive the offline cleanup. Case IDs, variant indices, and stored setups remain unchanged.

`tests/pll-completion.test.js` uses hand-authored Z/Ra/Rb cubie permutations to show that the old sequence stops one turn short and the listed final adjustment solves exactly. Every PLL variant is also checked against cubing.js for actual moved-piece counts, exact arrow destinations, fixed G-perm blocks, F2L preservation, all 54 preview stickers, and the solved ending grip. Algorithms ending with the original top on another face include the adjustment in that ending grip.

`tests/e2e/algorithm-alignment.spec.js` checks Ua variant selection/reload without a leading regrip, Z’s stationary corners, visible final turns and complete playback for Z/Ra/Rb, default-on arrows with a persistent opt-out, and narrow portrait/short landscape screenshots. Randomized hidden practice still varies the cube’s AUF; fixed catalog algorithms cannot remove arbitrary physical alignment choices.

## Settings modal and URL routes

`tests/routes.test.js` covers page/CFOP/reference route round trips, method defaults, settings overlays, and malformed/unknown route recovery. `tests/e2e/routes-settings.spec.js` covers direct links, reloads, Back/Forward, CFOP method/section restoration, practice preservation while using settings, temporary-practice fallback, keyboard focus/trapping, backdrop/Escape dismissal, preferences, and Cubes navigation. Inspect the light/dark modal screenshots at 320×720 and 667×375; existing timer/storage/guide checks also exercise the modal. Tests explicitly close Settings before navigating its inert background.

The build-time catalog encoder now stores common case field names once and packs each case as a row, joining encoded setups with a delimiter. Runtime decoding restores the exact original JSON, including every algorithm, variant position and setup. Heterogeneous fields fail the build rather than silently changing metadata. The full-catalog round-trip test covers the production representation. This keeps routing within the unchanged 48 KiB JS / 10 KiB CSS limits.

On Linux x64 / Node 26.11.1 / Intel i9-11900H, `npm run benchmark` before/after medians for OLL/PLL/progress were 0.75/0.41/0.60 → 0.68/0.28/0.52 ms with no attempts and 52.14/55.16/51.15 → 48.27/45.68/46.66 ms with 100,000 attempts. These measure Node HTML generation, not browser paint or startup decoding; concurrent test load limits timing comparisons. The routing build before packing measured 49,385 bytes gzip JS; the packed build is checked against the existing budget.

## Command palette

`tests/e2e/commands.spec.js` exercises Escape and Ctrl+K opening, word filtering, keyboard selection, empty results, close/focus restoration, Settings priority, hidden-practice preservation, and running-timer protection. It checks dialog and control bounds and captures light/dark screenshots at 320×720 and 667×375 using the isolated server.

The production catalog encoder now packs algorithm move tokens and uses a bounded dictionary of repeated setup pairs. Setup strings are reversed during encoding to group common suffixes and restored during decoding. Source JSON, case order, variant indices, and every setup remain unchanged. The complete catalog round-trip regression compares the decoded production module with the original JSON. This creates room for the palette within the unchanged 48 KiB JS / 10 KiB CSS budgets; no runtime dependencies were added.

On Linux x64 / Node 26.11.1 / Intel i9-11900H, the baseline and palette `npm run benchmark` medians (OLL/PLL/progress, milliseconds) were 0.92/0.42/0.74 → 0.79/0.42/0.77 with no attempts and 62.19/66.83/73.94 → 61.69/60.63/71.15 with 100,000 attempts. These measure Node HTML generation, not browser paint. Concurrent verification and benchmark activity limits timing comparisons; no rendering speedup is claimed. A separate precompiled production-decoder sample (five warmups, twenty samples) measured median 2.51 → 8.65 ms and p95 3.55 → 12.39 ms. The dictionary trades a small one-time decoding cost for transfer size; it does not run during rendering or practice.

The production assets grow from 49,032 → 49,146 bytes gzip JavaScript and 10,186 → 10,238 bytes gzip CSS for the palette plus packing changes. Both budgets remain unchanged.

## Svelte 5 and shadcn-svelte migration

Requires Node 22.18+ for synchronous module hooks and TypeScript tooling. `npm run check`
runs Svelte diagnostics. `scripts/svelte-loader.mjs` compiles the same `.svelte` components
for Node rendering tests and the benchmark; it is test tooling, never a runtime dependency.
`scripts/render-views.mjs` only adapts render arguments and normalizes Svelte markers,
inter-tag whitespace, and button metadata for the existing markup assertions. There is
no second implementation of the old views. SVGs and cube mechanics retain their independent
oracle coverage. Svelte may leave apostrophes and `>` literal inside double-quoted attributes;
the tests require the correctly escaped quote/`<` boundaries and identical values.

The requested framework/component migration deliberately changes the transfer-size contract.
The baseline measured **49,146 bytes gzip JS / 10,238 bytes gzip CSS**; the migrated build
measures **130,841 bytes gzip JS / 11,172 bytes gzip CSS** (127.8 / 10.9 KiB).
The new **136 KiB JS / 12 KiB CSS** limits cover Svelte 5, Bits UI's focus/floating controls,
shared shadcn components and compiled page templates, with modest maintenance headroom.
They still count all emitted JS/CSS. Cubing.js, the compiler and test tools remain outside
the runtime bundle, and browser tests reject third-party runtime requests.

The controller publishes fresh UI boundaries without cloning or iterating the full attempt
history. `tests/view-state.test.js` guards this using a 100,000-entry proxy that throws on
iteration, and checks stale scalar state across solves, practice, preferences and quiz answers.
The existing index operation-count test still enforces one history scan. Cube event handlers
are aborted before retained nodes are rebound. Timer animation uses a separate reactive text
value rather than rewriting text owned by a Svelte template.

`tests/e2e/svelte-migration.spec.js` checks hidden-practice cells and absent answers, checkbox
names after state changes, neutral checkbox touch targets, preserved setups, cube form resets, literal hostile cube names,
and portrait/landscape bounds/screenshots. Import tests now check that a valid retry clears
an earlier error. Existing selector, tooltip and modal tests protect Escape priority and focus.
Long cube names shrink within the timer selector, and floating menus retain viewport padding
in Firefox as well as Chromium; the existing cube/history mobile flows cover both cases.
New trigger tests render hostile labels through Svelte, rather than only testing an escaping helper.

On Linux x64, Node 26.11.1, Intel i9-11900H, the standard three-warmup/twenty-sample benchmark
measured baseline → Svelte median milliseconds (OLL / PLL / progress): **0.72 / 0.33 / 0.55 →
2.82 / 1.41 / 1.82** with empty history, and **52.16 / 48.19 / 50.38 → 48.68 / 47.89 / 47.79**
with 100,000 attempts. These are Node HTML-generation/SSR workloads, including index construction
and test serialization normalization; they exclude browser layout, paint and interaction latency.
Concurrent browser tests limit timing comparisons; no browser speedup is claimed.

## Timer start-light port

[PR #2](https://github.com/nicbat/rubiks-site/pull/2) is ported into `Timer.svelte` and
`Navigation.svelte`: decorative red/yellow/green lamps use the existing timer/hold
state, and Timer navigation uses the stopwatch icon. Its browser assertions are
retained in `timer.spec.js`, including rendered colours, cancelled holds, hidden
time, both themes, and lamp placement. `timer-lights.spec.js` also checks ten-minute
results in minutes and seconds-only formats at 320×568 and 667×375. The command
palette remains `CommandPalette.svelte`; its keyboard/focus tests run with these changes.

The palette now uses the actual shadcn-svelte Command primitives. Command's accessible
combobox/listbox contract intentionally replaces focusable result buttons: arrow keys
change the selected option and `aria-activedescendant` while focus stays in the search
field. `commands.spec.js` checks that contract, word filtering, Enter activation, empty
results, Escape priority, focus restoration, and narrow touch navigation in both themes.
The custom controller arrow-key implementation has been removed; routes and shortcuts
are unchanged. No new dependency or build-budget increase is needed.

Command appearance regressions cover 320×720, 667×375, and 1280×900 in both themes.
They require the default compact layout (512px maximum width, search at the top,
300px maximum results height and 14px item text), preserve 44px touch targets, and
exercise the last command through the scrolling list. Screenshots cover the default compact layout with the shared site theme; rendered
background, text color and font must match the Backup dialog in both themes.
Keyboard/ARIA assertions continue to protect behavior.

## Post-migration performance and component cleanup

Progress indexing resolves each attempt's case/variant once and builds combined
recognition summaries only for explicitly linked variants. It retains one history
scan and independent snapshots. The operation-count regression and seeded
mixed-objective reference comparisons cover rehearsals, recognition resets,
variant isolation, transfer edits, and unchanged older snapshots.

On Linux x64, Node 26.11.1, Intel i9-11900H, `npm run benchmark` (three warmups,
twenty samples) measured these before → after results for 100,000 attempts:

| Workload    |   Median (ms) |      p95 (ms) |
| ----------- | ------------: | ------------: |
| OLL library | 66.88 → 11.30 | 76.66 → 14.38 |
| PLL library | 63.70 → 10.08 | 66.68 → 12.92 |
| Progress    | 65.79 → 10.74 | 75.44 → 18.17 |

Empty-history medians were approximately unchanged: OLL/PLL/progress
3.35/1.87/2.27 → 3.37/1.80/2.29 ms. These are Node Svelte HTML-generation
workloads including index construction and test normalization, excluding browser
layout, paint, and interaction latency. Timing is diagnostic; deterministic
operation counts guard the optimization.

Controller route serialization, filter resets, quiz initialization, and scramble
resets now share local helpers. Existing route, quiz, filter, and timer browser
contracts remain unchanged.

Theme choices use a shared shadcn-style RadioGroup backed by Bits UI, with Svelte 5
reactive subscription to the single theme preference. Shared semantic color tokens
also style the command palette. The theme-radio browser regressions cover keyboard
selection, cross-tab updates and removal, system-theme changes, remounting, and
44px control bounds at 320×720 and 667×375 in both themes. The backup file chooser
uses the shared Input; existing import regressions retain cancellation, validation,
and retry coverage.

The shared Button uses `tailwind-variants/lite`: variant selection supplies semantic
classes and the existing `cn()` helper performs the final Tailwind merge. This
avoids bundling a second merge implementation (about 3.44 kB gzip in the comparison
build). The combined changes measure 136,226 bytes gzip JavaScript and 12,224 bytes
CSS, within the unchanged 136 KiB / 12 KiB budgets; no dependency was added.

## Local tracking dashboard and full backups

`tests/dashboard.test.js` covers calendar boundaries, shared-objective activity counted once,
inclusive date filters, cube filters, chronological solve windows, penalties/DNFs, and the
200-point display limit without discarding older personal bests. The existing progress-index
operation test still guards one attempt-history scan. `tests/training-backup.test.js` checks
stable IDs, legacy backups, deleted cube references, dates, validation, every failing restore
write, commit failure, and recovery after an interrupted rollback.

`tests/e2e/tracking.spec.js` exercises calendar selection, case details, cube filters, stable
IDs after reload, full export/import, cancellation, corrupt files, failed writes and retry.
It checks real control bounds and 44px target heights and captures the Learning and Solves
views at 320×720 and 667×375 in light/dark themes on the isolated Playwright server.

The dashboard deliberately extends the transfer-size allowance from 136 to **140 KiB gzip
JavaScript**, and 12 to **13 KiB gzip CSS**. Compared with the existing shared-component build
(136,226 bytes JS / 12,224 bytes CSS), the first tracking build measured approximately
140,990 bytes JS / 12,740 bytes CSS: about 4.7 KiB / 0.5 KiB added for the calendar, case map,
SVG trends, daily summaries, stable IDs, and recoverable full backups. No dependency was
added; chart geometry and statistics are local modules. These are compressed build sizes,
not browser rendering measurements. No performance speedup is claimed.

### Activity heatmap iteration

The Progress heatmap shows the latest 365 days in compact week columns with month
labels and Mon/Wed/Fri markers, independent of the summary period. The requested
GitHub/Monkeytype density intentionally replaces 44px day targets with 12px squares;
this is a chart-only exception. Day buttons retain accessible date/count labels,
native hover titles, keyboard focus and Enter/Space activation. Other buttons keep
44px targets. The grid scrolls horizontally on phones, without page overflow.
Tests cover exact date coverage, weekday alignment, year/leap boundaries, month
labels, padding, range independence, day selection, compact geometry and phone scroll.
Browser regressions have been updated; ask before running browser tests or full verify
in this interactive workflow. Fast static/domain checks can run during iteration.

Selected-day regressions check adjacent-day exclusion, penalty-aware means, raw solving
time, all-DNF means, result ordering, and individual cube/scramble details. Browser
checks exercise independent case-section collapse and keyboard expansion.

Daily chart regressions cover histogram bin boundaries, equal times, all-DNF input,
interpolated quartiles, cube filtering, +2 penalties, line breaks at DNF, and full-history
statistics despite the 200-point timeline limit. Updated browser scenarios cover point
selection, Previous/Next controls, filtering and empty selections; run these only after
browser-test approval. Chart points also have keyboard links and touch-sized Previous/Next
alternatives. No chart library or runtime dependency is added.

### Legacy file imports and day deletion

Backup tests cover version-1 conversion, immutable inputs, chronology, invalid legacy records, and learning-only replacement without changing solves/cubes. Dashboard tests cover deletion by local day, legacy solve timezone fallback, retained marks/adjacent dates, and recalculated confidence. Tracking browser tests cover legacy preview/cancellation/retry, day-delete confirmation and cancellation, failed-write rollback, reload persistence, cube-filter independence, keyboard focus, and confirmation bounds/screenshots at 320×720 and 667×375 in both themes.

The working dashboard build measured 144,200 bytes gzip JavaScript before the legacy-import/day-delete UI and 144,793 bytes afterward (+593 bytes). Both exceed the unchanged 140 KiB (143,360-byte) budget; the budget was not raised. CSS measured 13,048 → 13,155 bytes, within the 13 KiB allowance. These are compressed asset sizes, not rendering-performance measurements; no dependency was added.

Heatmap selection now starts empty and toggles off. Browser regressions cover repeated
day clicks, All days, period independence, old solves beyond the heatmap’s year, and
absence of day deletion controls in all-time mode. Domain regressions verify the
bounded overview retains first/last solves, extremes and DNF while full-history
statistics and histogram counts remain intact. Browser execution is pending approval.

### Solve review, saved previews, and notes

`solve-details.spec.js` covers optional post-solve review, compact history, themed
cube reassignment without changing the active timer cube, retired cube choices,
exact historical preview stickers against cubing.js, lazy player cleanup, note
persistence/removal, literal text, copy success/failure, backup export/restore,
malformed imports, failed-save drafts/retry, failed deletion, and focus restoration.
Typing Space, Backspace, or Tab in notes does not trigger timer shortcuts. Existing
cube, penalty, timer, and mobile regressions use the shared review dialog; deletion
now requires confirmation there, while Backspace retains its existing timer behavior.

Phone screenshots cover 320×720 and 667×375, in light/dark themes with reduced motion.
They exercise long cube names, real option bounds, keyboard cube viewing, notes,
confirmation/cancellation, reachable close controls, and internal dialog scrolling.
`solve-history.test.js` validates the optional 5,000-character plain-text notes field,
legacy compatibility, immutable inputs, Unicode and line breaks. The regression was
confirmed to fail with the old validator that discards notes. Full training backup
unit tests verify note round-trips and reject malformed notes before restore.

The generic mobile target check now also enforces the already documented heatmap
exception: only `.activity-cell[data-action="activity-day"]` uses exactly 12×12px;
all ordinary controls still require at least 44×44px. The new post-solve Review
button uses a 48px target so Firefox's fractional geometry remains above 44px.

On Node 26.11.1 / Linux x64, the starting workspace build measured 145,313 bytes gzip
JavaScript and 13,155 bytes gzip CSS. The solve-review build measures 146,924 bytes
JavaScript (+1,611) and 13,286 bytes CSS (+131). No dependency or budget was added.
The unchanged JavaScript limit is 143,360 bytes (140 KiB), so the build budget gate
already failed before this work and still fails; this is transfer size, not a
browser rendering or performance measurement.

Progress review regressions cover both shared lists showing the same solve, focus
restored to the correct list, note/penalty changes reflected in both rows, cube
reassignment removing a solve from an active filter, direct chart-point review,
SVG-point focus restoration, and deletion recalculating the filtered results.
Daily chart review retains selection and navigation. Deleting a selected day's only
solve returns focus to the day heading when its solve section disappears. The phone
matrix also exercises shared Progress reviews and long names/notes in both portrait
and short landscape, capturing `progress-review.png` and `progress-history.png`.

### Bulk OLL/PLL properties

Bulk selection uses the shared Checkbox's mixed state and the existing Select/Label/Button
primitives. Selection is temporary and scoped to the current library filters; collapsing
groups does not change scope. `src/bulk-properties.js` creates an immutable progress
candidate, preserving history and unrelated variants. The controller commits both property
changes with one storage write and publishes the candidate only after a successful save.
Case-detail edits prune selections that leave the active learned filter and closing those
details returns focus to Done when the original card has disappeared.

On Node 26.11.1 / Linux x64, the starting workspace measured 146,924 bytes gzip JavaScript
and 13,286 bytes CSS. Bulk editing measures 148,660 bytes JavaScript (+1,736) and 13,525
bytes CSS (+239). Production compilation succeeds; the unchanged 140 KiB JS / 13 KiB CSS
budgets are exceeded. JavaScript already exceeded its budget before this feature; CSS now
also exceeds its budget. No dependency or budget increase was added. These are compressed
transfer sizes, not browser performance measurements. Non-browser tests and Svelte checks
pass; browser verification and screenshot inspection remain pending approval.

### Shared chart styling

Timeline and distribution use the source-owned shadcn Chart Container/Style/context
and a shared Legend, with semantic chart tokens following the active theme.
`tests/charts.test.js` checks distinct style scopes, legend output, DNF selection,
review focus anchors and all-DNF distribution fallback. Existing dashboard tests
retain the geometry/statistics coverage. Tracking browser checks require both
shared containers and legends and include their actual phone content bounds in
light/dark portrait and short landscape. SVG plotting and the compact heatmap
remain specialized; no LayerChart dependency or tooltip has been added.
Approved browser verification on 2026-10-19 passed all 21 tracking checks plus
6 targeted Progress/chart solve-review checks across desktop Chromium, mobile
Chromium and Firefox, using isolated ports 4193 and 4194. The first run exposed
an overly broad history-row selector that also counted the five new legend items;
it now scopes to the individual-results list and still requires 12 solves.
Light/dark screenshots at 320×720 and 667×375 were inspected, including both
chart legends and the Solves view. All checks retained the console-error, failed
asset and external-request guards. This was targeted verification, not full
`npm run verify`. Reports and screenshots are under `playwright-report/port-4193`,
`playwright-report/port-4194` and `test-results/port-4193`.

### Optional test data

`tests/test-data.test.js` validates the complete seeded training envelope, 18-month
coverage, meaningful solve-time improvement, penalties, notes, cube assignments,
all learning statuses, variants and rehearsals. Local-date/chronology assertions
span DST, leap days and near-midnight anchors. Storage tests exercise ordinary
saves, full/learning imports, day replacements, unavailable personal storage,
retained sandbox edits and regeneration. Personal bytes, including a corrupt
restore journal, must remain untouched in test mode.

`tests/e2e/test-data.spec.js` covers mode switching, checkbox focus, shared
Timer/Progress data, note edits, new solves, export filenames, day deletion,
imports, reloads, and restoration of personal data. Its phone matrix exercises
the toggle and populated charts at 320×720 and 667×375 in both themes, checks
actual label/chart/banner bounds, and captures screenshots. Run and inspect
these only after browser-test approval. No dependency or budget is added.

The shared Checkbox binds checked and mixed state to the underlying primitive so
its indicator and accessible state stay synchronized. The test-data browser
regression checks box clicks, label clicks, Space, unrelated setting updates and
reload persistence together with the saved mode. Browser execution remains deferred.

On Node 26.11.1 / Linux x64, the shared-chart build measures 149,851 bytes gzip
JavaScript and 13,664 bytes gzip CSS. Production compilation, Svelte diagnostics,
formatting and all 35 test files pass. The unchanged 143,360-byte JS and 13,312-byte
CSS limits remain exceeded (both were already exceeded in the documented bulk-edit
build). These are compressed asset sizes, not browser performance measurements.

### Pre-account baseline verification

On 2026-10-19, the approved full browser run on isolated port 4195 completed
with 480 passing checks and three failures: the same test-data timer scenario
in desktop Chromium, mobile Chromium, and Firefox. No retries were used.
Bulk-edit, test-data settings/populated Progress, solve-review, and tracking
screenshots were inspected in light/dark at 320×720 and 667×375; Firefox bulk
screenshots were also inspected. No visual defects were found in those images.
The report is `playwright-report/port-4195/index.html`; screenshots and failure
traces are under `test-results/port-4195`.

The failing scenario exhausted its 30-second deadline while advancing the timer
and interacting with an expanded history of roughly 9,800 solves. Traces show
the timer clock itself updates independently of the history, but the full list
makes other interactions expensive. The test now fast-forwards elapsed time
instead of running every animation frame, and additionally checks the new
solve's recorded elapsed time. Browser verification of that correction is pending
approval; the three failures are not yet resolved by a passing run.

Fast baseline checks passed: all 36 Node test files, Svelte diagnostics with zero
errors/warnings, changed-file formatting, and `git diff --check`. Production
compilation succeeded, but `npm run test:build` failed its unchanged budgets:
151,834 bytes gzip JavaScript versus 143,360 allowed, and 13,664 bytes CSS versus
13,312 allowed. The script stops on the JavaScript assertion; both asset totals
were measured separately. No dependency or budget was changed.

### Bounded timer history

Timer renders the latest 50 solves initially and adds 50 older rows per Show more.
The controller preserves the visible limit across review, edits, deletion, and new
solves; leaving Timer, successful backup replacement, or switching test data resets
it. Pagination is disabled while timing. Keyboard focus stays on Show more while
it exists, then moves to the oldest newly exposed solve after the final batch.
The total count, statistics, persisted data, and exports retain the entire history.

`tests/views.test.js` covers empty/exact/partial batches, full totals, newest rows,
disabled pagination while running, and a proxy that rejects reading older records
to render the latest batch. It failed against the old component, which rendered
125 rows instead of 50. `tests/e2e/timer-history.spec.js` covers paging order,
full-history exports, recent statistics, editing/deleting older rows and opener
focus, retained limits during timing, reset on navigation/import/dataset switches,
and real phone control bounds/screenshots at 320×720 and 667×375 in both themes.
Browser execution and screenshot inspection of this iteration remain pending approval.

On Linux x64, Node 26.11.1, Intel i9-11900H, `npm run benchmark` with three warmups
and twenty samples measured Timer with 10,000 solves at median 167.15 → 1.19 ms
and p95 200.67 → 6.02 ms. Empty-history medians were 0.39 → 0.41 ms. These are
Node HTML-generation measurements, excluding browser layout, paint, and interaction
latency. Existing library/Progress workloads remain in the same benchmark; no
browser responsiveness claim follows from these numbers.

After this change, all 238 Node checks pass, Svelte reports zero errors/warnings,
and production compilation succeeds. Assets measure 152,091 bytes gzip JavaScript
(+257 bytes from the preceding baseline) and 13,664 bytes CSS (unchanged). Both
remain above the existing budgets; no dependency or budget increase was added.

Approved follow-up browser verification on isolated port 4196 passed all 150
checks across desktop Chromium, mobile Chromium, and Firefox: `timer-history`,
`test-data`, `timer`, `solve-details`, and `mobile`. This includes the previously
timed-out test-data scenario in all three browsers. The report is
`playwright-report/port-4196/index.html`; artifacts are under `test-results/port-4196`.
All eight Chromium pagination screenshots were inspected across both themes and
phone sizes, plus Firefox portrait/final-page and landscape/Show-more samples.
Bounds, keyboard focus, and readability passed inspection. Screenshot review
identified that Show more used the plain Button default; it now selects the shared
secondary variant. That cosmetic correction was made after the tested production
build and awaits screenshot reinspection at the next approved browser step.

### Owner-approved bundle baseline revision

On 2026-10-19, the owner explicitly approved revising the size limits for the
expanded local app. The prior 140 KiB JS / 13 KiB CSS allowance was set for the
first tracking dashboard build (approximately 140,990 / 12,740 bytes gzip).
Subsequent features include daily charts and shared chart styling, solve reviews
and notes, legacy imports and day deletion, bulk case edits, isolated test data,
and bounded timer history. The current build is 152,102 bytes gzip JavaScript and
13,664 bytes CSS: 11,112 / 924 bytes above that first dashboard measurement.

The revised limits are 160 KiB JavaScript (163,840 bytes) and 14 KiB CSS (14,336
bytes), leaving 11,738 / 672 bytes of maintenance headroom, approximately 7.7% /
4.9% above the measured assets. This is an explicit scope/budget revision, not a
size optimization or a rendering-performance claim. All emitted chunks still
count, and the external-asset and static-subdirectory checks remain intact.
Shared component behavior, full Tailwind caller overrides, and application
features are preserved. Future account/sync dependencies require a separate size
review; these limits do not preapprove their footprint.

`npm run test:build` passes with the revised limits on Node 26.11.1 / Linux x64.
No dependency, lockfile, or runtime helper was changed in this budget revision.
The preceding 150-check browser run remains the latest browser verification;
the secondary Show more styling correction still awaits screenshot reinspection.

### Owner-approved CSS revision for the retro hardware redesign

On 2026-10-20, the owner explicitly approved raising the CSS limit from 14 KiB
to 18 KiB for the site-wide visual redesign. The redesign replaces hard-coded
colors with light/dark design tokens in `src/tokens.css`, adds self-hosted
display, mono, and LCD fonts (font files are not counted by the CSS budget),
framed and chamfered panels, raised/recessed controls, hover glow and the
cycling holographic edge, the library filter console, settings switchgear
(toggle switches and the theme selector), and the cube player's keys and fader.

Measured with `npm run build` on Node 25.2.1 / macOS arm64, counting every
emitted asset as `scripts/check-build.mjs` does:

| Build                           | JS gzip       | CSS gzip     |
| ------------------------------- | ------------- | ------------ |
| Before the redesign (`8a1f655`) | 153,225 bytes | 13,863 bytes |
| Redesign                        | 153,274 bytes | 17,553 bytes |
| Change                          | +49 bytes     | +3,690 bytes |

The revised CSS limit is 18 KiB (18,432 bytes), leaving 879 bytes (about 5%)
of headroom above the measured build. The JavaScript limit is unchanged at
160 KiB. A dead-selector scan found only seven unused classes (a few hundred
bytes), so the growth is the new styling itself rather than leftovers. This is
an explicit scope/budget revision, not a size optimization or a rendering
performance claim; all emitted chunks still count, and the external-asset and
static-subdirectory checks remain intact.

### Keven merge and CI regression repairs

The 2026-10-20 Keven branch removes the machine-local `svelte-text-editor`
dependency and Vite plugin; clean installs no longer require a sibling checkout.
The failing Actions run for `4dc6b1d` passed all domain checks but failed 21
browser scenarios in three specs. Their expectations predated the Svelte migration:

- Dropdown keyboard navigation retains focus on the trigger and identifies the
  highlighted option with `aria-activedescendant`. The regression checks both
  focus and the active option before and after End, plus Enter selection.
- Display-color checks read the visible `::after` sticker separately from its
  opaque plastic face, retaining literal expected colors.
- Occurrence tests close the retained disclosure with Space before switching
  sections, assert keyboard open/close state and visible attribution, and seed
  version-2 progress for hidden practice. Version-1 backups remain importable;
  version-1 objects are not valid version-2 browser storage fixtures.

On Node 26.11.1 / Linux x64, clean `npm ci`, all 37 Node test files, Svelte
diagnostics (zero errors/warnings), formatting, and production bundle checks pass.
The merged build measures 153,283 bytes gzip JavaScript and 17,624 bytes CSS,
within the branch's existing 160 KiB / 18 KiB limits. No further budget change
was made. Browser verification of these test repairs is pending approval.

The redesign's chamfer clip creates a stacking context on each panel. Panels
containing an expanded shared Select now rise above sibling cards, allowing
dropdown content to overlap them while staying inside its native dialog when
applicable. `library-console.spec.js` covers CFOP and the standalone library in
both themes at laptop, 320×720 and 667×375 sizes. It hit-tests visible options,
explicitly requires menu/card overlap on laptop, selects a group, restores focus,
and captures the open menus. Browser execution remains deferred at the owner's
request.

### Supabase accounts and sync

`npm run test:e2e` now runs `scripts/test-e2e.mjs`: it builds with an explicit fake,
same-origin Supabase URL and public test key, then forwards arguments to Playwright.
Every account scenario intercepts Auth and Data API requests in its isolated context;
no real emails, accounts, keys, or hosted data are used. Existing tests retain their
external-request, asset-failure and console-error guards. The normal production
build still uses actual configured public values. Direct `playwright test` requires
a preceding test build; prefer the npm command.

`tests/cloud-sync.test.js` covers optional/public configuration, privileged-key
rejection, guest/account/test isolation, complete backup validation, stable
fingerprints, reloads, independent offline edits, explicit conflict resolution,
changed remote revisions, stale writes, unavailable storage/network, malformed
cloud data, cancelled responses, and edits during upload. Existing journal tests
continue to exercise rollback of partial restores.

The logistics review added regressions for automatic cloud restore into a pristine
account cache, intentionally saved empty copies, deletion after prior sync, device
writes during the initial cloud read, and damaged sync metadata recovery. Missing
training-storage keys establish a pristine cache; empty history alone does not.
Malformed metadata loses the baseline without granting permission to overwrite a
different copy. Unavailable storage still blocks sync.

`tests/training-merge.test.js` exercises independent offline history additions,
deletions, per-field edits, true edit/delete conflicts, progress sets, ID collisions,
legacy histories without IDs, cube references and input immutability. Sync-engine
regressions cover merges across reloads, conflicting notes alongside independent
solves, stale writes, and local saves while a merged upload is in flight. The old
baseline must remain until the merged copy can be installed locally; otherwise
remote additions could be misidentified as later deletions.

`tests/profiles.test.js` covers username normalization and validation, server
uniqueness responses, identity changes, anonymous lookups, visibility updates,
required setup and profile rendering without email/notes. Routes include People
and canonical username page links. `supabase/tests/profiles.sql` verifies required
setup before training writes, private defaults, unique/reserved names, ownership,
immutable usernames, anonymous/public reads and revocation of public access. Both
SQL regressions run in transactions and roll back their fixture accounts.

`tests/sync-queue.test.js` covers immediate post-commit starts, same-turn coalescing,
serial uploads, changes during an upload, continued real interactions beyond the
automatic retry limit, bounded stale-write retries, and cancellation. Network
errors and genuine conflicts never trigger a polling loop.

Profile checks include bounded display names/bios/goals, aggregate validation,
plain-text rendering, profile-only updates, deletion API arguments, and local
cache removal scoped to one account. `supabase/tests/profile-details.sql` checks
server summaries against known solve sets, +2/DNF handling, deduplicated known
marks, backfill without revision changes, private/public/opt-in access, revocation,
typed deletion confirmation, caller-only cascades, idempotent deletion retries,
and stale-token attempts to recreate an account. All fixture users are disposable
and every SQL regression rolls back.

`tests/e2e/accounts.spec.js` covers email-code focus/sign-in, default email-link URL cleanup and fresh-cache restore, expired-link recovery, existing-copy conflict
choices, account reload, guest preservation/sign-out, demo isolation, malformed
downloads, and light/dark account conflict controls at 320×720 and 667×375. Browser
execution and screenshot inspection require approval under AGENTS.md.
The logistics-review browser regression updates have not been run; browser checks
were deferred at the owner's request.
The username, profile visibility, guest-transfer and People flows now have browser
regressions at 320×720 and 667×375, also pending browser verification.
The same narrow layouts now cover profile editing, opt-in statistics, copy links,
account exports, typed deletion confirmation and preservation of guest data.
They also cover reconnecting after incomplete profile loading and uploading a
saved training change without pressing Sync now. Hidden form-submission inputs
are excluded from visible-control geometry checks.
After the review fixes, all 267 Node tests passed, Svelte diagnostics reported zero
errors/warnings, and `npm run test:build` passed at 179.5 KiB JavaScript / 17.3 KiB
CSS gzip. Formatting and `git diff --check` also passed.

After required usernames and three-way sync were added, all 284 Node tests passed,
Svelte diagnostics reported zero errors/warnings, and `npm run test:build` passed
at 184.0 KiB JavaScript / 17.4 KiB CSS gzip. Both SQL regressions passed in an
isolated Supabase PostgreSQL 17.6.1 container with no network or host port; fixtures
were rolled back and the container removed. The reviewed profiles migration was
also applied to the hosted project. The frontend remains undeployed; current
browser checks remain deferred. An additional seeded merge regression passed 100
reproducible independent-edit scenarios in both device orders, with validation of
the resulting backups and preservation of input copies.

The immediate-upload/profile-details pass completed all 296 Node tests, including
queue cancellation and retry regressions. Svelte diagnostics reported zero
errors/warnings, and the production build passed at 186.8 KiB JavaScript / 17.6 KiB
CSS gzip. The three rollback-only SQL regressions passed in an isolated Supabase
PostgreSQL 17.6.1 container. The profile-details migration was applied to the
hosted project. Browser regressions remain unrun at the owner's request; the
frontend has not been pushed or deployed.

### Local backend and integration workflow

Use `npm run dev` for ordinary frontend changes: fixtures and the fake account,
without Docker or real services. `npm run dev:guest` starts with guest storage and
no cloud configuration. Both modes ignore hosted Supabase env configuration.
`npm run dev:backend` starts real local Supabase, migrates it and serves the app
on 127.0.0.1:5175 with test data disabled. Sign in with a locally captured code;
there is no authentication bypass. `learner@example.test` owns `local_learner`
(private), `friend@example.test` owns `local_friend` (public with stats), and
`private@example.test` owns `local_private`. Each has 30 recent synthetic solves.
New emails exercise signup and required username setup. Fixtures contain no
production data or reusable passwords. For an empty browser use a separate browser
profile or clear only the development origin's storage.

The pinned Supabase CLI is installed by `npm ci`. Docker must be running for the
backend commands. `backend:start` starts/migrates without a frontend;
`backend:stop` preserves local data; `backend:reset` deliberately resets this
worktree's development database and reruns migrations plus `supabase/seed.sql`.
Resetting the backend does not reset browser caches: clear the development
origin's storage when you want a fully fresh start. After changing auth config,
stop/start the backend. Schema changes belong in a new migration.

`scripts/local-supabase.mjs` copies versioned config/migrations/templates/seeds to
ignored work directories and assigns a project ID hashed from the work directory.
The persistent dev stack uses API/DB/Studio/Mailpit ports 55321–55324; disposable
integration uses 56321–56324 and an independently generated project ID. The scripts
never link these work directories to a hosted project or use remote reset flags.
Other local projects and preview servers are left alone. If another worktree is
using these ports, set `LAST_LAYER_BACKEND_PORT_BASE=57320` or
`LAST_LAYER_INTEGRATION_PORT_BASE=58320`; these reserve base through base+6. The
backend frontend stays on 5175 and browser tests own 4176. Stop an old dev stack
before changing its port base. CLI status includes server-only keys internally;
only the public API origin and anon key enter frontend/test configuration. Never
publish the local stack or copy its credentials to a hosted environment.

`npm run test:integration` starts a fresh local Supabase stack, runs every
rollback-only SQL regression before seeding, then seeds and runs
`tests/integration/backend.test.js`. It uses the production Auth client, profile
and training API adapters, sync engine and save queue against real Auth/PostgREST/
PostgreSQL services. It checks delivered OTP signup, seeded logins and backup
validation, session refresh/restoration, unique/required usernames, ownership and
anonymous permissions, stale revisions, independent device caches, offline edits,
reconnection, conflicting edits, public stats opt-in/revocation and account
cascade deletion. The offline case blocks transport on one device; the connected
requests use the actual backend. Users created by tests live only in the disposable
stack. The runner removes its containers and volumes in `finally`, including on
failure, and never resets the persistent dev database.

`npm run test:integration:e2e` additionally builds `.integration-dist` with the
local public configuration and runs `playwright.integration.config.js` on 4176.
`tests/integration-browser/accounts.spec.js` uses actual email codes and backend
responses for signup/setup, persisted profile edits, public/private visibility,
statistics, deletion, two browser contexts and offline cube edits. It reuses a
verified session in memory for the second device; it does not write token files.
No API responses are mocked. The ordinary `test:e2e` suite remains the larger,
fast, predictable mocked UI suite, including narrow layouts. Browser runs remain
subject to the repository approval/defer rules.

CI has independent frontend and backend jobs. The frontend job runs `verify`;
the backend job runs `test:integration:e2e` and uploads failure traces. Neither
requires hosted Supabase credentials. Hosted email delivery/redirects and deployment
configuration still need a staging check against an isolated hosted backend before
release. This local setup does not provision a Vercel/Supabase staging environment.
A Vercel preview must use staging/preview Supabase variables to isolate backend
writes; a different frontend URL alone does not isolate the database.

The workflow follows Supabase's [local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows),
[seed data guidance](https://supabase.com/docs/guides/local-development/seeding-your-database)
and [local email testing](https://supabase.com/docs/guides/local-development/cli/testing-and-linting).

This workflow pass completed all 305 unit tests, six real-backend scenarios
(seven Node tests including their parent), and all three SQL regression scripts.
Svelte diagnostics reported zero errors/warnings, formatting passed, and the
production build passed at 189.2 KiB JavaScript / 17.6 KiB CSS gzip. HTTP-only
development smoke checks confirmed demo mode excludes hosted configuration and
backend mode selects the local API. The local reset command recreated the seeded
account and 30 solves, verified through actual email-code login and API reads.
Disposable test containers/volumes were removed, and the persistent dev stack was
stopped with its data preserved. Browser suites are written and configured in CI
but remain unrun locally at the owner's request. No hosted configuration was
changed, and the frontend has not been pushed or deployed.

### Manual account previews with test data

`npm run dev` starts the Vite development server with the demo enabled by default.
`npm run dev:demo` remains an alias. `?demo=0` overrides the default for a tab, and
`?demo=1` enables the demo in other development modes. These defaults and query
overrides are development-only. Settings → Enable test data provides the same fake
account in ordinary dev/preview builds. No keys, real login or backend is needed.
The initial account is `demo_learner`; public lookup uses `demo_friend`, while
`demo_private` and missing names show the same unavailable screen. Demo account
state presets cover sign-in (code 123456), username setup, loading/error, offline
and conflict screens. Profile edits, sharing controls, imports/exports and deletion
stay local; Reset demo account restores account setup. Training edits remain until
reload, as before. Exiting test mode restores the real account/session and data.

`tests/demo-account.test.js` covers fake auth/setup, profile edits and visibility,
statistics, failure states, conflict resolution, immutable returned objects, demo
deletion, preservation of personal storage and enabled shared account controls.
`tests/e2e/demo-account.spec.js` adds narrow portrait/short landscape checks in both
themes plus complete sign-in/setup/failure/deletion flows. It counts Auth/Data API
requests and expects zero, checks stored-data canaries, and exercises public/private
lookup and exiting test mode. Existing account regressions now expect interactive
fake controls and verify real profile drafts are restored after demo edits. These
browser updates have not been run; browser verification remains deferred.

The fake-account pass completed all 301 Node tests and Svelte diagnostics with
zero errors/warnings. The production build passed at 189.2 KiB JavaScript /
17.6 KiB CSS gzip, within the existing budgets. Browser verification remains
deferred; the frontend has not been pushed or deployed.

`supabase/tests/training-sync.sql` is rollback-only SQL for a disposable migrated
Supabase database. Run with `psql -v ON_ERROR_STOP=1 -f ...`. It checks JWT ownership,
first insert, revision increments, duplicate/stale writes, payload checks, invisible
other-user rows, forged ownership, denied deletion, and denied anonymous reads/RPC.
It has been run against an isolated Supabase PostgreSQL 17.6.1 container; this does
not establish that the hosted migration or email templates have been configured.

The official Supabase Auth SDK is lazy-loaded only in configured builds. All
emitted chunks count toward the owner-approved 192 KiB JavaScript / 18 KiB CSS
budgets. The owner approved the JavaScript scope revision on 2026-10-20 after size
review; the CSS allowance is unchanged.

### Owner-approved account/sync JavaScript budget

On 2026-10-20, the owner explicitly approved 192 KiB gzip JavaScript for optional
accounts and sync, from the prior 160 KiB. Before this feature, the documented
merged local app measured 153,283 bytes JavaScript / 17,624 bytes CSS. The first
implementation with the full Supabase SDK measured 217,009 bytes JavaScript.
Replacing it with the official `@supabase/auth-js` SDK and two authenticated Data
API calls measured 183,473 bytes JavaScript / 17,725 bytes CSS on Node 26.11.1,
Linux x64. The 196,608-byte allowance leaves 13,135 bytes (about 7%) above that
measurement. Every emitted chunk counts, including the lazy auth chunk. The CSS
budget remains 18 KiB. This is a reviewed feature allowance, not a rendering or
performance claim. Guest use still works without account configuration.

### Supabase integration verification

On 2026-10-20, the approved full verification on isolated port 4204 passed all
260 Node checks and Svelte diagnostics (zero errors/warnings). The browser run
finished with 604 of 606 passing checks. Two Firefox shared-diagram scenarios
exhausted their 30-second deadline after more than 1,100 trace actions. Their
helper now batches per-SVG observations into one browser evaluation per group,
retaining every bounds, caption and exact 21-sticker assertion. The six affected
checks passed across Chromium, mobile Chromium and Firefox on port 4205; Firefox
completed in 6.6 and 6.9 seconds. No timeout, retry, or assertion was weakened.
The full command was not repeated after this test-only correction.

All 27 focused account checks also passed on port 4203, including default sign-in
links, codes, expired-link recovery, URL-token removal, guest/account isolation,
conflicts, full imports, failed writes, reloads, and test-data isolation. Account
sign-in/conflict screenshots were inspected in both themes at narrow portrait and
short landscape, including Chromium, Firefox and mobile Chromium samples. Reports
and screenshots remain in `playwright-report/port-4203`, `port-4204`, `port-4205`
and the matching `test-results` directories, all ignored by Git.

A subsequent production build using the connected Vercel public configuration
passed `npm run test:build`: 179.4 KiB gzip JavaScript / 17.3 KiB CSS, within the
approved 192 / 18 KiB limits. Formatting and `git diff --check` pass. The unrelated
Notation dropdown regression was corrected to select its actual native `M` value
while retaining selected-value, preview and player assertions.

Migration `20261020000000` is applied and tracked on the hosted Last Layer project.
Read-only hosted inspection confirmed RLS enabled, invoker RPC security, denied
anonymous reads/writes and authenticated RPC access. The isolated PostgreSQL
ownership/stale-write tests passed before applying it. The production site URL is
`https://cube.nicbat.com`; the default email templates and existing auth security
settings were retained. Supabase rejected template customization with this free
project's default provider, so the app supports its existing sign-in links.
Public signup still requires custom SMTP; no real sign-in emails or user training
records were created during verification. The app changes remain in the separate
`feat/supabase-sync` worktree pending review and deployment.
