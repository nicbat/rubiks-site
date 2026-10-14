import reference from "../data/two-by-two.json" with { type: "json" };
import { inverse } from "./cube.js";

export const twoByTwoLessons = reference.lessons;
export const twoByTwoAlgorithms = reference.algorithms;
export const twoByTwoSetup = (algorithm) => inverse(algorithm.moves);
