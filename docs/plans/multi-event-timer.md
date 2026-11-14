# Multi-event timer, scrambles, and cube previews

Updated November 14, 2026. Initial 3×3 package extraction implemented locally;
event selection, storage schemas, and hosted data have not changed. This is the working plan for
introducing event-specific solves throughout the site while retaining browser-local
guest use and optional account sync.

## Agreed scope

- Enable regular 2×2–7×7 (`222`, `333`, `444`, `555`, `666`, `777`), 3×3 one-handed
  (`333oh`), and 3×3/4×4/5×5 blindfolded (`333bf`, `444bf`, `555bf`).
- Show Multi-blind, Pyraminx, Skewb, Megaminx, and Clock in a separate Coming soon
  section. They cannot be selected to record attempts. Multi-blind's multiple
  scrambles and results remain out of scope. Fewest moves is not in this release.
- Migrate every existing timer solve to regular 3×3 without changing its identity
  or historical contents.
- Combine activity across events, but keep speed statistics event-specific.
- Upgrade the current 3×3 random-move scrambler to competition-style random-state
  generation. Support appropriate scrambles for every enabled event.
- Pursue a source-owned engine rather than requiring cubing.js at runtime. Target
  the technical WCA requirements and investigate official competition eligibility
  separately; neither conformance nor a port of approved code implies approval.
- Investigate generalizing our own renderer, preserving the existing 3×3 lesson
  player. Do not assume that using cubing.js for scrambling requires its renderer.
- Keep existing learning progress intact. Full multi-puzzle practice is a later
  feature; the current Ortega reference does not constitute a complete practice
  engine.

## Puzzle, event, and physical equipment

Introduce a source-owned registry with stable event IDs, labels, puzzle IDs,
availability, scramble strategy, and statistics policy. Keep puzzle IDs compatible
with course metadata (`2x2`, `3x3`, etc.) or explicitly map them; cubing.js uses
separate puzzle IDs such as `3x3x3`. Never derive identities from display labels.

Each solve has an explicit `eventId`. A physical cube has a puzzle type and its
existing stable equipment ID. One 3×3 can serve regular, one-handed, and blindfolded
events. Changing equipment never changes a solve's event.

Recommended: remember a preferred physical cube per event and keep the active
timer event device-local. Filter equipment choices by compatibility, including
bulk assignment and solve editing. Retain names for deleted equipment. Legacy
equipment has no recorded puzzle type: an initial 3×3 assumption must be editable
and must not be presented as verified historical information. Its classification
must not silently rewrite solves. Decide restrictions on changing a referenced
cube's puzzle type before implementation.

## Scramble generation

### Current behavior and intended replacement

`src/solve-timer.js` generates twenty random face turns synchronously and avoids
consecutive turns on the same axis. `src/solve-history.js` accepts only exactly
twenty face turns. Neither is a random-state implementation. `src/cube.js` applies
moves and computes sticker state; it is not a random-state solver.

For 3×3, random-state generation means selecting a legal state with the appropriate
distribution, finding a solution, and producing a sequence that reaches that state
from solved. A longer random walk is not an equivalent replacement. Writing this
ourselves would require a state sampler respecting piece orientation/permutation
constraints, a solver and tables, randomness handling, and independent correctness
and distribution review. The chosen planning direction is to own this engine,
with licensed reuse of solver components still an option to evaluate explicitly.
The earlier recommendation to require `cubing/scramble` at runtime is superseded.
Keep cubing.js available as an independent test oracle and comparison candidate.

The intended policy is random-state generation for 2×2, 3×3, and 4×4 events, and
appropriate big-cube generation for 5×5–7×7. Request blindfolded scrambles by their
own event IDs: orientation moves may differ even when the puzzle model is shared.
Do not label every size as random-state. The technical contract must include
minimum-distance filtering, not just generating a solvable sequence. Specify the
move metric and equivalent-state conventions explicitly. A sequence's length does
not establish its state's minimum solution distance. Blindfolded orientation must
be uniform over all 24 cube orientations. Pin the applicable rules and reference
implementation revision; recheck them when releasing.

### Package boundary and official-use distinction

Agreed package direction: `packages/cube-engine` in this repository with
its own tests and framework-independent APIs. This is a proposed package
boundary, not an already-created package. No separate Git repository or public
package publication is needed initially. Extract later if another consumer or an
independent release schedule warrants it. Keeping the first integration in one
repository allows atomic engine/app changes and simplifies fixtures and CI.

