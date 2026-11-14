/** Coordinates in the centered facelet model; even sizes use half-integers: right, up, front. */
export type Vector3 = [number, number, number];
export type Face = "U" | "R" | "F" | "D" | "L" | "B";
export interface Sticker {
  p: Vector3;
  n: Vector3;
  color: Face;
}
export type Cube = Sticker[];
export interface MoveGeometry {
  axis: number;
  layer: number;
  wide: boolean;
  turns: number;
  sign: number;
  low: number;
  high: number;
}
export const normals: Record<Face, Vector3>;
export function solvedCube(size?: number): Cube;
/** Returns a detached state without mutating the supplied stickers. */
export function applyAlg(cube: readonly Sticker[], algorithm: string): Cube;
export function tokens(algorithm: string, size?: number): string[];
export function inverse(algorithm: string, size?: number): string;
export function colorAt(cube: readonly Sticker[], p: Vector3, n: Vector3): Face;
export function centers(cube: readonly Sticker[]): Record<Face, Face>;
export function isSolved(cube: readonly Sticker[]): boolean;
/** Accepts a valid single move token. */
export function moveGeometry(move: string, size?: number): MoveGeometry;
export function inMove(
  p: Vector3,
  geometry: Pick<MoveGeometry, "axis" | "layer" | "wide"> &
    Partial<Pick<MoveGeometry, "low" | "high">>,
): boolean;

export function validateSize(size: number): number;
export function cubeSize(cube: readonly Sticker[]): number;
