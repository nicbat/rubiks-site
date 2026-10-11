import { escape } from "./html.js";

// A shared popup keeps option colors, wrapping, and focus consistent across browsers.
export function selectControl(id, label, value, options) {
  const chosen = options.find(
    (option) => String(option.value) === String(value),
  );
  return `<details class="select-control" data-select="${id}"><summary id="${id}" role="combobox" aria-label="${escape(label)}" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}-options">${escape(chosen?.label ?? "")}<span aria-hidden="true">⌄</span></summary><div id="${id}-options" class="select-options" role="listbox" aria-label="${escape(label)}">${options.map((option) => `<button type="button" role="option" aria-selected="${String(option.value) === String(value)}" data-action="choose-option" data-control="${id}" data-value="${escape(String(option.value))}">${escape(option.label)}</button>`).join("")}</div></details>`;
}