Expose separate entry points: `core` for states/notation/moves/geometry,
`scramble` for sampling/solvers/filtering/versioned results, `renderer` for our
visualization/playback, and `worker` for asynchronous generation. Scramble and
renderer depend on core, never on each other. Keep solver tables and worker assets
out of renderer-only bundles, and DOM/browser globals out of core/Node imports.
Use explicit exports rather than an eager root import that loads all features.

The renderer must work in an ordinary HTML/JavaScript page with no Svelte, React,
or other framework runtime. Move the existing renderer into this entry point;
do not implement a second renderer. Extract its current dependencies on site
icons, control selectors, fixed palette and application-specific modes. Expose
an explicit create/mount, update, playback/camera and destroy lifecycle; exact
names remain to be designed. It owns only its mounted subtree. Keep site controls,
learning semantics, account state and Svelte reactivity in a thin app adapter.
Provide scoped opt-in renderer CSS, configurable colors, reduced-motion support,
keyboard/pointer access and type declarations without requiring a CSS framework.

Framework independence should preserve the direct DOM fast path. Retain geometry
and minimize writes; do not route animation frames through framework state or a
general-purpose event bus. Publish control/progress callbacks only when meaningful
values change. Schedule frames only when animation/camera work requires them;
destroy must release listeners, observers and scheduled frames. Never mutate
caller-owned state. Multiple mounted renderers must remain independent.

Add a vanilla-JavaScript consumer fixture and retain the Svelte consumer as
integration checks. Verify package exports and renderer-only bundle boundaries,
Node imports, mount/update/destroy cycles, simultaneous instances and local worker
resolution. Compare baseline CPU, frame behavior, memory and output sizes before
claiming performance parity; a package boundary alone guarantees no speedup.
Browser fixtures are exercised only at the approved verification step.

Share only deliberate primitives; do not extract all lesson code or make the
scrambler and its supposed independent oracle share the same implementation.
cubing.js and hand-authored fixtures remain independent checks even when our
generator and renderer agree with each other.

Use cryptographic production randomness with unbiased bounded sampling. Permit
seeded inputs for deterministic tests without making predictable test generation
the production default. Document sampler uniformity and legal-state constraints;
statistical sampling is diagnostic evidence, not proof. Solver timeouts must not
silently discard hard states and resample, which can bias output. Version and
verify generated tables and make their build reproducible.

For 3×3, plan a legal-state sampler plus two-phase solver. For 2×2, use a corner
state solver with exact shallow-state filtering. Treat 4×4 sampling and multi-phase
solving as a dedicated substantial task, including equivalent center/wing states.
Big-cube random-move policies and blindfolded orientation are separate strategies.
Evaluate original code versus licensed adaptations before copying any solver code;
record upstream revisions, license obligations and table provenance.

There are two distinct release criteria:

1. **Technical conformance:** documented evidence that the engine meets the pinned
   scramble specification, checked independently against reference implementations.
2. **Official competition eligibility:** current WCA Regulation 4b requires a
   current official scramble program. The WCA lists TNoodle, and TNoodle's own
   documentation prohibits custom builds at official competitions. A browser port,
   identical algorithms, or passing tests does not establish official designation.

