import type { FourByFourState } from "./four-by-four-state.js";
/** Detached r[A position]=matching B position, with B order aligned to geometric
 * edge mates. Requires balanced identities and even wing/handedness parity.
 * Center subgroup and final reduced PLL parity are checked by the orchestrator. */
export function relativeFourByFourWings(state: FourByFourState): Uint8Array;
export function moveFourByFourRelativeWings(
  relative: readonly number[] | Uint8Array,
  moveIndex: number,
): Uint8Array;
/** Admissible maximum over four disjoint physical three-pair patterns. Pattern
 * selection may change identities at each node; each lookup remains a relaxation.
 * Returns zero exactly when the wings are paired, ignoring centers and corners. */
export function fourByFourWingPairingHeuristic(
  relative: readonly number[] | Uint8Array,
  options?: { signal?: AbortSignal },
): number;
/** Internal hot-loop API: validate with coordinate once. moveInto/heuristic trust
 * even Uint8Array(12) inputs and index 0..19; output must be distinct. No per-node
 * allocation or mutable table exposure. Cancellation is checked during setup;
 * the orchestrator owns cancellation and node/depth budgets during its search. */
export function createFourByFourJointWingSearch(options?: {
  signal?: AbortSignal;
}): Readonly<{
  moves: readonly string[];
  orbitA: readonly number[];
  orbitB: readonly number[];
  coordinate: typeof relativeFourByFourWings;
  moveInto(
    relative: Uint8Array,
    moveIndex: number,
    output: Uint8Array,
  ): Uint8Array;
  heuristic(relative: Uint8Array): number;
}>;
export function fourByFourJointWingDiagnostics(options?: {
  signal?: AbortSignal;
}): {
  partialCoordinates: number;
  coordinates: number;
  goalCoordinates: number;
  maximumDistance: number;
  retainedBytes: number;
  queueBytes: number;
  transitionBytes: number;
};
