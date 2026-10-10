# Last Layer

A small, static CFOP learning app for OLL and PLL. No account, backend, database, or paid service is required. Progress lives in the current browser.

## Run locally

Requires Node.js 22.12+ (tested with Node 26).

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. For a production build:

```sh
npm test
npm run build
npm run preview
```

Publish the `dist/` directory to any static host. Relative asset URLs support hosting under a subdirectory. No environment variables are needed. Fonts and cube diagrams are bundled locally; there are no runtime API calls.

## What you can do

- Choose any of the 57 OLL and 21 PLL cases for your learning set.
- View top-down diagrams, switch algorithm variants, and tap common move chunks to see their names.
- Rehearse a chosen algorithm throughout the day.
- Practice hidden cases from your selected set, using varied setup sequences.
- Record recognition and execution results, and review local progress.
- Export/import JSON backups to transfer progress between devices manually.

Each person can use their own browser. There is no automatic synchronization or shared progress view in this version. Clearing browser storage deletes progress, so export a backup periodically. Changing the site's origin (including its port) uses a different browser storage area.

## Practice rules

Start every hidden setup from a solved cube, yellow on top and green in front. Follow the setup while keeping the cube out of view, then bring it out to recognize and solve. The case and diagram remain hidden until you finish or ask for help. Hint use requires the “Needed help” result.

A reveal shows the canonical diagram for your chosen algorithm, not necessarily the exact orientation produced by the setup. Adjust the top face or rotate the cube to match the diagram. OLL setups may leave a PLL case after orientation; finish solving the whole cube before the next setup.

A case becomes **Confident** after confident recognition and execution on three distinct local calendar dates since the most recent difficult recognition attempt. “Needed help” and “Solved with effort” reset that sequence. Rehearsals add to practice totals but do not earn confident days. Each algorithm variant has its own history.

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

`data/triggers.json` defines named move chunks. The first matching chunk wins; put longer patterns before shorter ones. Unmatched moves remain readable in plain notation. Change this file to use your own chunk names.

## Sources and maintenance

Algorithm sequences, case classifications, and setup sequences come from [J Perm's OLL](https://jperm.net/algs/oll) and [PLL](https://jperm.net/algs/pll) trainers. The catalog contains 16 setup sequences per case, with a randomly chosen final U adjustment during practice. The UI and generated SVG diagrams are original to this app.

`node scripts/import-jperm.mjs` regenerates the catalog from upstream literal data. **This overwrites catalog customizations**; review the Git diff before committing. It parses the source with Acorn and does not execute downloaded JavaScript. It requires network access only when explicitly run.

Tests validate case coverage, variant equivalence, setup equivalence, progress rules, and backup validation. An independent cubing.js check verifies that every setup preserves F2L and that PLL setups keep the top oriented. Cubing.js is a development dependency only, not part of the app bundle.

## Deliberately left for later

Accounts and shared progress, cross/F2L guidance, automatic learning recommendations, timers, animated demonstrations, and an in-app algorithm editor.
