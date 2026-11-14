import { trainingBackup, validateBackup } from "./training-backup.js";
import { canonical, mergeTraining } from "./training-merge.js";
import {
  normalizeTrainingSnapshot,
  readTrainingBaseline,
} from "./training-schema.js";
export { canonical } from "./training-merge.js";

export const SYNC_KEY = "last-layer.sync.v1";
export const SYNC_V2_KEY = "last-layer.sync.v2";

async function fingerprint(value) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical(value)),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export function cloudBackup(value, catalog, { version = 1 } = {}) {
  if (version === 2) return normalizeTrainingSnapshot(value, catalog);
  if (version !== 1) throw Error("Unsupported sync schema version.");
  if (value?.format !== "last-layer-training" || value.version !== 1)
    throw Error("Cloud data is not a full training backup.");
  const valid = validateBackup(value, catalog);
  return trainingBackup(valid.progress, valid.solves, valid.cubeCollection);
}

// One operation at a time. The caller owns a fixed account/storage scope and
// cancels it before switching identities or entering the test-data sandbox.
export function createCloudSync({
  remote,
  storage,
  read,
  replace,
  catalog,
  changed = () => {},
  canReplace = () => true,
  isPristine = () => false,
  schemaVersion = 1,
  canWriteV2 = () => false,
}) {
  if (![1, 2].includes(schemaVersion))
    throw Error("Unsupported sync schema version.");
  const syncKey = schemaVersion === 2 ? SYNC_V2_KEY : SYNC_KEY;
  const validate = (value) =>
    cloudBackup(value, catalog, { version: schemaVersion });
  let active = true;
  let running = false;
  let status = "idle";
  let message = "Saved on this device.";
  let conflict = null;
  let retry = false;
  let pendingReason = null,
    failure = null,
    result = null;
  function publish(next, text, shouldRetry = false, reason = null) {
    status = next;
    message = text;
    retry = shouldRetry;
    pendingReason = reason;
    changed();
  }
  function localOperation(operation) {
    try {
      return operation();
    } catch (cause) {
      throw Object.assign(Error("Device data is unavailable."), {
        code: "LOCAL_STORAGE",
        cause,
      });
    }
  }
  async function localAsyncOperation(operation) {
    try {
      return await operation();
    } catch (cause) {
      throw Object.assign(Error("Device data is unavailable."), {
        code: "LOCAL_STORAGE",
        cause,
      });
    }
  }
  function local() {
    return localOperation(() => validate(read()));
  }
  function metadata() {
    const raw = localOperation(
      () =>
        storage.getItem(syncKey) ??
        (schemaVersion === 2 ? storage.getItem(SYNC_KEY) : null),
    );
    if (!raw) return null;
    // Damaged bookkeeping means the baseline is unknown. Different copies
    // still require a choice; storage access failures must still stop sync.
    try {
      const value = JSON.parse(raw);
      if (
        !Number.isSafeInteger(value.revision) ||
        value.revision < 1 ||
        !/^[a-f0-9]{64}$/.test(value.fingerprint)
      )
        return null;
      return value;
    } catch {
      return null;
    }
  }
  function remember(revision, hash, payload) {
    assertV2Ready();
    localOperation(() =>
      storage.setItem(
        syncKey,
        JSON.stringify({ revision, fingerprint: hash, payload }),
      ),
    );
  }
  function assertV2Ready() {
    if (schemaVersion === 2 && localOperation(canWriteV2) !== true)
      throw Object.assign(Error("Version-2 sync is not ready."), {
        code: "SCHEMA_NOT_READY",
      });
  }
  async function write(payload, revision) {
    assertV2Ready();
    return remote.write(payload, revision);
  }
  function staleRevision() {
    conflict = null;
    publish(
      "pending",
      "Another device saved changes. Latest changes are waiting to sync.",
      true,
    );
  }
  return {
    get snapshot() {
      return {
        status,
        message,
        conflict: Boolean(conflict),
        mergeConflict: Boolean(conflict?.merge),
        retry,
        pendingReason,
        failure,
        result,
      };
    },
    cancel() {
      active = false;
      remote.cancel?.();
    },
    async sync(choice) {
      if (!active || running) return;
      running = true;
      failure = result = null;
      publish("syncing", "Syncing…");
      try {
        const initial = local();
        const initialHash = await fingerprint(initial);
        const base = metadata();
        let baseline = null;
        let baselineHash = base?.fingerprint;
        if (base?.payload) {
          try {
            if (schemaVersion === 2) {
              const authenticated = await readTrainingBaseline(base, catalog);
              baseline = authenticated?.payload ?? null;
              baselineHash = authenticated?.fingerprint;
            } else if ((await fingerprint(base.payload)) === base.fingerprint) {
              baseline = validate(base.payload);
              baselineHash = await fingerprint(baseline);
            }
          } catch {
            /* Unknown baseline requires explicit reconciliation. */
          }
        }
        if (schemaVersion === 2 && !baseline) baselineHash = undefined;
        const pristine = !base && isPristine();
        if (!active) return;
        const row = await remote.read();
        if (!active) return;
        if (row && (!Number.isSafeInteger(row.revision) || row.revision < 1))
          throw Error("Cloud revision is invalid.");
        const cloud = row ? validate(row.payload) : null;
        const cloudNeedsUpgrade =
          schemaVersion === 2 && row?.payload.version === 1;
        const cloudHash = cloud ? await fingerprint(cloud) : null;
        if (!active) return;
        // A choice applies only to the exact cloud revision shown to the user.
        const resolved =
          choice && conflict && conflict.revision === (row?.revision ?? 0);
        if (choice && !resolved) {
          conflict = { revision: row?.revision ?? 0 };
          publish(
            "conflict",
            "Cloud data changed again. Choose which copy to keep.",
          );
          return;
        }
        let savedHash = initialHash;
        if (initialHash === cloudHash) {
          const revision = cloudNeedsUpgrade
            ? await write(initial, row.revision)
            : row.revision;
          if (!active) return;
          if (!Number.isSafeInteger(revision) || revision < 1) {
            staleRevision();
            return;
          }
          remember(revision, initialHash, initial);
        } else if (cloud && baseline) {
          const merged = mergeTraining(
            baseline,
            initial,
            cloud,
            resolved ? choice : undefined,
          );
          if (merged.conflicts.length && !resolved) {
            conflict = { revision: row.revision, merge: true };
            publish(
              "conflict",
              `${merged.conflicts.length} conflicting edit${merged.conflicts.length === 1 ? " needs" : "s need"} a choice. Other changes will be combined.`,
            );
            return;
          }
          const target = validate(merged.value);
          const targetHash = await fingerprint(target);
          const needsReplace = targetHash !== initialHash;
          if (!active) return;
          const revision =
            targetHash === cloudHash && !cloudNeedsUpgrade
              ? row.revision
              : await write(target, row.revision);
          if (!active) return;
          if (!Number.isSafeInteger(revision) || revision < 1) {
            conflict = null;
            publish(
              "pending",
              "Another device saved changes. Latest changes are waiting to sync.",
              true,
            );
            return;
          }
          // Upload committed work even while an activity protects the UI.
          // Checkpoint the local version that contributed to this upload, not
          // the unseen merged result. Later local edits/deletions then compare
          // against their acknowledged version without deleting remote additions.
          if (
            needsReplace &&
            (!canReplace() || canonical(initial) !== canonical(local()))
          ) {
            remember(revision, initialHash, initial);
            conflict = null;
            publish(
              "pending",
              "Updates will apply after the current activity.",
              canReplace(),
              "incoming",
            );
            return;
          }
          if (needsReplace) {
            assertV2Ready();
            await localAsyncOperation(() => replace(target));
          }
          if (!active) return;
          savedHash = targetHash;
          remember(revision, targetHash, target);
        } else if (
          (resolved && choice === "cloud") ||
          (cloud && base && initialHash === baselineHash) ||
          (cloud && pristine && isPristine())
        ) {
          if (!canReplace() || canonical(initial) !== canonical(local())) {
            publish(
              "pending",
              "Updates will apply after the current activity.",
              false,
              "incoming",
            );
            return;
          }
          if (!active) return;
          const revision = cloudNeedsUpgrade
            ? await write(cloud, row.revision)
            : row.revision;
          if (!active) return;
          if (!Number.isSafeInteger(revision) || revision < 1) {
            staleRevision();
            return;
          }
          if (!canReplace() || canonical(initial) !== canonical(local())) {
            publish(
              "pending",
              "Updates will apply after the current activity.",
              false,
              "incoming",
            );
            return;
          }
          savedHash = cloudHash;
          assertV2Ready();
          await localAsyncOperation(() => replace(cloud));
          if (!active) return;
          remember(revision, cloudHash, cloud);
        } else if (
          (!row && !base) ||
          (row && base?.revision === row.revision) ||
          (resolved && choice === "device")
        ) {
          // Server compare-and-swap is still required after this read.
          const revision = await write(initial, row?.revision ?? 0);
          if (!active) return;
          if (!Number.isSafeInteger(revision) || revision < 1) {
            conflict = null;
            publish(
              "pending",
              "Another device saved changes. Latest changes are waiting to sync.",
              true,
            );
            return;
          }
          remember(revision, initialHash, initial);
        } else {
          conflict = { revision: row?.revision ?? 0 };
          publish(
            "conflict",
            "This device and cloud have different data. Choose which copy to keep. Export a backup first if you need both.",
          );
          return;
        }
        conflict = null;
        const currentHash = await fingerprint(local());
        if (!active) return;
        if (savedHash !== currentHash)
          publish("pending", "New device changes are waiting to sync.", true);
        else {
          result =
            initialHash === cloudHash && !cloudNeedsUpgrade
              ? "unchanged"
              : "updated";
          publish("synced", "Synced.");
        }
      } catch (error) {
        if (error.code === "SCHEMA_NOT_READY") {
          if (active)
            publish(
              "pending",
              "Sync is waiting for the training data upgrade.",
              false,
              "schema",
            );
          return;
        }
        failure =
          error.code === "LOCAL_STORAGE"
            ? "local"
            : error.code === "AUTH_REQUIRED" || error.status === 401
              ? "auth"
              : [400, 413, 422].includes(error.status)
                ? "rejected"
                : "connection";
        if (active)
          publish(
            "error",
            failure === "local"
              ? "Device data could not be read or saved. Keep this tab open and export a backup before reloading."
              : failure === "auth"
                ? "Sign in again to resume sync. Your device data is kept."
                : failure === "rejected"
                  ? "The server rejected this backup. Export your device data before changing it; cloud snapshots are limited to 20 MB."
                  : "Sync could not finish. Your device data is kept. Check your connection and try again.",
          );
      } finally {
        running = false;
      }
    },
  };
}
