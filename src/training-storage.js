import { STORAGE_KEY } from "./progress.js";
import { SOLVES_KEY } from "./solve-history.js";
import { CUBES_KEY } from "./cubes.js";
import { recoverRestore } from "./training-backup.js";

// All training persistence, including restore journals, follows the active source.
// Preferences and themes remain normal device settings.
export function createTrainingStorage(storage, makeTestData, testData = false) {
  let sandbox;
  function target() {
    if (!testData) return storage;
    if (!sandbox) {
      const data = makeTestData();
      const values = new Map([
        [STORAGE_KEY, JSON.stringify(data.progress)],
        [SOLVES_KEY, JSON.stringify(data.solves)],
        [CUBES_KEY, JSON.stringify(data.cubeCollection)],
      ]);
      sandbox = {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: (key) => values.delete(key),
      };
    }
    return sandbox;
  }
  return {
    get target() {
      return target();
    },
    setTestData(enabled) {
      testData = enabled;
    },
    getItem(key) {
      const active = target();
      recoverRestore(active);
      return active.getItem(key);
    },
    setItem(key, value) {
      const active = target();
      recoverRestore(active);
      active.setItem(key, value);
    },
  };
}
