import { palette } from "./diagram.js";
import { cubeScene as renderScene } from "@last-layer/cube-engine/renderer";
export {
  layerTransform,
  interiorFaceExposed,
} from "@last-layer/cube-engine/renderer";
export function cubeScene(cube, move) {
  return renderScene(cube, move, { palette });
}
