import catalog from "../data/algorithms.json";
import triggers from "../data/triggers.json";
import { caseCube, diagram, tokens } from "./cube.js";
import {
  STORAGE_KEY,
  emptyProgress,
  validateProgress,
  statusFor,
  dayKey,
} from "./progress.js";
import "./style.css";

const $ = (s) => document.querySelector(s);
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  book: '<path d="M12 5v16M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2z"/>',
  chart: '<path d="M4 4v16h17M8 15v-4m5 4V7m5 8v-6"/>',
  arrow: '<path d="m9 5 7 7-7 7"/>',
  shuffle:
    '<path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 3-2 4-4m4-4c1-2 2-4 4-4h3m-4-4 4 4-4 4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.grid}</svg>`;
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
const status = (c) => statusFor(progress, c.id, variant(c));
const caseDiagram = (c) =>
  diagram(
    caseCube(c.algorithms[variant(c)].moves),
    c.section,
    `${c.name} viewed from above; front at bottom`,
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
function chunks(moves) {
  const movesList = tokens(moves),
    out = [];
  for (let i = 0; i < movesList.length;) {
    const match = triggers.find((t) =>
      tokens(t.moves).every((m, j) => movesList[i + j] === m),
    );
    if (match) {
      out.push(
        `<details class="trigger"><summary>${escape(match.moves)}</summary><span>${escape(match.name)}</span></details>`,
      );
      i += tokens(match.moves).length;
    } else {
      const plain = [];
      do {
        plain.push(movesList[i++]);
      } while (
        i < movesList.length &&
        !triggers.some((t) =>
          tokens(t.moves).every((m, j) => movesList[i + j] === m),
        )
      );
      out.push(`<span class="plain-moves">${escape(plain.join(" "))}</span>`);
    }
  }
  return `<div class="algorithm" aria-label="Algorithm">${out.join("")}</div>`;
}
function badge(c) {
  const s = status(c);
  return `<span class="badge ${s.label === "Confident" ? "confident" : ""}">${s.label}</span>`;
}
function nav() {
  return `<header class="header"><a class="brand" href="#" data-action="nav" data-view="home"><span class="brand-mark"><i></i><i></i><i></i><i></i></span>Last Layer<span class="brand-sub">a little practice, every day.</span></a><button class="local-button" data-action="backup" aria-label="Backup and transfer local progress"><span class="local-dot"></span><span>${notice ? "Progress needs attention" : "Saved on this device"}</span>${icon("download")}</button></header><div class="nav-wrap"><nav aria-label="Main navigation">${[
    ["home", "grid", "My learning"],
    ["library", "book", "Algorithm library"],
    ["progress", "chart", "Progress"],
  ]
    .map(
      ([v, i, label]) =>
        `<button data-action="nav" data-view="${v}" ${view === v ? 'aria-current="page"' : ""}>${icon(i)}${label}</button>`,
    )
    .join("")}</nav><span class="nav-note">Your cube. Your pace.</span></div>`;
}
function study(c) {
  return `<article class="study-card"><div class="study-visual">${caseDiagram(c)}<span>${c.section} / ${escape(c.group)}</span></div><div class="study-body"><div class="study-heading"><h2>${escape(c.name)}</h2>${badge(c)}</div>${chunks(c.algorithms[variant(c)].moves)}<p class="muted">Tap a highlighted chunk to see its name.</p><div class="study-actions"><button class="primary" data-action="rehearse" data-id="${c.id}">Practice this algorithm</button><button class="text-button" data-action="detail" data-id="${c.id}">View case ${icon("arrow")}</button></div></div></article>`;
}
function home() {
  const list = selected(),
    focus = list.find((c) => c.id === focusId) || list[0];
  const today = progress.attempts.filter((a) => a.day === dayKey()).length;
  return `<div class="page-heading"><div><p class="date-label">${new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p><h1>A little closer to fluent.</h1><p>Learn a few moves. Let them become second nature.</p></div><div class="today-count">${icon("sun")}<span><strong>${today}</strong> ${today === 1 ? "attempt" : "attempts"} today</span></div></div>
 <div class="workspace"><section><div class="section-heading"><h2>Your learning set <span class="count">${list.length}</span></h2><button class="text-button" data-action="nav" data-view="library">${icon("plus")} Add cases</button></div>
 ${focus ? `${study(focus)}<div class="case-strip">${list.map((c) => `<button class="mini-case ${focus.id === c.id ? "active" : ""}" data-action="focus" data-id="${c.id}" aria-pressed="${focus.id === c.id}">${caseDiagram(c)}<span>${escape(c.name)}</span><small>${status(c).label}</small></button>`).join("")}</div>` : `<div class="empty-learning"><div class="empty-diagrams">${caseDiagram(byId.get("pll-T"))}${caseDiagram(byId.get("oll-27"))}</div><h2>Start with a case you want to learn.</h2><p>Pick your own OLL and PLL cases.<br>They’ll be right here whenever you have a minute.</p><button class="primary" data-action="nav" data-view="library">Choose your first cases ${icon("arrow")}</button><span class="empty-caption">57 OLL cases. 21 PLL cases. No rush.</span></div>`}</section>
 <aside><div class="practice-panel"><span class="practice-icon">${icon("shuffle")}</span><h2>Know it when<br>you see it.</h2><p>Set up a mystery case under the table. Bring it out, recognize it, and solve.</p><button class="primary" data-action="start" ${!list.length ? "disabled" : ""}>Start hidden practice ${icon("arrow")}</button><small>${list.length ? `${list.length} ${list.length === 1 ? "case" : "cases"} from your learning set` : "Add a case to your learning set to begin."}</small></div><div class="habit-note"><span class="small-mark">↻</span><div><h3>Make it stick</h3><p>Recognize and solve a case confidently on three different days to earn “Confident”.</p></div></div></aside></div>
 <div class="bottom-note">${icon("check")} A few minutes count. Your progress stays in this browser.</div>`;
}
function library() {
  const cases = catalog.filter(
    (c) =>
      c.section === section &&
      (group === "all" || c.group === group) &&
      `${c.name} ${c.group}`.toLowerCase().includes(query.toLowerCase()),
  );
  const groups = [
    ...new Set(
      catalog.filter((c) => c.section === section).map((c) => c.group),
    ),
  ];
  return `<div class="page-heading"><div><p class="date-label">Build your own repertoire</p><h1>The last layer, one case at a time.</h1><p>Choose what you want to learn. Come back as often as you need.</p></div></div><div class="library-toolbar"><div class="segmented" aria-label="Algorithm section">${["PLL", "OLL"].map((s) => `<button data-action="section" data-section="${s}" aria-pressed="${section === s}">${s}<span>${s === "PLL" ? 21 : 57}</span></button>`).join("")}</div><label class="search">${icon("search")}<input id="search" type="search" placeholder="Find a case or group…" aria-label="Search cases" value="${escape(query)}"></label><select id="group" aria-label="Filter by group"><option value="all">All groups</option>${groups.map((g) => `<option ${g === group ? "selected" : ""} value="${escape(g)}">${escape(g)}</option>`).join("")}</select></div>
 <div class="library-meta"><span>${cases.length} cases ${section === "PLL" ? "to permute the last layer" : "to orient the last layer"}</span><span>Diagrams viewed from above · front at bottom</span></div><div class="library-grid">${cases.length ? cases.map((c) => `<article class="library-case"><button class="case-open" data-action="detail" data-id="${c.id}" aria-label="View ${escape(c.name)}">${caseDiagram(c)}<div><span class="case-group">${escape(c.group)}</span><h2>${escape(c.name)}</h2>${badge(c)}</div></button><div class="case-footer"><span>${tokens(c.algorithms[variant(c)].moves).length} moves</span><button class="add-button ${progress.selected.includes(c.id) ? "added" : ""}" data-action="toggle" data-id="${c.id}" aria-label="${progress.selected.includes(c.id) ? "Remove" : "Add"} ${escape(c.name)} ${progress.selected.includes(c.id) ? "from" : "to"} learning set" aria-pressed="${progress.selected.includes(c.id)}">${icon(progress.selected.includes(c.id) ? "check" : "plus")}${progress.selected.includes(c.id) ? "In your set" : "Learn this"}</button></div></article>`).join("") : '<div class="no-results"><h2>No matching cases</h2><p>Try another name or clear your filters.</p><button data-action="clear-search" class="secondary">Clear filters</button></div>'}</div><p class="source-note">Algorithms and setup sequences from <a href="https://jperm.net/algs/${section.toLowerCase()}" target="_blank" rel="noreferrer">J Perm</a>. Choose alternative algorithms in each case.</p>`;
}
function progressPage() {
  const attempted = catalog.filter(
    (c) =>
      progress.selected.includes(c.id) ||
      progress.attempts.some((a) => a.caseId === c.id),
  );
  const confident = attempted.filter(
    (c) => status(c).label === "Confident",
  ).length;
  const days = new Set(progress.attempts.map((a) => a.day)).size;
  return `<div class="page-heading"><div><p class="date-label">Small steps add up</p><h1>Watch it become familiar.</h1><p>Your own progress, at your own pace.</p></div><button class="secondary" data-action="backup">${icon("download")} Backup & transfer</button></div><div class="progress-stats"><div><strong>${progress.attempts.length}</strong><span>Practice attempts</span></div><div><strong>${days}</strong><span>Days you showed up</span></div><div><strong>${confident}<small> / 78</small></strong><span>Confident cases</span></div></div><section class="progress-list"><div class="section-heading"><h2>Your cases</h2><span class="muted">Three confident recognition days, after the last difficult attempt</span></div>${
    attempted.length
      ? attempted
          .map((c) => {
            const s = status(c);
            return `<button class="progress-row" data-action="detail" data-id="${c.id}">${caseDiagram(c)}<span class="progress-name"><strong>${escape(c.name)}</strong><small>${escape(c.group)}</small></span>${badge(c)}<span class="day-dots" aria-label="${Math.min(s.days, 3)} of 3 confident days">${[0, 1, 2].map((n) => `<i class="${s.days > n ? "filled" : ""}"></i>`).join("")}</span><span class="attempt-count">${s.attempts} attempts</span>${icon("arrow")}</button>`;
          })
          .join("")
      : '<div class="no-results"><h2>Your first practice is a good start.</h2><p>Add a few cases and try them out. Your history will appear here.</p><button class="primary" data-action="nav" data-view="library">Explore the library</button></div>'
  }</section><p class="source-note">Rehearsal builds muscle memory. Only hidden-case recognition contributes to confident days. Switching algorithms starts a separate confidence record.</p>`;
}
function practice() {
  if (!session) return "";
  const c = byId.get(session.caseId),
    hidden = session.stage !== "answer",
    recognition = session.mode === "recognition";
  return `<div class="practice-top"><button class="text-button" data-action="exit">${icon("close")} End practice</button><span>${recognition ? "Hidden-case practice" : "Algorithm rehearsal"} <span class="count">${session.completed} completed</span></span></div><section class="trainer"><div class="step-label">${recognition ? (session.stage === "setup" ? "1 / Set up" : session.stage === "recognize" ? "2 / Recognize & solve" : "3 / Reflect") : "Repeat. Relax. Remember."}</div><h1>${recognition && hidden ? (session.stage === "setup" ? "Keep the case a surprise." : "Bring your cube into view.") : escape(c.name)}</h1>
 ${recognition && session.stage === "setup" ? `<p>Start solved, with yellow on top and green in front.<br>Follow these moves with your cube out of sight.</p><div class="scramble" aria-label="Setup moves">${escape(session.setup)}</div><div class="trainer-actions"><button class="primary" data-action="ready">Ready to recognize ${icon("arrow")}</button><button class="text-button" data-action="skip">Try another setup</button></div><p class="trainer-footnote">${selected().length === 1 ? "Only one case is selected. Add more to make recognition a surprise." : "The case name and solution stay hidden until you finish or ask for help."}</p>` : ""}
 ${recognition && session.stage === "recognize" ? `<p>Take a moment to recognize the case, then solve it from memory.<br>No timer. Take the time you need.</p><div class="mystery-cube" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => `<i>${i === 4 ? "?" : ""}</i>`).join("")}</div><div class="trainer-actions"><button class="primary" data-action="finished">I’ve finished ${icon("check")}</button><button class="secondary" data-action="hint">I need a hint</button></div><details class="setup-reminder"><summary>Show setup moves again</summary><p>${escape(session.setup)}</p></details>` : ""}
 ${!hidden || !recognition ? `<div class="answer-layout"><div class="answer-diagram">${caseDiagram(c)}<span>${escape(c.group)}</span></div><div>${chunks(c.algorithms[variant(c)].moves)}<p class="muted">Match the case to this diagram before applying the algorithm. You may need a U turn or a rotation. ${c.section === "OLL" ? "This step orients the top; finish PLL before the next setup." : "Finish with a U turn if needed."}</p></div></div>${recognition ? `<h2 class="rating-heading">How did recognition and execution feel?</h2><div class="ratings"><button data-action="rate" data-result="help"><span>Needed help</span><small>A hint or another look</small></button><button data-action="rate" data-result="effort" ${session.hinted ? "disabled" : ""}><span>Solved with effort</span><small>Got there, with a pause</small></button><button data-action="rate" data-result="confident" ${session.hinted ? "disabled" : ""}><span>Recognized & solved confidently</span><small>Both felt familiar</small></button></div>${session.hinted ? '<p class="muted">You used a hint. Record “Needed help” and give it another try.</p>' : ""}` : `<p class="rehearsal-instruction">Read the moves, try them on your cube, then repeat from memory. Tap highlighted chunks to learn their names.</p><button class="primary" data-action="rehearsal-done">${icon("check")} Record a repetition</button><p class="muted">Rehearsals count as practice, but don’t mark a case confident.</p>`}` : ""}
 </section>`;
}
function detailModal() {
  const c = byId.get(detail);
  if (!c) return "";
  const s = status(c);
  return `<dialog id="detail-dialog" aria-labelledby="case-title"><div class="dialog-heading"><span>${c.section} / ${escape(c.group)}</span><button class="icon-button" data-action="close-dialog" aria-label="Close case">${icon("close")}</button></div><div class="detail-intro">${caseDiagram(c)}<div><h1 id="case-title">${escape(c.name)}</h1>${badge(c)}<p>${Math.min(s.days, 3)} of 3 confident recognition days</p></div></div><label class="variant-label" for="variant">Your algorithm</label><select id="variant">${c.algorithms.map((a, i) => `<option value="${i}" ${variant(c) === i ? "selected" : ""}>${escape(a.label)} — ${escape(a.moves)}</option>`).join("")}</select>${chunks(c.algorithms[variant(c)].moves)}<p class="muted">Highlighted chunks are reusable move sequences. Tap one to see its name. Hold yellow on top, with the front at the bottom of the diagram.</p><div class="detail-help"><strong>${c.section === "OLL" ? "Look for the yellow pattern." : "Look for matching side stickers."}</strong><p>${c.section === "OLL" ? "Match both the top face and the yellow stickers around its edges. Other colors are muted so you can focus on orientation." : "The top is already oriented. Check the side colors for matching pairs, solid rows, and pieces that need to move."}</p></div><div class="dialog-actions"><button class="${progress.selected.includes(c.id) ? "secondary" : "primary"}" data-action="toggle" data-id="${c.id}">${icon(progress.selected.includes(c.id) ? "check" : "plus")}${progress.selected.includes(c.id) ? "Remove from learning set" : "Add to learning set"}</button><button class="secondary" data-action="rehearse" data-id="${c.id}">Rehearse</button></div><a class="source-link" href="${c.source}" target="_blank" rel="noreferrer">Algorithm source: J Perm</a></dialog>`;
}
function backupModal() {
  return `<dialog id="backup-dialog" aria-labelledby="backup-title"><div class="dialog-heading"><span>Just on this device</span><button class="icon-button" data-action="close-dialog" aria-label="Close backup">${icon("close")}</button></div><h1 id="backup-title">Keep your progress.</h1><p>No account, no cloud. Your learning set, algorithm choices, and practice history live in this browser.</p><div class="backup-block"><h2>Take a backup</h2><p>Save a JSON file to keep a copy or move to another device.</p><button class="primary" data-action="export">${icon("download")} Export progress</button></div><div class="backup-block"><h2>Restore or transfer</h2><p>Import a Last Layer backup. You can review it before replacing this browser’s progress.</p><label class="file-label">Choose backup file<input id="import-file" type="file" accept=".json,application/json"></label><div id="import-message" role="status"></div>${pendingImport ? `<div class="import-preview"><strong>${pendingImport.selected.length} selected cases · ${pendingImport.attempts.length} attempts</strong><p>This will replace your current ${progress.attempts.length} attempts and ${progress.selected.length} selected cases.</p><button class="primary" data-action="confirm-import">Replace with this backup</button></div>` : ""}</div><p class="muted">Clearing browser data also clears your progress. Phone and laptop progress do not sync automatically.</p></dialog>`;
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
  $("#app").innerHTML =
    `<div class="shell">${nav()}${notice ? `<div class="warning" role="alert">${escape(notice)}</div>` : ""}<main id="main" tabindex="-1">${view === "home" ? home() : view === "library" ? library() : view === "progress" ? progressPage() : practice()}</main><footer><span class="footer-brand">Last Layer</span><span>A practice space for your next breakthrough.</span><button class="text-button" data-action="backup">Local progress ${icon("download")}</button></footer></div><div id="toast" role="status" aria-live="polite">${escape(toast)}</div>${detail ? detailModal() : ""}${backup ? backupModal() : ""}`;
  const dialog = $("dialog");
  if (dialog) {
    dialog.showModal();
    dialog.addEventListener("cancel", () => {
      detail = null;
      backup = false;
      pendingImport = null;
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
          detail = null;
          backup = false;
          pendingImport = null;
          render();
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
function randomIndex(n) {
  const bound = Math.floor(2 ** 32 / n) * n;
  let v;
  do {
    v = crypto.getRandomValues(new Uint32Array(1))[0];
  } while (v >= bound);
  return v % n;
}
function nextCase(completed = 0) {
  const pool = selected();
  if (!pool.length) {
    view = "home";
    session = null;
    return;
  }
  const c = pool[randomIndex(pool.length)],
    auf = ["", "U", "U'", "U2"][randomIndex(4)];
  session = {
    caseId: c.id,
    setup: `${c.setups[randomIndex(c.setups.length)]} ${auf}`.trim(),
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
      detail = id;
      break;
    case "close-dialog":
      detail = null;
      backup = false;
      pendingImport = null;
      break;
    case "backup":
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
      notify("Progress exported. Keep the file somewhere safe.");
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
  if (action === "rehearsal-done")
    notify("Repetition recorded. Keep practicing at your own pace.");
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
    try {
      if (file.size > 10_000_000)
        throw Error("Choose a progress file smaller than 10 MB.");
      pendingImport = validateProgress(JSON.parse(await file.text()), catalog);
      render();
    } catch (error) {
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
