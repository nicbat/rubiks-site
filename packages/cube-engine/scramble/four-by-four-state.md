# 4×4 observable state foundation

This module supplies a sampler, move model, validation and 96-sticker projection. It does **not** solve sampled states, generate scrambles, filter shallow states, or enable 444/444bf. No third-party solver code or runtime dependencies are included.

The state has four arrays, each destination-to-source where applicable:

- `cornerPermutation`: eight distinct piece indices in `URF UBR ULB UFL DFR DLF DBL DRB` order.
- `cornerOrientation`: eight trits summing to zero modulo three. A positive twist shifts the source corner's face-color tuple right.
- `wingPermutation`: 24 distinct physical wings, with no independent orientation field.
- `centerColors`: 24 values indexing `U R F D L B`, each occurring four times.

`FOUR_BY_FOUR_COORDINATES` freezes explicit positions and ordered face names for all slots. Wings and centers sort by the code-unit lexicographic string of their Cartesian positions; consumers should use exported metadata rather than derive the order. Coordinates use half integers with exterior extent 1.5. Wing normal ordering makes the scalar triple product of position and its two normals positive. Proper rotations preserve this sign, determining which sticker faces which way for every destination/source combination, including opposite wings of one apparent edge.

## Legality and uniformity

The labeled 4×4 solvability criterion requires corner/center permutation parity equality, corner twist sum zero, and wing orientation determined by the wing's identity and position; it does not impose the 3×3 corner/edge permutation parity relationship. See the primary mathematical treatment [The first law of cubology for the Rubik's Revenge](https://arxiv.org/abs/1611.07437) and its generalization [On the n×n×n Rubik's Cube](https://arxiv.org/abs/1708.05598).

Our centers are ordinary single-color stickers, not distinguishable supercube labels. For every center coloring there are `(4!)^6` labeled preimages. Exactly half have either parity: exchanging two labels of the same color toggles permutation parity without changing any visible sticker. Thus any corner permutation and any center coloring admit the required labeled witness. Imposing another parity filter on center colors or wings would incorrectly exclude legal states.

Fisher–Yates independently samples corners, wings, and a center array containing four copies of each color. Every center coloring has the same number of shuffle preimages. Seven independent uniform corner trits determine the eighth. Every draw uses crypto uint32 rejection sampling through the existing random-source boundary. `randomUint32` is a deterministic testing hook only. The sampler includes solved/shallow states intentionally: future scramble generation must apply the exact distance exclusion separately. No failure path substitutes random moves or resamples a hard target.

## Moves and boundaries

The 36 outer/wide face moves derive permutations from our existing geometric core, then apply compact coordinate transitions. The effect cache is bounded to those 36 tokens. `fourByFourCenterMovePermutation` exposes immutable destination-to-source center indices for the separate phase-one coordinate implementation. Algorithms accept canonical single-space sequences with at most 512 tokens and 4,096 characters. Whole rotations are intentionally outside this stage's move inventory; the later blindfolded adapter owns orientation.

All returned state/facelet arrays are independent. Validation checks complete arrays, permutations, color multiplicities and twist sum. Tests compare every move and seeded sequences against independent cubing.js geometry for all 96 stickers, check literal corner states and labeled-center parity, exercise both wing parities, construct legal center-label witnesses, and verify entropy rejection, cancellation and invalid-input failures. These checks establish a foundation; the complete constructive reference solver below adds sampled-target solver/oracle verification.

## Opposite-center first stage

The internal `four-by-four-centers.js` module groups one selected opposite color
pair onto its two corresponding faces. It does not distinguish those two colors
within the group, finish the other centers, or pair wings. It has no package
export or worker route while the complete reduction solver is unfinished.

An original colexicographic eight-of-24 coordinate has 735,471 states. Tests
exhaustively check its rank/unrank bijection and compare all 36 transitions with
full state moves and the independent 96-sticker oracle. Bidirectional BFS expands
one complete frontier from the smaller side. Parent paths reconstruct a sequence
from the supplied state to the grouping condition, without entropy or resampling.

An explicit `maxNodes` bounds expanded coordinates, with at most 36 outgoing
transitions per expansion. Nontrivial calls allocate 13,238,478 bytes of typed
search arrays regardless of the budget; this is not a peak process-memory claim.
Those arrays are released after each call. The bounded move-bit cache occupies
3,456 bytes and the binomial arrays 900 bytes, excluding object overhead. Already
grouped inputs allocate no search arrays. Cancellation requires terminating the
worker because search is synchronous. Resource failures preserve the exact input.

Seeded legal sequences and uniformly sampled states exercise grouping, input
isolation and explicit budget failures. Later stages still need their own subgroup
proofs, parity handling, complete sampled-target equality and resource review.

## Complete constructive reference solver

`four-by-four.js` now solves an exact sampled state and inverts its solution for
random-state generation. It is internal: no package export, worker route or timer
activation. This is a correctness baseline, not yet a practical competition-style
scrambler: the measured sequences are much longer than desirable for normal use.

The pipeline retains every operation as actual moves:

1. Normalize odd corner permutation with `R`, then odd wing permutation with the
   inner slice `Rw R'`. The latter leaves corners unchanged.
2. Solve center colors with conjugated three-cycles. An original enumerated
   commutator, `U Rw U' Lw U Rw' U' Lw'`, cycles three centers and preserves corner
   and wing permutation parity. Twenty-five deterministic assignments of invisible
   same-color labels choose a shorter solution without changing the visible target.
3. Solve the now-even wing permutation using the independently checked pure wing
   cycle `Uw U' R U Uw' L Uw U' R' U Uw' L'`. Its conjugates preserve corners and
   labeled centers exactly. Wings finish at identity, stronger than just pairing.
4. Strictly convert the fixed-center paired state into the existing 3×3 target
   format and solve it. The converter independently diagnoses flipped-edge and
   permutation parity; it never silently repairs either.

Each constructive stage routes all 12,144 ordered triples using a bounded BFS
with maximum setup depth five. Each retains 41,472 bytes of typed routing arrays.
The center stage has a conservative bound of 396 uncombined moves. Both stages
stay within the existing 512-token per-sequence boundary. Same-axis commuting
turns are combined across the four stages. The final output still must fit 512
moves; a length failure is explicit and does not resample the target. This corpus
is not proof that every target will fit. Node limits apply to the 3×3 finish;
constructive work has fixed combinatorial bounds. The earlier opposite-center
BFS is retained and tested but is not used by this constructive pipeline.

Generation samples the observable state uniformly and excludes exactly zero/one
outer-block-turn states modulo all 24 proper rotations. Three-layer block moves
are opposite one-layer turns modulo a rotation. Tests independently verify every
shallow move/orientation and genuine two-turn examples. Only shallow states are
resampled. Solver, length and entropy failures propagate. See
[WCA Regulations 4b3 and 12a](https://www.worldcubeassociation.org/regulations/)
for the underlying distance and notation requirements; this is not official
approval or a completed conformance review.

### Reproducible correctness and resource corpus

Run `node scripts/benchmark-444.mjs 1024`. Seed `0x444c0de` generated 1,024 targets,
all independently checked against all 96 stickers using cubing.js. No node/length
failures occurred. Observed moves: median 348, p95 382, maximum 408. This is too
long for the intended timer experience; shorter center/wing reduction remains a
release gate despite the successful correctness corpus.

On Node v26.13.0, Linux x64, Intel i9-11900H, cold generation took 2,228 ms;
warm median/p95/max were 23/132/947 ms. These are Node elapsed generation times,
not browser paint or worker latency; other validation ran concurrently, so they
are diagnostic observations rather than isolated performance claims. Oracle work
is excluded from those intervals. Whole-process peak RSS was 128,159,744 bytes,
including the oracle and Node. The reused 3×3 finish retains 5,823,197 bytes of typed
tables with a largest initialization queue of 4,330,260 bytes. These table sizes
are not browser peak heap estimates. Cancellation during synchronous stages
requires terminating a worker; no worker integration is enabled here.

Center assignment optimization was measured on the same 1,000-state seed-444
corpus: median/p95/max center-stage length fell from 280/314/335 to 123/143/156.
The general renderer benchmark was run before and after; it measures unrelated
Node rendering work and does not establish a cube-solver performance improvement.

## Shorter staged reduction (generator revision 2)

The constructive solver and measurements above describe revision 1 and remain
useful as a correctness baseline. The active internal generator now uses three
center coordinates followed by legal wing pairing, instead of solving all wings
to identity. It remains unexported and disconnected from the timer worker.

- Phase one groups UD colors using the existing eight-of-24 coordinate. Its
  expanded-node bound is twice 735,471, and its temporary search arrays occupy
  13,238,478 bytes per nontrivial call.
- Phase two groups RL colors without disturbing UD, while also establishing even
  wing permutation parity. All 25,740 coordinates (`C(16,8) × 2`) are reachable
  under 28 pair-preserving moves, with maximum distance eight. The routing arrays
  retain 77,220 bytes. The parity bit is essential: the new short center stages
  do not preserve the original wing parity like the earlier commutators did.
- Phase three sorts individual colors within the three opposite pairs. All
  `70³ = 343,000` colorings are reachable under 18 outer moves and six wide half
  turns, at maximum distance eleven. Its distance and factored transition arrays
  occupy 348,040 bytes, plus small coordinate metadata; initialization uses a
  1,372,000-byte queue. These moves preserve even wing parity.
- Wing pairing selects a legal reduced edge permutation/orientation matching the
  actual corner parity. A bounded assignment dynamic program tracks the twelve
  used edge identities, permutation parity and flip parity. Eight deterministic
  tie-break choices and a legal baseline goal seek shorter three-cycle solutions.
  Corners and labeled centers remain fixed, while both ordered wing colors must
  match. The strict reduction validator checks the resulting 3×3 target.

There is no preliminary corner/wing normalization now. The phase-two parity bit
and the legal paired goal establish the required conditions through actual moves.
Every candidate solves the same target. No target is resampled to obtain a shorter
sequence. The 512-move limit, 3×3 node budget and explicit failures remain.
The reported `stageLengths` are now centers, wing pairing and 3×3 finish, before
cross-stage cancellation. Revision 1's field included a separate normalization.

### Next boundary for genuinely short solutions

Center-only search still commits to an endpoint without considering the wing work
it creates. A joint phase-two search must establish the wing constraints for a
more restrictive phase three. Read-only experiments with our own move tables
verified a 20-move subgroup: R/L/F/B outer turns, U2/D2 and six wide half-turns.
It preserves two twelve-wing orbits and reaches 58,800 center colorings, rather
than all 343,000. Therefore the current center-only phase three cannot simply
be reused as that joint solver.

The proposed joint phase-two leaf needs grouped centers, a UD coloring in the
restricted orbit, even wing permutation, one wing of each edge identity in each
orbit, and even cross-orbit handedness. Its center/parity heuristic can start
unquotiented at `C(16,8) × C(8,4) × 2 = 1,801,800` byte distances. These are derived
sizes and proposed invariants, not an implemented search or performance promise.
The following phase needs a relative-wing permutation heuristic and candidate
selection across phase boundaries. Independent counterexamples must verify every
leaf condition before activation. The primary reference documents the subgroup
structure and separate wing predicates ([moves](https://raw.githubusercontent.com/cs0x7f/TPR-4x4x4-Solver/master/src/Moves.java),
[wing conditions](https://raw.githubusercontent.com/cs0x7f/TPR-4x4x4-Solver/master/src/EdgeCube.java));
no reference implementation code was copied.

### Revision 2 corpus and tradeoffs

The same 1,024 targets (seed `0x444c0de`) passed independent full-sticker checks
with no node/length failures. Total median/p95/max length is now **144/154/163**,
down from **348/382/408**. Before cross-stage cancellation, center-stage lengths
were 19/22/25, wing pairing 107/114/128 and the 3×3 finish 23/25/27. This is a large
reduction, but still too long for the intended timer scrambler; joint wing-aware
search remains necessary. Tests retain the identity/constructive baselines and
add fixed-corpus length regressions that fail against revision 1.

Using the same Node/CPU environment, observed cold generation was 2,066 ms and
warm median/p95/max 50/154/995 ms. Whole-process peak RSS, including Node and the
oracle, was 194,592,768 bytes. These shared-machine elapsed-time observations are
not isolated browser benchmarks. The shorter sequences require more assignment
work and larger temporary search storage; this is a move-count improvement, not
a claim of lower CPU cost or memory. The previous baseline's process RSS was
128,159,744 bytes. Exact typed-table/queue sizes are emitted by the corpus script;
they do not measure JavaScript-object overhead or mobile peak heap.

The raw run is `/tmp/events-444-short-corpus.log`. General rendering benchmark
logs are `/tmp/events-444-short-benchmark-before.log` and
`/tmp/events-444-short-benchmark-after.log`. Those workloads do not execute the
solver and cannot establish its performance. No browser or worker measurements
were made. During the awaited 3×3 finish, abort is checked after that finish
returns; prompt cancellation still requires terminating the owning worker.

## Experimental joint reduction

`four-by-four-joint.js` now composes UD grouping, wing-aware phase two, joint
phase three, and the strict 3×3 finish. This is an internal experiment alongside
revision 2, not a replacement generator or worker route. It currently chooses
one phase-two candidate. Search failures preserve the exact input target; there
is no retry with a different sample or fallback to random moves.

The original geometry-derived boundary records two twelve-wing orbits, twelve
allowed UD masks, grouped opposite colors, even wing permutation, one copy of
each edge identity in each orbit, and even handedness. These are reduction
admissibility conditions, not a claim that every full labeled state is in one
fixed-frame subgroup. In particular, reduced PLL parity is handled separately.

Phase two uses an exact projected distance on C(16,8) × C(8,4) × 2 = 1,801,800
states and propagates actual wings to check every candidate. All projected
states are reachable; maximum distance is 9. Retained typed arrays total
2,655,836 bytes, plus a temporary 7,207,200-byte BFS queue. Candidate count is
bounded at 32 and depth at 32. Exhausting the explicit shared node budget throws,
even if fewer than the requested candidates were found; the experimental
orchestrator requests one.

Phase three uses twenty moves: R/L/F/B outer turns, U2/D2, and wide half turns.
The center coordinate has 12 × 70 × 70 × 2 = 117,600 states; the parity bit is
corner-permutation parity XOR edge-identity parity in one wing orbit. At a
paired-wing endpoint this is the reduced PLL parity. The exact graph has maximum
distance 10, retains 122,176 typed bytes and uses a temporary 470,400-byte queue.
Legal reduced endpoints of either corner parity map to its goal.

The relative wing permutation maps each A-orbit position to the B-orbit position
holding its matching edge identity. B positions are aligned to their physical
edge mates, making paired wings the identity permutation. A fixed subset of
this relative permutation is **not closed** under moves, because both its domain
and range move. Instead, the original pattern database tracks both physical
endpoints of three labeled pairs: (12P3)² = 1,742,400 coordinates, with 1,320
paired goal placements. All states are reached; maximum distance is 7. The
maximum of four triple lookups is admissible; it is not an additive heuristic.
The table and retained move metadata use 1,743,120 typed bytes, with a temporary
6,969,600-byte queue and 105,600 bytes of construction transitions. Counts exclude
JavaScript objects and runtime overhead.

Bounded IDA* combines the maximum of the center and wing bounds, with reusable
per-depth buffers, safe same-block pruning and commuting-axis ordering. A found
endpoint must pass strict 4×4→3×3 reduction, then exact solved-state verification
after the finish. The joint phases share one explicit node budget; the 3×3
finish has a separate explicit budget. Phase one retains its fixed coordinate
bound. Abort checks cover entry and synchronous search/table loops; prompt
external cancellation still requires terminating the worker. No worker is wired
up for this experiment.

Short subgroup fixtures pass independent 96-sticker checks, but this heuristic
is too weak for practical random targets. Reproduce the bounded experiment with
`node scripts/benchmark-444-joint.mjs 4 10000000`: every sampled target is counted,
including failures, using seed `0x444c0de`. Do not interpret a successful shallow
fixture as evidence of practical random-state generation. The next work is a
stronger relative-wing bound (with an explicit memory budget) and candidate
selection across phase boundaries, then the unchanged full-corpus, worker and
mobile release gates. Revision 2 remains the complete reference solver.

The first four-target run exhausted the 10,000,000-node shared budget in phase
three on **all four targets (zero solved)**. Elapsed times were 12.07, 23.32,
8.45 and 15.55 seconds; the first includes cold initialization. Environment:
Node 26.13.0, Linux x64, Intel i9-11900H, concurrent validation on the shared
machine. Peak whole-process RSS was 115,310,592 bytes. These are failure timings,
not successful generation latency, and no independent target-success count is
claimed for this corpus. Raw results: `/tmp/events-444-joint-corpus.log`.
General render benchmarks ran before/after in
`/tmp/events-444-joint-benchmark-before.log` and
`/tmp/events-444-joint-benchmark-after.log`; they do not exercise this solver.
