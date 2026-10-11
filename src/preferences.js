const KEY = "last-layer.preferences.v1";
export function loadPreferences(storage) {
  try {
    const saved = JSON.parse((storage ?? globalThis.localStorage).getItem(KEY));
    return {
      timerMinutes: saved?.timerMinutes !== false,
      hideTimer: saved?.hideTimer === true,
      method: saved?.method === "two-look" ? "two-look" : "full",
      pllArrows: saved?.pllArrows === true,
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
      pllArrows: false,
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
