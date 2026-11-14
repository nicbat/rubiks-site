import type { FourByFourState } from "./four-by-four-state.js";
/** True exactly for states at most one outer block turn from solved, modulo rotation. */
export function isShallowFourByFourState(state: FourByFourState): boolean;
