import { syncStatus, syncFeedback } from "./sync-status.js";
import { createCloudSync } from "./cloud-sync.js";
import { createSyncQueue } from "./sync-queue.js";
import { createDemoAccount, DEMO_CODE } from "./demo-account.js";
import { developmentTestData } from "./development.js";
import {
  username,
  profileRemote,
  profileDetails,
  profileHasDraft,
} from "./profiles.js";
import {
  mergeBackup,
  prepareBackupImport,
  trainingCounts,
} from "./backup-import.js";
import {
  supabaseConfig,
  readAuthRedirect,
  loadSupabase,
  trainingRemote,
} from "./supabase.js";
import {
  trainingBackup,
  validateBackup,
  restoreBackup,
  recoverRestore,
} from "./training-backup.js";
import { createTestData } from "./test-data.js";
import {
  createTrainingStorage,
  removeAccountCache,
} from "./training-storage.js";
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
  moduleBlocks,
} from "./courses.js";
import "./courses.css";
import { createPlayerPlayback, createCubeRenderer } from "./cube-player.js";
import "./cube-player.css";
import { CUBES_KEY, validateCubes, deleteCube } from "./cubes.js";
import {
  SOLVES_KEY,
  MAX_SOLVE_NOTES_LENGTH,
  validateSolves,
  withSolveChanges,
} from "./solve-history.js";
import { createProgressIndex } from "./progress-index.js";
import { libraryGroups, learnedStatus } from "./library.js";
import { withCaseProperties } from "./bulk-properties.js";
import { hiddenPracticeCases, withRelearnedCase } from "./hidden-practice.js";
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
import "./account-workspace.css";
const authRedirect = readAuthRedirect(location.hash);
if (authRedirect)
  window.history.replaceState(
    null,
    "",
    `${location.pathname}${location.search}#/account`,
  );