Track possible upstream contribution/external review as an investigation, without
promising an approval path or contacting anyone without authorization. Competition
secrecy and distribution procedures are also outside an ordinary public timer.
Until eligibility changes, do not describe our package as officially approved.
Sources: [WCA rules](https://www.worldcubeassociation.org/regulations/#4b),
[official scramble program](https://www.worldcubeassociation.org/regulations/scrambles/),
and [TNoodle library guidance](https://github.com/thewca/tnoodle-lib).

### Timer and worker lifecycle

- Separate the stopwatch from the asynchronous scramble provider. Represent
  loading, ready, and failure states explicitly; timer start requires a validated
  ready scramble. Display loading/retry feedback without shifting the clock.
- Freeze the event, scramble, and equipment associated with the active attempt.
  Never consult a newly changed selector when saving a completed attempt.
- Scope requests to the event and current dataset/session with a generation
  token. Ignore late results after event changes, account switches, imports,
  navigation/reset, or newer requests. A worker operation may finish even when
  its result is no longer relevant.
- Event changes cancel an armed hold and clear incompatible selections/previews.
  Disable event/equipment changes during timing. Preserve existing stopped-result,
  penalty, delete, Tab, and navigation semantics.
- Prefetch a bounded next scramble for the current event. Choose either the
  library's prefetch mechanism or application-owned prefetch; avoid duplicate
  queues and unbounded per-event caches. Consume each prepared item once.
- Worker/load failures must not silently fall back to the old random-turn method.
  Offer retry and keep saved history intact. A preview failure must not discard a
  valid scramble or recorded solve.
- Keep generation out of the animation/timer update loop. Verify production
  worker URLs and bundled solver assets on the same origin, including nested
  routes. Local generation does not imply cold-start offline support before
  assets have been downloaded.
- Blindfolded timing includes memorization; do not introduce a separate inspection
  allowance for those events. An optional memorization split is not required here.

### Saved records and validation

- Save the exact displayed scramble string, `eventId`, and recommended optional
  generator provenance (provider/version or strategy revision). Keep provenance
  distinct from the event. An old regular 3×3 solve remains comparable with a new
  regular 3×3 solve; do not split their statistics by generator automatically.
- Define explicit starting-grip metadata/conventions for new WCA-style previews.
  WCA cube scrambling starts white-up/green-front; current learning setups use
  another stated grip. Preserve old preview orientation rather than globally
  reinterpreting saved scrambles, and keep learning grips independent.
- Preserve all old twenty-turn scrambles byte-for-byte. Never regenerate a saved
  scramble on import, migration, playback, or a provider upgrade. Mark legacy
  provenance only when it is known; never imply old records were random-state.
- Replace fixed-length validation with bounded, event/puzzle-aware token checks.
  Support legal face/wide/numbered-layer and applicable orientation moves; reject
  invalid layer widths, malformed notation, unknown events, and excessive input.
  Do not accept arbitrary rich algorithm syntax merely because a library parser
  supports it. Backup validation checks syntax and compatibility, not randomness
  or official competition validity.
- New native schema records require valid event IDs. Only the explicit legacy
  migration supplies missing IDs as `333`.
- Keep learning/practice setup generation independent; do not replace verified
  hidden-case setups with timer scrambles.

## Generalize the existing renderer

Prototype 2×2, 4×4, and 7×7 before committing to a broad rewrite. Keep the current
3×3 interfaces compatible for lessons, notation, case diagrams, and practice.

- Parameterize facelet positions, cubie geometry, scaling, and layer selection by
  size. Support wide and numbered-layer turns, even-sized coordinates, and
  interior-face exposure. Current center-dependent helpers are specifically 3×3;
  do not reuse them indiscriminately on even cubes.
- Preserve retained DOM elements, minimal per-frame writes, cleanup, camera
  controls, keyboard alternatives, reduced motion, and theme behavior.
- Extend notation deliberately: the existing parser does not understand `3Rw`.
  Confirm matching face order, colors, orientation conventions, and state mapping
  against independent fixtures and cubing.js, not just algorithm/inverse identity.
- Historical previews use the saved event/puzzle, never the active timer event.
  Preserve old scramble previews and all existing 3×3 learning geometry.
- Measure 7×7 DOM/paint/frame behavior on supported phone layouts. Static diagrams
  remain a fallback if animated geometry proves too costly; that decision is open.

## Storage and database migration

The backend stores one JSON training snapshot per account, plus derived profile
statistics. A normalized solve-table rewrite is unnecessary for this feature.

1. Introduce full training-backup version 2. Explicitly migrate v1 solves to `333`
   and equipment/default metadata while preserving solve IDs, timestamps, local
   dates, elapsed times, penalties, notes, and original scrambles.
2. Version local solves/equipment storage or use versioned envelopes. Preserve old
   bytes; migrate each guest/account scope independently with journaled rollback.
   Update restore journals, direct reads, change detection, pristine-account
   checks, demo isolation, imports, guest transfer, and old-origin recovery.
3. Define detection/recovery for edits from an old open tab. Separate new keys
   prevent overwriting new data but do not automatically recover subsequent edits
   made to old keys. Never silently erase either source.
4. Deploy server support for both versions first. Validate new event IDs and
   relevant fields at the database boundary. Upgrade accounts lazily using the
   existing revision-checked sync upload, incrementing the revision normally.
5. Reject v2-to-v1 downgrades at table level, including direct authenticated writes;
   protecting only `save_training_snapshot` is insufficient. Preserve RLS and
   explain incompatible-version errors without suggesting destructive recovery.
6. Verify saved sync fingerprints against their original representation before
   migrating baselines. Normalize base/device/cloud consistently before merging;
   do not turn schema conversion into false conflicts or accidental deletions.
7. Rebuild derived profile summaries independently of snapshot revisions. Existing
   refresh logic skips unchanged payloads once `practice_count` exists, so a no-op
   snapshot update alone will not reliably backfill the new summaries.

Older clients currently reconstruct solve/equipment objects and strip unknown
fields. Adding event metadata to version 1 would therefore risk silent data loss.
Rollback must preserve version 2 data, not downgrade it for an older client.

## Statistics and affected screens

- **Timer:** selected-event history, recent statistics, event/equipment selectors,
  compatible scramble previews, and bounded history/bulk selections.
- **Progress:** combined activity counts, active days/streaks, and raw elapsed
  solving time. Separate selected-event best/mean/median/distribution/timeline
  statistics. Date and equipment filters intersect with event filtering before
  computing rolling windows; interleaved other-event solves do not fill a window.
- **Statistics policy:** configure meaningful event-specific averages and success
  rates rather than blindly exposing ao5/ao12 everywhere. Distinguish practice
  windows from official round formats. Define DNF handling explicitly and retain
  current penalty behavior. Exact displayed metrics remain a product decision.
- **Dashboard:** combined activity stays combined; replace the unlabelled global
  “best today” with clearly event-scoped results.
- **Solve details/history:** event labels, correct historical geometry, compatible
  equipment edits, and consistent previous/next navigation. Clear or reconcile
  selected solves when changing event. Event correction UI remains undecided;
  arbitrary cross-puzzle relabeling must not bypass scramble validation.
- **Day deletion:** existing behavior deletes all activity for that day regardless
  of chart filters. Explicitly disclose that all events are included.
- **Public/owner profiles and visitor preview:** combined activity plus per-event
  summaries; preserve privacy and explicitly label existing Full CFOP confidence
  as 3×3 learning progress.
- **Backend summaries:** partition SQL windows by event; update the JS parity
  implementation, strict profile validators, and both public RPC projections.
  Keep legacy flat fields consistently 3×3-scoped where retained for old clients;
  do not attach combined counts to a legacy 3×3 speed summary.
- **Fixtures and documentation:** multi-event demos, local backend seeds, backup
  examples, empty states, accessible labels, README, and testing contracts.

Principal files: `src/main.js`, `solve-timer.js`, `solve-history.js`, `cubes.js`,
`cube.js`, `cube-player-*`, `training-backup.js`, `backup-import.js`,
`training-merge.js`, `cloud-sync.js`, `dashboard.js`, `dashboard-home.js`,
`profile-summary.js`, `profiles.js`; Timer, CubePicker, Cubes, Progress,
ProgressRange, ProgressSummary, Profile, SolveTimeline, DailySolveCharts,
SolveHistoryRow, SolveDetails, and ScrambleDialog components; new Supabase
migrations and existing profile/sync SQL tests.

## Investigation evidence and limits

The committed history starts with cubing.js as a development-only oracle. No
committed replacement of a runtime TwistyPlayer was found. The documented speedups
are optimizations of our own renderer, not a benchmark against cubing.js:
see [renderer measurements](../testing.md#performance-measurements) and
[retained geometry](../testing.md#retained-cube-rendering-and-pacing).

On November 14, an isolated Node 26.13.0/Linux probe of installed cubing.js 0.63.8
generated all ten enabled event scrambles, applied each to the corresponding
library model, and obtained SVG geometry for sizes 2–7. That is API compatibility
evidence, not an independent randomness test or a browser rendering check. One
initial 4×4 generation took about 2.6 seconds; this single sample is not a latency
guarantee. SVG geometry still needs state-to-color integration for a preview.

Separate minified Vite builds measured total gzip output of 318,813 bytes for the
scramble API, 68,444 for the puzzle registry, and 233,808 for TwistyPlayer. These
are isolated all-chunk totals, not initial downloads or additive application
deltas. The scramble output includes a 210,602-byte gzip solver chunk; installed
code uses that solver for several in-scope events, including 2×2 and larger cubes.
Lazy loading reduces initial loading but does not satisfy the current all-chunk
320 KiB JS budget by itself. Measure the actual integrated dependency graph and
propose a reviewed budget/packaging decision; do not silently raise the limit or
rely on unstable private imports to remove required code.

## Parallel execution plan

Start with one small contract/scaffold PR, not a finished package. Freeze event
and puzzle IDs, event-aware generation requests, result/provenance/grip fields,
errors and cancellation, v2 solve/equipment shapes, and summary shapes. Share
legacy and interleaved-event fixtures. Generation takes an event identity or
explicit policy, not puzzle size alone: blindfolded generation differs. The app
owns availability/labels/preferences; the engine owns supported generation policies.
Keep design contracts clearly distinguished from implemented capabilities.

Then run at most three contributor workstreams plus one integration owner:

1. **Package:** behavior-preserving 3×3 core/playback/renderer extraction with
   compatibility adapters and a vanilla-JavaScript consumer. Next add NxN
   mechanics and the 2×2 generator. Own `packages/cube-engine/**`, cube/player
   adapters and their focused tests. Coordinate core exports before splitting
   renderer and solver ownership further.
2. **Storage:** solve/equipment validation, backup v2 conversion, restore journals,
   imports/merges, sync baselines and per-account migration. Own `solve-history.js`,
   `cubes.js`, training storage/backup/merge/import/sync modules and focused tests.
   This work needs schema and notation contracts, not a completed solver.
3. **Statistics/backend:** event-aware domain summaries, SQL migrations/backfill,
   profile projections and parity fixtures, followed by declarative chart/profile
   components. Own dashboard/profile summary modules, `profiles.js`, SQL and
   matching integration tests. Coordinate validator boundaries with storage.

The **integration owner** exclusively owns `main.js`, `AppView.svelte`, root
package/lockfile/build configuration, shared registry/contracts, fixture changes,
migration numbering and release wiring. It can build the timer controller/UI
against deterministic injected providers in tests while engines are unfinished.
Provide requested integration patches rather than having multiple contributors
edit these shared files. Reassign ownership explicitly when workstreams change.

For the initial extraction itself, narrower contributors may own core, renderer,
and consumer tests separately once the API/file boundary is agreed. Preserve all
current 3×3 behavior; do not combine extraction with new events or migration.

Use isolated worktrees/branches for independently mergeable PRs after the common
contract commit. Before that commit exists, non-overlapping ownership in the
shared workspace avoids branches missing the local plan/contracts. No agent
reverts another's edits. Integrate small commits frequently; do not maintain a
long-lived package fork plus a diverging site fork. A package release to npm or a
second repository is not needed for parallel work.

When storage/statistics contributors finish, reassign slots to 3×3 and 4×4 solvers
while the package owner finishes big-cube/renderer work and the integrator wires
the site. Begin the 4×4 algorithm/table feasibility review early: it is the largest
uncertainty, even if implementation gets a dedicated slot later. Build conformance
fixtures alongside generators, not after all generators are complete.

### PR and rollout sequence

1. Contracts, package skeleton, shared fixtures and import-boundary tests (BIG-53).
2. Existing 3×3 package extraction and framework-free consumer (part of BIG-59).
3. In parallel: event-safe storage/server compatibility (BIG-60), event-specific
   summaries (BIG-62), async timer scaffolding (BIG-61), NxN mechanics and generator
   increments (BIG-54–57/59). Keep changes small and independently verifiable.
4. Integrate a complete 2×2/3×3 vertical slice in development to exercise real
   worker → timer → save → sync → history → chart → preview behavior. This is an
   integration milestone, not a reduction of the agreed ten-event release scope.
5. Integrate all enabled events and complete technical conformance evidence,
   bundle/performance checks, real backend checks, and approved browser validation.
6. Enable the feature only through BIG-63's rollout gate. Official WCA designation
   is separate from technical/training readiness and is not promised by this gate.

Implementation dependencies are not release dependencies. Timer/statistics work
may start from contracts before solvers/migration are finished. Test providers
remain test/development-only, never a production fallback. New-event recording
stays unavailable until all consumers, generators, migration and previews are ready.
Because main-branch SQL migrations auto-deploy, every SQL merge must be safe with
the old frontend; separate compatibility deployment from activation and irreversible
data changes. Rollback preserves v2 readers/server and disables new recording.

## Delivery and verification checklist

- [ ] Finalize event registry, data contract, statistics policy, equipment defaults,
      and explicit legacy conversion rules.
- [ ] Prototype local scramble worker integration and our NxN renderer separately.
      Measure actual bundle costs and first/subsequent generation before selecting
      implementation details.
- [ ] Implement/test storage migration, baseline conversion, import/merge/recovery,
      server version guards, public summary backfill, and privacy compatibility.
- [ ] Integrate asynchronous timer, generation provenance, equipment selection,
      Coming soon entries, history, and all statistics surfaces.
- [ ] Release enabled-event recording only when consumers and summaries understand
      it; deploy compatible database support before the frontend.
- [ ] Test delayed/out-of-order/rejected generation, retry, repeated Next, start
      while loading, event changes during holds, account/import transitions,
      bounded prefetch, and preservation of an already recorded result.
- [ ] Use deterministic injected scramble providers in lifecycle tests. Exercise
      the real adapter separately without asserting incidental scramble strings.
      Compare every supported move/layer and exact resulting stickers with
      independent oracles and hand-authored fixtures. Preserve existing 3×3 tests.
- [ ] Test legacy and native-v2 imports, invalid/missing events, oversized or invalid
      notation, provenance round trips, storage failures, stale devices, direct
      table downgrade attempts, and SQL/JS event-statistics parity.
- [ ] Use deliberately interleaved fast 2×2, slower 3×3/OH, and big-cube solves with
      DNFs/+2 to expose mixed averages, wrong navigation, and bulk-edit leakage.
- [ ] Run appropriate fast/domain/build checks and real-backend integration tests.
      Run `npm run benchmark` before/after performance work; distinguish Node CPU
      measurements from browser paint. Preserve all current oracle coverage.
- [ ] At the separately approved browser-verification step, cover timer inputs,
      production workers, preview lifecycle, event filtering, backups/sync, focus,
      and 320px portrait/667×375 landscape in both themes; inspect actual preview
      bounds and rendering. No browser checks have been run for this plan.

Open decisions are solver implementation/reuse, package API and bundle cost, precise event statistics,
physical cube default/reclassification rules, solve-event correction, and whether
our generalized renderer meets the interactive preview target on larger cubes.

## Linear tracking

All issues are in **Last Layer Beta Release**, under the existing
[BIG-28 umbrella](https://linear.app/goscas/issue/BIG-28/cube-rework-timer-data-to-include-other-cubes).
Dependencies are recorded in Linear. These are planned tasks, not implemented work.

- [BIG-53: Requirements and package boundary](https://linear.app/goscas/issue/BIG-53/cube-define-wca-scramble-requirements-and-an-independent-engine)
- [BIG-54: 3×3 and one-handed random-state generation](https://linear.app/goscas/issue/BIG-54/cube-build-uniform-random-state-33-and-one-handed-scrambles)
- [BIG-55: 2×2 generation and distance filtering](https://linear.app/goscas/issue/BIG-55/cube-build-uniform-22-scrambles-with-minimum-distance-filtering)
- [BIG-56: 4×4 random-state engine](https://linear.app/goscas/issue/BIG-56/cube-build-and-validate-a-random-state-44-scramble-engine)
- [BIG-57: Big cubes and blindfolded orientation](https://linear.app/goscas/issue/BIG-57/cube-add-big-cube-generation-and-blindfolded-orientation-policies)
- [BIG-58: Conformance audit and official eligibility](https://linear.app/goscas/issue/BIG-58/cube-audit-scramble-conformance-and-investigate-official-wca)
- [BIG-59: Generalized retained renderer](https://linear.app/goscas/issue/BIG-59/cube-generalize-the-retained-cube-renderer-for-22-77)
- [BIG-60: Storage and sync migration](https://linear.app/goscas/issue/BIG-60/cube-migrate-training-data-and-sync-to-explicit-solve-events)
- [BIG-61: Asynchronous timer integration](https://linear.app/goscas/issue/BIG-61/cube-integrate-event-selection-and-asynchronous-owned-scrambles-into)
- [BIG-62: Event-specific statistics and profiles](https://linear.app/goscas/issue/BIG-62/cube-separate-event-speed-statistics-across-dashboard-and-profiles)
- [BIG-63: Integration and beta rollout gate](https://linear.app/goscas/issue/BIG-63/cube-integrate-and-gate-the-multi-event-beta-rollout)

## Initial implementation status

The workspace package now exports existing 3×3 core mechanics, playback, rendering,
and renderer CSS. Site adapters preserve lesson controls and scheduling. A plain
JavaScript consumer and dependency-boundary test exercise the public exports.
Generator and NxN APIs remain future work; the package is private and unpublished.
See [proposed shared contracts](cube-engine-contracts.md) for parallel implementation
boundaries. Approved browser verification covered all 135 selected cases across
Chromium, mobile Chromium, and Firefox. The initial run passed 129 cases; six
failures exposed two test-harness assumptions, corrected without application
changes. All nine affected cases passed on a focused cross-browser rerun. Six
additional screenshot checks passed at 320px portrait and 667×375 landscape.
