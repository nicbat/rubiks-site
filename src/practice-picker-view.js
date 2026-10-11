import { escape } from "./html.js";
import { icon } from "./icons.js";

export function renderPracticePicker(picker, caseDiagram) {
  const chosen = new Set(picker.selected);
  const total = picker.groups.reduce((n, group) => n + group.cases.length, 0);
  return `<dialog id="practice-picker" aria-labelledby="practice-picker-title" aria-describedby="practice-picker-help">
    <div class="dialog-heading"><h2 id="practice-picker-title">Choose cases to practice</h2><button class="icon-button" data-action="close-dialog" aria-label="Close practice picker">${icon("close")}</button></div>
    <p id="practice-picker-help">Choose individual cases or click a group heading to select the group. Your learning set stays unchanged.</p>
    <p class="muted">${escape(picker.section)} · ${total} cases matching your library filters</p>
    ${picker.groups
      .map((group) => {
        const count = group.cases.filter((c) => chosen.has(c.id)).length;
        return `<section class="practice-pick-group" aria-labelledby="pick-group-${group.index}">
        <h3 id="pick-group-${group.index}"><button role="checkbox" aria-checked="${count === group.cases.length ? "true" : count ? "mixed" : "false"}" aria-label="${escape(group.name)}" data-action="pick-group" data-group="${group.index}"><span class="pick-check" aria-hidden="true">${count === group.cases.length ? "✓" : count ? "−" : ""}</span><span>${escape(group.name)}</span><small>${count} / ${group.cases.length}</small></button></h3>
        <div class="practice-pick-grid">${group.cases.map((c) => `<button class="practice-pick-case" role="checkbox" aria-checked="${chosen.has(c.id)}" aria-label="${escape(c.name)}" data-action="pick-case" data-id="${c.id}"><span class="pick-check" aria-hidden="true">${chosen.has(c.id) ? "✓" : ""}</span>${caseDiagram(c)}<span>${escape(c.name)}</span></button>`).join("")}</div>
      </section>`;
      })
      .join("")}
    <div class="practice-picker-actions"><span role="status">${chosen.size} selected</span><button class="primary" data-action="practice-picked" ${chosen.size ? "" : "disabled"}>Practice selected (${chosen.size})</button><button class="secondary" data-action="practice-all">Practice all (${total})</button></div>
  </dialog>`;
}
