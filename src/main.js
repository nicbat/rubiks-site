import {
  trainingBackup,
  validateBackup,
  restoreBackup,
} from "./training-backup.js";
import { createTestData } from "./test-data.js";
import { createTrainingStorage } from "./training-storage.js";
import { snapshotViewState } from "./view-state.js";
import {
  withoutActivityDay,
  progressRange,
  progressRanges,
  solveSelection,
} from "./dashboard.js";
import { readRoute, routeHash } from "./routes.js";
import { createPllQuestion } from "./pll-quiz.js";
import { displayColors } from "./display-colors.js";
import {
  courseById,
  moduleById,
  moduleCases,
  reviewIds,
  moduleExampleIds,
} from "./courses.js";
import "./courses.css";
import { createPlayerPlayback, createCubeRenderer } from "./cube-player.js";
import "./cube-player.css";
import { CUBES_KEY, validateCubes, deleteCube } from "./cubes.js";
import {
  SOLVES_KEY,
  MAX_SOLVE_NOTES_LENGTH,
  validateSolves,
} from "./solve-history.js";
import { createProgressIndex } from "./progress-index.js";
import { libraryGroups, learnedStatus } from "./library.js";
import { withCaseProperties } from "./bulk-properties.js";
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
import guides from "../data/guides.json";
import { f2lCases } from "./f2l.js";
import catalog from "../data/algorithms.json";
import { generateSetup, randomIndex } from "./practice.js";
import { loadPreferences, savePreferences } from "./preferences.js";
import { initTheme } from "./theme.js";
import { mount, flushSync } from "svelte";
import App from "./App.svelte";
import { appModel, liveClock, commandState } from "./app-model.svelte.js";
import "./shadcn.css";
import "./practice-picker.css";
import {
  STORAGE_KEY,
  emptyProgress,
  identifyAttempts,
  validateProgress,
  dayKey,
  isKnown,
  setKnown,
} from "./progress.js";
import "./tokens.css";
import "./style.css";
import "./theme.css";
import "./progress-dashboard.css";
initTheme();
mount(App, {
  target: document.getElementById("app"),
  props: {
    model: appModel,
    actions: {
      setPreference,
      chooseOption,
      setLibrarySelection,
      closeCommands,
      runCommand,
      closeDialog: (id) =>
        id === "command-dialog" ? closeCommands() : closeDialogs(),
    },
  },
});
const preferences = loadPreferences();
let pllQuiz = null;
let displayTop = preferences.displayTop;
function chooseDisplayColor() {
  displayTop = preferences.randomDisplay
    ? Object.keys(displayColors)[randomIndex(6)]
    : preferences.displayTop;
}
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
const trainingStorage = createTrainingStorage(
  {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
    removeItem: (key) => localStorage.removeItem(key),
  },
  () => createTestData(catalog),
  preferences.testData,
);
// Preserve both live sources, including unsaved drafts after a real storage failure.
const trainingSnapshots = new Map();
function loadTraining() {
  const state = {
    progress: emptyProgress(),
    solves: [],
    cubeCollection: { cubes: [], defaultId: null },
    progressStorageUnreadable: false,
    solveStorageUnreadable: false,
    cubeStorageUnreadable: false,
    solveSaveFailed: false,
    notice: "",
  };
  const sources = [
    [
      "solves",
      SOLVES_KEY,
      validateSolves,
      "solveStorageUnreadable",
      "Solve history could not be loaded. Existing storage is preserved; new solves are only kept in this tab.",
    ],
    [
      "cubeCollection",
      CUBES_KEY,
      validateCubes,
      "cubeStorageUnreadable",
      "Cubes could not be loaded. Existing storage is preserved; changes are only kept in this tab.",
    ],
    [
      "progress",
      STORAGE_KEY,
      (value) => validateProgress(value, catalog),
      "progressStorageUnreadable",
      "Saved progress could not be loaded. Import a backup if you have one. Existing storage is preserved; new changes are only kept in this tab.",
    ],
  ];
  for (const [field, key, validate, errorFlag, message] of sources) {
    try {
      const raw = trainingStorage.getItem(key);
      if (raw) state[field] = validate(JSON.parse(raw));
    } catch {
      state[errorFlag] = true;
      state.notice = message;
    }
  }
  return { ...state, timerCubeId: state.cubeCollection.defaultId };
}
let {
  progress,
  solves,
  cubeCollection,
  timerCubeId,
  progressStorageUnreadable,
  solveStorageUnreadable,
  cubeStorageUnreadable,
  solveSaveFailed,
  notice: initialNotice,
} = loadTraining();
notice = initialNotice;
let currentSolveId = null;
let timerHistoryLimit = 50;
let solveDetailId = null;
let solveInline = false;
let solvePreviewVisible = false;
let solveDeleteConfirm = false;
let solveCopyMessage = "";
let editingCubeId = null;
let cubeFormRevision = 0;
let deletingCubeId = null;
function saveCubes(next) {
  next = validateCubes(next);
  try {
    if (cubeStorageUnreadable) throw Error("Unreadable cubes");
    trainingStorage.setItem(CUBES_KEY, JSON.stringify(next));
  } catch {
    notice =
      "Cubes could not be saved. Keep this tab open; existing stored data is preserved.";
  }
  cubeCollection = next;
}
function saveSolves(next = solves) {
  try {
    if (solveStorageUnreadable) throw new Error("Unreadable history");
    trainingStorage.setItem(SOLVES_KEY, JSON.stringify(next));
    solveSaveFailed = false;
    if (notice.startsWith("Solve history could not be saved.")) notice = "";
    return true;
  } catch {
    solveSaveFailed = true;
    notice =
      "Solve history could not be saved. Keep this tab open; existing stored data is preserved.";
    return false;
  }
}
function newTimerScramble() {
  currentSolveId = null;
  solveTimer.newScramble();
}
function advanceTimer() {
  const wasRunning = solveTimer.snapshot().status === "running";
  solveTimer.advance();
  currentSolveId = null;
  if (wasRunning) {
    const { elapsed, scramble } = solveTimer.snapshot();
    currentSolveId = crypto.randomUUID();
    const completedAt = new Date();
    solves.push({
      id: currentSolveId,
      cubeId: timerCubeId,
      elapsed,
      scramble,
      date: completedAt.toISOString(),
      day: dayKey(completedAt),
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
  const next = solves.filter((s) => s.id !== id);
  if (!saveSolves(next)) return false;
  solves = next;
  if (currentSolveId === id) {
    currentSolveId = null;
    solveTimer.clear();
  }
  return true;
}
if (identifyAttempts(progress)) save();
const dashboard = {
  range: "30",
  day: null,
  cube: "all",
};
let guideSection = "cross",
  guideExample = null;
let notationMove = "R",
  notationSuffix = "";
let activeModule = null;
const emptyBulkEdit = () => ({
  selected: [],
  known: "keep",
  learningSet: "keep",
});
let bulkEdit = null;
let librarySelectionScope = "";
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
  settings = false,
  backup = false,
  scramblePreview = false,
  pendingImport = null,
  importMessage = "",
  toast = "",
  focusId = null;
const byId = new Map(catalog.map((c) => [c.id, c]));
const chosenVariant = (c) =>
  progress.variants[c.id] ?? recommendedVariant(c, method);
const variant = (c) =>
  view === "practice" && session?.caseId === c.id
    ? session.variant
    : chosenVariant(c);
const selected = () =>
  progress.selected
    .map((id) => byId.get(id))
    .filter(
      (c) =>
        c &&
        (!activeModule ||
          moduleById(activeModule)?.kind !== "algorithms" ||
          moduleCases(moduleById(activeModule), catalog).includes(c)) &&
        (method === "full" ||
          methodGroups(catalog, c.section, method).some((g) =>
            g.cases.includes(c),
          )),
    );
function save(next = progress) {
  try {
    if (progressStorageUnreadable) throw Error("Unreadable progress");
    trainingStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    notice =
      "Your browser could not save progress. Keep this tab open and export a backup before leaving.";
    return false;
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
let dialogOpener = null;
let importGeneration = 0;
function rememberDialogOpener(button) {
  dialogOpener = {
    action: button.dataset.action,
    view: button.dataset.view,
    caseId: button.dataset.id,
    className: button.getAttribute("class"),
    elementId: button.id,
    reviewScope: button.dataset.reviewScope,
    fallbackId: button.dataset.reviewFallback,
  };
}
function closeDialogs() {
  if (settings && window.history.state?.settingsEntry) {
    window.history.back();
    return;
  }
  settings = false;
  practicePicker = null;
  scramblePreview = false;
  if (!solveInline) {
    solveDetailId = null;
    solvePreviewVisible = false;
    solveDeleteConfirm = false;
  }
  detail = null;
  backup = false;
  pendingImport = null;
  importMessage = "";
  importGeneration++;
  render();
  restoreDialogFocus();
}
function restoreDialogFocus() {
  const opener = [...document.querySelectorAll("[data-action]")].find(
    (el) =>
      el.dataset.action === dialogOpener?.action &&
      el.dataset.view === dialogOpener?.view &&
      el.dataset.id === dialogOpener?.caseId &&
      el.getAttribute("class") === dialogOpener?.className &&
      (!dialogOpener.elementId || el.id === dialogOpener.elementId),
  );
  const target =
    opener ||
    document.getElementById(dialogOpener?.fallbackId) ||
    (view === "library" && bulkEdit ? $("#bulk-mode") : null) ||
    (view === "progress" ? $("#activity-detail-title") : null);
  target?.focus({ preventScroll: true });
  dialogOpener = null;
  return !!target;
}
function solveReviewRows(scope) {
  return [...document.querySelectorAll("[data-review-scope]")].filter(
    (row) => row.dataset.reviewScope === scope,
  );
}

function updateTimer() {
  const snapshot = solveTimer.snapshot();
  if (view !== "timer") return;
  const clock = $("#timer-clock");
  if (clock && snapshot.status === "running")
    liveClock.text = formatElapsed(snapshot.elapsed, preferences.timerMinutes);
  if (snapshot.status === "running" && !preferences.hideTimer)
    timerFrame = requestAnimationFrame(updateTimer);
}
function currentRouteHash(showSettings = settings) {
  return routeHash({
    view,
    activeCourse: progress.activeCourse,
    activeModule,
    section,
    method,
    guideSection,
    settings: showSettings,
  });
}
function render() {
  if (view !== "progress" && solveInline) clearInlineSolve();
  if (view !== "timer") timerHistoryLimit = 50;
  const scope = JSON.stringify([
    view,
    activeModule,
    section,
    method,
    query,
    group,
    learned,
  ]);
  if (scope !== librarySelectionScope) {
    bulkEdit = bulkEdit && view === "library" ? emptyBulkEdit() : null;
    librarySelectionScope = scope;
  }
  if (commandState.open) closeCommands();
  const hash = currentRouteHash();
  if (location.hash !== hash)
    window.history.pushState({ settingsEntry: settings }, "", hash);

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
  const previousDialog = $("dialog[open]");
  const dialogScroll = previousDialog?.scrollTop;
  const dialogId = previousDialog?.id;
  const activeInDialog = !!active?.closest?.("dialog");
  const searchFocused = active?.id === "search";
  const textFocused = searchFocused || active?.id === "solve-notes";
  const start = textFocused ? active.selectionStart : null;
  const end = textFocused ? active.selectionEnd : null;
  flushSync(() => {
    appModel.snapshot = {
      state: snapshotViewState({
        settings,
        dashboard: { ...dashboard },
        pllQuiz,
        displayTop,
        scramblePreview,
        activeModule,
        guideSection,
        guideExample,
        notationMove,
        notationSuffix,
        timer: { ...solveTimer.snapshot(), hold: timerHold.snapshot() },
        solves,
        currentSolveId,
        timerHistoryLimit,
        solveDetailId,
        solveInline,
        solvePreviewVisible: solveInline
          ? !!dashboard.showCube
          : solvePreviewVisible,
        solveDeleteConfirm,
        solveCopyMessage,
        solveSaveFailed,
        cubeCollection,
        editingCubeId,
        cubeFormRevision,
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
        bulkEdit,
        session,
        backup,
        pendingImport,
        importMessage,
        toast,
        focusId,
      }),
      catalog,
      byId,
      variant: (c) => variant(c),
      selected: () => selected(),
    };
  });
  if (historyOpen && $(".timer-history")) $(".timer-history").open = true;
  const dialog = $("dialog");
  if (dialog) {
    if (!dialog.open) dialog.showModal();
    dialog.oncancel = (event) => {
      event.preventDefault();
      closeDialogs();
    };
    dialog.onclick = (e) => {
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
    };
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
    }
  }
  if (textFocused && document.getElementById(activeId)) {
    document.getElementById(activeId).focus({ preventScroll: true });
    if (start !== null)
      document.getElementById(activeId).setSelectionRange(start, end);
  }
  updateTimer();
  mountCubePlayers();
  if (dialog && dialog.id === dialogId) dialog.scrollTop = dialogScroll;
}
function resetLibraryFilters() {
  query = "";
  group = "all";
  learned = "all";
}
function startPllQuiz() {
  chooseDisplayColor();
  pllQuiz = { question: createPllQuestion(catalog), correct: 0, total: 0 };
  view = "pll-quiz";
  session = null;
}
function openCfop(id) {
  openCourseModule("cfop", id);
}
function openCourseModule(courseId, id) {
  const course = courseById(courseId);
  const module = moduleById(id);
  if (!course || course.status || !course.modules.includes(id) || !module)
    return;
  if (view === "timer") solveTimer.stop();
  activeModule = id;
  progress.activeCourse = courseId;
  progress.resume ||= {};
  progress.resume[courseId] = id;
  session = null;
  detail = null;
  guideExample = null;
  resetLibraryFilters();
  if (module.kind === "algorithms") {
    view = "library";
    section = module.section;
    method = module.method;
    preferences.method = method;
    savePreferences(preferences);
  } else if (module.kind === "lesson") {
    view = "lesson";
  } else {
    view = "guides";
    guideSection = module.guide;
  }
  save();
}
function nextCase(completed = 0, caseIds = session?.pool) {
  chooseDisplayColor();
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
    variant: chosenVariant(c),
    method,
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
  const completedAt = new Date();
  progress.attempts.push({
    id: crypto.randomUUID(),
    caseId: c.id,
    variant: session.variant,
    method: session.method,
    result,
    mode,
    day: dayKey(completedAt),
    at: completedAt.toISOString(),
  });
  save();
}
function chooseOption(control, value) {
  if (bulkEdit && ["bulk-known", "bulk-learning-set"].includes(control)) {
    if (!["keep", "add", "remove"].includes(value)) return;
    bulkEdit[control === "bulk-known" ? "known" : "learningSet"] = value;
  }
  if (control === "dashboard-cube") {
    dashboard.cube = value;
    clearInlineSolve();
  }
  if (control === "timer-cube") {
    if (solveTimer.snapshot().status === "running") return;
    timerCubeId = value || null;
  }
  if (control.startsWith("solve-cube-")) {
    if (solveTimer.snapshot().status === "running") return;
    const solve = solves.find((item) => `solve-cube-${item.id}` === control);
    if (!solve || solve.id !== solveDetailId) return;
    if (
      value &&
      !cubeCollection.cubes.some(
        (cube) =>
          cube.id === value && (!cube.deleted || cube.id === solve.cubeId),
      )
    )
      return;
    solve.cubeId = value || null;
    const saved = saveSolves();
    if (
      saved &&
      solveInline &&
      !solveSelection(solves, dashboardSolveOptions(), solve.id)
    )
      clearInlineSolve();
  }
  if (control === "learned") learned = value;
  if (control === "method") {
    method = value;
    activeModule = null;
    preferences.method = method;
    savePreferences(preferences);
    group = "all";
  }
  if (control === "group") group = value;
  if (control === "variant") {
    progress.variants[detail] = Number(value);
    save();
    pruneLibrarySelection();
  }
  render();
  (
    document.getElementById(control) ||
    (view === "progress" ? $("#dashboard-cube") : null)
  )?.focus();
  return;
}
function setLibrarySelection(ids, checked) {
  if (!bulkEdit || view !== "library") return;
  const selected = new Set(bulkEdit.selected);
  for (const id of ids) {
    if (!byId.has(id)) continue;
    if (checked) selected.add(id);
    else selected.delete(id);
  }
  bulkEdit.selected = [...selected];
  render();
}
function currentLibraryGroups() {
  const index = createProgressIndex(progress, method);
  return libraryGroups(
    catalog,
    { section, method, group, query, learned },
    (c) => learnedStatus(index.statusFor(c.id, variant(c))),
  );
}
function pruneLibrarySelection() {
  if (!bulkEdit || learned === "all") return;
  const eligible = new Set(
    currentLibraryGroups().flatMap((g) => g.cases.map((c) => c.id)),
  );
  bulkEdit.selected = bulkEdit.selected.filter((id) => eligible.has(id));
}
document.addEventListener("click", (e) => {
  const button = e.target.closest("[data-action]");
  if (!button) return;
  if (button.disabled) return;
  e.preventDefault();
  const { action, id } = button.dataset;
  if (action === "commands") {
    openCommands();
    return;
  }
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
    case "bulk-mode":
      bulkEdit = bulkEdit ? null : emptyBulkEdit();
      render();
      $(bulkEdit ? "#bulk-select-all" : "#bulk-mode")?.focus();
      return;
    case "bulk-clear":
      if (!bulkEdit) return;
      bulkEdit = emptyBulkEdit();
      render();
      $("#bulk-select-all")?.focus();
      return;
    case "bulk-apply": {
      if (
        !bulkEdit ||
        (bulkEdit.known === "keep" && bulkEdit.learningSet === "keep")
      )
        return;
      const choices = currentLibraryGroups()
        .flatMap((g) => g.cases)
        .filter((c) => bulkEdit.selected.includes(c.id))
        .map((c) => ({ id: c.id, variant: variant(c) }));
      if (!choices.length) return;
      const next = withCaseProperties(progress, choices, bulkEdit);
      if (save(next)) {
        progress = next;
        bulkEdit = emptyBulkEdit();
        if (notice.startsWith("Your browser could not save progress."))
          notice = "";
        notify(
          `Updated ${choices.length} ${choices.length === 1 ? "case" : "cases"}.`,
        );
        render();
        $("#bulk-select-all")?.focus();
        return;
      }
      break;
    }
    case "guide-section":
      if (!["cross", "f2l", "notation"].includes(id)) return;
      guideSection = id;
      if (activeModule !== id) activeModule = null;
      guideExample = id === "notation" ? "notation" : null;
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
      setKnown(
        progress,
        id,
        variant(c),
        !isKnown(progress, id, variant(c), method),
        method,
      );
      save();
      pruneLibrarySelection();
      break;
    }
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
    case "solve-details":
      if (
        solveTimer.snapshot().status === "running" ||
        !solves.some((solve) => solve.id === id)
      )
        return;
      if (view === "progress") {
        selectInlineSolve(id);
        render();
        focusInlineSolve();
        return;
      }
      rememberDialogOpener(button);
      solveInline = false;
      solveDetailId = id;
      solvePreviewVisible = solveDeleteConfirm = false;
      solveCopyMessage = "";
      render();
      $("[aria-label='Close solve details']")?.focus();
      return;
    case "solve-preview":
      if (solveInline) dashboard.showCube = !dashboard.showCube;
      else solvePreviewVisible = !solvePreviewVisible;
      break;
    case "solve-copy": {
      const solve = solves.find((item) => item.id === solveDetailId);
      if (!solve) return;
      const copiedId = solve.id;
      (async () => {
        let message;
        try {
          await navigator.clipboard.writeText(solve.scramble);
          message = "Scramble copied.";
        } catch {
          message = "Copy unavailable. Select the scramble text to copy it.";
        }
        if (solveDetailId === copiedId) {
          solveCopyMessage = message;
          render();
        }
      })();
      return;
    }
    case "solve-retry":
      saveSolves();
      if (
        !solveSaveFailed &&
        solveInline &&
        !solveSelection(solves, dashboardSolveOptions(), solveDetailId)
      )
        clearInlineSolve();
      render();
      if (!solveSaveFailed)
        ($("#solve-notes") || $("#dashboard-cube"))?.focus();
      return;
    case "solve-delete":
      solveDeleteConfirm = true;
      render();
      $("[data-action='solve-delete-cancel']")?.focus();
      return;
    case "solve-delete-cancel":
      solveDeleteConfirm = false;
      render();
      $("[data-action='solve-delete']")?.focus();
      return;
    case "solve-delete-confirm": {
      if (solveInline) {
        const selection = solveSelection(
          solves,
          dashboardSolveOptions(),
          solveDetailId,
        );
        if (!solveDeleteConfirm || !deleteSolve(solveDetailId)) break;
        const nextId = selection?.nextId || selection?.previousId;
        clearInlineSolve();
        if (nextId) selectInlineSolve(nextId);
        render();
        if (nextId) focusInlineSolve();
        else ($("#dashboard-cube") || $("#activity-detail-title"))?.focus();
        return;
      }
      const scope = dialogOpener?.reviewScope;
      const index = scope
        ? solveReviewRows(scope).findIndex(
            (row) => row.id === dialogOpener.elementId,
          )
        : -1;
      if (!solveDeleteConfirm || !deleteSolve(solveDetailId)) break;
      if (dashboard.solveId === solveDetailId) dashboard.solveId = null;
      solveDetailId = null;
      render();
      const rows = scope ? solveReviewRows(scope) : [];
      const neighbor = rows[Math.min(index, rows.length - 1)];
      if (index >= 0 && neighbor) {
        neighbor.focus();
        dialogOpener = null;
        return;
      }
      if (!restoreDialogFocus()) {
        (scope === "timer"
          ? $(".timer-history summary")
          : $("#timer-toggle")
        )?.focus();
      }
      return;
    }
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
      cubeFormRevision++;
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
    case "timer-penalty": {
      if (solveTimer.snapshot().status === "running") return;
      const solve = solves.find((s) => s.id === button.dataset.solveId);
      const penalty = button.dataset.penalty;
      if (!solve || !["none", "+2", "dnf"].includes(penalty)) return;
      if (penalty === "none") delete solve.penalty;
      else solve.penalty = penalty;
      saveSolves();
      render();
      [...document.querySelectorAll('[data-action="timer-penalty"]')]
        .find(
          (el) =>
            el.dataset.solveId === solve.id &&
            el.dataset.penalty === penalty &&
            !!el.closest("#solve-dialog") === !!button.closest("#solve-dialog"),
        )
        ?.focus();
      return;
    }
    case "timer-new":
      newTimerScramble();
      break;
    case "timer-history-more":
      if (solveTimer.snapshot().status === "running") return;
      timerHistoryLimit += 50;
      render();
      (
        $("#timer-history-more") ||
        $("#timer-history-list li:last-child button")
      )?.focus();
      return;
    case "pll-quiz":
      startPllQuiz();
      break;
    case "pll-answer":
      if (
        !pllQuiz ||
        pllQuiz.question.answer ||
        !pllQuiz.question.choices.includes(id)
      )
        return;
      pllQuiz.question.answer = id;
      pllQuiz.total++;
      if (id === pllQuiz.question.caseId) pllQuiz.correct++;
      render();
      $("[data-action='pll-next']")?.focus();
      return;
    case "pll-next":
      if (!pllQuiz?.question.answer) return;
      chooseDisplayColor();
      pllQuiz.question = createPllQuestion(catalog);
      render();
      $("[data-action='pll-answer']")?.focus();
      return;
    case "open-course":
      if (!courseById(id) || courseById(id).status) return;
      openCourseModule(id, progress.resume?.[id] || courseById(id).modules[0]);
      break;
    case "courses-back":
      activeModule = null;
      view = "courses";
      break;
    case "open-module":
      openCourseModule(button.dataset.course, id);
      break;
    case "course-example":
      if (moduleById(activeModule)?.kind !== "lesson") return;
      if (!moduleExampleIds(moduleById(activeModule)).includes(id)) return;
      guideExample = guideExample === id ? null : id;
      break;
    case "cfop-method":
      if (!["full", "two-look"].includes(id)) return;
      openCfop(`${id}-${section.toLowerCase()}`);
      break;
    case "review-lesson": {
      if (!reviewIds.includes(id)) return;
      const reviewed = progress.reviewed || [];
      progress.reviewed = reviewed.includes(id)
        ? reviewed.filter((value) => value !== id)
        : [...reviewed, id];
      save();
      break;
    }
    case "nav":
      if (button.dataset.view === "settings") {
        rememberDialogOpener(button);
        settings = true;
        cancelTimerHold();
        render();
        return;
      }
      settings = false;
      if (view === "timer") solveTimer.stop();
      scramblePreview = false;
      clearInlineSolve();
      solveDetailId = null;
      view = button.dataset.view;
      if (view !== "home" && view !== "progress") activeModule = null;
      guideExample =
        view === "guides" && guideSection === "notation" ? "notation" : null;
      session = null;
      detail = null;
      break;
    case "section":
      section = button.dataset.section;
      activeModule = null;
      group = "all";
      break;
    case "clear-search":
      resetLibraryFilters();
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
      chooseDisplayColor();
      rememberDialogOpener(button);
      detail = id;
      detailSetupVisible = false;
      break;
    case "display-color": {
      const colors = Object.keys(displayColors);
      displayTop = colors[(colors.indexOf(displayTop) + 1) % colors.length];
      break;
    }
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
      rememberDialogOpener(button);
      practicePicker = {
        section,
        selected: [],
        groups: currentLibraryGroups(),
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
      if (activeModule) openCourseModule(progress.activeCourse, activeModule);
      else {
        view = "home";
        session = null;
      }
      break;
    case "rate":
      record(session.hinted ? "help" : button.dataset.result, "recognition");
      nextCase(session.completed + 1);
      break;
    case "rehearse":
      chooseDisplayColor();
      detail = null;
      view = "practice";
      session = {
        caseId: id,
        variant: chosenVariant(byId.get(id)),
        method,
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
      const blob = new Blob(
        [
          JSON.stringify(
            trainingBackup(progress, solves, cubeCollection),
            null,
            2,
          ),
        ],
        {
          type: "application/json",
        },
      );
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `last-layer-${preferences.testData ? "test-data-" : ""}${dayKey()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify("Progress exported.");
      return;
    }
    case "dashboard-range":
      if (!progressRanges.some((range) => range.value === button.dataset.range))
        return;
      selectDashboardRange(button.dataset.range);
      break;
    case "dashboard-section":
      dashboard.collapsed = {
        ...dashboard.collapsed,
        [button.dataset.section]:
          !dashboard.collapsed?.[button.dataset.section],
      };
      break;
    case "daily-solve":
      selectInlineSolve(id);
      break;
    case "activity-all":
    case "activity-day":
      clearInlineSolve();
      dashboard.day =
        action === "activity-all" || dashboard.day === button.dataset.day
          ? null
          : button.dataset.day;
      dashboard.deleteDay = null;
      dashboard.deleteMessage = "";
      break;
    case "delete-day":
      dashboard.deleteDay = dashboard.day;
      dashboard.deleteMessage = "";
      render();
      $("[data-action='cancel-delete-day']")?.focus();
      return;
    case "cancel-delete-day":
      dashboard.deleteDay = null;
      dashboard.deleteMessage = "";
      render();
      $("[data-action='delete-day']")?.focus();
      return;
    case "confirm-delete-day": {
      if (
        !dashboard.day ||
        dashboard.deleteDay !== dashboard.day ||
        solveTimer.snapshot().status === "running"
      )
        return;
      const next = withoutActivityDay(progress, solves, dashboard.day);
      try {
        if (
          progressStorageUnreadable ||
          solveStorageUnreadable ||
          cubeStorageUnreadable
        )
          throw Error("Unreadable training data");
        restoreBackup(
          trainingStorage.target,
          trainingBackup(next.progress, next.solves, cubeCollection),
        );
      } catch {
        dashboard.deleteMessage =
          "This day could not be deleted. Your previous data is preserved. Free browser storage and try again.";
        break;
      }
      progress = next.progress;
      solves = next.solves;
      solveSaveFailed = false;
      if (currentSolveId && !solves.some((s) => s.id === currentSolveId)) {
        currentSolveId = null;
        solveTimer.clear();
      }
      clearInlineSolve();
      dashboard.deleteDay = null;
      dashboard.deleteMessage = "";
      render();
      $("#activity-detail-title")?.focus();
      notify("Day’s activity deleted.");
      return;
    }
    case "confirm-import":
      if (pendingImport) {
        try {
          restoreBackup(trainingStorage.target, pendingImport);
        } catch {
          importMessage =
            "Backup could not be saved. Your previous data is preserved. Free browser storage and try again.";
          break;
        }
        progress = pendingImport.progress;
        progressStorageUnreadable = false;
        if (pendingImport.solves) {
          solves = pendingImport.solves;
          cubeCollection = pendingImport.cubeCollection;
          solveStorageUnreadable = cubeStorageUnreadable = false;
          solveSaveFailed = false;
          timerCubeId = cubeCollection.defaultId;
          dashboard.cube = "all";
          currentSolveId = null;
          solveTimer.clear();
        }
        if (!solveStorageUnreadable && !cubeStorageUnreadable) notice = "";
        pendingImport = null;
        backup = false;
        focusId = null;
        activeModule = null;
        session = null;
        view = "home";
      }
      break;
  }
  render();
  if (
    [
      "nav",
      "pll-quiz",
      "open-course",
      "open-module",
      "courses-back",
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
  if (action === "daily-solve") {
    if (button.tagName.toLowerCase() === "a") focusInlineSolve();
    else if (document.getElementById(button.id)?.disabled)
      (
        $("#previous-selected-solve:not(:disabled)") ||
        $("#next-selected-solve:not(:disabled)") ||
        $("#selected-solve-title")
      )?.focus({ preventScroll: true });
  }
  if (action === "rehearsal-done") notify("Repetition recorded.");
  if (action === "rate")
    notify("Practice recorded. Start solved for the next case.");
});
function clearInlineSolve() {
  if (solveInline) solveDetailId = null;
  solveInline = false;
  dashboard.solveId = null;
  solveDeleteConfirm = false;
  solveCopyMessage = "";
}
function dashboardSolveOptions() {
  const range = progressRange({ today: dayKey(), range: dashboard.range });
  return {
    since: dashboard.day || range.since,
    today: dashboard.day || range.until,
    cube: dashboard.cube || "all",
  };
}
function selectInlineSolve(id) {
  if (view !== "progress" || !solves.some((solve) => solve.id === id)) return;
  if (!solveInline || solveDetailId !== id) {
    solveDeleteConfirm = false;
    solveCopyMessage = "";
  }
  solveDetailId = dashboard.solveId = id;
  solveInline = true;
}
function focusInlineSolve() {
  const heading = $("#selected-solve-title");
  heading?.focus({ preventScroll: true });
  heading?.scrollIntoView({ block: "nearest" });
}
function selectDashboardRange(range) {
  progressRange({ today: dayKey(), range });
  clearInlineSolve();
  Object.assign(dashboard, {
    range,
    day: null,
    deleteDay: null,
    deleteMessage: "",
  });
}
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
  cubeFormRevision++;
  render();
  $("#cube-editor").open = false;
  $("#cube-editor summary")?.focus();
});
document.addEventListener("input", (e) => {
  if (e.target.id === "solve-notes") {
    const solve = solves.find((item) => item.id === solveDetailId);
    if (!solve || e.target.value.length > MAX_SOLVE_NOTES_LENGTH) return;
    if (e.target.value) solve.notes = e.target.value;
    else delete solve.notes;
    saveSolves();
    render();
    return;
  }
  if (e.target.id === "cube-name") e.target.setCustomValidity("");
  if (e.target.id === "search") {
    query = e.target.value;
    render();
  }
});
function setPreference(id, value) {
  if (id === "test-data") {
    if (
      value === preferences.testData ||
      solveTimer.snapshot().status === "running"
    )
      return;
    trainingSnapshots.set(preferences.testData, {
      progress,
      solves,
      cubeCollection,
      timerCubeId,
      progressStorageUnreadable,
      solveStorageUnreadable,
      cubeStorageUnreadable,
      solveSaveFailed,
      notice,
    });
    trainingStorage.setTestData(value);
    ({
      progress,
      solves,
      cubeCollection,
      timerCubeId,
      progressStorageUnreadable,
      solveStorageUnreadable,
      cubeStorageUnreadable,
      solveSaveFailed,
      notice,
    } = trainingSnapshots.get(value) || loadTraining());
    preferences.testData = value;
    timerHistoryLimit = 50;
    const saved = savePreferences(preferences);
    if (identifyAttempts(progress)) save();
    cancelTimerHold();
    newTimerScramble();
    solveDetailId =
      detail =
      practicePicker =
      bulkEdit =
      session =
      pllQuiz =
        null;
    solveInline = false;
    solvePreviewVisible = solveDeleteConfirm = scramblePreview = false;
    editingCubeId = deletingCubeId = null;
    cubeFormRevision++;
    backup = false;
    pendingImport = null;
    importMessage = "";
    importGeneration++;
    activeModule = null;
    focusId = null;
    if (["practice", "pll-quiz", "lesson"].includes(view)) view = "home";
    Object.assign(dashboard, {
      day: null,
      cube: "all",
      solveId: null,
      deleteDay: null,
      deleteMessage: "",
    });
    resetLibraryFilters();
    render();
    if (!saved) notify("This setting could not be saved.");
    return;
  }
  const keys = {
    "hide-timer": "hideTimer",
    "timer-minutes": "timerMinutes",
    "random-display": "randomDisplay",
    "pll-arrows": "pllArrows",
    "random-side": "randomLastLayer",
    "display-top": "displayTop",
  };
  if (!Object.hasOwn(keys, id)) return;
  if (id === "display-top" && !Object.hasOwn(displayColors, value)) return;
  preferences[keys[id]] = value;
  if (["display-top", "random-display"].includes(id))
    displayTop = preferences.displayTop;
  const saved = savePreferences(preferences);
  if (id === "random-side" && session?.stage === "setup") {
    session.setup = generateSetup(byId.get(session.caseId), {
      randomLastLayer: preferences.randomLastLayer,
    });
  }
  render();
  if (!saved) notify("This setting could not be saved.");
}

document.addEventListener("change", async (e) => {
  if (e.target.id === "notation-move") {
    notationMove = e.target.value;
    render();
  }
  if (e.target.id === "display-top")
    setPreference("display-top", e.target.value);
  if (e.target.id === "import-file") {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const generation = ++importGeneration;
    pendingImport = null;
    importMessage = "";
    render();
    try {
      if (file.size > 100_000_000)
        throw Error("Choose a backup file smaller than 100 MB.");
      const contents = await file.text();
      if (!backup || generation !== importGeneration) return;
      pendingImport = validateBackup(JSON.parse(contents), catalog);
      identifyAttempts(pendingImport.progress);
      render();
    } catch (error) {
      if (!backup || generation !== importGeneration) return;
      pendingImport = null;
      importMessage =
        error instanceof SyntaxError
          ? "That file is not valid JSON. Choose a Last Layer export."
          : error.message;
      render();
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
  for (const player of previous) player.events.abort();
  // A modal suspends the page player underneath it.
  const scope = document.querySelector("dialog") || document;
  cubePlayers = [...scope.querySelectorAll(".cube-player")].map((root) => {
    const config = {
      mode: root.dataset.cubeMode,
      algorithm: root.dataset.algorithm,
      setup: root.dataset.setup,
      top: root.dataset.displayTop,
    };
    const key = JSON.stringify([
      root.dataset.playerId,
      config.mode,
      config.algorithm,
      config.setup,
      config.top,
    ]);
    const old = previous.find((p) => p.key === key);
    const events = new AbortController();
    const player = {
      events,
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
    stage.addEventListener(
      "pointerdown",
      (e) => {
        if (e.button !== 0) return;
        drag = { x: e.clientX, y: e.clientY };
        stage.setPointerCapture(e.pointerId);
      },
      { signal: events.signal },
    );
    stage.addEventListener(
      "pointermove",
      (e) => {
        if (!drag) return;
        player.yaw += (e.clientX - drag.x) * 0.5;
        player.pitch = Math.max(
          -85,
          Math.min(85, player.pitch - (e.clientY - drag.y) * 0.5),
        );
        drag = { x: e.clientX, y: e.clientY };
        paintCube(player);
      },
      { signal: events.signal },
    );
    stage.addEventListener(
      "pointerup",
      () => {
        drag = null;
      },
      { signal: events.signal },
    );
    stage.addEventListener(
      "pointercancel",
      () => {
        drag = null;
      },
      { signal: events.signal },
    );
    stage.addEventListener(
      "keydown",
      (e) => {
        if (
          !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
        )
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
      },
      { signal: events.signal },
    );
    // Scrubbing pauses so the solve stays where the user lets go.
    const scrubber = root.querySelector(".cube-scrubber");
    scrubber?.addEventListener(
      "input",
      () => {
        player.playback.scrub(Number(scrubber.value));
        paintCube(player);
        scheduleCubes();
      },
      { signal: events.signal },
    );
    // The fine pointer step is too small for keys; step whole moves instead.
    scrubber?.addEventListener(
      "keydown",
      (e) => {
        const position = player.playback.position();
        const back = Math.ceil(position) - 1,
          forward = Math.floor(position) + 1;
        const target = {
          ArrowLeft: back,
          ArrowDown: back,
          PageDown: back,
          ArrowRight: forward,
          ArrowUp: forward,
          PageUp: forward,
          Home: 0,
          End: player.playback.moves.length,
        }[e.key];
        if (target === undefined) return;
        e.preventDefault();
        player.playback.seek(target);
        paintCube(player);
        scheduleCubes();
      },
      { signal: events.signal },
    );
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
function restoreRoute() {
  const route = readRoute(location.hash);
  const samePage = location.hash.split("?")[0] === currentRouteHash(false);
  if (!samePage) {
    cancelTimerHold();
    solveTimer.stop();
    session = null;
    guideExample = null;
    resetLibraryFilters();
    editingCubeId = deletingCubeId = null;
    activeModule = null;
    if (route.activeModule)
      openCourseModule(route.activeCourse || "cfop", route.activeModule);
    else {
      view = route.view === "practice" ? "home" : route.view;
      section = route.section || section;
      method = route.method || method;
      guideSection = route.guideSection || guideSection;
      guideExample =
        view === "guides" && guideSection === "notation" ? "notation" : null;
    }
    if (view === "pll-quiz") startPllQuiz();
  }
  settings = route.settings;
  detail = practicePicker = pendingImport = null;
  importMessage = "";
  backup = scramblePreview = false;
  if (!samePage || !solveInline) {
    solveDetailId = null;
    solveInline = false;
    dashboard.solveId = null;
  }
  importGeneration++;
  window.history.replaceState(window.history.state, "", currentRouteHash());
}
window.addEventListener("hashchange", () => {
  const wasSettings = settings;
  restoreRoute();
  render();
  if (!settings && !(wasSettings && restoreDialogFocus()))
    (wasSettings ? $(".header-settings") : $("#main"))?.focus();
});
restoreRoute();

render();

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
  event.stopImmediatePropagation();
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
    newTimerScramble();
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

let commandOpener = null;
function openCommands() {
  if ($("dialog[open]") || solveTimer.snapshot().status === "running") return;
  cancelTimerHold();
  commandOpener = document.activeElement;
  flushSync(() => {
    commandState.query = "";
    commandState.open = true;
  });
  const dialog = $("#command-dialog");
  dialog.oncancel = (event) => {
    event.preventDefault();
    closeCommands();
  };
  dialog.showModal();
  $("#command-search").focus();
}
function closeCommands() {
  flushSync(() => {
    commandState.open = false;
  });
  if (commandOpener?.isConnected) commandOpener.focus({ preventScroll: true });
  commandOpener = null;
}
function runCommand(command) {
  if (!command) return;
  closeCommands();
  if (command === "settings" || command === "backup") {
    $(
      command === "settings" ? ".header-settings" : "[data-action='backup']",
    ).click();
  } else {
    window.history.pushState(null, "", `#/${command}`);
    restoreRoute();
    render();
    $("#main")?.focus();
  }
}

document.addEventListener("keydown", (event) => {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    $("dialog[open]") ||
    document.querySelector('[data-slot="select-trigger"][aria-expanded="true"]')
  )
    return;
  if (
    event.key !== "Escape" &&
    !((event.ctrlKey || event.metaKey) && event.code === "KeyK")
  )
    return;
  event.preventDefault();
  openCommands();
});
