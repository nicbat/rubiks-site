import { trainingBackup, validateBackup } from "./training-backup.js";
import { canonical, mergeTraining } from "./training-merge.js";
export { canonical } from "./training-merge.js";

export const SYNC_KEY = "last-layer.sync.v1";

async function fingerprint(value) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical(value)),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export function cloudBackup(value, catalog) {
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
}) {
  let active = true;
  let running = false;
  let status = "idle";
  let message = "Saved on this device.";
  let conflict = null;
  let retry = false;
  function publish(next, text, shouldRetry = false) {
    status = next;
    message = text;
    retry = shouldRetry;
    changed();
  }
  function local() {
    return cloudBackup(read(), catalog);
  }
  function metadata() {
    const raw = storage.getItem(SYNC_KEY);
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
    storage.setItem(
      SYNC_KEY,
      JSON.stringify({ revision, fingerprint: hash, payload }),
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
      };
    },
    cancel() {
      active = false;
      remote.cancel?.();
    },
    async sync(choice) {
      if (!active || running) return;
      running = true;
      publish("syncing", "Syncing…");
      try {
        const initial = local();
        const initialHash = await fingerprint(initial);
        const base = metadata();
        let baseline = null;
        if (base?.payload) {
          try {
            const valid = cloudBackup(base.payload, catalog);
            if ((await fingerprint(valid)) === base.fingerprint)
              baseline = valid;
          } catch {
            /* Unknown baseline requires explicit reconciliation. */
          }
        }
        const pristine = !base && isPristine();
        if (!active) return;
        const row = await remote.read();
        if (!active) return;
        if (row && (!Number.isSafeInteger(row.revision) || row.revision < 1))
          throw Error("Cloud revision is invalid.");
        const cloud = row ? cloudBackup(row.payload, catalog) : null;
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
          remember(row.revision, initialHash, initial);
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
          const target = cloudBackup(merged.value, catalog);
          const targetHash = await fingerprint(target);
          const needsReplace = targetHash !== initialHash;
          if (!active) return;
          if (
            needsReplace &&
            (!canReplace() || canonical(initial) !== canonical(local()))
          ) {
            publish("pending", "Finish the current activity, then sync again.");
            return;
          }
          const revision =
            targetHash === cloudHash
              ? row.revision
              : await remote.write(target, row.revision);
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
          // Never turn remote additions into apparent local deletions if the
          // user edited during upload: retain the old baseline and retry.
          if (
            needsReplace &&
            (!canReplace() || canonical(initial) !== canonical(local()))
          ) {
            publish("pending", "New device changes are waiting to sync.", true);
            return;
          }
          if (needsReplace) replace(target);
          savedHash = targetHash;
          remember(revision, targetHash, target);
        } else if (
          (resolved && choice === "cloud") ||
          (cloud && base && initialHash === base.fingerprint) ||
          (cloud && pristine && isPristine())
        ) {
          if (!canReplace() || canonical(initial) !== canonical(local())) {
            publish("pending", "Finish the current activity, then sync again.");
            return;
          }
          if (!active) return;
          savedHash = cloudHash;
          replace(cloud);
          remember(row.revision, cloudHash, cloud);
        } else if (
          (!row && !base) ||
          (row && base?.revision === row.revision) ||
          (resolved && choice === "device")
        ) {
          // Server compare-and-swap is still required after this read.
          const revision = await remote.write(initial, row?.revision ?? 0);
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
        else publish("synced", "Synced.");
      } catch {
        if (active)
          publish(
            "error",
            "Sync could not finish. Your device data is kept. Check your connection and try again.",
          );
      } finally {
        running = false;
      }
    },
  };
}
