import { createSubscriber } from "svelte/reactivity";

const STORAGE_KEY = "last-layer-theme";
const OPTIONS = ["system", "light", "dark"];
let preference = readPreference();
let initialized = false;
let notifyPreference;
const subscribePreference = createSubscriber((update) => {
  notifyPreference = update;
  return () => {
    notifyPreference = undefined;
  };
});

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
  notifyPreference?.();
}

export function themePreference() {
  subscribePreference();
  return preference;
}

export function setThemePreference(next) {
  if (!OPTIONS.includes(next)) return;
  preference = next;
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Still apply the preference for this tab when storage is unavailable.
  }
  applyTheme();
}

export function initTheme() {
  if (initialized) return;
  initialized = true;
  applyTheme();
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", applyTheme);
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    preference = readPreference();
    applyTheme();
  });
}
