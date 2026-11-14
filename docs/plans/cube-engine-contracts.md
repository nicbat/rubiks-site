# Initial engine and multi-event data contracts

Design contract, November 14, 2026. These proposed interfaces unblock parallel
work; they are **not implemented generator or backup-v2 APIs**. The current engine
extracts existing 3×3 mechanics/playback/renderer only. See the
[multi-event delivery plan](multi-event-timer.md) for scope and release gates.

## Identities and ownership

| `PuzzleId` | `EventId`               |
| ---------- | ----------------------- |
| `2x2`      | `222`                   |
| `3x3`      | `333`, `333oh`, `333bf` |
| `4x4`      | `444`, `444bf`          |
| `5x5`      | `555`, `555bf`          |
| `6x6`      | `666`                   |
| `7x7`      | `777`                   |

These ten IDs are the initial recordable event vocabulary, not a statement of
current engine support. The integration owner owns the single app event registry:
labels, puzzle mapping, availability and statistics policy. Engine-owned policy
definitions specify supported generation strategies by event ID; they do not own
UI labels or release flags. Tests verify their mappings agree. Coming-soon entries
cannot generate or record solves. Keep course puzzle IDs unchanged.

## Generation boundary

```ts
generateScramble({ eventId, signal? }): Promise<{
  eventId: EventId;
  puzzleId: PuzzleId;
  algorithm: string;
  generator: {
    id: string;
    version: string;
    method: "random-state" | "random-move";
  };
  grip: { up: CubeColor; front: CubeColor };
}>;
```

`signal` is an optional `AbortSignal`; `CubeColor` is `white`, `yellow`, `green`,
`blue`, `red`, or `orange`. Up/front must be adjacent distinct colors in the
standard scheme: white/yellow, green/blue and red/orange are opposite pairs;
white-up/green-front puts red on the right. New generation uses that starting grip.
Grip describes the **starting solved orientation**, not a camera angle or final
orientation; blindfolded orientation moves remain part of `algorithm`.

`algorithm` is the exact display/persistence string: bounded, event-compatible
notation validated before resolving. `generator.id` identifies the implementation;
`version` identifies its policy/code/table revision, not merely the app version.
Methods describe the actual strategy; neither value asserts official approval.
No runtime network access or renderer dependency belongs in this API.

Reject with an error whose stable `code` is `UNSUPPORTED_EVENT`,
`GENERATION_FAILED`, or `ABORTED`; cancellation also has `name: "AbortError"`.
Messages are diagnostic text, not a parsing contract. Never silently substitute
another event/strategy or resample a hard state after a solver timeout.
Aborted requests must not publish results, though worker computation may finish.
The app additionally uses generation tokens: discard stale responses after event,
account, import or session changes even if cancellation arrived too late.

## Persistence and equipment

Training backup v2 requires `solve.eventId`; existing ID/time/day/penalty/notes and
equipment references retain their meanings. Map generation results exactly:

```js
{
  eventId: result.eventId,
  scramble: result.algorithm,
  scrambleProvenance: { ...result.generator },
  scrambleGrip: { ...result.grip }
}
```

Do not persist a redundant solve `puzzleId`; resolve it through the stable event
mapping. Native-v2 records require a valid event and grip; provenance is optional
because historical sources may not identify a generator. New timer-created
records require all three fields. Migration assigns every v1 solve `eventId: "333"`
and legacy yellow-up/green-front grip, preserves scramble bytes, and leaves unknown
provenance absent. This matches the existing renderer's U/F color identities;
do not reinterpret older previews using the new default grip. Learning grips stay
independent. Import syntax validation does not certify scramble distribution.

V2 equipment records add `puzzleId`. `cubeCollection` contains `cubes` and
`defaultsByEvent: Partial<Record<EventId, string>>`; absent means no default, never
an arbitrary fallback. Each value must name live equipment of the event's puzzle.
Migrate untyped legacy equipment provisionally to `3x3`; map non-null legacy
`defaultId` to `defaultsByEvent["333"]` only. Native-v2 exports omit `defaultId`;
v1 remains an input format, not a writable compatibility projection. Never change
solve events when changing equipment. Retain deleted equipment for history;
reclassification conflicting with referenced solves is blocked in the initial UI.

## Profile summary boundary

Proposed `summary_version: 2` adds `activity` and `events`. `activity` contains
combined `solve_count`, `total_time_ms`, `practice_count`, and `active_days`.
Time uses raw elapsed duration, and active days are the union of recorded activity
days; preserve the existing UTC fallback only when a saved local day is absent.
`events[eventId]` contains `solve_count`, `total_time_ms`, `best_ms`, `median_ms`,
`best_ao5_ms`, and `best_ao12_ms`. Return all ten event keys with zero counts/time
and null unavailable speed values; event policy controls which metrics are shown.
Rolling windows contain only that event's chronological solves, preserving current
penalty/DNF semantics. Do not invent new average field names or official formats.

Existing top-level `confident_count`/`case_count` retain their Full CFOP scope.
For old consumers, retain flat `practice_count`/`active_days` as combined learning
activity, but keep flat `solve_count`, `total_time_ms` and all speed fields equal
to `events["333"]`. New clients read combined totals from `activity`. SQL and JS
implementations and both public RPC projections must agree and preserve privacy.

## Shared fixtures and contract review

Share immutable v1/v2 fixtures with identical legacy IDs/dates/scrambles, all ten
events, interleaved fast/slow solves, DNF/+2, missing local dates, deleted equipment,
default migration and invalid event/grip/notation cases. Include unknown provenance,
original fingerprint baselines, stale-v1 writes and storage rollback scenarios.
Generation/lifecycle tests use deterministic injected providers; real engines have
separate oracle/conformance checks. Never derive expected results from the code
under test. The integration owner coordinates fixture changes across workstreams.

Review this contract jointly before runtime schema implementation. Version public
API changes through package semver, backup changes through backup version, and
summary changes through `summary_version`; generator revisions are separate.
Deploy compatible server validation/projections before v2 writers, reject snapshot
downgrades at table level, and do not enable recording before all consumers agree.
