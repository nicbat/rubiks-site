import { displayColors } from "./display-colors.js";
const KEY = "last-layer.preferences.v1";
export function loadPreferences(storage) {
  try {
    const saved = JSON.parse((storage ?? globalThis.localStorage).getItem(KEY));
    return {
      testData: saved?.testData === true,
      timerMinutes: saved?.timerMinutes !== false,
      hideTimer: saved?.hideTimer === true,
      method: saved?.method === "two-look" ? "two-look" : "full",
      displayTop: Object.hasOwn(displayColors, saved?.displayTop)
        ? saved.displayTop
        : "U",
      randomDisplay: saved?.randomDisplay === true,
      pllArrows: saved?.pllArrows !== false,
      randomLastLayer: (saved?.randomLastLayer ?? saved?.randomSide) === true,
      collapsedGroups: Array.isArray(saved?.collapsedGroups)
        ? saved.collapsedGroups
            .filter((value) => typeof value === "string")
            .slice(0, 100)
        : [],
    };
  } catch {
    return {
      testData: false,
      timerMinutes: true,
      hideTimer: false,
      method: "full",
      displayTop: "U",
      randomDisplay: false,
      pllArrows: true,
      randomLastLayer: false,
      collapsedGroups: [],
    };
  }
}
export function savePreferences(preferences, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(
      KEY,
      JSON.stringify(preferences),
    );
    return true;
  } catch {
    return false;
  }
}

// Keep the persisted schema stable when translating the page's controls.
export function preferenceChange(preferences, id, value) {
  if (id === "case-color") {
    if (value !== "random" && !Object.hasOwn(displayColors, value)) return null;
    return {
      ...preferences,
      randomDisplay: value === "random",
      displayTop: value === "random" ? preferences.displayTop : value,
    };
  }
  if (id === "time-format") {
    if (!["minutes", "seconds"].includes(value)) return null;
    return { ...preferences, timerMinutes: value === "minutes" };
  }
  const keys = {
    "hide-timer": "hideTimer",
    "pll-arrows": "pllArrows",
    "random-side": "randomLastLayer",
  };
  return Object.hasOwn(keys, id) && typeof value === "boolean"
    ? { ...preferences, [keys[id]]: value }
    : null;
}
