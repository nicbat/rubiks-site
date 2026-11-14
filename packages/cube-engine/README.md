# @last-layer/cube-engine

A source-owned, framework-free 3×3 cube engine. This initial extraction supports 3×3 facelets, move playback, and a DOM renderer. It does not implement 2×2, arbitrary puzzle sizes, scrambles, solvers, lessons, solve history, or event tracking. Future puzzle entrypoints are not implemented.

## Public imports

```js
import { solvedCube, applyAlg } from "@last-layer/cube-engine/core";
import { createCubePlayback } from "@last-layer/cube-engine/playback";
import { mountCubeRenderer } from "@last-layer/cube-engine/renderer";
import "@last-layer/cube-engine/renderer.css";

const playback = createCubePlayback(solvedCube(), "R U R' U'");
const renderer = mountCubeRenderer(document.querySelector("#cube"));
renderer.update(playback, { pitch: -25, yaw: -35, reducedMotion: false });
// At application teardown:
renderer.destroy();
```

Give the host a positioned box with a nonzero height. Camera angles are degrees. An optional `palette` in the mount options supplies all six `U`, `R`, `F`, `D`, `L`, `B` face colors as hexadecimal CSS colors. The renderer owns its appended stage and removes it on destruction; the caller owns the host and controls. Destruction is idempotent.

The core and playback imports work without a DOM. Importing the renderer is also safe in Node; mounting it requires a browser DOM. Runtime imports do not depend on Svelte, cubing.js, or application modules.

## Playback and scheduling

Playback owns cube state and move position. The caller owns time and scheduling: call `tick(deltaMilliseconds)` and update the renderer from a requestAnimationFrame callback only while playback is playing. Cancel pending frames when pausing or disposing. `seek(index)` and `reset()` pause playback. `toggle()` starts or pauses it. Pass the playback controller, rather than its snapshot, to `renderer.update()`.

Controls, keyboard handling, camera state, focus, and reduced-motion preference belong to the consumer. Observe `prefers-reduced-motion` and pass its value to the renderer. Remove listeners and cancel frames on teardown.

## Framework-free example

From the repository root, run `npx vite --host 127.0.0.1`, then open `/examples/cube-engine/`. The example uses only public package imports and supplies play/pause, previous/next, reset, camera buttons, keyboard controls, reduced-motion handling, and cleanup.

Build the example independently without the application configuration:

```sh
node --input-type=module -e 'import { build } from "vite"; await build({ root: "examples/cube-engine", configFile: false, build: { outDir: "/tmp/cube-engine-example" } });'
```

The boundary test uses Vite's API with `configFile: false` and `write: false` to ensure the consumer builds without application modules or framework plugins:

```sh
node --test tests/cube-engine-package.test.js
```

Browser verification requires separate approval under this repository's instructions. When approved, verify playback completion stops scheduling, pause/step/reset and arrow-key camera controls, reduced motion, disposal/remount, and narrow portrait/short landscape layouts. The browser regression spec serves an in-memory build through same-origin route interception on the isolated test server; it does not modify the application production build.
