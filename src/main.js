import { createPlayerPlayback, createCubeRenderer } from "./cube-player.js";
import "./cube-player.css";
import { CUBES_KEY, validateCubes, deleteCube } from "./cubes.js";
import { SOLVES_KEY, validateSolves } from "./solve-history.js";
import { createProgressIndex } from "./progress-index.js";
import { libraryGroups, learnedStatus } from "./library.js";
import { methodGroups, recommendedVariant } from "./learning-methods.js";
import {
  createSolveTimer,
  createTimerHold,
  formatElapsed,
  shouldHandleTimerKey,
} from "./solve-timer.js";
import "./timer.css";
import "./notation.css";
import "./guides.css";
import { guides } from "./guides-view.js";
import { f2lCases } from "./f2l.js";
import catalog from "../data/algorithms.json";
import triggers from "../data/triggers.json";
import { createAlgorithmRenderer } from "./algorithm.js";
import { generateSetup, randomIndex } from "./practice.js";
import { loadPreferences, savePreferences } from "./preferences.js";
import { initTheme } from "./theme.js";
import { renderApp } from "./views.js";
import "./practice-picker.css";
import {
  STORAGE_KEY,
  emptyProgress,
  validateProgress,
  dayKey,
  isKnown,
  setKnown,
} from "./progress.js";
import "./style.css";
import "./theme.css";
initTheme();
const preferences = loadPreferences();
const solveTimer = createSolveTimer();
let timerFrame;
const timerHold = createTimerHold();
let timerHoldTimeout;
let timerPointerId = null;
let suppressTimerClick = false;
function cancelTimerHold() {
  clearTimeout(timerHoldTimeout);
  timerHold.cancel();
  timerPointerId = null;
}

const $ = (s) => document.querySelector(s);
let notice = "";
let solves = [];
let currentSolveId = null;
let solveStorageUnreadable = false;
try {
  const raw = localStorage.getItem(SOLVES_KEY);
  solves = raw ? validateSolves(JSON.parse(raw)) : [];
} catch {
  solveStorageUnreadable = true;
  notice =
    "Solve history could not be loaded. Existing storage is preserved; new solves are only kept in this tab.";
}
let cubeCollection = { cubes: [], defaultId: null };
let cubeStorageUnreadable = false;
let editingCubeId = null;
let deletingCubeId = null;
try {
  const raw = localStorage.getItem(CUBES_KEY);
  if (raw) cubeCollection = validateCubes(JSON.parse(raw));
} catch {
  cubeStorageUnreadable = true;
  notice =
    "Cubes could not be loaded. Existing storage is preserved; changes are only kept in this tab.";
}
let timerCubeId = cubeCollection.defaultId;
function saveCubes(next) {
  next = validateCubes(next);
  try {
    if (cubeStorageUnreadable) throw Error("Unreadable cubes");
    localStorage.setItem(CUBES_KEY, JSON.stringify(next));
  } catch {
    notice =
      "Cubes could not be saved. Keep this tab open; existing stored data is preserved.";
  }
  cubeCollection = next;
}
function saveSolves() {
  try {
    if (solveStorageUnreadable) throw new Error("Unreadable history");
    localStorage.setItem(SOLVES_KEY, JSON.stringify(solves));
  } catch {
    notice =
      "Solve history could not be saved. Keep this tab open; existing stored data is preserved.";
  }
}
function advanceTimer() {
  const wasRunning = solveTimer.snapshot().status === "running";
  solveTimer.advance();
  currentSolveId = null;
  if (wasRunning) {
    const { elapsed, scramble } = solveTimer.snapshot();
    currentSolveId = crypto.randomUUID();
    solves.push({
      id: currentSolveId,
      cubeId: timerCubeId,
      elapsed,
      scramble,
      date: new Date().toISOString(),
    });
    saveSolves();
  }
}
function deleteSolve(id) {
  if (
    solveTimer.snapshot().status === "running" ||
    !solves.some((s) => s.id === id)
  )
    return;
  solves = solves.filter((s) => s.id !== id);
  if (currentSolveId === id) {
    currentSolveId = null;
    solveTimer.clear();
  }
  saveSolves();
}
let progress;
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  progress = raw ? validateProgress(JSON.parse(raw), catalog) : emptyProgress();
} catch {
  progress = emptyProgress();
  notice =
    "Saved progress could not be loaded. Import a backup if you have one. New changes will replace the unreadable data.";
}
let guideSection = "cross",
  guideExample = null;
