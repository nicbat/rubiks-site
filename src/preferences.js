import { displayColors } from "./display-colors.js";
const KEY = "last-layer.preferences.v1";
export function loadPreferences(storage) {
  try {
    const saved = JSON.parse((storage ?? globalThis.localStorage).getItem(KEY));
    return {
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
