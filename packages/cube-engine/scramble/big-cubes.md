# Big cubes and blindfolded orientation

These original generators support 5×5, 6×6, 7×7, and 3×3/4×4/5×5 blindfolded. They implement the policies below; they are not WCA-approved software. Independent state checks establish mechanical correctness, not official certification or a proof of mixing quality. The low-level 4×4 blindfolded adapter uses the fixed-profile joint random-state generator; 4×4 worker/timer routes remain disabled pending browser/mobile qualification.

## Policy and provenance

[WCA Regulation 4b3](https://www.worldcubeassociation.org/regulations/#4b3) requires a uniform random state for most events, permits sufficiently many random moves for 5×5–7×7 (4b3e), requires a uniformly random orientation for blindfolded events (4b3a), and excludes states requiring fewer than two moves, except the stronger 2×2 restriction. The 3×3 blindfolded base uses the existing uniform legal-state sampler and bounded two-phase solver; see [three-by-three.md](three-by-three.md).

The big-cube lengths and inventory were compared against the primary TNoodle-lib source at commit `d01a947d9f028f38085cda9b0507a9cf3d3f38a8`:

- [CubePuzzle.java](https://github.com/thewca/tnoodle-lib/blob/d01a947d9f028f38085cda9b0507a9cf3d3f38a8/scrambles/src/main/java/org/worldcubeassociation/tnoodle/puzzle/CubePuzzle.java): 60, 80, and 100 moves respectively; block widths through half the cube; omit redundant opposite-face half-width blocks on even cubes.
- [Puzzle.java](https://github.com/thewca/tnoodle-lib/blob/d01a947d9f028f38085cda9b0507a9cf3d3f38a8/scrambles/src/main/java/org/worldcubeassociation/tnoodle/scrambles/Puzzle.java): generic random-move generation and redundancy exclusion.
- [NoInspectionFiveByFiveCubePuzzle.java](https://github.com/thewca/tnoodle-lib/blob/d01a947d9f028f38085cda9b0507a9cf3d3f38a8/scrambles/src/main/java/org/worldcubeassociation/tnoodle/puzzle/NoInspectionFiveByFiveCubePuzzle.java) and [NoInspectionThreeByThreeCubePuzzle.java](https://github.com/thewca/tnoodle-lib/blob/d01a947d9f028f38085cda9b0507a9cf3d3f38a8/scrambles/src/main/java/org/worldcubeassociation/tnoodle/puzzle/NoInspectionThreeByThreeCubePuzzle.java): base generator plus randomized orientation.

No solver source was copied and no TNoodle or cubing.js code runs in production. Our random-move distribution is not claimed to be identical to TNoodle. In each trailing run on one axis, each face/block-width basis may occur once. Distinct block boundaries are independent modulo global rotation; excluding repeated bases prevents cancellation or merging across commuting intervening moves. Every remaining quarter/half/inverse turn is equally likely at the next choice. All integer draws use crypto uint32 rejection sampling, never modulo-biased draws or Math.random.

## Distance and orientation

For big cubes, final states are compared against the solved state and every legal one-block-turn state modulo global rotation. Canonical orientation fixes the physical DBL corner, which also works on even cubes without fixed centers. Complementary blocks wider than half the cube are equivalent to a supported narrow block plus rotation. Only this distance exclusion causes a fresh full-length sequence to be sampled. Caches contain three fixed-size move inventories and shallow-state sets, plus 24 orientation corrections; targets are never cached.

Blindfolded generators independently sample one of all 24 proper cube orientations after generating the base. They append explicit `x`, `y`, or `z` rotations. [WCA 12a4](https://www.worldcubeassociation.org/regulations/#12a4) defines this notation and [12a5](https://www.worldcubeassociation.org/regulations/#12a5) counts rotations as zero moves. This differs from TNoodle's odd-cube wide-turn orientation encoding; our suffix preserves the exact base state up to a global rotation. Mechanical equivalence and valid notation do not establish approval for official competition scramble sheets. Keep that conformance distinction visible before distributing official-event material.

Generator provenance uses version `1`: `last-layer-555-random-move`, `last-layer-666-random-move`, `last-layer-777-random-move`, `last-layer-333bf-two-phase-orientation`, `last-layer-444bf-joint-orientation`, and `last-layer-555bf-random-move-orientation`. A materially changed distribution or solver policy requires a version change.

## Execution and checks

Use the asynchronous worker provider in production. It exposes immutable `SUPPORTED_SCRAMBLE_EVENT_IDS`; 4×4 events fail explicitly. Abort terminates the worker, including synchronous solver work. Direct generator entropy injection is for deterministic tests only and is never accepted by the worker protocol. Entropy failures and solver budget failures are explicit; there is no random-move substitute for a random-state event.

Node regressions compare complete sticker states against independent cubing.js puzzle geometry for 5–7, all 24 actual orientation choices for all three blindfolded generators, every supported shallow move including complementary blocks, same-axis redundancy, a deliberately generated solved candidate that must be rejected, invalid entropy, cancellation, and worker event/provenance binding. Browser worker execution remains a separate approval-gated check.
