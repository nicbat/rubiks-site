# Last Layer

A small, static CFOP learning app for OLL and PLL. No account, backend, database, or paid service is required. Progress lives in the current browser.

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

- Choose any of the 57 OLL and 21 PLL cases for your learning set.
- Switch to 2-look OLL/PLL for a smaller, step-by-step curriculum.
- Collapse library groups and practice any filtered set without changing your learning set.
- Mark algorithms you already know, independently for each variant.
- Use the scramble timer with Space or touch controls; times show seconds to two decimal places.
- Browse OLL and PLL by group, view top-down diagrams, and toggle PLL permutation arrows.
- Switch algorithm variants and tap common move chunks to see their names.
- Rehearse a chosen algorithm throughout the day.
- Practice hidden cases from your selected set, using varied setup sequences and optional random color-side orientation.
- Set a light, dark, or system theme and PLL arrows on the Settings page.
- Record recognition and execution results, and review local progress.
- Export/import JSON backups to transfer progress between devices manually.

Each person can use their own browser. There is no automatic synchronization or shared progress view in this version. Clearing browser storage deletes progress, so export a backup periodically. Changing the site's origin (including its port) uses a different browser storage area.

## Practice rules

Start every hidden setup from a solved cube, yellow on top and green in front. Follow the setup while keeping the cube out of view, then bring it out to recognize and solve. The case and diagram remain hidden until you finish or ask for help. Hint use requires the “Needed help” result.

Hidden practice always randomizes the final U adjustment. With **Randomize side colors** enabled, it also rotates the setup across the four side colors while keeping yellow on top and green in front. This remaps face turns rather than showing a cube rotation. Side choices are independent, so repeats are possible; yellow remains on top. The setting and PLL arrow visibility are saved on the device.

A reveal shows the canonical diagram for your chosen algorithm, not necessarily the exact orientation produced by the setup. Adjust the top face or rotate the cube to match the diagram. OLL setups may leave a PLL case after orientation; finish solving the whole cube before the next setup.

Imported attempts are validated for real calendar dates and timezone-qualified timestamps, then ordered chronologically before replacing any progress.

A case becomes **Confident** after confident recognition and execution on three distinct local calendar dates since the most recent difficult recognition attempt. “Needed help” and “Solved with effort” reset that sequence. Rehearsals add to practice totals but do not earn confident days. Each algorithm variant has its own history.

## Two-look learning and timer

Choose **2-look OLL / PLL** in the library. OLL has three yellow-cross cases followed by seven corner-orientation cases; PLL has two corner-position cases followed by four edge-position cases. Diagrams show the complete case, including pieces not involved in the current learning step. Skip a step when its pieces are already solved. Existing case IDs and variant histories are shared with the full library; saved algorithm choices take priority over two-look recommendations.

**Practice these cases** uses the current section, method, group, search, and learning-status filters. Learned includes “Already known” and earned “Confident” status for the currently chosen variant. With all learning statuses shown, the library and each group display learned/total counts. Skipping and recording a result stay within that set. Collapsing a group only changes its display; it does not remove cases from the practice set.

**Mark already known** in a case's detail records a reversible declaration for the chosen variant. It does not add practice attempts or confident days. Old version-1 backups remain compatible; new backups may include `known`, a mapping from case IDs to arrays of known variant indices.

The Timer page generates 20 random face turns locally. These are not competition random-state scrambles. Press Space or tap Start to begin, stop to freeze the result, then request the next scramble. Navigating away stops the timer. Solve times are session-only and separate from learning progress.

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

Diagrams are computed directly from the selected algorithm, including slice moves, wide moves, and rotations. All variants for a case must solve the same case (up to cube/top-layer orientation). Run `npm test` after catalog changes; it checks every variant and every setup. The parser supports standard space-separated move notation and parentheses for grouping, not commutator syntax.

`data/triggers.json` defines named move chunks. The longest matching chunk wins; file order breaks ties. Patterns are parsed once when the app starts. Unmatched moves remain readable in plain notation. Change this file to use your own chunk names.

## Sources and maintenance

Algorithm sequences, case classifications, and setup sequences come from [J Perm's OLL](https://jperm.net/algs/oll) and [PLL](https://jperm.net/algs/pll) trainers. The catalog contains 16 setup sequences per case, with a randomly chosen final U adjustment during practice. The UI and generated SVG diagrams are original to this app.

`node scripts/import-jperm.mjs` regenerates the catalog from upstream literal data. **This overwrites catalog customizations**; review the Git diff before committing. It parses the source with Acorn and does not execute downloaded JavaScript. It requires network access only when explicitly run.

Tests validate case coverage, variant equivalence, setup equivalence, progress rules, and backup validation. An independent cubing.js check verifies that every setup preserves F2L and that PLL setups keep the top oriented. Cubing.js is a development dependency only, not part of the app bundle.

## Code layout

- `src/main.js`: application state, persistence orchestration, DOM events, and focus management.
- `src/views.js` / `src/icons.js`: page and dialog markup, shared UI components, and icons.
- `src/cube.js`: facelet mechanics, move parsing, case construction, and case equivalence.
- `src/diagram.js` / `src/pll-arrows.js`: SVG diagrams and PLL piece movement.
- `src/case-diagram.js`: bounded cache of immutable generated SVG strings.
- `src/progress-index.js`: fresh per-render summary of practice history.
- `src/algorithm.js` / `src/html.js`: reusable trigger rendering and HTML escaping.
- `src/practice.js`: random setup selection and color-side rotation.
- `src/learning-methods.js` / `data/learning-methods.json`: full and two-look curricula and recommended variants.
- `src/library.js`: shared library filtering and filtered practice pools.
- `src/select-control.js`: shared accessible styled dropdown markup.
- `src/solve-timer.js` / `src/timer-view.js` / `src/timer.css`: scramble generation, stopwatch state, and timer UI.
- `src/progress.js`: progress validation, dates, and confidence rules.
- `src/preferences.js` / `src/theme.js`: device preferences and theme behavior.
- `src/style.css` / `src/theme.css`: layout and color themes.

Views receive the current state and read-only helpers on each render; they do not mutate progress or attach event handlers. Cube mechanics and practice generation have no DOM dependency. Tests also compare side rotation with cubing.js and verify PLL arrow destinations.

## Deliberately left for later

Accounts and shared progress, cross/F2L guidance, automatic learning recommendations, timers, animated demonstrations, and an in-app algorithm editor.

## Future ideas

See [docs/ideas.md](docs/ideas.md) for deferred ideas, including shared progress, learning recommendations, trigger drills, cross, and F2L.
