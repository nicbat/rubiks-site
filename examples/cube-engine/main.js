import { solvedCube } from "@last-layer/cube-engine/core";
import { createCubePlayback } from "@last-layer/cube-engine/playback";
import { mountCubeRenderer } from "@last-layer/cube-engine/renderer";
import "@last-layer/cube-engine/renderer.css";
import "./style.css";

// The application owns controls, scheduling, camera state, and disposal.
export function mountExample(root) {
  const lifetime = new AbortController();
  root.innerHTML = `
    <div class="cube-host" tabindex="0" role="group" aria-label="Cube view. Arrow keys rotate; space plays or pauses."></div>
    <p class="status" role="status" aria-live="polite"></p>
    <div class="controls" aria-label="Playback controls">
      <button type="button" data-action="play">Play</button>
      <button type="button" data-action="back">Previous move</button>
      <button type="button" data-action="next">Next move</button>
      <button type="button" data-action="reset">Reset</button>
    </div>
    <div class="controls" aria-label="Camera controls">
      <button type="button" data-action="left">Rotate left</button>
      <button type="button" data-action="right">Rotate right</button>
      <button type="button" data-action="up">Rotate up</button>
      <button type="button" data-action="down">Rotate down</button>
    </div>`;
  const host = root.querySelector(".cube-host");
  const status = root.querySelector(".status");
  const playButton = root.querySelector('[data-action="play"]');
  const playback = createCubePlayback(solvedCube(), "R U R' U'");
  const renderer = mountCubeRenderer(host);
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let pitch = -25,
    yaw = -35,
    frame = null,
    lastTime = null,
    disposed = false;

  function draw() {
    renderer.update(playback, { pitch, yaw, reducedMotion: motion.matches });
    const snapshot = playback.snapshot({ includeCube: false });
    playButton.textContent = snapshot.playing ? "Pause" : "Play";
    const label = `Move ${snapshot.index} of ${playback.moves.length}`;
    if (status.textContent !== label) status.textContent = label;
  }
  function schedule() {
    if (
      !disposed &&
      playback.snapshot({ includeCube: false }).playing &&
      frame === null
    )
      frame = requestAnimationFrame(tick);
  }
  function tick(now) {
    frame = null;
    playback.tick(lastTime === null ? 0 : now - lastTime);
    lastTime = now;
    draw();
    schedule();
  }
  function stopFrame() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    lastTime = null;
  }
  function act(action) {
    stopFrame();
    const { index } = playback.snapshot({ includeCube: false });
    if (action === "play") playback.toggle();
    if (action === "back") playback.seek(index - 1);
    if (action === "next") playback.seek(index + 1);
    if (action === "reset") playback.reset();
    if (action === "left") yaw -= 15;
    if (action === "right") yaw += 15;
    if (action === "up") pitch = Math.max(-80, pitch - 15);
    if (action === "down") pitch = Math.min(80, pitch + 15);
    draw();
    schedule();
  }
  root.addEventListener(
    "click",
    (event) => {
      const action = event.target.closest("button[data-action]")?.dataset
        .action;
      if (action) act(action);
    },
    { signal: lifetime.signal },
  );
  host.addEventListener(
    "keydown",
    (event) => {
      const action = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
        " ": "play",
      }[event.key];
      if (!action || event.repeat) return;
      event.preventDefault();
      act(action);
    },
    { signal: lifetime.signal },
  );
  motion.addEventListener("change", draw, { signal: lifetime.signal });
  draw();
  return () => {
    if (disposed) return;
    disposed = true;
    stopFrame();
    playback.pause();
    lifetime.abort();
    renderer.destroy();
    root.replaceChildren();
  };
}

const root = document.querySelector("#player");
let dispose = mountExample(root);
const controls = new AbortController();
document
  .querySelector("#dispose")
  .addEventListener("click", () => dispose(), { signal: controls.signal });
document.querySelector("#remount").addEventListener(
  "click",
  () => {
    dispose();
    dispose = mountExample(root);
  },
  { signal: controls.signal },
);
function teardown() {
  dispose();
  controls.abort();
}
window.addEventListener("pagehide", teardown, { once: true });
if (import.meta.hot) import.meta.hot.dispose(teardown);
