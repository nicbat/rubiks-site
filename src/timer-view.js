import { escape } from "./html.js";
import { formatElapsed } from "./solve-timer.js";

export function renderTimer({ status, scramble, elapsed }) {
  const action =
    status === "running"
      ? "Stop timer"
      : status === "stopped"
        ? "Next scramble"
        : "Start timer";
  return `<section class="solve-timer" aria-labelledby="timer-heading">
    <header class="page-heading"><div><p class="eyebrow">Free practice</p><h1 id="timer-heading">Timer</h1></div></header>
    <p class="timer-note">Hold yellow on top, green in front.</p>
    <div class="timer-scramble"><span class="eyebrow">Scramble</span><p id="timer-scramble">${escape(scramble)}</p><span class="timer-note">20 random face turns</span></div>
    <div class="timer-clock-panel" data-timer-status="${status}">
      <output id="timer-clock" class="timer-clock" aria-label="Solve time in seconds" aria-live="off">${formatElapsed(elapsed)}</output>
      <span class="timer-unit">seconds</span>
      <p id="timer-status" role="status">${status === "running" ? "Running" : status === "stopped" ? `Finished in ${formatElapsed(elapsed)} seconds` : "Ready"}</p>
      <button class="primary timer-toggle" data-action="timer-toggle">${action}</button>
      <p class="timer-note">${status === "running" ? "Space or tap to stop" : status === "stopped" ? "Space or tap for the next scramble" : "Space or tap to start"}</p>
    </div>
    <button class="secondary timer-new" data-action="timer-new" ${status === "running" ? "disabled" : ""}>New scramble</button>
  </section>`;
}
