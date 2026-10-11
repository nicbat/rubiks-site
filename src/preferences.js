const KEY = "last-layer.preferences.v1";
export function loadPreferences(storage) {
  try {
    const saved = JSON.parse((storage ?? globalThis.localStorage).getItem(KEY));
    return {
      method: saved?.method === "two-look" ? "two-look" : "full",
      pllArrows: saved?.pllArrows === true,
      randomSide: saved?.randomSide === true,
      collapsedGroups: Array.isArray(saved?.collapsedGroups)
        ? saved.collapsedGroups
            .filter((value) => typeof value === "string")
            .slice(0, 100)
        : [],
    };
  } catch {
    return {
      method: "full",
      pllArrows: false,
      randomSide: false,
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
