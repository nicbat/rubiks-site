import catalog from "../data/f2l.json" with { type: "json" };
import { applyAlg, solvedCube, centers, inverse } from "./cube.js";
export { catalog as f2lCases };
export function f2lSetup(algorithm) {
  const destination = centers(applyAlg(solvedCube(), algorithm));
  const rotation = ["", "y", "y2", "y'"].find((move) => {
    const candidate = centers(applyAlg(solvedCube(), move));
    return Object.keys(candidate).every(
      (face) => candidate[face] === destination[face],
    );
  });
  if (rotation === undefined)
    throw new Error("Unsupported F2L center orientation");
  return [rotation, "U", inverse(algorithm)].filter(Boolean).join(" ");
}
