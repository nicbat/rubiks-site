// Experimental joint reduction, deliberately separate from the registered generator.
import {
  applyFourByFourMoves,
  solvedFourByFourState,
  validateFourByFourState,
} from "./four-by-four-state.js";
import { groupFourByFourOppositeCenters } from "./four-by-four-centers.js";
import { searchFourByFourJointPhase2 } from "./four-by-four-joint-phase2.js";
import { searchFourByFourJointPhase3 } from "./four-by-four-joint-phase3.js";
import { searchFourByFourJointBeam } from "./four-by-four-joint-beam.js";
import { reduceFourByFourToThree } from "./four-by-four-reduction.js";
import { solveThreeByThree } from "./three-by-three.js";
import { joinFourByFourStages } from "./four-by-four-sequence.js";
import { checkAbort } from "./random-source.js";
import { fourByFourJointCenterContext } from "./four-by-four-joint-centers.js";
import { createFourByFourJointWingSearch } from "./four-by-four-joint-wings.js";
const length = (s) => (s ? s.split(" ").length : 0);
/** Exact target experiment. Joint stages share maxNodes; the 3x3 finish has a
 * separate explicit budget. Failure retains the target without a fallback or
 * another sample. Phase one retains its fixed finite coordinate-search bound. */
export async function solveFourByFourJoint(
  value,
  {
    maxNodes,
    finishMaxNodes,
    maxMoves = 512,
    candidateCount = 8,
    perCandidateMaxNodes = Math.ceil(maxNodes / candidateCount),
    phase2MaxDepth = 16,
    phase3Search = "ida",
    phase3MaxDepth = phase3Search === "beam" ? 32 : 24,
    wingPairs = 3,
    beamWidth = 1024,
    signal,
  } = {},
) {
  checkAbort(signal);
  for (const n of [maxNodes, finishMaxNodes])
    if (!Number.isSafeInteger(n) || n < 1)
      throw new TypeError(
        "Explicit positive joint and finish node budgets required.",
      );
  if (!Number.isSafeInteger(maxMoves) || maxMoves < 1 || maxMoves > 512)
    throw new TypeError("Move budget must be from 1 to 512.");
  if (
    !Number.isInteger(candidateCount) ||
    candidateCount < 1 ||
    candidateCount > 32 ||
    !Number.isSafeInteger(perCandidateMaxNodes) ||
    perCandidateMaxNodes < 1 ||
    ![3, 4].includes(wingPairs) ||
    !["ida", "beam"].includes(phase3Search) ||
    !Number.isInteger(beamWidth) ||
    beamWidth < 1 ||
    beamWidth > 4096 ||
    ![phase2MaxDepth, phase3MaxDepth].every(
      (n) => Number.isInteger(n) && n >= 0 && n <= 32,
    )
  )
    throw new TypeError("Invalid finite candidate portfolio options.");
  let state = validateFourByFourState(value);
  const first = groupFourByFourOppositeCenters(state, {
    pair: "UD",
    maxNodes: 2 * 735471,
  });
  state = applyFourByFourMoves(state, first.algorithm);
  checkAbort(signal);
  const budget = { nodes: 0, maxNodes };
  const second = searchFourByFourJointPhase2(state, {
    budget,
    maxCandidates: candidateCount,
    maxDepth: phase2MaxDepth,
    signal,
  });
  if (!second.candidates.length)
    throw Object.assign(new Error("Joint phase2 depth limit; retain target."), {
      code: "JOINT_PHASE2_DEPTH_LIMIT",
    });
  const centerContext = fourByFourJointCenterContext(signal),
    wingContext = createFourByFourJointWingSearch({ signal, pairs: wingPairs });
  const ranked = second.candidates
    .map((candidate, index) => ({
      candidate,
      index,
      score:
        candidate.moveCount +
        Math.max(
          centerContext.distance(centerContext.coordinate(candidate.state)),
          wingContext.heuristic(wingContext.coordinate(candidate.state)),
        ),
    }))
    .sort((a, b) => a.score - b.score || a.index - b.index);
  const attempts = [];
  let candidate, third;
  for (const entry of ranked) {
    checkAbort(signal);
    if (budget.nodes >= maxNodes) break;
    const attemptBudget = {
      nodes: budget.nodes,
      maxNodes: Math.min(
        maxNodes,
        budget.nodes + Math.min(perCandidateMaxNodes, maxNodes - budget.nodes),
      ),
    };
    const before = budget.nodes;
    try {
      const search =
        phase3Search === "beam"
          ? searchFourByFourJointBeam
          : searchFourByFourJointPhase3;
      third = search(entry.candidate.state, {
        budget: attemptBudget,
        maxDepth: phase3MaxDepth,
        wingPairs,
        beamWidth,
        signal,
      });
      candidate = entry.candidate;
      attempts.push({
        candidateIndex: entry.index,
        score: entry.score,
        nodes: attemptBudget.nodes - before,
        status: "solved",
      });
      break;
    } catch (error) {
      if (
        !["JOINT_PHASE3_SEARCH_LIMIT", "JOINT_PHASE3_DEPTH_LIMIT"].includes(
          error.code,
        )
      )
        throw error;
      attempts.push({
        candidateIndex: entry.index,
        score: entry.score,
        nodes: attemptBudget.nodes - before,
        status: error.code,
      });
    } finally {
      budget.nodes = attemptBudget.nodes;
    }
  }
  if (!third)
    throw Object.assign(
      new Error(
        "All bounded joint candidates exhausted; retain original target.",
      ),
      {
        code: "JOINT_SEARCH_EXHAUSTED",
        nodes: budget.nodes,
        maxNodes,
        attempts,
        candidateCount: ranked.length,
      },
    );
  state = applyFourByFourMoves(candidate.state, third.algorithm);
  const finish = await solveThreeByThree(reduceFourByFourToThree(state), {
    maxNodes: finishMaxNodes,
  });
  checkAbort(signal);
  state = applyFourByFourMoves(state, finish.algorithm);
  const solved = solvedFourByFourState();
  if (
    Object.keys(solved).some((key) =>
      solved[key].some((v, i) => state[key][i] !== v),
    )
  )
    throw Error("Joint reduction failed exact solved-state postcondition.");
  const stages = [
    first.algorithm,
    candidate.algorithm,
    third.algorithm,
    finish.algorithm,
  ];
  const algorithm = joinFourByFourStages(stages),
    moveCount = length(algorithm);
  if (moveCount > maxMoves)
    throw Object.assign(
      new Error("Joint solution exceeds move budget; retain target."),
      { code: "FOUR_BY_FOUR_LENGTH_LIMIT", moveCount, maxMoves },
    );
  return {
    algorithm,
    moveCount,
    stageLengths: stages.map(length),
    nodes: budget.nodes,
    finishNodes: finish.nodes,
    candidateCount: ranked.length,
    attempts,
  };
}
