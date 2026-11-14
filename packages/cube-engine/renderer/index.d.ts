import type { Face, Sticker, Vector3, MoveGeometry } from "../core/index.js";
import type { CubePlayback } from "../playback/index.js";
export type Palette = Readonly<Record<Face, string>>;
export interface RendererOptions {
  /** All six faces, using #rgb, #rgba, #rrggbb, or #rrggbbaa colors. Cloned on mount. */
  palette?: Palette;
}
export interface ViewOptions {
  /** Camera angle in degrees; defaults to -25. */
  pitch?: number;
  /** Camera angle in degrees; defaults to -35. */
  yaw?: number;
  reducedMotion?: boolean;
}
export interface CubeRenderer {
  (playback: CubePlayback, view?: ViewOptions): void;
  /** Releases references; does not remove the caller's DOM. Idempotent. */
  destroy(): void;
}
export const defaultPalette: Palette;
export function cubeScene(
  cube: readonly Sticker[],
  move?: string,
  options?: RendererOptions,
): string;
export function layerTransform(
  move: string | undefined,
  fraction: number,
  size?: number,
): string;
export function interiorFaceExposed(
  position: Vector3,
  normal: Vector3,
  move: MoveGeometry | null | undefined,
): boolean;
/** Root must contain .cube-camera and .cube-scene. Caller owns input and scheduling. */
export function createCubeRenderer(
  root: HTMLElement,
  options?: RendererOptions,
): CubeRenderer;
/** Appends its own stage; destroy removes only that subtree. Import renderer.css separately. */
export function mountCubeRenderer(
  host: HTMLElement,
  options?: RendererOptions,
): {
  update: CubeRenderer;
  destroy(): void;
};
