# Testing and performance

## Run checks

```sh
npm ci
npx playwright install chromium firefox
npm run check            # Svelte diagnostics and TypeScript component props
npm test                 # Node domain, oracle, rendering, cache, and import tests
npm run test:e2e         # Build, then isolated production-browser tests
npm run test:build       # Build and compressed asset budgets
npm run verify           # Svelte diagnostics + unit + production E2E + build budgets; same as CI
npm run test:coverage    # Coverage report to help find gaps, not a quality score
npm run benchmark       # Repeatable rendering CPU measurements
```

On a fresh Linux machine, Playwright may need system libraries: `npx playwright install --with-deps chromium firefox`. CI installs these explicitly. Browser downloads are development setup only; the app makes no runtime third-party requests.

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
- **3D playback:** public API modes must pair the correct controls with the correct starting state (solved for notation, case for algorithms, final scramble for preview); preserve stable instance IDs and reject unknown modes. Check algorithm and notation pacing independently. Icon controls retain accessible labels, keyboard focus, and 44px targets in narrow portrait and short landscape. Mobile geometry bounds checks exclude only internal surfaces deliberately removed from layout. Assert geometry element identity survives turns/reset and inner surfaces render only at moving-layer boundaries. check rendered stickers and animated layer endpoints against the independent oracle, including CSS coordinate handedness for face/wide/slice/rotation moves. Every catalog variant must play from its case to solved. Cover pause/resume, seek, cumulative notation repeats without resetting between turns, notation-only play/pause controls, variant changes, reduced motion, keyboard viewing, mobile layout, and player cleanup on navigation.
- **Notation reference:** compare all 54 rendered net stickers with the independent cube oracle for every move and suffix. Browser checks cover selection, keyboard focus, mobile controls, themes, and unchanged learning progress.
- **Case setup disclosure:** every OLL/PLL popup exposes a verified catalog setup. Browser checks cover keyboard show/hide, stable moves across variant/status changes, reset on reopening, unchanged progress, and readable portrait/landscape bounds in both themes.
- **Case actions and chunks:** compact status toggles expose their pressed state and keep labels on one line at laptop, narrow portrait, and short landscape sizes. Chunk names appear on hover/focus, dismiss with Escape, and stay visible inline after clicking without a duplicate tooltip.
- **Known algorithms:** marks are reversible and variant-specific, round-trip through validated backups, reject version-1 learning backups, and never fabricate practice history.
- **Two-look learning:** preserve catalog IDs and variant history. Verify both stages against the independent cube engine across every stored setup; show the same complete case diagram in full and two-look modes. Diagram cache keys include every rendering option.
- **Practice setup simplification:** combine adjacent face turns and cascading cancellations, including the final layer adjustment. Verify all catalog setups across colors, sides, and adjustments retain their exact independent-oracle sticker states and have no consecutive turns of the same face.
- **Filtered practice:** the active library filters, including learned/unlearned status for the chosen variant, define the picker scope. Test individual and mixed-state group selection, empty-selection disabling, selected versus all pools, two-look groups, cancellation/focus restoration, and narrow/landscape bounds. Next/skip and grading stay in the chosen pool without modifying the learning set.
- **Learning layout:** the main diagram opens the current case by click or keyboard and restores focus on close. Keep the study body vertically centered and compact on laptops; check populated home cards and thumbnail strips at 320px and short landscape widths.
- **Settings and library:** verify theme/arrow persistence, collapsed groups, custom popup keyboard navigation, Escape/outside dismissal, and narrow layouts.
- **Cube tracking:** validate cube records and default references, preserve legacy unassigned solves, and round-trip stable cube IDs. Browser tests cover default/override selection, disabled changes while timing, retroactive reassignment and clearing, renaming, deletion/cancellation, default fallback, retained history names, reloads, unreadable storage, and populated portrait/landscape layouts.
- **Solve timer:** inject a monotonic clock and seeded scramble choices for unit tests. Browser tests advance Playwright's clock instead of sleeping. Check the 500ms Space hold/release threshold, early release and interrupted holds, Space repeats/editable targets, ignored Space presses after stopping, Tab generating a new scramble in ready or stopped states without starting or recording a solve, while preserving normal control/Shift+Tab focus navigation, hidden running scramble, frozen hundredths after stop, pointer hold/release (mouse and touch), early release, cancellation and release outside the button, no duplicate New scramble after finishing, and navigation cleanup. Check hidden-timer preference persistence (off by default), no live time in the DOM while hidden, final-time reveal, minute boundaries, seconds-only preference persistence, saved solve history, trimmed recent averages, deletion, and preservation of unreadable storage. Scramble previews must match all 54 oracle stickers for the current scramble, refresh after a new scramble, restore opener focus, and leave the timer/progress unchanged; the preview button is disabled during a solve. Decorative start lights on both sides of the readout show red at rest and while holding, yellow when armed, and green while running (including with the timer hidden); browser checks read the rendered lamp colours and their placement in narrow portrait and short landscape. Scrambles are random face turns, not WCA random states.

## Performance measurements

`npm run benchmark` uses fixed catalog/progress fixtures, three warmups, and twenty timed samples. It reports median and p95 for HTML generation in Node with 0 and 100,000 attempts. It includes index construction and rendering, but excludes network, DOM insertion, layout, and paint. Compare on the same machine/runtime; do not turn these timings into flaky CI thresholds.

`node scripts/benchmark-cube.mjs` measures 6,000 playback frames at a simulated 60 Hz (100 seconds of continuous R turns), including metadata reads and scene HTML generation at move boundaries. It uses three warmups and twenty samples. On Node 26.11.1, Linux x64, Intel i9-11900H, avoiding full cube snapshots on each frame reduced median CPU time from 43.34 ms to 14.17 ms (p95 49.00 ms to 18.05 ms). This excludes browser DOM work, layout, and paint. The browser mutation regression separately requires frames to change only the moving layer, with no DOM writes during the end-of-turn hold; these operation checks avoid timing thresholds.

Playback metadata reads omit cube data; full snapshots retain independent copies of stickers and their vectors. The mounted player retains its last drawn values and current layer element, clearing those references on remount. Controls and camera updates follow state changes instead of animation frames.

The initial optimization measured warmed medians on Node 26 on the development machine:

| Workload                            |   Before |   After |
| ----------------------------------- | -------: | ------: |
| OLL library, no history             | 10.71 ms | 0.61 ms |
| PLL library with arrows, no history |  5.11 ms | 0.29 ms |
| Progress, 100,000 attempts          | 98.91 ms | 8.81 ms |

Cached SVGs are immutable strings in a bounded LRU. Progress summaries are rebuilt from the current history once per render, so imports, new attempts, and variant choices cannot reuse stale history. Tests assert behavior and work counts, not these particular speeds.

Build budgets allow **136 KiB gzip JavaScript** and **12 KiB gzip CSS** (see the Svelte migration measurements below). They count all emitted JS/CSS, catch accidental large runtime dependencies, and check relative asset paths. Increase a budget only for a justified feature with the measured delta documented; do not adjust it merely because a check failed.

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

Learning storage intentionally starts fresh at version 2, with no version-1 migration. Browser checks verify old storage is ignored and bad imports preserve current data. Version-2 backups round-trip courses, resume positions, reviews, recognition links, method attribution, and existing learning data. Import validation rejects incompatible references, invalid methods and variants, duplicate links, and unknown lessons.

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
