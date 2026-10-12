# Last Layer

A small, static CFOP learning app with Cross/F2L guides and OLL/PLL practice. No account, backend, database, or paid service is required. Progress lives in the current browser.

## Run locally

Requires Node.js 22.12+ (tested with Node 26).

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

`npm run verify` runs domain/oracle tests, production browser tests (desktop Chromium, mobile Chromium, Firefox), and compressed bundle checks. `npm run benchmark` measures repeatable rendering CPU workloads. CI runs the same verification and uploads browser failure traces.

## What you can do

- Open Guides for concise Cross examples and all 41 standard F2L cases grouped for lookup. Open one example at a time to load its 3D cube; closing it or leaving releases the player. F2L cards keep their grid layout while the selected case opens in a separate preview below its group, keeping your scroll position while you browse cases. Cards show static pair diagrams and algorithms; their case numbers follow the CubeSkills sheet, not other sites. Examples start paused and do not affect learning progress.
- Explore face, wide, slice, and rotation moves in Guides → Notation, with labeled before/after nets and a CSS 3D cube shown by default. Play/pause controls continuous turns: each repetition starts from the previous result.
- Open a case for a 3D algorithm player in a side panel (stacked on phones), with touch-sized icon controls for play/pause and stepping, clickable move highlighting, and drag or arrow-key viewing. Home and practice screens keep their compact diagrams. Reduced motion disables notation autoplay; playback stays local.
- Show setup moves in any case popup to build that case from a solved cube. Start yellow-up and green-front, then use U turns or rotate the cube to match the diagram.
- Choose any of the 57 OLL and 21 PLL cases for your learning set.
- Switch to 2-look OLL/PLL for a smaller, step-by-step curriculum.
- Collapse library groups and practice any filtered set without changing your learning set.
- Mark algorithms you already know, independently for each variant.
- Preview the current timer scramble with the cube icon beside Scramble; drag or use arrow keys to inspect its final state.
- Use the scramble timer with Space or touch controls; times show minutes and two-digit seconds to two decimal places, with a seconds-only setting.
- Browse OLL and PLL by group, view top-down diagrams, and toggle PLL permutation arrows.
- Switch algorithm variants; hover or focus common move chunks for a tooltip, or click to keep their names visible.
- Click the main learning diagram to open its case, or rehearse a chosen algorithm throughout the day.
- Practice hidden cases from your selected set, using varied setup sequences and optional random last-layer color.
- Set a light, dark, or system theme and PLL arrows on the Settings page.
- Record recognition and execution results, and review local progress.
- Export/import JSON backups to transfer progress between devices manually.

Each person can use their own browser. There is no automatic synchronization or shared progress view in this version. Clearing browser storage deletes progress, so export a backup periodically. Changing the site's origin (including its port) uses a different browser storage area.

## Practice rules

Start every hidden setup from a solved cube, yellow on top and green in front. In this grip, the standard color scheme has orange on the right, red on the left, blue at the back, and white underneath. The 2D diagrams and 3D players use this same scheme. Follow the setup while keeping the cube out of view, then bring it out to recognize and solve. The case and diagram remain hidden until you finish or ask for help. Hint use requires the “Needed help” result.

Hidden practice always randomizes the final layer adjustment. Adjacent turns of the same face are combined and cancellations removed, so setup length can vary. With **Randomize last-layer color** enabled, the setup places the case on any of the six colors, with a random orientation around that face. Face turns are remapped, including the final adjustment; no cube rotations are shown. Start yellow-up and green-front as usual, then find the last layer and bring it to the top to solve. Choices are independent, so colors can repeat. The setting and PLL arrow visibility are saved on the device; an existing enabled side-color preference carries over to the new setting.

A reveal shows the canonical yellow-top diagram for your chosen algorithm, not necessarily the colors or orientation produced by the setup. Match the pattern regardless of color, with the last layer on top; adjust that face or rotate the cube as needed. OLL setups may leave a PLL case after orientation; finish solving the whole cube before the next setup.

Imported attempts are validated for real calendar dates and timezone-qualified timestamps, then ordered chronologically before replacing any progress.

A case becomes **Confident** after confident recognition and execution on three distinct local calendar dates since the most recent difficult recognition attempt. “Needed help” and “Solved with effort” reset that sequence. Rehearsals add to practice totals but do not earn confident days. Each algorithm variant has its own history.

