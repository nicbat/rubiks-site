# @last-layer/cube-engine

A source-owned, framework-free cube engine. Mechanics, playback, and retained DOM rendering support sizes 2–7; existing calls default to 3×3. Event definitions and scramble metadata validators are separate entrypoints. Lessons, solve history, and application event selection remain app-owned. The package is private and not yet published.

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

## Puzzle sizes and event boundaries

Use `solvedCube(2)` through `solvedCube(7)`. `applyAlg` and playback infer size from
the supplied cube; standalone `tokens`, `inverse`, `moveGeometry`, and
`layerTransform` accept size as their final argument. Even-sized cubes use centered
half-integer coordinates and have no fixed centers (`centers` rejects them).
Wide moves include numbered widths such as `3Rw`; bounds depend on puzzle size.
Odd-sized cubes retain central slice moves for learning.

The renderer scales each puzzle to the same overall stage dimensions. It retains
geometry across moves and same-size controller replacements; a size change rebuilds
the owned geometry. Independent cubing.js checks cover all sizes, while cubing.js
stays a development dependency.

`@last-layer/cube-engine/events` owns event-to-puzzle identities.
`@last-layer/cube-engine/scramble` validates bounded event notation, starting grips,
and provenance; its `ScrambleProvider` type is the asynchronous app boundary.
Rendering does not import solver tables or workers. See the repository's
[contract document](../../docs/plans/cube-engine-contracts.md) for activation gates.

## Asynchronous event generation

```js
import { createScrambleProvider } from "@last-layer/cube-engine/worker";

const provider = createScrambleProvider();
const controller = new AbortController();
const result = await provider.generateScramble({
  eventId: "222",
  signal: controller.signal,
});
// result carries algorithm, event/puzzle IDs, starting grip, and provenance.
// controller.abort() cancels an outstanding request and terminates its worker.
provider.destroy();
```

The provider creates a module worker lazily and retains its initialized tables
between successful requests. Consumers using Vite must set `worker.format: "es"`
because the worker loads its solver dynamically. `SUPPORTED_SCRAMBLE_EVENT_IDS`
exports the implemented routes: `222`, `333`, `333oh`, `333bf`, `555`, `555bf`,
`666` and `777`. Unsupported events and generation failures reject explicitly. Concurrent requests
are rejected; callers own queueing and cancellation. Importing the renderer alone
does not include this worker or the solver.

The original 2×2 solver samples uniformly over fixed-DBL states using cryptographic
rejection sampling. A complete distance table excludes states fewer than four face
turns from solved and produces a scramble reaching the sampled target. The
low-level `/scramble/222` entrypoint exposes target information for independent
verification; production consumers should use the worker to keep table generation
off the UI thread. Table initialization retains about 3.78 MB of typed arrays and
uses a temporary 14.70 MB queue. Cancellation terminates initialization too.

The original 3×3 two-phase solver uniformly samples legal cubie states and rejects
zero/one-move states. A search limit fails explicitly without replacing the sampled
target. Regular and one-handed events share this policy. See
[3×3 design and measurements](scramble/three-by-three.md).

5×5–7×7 use event-specific random-move policies, not random-state claims.
Blindfolded adapters choose uniformly among 24 orientations while preserving the
base target. See [big-cube and orientation policies](scramble/big-cubes.md).
The 4×4 random-state solver and its blindfolded route are still outstanding.

This is an implementation toward competition-style technical requirements, not
an official WCA-approved scramble program. Independent cubing.js checks and the
published full distance histogram are retained as external checks. The 4×4 family
and complete conformance audit remain separate work.
