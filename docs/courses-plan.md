# Courses and shared learning

Design and implementation notes, October 13, 2026. The first local release implements course browsing, shared Cross/F2L review, full/two-look module practice, recognition sharing, and a prepared 2×2 Ortega reference. CFOP is one course; both 2×2 and blindfolded are coming soon. Interactive blindfolded drills and 2×2 rendering/practice remain future work. Accounts remain deferred; see [backend-plan.md](backend-plan.md).

The course release started fresh in version-2 learning storage; the legacy browser key remains untouched. Explicit version-1 backup import is now supported, and full training backups include learning progress, solves, and cubes. Existing variant indices and case IDs remain stable. Exact same-case/variant sharing, explicit partial-recognition links, and stable practice-event IDs are implemented; arbitrary cross-case sequence linking remains deferred. Storage notes were refreshed October 19, 2026.

## Product structure

Courses assemble reusable modules; modules reference lessons and practice objectives. A course does not own a private copy of an algorithm or a learner's history.

Current paths:

- **3×3 CFOP:** Cross, one F2L reference, two-look OLL/PLL, and full OLL/PLL together. The workspace shows four sections; Two-look / Full changes the case selection within OLL and PLL. Module IDs remain stable for saved resume positions and practice attribution.
- **2×2 Ortega:** coming soon. Three reference lessons, seven OLL algorithms and five PBL algorithms are prepared and independently validated in source; the reference view is not connected to the app yet.
- **3×3 blindfolded:** coming soon, without active lessons or training controls.

Main navigation is My learning, Courses, Progress, and Timer. Algorithm library and Guides are footer tools; Cubes is inside Settings. CFOP also offers a two-sided PLL quiz with four arrow diagrams (neutral side stickers) and secondary names. Session scores remain separate from mastery.

F2L remains one reusable module. Reading a guide does not imply practical mastery.

## What progress carries over

Distinguish the move sequence from the skill of recognizing when to use it:

- **Algorithm familiarity:** knowledge and execution practice for a particular sequence/variant.
- **Recognition objective:** the pattern, relevant pieces, prerequisites, and target outcome of an exercise.
- **Lesson progress:** reviewed lessons and resume position, shared wherever the same lesson appears.

Link these explicitly in catalog metadata. Exact shared objectives and variants reuse the same progress. Shared sequences with different objectives carry algorithm familiarity while keeping recognition separate. Course completion is derived from its distinct required objectives; global practice totals count original attempts once.

Examples:

- The seven OLL corner-orientation cases with an already oriented edge cross can share recognition and algorithm progress between two-look and full OLL when the selected variant matches.
- Two-look line/L/dot exercises recognize an edge pattern while ignoring corner orientation. Their matching full OLL cases require more specific recognition. Share the relevant algorithm familiarity, but do not automatically certify full-case recognition. The reverse transfer may be valid; encode reviewed, directional transfer rules rather than assuming symmetry.
- Two-look PLL corner positioning likewise ignores edges. Review its recognition links separately from full PLL; using a T-perm sequence does not make the exercises identical.
- The same sequence used on another puzzle can be marked familiar, while puzzle-specific recognition and execution performance remain separate.

Known is a shared declaration for an exact case and variant. Both views show the same mark, and unmarking clears it everywhere. Recognition confidence remains exercise-specific for partial patterns, with a short explanation in case detail. No manual transfer controls are needed.

Legacy version-2 two-look known marks contribute to shared knowledge; changing a mark consolidates that variant without changing other variants or history. Legacy recognition links remain validated and honored in imported backups. Do not merge histories destructively, create duplicate attempts, or infer transitive recognition equivalence. Equivalent cube effects alone do not establish identical finger sequences or learning objectives.

## Blindfolded framework

Use **Old Pochmann** as the proposed first method. J Perm's [blindfolded tutorial](https://jperm.net/bld) covers buffers/targets, setup–swap–undo, sticker lettering, memo cycles, flipped/twisted pieces, parity, and worked solves. His [video](https://www.youtube.com/watch?v=ZZ41gWvltT8) names the method. He presents M2 as a later edge-method progression.

Proposed modules: orientation and sticker locations; buffers and swaps; edge/corner setups; lettering and memo; cycle breaks and exceptional pieces; parity; guided whole solves. Start with concise original lessons, linked sources, and independently verified examples. Later drills can cover sticker identification, setup execution, memo tracing, and full solves, each with separate progress.

Choose one consistent orientation, lettering scheme, buffer convention, and execution order. J Perm uses white-up/green-front, whereas this app's current practice uses yellow-up/green-front. Make that difference explicit and verify diagrams/setups against the selected convention before publishing exercises.

