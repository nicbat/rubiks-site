import { createProgressIndex } from "./progress-index.js";
import { libraryGroups, learnedStatus } from "./library.js";
import { methodGroups, recommendedVariant } from "./learning-methods.js";
import {
  createSolveTimer,
  formatElapsed,
  shouldHandleTimerKey,
} from "./solve-timer.js";
import "./timer.css";
import catalog from "../data/algorithms.json";
import triggers from "../data/triggers.json";
import { createAlgorithmRenderer } from "./algorithm.js";
import { generateSetup, randomIndex } from "./practice.js";
import { loadPreferences, savePreferences } from "./preferences.js";
import { initTheme } from "./theme.js";
import { renderApp } from "./views.js";
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

const $ = (s) => document.querySelector(s);
let notice = "";
let progress;
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  progress = raw ? validateProgress(JSON.parse(raw), catalog) : emptyProgress();
} catch {
  progress = emptyProgress();
  notice =
    "Saved progress could not be loaded. Import a backup if you have one. New changes will replace the unreadable data.";
}
let view = "home",
  section = "PLL",
  method = preferences.method,
  learned = "all",
  query = "",
  group = "all",
  detail = null,
  session = null,
  backup = false,
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
  if (clock) clock.textContent = formatElapsed(snapshot.elapsed);
  if (snapshot.status === "running")
    timerFrame = requestAnimationFrame(updateTimer);
}
function render() {
  cancelAnimationFrame(timerFrame);
  const active = document.activeElement;
  const activeId = active?.id;
  const activeAction = active?.dataset?.action;
  const activeCase = active?.dataset?.id;
  const activeSection = active?.dataset?.section;
  const activeGroup = active?.dataset?.group;
  const activeView = active?.dataset?.view;
  const activeInDialog = !!active?.closest?.("dialog");
  const searchFocused = active?.id === "search",
    start = active?.selectionStart;
  $("#app").innerHTML = renderApp({
    state: {
      timer: solveTimer.snapshot(),
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
          el.dataset.view === activeView,
      );
      match?.focus({ preventScroll: true });
    }
  }
  if (searchFocused) {
    $("#search")?.focus();
    if (start !== null) $("#search")?.setSelectionRange(start, start);
  }
  updateTimer();
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
    setup: generateSetup(c, { randomSide: preferences.randomSide }),
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
  switch (action) {
    case "known": {
      const c = byId.get(id);
      setKnown(progress, id, variant(c), !isKnown(progress, id, variant(c)));
      save();
      break;
    }
    case "choose-option":
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
    case "timer-toggle":
      solveTimer.advance();
      break;
    case "timer-new":
      solveTimer.newScramble();
      break;
    case "nav":
      if (view === "timer") solveTimer.stop();
      view = button.dataset.view;
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
      nextCase(
        0,
        libraryGroups(
          catalog,
          { section, method, group, query, learned },
          (c) => learnedStatus(index.statusFor(c.id, variant(c))),
        ).flatMap((g) => g.cases.map((c) => c.id)),
      );
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
    ["nav", "start", "practice-filtered", "exit", "rehearse"].includes(action)
  ) {
    $("#main").focus();
    window.scrollTo({ top: 0 });
  }
  if (action === "rehearsal-done") notify("Repetition recorded.");
  if (action === "rate")
    notify("Practice recorded. Start solved for the next case.");
});
document.addEventListener("input", (e) => {
  if (e.target.id === "search") {
    query = e.target.value;
    render();
  }
});
document.addEventListener("change", async (e) => {
  if (e.target.id === "pll-arrows") {
    preferences.pllArrows = e.target.checked;
    const saved = savePreferences(preferences);
    render();
    if (!saved) notify("This setting could not be saved.");
  }
  if (e.target.id === "random-side") {
    preferences.randomSide = e.target.checked;
    const saved = savePreferences(preferences);
    if (session?.stage === "setup")
      session.setup = generateSetup(byId.get(session.caseId), {
        randomSide: preferences.randomSide,
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

document.addEventListener("keydown", (event) => {
  if (view !== "timer" || document.querySelector("dialog[open]")) return;
  if (
    !shouldHandleTimerKey({
      code: event.code,
      repeat: event.repeat,
      isComposing: event.isComposing,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      interactive: Boolean(
        event.target.closest?.(
          'input,select,textarea,button,a,summary,[contenteditable],[role="combobox"],[role="option"]',
        ),
      ),
    })
  )
    return;
  event.preventDefault();
  solveTimer.advance();
  render();
});
