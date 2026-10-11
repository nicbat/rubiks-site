import { escape } from "./html.js";

export function cubePicker(id, label, cubes, value, disabled = false) {
  return `<label class="cube-field" for="${escape(id)}"><span>${escape(label)}</span><select id="${escape(id)}" data-cube-picker ${disabled ? "disabled" : ""}><option value="">Not specified</option>${value && !cubes.some((c) => c.id === value) ? `<option value="${escape(value)}" selected>Unavailable cube</option>` : ""}${cubes
    .filter((c) => !c.deleted || c.id === value)
    .map(
      (c) =>
        `<option value="${escape(c.id)}" ${c.id === value ? "selected" : ""}>${escape(c.name)}</option>`,
    )
    .join("")}</select></label>`;
}

export function renderCubes(
  { cubes, defaultId },
  editingId = null,
  deletingId = null,
) {
  const active = cubes.filter((c) => !c.deleted);
  const editing = active.find((c) => c.id === editingId);
  return `<section class="cubes-page"><div class="page-heading"><div><h1>Cubes</h1><p class="muted">Choose your default for the timer.</p></div></div>
    <div class="cube-list">${active
      .map(
        (
          c,
        ) => `<article class="cube-card" aria-label="${escape(c.name)}"><div class="cube-card-heading"><h2>${escape(c.name)}</h2>${defaultId === c.id ? '<span class="cube-default-badge">Default</span>' : ""}</div>${c.description ? `<p class="cube-description">${escape(c.description)}</p>` : ""}
    ${deletingId === c.id ? `<div class="cube-delete-confirm"><p>Delete this cube? Past solves keep its name.</p><div class="cube-actions"><button class="secondary" data-action="equipment-delete-confirm" data-id="${escape(c.id)}">Delete cube</button><button class="text-button" data-action="equipment-delete-cancel" data-id="${escape(c.id)}">Cancel</button></div></div>` : `<div class="cube-actions">${defaultId !== c.id ? `<button class="text-button" data-action="equipment-default" data-id="${escape(c.id)}">Make default</button>` : ""}<button class="text-button" data-action="equipment-edit" data-id="${escape(c.id)}" aria-label="Edit ${escape(c.name)}">Edit</button><button class="text-button cube-delete" data-action="equipment-delete" data-id="${escape(c.id)}" aria-label="Delete ${escape(c.name)}">Delete</button></div>`}</article>`,
      )
      .join("")}</div>
    <details id="cube-editor" class="cube-editor" ${editing || !active.length ? "open" : ""}><summary>${editing ? "Edit cube" : "Add cube"}</summary>
    <form id="cube-form">
    <label class="cube-field" for="cube-name">Name<input id="cube-name" name="name" required maxlength="100" value="${escape(editing?.name || "")}"></label>
    <label class="cube-field" for="cube-description">Description (optional)<textarea id="cube-description" name="description" maxlength="1000" rows="2">${escape(editing?.description || "")}</textarea></label>
    <div class="cube-actions"><button class="primary" type="submit">${editing ? "Save cube" : "Add cube"}</button><button class="text-button" type="button" data-action="equipment-cancel">Cancel</button></div></form></details>
    <p class="cube-local-note">Saved on this device.</p></section>`;
}
