// Experimental bounded joint-search corpus. Failures are counted, never resampled.
import os from "node:os";
import { performance } from "node:perf_hooks";
import { solveFourByFourJoint } from "../packages/cube-engine/scramble/four-by-four-joint.js";
import {
  sampleFourByFourState,
  fourByFourStateToFacelets,
} from "../packages/cube-engine/scramble/four-by-four-state.js";
import { inverse } from "../packages/cube-engine/core/index.js";
import { assertNxNOracle } from "../tests/helpers/nxn-oracle.js";
const count = Number(process.argv[2] || 4),
  maxNodes = Number(process.argv[3] || 1000000);
if (
  !Number.isSafeInteger(count) ||
  count < 1 ||
  count > 1024 ||
  !Number.isSafeInteger(maxNodes) ||
  maxNodes < 1
)
  throw Error("Use count 1..1024 and a positive node budget.");
let seed = 0x444c0de;
const randomUint32 = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return seed >>> 0;
};
const results = [];
for (let i = 0; i < count; i++) {
  const target = sampleFourByFourState({ randomUint32 }),
    start = performance.now();
  let row;
  try {
    const result = await solveFourByFourJoint(target, {
      maxNodes,
      finishMaxNodes: 50000000,
    });
    const elapsedMs = performance.now() - start;
    assertNxNOracle(
      fourByFourStateToFacelets(target),
      inverse(result.algorithm, 4),
      4,
    );
    row = {
      index: i,
      status: "solved",
      elapsedMs,
      moves: result.moveCount,
      stageLengths: result.stageLengths,
      nodes: result.nodes,
      finishNodes: result.finishNodes,
    };
  } catch (error) {
    if (
      ![
        "JOINT_PHASE2_SEARCH_LIMIT",
        "JOINT_PHASE2_DEPTH_LIMIT",
        "JOINT_PHASE3_SEARCH_LIMIT",
        "JOINT_PHASE3_DEPTH_LIMIT",
      ].includes(error.code)
    )
      throw error;
    row = {
      index: i,
      status: error.code,
      elapsedMs: performance.now() - start,
    };
  }
  results.push(row);
  console.log(JSON.stringify(row));
}
console.log(
  JSON.stringify(
    {
      environment: {
        node: process.version,
        cpu: os.cpus()[0].model,
        platform: process.platform,
        arch: process.arch,
      },
      seed: "0x444c0de",
      count,
      maxNodes,
      solved: results.filter((r) => r.status === "solved").length,
      failed: results.filter((r) => r.status !== "solved").length,
      peakProcessRssBytes: process.resourceUsage().maxRSS * 1024,
      scope:
        "Node CPU experiment including cold table initialization; oracle excluded from elapsed times but included in RSS. Not browser/worker latency. Every sampled target counted.",
    },
    null,
    2,
  ),
);