let notationMove = "R",
  notationSuffix = "";
let view = "home",
  section = "PLL",
  method = preferences.method,
  learned = "all",
  query = "",
  group = "all",
  detail = null,
  detailSetupVisible = false,
  practicePicker = null,
  session = null,
  backup = false,
  scramblePreview = false,
  pendingImport = null,
  toast = "",
  focusId = null;
const byId = new Map(catalog.map((c) => [c.id, c]));
const variant = (c) => progress.variants[c.id] ?? recommendedVariant(c, method);
const selected = () =>
  progress.selected
    .map((id) => byId.get(id))
    .filter(
      (c) =>
        c &&
        (method === "full" ||
          methodGroups(catalog, c.section, method).some((g) =>
            g.cases.includes(c),
          )),
    );
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    notice =
      "Your browser could not save progress. Keep this tab open and export a backup before leaving.";
  }
}
function notify(message) {
  toast = message;
  $("#toast").textContent = message;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => {
    $("#toast").textContent = "";
    toast = "";
  }, 4000);
}
const chunks = createAlgorithmRenderer(triggers);
let dialogOpener = null;
let importGeneration = 0;
function rememberDialogOpener(button) {
  dialogOpener = {
    action: button.dataset.action,
    caseId: button.dataset.id,
    className: button.className,
    label: button.getAttribute("aria-label"),
  };
}
function closeDialogs() {
  practicePicker = null;
  scramblePreview = false;
  detail = null;
  backup = false;
  pendingImport = null;
  importGeneration++;
  render();
  const opener = [...document.querySelectorAll("[data-action]")].find(
    (el) =>
      el.dataset.action === dialogOpener?.action &&
      el.dataset.id === dialogOpener?.caseId &&
      el.className === dialogOpener?.className &&
      el.getAttribute("aria-label") === dialogOpener?.label,
  );
  opener?.focus({ preventScroll: true });
  dialogOpener = null;
}

