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

All returned state/facelet arrays are independent. Validation checks complete arrays, permutations, color multiplicities and twist sum. Tests compare every move and seeded sequences against independent cubing.js geometry for all 96 stickers, check literal corner states and labeled-center parity, exercise both wing parities, construct legal center-label witnesses, and verify entropy rejection, cancellation and invalid-input failures. These checks establish a foundation; full sampled-target solver/oracle verification remains a later milestone.

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