## Two-look learning and timer

Choose **2-look OLL / PLL** in the library. OLL has three yellow-cross cases followed by seven corner-orientation cases; PLL has two corner-position cases followed by four edge-position cases. Diagrams show the complete case, including pieces not involved in the current learning step. Skip a step when its pieces are already solved. Existing case IDs and variant histories are shared with the full library; saved algorithm choices take priority over two-look recommendations.

**Practice these cases** opens a temporary case picker using the current section, method, group, search, and learning-status filters. Click individual diagrams or a group heading to select cases, then choose **Practice selected**. **Practice all** starts every case shown in the picker, regardless of the selection. Closing the picker discards the selection without changing your learning set. Learned includes “Already known” and earned “Confident” status for the currently chosen variant. With all learning statuses shown, the library and each group display learned/total counts. Skipping and recording a result stay within that set. Collapsing a group only changes its display; it does not remove cases from the practice set.

**Learning set** and **Known** in a case's detail are toggles; a checkmark and highlighted button indicate an active status. **Known** records a reversible declaration for the chosen variant. It does not add practice attempts or confident days. Old version-1 backups remain compatible; new backups may include `known`, a mapping from case IDs to arrays of known variant indices.

The Cubes page keeps a simple list of names and optional descriptions. The first cube becomes the default; **Make default** changes it. The timer starts with that default after a reload and keeps your chosen cube during the session. Choose a cube before starting a solve, or change **Cube for this solve** in Solve history afterward. Renaming a cube updates its name in history. Delete removes a cube from the list and future choices while retaining its name on past solves. Deleting the default selects the next remaining cube, or no cube if the list is empty. Older solves remain “Not specified” until assigned. Cube records and timer history are stored locally and are not included in learning backups.

The Timer page generates 20 random face turns locally. These are not competition random-state scrambles. Hold Space for half a second until the green “Release to start” cue, then release to begin. Tap Space to stop. A short early release does not start a solve. The scramble hides while running. After finishing, press Tab or tap Next scramble before starting another solve; further Space presses leave the result unchanged. Tab keeps its normal focus behavior in other controls, and Shift+Tab always moves focus backward. Hold the start button for the same half-second, then release on green; tap Stop to finish. New scramble (Tab) refreshes the scramble before starting; Next scramble (Tab) advances after a solve. Navigating away stops the timer. Completed solves save locally with their date and scramble. Open Solve history to review or delete them; Backspace deletes the just-finished solve. Recent averages of 5 and 12 exclude one fastest and one slowest time, and each window shows its best solve. Turn off Show minutes on timer in Settings for total seconds. Enable Hide timer while solving to conceal the running time until you stop; this is off by default. Navigating away freezes an unfinished timer without saving it as a completed solve. Timer history is separate from learning progress and is not included in learning backups.

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

PLL arrows show piece destinations up to a final U adjustment. G perms show a three-corner cycle and a three-edge cycle with the matching two-piece block fixed. Light outlines separate overlapping arrows.

Diagrams are computed directly from the selected algorithm, including slice moves, wide moves, and rotations. All variants for a case must solve the same case (up to cube/top-layer orientation). Run `npm test` after catalog changes; it checks every variant and every setup. The parser supports standard space-separated move notation and parentheses for grouping, not commutator syntax.

`data/triggers.json` defines named move chunks. The longest matching chunk wins; file order breaks ties. Patterns are parsed once when the app starts. Unmatched moves remain readable in plain notation. Change this file to use your own chunk names.

## Sources and maintenance