His edge-swap sequence provides a concrete T-perm reuse candidate; verify it against our exact variant. Familiarity can transfer, but blindfolded target selection, setup/undo, memo, and parity remain separate skills.

Future framework acceptance: a navigable overview, actual introductory content and sources, and clear reference-only labeling. The current course stays marked coming soon. No empty training buttons or implied full blindfolded trainer. Later BLD setups must validate intended swaps and collateral effects, not inherit last-layer assumptions that F2L stays solved.

## Puzzle support and 2×2

Declare puzzle identity on cases, modules, and exercises now. Course identity must not be a replacement for puzzle identity. Existing `oll-*` and `pll-*` IDs continue to identify their 3×3 cases; future IDs are unambiguous across puzzles.

[J Perm's 2×2 progression](https://jperm.net/2x2/faster) supplies the implemented reference outline: Ortega has first-face construction, seven OLL algorithms, and five PBL algorithms; CLL is a subsequent path with algorithm overlap. The local JSON preserves these twelve algorithms, with independent orientation/permutation tests.

Keep puzzle-specific mechanics, diagram rendering, setup generation, and exercise validation behind small explicit boundaries as needed. Adding 2×2 requires correct 2×2 states and diagrams, plus independent tests; it is not merely hiding edges on existing 3×3 artwork. Share applicable sequence familiarity deliberately without treating cases or performance metrics as interchangeable.

## Data and implementation boundaries

- `data/courses.json`: stable course/module references, ordering, puzzle, and availability.
- Shared module/lesson definitions: references to existing guides, F2L, and case catalogs. Replace duplicated curriculum logic incrementally.
- Explicit algorithm and objective references: add stable sequence identities alongside existing case IDs and variant indices. Never reorder variants or regenerate upstream data as part of this work.
- DOM-independent course resolution and progress projection: validated references, deduplicated objectives, scoped practice pools, and transfer rules.
- Declarative course views; navigation, state mutations, events, persistence, and focus orchestration remain in `main.js`.

Keep the global learning set initially and project it into the active module. Explicit saved variant choices win over recommendations. Snapshot puzzle, objective, variant, and course/module provenance when practice begins; changing course or recommendations must not reinterpret a running attempt. Course is provenance, not the key that isolates shared mastery.

Continue one history scan per render. Aggregate source attempts once and project summaries through validated references. If caching projections, include every relevant preference/link/catalog input and bound the cache.

## Storage and backups

The implementation uses `last-layer.progress.v2` without automatically reading the old browser key. Version-1 learning backups can be explicitly imported: preview converts them to version 2 while retaining their original practice dates. Learning-only imports leave timer/cube data untouched. Full training backups wrap version-2 learning progress, timer solves, and cube records in a version-1 training envelope; restore journals support rollback after interrupted or failed replacement.

Version-2 records keep case/variant identities and add optional method attribution (omitted means full), partial two-look known marks, reviewed lessons, course selection, resume positions, and explicit directional recognition links. Imports validate all references before replacing progress, retain original local dates, and reject invalid or duplicate links. Recognition links combine direct source evidence only; they do not form recursive chains or copy attempts.

Practice attempts now retain stable IDs through validation and backups; older attempts receive IDs on load/save or explicit import. Solves retain stable IDs, optional local dates, notes, penalties, and cube references. Future sync must build on these identities while adding durable migration/import receipts, account isolation, retry-safe operations, and deletion propagation as described in the backend plan. Independent execution grading remains future work. Course content stays local; source links are optional user navigation.

## Delivery sequence and checks

1. Define courses, reusable modules, exact sequence/objective links, and validation fixtures. Audit existing full/two-look sharing case by case.
2. Add course browsing, shared Cross/F2L access, module-scoped learning/practice, and derived counts. Preserve direct library access and share new progress across matching objectives.
3. Share known marks automatically while keeping partial-pattern recognition evidence separate. Preserve versioned backups and test legacy declarations, variant changes, duplicate counting, incompatible links, chronology, and malformed imports.
4. Keep blindfolded coming soon until a full reference and method-specific correctness tests are ready.
5. Extend the Ortega reference with 2×2 mechanics and practice later. Implement accounts after the local data model settles.

Required examples: Sune progress shared between matching two-look/full objectives; line/L familiarity without unearned full recognition; F2L lesson progress visible from both paths; matching T-perm familiarity without blindfolded mastery; different variants remaining distinct; removing a personal transfer preserving source history; switching courses mid-session not changing attribution.

For executable work, follow `docs/testing.md`: independent cube-oracle coverage, meaningful storage/import failures, hidden-answer and hint rules, keyboard/focus behavior, light/dark themes, 320px portrait and 667×375 landscape screenshots/content bounds, isolated browser server, and `npm run verify`. Documentation-only planning needs formatting and diff checks.
