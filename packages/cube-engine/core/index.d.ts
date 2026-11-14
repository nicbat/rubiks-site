/** Coordinates in the existing 3×3 facelet model: right, up, front. */
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
}
export const normals: Record<Face, Vector3>;
export function solvedCube(): Cube;
/** Returns a detached state without mutating the supplied stickers. */
export function applyAlg(cube: readonly Sticker[], algorithm: string): Cube;
export function tokens(algorithm: string): string[];
export function inverse(algorithm: string): string;
export function colorAt(cube: readonly Sticker[], p: Vector3, n: Vector3): Face;
export function centers(cube: readonly Sticker[]): Record<Face, Face>;
export function isSolved(cube: readonly Sticker[]): boolean;
/** Accepts a valid single move token. */
export function moveGeometry(move: string): MoveGeometry;
export function inMove(
  p: Vector3,
  geometry: Pick<MoveGeometry, "axis" | "layer" | "wide">,
): boolean;