initTheme();
mount(App, {
  target: document.getElementById("app"),
  props: {
    model: appModel,
    actions: {
      setPreference,
      setProfileField,
      chooseOption,
      setLibrarySelection,
      setTimerSelection,
      closeCommands,
      runCommand,
      closeDialog: (id) =>
        id === "command-dialog" ? closeCommands() : closeDialogs(),
    },
  },
});
const preferences = loadPreferences();
preferences.testData = developmentTestData(
  preferences.testData,
  import.meta.env.DEV,
  import.meta.env.VITE_DEV_DATA_MODE,
  location.search,
);
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
let accountId = null;
let supabaseClient;
let loadingSupabase;
let authSubscribed = false;
let handledAuthRedirect = false;
let syncEngine;
let syncQueue;
let authGeneration = 0;
let pendingEmail = "";
let profileGeneration = 0;
let profilePageGeneration = 0;
let profileUsername = "";
let profilePage = { status: "idle", profile: null, message: "" };
let cloudConfig;
const account = {
  configured: false,
  reauth: false,
  email: "",
  busy: false,
  codeSent: false,
  signInEmail: "",
  profile: null,
  profileLoading: false,
  profileError: false,
  usernameDraft: "",
  guestImportPending: false,
  profileDraft: null,
  deletePending: false,
  deleteConfirmation: "",
  deleting: false,
  message: "Cloud sync is not configured. Guest progress is saved locally.",
  sync: { status: "idle", message: "Saved on this device.", conflict: false },
};
const demo = createDemoAccount(
  () => trainingBackup(progress, solves, cubeCollection),
  catalog,
);
const demoAccount = { ...account, demo: true };
function visibleAccount() {
  return preferences.testData ? demoAccount : account;
}
function refreshDemoAccount() {
  profileGeneration++;
  profilePageGeneration++;
  const profile = demo.session ? demo.profile : null;
  Object.assign(demoAccount, {
    configured: true,
    reauth: false,
    email: demo.session?.user.email || "",
    busy: false,
    codeSent: false,
    signInEmail: "",
    usernameDraft: "",
    profile,
    profileDraft: profile ? profileDetails(profile) : null,
    profileLoading: demo.scenario === "loading",
    profileError: demo.scenario === "error",
    scenario: demo.scenario,
    guestImportPending: false,
    deletePending: false,
    deleteConfirmation: "",
    message: "",
    sync: demo.sync(),
  });
}
refreshDemoAccount();
try {
  cloudConfig = supabaseConfig(import.meta.env);
  account.configured = Boolean(cloudConfig);
  if (cloudConfig) account.message = "";
} catch (error) {
  account.message = error.message;
}
function scheduleSync() {
  if (preferences.testData) {
    demoAccount.sync = demo.sync();
    return;
  }
  if (!account.deleting && !trainingReloads.has(trainingStorage.scope))
    void syncQueue?.request();
}
function stopAccountSync() {
  syncQueue?.cancel();
  syncQueue = null;
  syncEngine?.cancel();
  syncEngine = null;
}
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
const trainingBytes = new Map();
const trainingReloads = new Set();
const trainingKeys = [STORAGE_KEY, SOLVES_KEY, CUBES_KEY];
function rememberTrainingBytes() {
  trainingBytes.set(
    trainingStorage.scope,
    trainingKeys.map((key) => trainingStorage.target.getItem(key)),
  );
}
function assertTrainingUnchanged() {
  if (!accountId || preferences.testData) return;
  const previous = trainingBytes.get(trainingStorage.scope);
  if (
    !previous ||
    trainingKeys.some(
      (key, index) => trainingStorage.target.getItem(key) !== previous[index],
    )
  )
    throw Error(
      "Another tab changed this account's data. Export unsaved changes before reloading.",
    );
}
const failedTrainingSaves = new Set();
const failedSaveKey = (key) => `${trainingStorage.scope}:${key}`;
function clearTrainingFailures() {
  for (const key of [STORAGE_KEY, SOLVES_KEY, CUBES_KEY])
    failedTrainingSaves.delete(failedSaveKey(key));
}
function hasUnsavedTraining() {
  return [STORAGE_KEY, SOLVES_KEY, CUBES_KEY].some((key) =>
    failedTrainingSaves.has(failedSaveKey(key)),
  );
}
function clearTrainingNotice() {
  if (
    !hasUnsavedTraining() &&
    !progressStorageUnreadable &&
    !solveStorageUnreadable &&
    !cubeStorageUnreadable
  )
    notice = "";
}
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
  try {
    rememberTrainingBytes();
  } catch {
    /* Existing unreadable flags keep sync paused. */
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
const emptyTimerBulkEdit = () => ({
  selected: [],
  cubeId: "keep",
  confirmDelete: false,
  failed: false,
});
let timerBulkEdit = null;
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
    assertTrainingUnchanged();
    trainingStorage.setItem(CUBES_KEY, JSON.stringify(next));
    rememberTrainingBytes();
    failedTrainingSaves.delete(failedSaveKey(CUBES_KEY));
    clearTrainingNotice();
    scheduleSync();
  } catch {
    failedTrainingSaves.add(failedSaveKey(CUBES_KEY));
    notice =
      "Cubes could not be saved. Keep this tab open; existing stored data is preserved.";
  }
  cubeCollection = next;
}
function saveSolves(next = solves) {
  try {
    if (solveStorageUnreadable) throw new Error("Unreadable history");
    assertTrainingUnchanged();
    trainingStorage.setItem(SOLVES_KEY, JSON.stringify(next));
    rememberTrainingBytes();
    failedTrainingSaves.delete(failedSaveKey(SOLVES_KEY));
    scheduleSync();
    solveSaveFailed = false;
    clearTrainingNotice();
    return true;
  } catch {
    failedTrainingSaves.add(failedSaveKey(SOLVES_KEY));
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
  if (timerBulkEdit) {
    timerBulkEdit.selected = timerBulkEdit.selected.filter(
      (selected) => selected !== id,
    );
    timerBulkEdit.confirmDelete = false;
    if (!solves.length) timerBulkEdit = null;
  }
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
let practiceOptions = { source: "learning", section: "both" };
let view = "home",
  accountSection = "settings",
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
  syncDetails = false,
  backup = false,
  scramblePreview = false,
  pendingImport = null,
  importPreview = null,
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
    assertTrainingUnchanged();
    trainingStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    rememberTrainingBytes();
    failedTrainingSaves.delete(failedSaveKey(STORAGE_KEY));
    clearTrainingNotice();
    scheduleSync();
    return true;
  } catch {
    failedTrainingSaves.add(failedSaveKey(STORAGE_KEY));
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
let settingsBackupOpener = null;
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
  const wasSettings = settings;
  if (backup && settingsBackupOpener) {
    backup = false;
    pendingImport = null;
    importMessage = "";
    importGeneration++;
    settings = true;
    dialogOpener = settingsBackupOpener.opener;
    window.history.replaceState(
      settingsBackupOpener.entry,
      "",
      currentRouteHash(true),
    );
    settingsBackupOpener = null;
    render();
    resumeDeferredSync();
    // Keep the original Settings opener for the eventual close.
    $("#settings-dialog [data-action='backup']")?.focus();
    return;
  }
  if (settings && window.history.state?.settingsEntry) {
    window.history.back();
    return;
  }
  if (settings)
    window.history.replaceState(
      window.history.state,
      "",
      currentRouteHash(false),
    );
  settings = false;
  syncDetails = false;
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
  if (!restoreDialogFocus())
    (wasSettings ? $(".header-settings") : $("#main"))?.focus();
  resumeDeferredSync();
}
function resumeDeferredSync() {
  if (trainingReloads.has(trainingStorage.scope)) {
    if (syncEngineCanReplace() && !hasUnsavedTraining()) startAccountSync();
    return;
  }
  if (account.sync.status === "pending" && syncEngineCanReplace())
    scheduleSync();
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
    username: profileUsername,
    accountSection,
  });
}
function render() {
  if (view !== "progress" && solveInline) clearInlineSolve();
  if (view !== "timer") {
    timerHistoryLimit = 50;
    timerBulkEdit = null;
  }
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
  const textFocused =
    searchFocused ||
    ["solve-notes", "profile-name", "profile-bio", "profile-goal"].includes(
      active?.id,
    );
  const start = textFocused ? active.selectionStart : null;
  const end = textFocused ? active.selectionEnd : null;
  flushSync(() => {
    appModel.snapshot = {
      state: snapshotViewState({
        settings,
        accountSection,
        syncDetails,
        syncStatus: syncStatus({
          account: visibleAccount(),
          demo: preferences.testData,
          notice,
          online: navigator.onLine,
        }),
        account: { ...visibleAccount(), sync: { ...visibleAccount().sync } },
        profilePage: { ...profilePage },
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
        timerBulkEdit,
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
        practiceOptions,
        bulkEdit,
        session,
        backup,
        pendingImport,
        importPreview,
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
function nextCase(completed = 0, caseIds = session?.pool, context = session) {
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
    source: context?.source,
    section: context?.section,
    returnHome: context?.returnHome,
  };
  view = "practice";
}
function practiceAttempt(result, mode) {
  const c = byId.get(session.caseId);
  const completedAt = new Date();
  return {
    id: crypto.randomUUID(),
    caseId: c.id,
    variant: session.variant,
    method: session.method,
    result,
    mode,
    day: dayKey(completedAt),
    at: completedAt.toISOString(),
  };
}
function record(result, mode) {
  progress.attempts.push(practiceAttempt(result, mode));
  save();
}
function chooseOption(control, value) {
  if (control === "timer-bulk-cube") {
    if (
      !timerBulkEdit ||
      solveTimer.snapshot().status === "running" ||
      timerBulkEdit.confirmDelete
    )
      return;
    if (
      value !== "keep" &&
      value &&
      (!value.startsWith("cube:") ||
        !cubeCollection.cubes.some(
          (cube) => cube.id === value.slice(5) && !cube.deleted,
        ))
    )
      return;
    timerBulkEdit.cubeId = value;
  }
  if (control === "practice-source" && ["learning", "known"].includes(value))
    practiceOptions = { ...practiceOptions, source: value };
  if (control === "practice-section" && ["both", "OLL", "PLL"].includes(value))
    practiceOptions = { ...practiceOptions, section: value };
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
  resumeDeferredSync();
  (
    document.getElementById(control) ||
    (view === "progress" ? $("#dashboard-cube") : null)
  )?.focus();
  return;
}
function setTimerSelection(ids, checked) {
  if (
    !timerBulkEdit ||
    view !== "timer" ||
    solveTimer.snapshot().status === "running"
  )
    return;
  cancelTimerHold();
  const shown = new Set(
    solves.slice(-timerHistoryLimit).map((solve) => solve.id),
  );
  const selected = new Set(timerBulkEdit.selected);
  for (const id of ids) {
    if (!shown.has(id)) continue;
    if (checked) selected.add(id);
    else selected.delete(id);
  }
  timerBulkEdit.selected = [...selected];
  timerBulkEdit.confirmDelete = false;
  render();
}
function applyTimerBulkChange(type) {
  if (
    !timerBulkEdit ||
    !timerBulkEdit.selected.length ||
    solveTimer.snapshot().status === "running"
  )
    return;
  const choice = timerBulkEdit.cubeId;
  const cubeId = choice.startsWith("cube:") ? choice.slice(5) : null;
  if (
    type === "cube" &&
    (choice === "keep" ||
      (choice &&
        !cubeCollection.cubes.some(
          (cube) => cube.id === cubeId && !cube.deleted,
        )))
  )
    return;
  const next = withSolveChanges(solves, timerBulkEdit.selected, {
    type,
    cubeId: cubeId || null,
  });
  if (!saveSolves(next)) {
    timerBulkEdit.failed = true;
    render();
    return;
  }
  const count = timerBulkEdit.selected.length;
  solves = next;
  if (type === "delete" && timerBulkEdit.selected.includes(currentSolveId)) {
    currentSolveId = null;
    solveTimer.clear();
  }
  timerBulkEdit = solves.length ? emptyTimerBulkEdit() : null;
  notify(
    `${type === "delete" ? "Deleted" : "Updated"} ${count} ${count === 1 ? "solve" : "solves"}.`,
  );
  render();
  ($("#timer-select-shown") || $(".timer-history summary"))?.focus();
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
  if (action === "sync-details") {
    rememberDialogOpener(button);
    syncDetails = true;
    cancelTimerHold();
    render();
    return;
  }
  if (action === "settings-data") {
    openDataSettings(button);
    return;
  }
  if (action.startsWith("account-")) {
    void accountAction(action);
    return;
  }
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
  if (
    (action.startsWith("timer-bulk-") || action === "timer-select-mode") &&
    (view !== "timer" || solveTimer.snapshot().status === "running")
  )
    return;
  switch (action) {
    case "timer-select-mode":
      timerBulkEdit = timerBulkEdit ? null : emptyTimerBulkEdit();
      render();
      $(timerBulkEdit ? "#timer-select-shown" : "#timer-select-mode")?.focus();
      resumeDeferredSync();
      return;
    case "timer-bulk-clear":
      if (!timerBulkEdit) return;
      timerBulkEdit = emptyTimerBulkEdit();
      render();
      $("#timer-select-shown")?.focus();
      return;
    case "timer-bulk-apply":
      if (timerBulkEdit?.confirmDelete) return;
      applyTimerBulkChange("cube");
      return;
    case "timer-bulk-delete":
      if (!timerBulkEdit?.selected.length) return;
      timerBulkEdit.confirmDelete = true;
      render();
      $("#timer-bulk-delete-cancel")?.focus();
      return;
    case "timer-bulk-delete-cancel":
      if (!timerBulkEdit) return;
      timerBulkEdit.confirmDelete = false;
      render();
      $("[data-action='timer-bulk-delete']")?.focus();
      return;
    case "timer-bulk-delete-confirm":
      if (timerBulkEdit?.confirmDelete) applyTimerBulkChange("delete");
      return;
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
    case "guide-example": {
      const module = moduleById(activeModule || guideSection);
      if (
        view === "guides" && guideSection === "notation"
          ? id !== "notation"
          : !(
              moduleExampleIds(module).includes(id) ||
              (moduleBlocks(module).some((node) => node.type === "f2l-cases") &&
                f2lCases.some((example) => example.id === id))
            )
      )
        return;
      guideExample = guideExample === id ? null : id;
      break;
    }
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
      resumeDeferredSync();
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
      resumeDeferredSync();
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
      if (
        !moduleExampleIds(moduleById(activeModule || guideSection)).includes(id)
      )
        return;
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
        syncDetails = false;
        settings = true;
        cancelTimerHold();
        render();
        return;
      }
      settings = syncDetails = false;
      if (view === "timer") solveTimer.stop();
      scramblePreview = false;
      clearInlineSolve();
      solveDetailId = null;
      view = button.dataset.view;
      if (view === "account")
        accountSection = button.dataset.accountSection || "settings";
      if (view !== "home" && view !== "progress") activeModule = null;
      guideExample =
        view === "guides" && guideSection === "notation" ? "notation" : null;
      session = null;
      detail = null;
      if (profileTarget()) void loadProfilePage();
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
      if (settings) {
        settingsBackupOpener = {
          opener: dialogOpener || { action: "nav", view: "settings" },
          entry: window.history.state,
        };
        settings = false;
        // Replace the overlay URL so Back cannot reopen a second dialog.
        window.history.replaceState(
          { settingsEntry: false },
          "",
          currentRouteHash(false),
        );
      }
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
        hiddenPracticeCases(
          catalog,
          progress,
          { ...practiceOptions, method },
          createProgressIndex(progress, method),
        ).map((c) => c.id),
        { ...practiceOptions, returnHome: true },
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
      if (activeModule && !session?.returnHome)
        openCourseModule(progress.activeCourse, activeModule);
      else {
        view = "home";
        session = null;
      }
      break;
    case "rate":
      record(session.hinted ? "help" : button.dataset.result, "recognition");
      nextCase(session.completed + 1);
      break;
    case "relearn": {
      if (session?.source !== "known" || session.stage !== "answer") return;
      const next = withRelearnedCase(
        progress,
        practiceAttempt("help", "recognition"),
      );
      if (!save(next)) {
        render();
        return;
      }
      progress = next;
      nextCase(
        session.completed + 1,
        session.pool.filter((id) => id !== session.caseId),
      );
      render();
      resumeDeferredSync();
      $("#main").focus();
      window.scrollTo({ top: 0 });
      notify(
        "Needed help recorded. Case added to your learning set and removed from known review.",
      );
      return;
    }
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
      downloadBackup(
        trainingBackup(progress, solves, cubeCollection),
        `last-layer-${preferences.testData ? "test-data-" : ""}${dayKey()}.json`,
      );
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
      if (view === "account") {
        view = "progress";
        activeModule = null;
      }
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
      resumeDeferredSync();
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
        assertTrainingUnchanged();
        restoreBackup(
          trainingStorage.target,
          trainingBackup(next.progress, next.solves, cubeCollection),
        );
      } catch {
        dashboard.deleteMessage =
          "This day could not be deleted. Your previous data is preserved. Free browser storage and try again.";
        break;
      }
      rememberTrainingBytes();
      clearTrainingFailures();
      scheduleSync();
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
    case "merge-import":
    case "confirm-import":
      if (pendingImport) {
        let candidate;
        try {
          if (
            action === "merge-import" &&
            (progressStorageUnreadable ||
              solveStorageUnreadable ||
              cubeStorageUnreadable ||
              hasUnsavedTraining())
          )
            throw Error(
              "Restore access to current training data before merging.",
            );
          candidate =
            action === "merge-import"
              ? mergeBackup(
                  trainingBackup(progress, solves, cubeCollection),
                  pendingImport,
                  catalog,
                ).backup
              : pendingImport;
          assertTrainingUnchanged();
          restoreBackup(trainingStorage.target, candidate);
          rememberTrainingBytes();
        } catch (error) {
          importMessage =
            error.message +
            " " +
            "Backup could not be saved. Your previous data is preserved. Free browser storage and try again.";
          break;
        }
        if (candidate.solves) clearTrainingFailures();
        else failedTrainingSaves.delete(failedSaveKey(STORAGE_KEY));
        scheduleSync();
        progress = candidate.progress;
        progressStorageUnreadable = false;
        if (candidate.solves) {
          solves = candidate.solves;
          cubeCollection = candidate.cubeCollection;
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
        settingsBackupOpener = null;
        focusId = null;
        activeModule = null;
        session = null;
        view = "home";
      }
      break;
  }
  render();
  resumeDeferredSync();
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
  if (
    preferences.testData &&
    [
      "account-form",
      "username-form",
      "profile-edit-form",
      "account-delete-form",
    ].includes(event.target.id)
  ) {
    event.preventDefault();
    handleDemoForm(event.target);
    return;
  }
  if (event.target.id === "profile-edit-form") {
    event.preventDefault();
    void saveAccountProfile(event.target);
    return;
  }
  if (event.target.id === "account-delete-form") {
    event.preventDefault();
    void deleteAccount(event.target);
    return;
  }
  if (event.target.id === "username-form") {
    event.preventDefault();
    void claimUsername(event.target);
    return;
  }
  if (event.target.id === "profile-lookup-form") {
    event.preventDefault();
    try {
      const name = username(event.target.elements.namedItem("username").value);
      if (view === "profile" && name === profileUsername)
        void loadProfilePage();
      else location.hash = `#/u/${name}`;
    } catch (error) {
      profilePage.message = error.message;
      render();
    }
    return;
  }
  if (event.target.id === "account-form") {
    event.preventDefault();
    void signInAccount(event.target);
    return;
  }
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
  resumeDeferredSync();
});
document.addEventListener("input", (e) => {
  if (e.target.closest?.("#profile-edit-form")) {
    setProfileField(e.target.name, e.target.value);
    return;
  }
  if (e.target.id === "account-delete-confirmation") {
    visibleAccount().deleteConfirmation = e.target.value;
    return;
  }
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
      account.busy ||
      demoAccount.busy ||
      solveTimer.snapshot().status === "running"
    )
      return;
    trainingSnapshots.set(trainingStorage.scope, {
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
    stopAccountSync();
    profileGeneration++;
    profilePageGeneration++;
    account.profileLoading = false;
    profilePage = { status: "idle", profile: null, message: "" };
    if (value) void supabaseClient?.auth.stopAutoRefresh();
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
    } = trainingSnapshots.get(trainingStorage.scope) || loadTraining());
    preferences.testData = value;
    startAccountSync();
    timerHistoryLimit = 50;
    timerBulkEdit = null;
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
    resumeDeferredSync();
    if (profileTarget()) void loadProfilePage();
    if (!value) void initializeAccount();
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
  if (e.target.id === "demo-account-state" && preferences.testData) {
    demo.reset(e.target.value);
    refreshDemoAccount();
    if (profileTarget()) void loadProfilePage();
    render();
    return;
  }
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
    importPreview = null;
    importMessage = "";
    render();
    try {
      if (file.size > 100_000_000)
        throw Error("Choose a backup file smaller than 100 MB.");
      const contents = await file.text();
      if (!backup || generation !== importGeneration) return;
      const prepared = await prepareBackupImport(JSON.parse(contents), catalog);
      if (!backup || generation !== importGeneration) return;
      pendingImport = prepared;
      try {
        if (
          progressStorageUnreadable ||
          solveStorageUnreadable ||
          cubeStorageUnreadable ||
          hasUnsavedTraining()
        )
          throw Error(
            "Restore access to current training data before merging.",
          );
        importPreview = mergeBackup(
          trainingBackup(progress, solves, cubeCollection),
          pendingImport,
          catalog,
        ).summary;
      } catch (error) {
        importPreview = { error: error.message };
      }
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
      profileUsername = route.username || "";
      section = route.section || section;
      method = route.method || method;
      guideSection = route.guideSection || guideSection;
      guideExample =
        view === "guides" && guideSection === "notation" ? "notation" : null;
    }
    if (view === "pll-quiz") startPllQuiz();
  }
  accountSection = route.accountSection || "settings";
  syncDetails = false;
  settings = route.settings;
  settingsBackupOpener = null;
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
  if (profileTarget() && !samePage) void loadProfilePage();
}
window.addEventListener("hashchange", () => {
  const wasSettings = settings;
  restoreRoute();
  render();
  resumeDeferredSync();
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
  resumeDeferredSync();
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
  resumeDeferredSync();
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
  resumeDeferredSync();
});
function abandonTimerHold() {
  if (timerHold.snapshot() === "idle") return;
  cancelTimerHold();
  render();
  resumeDeferredSync();
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
  if (command === "data") {
    openDataSettings();
    return;
  }
  if (command === "sync") {
    rememberDialogOpener($("[data-action=commands]"));
    syncDetails = true;
    render();
    return;
  }
  if (command === "settings" || command === "backup") {
    $(
      command === "settings" ? ".header-settings" : "[data-action='backup']",
    ).click();
  } else {
    window.history.pushState(null, "", `#/${command}`);
    restoreRoute();
    render();
    resumeDeferredSync();
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

function downloadBackup(data, filename) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function handleDemoForm(form) {
  try {
    const value = (name) => form.elements.namedItem(name)?.value.trim() || "";
    if (form.id === "account-form") {
      if (demoAccount.codeSent) {
        demo.verifyCode(value("code"));
        refreshDemoAccount();
        offerGuestImport();
      } else {
        demo.sendEmail(value("email"));
        demoAccount.signInEmail = value("email");
        demoAccount.codeSent = true;
        demoAccount.message = `Use demo code ${DEMO_CODE}. No email is sent.`;
      }
    } else if (form.id === "username-form") {
      demoAccount.usernameDraft = value("username");
      demo.claim(value("username"));
      refreshDemoAccount();
      demoAccount.message = "Demo page created.";
      offerGuestImport();
    } else if (form.id === "profile-edit-form") {
      const details = { ...demoAccount.profileDraft };
      for (const key of ["display_name", "bio", "learning_goal"])
        details[key] = value(key);
      demoAccount.profile = demo.save(details);
      demoAccount.profileDraft = profileDetails(demoAccount.profile);
      demoAccount.message = "Profile saved in demo.";
    } else if (form.id === "account-delete-form") {
      demo.deleteAccount(value("confirmation"));
      refreshDemoAccount();
      view = "account";
      accountSection = "settings";
      demoAccount.message =
        "Demo account deleted. Sample training and your real data are kept.";
    }
    if (profileTarget()) void loadProfilePage();
  } catch (error) {
    demoAccount.message = error.message;
  }
  render();
  if (demoAccount.codeSent) $("#account-code")?.focus();
  else if (demo.session && !demo.profile) $("#account-username")?.focus();
  else if (!demo.session) $("#account-email")?.focus();
}
function handleDemoAction(action) {
  if (solveTimer.snapshot().status === "running") return;
  try {
    demoAccount.message = "";
    if (["account-demo-reset", "account-setup-retry"].includes(action)) {
      demo.reset();
      refreshDemoAccount();
    } else if (action === "account-signout") {
      demo.signOut();
      refreshDemoAccount();
      view = "account";
      accountSection = "settings";
    } else if (action === "account-reset") {
      demoAccount.codeSent = false;
      demoAccount.signInEmail = "";
    } else if (action === "account-visibility")
      demoAccount.profile = demo.visibility(!demo.profile.is_public);
    else if (action === "account-profile-retry") {
      void loadProfilePage();
      return;
    } else if (action === "account-delete-preview")
      demoAccount.deletePending = true;
    else if (action === "account-delete-cancel") {
      demoAccount.deletePending = false;
      demoAccount.deleteConfirmation = "";
    } else if (action === "account-import-preview") {
      offerGuestImport(true);
      if (!settings) view = "account";
    } else if (action === "account-import-cancel")
      demoAccount.guestImportPending = false;
    else if (action === "account-import-guest") {
      const combined = mergeBackup(
        trainingBackup(progress, solves, cubeCollection),
        demo.guestBackup(),
        catalog,
      ).backup;
      restoreBackup(
        trainingStorage.target,
        trainingBackup(
          combined.progress,
          combined.solves,
          combined.cubeCollection,
        ),
      );
      publishTraining(loadTraining());
      demoAccount.guestImportPending = false;
      demoAccount.message =
        "Demo guest progress added. Your real guest data is unchanged.";
    } else if (action === "account-export") {
      downloadBackup(
        {
          ...trainingBackup(progress, solves, cubeCollection),
          account: { ...demo.profile, email: demo.session?.user.email },
        },
        `last-layer-demo-${dayKey()}.json`,
      );
      demoAccount.message = "Demo backup exported.";
    } else {
      demoAccount.sync = demo.sync(
        { "account-device": "device", "account-cloud": "cloud" }[action],
      );
      demoAccount.scenario = demo.scenario;
    }
    if (profileTarget()) void loadProfilePage();
  } catch (error) {
    demoAccount.message = error.message;
  }
  render();
  const focusAction = {
    "account-delete-preview": "#account-delete-confirmation",
    "account-delete-cancel": "[data-action=account-delete-preview]",
  }[action];
  if (focusAction) $(focusAction)?.focus();
  if (
    ["account-import-guest", "account-import-cancel"].includes(action) &&
    !demoAccount.guestImportPending
  )
    focusAfterGuestTransfer();
}

function setProfileField(key, value) {
  const account = visibleAccount();
  if (!account.profile || account.busy) return;
  if (!["display_name", "bio", "learning_goal"].includes(key)) return;
  account.profileDraft = {
    ...(account.profileDraft || profileDetails(account.profile)),
    [key]: value,
  };
  render();
}
async function saveAccountProfile(form) {
  if (!account.profile || account.busy || preferences.testData) return;
  const id = accountId,
    generation = profileGeneration;
  const draft = { ...account.profileDraft };
  for (const field of ["display_name", "bio", "learning_goal"])
    draft[field] = form.elements.namedItem(field).value;
  account.profileDraft = draft;
  account.busy = true;
  account.message = "";
  render();
  try {
    const profile = await profileRemote(supabaseClient, id, cloudConfig).save(
      draft,
    );
    if (id !== accountId || generation !== profileGeneration) return;
    account.profile = profile;
    account.profileDraft = profileDetails(profile);
    account.message = "Profile saved.";
    if (profileTarget()) void loadProfilePage();
  } catch (error) {
    if (id === accountId && generation === profileGeneration)
      account.message =
        error.message || "Profile could not be saved. Try again.";
  } finally {
    if (id === accountId && generation === profileGeneration) {
      account.busy = false;
      render();
      resumeDeferredSync();
    }
  }
}
async function deleteAccount(form) {
  if (
    !accountId ||
    !account.deletePending ||
    account.busy ||
    preferences.testData ||
    solveTimer.snapshot().status === "running"
  )
    return;
  const confirmation = form.elements.namedItem("confirmation").value.trim();
  if (confirmation !== (account.profile?.username || "DELETE")) {
    account.message = "Type the confirmation exactly to delete your account.";
    render();
    $("#account-delete-confirmation")?.focus();
    return;
  }
  const id = accountId,
    generation = profileGeneration;
  account.busy = account.deleting = true;
  account.message = "";
  stopAccountSync();
  render();
  try {
    await profileRemote(supabaseClient, id, cloudConfig).deleteAccount(
      confirmation,
    );
    let cleaned = true;
    if (id === accountId && generation === profileGeneration) {
      try {
        const result = await supabaseClient.auth.signOut({ scope: "local" });
        if (result.error) cleaned = false;
      } catch {
        cleaned = false;
      }
      if (id === accountId) changeAccount(null);
    }
    try {
      removeAccountCache(localStorage, id);
    } catch {
      cleaned = false;
    }
    for (const scope of [`${id}:false`, `${id}:true`]) {
      trainingSnapshots.delete(scope);
      trainingBytes.delete(scope);
      trainingReloads.delete(scope);
    }
    for (const key of failedTrainingSaves)
      if (key.startsWith(`${id}:`)) failedTrainingSaves.delete(key);
    if (!accountId) {
      view = "account";
      accountSection = "settings";
      settings = false;
      account.message = cleaned
        ? "Account deleted. Guest data is kept."
        : "Account deleted. Clear site data on this device to remove any remaining cached account data.";
    }
  } catch {
    if (id === accountId && generation === profileGeneration) {
      account.message =
        "Deletion could not be confirmed. Your local data is kept. Try again.";
      account.deleting = false;
      startAccountSync();
    }
  } finally {
    if (!accountId || (id === accountId && generation === profileGeneration)) {
      account.busy = account.deleting = false;
      render();
      if (!accountId) $("#account-email")?.focus();
    }
  }
}
function readGuestTraining() {
  recoverRestore(localStorage);
  return validateBackup(
    trainingBackup(
      JSON.parse(
        localStorage.getItem(STORAGE_KEY) || JSON.stringify(emptyProgress()),
      ),
      JSON.parse(localStorage.getItem(SOLVES_KEY) || "[]"),
      JSON.parse(
        localStorage.getItem(CUBES_KEY) || '{"cubes":[],"defaultId":null}',
      ),
    ),
    catalog,
  );
}
function offerGuestImport(explicit = false) {
  const target = visibleAccount();
  try {
    const guest = preferences.testData
      ? demo.guestBackup()
      : readGuestTraining();
    const counts = trainingCounts(guest);
    target.guestImportError = "";
    target.guestImportPreview = counts;
    target.guestImportPending =
      explicit || Object.values(counts).some((count) => count > 0);
  } catch (error) {
    target.guestImportError =
      "Guest data could not be read. Your guest copy is kept. Sign out to recover it before transferring.";
    target.guestImportPending = explicit;
  }
}
function focusAfterGuestTransfer() {
  const opener = settings
    ? $("[data-action=account-import-preview]")
    : $("#main");
  opener?.focus();
  if (settings) opener?.scrollIntoView({ block: "center" });
}
function readCloudTraining() {
  if (
    preferences.testData ||
    hasUnsavedTraining() ||
    progressStorageUnreadable ||
    solveStorageUnreadable ||
    cubeStorageUnreadable ||
    solveSaveFailed
  )
    throw Error("Training storage is unavailable.");
  // Read committed bytes, not unsaved UI drafts. Cross-tab changes are visible.
  assertTrainingUnchanged();
  const source = trainingStorage.target;
  return trainingBackup(
    JSON.parse(source.getItem(STORAGE_KEY) || JSON.stringify(emptyProgress())),
    JSON.parse(source.getItem(SOLVES_KEY) || "[]"),
    JSON.parse(source.getItem(CUBES_KEY) || '{"cubes":[],"defaultId":null}'),
  );
}
function resetTrainingView() {
  cancelTimerHold();
  solveTimer.stop();
  newTimerScramble();
  timerHistoryLimit = 50;
  timerBulkEdit = null;
  solveDetailId = detail = practicePicker = bulkEdit = session = pllQuiz = null;
  solveInline = false;
  solvePreviewVisible = solveDeleteConfirm = scramblePreview = false;
  editingCubeId = deletingCubeId = null;
  cubeFormRevision++;
  backup = false;
  settingsBackupOpener = null;
  pendingImport = null;
  importMessage = "";
  importGeneration++;
  activeModule = null;
  focusId = null;
  Object.assign(dashboard, {
    day: null,
    cube: "all",
    dailyCube: "all",
    solveId: null,
    deleteDay: null,
    deleteMessage: "",
  });
  resetLibraryFilters();
  if (["practice", "pll-quiz", "lesson"].includes(view)) view = "home";
}
function publishTraining(next) {
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
  } = next);
}
function syncEngineCanReplace() {
  return (
    solveTimer.snapshot().status !== "running" &&
    !(view === "timer" && solveTimer.snapshot().status === "stopped") &&
    timerHold.snapshot() === "idle" &&
    !session &&
    !(view === "pll-quiz" && pllQuiz) &&
    !detail &&
    !practicePicker &&
    !scramblePreview &&
    !solveDetailId &&
    !backup &&
    !pendingImport &&
    !profileHasDraft(account) &&
    !bulkEdit &&
    !timerBulkEdit &&
    !dashboard.deleteDay &&
    !editingCubeId &&
    !deletingCubeId &&
    !$("#cube-name")?.value.trim() &&
    !$("#cube-description")?.value.trim()
  );
}
function startAccountSync() {
  if (!accountId || !account.profile || preferences.testData || !supabaseClient)
    return;
  stopAccountSync();
  if (trainingReloads.has(trainingStorage.scope)) {
    if (!syncEngineCanReplace() || hasUnsavedTraining()) return;
    publishTraining(loadTraining());
    trainingReloads.delete(trainingStorage.scope);
    render();
  }
  const source = trainingStorage.target;
  syncEngine = createCloudSync({
    remote: trainingRemote(supabaseClient, accountId, cloudConfig),
    storage: source,
    catalog,
    read: readCloudTraining,
    isPristine: () => trainingKeys.every((key) => source.getItem(key) === null),
    canReplace: syncEngineCanReplace,
    replace: (data) => {
      restoreBackup(source, data);
      publishTraining(loadTraining());
      resetTrainingView();
      render();
    },
    changed: () => {
      account.sync = syncEngine?.snapshot || account.sync;
      render();
    },
  });
  syncQueue = createSyncQueue(syncEngine);
  scheduleSync();
}
function changeAccount(nextSession) {
  if (preferences.testData) return;
  const id = nextSession?.user?.id || null;
  if (id === accountId) return;
  stopAccountSync();
  trainingSnapshots.set(trainingStorage.scope, {
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
  accountId = id;
  account.busy = false;
  profileGeneration++;
  account.reauth = false;
  syncDetails = false;
  account.profile = null;
  account.profileLoading = Boolean(id);
  account.profileError = false;
  account.usernameDraft = "";
  account.guestImportPending = false;
  account.guestImportPreview = null;
  account.guestImportError = "";
  account.profileDraft = null;
  account.deletePending = account.deleting = false;
  account.deleteConfirmation = "";
  account.email = nextSession?.user?.email || "";
  account.codeSent = false;
  pendingEmail = "";
  account.message = "";
  account.sync = {
    status: "idle",
    message: "Saved on this device.",
    conflict: false,
  };
  trainingStorage.setAccount(id);
  publishTraining(
    trainingSnapshots.get(trainingStorage.scope) || loadTraining(),
  );
  resetTrainingView();
  if (id) {
    offerGuestImport();
    void loadAccountProfile();
  }
  if (profileTarget()) void loadProfilePage();
  render();
}
async function loadAccountProfile() {
  if (preferences.testData || !accountId || !supabaseClient) return;
  const id = accountId;
  const generation = ++profileGeneration;
  account.profileLoading = true;
  account.profileError = false;
  render();
  try {
    const profile = await profileRemote(supabaseClient, id, cloudConfig).own();
    if (generation !== profileGeneration || id !== accountId) return;
    account.profile = profile;
    account.profileDraft = profile ? profileDetails(profile) : null;
    if (profile) startAccountSync();
    if (profileTarget()) void loadProfilePage();
  } catch {
    if (generation !== profileGeneration || id !== accountId) return;
    account.profileError = true;
  } finally {
    if (generation === profileGeneration && id === accountId) {
      account.profileLoading = false;
      render();
      if (!account.profile && !account.profileError)
        $("#account-username")?.focus();
    }
  }
}
async function claimUsername(form) {
  if (
    !accountId ||
    account.busy ||
    preferences.testData ||
    account.profileLoading ||
    account.profileError
  )
    return;
  const id = accountId;
  const generation = profileGeneration;
  account.usernameDraft = form.elements.namedItem("username").value;
  account.busy = true;
  account.message = "";
  render();
  try {
    const profile = await profileRemote(supabaseClient, id, cloudConfig).claim(
      account.usernameDraft,
    );
    if (id !== accountId || generation !== profileGeneration) return;
    account.profile = profile;
    account.profileDraft = profileDetails(profile);
    account.message =
      "Your page is ready. It is private until you make it public.";
    startAccountSync();
    if (profileTarget()) void loadProfilePage();
  } catch (error) {
    if (id === accountId && generation === profileGeneration)
      account.message = error.message;
  } finally {
    if (id === accountId && generation === profileGeneration) {
      account.busy = false;
      render();
      (account.profile ? $("#main") : $("#account-username"))?.focus();
    }
  }
}
function profileTarget() {
  return view === "profile"
    ? profileUsername
    : view === "account" && ["profile", "edit"].includes(accountSection)
      ? visibleAccount().profile?.username || ""
      : "";
}
async function loadProfilePage() {
  const name = profileTarget();
  if (!name) return;
  if (preferences.testData) {
    profilePageGeneration++;
    profilePage = { status: "ready", profile: demo.find(name), message: "" };
    render();
    return;
  }
  const id = accountId;
  const generation = ++profilePageGeneration;
  profilePage = { status: "loading", profile: null, message: "" };
  // Route restoration also runs before the initial render/client initialization.
  if (!cloudConfig || !supabaseClient) {
    profilePage.status = "error";
    return;
  }
  render();
  try {
    const profile = await profileRemote(supabaseClient, id, cloudConfig).find(
      name,
    );
    if (
      generation !== profilePageGeneration ||
      name !== profileTarget() ||
      id !== accountId
    )
      return;
    profilePage = { status: "ready", profile, message: "" };
  } catch {
    if (
      generation !== profilePageGeneration ||
      name !== profileTarget() ||
      id !== accountId
    )
      return;
    profilePage = { status: "error", profile: null, message: "" };
  }
  render();
}
async function initializeAccount() {
  if (!cloudConfig || preferences.testData) return;
  try {
    if (!supabaseClient) {
      loadingSupabase ||= loadSupabase(cloudConfig).catch((error) => {
        loadingSupabase = null;
        throw error;
      });
      supabaseClient = await loadingSupabase;
    }
    if (!authSubscribed) {
      authSubscribed = true;
      // Supabase callbacks must finish before making further auth/database calls.
      supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
        const generation = ++authGeneration;
        setTimeout(() => {
          if (generation === authGeneration) changeAccount(nextSession);
        }, 0);
      });
    }
    if (preferences.testData) {
      await supabaseClient.auth.stopAutoRefresh();
      return;
    }
    await supabaseClient.auth.startAutoRefresh();
    if (authRedirect && !handledAuthRedirect) {
      handledAuthRedirect = true;
      if (authRedirect.error) throw Error("Expired sign-in link");
      const { data, error } =
        await supabaseClient.auth.setSession(authRedirect);
      if (error) throw error;
      changeAccount(data.session);
    } else {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      changeAccount(data.session);
    }
    if (accountId && !account.profile && !account.profileLoading)
      void loadAccountProfile();
    if (profileTarget()) void loadProfilePage();
  } catch {
    account.message =
      "Account could not be loaded. Open Account and request a new sign-in email. Guest data is kept.";
    render();
  }
}
async function signInAccount(form) {
  if (
    account.busy ||
    preferences.testData ||
    solveTimer.snapshot().status === "running"
  )
    return;
  const email = form.elements.namedItem("email").value.trim();
  const code = form.elements.namedItem("code")?.value.trim();
  account.busy = true;
  account.message = "";
  render();
  try {
    if (!supabaseClient) throw Error();
    const result = code
      ? await supabaseClient.auth.verifyOtp({
          email: pendingEmail,
          token: code,
          type: "email",
        })
      : await supabaseClient.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${location.origin}${location.pathname}`,
          },
        });
    if (result.error) throw result.error;
    if (code) {
      if (account.reauth && result.data.session?.user.id === accountId) {
        account.reauth = account.codeSent = false;
        pendingEmail = "";
        startAccountSync();
      } else changeAccount(result.data.session);
    } else {
      pendingEmail = email;
      account.signInEmail = email;
      account.codeSent = true;
      account.message =
        "Open the sign-in link in your email, or enter its code below.";
    }
  } catch {
    account.message =
      "Sign-in failed. Check your email/code or try again shortly.";
  } finally {
    account.busy = false;
    render();
    if (account.codeSent) $("#account-code")?.focus();
    else if (accountId) ($("#account-username") || $("#main"))?.focus();
  }
}
function openDataSettings(button) {
  if (!syncDetails && button) rememberDialogOpener(button);
  syncDetails = false;
  settings = true;
  render();
  $("#settings-data-title")?.focus();
  $("#settings-data-title")?.scrollIntoView({ block: "start" });
}
async function checkSync() {
  const current = visibleAccount(),
    generation = profileGeneration,
    engine = syncEngine;
  const presentation = () =>
    syncStatus({
      account: current,
      demo: preferences.testData,
      notice,
      online: navigator.onLine,
    });
  if (!presentation().canCheck) return;
  if (preferences.testData) {
    current.sync = demo.sync();
    render();
  } else await syncQueue?.request();
  if (
    current !== visibleAccount() ||
    generation !== profileGeneration ||
    (!preferences.testData && engine !== syncEngine)
  )
    return;
  notify(syncFeedback(presentation(), current.sync));
}
async function accountAction(action) {
  if (action === "account-sync") {
    await checkSync();
    return;
  }
  if (action === "account-reauth") {
    const current = visibleAccount();
    current.reauth = true;
    current.signInEmail = current.email;
    syncDetails = settings = false;
    view = "account";
    accountSection = "settings";
    render();
    $("#account-email")?.focus();
    return;
  }
  if (action === "account-profile-discard") {
    const current = visibleAccount();
    if (!current.profile || current.busy) return;
    current.profileDraft = profileDetails(current.profile);
    current.message = "";
    render();
    resumeDeferredSync();
    $("#profile-name")?.focus();
    return;
  }
  if (preferences.testData && action !== "account-copy-profile") {
    handleDemoAction(action);
    return;
  }
  if (account.busy || solveTimer.snapshot().status === "running") return;
  if (action === "account-copy-profile" && profileTarget()) {
    const demoQuery =
      preferences.testData && import.meta.env.DEV ? "?demo=1" : "";
    const link = `${location.origin}${location.pathname}${demoQuery}#/u/${profileTarget()}`;
    try {
      await navigator.clipboard.writeText(link);
      profilePage.message = "Profile link copied.";
    } catch {
      profilePage.message = `Copy this profile link: ${link}`;
    }
    render();
    return;
  }
  if (action === "account-export" && accountId && !preferences.testData) {
    downloadBackup(
      {
        ...trainingBackup(progress, solves, cubeCollection),
        account: { ...account.profile, email: account.email },
      },
      `last-layer-account-${account.profile?.username || "backup"}-${dayKey()}.json`,
    );
    account.message =
      "Account backup exported. It includes profile settings; importing it restores training data.";
    render();
    return;
  }
  if (
    action === "account-delete-preview" &&
    accountId &&
    !preferences.testData
  ) {
    account.deletePending = true;
    account.message = "";
    render();
    $("#account-delete-confirmation")?.focus();
    return;
  }
  if (action === "account-delete-cancel") {
    account.deletePending = false;
    account.deleteConfirmation = "";
    render();
    $("[data-action=account-delete-preview]")?.focus();
    return;
  }
  if (
    action === "account-import-preview" &&
    account.profile &&
    !preferences.testData
  ) {
    offerGuestImport(true);
    if (!settings) view = "account";
    account.message = "";
    render();
    return;
  }
  if (action === "account-import-cancel") {
    account.guestImportPending = false;
    render();
    focusAfterGuestTransfer();
    return;
  }
  if (
    action === "account-import-guest" &&
    account.guestImportPending &&
    account.profile &&
    !preferences.testData
  ) {
    const id = accountId;
    const generation = profileGeneration;
    account.busy = true;
    account.message = "";
    render();
    try {
      await syncQueue?.request();
      if (id !== accountId || generation !== profileGeneration) return;
      if (account.sync.status !== "synced")
        throw Error(
          "Finish syncing your account before bringing in guest progress.",
        );
      const guest = readGuestTraining();
      const guestCopy = trainingBackup(
        guest.progress,
        guest.solves,
        guest.cubeCollection,
      );
      const combined = mergeBackup(
        readCloudTraining(),
        guestCopy,
        catalog,
      ).backup;
      if (!syncEngine || !syncEngineCanReplace())
        throw Error(
          "Finish the current activity before bringing in guest progress.",
        );
      restoreBackup(
        trainingStorage.target,
        trainingBackup(
          combined.progress,
          combined.solves,
          combined.cubeCollection,
        ),
      );
      publishTraining(loadTraining());
      resetTrainingView();
      account.guestImportPending = false;
      account.message =
        "Guest progress added. The guest copy is kept on this device.";
      scheduleSync();
    } catch (error) {
      if (id === accountId && generation === profileGeneration)
        account.message =
          error.message ||
          "Guest progress could not be added. Existing data is kept.";
    } finally {
      if (id === accountId && generation === profileGeneration) {
        account.busy = false;
        render();
        if (!account.guestImportPending) focusAfterGuestTransfer();
      }
    }
    return;
  }
  if (action === "account-profile-retry") {
    await loadProfilePage();
    return;
  }
  if (action === "account-setup-retry") {
    await loadAccountProfile();
    return;
  }
  if (
    action === "account-visibility" &&
    account.profile &&
    !preferences.testData
  ) {
    const id = accountId;
    const generation = profileGeneration;
    account.busy = true;
    account.message = "";
    render();
    try {
      const profile = await profileRemote(
        supabaseClient,
        id,
        cloudConfig,
      ).visibility(!account.profile.is_public);
      if (id === accountId && generation === profileGeneration) {
        account.profile = profile;
        account.message = profile.is_public
          ? "Your profile is public."
          : "Your profile is private.";
        if (profileTarget()) void loadProfilePage();
      }
    } catch {
      if (id === accountId && generation === profileGeneration)
        account.message = "Visibility could not be saved. Try again.";
    } finally {
      if (id === accountId && generation === profileGeneration) {
        account.busy = false;
        render();
      }
    }
    return;
  }
  if (action === "account-reset") {
    account.codeSent = false;
    pendingEmail = account.signInEmail = account.message = "";
    render();
    $("#account-email")?.focus();
    return;
  }
  if (action === "account-signout") {
    account.busy = true;
    stopAccountSync();
    render();
    try {
      const { error } = await supabaseClient.auth.signOut({ scope: "local" });
      if (error) throw error;
      changeAccount(null);
      view = "account";
      accountSection = "settings";
      settings = false;
    } catch {
      account.message = "Sign-out could not finish. Try again.";
      syncEngine = null;
      startAccountSync();
    } finally {
      account.busy = false;
      render();
      if (!accountId) $("#account-email")?.focus();
    }
    return;
  }
  if (preferences.testData) return;
  const choice = { "account-device": "device", "account-cloud": "cloud" }[
    action
  ];
  await syncQueue?.request(choice);
  if (choice && !account.sync.conflict)
    (
      $("#sync-dialog [data-action=account-sync]") || $(".header-sync")
    )?.focus();
}
function resumeAccount() {
  if (preferences.testData) return;
  if (account.busy || account.deleting) return;
  if (accountId && !account.profile && !account.profileLoading)
    void loadAccountProfile();
  else scheduleSync();
  if (profileTarget() && profilePage.status === "error") void loadProfilePage();
}
window.addEventListener("online", resumeAccount);
window.addEventListener("focus", resumeAccount);
window.addEventListener("storage", (event) => {
  if (
    !accountId ||
    (event.key !== null &&
      !trainingKeys.some(
        (key) => event.key === `last-layer.account.${accountId}.${key}`,
      ))
  )
    return;
  // Metadata notifications must not replace drafts. Training changes wait until
  // the same activity guard used for cloud downloads permits a local reload.
  trainingReloads.add(`${accountId}:false`);
  account.sync = {
    status: "pending",
    pendingReason: "incoming",
    message:
      "Another tab updated training. Updates will apply after the current activity.",
  };
  if (preferences.testData) return;
  stopAccountSync();
  render();
  resumeDeferredSync();
});
void initializeAccount();
