// Node CPU/resource corpus, not browser latency. Includes independent target checks.
import os from "node:os";
import { performance } from "node:perf_hooks";
import { generateFourByFour } from "../packages/cube-engine/scramble/four-by-four.js";
import { fourByFourStateToFacelets } from "../packages/cube-engine/scramble/four-by-four-state.js";
import { fourByFourCenterPhase2Diagnostics } from "../packages/cube-engine/scramble/four-by-four-center-phase2.js";
import { fourByFourCenterPhase3Diagnostics } from "../packages/cube-engine/scramble/four-by-four-center-phase3.js";
import { fourByFourWingDiagnostics } from "../packages/cube-engine/scramble/four-by-four-wing-solver.js";
import { threeByThreeDiagnostics } from "../packages/cube-engine/scramble/three-by-three.js";
import { assertNxNOracle } from "../tests/helpers/nxn-oracle.js";

const count = Number(process.argv[2] || 128);
if (!Number.isSafeInteger(count) || count < 2 || count > 4096)
  throw Error("Corpus size must be an integer from 2 to 4096.");
let seed = 0x444c0de;
const randomUint32 = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return seed >>> 0;
};
const times = [],
  lengths = [],
  stages = [[], [], []],
  nodes = [];
for (let i = 0; i < count; i++) {
  const start = performance.now();
  const result = await generateFourByFour({ randomUint32 });
  times.push(performance.now() - start);
  lengths.push(result.moveCount);
  nodes.push(result.nodes);
  result.stageLengths.forEach((length, index) => stages[index].push(length));
  assertNxNOracle(
    fourByFourStateToFacelets(result.target),
    result.algorithm,
    4,
  );
}
const stats = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    maximum: sorted.at(-1),
  };
};
console.log(
  JSON.stringify(
    {
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        cpu: os.cpus()[0].model,
      },
      seed: "0x444c0de",
      count,
      independentTargetsChecked: count,
      coldGenerationMs: times[0],
      warmGenerationMs: stats(times.slice(1)),
      moves: stats(lengths),
      stageMoves: {
        centers: stats(stages[0]),
        wings: stats(stages[1]),
        finish: stats(stages[2]),
      },
      searchNodes: stats(nodes),
      centers: {
        phase1SearchBytesPerCall: 13238478,
        phase2: fourByFourCenterPhase2Diagnostics(),
        phase3: fourByFourCenterPhase3Diagnostics(),
      },
      wings: fourByFourWingDiagnostics(),
      finish: await threeByThreeDiagnostics(),
      peakProcessRssBytes: process.resourceUsage().maxRSS * 1024,
      scope:
        "Node elapsed generation time including sampling and shallow filtering; independent oracle work excluded from times but included in RSS. Not browser paint or worker latency.",
    },
    null,
    2,
  ),
);
