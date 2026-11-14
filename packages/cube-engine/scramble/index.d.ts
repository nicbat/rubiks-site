import type { EventId, PuzzleId } from "../events/index.js";
export type CubeColor =
  "white" | "yellow" | "green" | "blue" | "red" | "orange";
export interface ScrambleGrip {
  up: CubeColor;
  front: CubeColor;
}
export interface ScrambleProvenance {
  id: string;
  version: string;
  method: "random-state" | "random-move";
}
export interface ScrambleResult {
  eventId: EventId;
  puzzleId: PuzzleId;
  algorithm: string;
  generator: ScrambleProvenance;
  grip: ScrambleGrip;
}
export interface ScrambleRequest {
  eventId: EventId;
  signal?: AbortSignal;
}
export type ScrambleProvider = (
  request: ScrambleRequest,
) => Promise<ScrambleResult>;
export type ScrambleErrorCode =
  "UNSUPPORTED_EVENT" | "GENERATION_FAILED" | "ABORTED";
export const MAX_SCRAMBLE_LENGTH: number;
export const MAX_SCRAMBLE_MOVES: number;
export function createScrambleError(
  code: ScrambleErrorCode,
  message?: string,
): Error & { code: ScrambleErrorCode };
export function validateEventScramble(
  eventId: unknown,
  algorithm: unknown,
): string;
export function validateScrambleGrip(value: unknown): ScrambleGrip;
export function validateScrambleProvenance(value: unknown): ScrambleProvenance;
export function validateScrambleResult(
  value: unknown,
  expectedEventId?: EventId,
): ScrambleResult;
