const STORAGE_KEY = "last-layer-theme";
const OPTIONS = ["system", "light", "dark"];
let preference = readPreference();
let initialized = false;

function readPreference() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return OPTIONS.includes(saved) ? saved : "system";
  } catch {
    return "system";
  }
}

function applyTheme() {
  const dark =
    preference === "dark" ||
    (preference === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#111b25" : "#f4f7fa");
  document.querySelectorAll("[data-theme-control]").forEach((select) => {
    select.checked = select.value === preference;
  });
}

export function renderThemeControl() {
  return `<fieldset class="theme-control"><legend>Color theme</legend><div class="theme-options">${OPTIONS.map((value) => `<label><input type="radio" name="theme" value="${value}" data-theme-control${preference === value ? " checked" : ""}>${value[0].toUpperCase() + value.slice(1)}</label>`).join("")}</div></fieldset>`;
}

export function initTheme() {
  if (initialized) return;
  initialized = true;
  applyTheme();
  document.addEventListener("change", (event) => {
    if (
      !event.target.matches?.("[data-theme-control]") ||
      !OPTIONS.includes(event.target.value)
    )
      return;
    preference = event.target.value;
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Still apply the preference for this tab when storage is unavailable.
    }
    applyTheme();
  });
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", applyTheme);
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    preference = readPreference();
    applyTheme();
  });
}
