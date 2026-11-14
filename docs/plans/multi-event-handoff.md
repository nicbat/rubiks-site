# Multi-event work: session handoff

Updated November 14, 2026, after implementation commit `9672732`.
Start here when resuming in another session; read `AGENTS.md`, `README.md` and
`docs/testing.md` before changing behavior.

## Branch and tracking

- Shared branch: `feat/multi-event-cube-engine`. Keep this work together; the user
  authorized implementation, coordinated subagents, commits/pushes and draft PR upkeep.
- Draft [PR #29](https://github.com/nicbat/rubiks-site/pull/29).
- Linear Last Layer Beta Release: [BIG-28 umbrella](https://linear.app/goscas/issue/BIG-28),
  [BIG-56 4×4 engine](https://linear.app/goscas/issue/BIG-56),
  [BIG-63 recovery/rollout](https://linear.app/goscas/issue/BIG-63).
- Latest implementation: `dbb7852` (full 4×4 qualification and budget fix), then
  `9672732` (low-level 4×4 blindfolded adapter). Both pushed. Working tree was clean
  before this handoff edit. Inspect status before resuming; preserve other work.
- CI for `9672732` was still pending when recorded; Vercel preview passed.
  Recheck with `gh pr checks 29`. Do not equate the preview deployment with
  production feature activation.

## Product decisions and current availability

Initial scope is regular 2×2–7×7, 3×3 one-handed, and 3×3/4×4/5×5 blindfolded.
Multi-blind and non-cubic puzzles are Coming soon. Legacy solves migrate to
regular 3×3. Activity combines events; speed statistics and records stay scoped
to an event. Learning retains its existing behavior for now.

The framework-independent package owns mechanics, scramblers, playback and the
retained renderer. No Svelte dependency in that package; cubing.js remains a
development oracle, not a runtime dependency. Target competition-style technical
requirements without claiming official WCA approval.

The integrated site is development-only at `/timer?trainingV2=1` with
`npm run dev:guest`. Production v2 recording is still off. Eight worker routes
are available: `222`, `333`, `333oh`, `333bf`, `555`, `555bf`, `666`, `777`.
**444 and 444bf remain disabled in the worker and timer.** The low-level
`/scramble/blindfolded` package adapter now accepts `444bf`; that is not worker
activation. Hosted migration has not been performed by this work.

## Completed foundations

- Event registry, schema/grip/provenance contracts, NxN renderer for sizes 2–7.
- Original 2×2/3×3 random-state generators and 5×5–7×7 random-move policies.
- Event timer selection, immutable solve metadata, scoped history/equipment,
  previews, and combined activity/event-specific Progress/Profile statistics.
- Atomic local v2 migration with retained original bytes, Web Locks, stale/older
  writer guards, and schema-aware backup/import/sync boundaries.
- Server compatibility migration and SQL/API summary parity checks, still
  separate from hosted deployment and production activation.

See [the feature plan](multi-event-timer.md) for full history and scope.

## Latest 4×4 milestone

The internal `four-by-four-joint-generator.js` uses a fixed profile: 10M joint
nodes, 50M finish nodes, eight requested candidates, four-pair beam search,
width 1,024, depth 32, and the existing 512-move ceiling. Provenance is
`last-layer-444-joint`, version `1`, method `random-state`. Exact shallow-state
exclusion is the only target resampling; hard search failures never substitute
another target or generator. Constructive revision 2 remains a separate complete
reference. Beam search is bounded and incomplete, even though the corpus passes.

The larger corpus found target 879 spending its whole phase-two budget seeking
extra candidates despite usable candidates already existing. Joint orchestration
now stops optional collection after half the shared budget once a verified
candidate exists. Late first candidates retain the original hard limit;
standalone phase-two search remains strict by default. The exact failing target
is a permanent regression, as are the five previously fixed beam failures.

Final results:

- **1,024/1,024** seeded targets independently verified against all 96 stickers;
  no failures/resampling. Lengths 46–72, median 59, p95 67. Maximum joint work
  5,464,291 nodes. Default beam workspace: 2,365,464 typed bytes, excluding tables.
- Node worker probe passes cold/warm generation, termination after generation
  begins, and a fresh-worker retry of the same cancelled seed. This is not actual
  browser-provider, mobile resource or paint-performance evidence.
- Low-level `444bf` adapter uses that generator plus independent uniform
  orientation. All 24 choices preserve the same sampled target under independent
  sticker verification. Separate provenance: `last-layer-444bf-joint-orientation`.
- Latest `npm run verify:fast`: **729 Node tests**, zero Svelte diagnostics,
  build budgets pass at 254.6 KiB JS / 25.9 KiB CSS gzip. Changed declarations pass
  TypeScript. Focused blindfolded suite: 11 tests. New tests first failed against
  the unsupported 444bf adapter, then passed after implementation.

Reproduction commands (non-browser):

```sh
npm run verify:fast
node scripts/benchmark-444-joint.mjs 1024 10000000 4 8 beam
node scripts/benchmark-444-worker.mjs 4
node --test tests/cube-scramble-444-blindfolded.test.js tests/cube-scramble-big-cubes.test.js
```

The full corpus takes several minutes. Do not repeat it merely to recover context.
Proofs, resource scopes and historical results are in
[the 4×4 design](../../packages/cube-engine/scramble/four-by-four-state.md).
Optional local logs: `/tmp/events-444-qualified-corpus.log`,
`/tmp/events-444-qualified-worker.log`, `/tmp/events-444-qualified-final-fast.log`,
`/tmp/events-444bf-before.log`, `/tmp/events-444bf-focused.log`,
`/tmp/events-444bf-fast.log`. These temporary files may not survive another machine;
the checked-in docs and tests are the durable record.

## Next bounded task: actual browser worker qualification

1. Inspect `packages/cube-engine/worker/{entry,index,events}.js`, its declarations,
   `tests/e2e/cube-engine-worker.spec.js` and the existing package fixtures.
   **Adding an ID to `SUPPORTED_SCRAMBLE_EVENT_IDS` also enables it in the dev
   timer**: `src/main.js` uses that list directly. Do not silently activate the
   timer just to create a test harness. Prefer an isolated qualification fixture,
   or deliberately separate tested engine support from app release availability.
2. Prepare real module-worker checks for 444/444bf: cold/warm initialization,
   cancellation during work, restart, stale-response protection, exact output
   and provenance, and memory observations with explicit measurement limits.
   The provider currently cancels by terminating its worker; there is no runtime
   wall-clock timeout. Public requests must not accept injected RNG/budget options.
3. Complete implementation and fast checks, then request approval for the exact
   browser tranche. `AGENTS.md` requires approval before browser tests,
   automation or screenshots; older approvals covered older tranches. **No
   browser verification ran for the latest 4×4 changes, and no new tranche is
   currently approved.** Use isolated servers, never personal storage/preview.
4. After qualification, add lazy worker routing/types for 444 and 444bf, update
   availability/provenance assertions, and verify affected timer/NxN flows at
   320px portrait and 667×375 landscape. Keep production activation separate.
   Existing dedicated app suite: `npm run test:e2e:events`, isolated port 4191;
   its config only selects `multi-event.spec.js`, not package worker specs.

Broader work after that: signed-in recovery/export UX and browser coverage,
storage-capacity and missing-Web-Locks behavior, operational migration ordering,
conformance review and explicit production activation. Follow the
[rollout checklist](multi-event-rollout-checklist.md); do not infer completion
from the earlier guest/browser or SQL/API passes. Keep PR #29 draft until its
release gates are satisfied.
