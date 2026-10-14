import { renderPllQuiz } from "./pll-quiz-view.js";
import { displayColors } from "./display-colors.js";
import {
  renderCourses,
  renderCourseContinue,
  renderCourseContext,
  renderGuideReview,
} from "./courses-view.js";
import { partialCases, twoLookCases } from "./learning-methods.js";
import { moduleById, moduleCases } from "./courses.js";
import { renderCubes } from "./cubes-view.js";
import { renderPracticePicker } from "./practice-picker-view.js";
import { renderCubePlayer } from "./cube-player.js";
import { libraryGroups, learnedStatus } from "./library.js";
import { learningMethods, methodGroups } from "./learning-methods.js";
import { renderGuides } from "./guides-view.js";
import { renderTimer } from "./timer-view.js";
import { selectControl } from "./select-control.js";
import { tokens } from "./cube.js";
import { caseDiagram as renderCaseDiagram } from "./case-diagram.js";
import { createProgressIndex } from "./progress-index.js";
import { escape } from "./html.js";
import { icon } from "./icons.js";
import { dayKey, isKnown } from "./progress.js";
import { renderThemeControl } from "./theme.js";

// Views read a snapshot and render markup. State changes and DOM events stay in main.js.
export function renderApp({ state, catalog, byId, variant, selected, chunks }) {
  const {
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
  } = state;
  const workspace =
    ["library", "guides"].includes(view) &&
    progress.activeCourse === "cfop" &&
    !!state.activeModule;
  const progressIndex = createProgressIndex(progress, state.method || "full");
  const status = (c) => progressIndex.statusFor(c.id, variant(c));
  const stages = new Map(
    ["OLL", "PLL"].flatMap((section) =>
      methodGroups(catalog, section, state.method || "full").flatMap((stage) =>
        stage.cases.map((c) => [c.id, stage]),
      ),
    ),
  );
  const caseAlias = (c) => stages.get(c.id)?.labels[c.id];
  const aliasMarkup = (c) =>
    caseAlias(c)
      ? `<small class="case-alias">${escape(caseAlias(c))}</small>`
      : "";
  const caseDiagram = (c) =>
    renderCaseDiagram(
      c.algorithms[variant(c)].moves,
      c.section,
      `${c.name} viewed from above; front at bottom`,
      {
        arrows: preferences.pllArrows,
        top: detail || session ? state.displayTop : preferences.displayTop,
      },
    );
  function badge(c) {
    const s = status(c);
    return `<span class="badge ${s.label === "Confident" ? "confident" : ""}">${s.label}</span>`;
  }
  function nav() {
    return `<header class="header"><a class="brand" href="#/home" data-action="nav" data-view="home"><span class="brand-mark"><i></i><i></i><i></i><i></i></span>Last Layer</a><div class="header-actions"><button class="local-button" data-action="backup" aria-label="Backup and transfer local progress"><span class="local-dot"></span><span>${notice ? "Progress needs attention" : "Saved on this device"}</span>${icon("download")}</button><button class="icon-button header-settings" data-action="nav" data-view="settings" aria-label="Settings" title="Settings" ${["settings", "cubes"].includes(view) ? 'aria-current="page"' : ""}>${icon("settings")}</button></div></header><div class="nav-wrap"><nav aria-label="Main navigation">${[
      ["home", "grid", "My learning"],
      ["courses", "book", "Courses"],
      ["progress", "chart", "Progress"],
      ["timer", "sun", "Timer"],
    ]
      .map(
        ([v, i, label]) =>
          `<button data-action="nav" data-view="${v}" ${view === v || (v === "courses" && (workspace || view === "pll-quiz")) ? 'aria-current="page"' : ""}>${icon(i)}${label}</button>`,
      )
      .join("")}</nav></div>`;
  }
  function study(c) {
    return `<article class="study-card"><div class="study-visual"><button class="study-diagram-button" data-action="detail" data-id="${c.id}" aria-label="View ${escape(c.name)} case">${caseDiagram(c)}</button><span>${c.section} / ${escape(c.group)}</span></div><div class="study-body"><div class="study-heading"><h2>${escape(c.name)}</h2>${badge(c)}</div>${chunks(c.algorithms[variant(c)].moves)}<div class="study-actions"><button class="primary" data-action="rehearse" data-id="${c.id}">Practice algorithm</button><button class="text-button" data-action="detail" data-id="${c.id}">View case ${icon("arrow")}</button></div></div></article>`;
  }
  function home() {
    const list = selected(),
      focus = list.find((c) => c.id === focusId) || list[0];
    const today = progressIndex.attemptsOn(dayKey());
    return `<div class="page-heading home-heading"><div><p class="date-label">${new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p><h1>My learning</h1></div><div class="today-count">${icon("sun")}<span><strong>${today}</strong> ${today === 1 ? "attempt" : "attempts"} today</span></div></div>
 ${renderCourseContinue(progress)}<div class="workspace learning-workspace"><section><div class="section-heading"><h2>Your learning set <span class="count">${list.length}</span></h2><button class="text-button" data-action="nav" data-view="library">${icon("plus")} Add cases</button></div>
 ${focus ? `${study(focus)}<div class="case-strip">${list.map((c) => `<button class="mini-case ${focus.id === c.id ? "active" : ""}" data-action="focus" data-id="${c.id}" aria-pressed="${focus.id === c.id}">${caseDiagram(c)}<span>${escape(c.name)}</span><small>${status(c).label}</small></button>`).join("")}</div>` : `<div class="empty-learning"><div class="empty-diagrams">${caseDiagram(byId.get("pll-T"))}${caseDiagram(byId.get("oll-27"))}</div><h2>Choose cases to practice</h2><button class="primary" data-action="nav" data-view="library">Browse library ${icon("arrow")}</button></div>`}</section>
 <aside><div class="practice-panel"><span class="practice-icon">${icon("shuffle")}</span><h2>Hidden practice</h2><p>Set up a case out of sight, then recognize and solve it.</p>${sideToggle()}<button class="primary" data-action="start" ${!list.length ? "disabled" : ""}>Start hidden practice ${icon("arrow")}</button><small>${list.length ? `${list.length} ${list.length === 1 ? "case" : "cases"} from your learning set` : "Add a case to your learning set to begin."}</small></div><div class="habit-note"><span class="small-mark">↻</span><div><h3>Confidence</h3><p>“Confident” means recognizing and solving a case on three different days since your last difficult attempt.</p></div></div></aside></div>
 <div class="bottom-note">${icon("check")} Progress stays in this browser.</div>`;
  }
  function settingsModal() {
    return `<dialog id="settings-dialog" aria-labelledby="settings-title"><div class="dialog-heading"><h1 id="settings-title">Settings</h1><button class="icon-button" data-action="close-dialog" aria-label="Close settings">${icon("close")}</button></div><section class="settings-panel"><h2>Your cubes</h2><p class="muted">Manage your collection and default timer cube.</p><button class="secondary" data-action="nav" data-view="cubes">Cubes</button><h2>Display and timer</h2>${renderThemeControl()}<label class="cube-field" for="display-top">Default display top color<select id="display-top">${Object.entries(
      displayColors,
    )
      .map(
        ([id, name]) =>
          `<option value="${id}" ${preferences.displayTop === id ? "selected" : ""}>${name}</option>`,
      )
      .join(
        "",
      )}</select></label><label class="setting-toggle"><input id="random-display" type="checkbox" ${preferences.randomDisplay ? "checked" : ""}>Randomize display color</label><p class="muted">Randomize per case opening or question. Timer previews stay yellow.</p><label class="setting-toggle"><input id="pll-arrows" type="checkbox" ${preferences.pllArrows ? "checked" : ""}>PLL arrows</label><p class="muted">Show piece movement on PLL diagrams.</p><label class="setting-toggle"><input id="timer-minutes" type="checkbox" ${preferences.timerMinutes !== false ? "checked" : ""}>Show minutes on timer</label><p class="muted">Turn off to show total seconds.</p><label class="setting-toggle"><input id="hide-timer" type="checkbox" ${preferences.hideTimer ? "checked" : ""}>Hide timer while solving</label><p class="muted">Show the time when you stop.</p></section></dialog>`;
  }
  function sideToggle() {
    return `<div class="side-option"><label class="setting-toggle"><input type="checkbox" aria-describedby="random-side-help" id="random-side" ${preferences.randomLastLayer ? "checked" : ""}>Randomize last-layer color</label><small id="random-side-help" class="muted">The last layer can be any of the six colors; repeats are possible.</small></div>`;
  }
  function libraryCard(c) {
    const added = progressIndex.isSelected(c.id);
    return `<article class="library-case"><button class="case-open" data-action="detail" data-id="${c.id}" aria-label="View ${escape(c.name)}">${caseDiagram(c)}<div><h3>${escape(c.name)}</h3>${aliasMarkup(c)}${badge(c)}</div></button><div class="case-footer"><span>${tokens(c.algorithms[variant(c)].moves).length} moves</span><button class="add-button ${added ? "added" : ""}" data-action="toggle" data-id="${c.id}" aria-label="${added ? "Remove" : "Add"} ${escape(c.name)} ${added ? "from" : "to"} learning set" aria-pressed="${added}">${icon(added ? "check" : "plus")}${added ? "In your set" : "Learn this"}</button></div></article>`;
  }
  function library() {
    const method = state.method || "full";
    const learned = state.learned || "all";
    const isLearned = (c) => learnedStatus(status(c));
    const learnedCount = (cases) => cases.filter(isLearned).length;
    const availableGroups = methodGroups(catalog, section, method);
    const groups = availableGroups.map((g) => g.name);
    const visibleGroups = libraryGroups(
      catalog,
      {
        section,
        method,
        group,
        query,
        learned,
      },
      isLearned,
    );
    const cases = visibleGroups.flatMap((g) => g.cases);
    return `<div class="page-heading">${workspace ? `<h2>${section}</h2>` : "<h1>Algorithm library</h1>"}<button class="primary" data-action="practice-filtered" ${cases.length ? "" : "disabled"}>Practice these cases</button></div><div class="library-filters">${
      workspace
        ? `<div class="segmented" role="group" aria-label="Last-layer scope">${[
            ["two-look", "Two-look"],
            ["full", "Full"],
          ]
            .map(
              ([id, label]) =>
                `<button data-action="cfop-method" data-id="${id}" aria-pressed="${method === id}">${label}</button>`,
            )
            .join("")}</div>`
        : selectControl("method", "Learning method", method, learningMethods)
    }${selectControl("learned", "Learning status", learned, [
      { value: "all", label: "All learning statuses" },
      { value: "learned", label: "Learned" },
      { value: "unlearned", label: "Unlearned" },
    ])}</div><div class="library-toolbar">${workspace ? "" : `<div class="segmented" aria-label="Algorithm section">${["PLL", "OLL"].map((s) => `<button data-action="section" data-section="${s}" aria-pressed="${section === s}">${s}<span>${methodGroups(catalog, s, method).reduce((count, g) => count + g.cases.length, 0)}</span></button>`).join("")}</div>`}<label class="search">${icon("search")}<input id="search" type="search" placeholder="Find a case or group…" aria-label="Search cases" value="${escape(query)}"></label>${selectControl("group", "Filter by group", group, [{ value: "all", label: "All groups" }, ...groups.map((g) => ({ value: g, label: g }))])}</div>
 ${workspace && section === "PLL" ? '<button class="text-button" data-action="pll-quiz">Start PLL quiz</button>' : ""}<div class="library-meta"><span>${learned === "all" ? `${learnedCount(cases)} / ${cases.length} learned` : `${cases.length} ${cases.length === 1 ? "case" : "cases"}`} · viewed from above</span></div><div class="library-groups">${visibleGroups.length ? visibleGroups.map((g) => `<section class="library-group" aria-labelledby="group-${g.index}"><div class="group-heading"><h2 id="group-${g.index}"><button data-action="collapse-group" data-group="${escape(`${method}:${section}:${g.name}`)}" aria-expanded="${query || !(preferences.collapsedGroups || []).includes(`${method}:${section}:${g.name}`) ? "true" : "false"}" aria-controls="group-cases-${g.index}">${escape(g.name)} <span class="count">${learned === "all" ? `${learnedCount(g.cases)} / ${g.cases.length} learned` : g.cases.length}</span><span class="group-chevron" aria-hidden="true">⌄</span></button></h2></div><div id="group-cases-${g.index}" class="library-grid" ${!query && (preferences.collapsedGroups || []).includes(`${method}:${section}:${g.name}`) ? "hidden" : ""}>${g.description ? `<p class="group-description">${escape(g.description)}</p>` : ""}${g.cases.map(libraryCard).join("")}</div></section>`).join("") : '<div class="no-results"><h2>No matching cases</h2><button data-action="clear-search" class="secondary">Clear filters</button></div>'}</div><p class="source-note">Algorithms and setups: <a href="https://jperm.net/algs/${section.toLowerCase()}" target="_blank" rel="noreferrer">J Perm</a>.</p>`;
  }
  function progressPage() {
    const scope = moduleById(state.activeModule);
    const scopedCatalog =
      scope?.kind === "algorithms"
        ? moduleCases(scope, catalog)
        : ["OLL", "PLL"].flatMap((section) =>
            methodGroups(catalog, section, state.method).flatMap(
              (g) => g.cases,
            ),
          );
    const attempted = scopedCatalog.filter(
      (c) =>
        progressIndex.isSelected(c.id) ||
        progressIndex.hasAttempts(c.id) ||
        progressIndex.isKnown(c.id, variant(c)),
    );
    const confident = attempted.filter(
      (c) => status(c).label === "Confident",
    ).length;
    const days = progressIndex.practiceDays;
    return `<div class="page-heading"><div><h1>Progress</h1></div><button class="secondary" data-action="backup">${icon("download")} Backup & transfer</button></div><div class="progress-stats"><div><strong>${progress.attempts.length}</strong><span>Practice attempts</span></div><div><strong>${days}</strong><span>Practice days</span></div><div><strong>${confident}<small> / ${scopedCatalog.length}</small></strong><span>Confident cases</span></div></div><section class="progress-list"><div class="section-heading"><h2>Your cases</h2><span class="muted">Three confident recognition days, after the last difficult attempt</span></div>${
      attempted.length
        ? attempted
            .map((c) => {
              const s = status(c);
              return `<button class="progress-row" data-action="detail" data-id="${c.id}">${caseDiagram(c)}<span class="progress-name"><strong>${escape(c.name)}</strong><small>${escape(c.group)}</small></span>${badge(c)}<span class="day-dots" aria-label="${Math.min(s.days, 3)} of 3 confident days">${[0, 1, 2].map((n) => `<i class="${s.days > n ? "filled" : ""}"></i>`).join("")}</span><span class="attempt-count">${s.attempts} attempts</span>${icon("arrow")}</button>`;
            })
            .join("")
        : '<div class="no-results"><h2>No practice yet</h2><button class="primary" data-action="nav" data-view="library">Browse library</button></div>'
    }</section><p class="source-note">Only hidden practice counts toward confidence. Each algorithm has its own confidence record.</p>`;
  }
  function practice() {
    if (!session) return "";
    const c = byId.get(session.caseId),
      hidden = session.stage !== "answer",
      recognition = session.mode === "recognition";
    return `<div class="practice-top"><button class="text-button" data-action="exit">${icon("close")} End practice</button><span>${recognition ? "Hidden-case practice" : "Algorithm rehearsal"} <span class="count">${session.completed} completed</span></span></div><section class="trainer"><div class="step-label">${recognition ? (session.stage === "setup" ? "1 / Set up" : session.stage === "recognize" ? "2 / Recognize & solve" : "3 / Rate") : "Rehearsal"}</div><h1>${recognition && hidden ? (session.stage === "setup" ? "Set up your cube" : "Recognize & solve") : escape(c.name)}</h1>
 ${recognition && session.stage === "setup" ? `<p>Start solved, with yellow on top and green in front.<br>Follow these moves with your cube out of sight.</p>${sideToggle()}<div class="scramble" aria-label="Setup moves">${escape(session.setup)}</div><div class="trainer-actions"><button class="primary" data-action="ready">Ready to recognize ${icon("arrow")}</button><button class="text-button" data-action="skip">Try another setup</button></div><p class="trainer-footnote">${(session.pool?.length ?? selected().length) === 1 ? "One case selected. Add more to practice recognition." : "Reveal the answer after solving, or ask for a hint."}</p>` : ""}
 ${recognition && session.stage === "recognize" ? `<p>Bring your cube into view, put the last layer on top, and solve from memory.</p><div class="mystery-cube" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => `<i>${i === 4 ? "?" : ""}</i>`).join("")}</div><div class="trainer-actions"><button class="primary" data-action="finished">Finished ${icon("check")}</button><button class="secondary" data-action="hint">Show hint</button></div><details class="setup-reminder"><summary>Show setup moves again</summary><p>${escape(session.setup)}</p></details>` : ""}
 ${!hidden || !recognition ? `<div class="answer-layout"><div class="answer-diagram">${caseDiagram(c)}<span>${escape(c.group)}</span><button class="text-button" data-action="display-color">Change color</button></div><div>${chunks(c.algorithms[variant(c)].moves)}<p class="muted">Put the last layer on top and match the pattern, regardless of color. Use U turns or rotate the cube as needed. ${c.section === "OLL" ? "This step orients the top; finish PLL before the next setup." : "Finish with a U turn if needed."}</p></div></div>${recognition ? `<h2 class="rating-heading">How did it go?</h2><div class="ratings"><button data-action="rate" data-result="help"><span>Needed help</span></button><button data-action="rate" data-result="effort" ${session.hinted ? "disabled" : ""}><span>Solved with effort</span></button><button data-action="rate" data-result="confident" ${session.hinted ? "disabled" : ""}><span>Recognized & solved confidently</span></button></div>${session.hinted ? '<p class="muted">Hint used: record “Needed help”.</p>' : ""}` : `<p class="rehearsal-instruction">Practice the moves, then repeat from memory.</p><button class="primary" data-action="rehearsal-done">${icon("check")} Record a repetition</button><p class="muted">Rehearsals don’t count toward confidence.</p>`}` : ""}
 </section>`;
  }
  function sharing(c) {
    if (!twoLookCases.includes(c.id)) return "";
    return `<div class="progress-sharing"><p>Known marks apply to this algorithm in both two-look and full CFOP.</p><p>${partialCases.includes(c.id) ? "Recognition practice tracks the two patterns separately." : "Recognition progress is shared too."}</p></div>`;
  }
  function detailModal() {
    const c = byId.get(detail);
    if (!c) return "";
    const s = status(c);
    return `<dialog id="detail-dialog" aria-labelledby="case-title"><div class="dialog-heading"><span>${c.section} / ${escape(c.group)}</span><div class="dialog-heading-actions"><button class="icon-button" data-action="close-dialog" aria-label="Close case">${icon("close")}</button></div></div><div class="case-layout"><div class="case-information"><div class="detail-intro">${caseDiagram(c)}<div><h1 id="case-title">${escape(c.name)}</h1>${aliasMarkup(c)}${badge(c)}<p>${Math.min(s.days, 3)} of 3 confident recognition days</p></div></div><label class="variant-label" for="variant">Your algorithm</label><small class="variant-saved muted">Your choice is saved on this device.</small>${selectControl(
      "variant",
      "Your algorithm",
      variant(c),
      c.algorithms.map((a, i) => ({
        value: i,
        label: `${a.label} — ${a.moves}`,
      })),
    )}${chunks(c.algorithms[variant(c)].moves)}<p class="muted">${displayColors[state.displayTop]} on top; the diagram’s front is at the bottom.</p><button class="text-button" data-action="display-color">Change color</button><div class="case-setup"><button class="text-button" data-action="detail-setup" aria-expanded="${!!state.detailSetupVisible}" aria-controls="case-setup-content">${state.detailSetupVisible ? "Hide" : "Show"} setup moves</button><div id="case-setup-content" ${state.detailSetupVisible ? "" : "hidden"}><p class="muted">Start solved, with yellow on top and green in front.</p><p class="case-setup-moves" aria-label="Case setup moves">${escape(c.setups[0])}</p><p class="muted">Then use U turns or rotate the cube to match the diagram.${c.section === "OLL" ? " After OLL, you may still need PLL." : ""}</p></div></div><div class="detail-help"><strong>${escape(stages.get(c.id)?.description ? stages.get(c.id).name : c.section === "OLL" ? "Top-color pattern" : "Side stickers")}</strong><p>${escape(stages.get(c.id)?.description || (c.section === "OLL" ? "Match the top-color stickers on top and around the edges." : "Check side colors for matching pairs, solid rows, and pieces to move."))}</p></div>${sharing(c)}<div class="dialog-actions"><button class="${progressIndex.isSelected(c.id) ? "primary" : "secondary"}" data-action="toggle" data-id="${c.id}" aria-pressed="${progressIndex.isSelected(c.id)}">${icon(progressIndex.isSelected(c.id) ? "check" : "plus")}Learning set</button><button class="secondary" data-action="rehearse" data-id="${c.id}">Rehearse</button><button class="${isKnown(progress, c.id, variant(c), state.method) ? "primary" : "secondary"}" data-action="known" data-id="${c.id}" aria-pressed="${isKnown(progress, c.id, variant(c), state.method)}">${icon(isKnown(progress, c.id, variant(c), state.method) ? "check" : "plus")}Known</button></div><a class="source-link" href="${stages.get(c.id)?.source || c.source}" target="_blank" rel="noreferrer">Algorithm source: J Perm</a></div><aside class="case-player-panel" aria-label="Algorithm preview">${renderCubePlayer({ id: c.id, mode: "algorithm", top: state.displayTop, algorithm: c.algorithms[variant(c)].moves })}</aside></div></dialog>`;
  }
  function scrambleModal() {
    return `<dialog id="scramble-dialog" aria-labelledby="scramble-title"><div class="dialog-heading"><h2 id="scramble-title">Scrambled cube</h2><button class="icon-button" data-action="close-dialog" aria-label="Close scramble preview">${icon("close")}</button></div><p>After the current scramble · yellow on top, green in front.</p>${renderCubePlayer({ id: "timer-scramble", mode: "scramble", algorithm: state.timer.scramble })}<p class="scramble-preview-moves">${escape(state.timer.scramble)}</p></dialog>`;
  }
  function backupModal() {
    return `<dialog id="backup-dialog" aria-labelledby="backup-title"><div class="dialog-heading"><span>Local progress</span><button class="icon-button" data-action="close-dialog" aria-label="Close backup">${icon("close")}</button></div><h1 id="backup-title">Backup & transfer</h1><p>Your courses, reviewed lessons, shared progress links, and practice history are saved in this browser.</p><div class="backup-block"><h2>Export</h2><p>Download a JSON backup for storage or transfer.</p><button class="primary" data-action="export">${icon("download")} Export progress</button></div><div class="backup-block"><h2>Import</h2><p>Review a backup before replacing this browser’s progress.</p><label class="file-label">Choose backup file<input id="import-file" type="file" accept=".json,application/json"></label><div id="import-message" role="status"></div>${pendingImport ? `<div class="import-preview"><strong>${pendingImport.selected.length} selected cases · ${pendingImport.attempts.length} attempts · ${pendingImport.reviewed?.length || 0} reviewed lessons</strong><p>This will replace your current ${progress.attempts.length} attempts and ${progress.selected.length} selected cases.</p><button class="primary" data-action="confirm-import">Replace with this backup</button></div>` : ""}</div><p class="muted">Clearing browser data also clears your progress. Phone and laptop progress do not sync automatically.</p></dialog>`;
  }
  return `<div class="shell">${nav()}${notice ? `<div class="warning" role="alert">${escape(notice)}</div>` : ""}<main id="main" tabindex="-1">${workspace ? renderCourseContext(progress.activeCourse, state.activeModule, state.method) : ""}${view === "pll-quiz" ? renderPllQuiz(state.pllQuiz, catalog, state.displayTop, state.method) : view === "courses" ? renderCourses({ progress }) : view === "home" ? home() : view === "library" ? library() : view === "progress" ? progressPage() : view === "timer" ? renderTimer({ ...state.timer, minutes: preferences.timerMinutes, hideTimer: preferences.hideTimer, solves: state.solves, currentSolveId: state.currentSolveId, cubes: state.cubeCollection?.cubes, cubeId: state.timerCubeId }) : view === "cubes" ? '<button class="text-button" data-action="nav" data-view="settings">Back to Settings</button>' + renderCubes(state.cubeCollection, state.editingCubeId, state.deletingCubeId) : view === "guides" ? renderGuides({ embedded: workspace, section: state.guideSection, example: state.guideExample, notationMove: state.notationMove, notationSuffix: state.notationSuffix }) + (["cross", "f2l"].includes(state.guideSection || "cross") ? renderGuideReview(state.guideSection || "cross", progress) : "") : practice()}</main><footer><nav class="utility-nav" aria-label="Reference and tools">${[
    ["library", "Algorithm library"],
    ["guides", "Guides"],
  ]
    .map(
      ([v, label]) =>
        `<button class="text-button" data-action="nav" data-view="${v}" ${view === v && !workspace ? 'aria-current="page"' : ""}>${label}</button>`,
    )
    .join(
      "",
    )}</nav><button class="text-button" data-action="backup">Local progress ${icon("download")}</button></footer></div><div id="toast" role="status" aria-live="polite">${escape(toast)}</div>${state.settings ? settingsModal() : ""}${state.practicePicker ? renderPracticePicker(state.practicePicker, caseDiagram) : ""}${detail ? detailModal() : ""}${backup ? backupModal() : ""}${state.scramblePreview ? scrambleModal() : ""}`;
}
