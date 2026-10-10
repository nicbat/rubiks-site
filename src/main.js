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
} from "./progress.js";
import "./style.css";
import "./theme.css";
initTheme();
const preferences = loadPreferences();

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
  query = "",
  group = "all",
  detail = null,
  session = null,
  backup = false,
  pendingImport = null,
  toast = "",
  focusId = null;
const byId = new Map(catalog.map((c) => [c.id, c]));
const variant = (c) => progress.variants[c.id] ?? c.preferredVariant;
const selected = () =>
  progress.selected.map((id) => byId.get(id)).filter(Boolean);
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

function render() {
  const active = document.activeElement;
  const activeId = active?.id;
  const activeAction = active?.dataset?.action;
  const activeCase = active?.dataset?.id;
  const activeSection = active?.dataset?.section;
  const activeInDialog = !!active?.closest?.("dialog");
  const searchFocused = active?.id === "search",
    start = active?.selectionStart;
  $("#app").innerHTML = renderApp({
    state: {
      notice,
      progress,
      preferences,
      view,
      section,
      query,
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
          el.dataset.section === activeSection,
      );
      match?.focus({ preventScroll: true });
    }
  }
  if (searchFocused) {
    $("#search")?.focus();
    if (start !== null) $("#search")?.setSelectionRange(start, start);
  }
}
function nextCase(completed = 0) {
  const pool = selected();
  if (!pool.length) {
    view = "home";
    session = null;
    return;
  }
  const c = pool[randomIndex(pool.length)];
  session = {
    caseId: c.id,
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
    case "arrows":
      preferences.pllArrows = !preferences.pllArrows;
      if (!savePreferences(preferences))
        notify("This setting could not be saved.");
      break;
    case "nav":
      view = button.dataset.view;
      session = null;
      detail = null;
      break;
    case "section":
      section = button.dataset.section;
      group = "all";
      break;
    case "clear-search":
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
    case "start":
      nextCase();
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
  if (["nav", "start", "exit", "rehearse"].includes(action)) {
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
  if (e.target.id === "group") {
    group = e.target.value;
    render();
  }
  if (e.target.id === "variant") {
    progress.variants[detail] = Number(e.target.value);
    save();
    render();
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