function updateTimer() {
  const snapshot = solveTimer.snapshot();
  if (view !== "timer") return;
  const clock = $("#timer-clock");
  if (clock)
    clock.textContent = formatElapsed(
      snapshot.elapsed,
      preferences.timerMinutes,
    );
  if (snapshot.status === "running" && !preferences.hideTimer)
    timerFrame = requestAnimationFrame(updateTimer);
}
function render() {
  cancelAnimationFrame(cubeFrame);
  cancelAnimationFrame(timerFrame);
  const active = document.activeElement;
  const activeId = active?.id;
  const activeAction = active?.dataset?.action;
  const activeCase = active?.dataset?.id;
  const activeSection = active?.dataset?.section;
  const activeGroup = active?.dataset?.group;
  const activeView = active?.dataset?.view;
  const activeSolve = active?.dataset?.solveId;
  const history = $(".timer-history");
  const historyOpen = history?.open;
  const historyDeleteIndex = history
    ? [...history.querySelectorAll("[data-solve-id]")].indexOf(active)
    : -1;
  const previousDialog = $("dialog[open]");
  const dialogScroll = previousDialog?.scrollTop;
  const dialogId = previousDialog?.id;
  const activeInDialog = !!active?.closest?.("dialog");
  const searchFocused = active?.id === "search",
    start = active?.selectionStart;
  $("#app").innerHTML = renderApp({
    state: {
      scramblePreview,
      guideSection,
      guideExample,
      notationMove,
      notationSuffix,
      timer: { ...solveTimer.snapshot(), hold: timerHold.snapshot() },
      solves,
      currentSolveId,
      cubeCollection,
      editingCubeId,
      deletingCubeId,
      timerCubeId,
      notice,
      progress,
      preferences,
      view,
      section,
      method,
      query,
      learned,
      group,
      detail,
      detailSetupVisible,
      practicePicker,
      session,
      backup,
      pendingImport,
      toast,
      focusId,
    },
    catalog,
    byId,
    variant,
    selected,
    chunks,
  });
  if (historyOpen && $(".timer-history")) $(".timer-history").open = true;
  const dialog = $("dialog");
  if (dialog) {
    dialog.showModal();
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeDialogs();
    });
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) {
        const r = dialog.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        ) {
          closeDialogs();
        }
      }
    });
  }
  if (!searchFocused && (!dialog || activeInDialog)) {
    if (activeId)
      document.getElementById(activeId)?.focus({ preventScroll: true });
    else if (activeAction) {
      const match = [...document.querySelectorAll("[data-action]")].find(
        (el) =>
          el.dataset.action === activeAction &&
          el.dataset.id === activeCase &&
          el.dataset.section === activeSection &&
          el.dataset.group === activeGroup &&
          el.dataset.solveId === activeSolve &&
          el.dataset.view === activeView,
      );
      match?.focus({ preventScroll: true });
      if (!match && historyDeleteIndex >= 0) {
        const remaining = [
          ...document.querySelectorAll(".timer-history [data-solve-id]"),
        ];
        (
          remaining[Math.min(historyDeleteIndex, remaining.length - 1)] ||
          $(".timer-history summary")
        )?.focus({ preventScroll: true });
      }
    }
  }
  if (searchFocused) {
    $("#search")?.focus();
    if (start !== null) $("#search")?.setSelectionRange(start, start);
  }
  updateTimer();
  mountCubePlayers();
  if (dialog && dialog.id === dialogId) dialog.scrollTop = dialogScroll;
}
function nextCase(completed = 0, caseIds = session?.pool) {
  const pool = caseIds
    ? caseIds.map((id) => byId.get(id)).filter(Boolean)
    : selected();
  if (!pool.length) {
    view = "home";
    session = null;
    return;
  }
  const c = pool[randomIndex(pool.length)];
  session = {
    caseId: c.id,
    pool: pool.map((item) => item.id),
    setup: generateSetup(c, { randomLastLayer: preferences.randomLastLayer }),
    stage: "setup",
    mode: "recognition",
    completed,
    hinted: false,
  };
  view = "practice";
}
function record(result, mode) {
  const c = byId.get(session.caseId);
  progress.attempts.push({
    caseId: c.id,
    variant: variant(c),
    result,
    mode,
    day: dayKey(),
    at: new Date().toISOString(),
  });
  save();
}
document.addEventListener("click", (e) => {
  const button = e.target.closest("[data-action]");
  if (!button) return;
  if (button.disabled) return;
  e.preventDefault();
  const { action, id } = button.dataset;
  cancelTimerHold();
  if (action.startsWith("cube-")) {
    const player = cubePlayers.find(
      (p) => p.root === button.closest(".cube-player"),
    );
    if (!player) return;
    const state = player.playback.snapshot({ includeCube: false });
    if (action === "cube-toggle") player.playback.toggle();
    if (action === "cube-next") player.playback.seek(state.index + 1);
    if (action === "cube-previous") player.playback.seek(state.index - 1);
    if (action === "cube-reset") player.playback.reset();
    if (action === "cube-seek")
      player.playback.seek(Number(button.dataset.index));
    if (action === "cube-view") {
      player.pitch = -25;
      player.yaw = -35;
    }
    paintCube(player);
    scheduleCubes();
    return;
  }
  switch (action) {
    case "guide-section":
      if (!["cross", "f2l", "notation"].includes(id)) return;
      guideSection = id;
      guideExample = null;
      break;
    case "guide-example":
      if (
        guideSection === "notation"
          ? id !== "notation"
          : !(
              guideSection === "f2l"
                ? f2lCases
                : guides[guideSection]?.examples || []
            ).some((example) => example.id === id)
      )
        return;
      guideExample = guideExample === id ? null : id;
      break;
    case "notation-move":
      notationMove = id;
      break;
    case "notation-suffix":
      notationSuffix = id;
      break;
    case "known": {
      const c = byId.get(id);
      setKnown(progress, id, variant(c), !isKnown(progress, id, variant(c)));
      save();
      break;
    }
    case "choose-option":
      if (button.dataset.control === "timer-cube") {
        if (solveTimer.snapshot().status === "running") return;
        timerCubeId = button.dataset.value || null;
      }
      if (button.dataset.control === "learned") learned = button.dataset.value;
      if (button.dataset.control === "method") {
        method = button.dataset.value;
        preferences.method = method;
        savePreferences(preferences);
        group = "all";
      }
      if (button.dataset.control === "group") group = button.dataset.value;
      if (button.dataset.control === "variant") {
        progress.variants[detail] = Number(button.dataset.value);
        save();
      }
      render();
      document.getElementById(button.dataset.control)?.focus();
      return;
    case "collapse-group": {
      const key = button.dataset.group;
      const collapsed = preferences.collapsedGroups || [];
      preferences.collapsedGroups = collapsed.includes(key)
        ? collapsed.filter((g) => g !== key)
        : [...collapsed, key];
      savePreferences(preferences);
      break;
    }
    case "arrows":
      preferences.pllArrows = !preferences.pllArrows;
      if (!savePreferences(preferences))
        notify("This setting could not be saved.");
      break;
    case "scramble-preview":
      if (solveTimer.snapshot().status === "running") return;
      rememberDialogOpener(button);
      scramblePreview = true;
      break;
    case "equipment-delete":
      deletingCubeId = id;
      render();
      $("[data-action='equipment-delete-confirm']")?.focus();
      return;
    case "equipment-delete-cancel":
      deletingCubeId = null;
      render();
      [...document.querySelectorAll("[data-action='equipment-delete']")]
        .find((el) => el.dataset.id === id)
        ?.focus();
      return;
    case "equipment-delete-confirm":
      saveCubes(deleteCube(cubeCollection, id));
      if (timerCubeId === id) timerCubeId = cubeCollection.defaultId;
      if (editingCubeId === id) editingCubeId = null;
      deletingCubeId = null;
      render();
      (
        $("[data-action='equipment-edit']") || $("#cube-editor summary")
      )?.focus();
      return;
    case "equipment-edit":
      deletingCubeId = null;
      editingCubeId = id;
      render();
      $("#cube-name")?.focus();
      return;
    case "equipment-cancel":
      editingCubeId = null;
      render();
      $("#cube-editor").open = false;
      $("#cube-editor summary").focus();
      return;
    case "equipment-default":
      saveCubes({ ...cubeCollection, defaultId: id });
      timerCubeId = id;
      break;
    case "timer-toggle":
      if (suppressTimerClick && e.detail !== 0) {
        suppressTimerClick = false;
        return;
      }
      if (solveTimer.snapshot().status === "ready") return;
      advanceTimer();
      break;
    case "timer-delete":
      deleteSolve(button.dataset.solveId);
      break;
    case "timer-new":
      currentSolveId = null;
      solveTimer.newScramble();
      break;
    case "nav":
      if (view === "timer") solveTimer.stop();
      scramblePreview = false;
      view = button.dataset.view;
      guideExample = null;
      session = null;
      detail = null;
      break;
    case "section":
      section = button.dataset.section;
      group = "all";
      break;
    case "clear-search":
      learned = "all";
      query = "";
      group = "all";
      break;
    case "focus":
      focusId = id;
      break;
    case "toggle":
      progress.selected = progress.selected.includes(id)
        ? progress.selected.filter((x) => x !== id)
        : [...progress.selected, id];
      save();
      break;
    case "detail":
      rememberDialogOpener(button);
      detail = id;
      detailSetupVisible = false;
      break;
    case "detail-setup":
      detailSetupVisible = !detailSetupVisible;
      break;
    case "close-dialog":
      closeDialogs();
      return;
    case "backup":
      rememberDialogOpener(button);
      importGeneration++;
      backup = true;
      break;
    case "practice-filtered": {
      const index = createProgressIndex(progress);
      rememberDialogOpener(button);
      practicePicker = {
        section,
        selected: [],
        groups: libraryGroups(
          catalog,
          { section, method, group, query, learned },
          (c) => learnedStatus(index.statusFor(c.id, variant(c))),
        ),
      };
      break;
    }
    case "pick-case": {
      if (!practicePicker) return;
      practicePicker.selected = practicePicker.selected.includes(id)
        ? practicePicker.selected.filter((caseId) => caseId !== id)
        : [...practicePicker.selected, id];
      break;
    }
    case "pick-group": {
      if (!practicePicker) return;
      const group = practicePicker.groups.find(
        (g) => String(g.index) === button.dataset.group,
      );
      if (!group) return;
      const ids = group.cases.map((c) => c.id);
      const selected = new Set(practicePicker.selected);
      const clear = ids.every((id) => selected.has(id));
      for (const id of ids) {
        if (clear) selected.delete(id);
        else selected.add(id);
      }
      practicePicker.selected = [...selected];
      break;
    }
    case "practice-picked":
    case "practice-all": {
      if (!practicePicker) return;
      const eligible = practicePicker.groups.flatMap((g) =>
        g.cases.map((c) => c.id),
      );
      const pool =
        action === "practice-all"
          ? eligible
          : eligible.filter((id) => practicePicker.selected.includes(id));
      if (!pool.length) return;
      practicePicker = null;
      dialogOpener = null;
      nextCase(0, pool);
      break;
    }
    case "start":
      nextCase(
        0,
        selected().map((c) => c.id),
      );
      break;
    case "ready":
      session.stage = "recognize";
      break;
    case "finished":
      session.stage = "answer";
      break;
    case "hint":
      session.stage = "answer";
      session.hinted = true;
      break;
    case "skip":
      nextCase(session.completed);
      break;
    case "exit":
      view = "home";
      session = null;
      break;
    case "rate":
      record(session.hinted ? "help" : button.dataset.result, "recognition");
      nextCase(session.completed + 1);
      break;
    case "rehearse":
      detail = null;
      view = "practice";
      session = {
        caseId: id,
        mode: "rehearsal",
        stage: "answer",
        completed: 0,
      };
      break;
    case "rehearsal-done":
      record("effort", "rehearsal");
      session.completed++;
      break;
    case "export": {
      const blob = new Blob([JSON.stringify(progress, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `last-layer-${dayKey()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify("Progress exported.");
      return;
    }
    case "confirm-import":
      if (pendingImport) {
        progress = pendingImport;
        save();
        pendingImport = null;
        backup = false;
        focusId = null;
        session = null;
        view = "home";
      }
      break;
  }
  render();
  if (
    [
      "nav",
      "start",
      "practice-picked",
      "practice-all",
      "exit",
      "rehearse",
    ].includes(action)
  ) {
    $("#main").focus();
    window.scrollTo({ top: 0 });
  }
  if (action === "rehearsal-done") notify("Repetition recorded.");
  if (action === "rate")
    notify("Practice recorded. Start solved for the next case.");
});
document.addEventListener("submit", (event) => {
  if (event.target.id !== "cube-form") return;
  event.preventDefault();
  const name = $("#cube-name").value.trim();
  if (!name) {
    $("#cube-name").setCustomValidity("Enter a cube name.");
    $("#cube-name").reportValidity();
    return;
  }
  const cube = {
    id: editingCubeId || crypto.randomUUID(),
    name,
    description: $("#cube-description").value.trim(),
  };
  const cubes = editingCubeId
    ? cubeCollection.cubes.map((c) => (c.id === editingCubeId ? cube : c))
    : [...cubeCollection.cubes, cube];
  const defaultId = cubeCollection.defaultId || cube.id;
  saveCubes({ cubes, defaultId });
  if (cubes.filter((c) => !c.deleted).length === 1) timerCubeId = defaultId;
  editingCubeId = null;
  render();
  $("#cube-editor summary")?.focus();
});
document.addEventListener("input", (e) => {
  if (e.target.id === "cube-name") e.target.setCustomValidity("");
  if (e.target.id === "search") {
    query = e.target.value;
    render();
  }
});
document.addEventListener("change", async (e) => {
  if (e.target.matches("[data-cube-picker]")) {
    if (solveTimer.snapshot().status === "running") return;
    const cubeId = e.target.value || null;
    if (
      cubeId &&
      !cubeCollection.cubes.some((c) => c.id === cubeId && !c.deleted)
    )
      return;
    if (e.target.id === "timer-cube") timerCubeId = cubeId;
    else {
      const solve = solves.find((s) => `solve-cube-${s.id}` === e.target.id);
      if (solve) {
        solve.cubeId = cubeId;
        saveSolves();
      }
    }
    render();
  }
  if (e.target.id === "notation-move") {
    notationMove = e.target.value;
    render();
  }
  if (e.target.id === "hide-timer") {
    preferences.hideTimer = e.target.checked;
    const saved = savePreferences(preferences);
    render();
    if (!saved) notify("This setting could not be saved.");
  }
  if (e.target.id === "timer-minutes") {
    preferences.timerMinutes = e.target.checked;
    const saved = savePreferences(preferences);
    render();
    if (!saved) notify("This setting could not be saved.");
  }
  if (e.target.id === "pll-arrows") {
    preferences.pllArrows = e.target.checked;
    const saved = savePreferences(preferences);
    render();
    if (!saved) notify("This setting could not be saved.");
  }
  if (e.target.id === "random-side") {
    preferences.randomLastLayer = e.target.checked;
    const saved = savePreferences(preferences);
    if (session?.stage === "setup")
      session.setup = generateSetup(byId.get(session.caseId), {
        randomLastLayer: preferences.randomLastLayer,
      });
    render();
    if (!saved) notify("This setting could not be saved.");
  }
  if (e.target.id === "import-file") {
    const file = e.target.files[0];
    if (!file) return;
    const generation = ++importGeneration;
    pendingImport = null;
    render();
    try {
      if (file.size > 10_000_000)
        throw Error("Choose a progress file smaller than 10 MB.");
      const contents = await file.text();
      if (!backup || generation !== importGeneration) return;
      pendingImport = validateProgress(JSON.parse(contents), catalog);
      render();
    } catch (error) {
      if (!backup || generation !== importGeneration) return;
      pendingImport = null;
      const message =
        error instanceof SyntaxError
          ? "That file is not valid JSON. Choose a Last Layer export."
          : error.message;
      render();
      $("#import-message").textContent = message;
    }
  }
});
let cubePlayers = [],
  cubeFrame,
  cubeLastTime;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
function paintCube(player) {
  player.draw(player.playback, {
    pitch: player.pitch,
    yaw: player.yaw,
    reducedMotion: reducedMotion.matches,
  });
}

function scheduleCubes() {
  cancelAnimationFrame(cubeFrame);
  cubeLastTime = undefined;
  if (
    !document.hidden &&
    cubePlayers.some((p) => p.playback.snapshot({ includeCube: false }).playing)
  )
    cubeFrame = requestAnimationFrame(advanceCubes);
}
function advanceCubes(time) {
  const delta = cubeLastTime === undefined ? 0 : time - cubeLastTime;
  cubeLastTime = time;
  for (const player of cubePlayers) {
    player.playback.tick(delta);
    paintCube(player);
  }
  if (
    cubePlayers.some((p) => p.playback.snapshot({ includeCube: false }).playing)
  )
    cubeFrame = requestAnimationFrame(advanceCubes);
}
function mountCubePlayers() {
  const previous = cubePlayers;
  // A modal suspends the page player underneath it.
  const scope = document.querySelector("dialog") || document;
  cubePlayers = [...scope.querySelectorAll(".cube-player")].map((root) => {
    const config = {
      mode: root.dataset.cubeMode,
      algorithm: root.dataset.algorithm,
      setup: root.dataset.setup,
    };
    const key = JSON.stringify([
      root.dataset.playerId,
      config.mode,
      config.algorithm,
      config.setup,
    ]);
    const old = previous.find((p) => p.key === key);
    const player = {
      key,
      root,
      pitch: old?.pitch ?? -25,
      yaw: old?.yaw ?? -35,
      playback:
        old?.playback ??
        createPlayerPlayback(config, { reducedMotion: reducedMotion.matches }),
      draw: createCubeRenderer(root),
    };
    const stage = root.querySelector(".cube-stage");
    let drag;
    stage.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY };
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener("pointermove", (e) => {
      if (!drag) return;
      player.yaw += (e.clientX - drag.x) * 0.5;
      player.pitch = Math.max(
        -85,
        Math.min(85, player.pitch - (e.clientY - drag.y) * 0.5),
      );
      drag = { x: e.clientX, y: e.clientY };
      paintCube(player);
    });
    stage.addEventListener("pointerup", () => {
      drag = null;
    });
    stage.addEventListener("pointercancel", () => {
      drag = null;
    });
    stage.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key))
        return;
      e.preventDefault();
      player.yaw +=
        e.key === "ArrowLeft" ? -15 : e.key === "ArrowRight" ? 15 : 0;
      player.pitch = Math.max(
        -85,
        Math.min(
          85,
          player.pitch +
            (e.key === "ArrowUp" ? 15 : e.key === "ArrowDown" ? -15 : 0),
        ),
      );
      paintCube(player);
    });
    paintCube(player);
    return player;
  });
  // Event-handler closures must not retain detached players from this mount.
  previous.length = 0;
  scheduleCubes();
}
document.addEventListener("visibilitychange", scheduleCubes);
reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches)
    for (const player of cubePlayers) {
      player.playback.pause();
      paintCube(player);
    }
  scheduleCubes();
});
render();

document.addEventListener(
  "toggle",
  (event) => {
    if (!event.target.matches?.("[data-select]")) return;
    event.target
      .querySelector("summary")
      .setAttribute("aria-expanded", String(event.target.open));
    if (event.target.open) {
      document.querySelectorAll("[data-select][open]").forEach((control) => {
        if (control !== event.target) control.open = false;
      });
      if (
        !event.target
          .querySelector('[role="listbox"]')
          .contains(document.activeElement)
      )
        event.target.querySelector('[aria-selected="true"]')?.focus();
    }
  },
  true,
);
function positionChunkTooltip(trigger) {
  const tooltip = trigger.querySelector(".trigger-tooltip");
  if (!tooltip || getComputedStyle(tooltip).display === "none") return;
  const container =
    trigger.closest("dialog, .study-card") || document.documentElement;
  const bounds = container.getBoundingClientRect();
  const left = Math.max(8, bounds.left + 8);
  const right = Math.min(innerWidth - 8, bounds.right - 8);
  tooltip.style.maxWidth = `${Math.min(320, right - left)}px`;
  tooltip.style.setProperty("--tooltip-offset", "0px");
  const rect = tooltip.getBoundingClientRect();
  const offset = Math.max(left - rect.left, Math.min(0, right - rect.right));
  tooltip.style.setProperty("--tooltip-offset", `${offset}px`);
}
window.addEventListener("resize", () => {
  document.querySelectorAll(".trigger").forEach(positionChunkTooltip);
});
for (const type of ["pointerover", "focusin"]) {
  document.addEventListener(type, (event) => {
    const trigger = event.target.closest?.(".trigger");
    if (trigger && !trigger.contains(event.relatedTarget)) {
      delete trigger.dataset.tooltipDismissed;
      positionChunkTooltip(trigger);
    }
  });
}
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const trigger =
    document.activeElement.closest?.(".trigger") ||
    document.querySelector(".trigger:hover");
  const tooltip = trigger?.querySelector(".trigger-tooltip");
  if (!tooltip || getComputedStyle(tooltip).display === "none") return;
  event.preventDefault();
  trigger.dataset.tooltipDismissed = "true";
});
document.addEventListener("click", (event) => {
  document.querySelectorAll("[data-select][open]").forEach((control) => {
    if (!control.contains(event.target)) control.open = false;
  });
});
document.addEventListener("keydown", (event) => {
  const control = event.target.closest?.("[data-select]");
  if (!control) return;
  const options = [...control.querySelectorAll('[role="option"]')];
  const index = options.indexOf(document.activeElement);
  if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    control.open = true;
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? options.length - 1
          : index < 0
            ? event.key === "ArrowDown"
              ? 0
              : options.length - 1
            : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) %
              options.length;
    options[next]?.focus();
  } else if (event.key === "Escape" && control.open) {
    event.preventDefault();
    event.stopPropagation();
    control.open = false;
    control.querySelector("summary").focus();
  } else if (event.key === "Tab") control.open = false;
});

function beginTimerHold() {
  timerHold.begin();
  clearTimeout(timerHoldTimeout);
  timerHoldTimeout = setTimeout(() => {
    if (view === "timer" && timerHold.snapshot() !== "idle") render();
  }, 500);
  render();
}

document.addEventListener("pointerdown", (event) => {
  if (!event.isPrimary || event.button !== 0) return;
  suppressTimerClick = false;
  if (
    view !== "timer" ||
    solveTimer.snapshot().status !== "ready" ||
    !event.target.closest?.('[data-action="timer-toggle"]')
  )
    return;
  event.preventDefault();
  event.target.closest('[data-action="timer-toggle"]').focus();
  cancelTimerHold();
  timerPointerId = event.pointerId;
  suppressTimerClick = true;
  beginTimerHold();
});
document.addEventListener("pointerup", (event) => {
  if (event.pointerId !== timerPointerId) return;
  const button = $('[data-action="timer-toggle"]');
  const bounds = button?.getBoundingClientRect();
  const inside =
    bounds &&
    event.clientX >= bounds.left &&
    event.clientX <= bounds.right &&
    event.clientY >= bounds.top &&
    event.clientY <= bounds.bottom;
  const start = timerHold.release();
  cancelTimerHold();
  if (
    start &&
    inside &&
    view === "timer" &&
    !document.querySelector("dialog[open]")
  )
    advanceTimer();
  render();
});
document.addEventListener("pointercancel", (event) => {
  if (event.pointerId === timerPointerId) abandonTimerHold();
});

document.addEventListener("keydown", (event) => {
  if (view !== "timer" || document.querySelector("dialog[open]")) return;
  if (
    event.code === "Space" &&
    event.repeat &&
    !event.target.closest?.(
      'input,select,textarea,a,summary,[contenteditable],[role="combobox"],[role="option"]',
    )
  ) {
    event.preventDefault();
    return;
  }
  if (
    !shouldHandleTimerKey({
      code: event.code,
      repeat: event.repeat,
      isComposing: event.isComposing,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      status: solveTimer.snapshot().status,
      interactive: Boolean(
        !event.target.closest?.('[data-action="timer-toggle"]') &&
        !(
          event.code === "Tab" &&
          event.target.closest?.('[data-action="timer-new"]')
        ) &&
        event.target.closest?.(
          event.code === "Backspace"
            ? 'input,select,textarea,[contenteditable],[role="combobox"],[role="option"]'
            : 'input,select,textarea,button,a,summary,[contenteditable],[role="combobox"],[role="option"]',
        ),
      ),
    })
  )
    return;
  event.preventDefault();
  if (event.code === "Backspace") {
    cancelTimerHold();
    deleteSolve(currentSolveId);
  } else if (event.code === "Tab") {
    cancelTimerHold();
    currentSolveId = null;
    solveTimer.newScramble();
  } else if (solveTimer.snapshot().status === "running") {
    cancelTimerHold();
    advanceTimer();
  } else {
    if (solveTimer.snapshot().status === "stopped") return;
    if (timerPointerId !== null) return;
    beginTimerHold();
  }
  render();
});
document.addEventListener("keyup", (event) => {
  if (
    event.code !== "Space" ||
    timerPointerId !== null ||
    timerHold.snapshot() === "idle"
  )
    return;
  event.preventDefault();
  const start = timerHold.release();
  clearTimeout(timerHoldTimeout);
  if (start && view === "timer" && !document.querySelector("dialog[open]"))
    advanceTimer();
  render();
});
function abandonTimerHold() {
  if (timerHold.snapshot() === "idle") return;
  cancelTimerHold();
  render();
}
window.addEventListener("blur", abandonTimerHold);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) abandonTimerHold();
});
document.addEventListener("keydown", (event) => {
  if (event.code !== "Space" && event.code !== "Backspace") abandonTimerHold();
});
