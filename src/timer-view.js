import { selectControl } from "./select-control.js";
import { cubePicker } from "./cubes-view.js";
import { icon } from "./icons.js";
import { recentStats, solveTime } from "./solve-history.js";
import { escape } from "./html.js";
import { formatElapsed } from "./solve-timer.js";

export function renderTimer({
  status,
  hold = "idle",
  scramble,
  elapsed,
  minutes = true,
  hideTimer = false,
  solves = [],
  cubes = [],
  cubeId = null,
  currentSolveId = null,
}) {
  const cubeName = cubes.find((c) => c.id === cubeId)?.name || "Not specified";
  const cubeChoice =
    status === "running"
      ? `<button id="timer-cube" class="timer-cube-disabled" role="combobox" aria-label="Cube" aria-expanded="false" disabled><span class="select-value">${escape(cubeName)}</span><span aria-hidden="true">⌄</span></button>`
      : selectControl(
          "timer-cube",
          "Cube",
          cubeId || "",
          [
            { value: "", label: "Not specified" },
            ...cubes
              .filter((c) => !c.deleted)
              .map((c) => ({ value: c.id, label: c.name })),
          ],
          true,
        );
  const format = (time) =>
    time === Infinity ? "DNF" : formatElapsed(time, minutes);
  const result = (solve) =>
    `${format(solveTime(solve))}${solve.penalty === "+2" ? " (+2)" : ""}`;
  const penalties = (solve) =>
    `<div class="cube-actions timer-penalties" role="group" aria-label="Solve penalty">${[
      ["none", "No penalty"],
      ["+2", "+2 sec"],
      ["dnf", "DNF"],
    ]
      .map(
        ([value, label]) =>
          `<button class="secondary" data-action="timer-penalty" data-solve-id="${escape(solve.id)}" data-penalty="${value}" aria-pressed="${(solve.penalty || "none") === value}" ${status === "running" ? "disabled" : ""}>${label}</button>`,
      )
      .join("")}</div>`;
  const current =
    status === "stopped" && solves.find((solve) => solve.id === currentSolveId);
  const stats = [5, 12]
    .map((count) => {
      const { average, best } = recentStats(solves, count);
      return `<div><h2>Recent ${count}</h2><p>Average: <strong>${average === null ? "—" : format(average)}</strong></p><p>Best: <strong>${best === null ? "—" : format(best)}</strong></p></div>`;
    })
    .join("");
  const action =
    status === "running"
      ? "Stop timer"
      : status === "stopped"
        ? "Next scramble (Tab)"
        : "Hold to start (Space)";
  const timerMessage =
    hold === "armed"
      ? "Release to start"
      : hold === "holding"
        ? "Keep holding…"
        : status === "running"
          ? "Running"
          : "";
  return `<section class="solve-timer" aria-labelledby="timer-heading">
    <header class="page-heading"><h1 id="timer-heading">Timer</h1><div class="timer-cube-choice">${cubeChoice}</div></header>
    <p class="timer-note">Hold yellow on top, green in front.</p>
    ${status === "running" ? "" : `<div class="timer-scramble"><p id="timer-scramble">${escape(scramble)}</p><button class="icon-button" data-action="scramble-preview" aria-label="Preview scrambled cube" title="Preview scrambled cube" aria-haspopup="dialog">${icon("cube")}</button></div>`}
    <div class="timer-clock-panel" data-timer-status="${status}" data-timer-hold="${hold}">
      ${hideTimer && status === "running" ? '<div class="timer-clock" aria-hidden="true">—</div>' : `<output id="timer-clock" class="timer-clock" aria-label="Solve time" aria-live="off">${current ? format(solveTime(current)) : format(elapsed)}</output>`}
      <div class="timer-status-slot">${timerMessage ? `<p id="timer-status" role="status">${timerMessage}</p>` : ""}</div>
      <button class="primary timer-toggle" data-action="timer-toggle">${action}</button>
    </div>
    ${current ? `${penalties(current)}<p class="timer-note">+2: one move off · DNF: more than one move off${current.penalty ? ` · Raw time: ${format(current.elapsed)}` : ""}</p>` : ""}
    ${status === "ready" ? '<button class="secondary timer-new" data-action="timer-new">New scramble (Tab)</button>' : ""}
    ${currentSolveId && status === "stopped" ? `<button class="secondary" data-action="timer-delete" data-solve-id="${escape(currentSolveId)}">Delete last solve (Backspace)</button>` : ""}
    <section class="timer-stats" aria-label="Recent solve statistics">${stats}</section>
    <p class="timer-note">Averages drop the fastest and slowest solve; two DNFs make an average DNF. Complete 5 or 12 solves for an average.</p>
    <details class="timer-history"><summary>Solve history (${solves.length})</summary>
      <p class="timer-note">Saved on this device. Timer history is separate from learning backups.</p>
      ${
        solves.length
          ? `<ol reversed>${solves
              .slice()
              .reverse()
              .map(
                (solve) =>
                  `<li><div><strong>${result(solve)}</strong> · <time datetime="${escape(solve.date)}">${escape(new Date(solve.date).toLocaleString())}</time><p>${escape(solve.scramble)}</p>${cubePicker(`solve-cube-${solve.id}`, "Cube for this solve", cubes, solve.cubeId, status === "running")}${penalties(solve)}</div><button class="secondary" data-action="timer-delete" data-solve-id="${escape(solve.id)}" aria-label="Delete solve ${escape(result(solve))}" ${status === "running" ? "disabled" : ""}>Delete</button></li>`,
              )
              .join("")}</ol>`
          : "<p>No solves yet.</p>"
      }
    </details>
  </section>`;
}
