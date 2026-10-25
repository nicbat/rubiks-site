import { STORAGE_KEY } from "./progress.js";
import { SOLVES_KEY } from "./solve-history.js";
import { CUBES_KEY } from "./cubes.js";
import { recoverRestore } from "./training-backup.js";

// All training persistence, including restore journals, follows the active source.
// Preferences and themes remain normal device settings.
export function createTrainingStorage(storage, makeTestData, testData = false) {
  let account = null;
  let sandbox;
  const personal = () => (account ? accountStorage(storage, account) : storage);
  function target() {
    if (!testData) return personal();
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
    get scope() {
      return `${account || "guest"}:${testData}`;
    },
    setAccount(id) {
      account = id;
    },
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

export function accountStorage(storage, id) {
  const prefix = accountPrefix(id);
  const keyFor = (key) => `${prefix}${key}`;
  return {
    getItem: (key) => storage.getItem(keyFor(key)),
    setItem: (key, value) => storage.setItem(keyFor(key), value),
    removeItem: (key) => storage.removeItem(keyFor(key)),
  };
}
function accountPrefix(id) {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) throw Error("Invalid account ID");
  return `last-layer.account.${id}.`;
}
export function removeAccountCache(storage, id) {
  const prefix = accountPrefix(id);
  const keys = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}
