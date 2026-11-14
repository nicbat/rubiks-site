export type EventId =
  | "222"
  | "333"
  | "444"
  | "555"
  | "666"
  | "777"
  | "333oh"
  | "333bf"
  | "444bf"
  | "555bf";
export type PuzzleId = "2x2" | "3x3" | "4x4" | "5x5" | "6x6" | "7x7";
export interface EventDefinition {
  readonly id: EventId;
  readonly puzzleId: PuzzleId;
  readonly size: number;
  readonly blindfolded: boolean;
}
export const CUBE_EVENTS: readonly EventDefinition[];
export const EVENT_IDS: readonly EventId[];
export const PUZZLE_IDS: readonly PuzzleId[];
export function getEventDefinition(id: unknown): EventDefinition | undefined;
export function isEventId(id: unknown): id is EventId;
export function isPuzzleId(id: unknown): id is PuzzleId;
