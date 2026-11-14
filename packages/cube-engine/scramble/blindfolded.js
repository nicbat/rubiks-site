import { createScrambleError } from "./index.js";
import { sampleCubeOrientation } from "./orientation.js";
import { checkAbort, secureUint32 } from "./random-source.js";
/** Base generation and independent uniform orientation; no solver fallback. */
export async function generateBlindfolded({
  eventId,
  signal,
  randomUint32 = secureUint32,
} = {}) {
  if (!["333bf", "444bf", "555bf"].includes(eventId))
    throw createScrambleError("UNSUPPORTED_EVENT");
  checkAbort(signal);
  let base;
  if (eventId === "333bf") {
    const { generateThreeByThree } = await import("./three-by-three.js");
    base = await generateThreeByThree({ signal, randomUint32 });
  } else if (eventId === "444bf") {
    const { generateFourByFourJoint } =
      await import("./four-by-four-joint-generator.js");
    base = await generateFourByFourJoint({ signal, randomUint32 });
  } else {
    const { generateBigCube } = await import("./big-cubes.js");
    base = await generateBigCube({ eventId: "555", signal, randomUint32 });
  }
  const orientation = sampleCubeOrientation({ signal, randomUint32 });
  checkAbort(signal);
  return {
    algorithm: [base.algorithm, orientation].filter(Boolean).join(" "),
    baseAlgorithm: base.algorithm,
    orientation,
    generator: {
      id: `last-layer-${eventId}-${eventId === "333bf" ? "two-phase" : eventId === "444bf" ? "joint" : "random-move"}-orientation`,
      version: "1",
      method: eventId === "555bf" ? "random-move" : "random-state",
    },
  };
}
