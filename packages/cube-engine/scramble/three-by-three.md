# Original 3×3 and one-handed random-state engine

This engine samples a legal fixed-center 3×3 state, solves it with an original
implementation of the two-phase method, and reverses that solution to produce
the scramble. Regular 3×3 and one-handed share this physical distribution. The
worker keeps their event IDs distinct. Blindfolded generation is not enabled:
that requires an additional uniform orientation step.

The mathematical method and coordinate sizes follow Herbert Kociemba's
[description](https://www.kociemba.org/math/twophase.htm) and
[phase-depth bounds](https://www.kociemba.org/math/imptwophase.htm). No solver
source was copied or imported. cubing.js is only an independent test oracle.

## Sampling and exclusions

Fisher–Yates samples all eight-corner and twelve-edge permutations independently.
If their parities differ, swapping the first two edge pieces corrects parity.
Each legal matched permutation has exactly two equally likely preimages, so this
correction does not bias the legal states. Seven independent corner trits and
eleven independent edge bits determine their final constrained orientations.
Every bounded draw uses uint32 rejection sampling over Web Crypto output.

An exact set excludes solved and all eighteen one-face-turn states. Repeating
sampling for those nineteen states preserves uniformity over eligible targets.
There is no random-move fallback. Solver failure, cancellation, or exhausted
search budget rejects the request; it never triggers automatic resampling.
This targets the distribution and minimum-distance requirements of
[WCA 4b3](https://www.worldcubeassociation.org/regulations/#4b3), and does not make
this an officially approved competition scramble program.

## Search, resources, and lifecycle

Phase one uses corner orientation (2,187), edge orientation (2,048), and slice
membership (495). Two complete paired-coordinate BFS tables provide lower bounds.
Phase two uses corner permutation (40,320), non-slice edge permutation (40,320),
and slice permutation (24), with two further complete paired-coordinate tables.
IDA search first reaches the phase-two subgroup within twelve face turns, then
solves within eighteen subgroup moves. This implementation accepts the first
phase-one solution; it does not optimize the combined length. Its output may be
longer than the shortest possible scramble for that state.

The four distance arrays and transition/mask tables retain **5,823,197 bytes** of
typed-array storage. The largest individual temporary BFS queue is **4,330,260
bytes**. These figures exclude JS objects, engine overhead, and garbage awaiting
collection. All table shapes are fixed; there is no target-indexed growing cache.
The async table initialization is shared. A cancelled caller cannot publish a
result or invalidate another caller's initialization. Production uses a worker;
the async function alone does not move CPU work off the calling thread.

A default fifty-million-node search cap bounds a single attempt. Reaching that
cap returns `GENERATION_FAILED`. Tests can lower the cap to exercise that failure;
worker messages cannot select it or inject entropy. Public low-level entropy
injection exists strictly for deterministic testing, not production configuration.
Exposed targets and diagnostic arrays are detached from shared solver tables.

## Evidence and remaining limits

Node tests compare generated corner and edge states directly with cubing.js,
exercise every excluded state, accept two-turn/subgroup states, verify both parity
preimages, test entropy-tail rejection and failures, and check cancellation and
failure without target replacement. Worker tests cover both event IDs, shared
routing, provenance, starting grip, and mismatched replies.

A separate 512-target seeded xorshift32 run (seed `0x333c0de`, one cold generation
followed by 512 warm generations) checked every resulting corner/edge state
against cubing.js. There were **zero failures**. On Node 26.13.0, Linux x64,
i9-11900H, cold initialization plus first generation measured **571.90 ms**;
warm median/p95/maximum measured **7.10 / 38.27 / 154.90 ms**. The largest search
visited **4,601,145 nodes**. These are local diagnostic samples, not guarantees
for all legal targets or mobile hardware. Timings exclude independent oracle
checks and browser worker startup. No browser execution has been performed for
this addition. Broad hard-state coverage and independent conformance review
remain release work; the measurements do not confer official approval.
