// Fixed 60 Hz playback/geometry fixture. Rebuilds HTML at boundaries to measure
// generation cost; the browser renderer now retains DOM instead. This excludes
// DOM updates, browser layout, compositing and paint.
import { performance } from "node:perf_hooks";
import { cpus } from "node:os";
import { solvedCube } from "../src/cube.js";
import { createCubePlayback } from "../src/cube-playback.js";
import { cubeScene } from "../src/cube-player-view.js";
console.log(
  `${process.version}; ${process.platform}/${process.arch}; ${cpus()[0].model}`,
);
function run() {
  const player = createCubePlayback(solvedCube(), "R", {
    loop: true,
    autoplay: true,
  });
  let cycle = -1,
    bytes = 0;
  for (let frame = 0; frame < 6000; frame++) {
    player.tick(1000 / 60);
    const state = player.snapshot({ includeCube: false });
    if (cycle !== state.cycle) {
      bytes += cubeScene(player.snapshot().cube, state.move).length;
      cycle = state.cycle;
    }
    player.snapshot({ includeCube: false }); // scheduler checks playing
  }
  return bytes;
}
for (let i = 0; i < 3; i++) run();
const samples = Array.from({ length: 20 }, () => {
  const start = performance.now();
  run();
  return performance.now() - start;
}).sort((a, b) => a - b);
console.log(
  `Geometry fixture: 6000 frames / 100 simulated seconds / continuous R: median ${samples[10].toFixed(2)} ms; p95 ${samples[19].toFixed(2)} ms`,
);
