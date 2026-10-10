const KEY = "last-layer.preferences.v1";
export function loadPreferences(storage) {
  try {
    const saved = JSON.parse((storage ?? globalThis.localStorage).getItem(KEY));
    return {
      pllArrows: saved?.pllArrows === true,
      randomSide: saved?.randomSide === true,
    };
  } catch {
    return { pllArrows: false, randomSide: false };
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
