import { STORAGE_KEY, emptyProgress } from "./progress.js";
import { SOLVES_KEY } from "./solve-history.js";
import { CUBES_KEY } from "./cubes.js";
import { RESTORE_KEY } from "./training-backup.js";
import {
  migrateTrainingBackupV1,
  validateTrainingBackupV2,
} from "./training-v2.js";

export const TRAINING_V2_KEY = "last-layer.training.v2";
// Keep this original checkpoint untouched; v2 sync writes last-layer.sync.v2.
const LEGACY_SYNC_KEY = "last-layer.sync.v1";
export const LEGACY_TRAINING_KEYS = Object.freeze([
  STORAGE_KEY,
  SOLVES_KEY,
  CUBES_KEY,
  LEGACY_SYNC_KEY,
  RESTORE_KEY,
]);
const format = "last-layer-local-training";
// New builds must not write the old source after a device has adopted v2,
// even when the development feature flag was removed from the URL.
export function assertLegacyTrainingWritable(storage) {
  if (storage.getItem(TRAINING_V2_KEY) !== null)
    throw failure(
      "TRAINING_REQUIRES_V2",
      "Multi-event data exists on this device. Reopen with ?trainingV2=1 in development to continue; export preserves the version-2 copy.",
    );
}

function failure(code, message) {
  return Object.assign(new Error(message), { code });
}
function plain(value) {
  return (
    value &&
    typeof value === "object" &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}
function captureLegacy(storage) {
  return Object.fromEntries(
    LEGACY_TRAINING_KEYS.map((key) => [key, storage.getItem(key)]),
  );
}
function changedKeys(before, after) {
  return LEGACY_TRAINING_KEYS.filter((key) => before[key] !== after[key]);
}
function validateOriginals(value) {
  if (
    !plain(value) ||
    Object.keys(value).length !== LEGACY_TRAINING_KEYS.length ||
    LEGACY_TRAINING_KEYS.some(
      (key) =>
        !Object.hasOwn(value, key) ||
        (value[key] !== null && typeof value[key] !== "string"),
    )
  )
    throw failure(
      "INVALID_LOCAL_V2",
      "Retained original training data is invalid. Existing storage is preserved.",
    );
  return { ...value };
}
function parseEnvelope(raw, catalog) {
  let value;
  try {
    value = JSON.parse(raw);
    if (
      !plain(value) ||
      value.format !== format ||
      value.version !== 2 ||
      Object.keys(value).some(
        (key) =>
          !["format", "version", "token", "payload", "legacy"].includes(key),
      ) ||
      typeof value.token !== "string" ||
      !value.token ||
      value.token.length > 128
    )
      throw Error("Invalid envelope");
    return {
      format,
      version: 2,
      token: value.token,
      payload: validateTrainingBackupV2(value.payload, catalog),
      legacy: validateOriginals(value.legacy),
    };
  } catch (cause) {
    throw Object.assign(
      failure(
        "INVALID_LOCAL_V2",
        "Saved version-2 training data could not be read. Existing storage is preserved.",
      ),
      { cause },
    );
  }
}
function legacyPayload(bytes, catalog) {
  if (bytes[RESTORE_KEY] !== null)
    throw failure(
      "LEGACY_RESTORE_PENDING",
      "An earlier training restore needs recovery before upgrading. Existing storage is preserved.",
    );
  return migrateTrainingBackupV1(
    {
      format: "last-layer-training",
      version: 1,
      progress:
        bytes[STORAGE_KEY] === null
          ? emptyProgress()
          : JSON.parse(bytes[STORAGE_KEY]),
      solves: bytes[SOLVES_KEY] === null ? [] : JSON.parse(bytes[SOLVES_KEY]),
      cubeCollection:
        bytes[CUBES_KEY] === null
          ? { cubes: [], defaultId: null }
          : JSON.parse(bytes[CUBES_KEY]),
    },
    catalog,
  );
}

// Read-only guest transfer boundary. Never copy a partially applied legacy
// restore, and do not fall back to v1 if another tab adopted v2 during the read.
export function readLegacyTrainingV2(storage, catalog) {
  if (storage.getItem(RESTORE_KEY) !== null)
    throw failure(
      "LEGACY_RESTORE_PENDING",
      "Guest training has an unfinished restore. Recover it before transferring progress; both copies are preserved.",
    );
  assertLegacyTrainingWritable(storage);
  const originals = captureLegacy(storage);
  const payload = legacyPayload(originals, catalog);
  if (changedKeys(originals, captureLegacy(storage)).length)
    throw failure(
      "TRAINING_LEGACY_CONFLICT",
      "Guest training changed while it was being read. Retry after closing older tabs; both copies are preserved.",
    );
  assertLegacyTrainingWritable(storage);
  return payload;
}

// The caller supplies navigator.locks (or a deterministic lock manager in tests).
// No lock-free fallback: a synchronous read/check/set is not cross-tab CAS.
export function trainingWebLockRunner(lockManager) {
  if (!lockManager || typeof lockManager.request !== "function")
    throw failure(
      "TRAINING_LOCK_UNAVAILABLE",
      "This browser cannot safely coordinate training writes across tabs.",
    );
  return (name, operation) =>
    lockManager.request(name, { mode: "exclusive" }, operation);
}

// storage is already scoped to one guest/account/sandbox. Every writer for that
// scope must use the same lock name. A session's token detects stale local drafts.
//
// One atomic localStorage.setItem publishes the payload AND retained originals.
// There is no partially written multi-key migration to roll back: before that
// write v1 is authoritative; after it the complete v2 envelope is authoritative.
// Originals remain both in the legacy keys and inside the immutable envelope
// metadata, so later old-tab edits cannot destroy the pre-migration copy.
export function createTrainingV2Store({
  storage,
  catalog,
  scope,
  withLock,
  createToken = () => crypto.randomUUID(),
}) {
  if (typeof scope !== "string" || !scope)
    throw new TypeError("A fixed training storage scope is required.");
  if (
    !storage ||
    typeof storage.getItem !== "function" ||
    typeof storage.setItem !== "function"
  )
    throw new TypeError("Training storage is required.");
  const lockName = `last-layer.training.v2:${scope}`;
  let observedToken = null;
  let active = true;
  const requireActive = () => {
    if (!active)
      throw failure(
        "TRAINING_SCOPE_CLOSED",
        "This training source is no longer active.",
      );
  };
  const requireLock = () => {
    if (typeof withLock !== "function")
      throw failure(
        "TRAINING_LOCK_UNAVAILABLE",
        "This browser cannot safely coordinate training writes across tabs.",
      );
  };
  const token = (previous = observedToken) => {
    const result = createToken();
    if (
      typeof result !== "string" ||
      !result ||
      result.length > 128 ||
      result === previous
    )
      throw new TypeError("A fresh local training token is required.");
    return result;
  };
  function current() {
    const raw = storage.getItem(TRAINING_V2_KEY);
    return raw === null ? null : parseEnvelope(raw, catalog);
  }
  function view(envelope, migrated = false) {
    const legacyNow = captureLegacy(storage);
    const legacyChanges = changedKeys(envelope.legacy, legacyNow);
    return {
      payload: envelope.payload,
      token: envelope.token,
      migrated,
      legacyOriginals: { ...envelope.legacy },
      legacyCurrent: legacyNow,
      legacyChanges,
      legacyPristine: LEGACY_TRAINING_KEYS.every(
        (key) => envelope.legacy[key] === null,
      ),
      ready:
        active &&
        typeof withLock === "function" &&
        observedToken === envelope.token &&
        legacyChanges.length === 0,
    };
  }
  function writable(expectedToken = observedToken) {
    requireActive();
    requireLock();
    const envelope = current();
    if (!envelope)
      throw failure(
        "TRAINING_V2_NOT_OPEN",
        "Open this training source before saving.",
      );
    if (!expectedToken || expectedToken !== envelope.token)
      throw failure(
        "TRAINING_LOCAL_CONFLICT",
        "Another tab changed this training source. Keep your edits and reload the saved copy before saving.",
      );
    if (changedKeys(envelope.legacy, captureLegacy(storage)).length)
      throw failure(
        "TRAINING_LEGACY_CONFLICT",
        "An older tab changed the original training data. Both copies are preserved; review them before saving or syncing.",
      );
    return envelope;
  }
  async function locked(operation) {
    requireActive();
    requireLock();
    return withLock(lockName, () => {
      requireActive();
      return operation();
    });
  }
  return {
    lockName,
    // Read-only inspection/export remains possible when locks are unavailable or
    // an old tab diverged. Never fall back to v1 if a v2 envelope is malformed.
    inspect() {
      const envelope = current();
      return envelope ? view(envelope) : null;
    },
    async open() {
      return locked(() => {
        const saved = current();
        if (saved) {
          observedToken = saved.token;
          return view(saved);
        }
        const originals = captureLegacy(storage);
        const payload = legacyPayload(originals, catalog);
        if (changedKeys(originals, captureLegacy(storage)).length)
          throw failure(
            "TRAINING_LEGACY_CONFLICT",
            "Training changed during migration. Both sources are preserved; retry after closing older tabs.",
          );
        const envelope = {
          format,
          version: 2,
          token: token(),
          payload,
          legacy: originals,
        };
        storage.setItem(TRAINING_V2_KEY, JSON.stringify(envelope));
        observedToken = envelope.token;
        // If an old tab wrote during the atomic publish, the committed v2 copy
        // remains readable, but readiness is false and further writes stop.
        return view(envelope, true);
      });
    },
    async commit(payload, { expectedToken = observedToken } = {}) {
      // Capture/validate before waiting for a lock; caller mutation while queued
      // cannot change the candidate that was requested.
      const candidate = validateTrainingBackupV2(payload, catalog);
      return locked(() => {
        const saved = writable(expectedToken);
        const envelope = {
          ...saved,
          token: token(saved.token),
          payload: candidate,
        };
        storage.setItem(TRAINING_V2_KEY, JSON.stringify(envelope));
        observedToken = envelope.token;
        return view(envelope);
      });
    },
    assertWritable(expectedToken = observedToken) {
      writable(expectedToken);
      return true;
    },
    canWrite() {
      try {
        writable();
        return true;
      } catch {
        return false;
      }
    },
    close() {
      active = false;
    },
  };
}