The 41-case F2L reference comes from [CubeSkills’ F2L sheet](https://www.cubeskills.com/uploads/pdf/tutorials/f2l.pdf) by Feliks Zemdegs and Andy Klise. Local case numbers follow the sheet’s reading order. `data/f2l.json` is separate from the last-layer importer; static pair diagrams are generated locally.

Algorithm sequences, case classifications, and setup sequences come from [J Perm's OLL](https://jperm.net/algs/oll) and [PLL](https://jperm.net/algs/pll) trainers. The catalog contains 16 setup sequences per case, with a randomly chosen final U adjustment during practice. The UI and generated SVG diagrams are original to this app.

`node scripts/import-jperm.mjs` regenerates the catalog from upstream literal data. **This overwrites catalog customizations**; review the Git diff before committing. It parses the source with Acorn and does not execute downloaded JavaScript. It requires network access only when explicitly run.

Tests validate case coverage, variant equivalence, setup equivalence, progress rules, and backup validation. An independent cubing.js check verifies that every setup preserves F2L and that PLL setups keep the top oriented. Cubing.js is a development dependency only, not part of the app bundle.

## Code layout

- `src/main.js`: application state, persistence orchestration, DOM events, and focus management.
- `src/views.js` / `src/icons.js`: page and dialog markup, shared UI components, and icons.
- `src/cube.js`: facelet mechanics, move parsing, case construction, and case equivalence.
- `src/cube-player.js`: public 3D player API. Pages call `renderCubePlayer({ id, mode, algorithm })` with a stable instance ID and `notation`, `algorithm`, `scramble`, or `lesson` mode. Lesson mode additionally accepts an explicit `setup` and starts paused from that state; mode determines controls, starting state, and autoplay; algorithm playback holds 100 ms between 650 ms turns, while notation holds 450 ms; `main.js` mounts playback with `createPlayerPlayback` and a `createCubeRenderer` per DOM root.
- `src/cube-playback.js` / `src/cube-player-view.js` / `src/cube-player-renderer.js` / `src/cube-player.css`: private timeline, geometry, DOM projection, and styling. Event handling and scheduling stay in `main.js`; the renderer owns only its per-mount draw cache, has no listeners or timers, and writes only changed values. Cube elements persist across moves; only colors, layer membership, and exposed inner faces change. Full cube snapshots remain defensive copies.
- `src/f2l.js` / `src/f2l-view.js` / `src/f2l-diagram.js` / `data/f2l.json`: full F2L reference, center-normalized setups, and local static pair previews.
- `src/guides-view.js` / `src/guides.css` / `data/guides.json`: declarative Cross/F2L lessons and on-demand examples; lesson setups and solutions are separate from the OLL/PLL catalog.
- `src/notation-view.js` / `src/notation.css`: interactive 3×3 notation reference; demonstration state and events live in `main.js`.
- `src/diagram.js` / `src/pll-arrows.js`: SVG diagrams and PLL piece movement.
- `src/case-diagram.js`: shared 2D case-preview API for learning, library, progress, practice, detail, and the practice picker. It caches immutable SVG strings from `diagram.js`; previews have no visible orientation caption and retain orientation in their accessible labels.
- `src/progress-index.js`: fresh per-render summary of practice history.
- `src/algorithm.js` / `src/html.js`: reusable trigger rendering and HTML escaping.
- `src/practice.js`: random setup selection and last-layer color/orientation remapping.
- `src/learning-methods.js` / `data/learning-methods.json`: full and two-look curricula and recommended variants.
- `src/library.js`: shared library filtering and filtered practice pools.
- `src/practice-picker-view.js` / `src/practice-picker.css`: grouped temporary practice selection; selection and session events live in `main.js`.
- `src/select-control.js`: shared accessible styled dropdown markup.
- `src/cubes.js` / `src/cubes-view.js`: validated local cube records, default selection, and cube management/pickers. Timer solves optionally reference a stable cube ID; old solve records remain compatible.
- `src/solve-timer.js` / `src/solve-history.js` / `src/timer-view.js` / `src/timer.css`: scramble generation, stopwatch state, validated local solve history, recent statistics, and timer UI.
- `src/progress.js` / `src/dates.js`: progress validation, shared calendar/timestamp validation, and confidence rules.
- `src/preferences.js` / `src/theme.js`: device preferences and theme behavior.
- `src/style.css` / `src/theme.css`: layout and color themes.

Views receive the current state and read-only helpers on each render; they do not mutate progress or attach event handlers. Cube mechanics and practice generation have no DOM dependency. Tests also compare side rotation with cubing.js and verify PLL arrow destinations.

## Deliberately left for later

Accounts and shared progress, cross/F2L practice, automatic learning recommendations, an in-app algorithm editor.

## Future ideas

See [docs/ideas.md](docs/ideas.md) for deferred ideas, including shared progress, learning recommendations, trigger drills, cross, and F2L.
