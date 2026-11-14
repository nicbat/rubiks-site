import { canonical } from "./training-merge.js";
import {
  migrateTrainingBackupV1,
  validateTrainingBackupV2,
} from "./training-v2.js";

// Explicit adaptation boundary. Production sync still uses its v1 reader until
// the complete journal/old-tab/server rollout is ready.
export function normalizeTrainingSnapshot(value, catalog) {
  return value?.version === 1
    ? migrateTrainingBackupV1(value, catalog)
    : validateTrainingBackupV2(value, catalog);
}
export async function trainingFingerprint(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical(value)),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

// Authenticate the ORIGINAL representation before migrating anything. Comparing
// an old fingerprint with a v2 payload would discard a valid deletion baseline.
export async function readTrainingBaseline(metadata, catalog) {
  if (
    !metadata ||
    !Number.isSafeInteger(metadata.revision) ||
    metadata.revision < 1 ||
    !/^[a-f0-9]{64}$/.test(metadata.fingerprint) ||
    !metadata.payload
  )
    return null;
  // Capture a detached JSON value before awaiting so a caller cannot replace the
  // payload between authentication and normalization.
  let original;
  try {
    original = JSON.parse(JSON.stringify(metadata.payload));
  } catch {
    return null;
  }
  const sourceFingerprint = metadata.fingerprint;
  const revision = metadata.revision;
  if ((await trainingFingerprint(original)) !== sourceFingerprint) return null;
  let payload;
  try {
    payload = normalizeTrainingSnapshot(original, catalog);
  } catch {
    return null;
  }
  return {
    revision,
    payload,
    fingerprint: await trainingFingerprint(payload),
    sourceFingerprint,
    sourceVersion: original.version,
  };
}

// All three merge participants enter the same schema. Keep the remote wire
// version separately so equal normalized data still gets one schema-only CAS.
export async function prepareTrainingReconciliation(
  { metadata, device, cloud },
  catalog,
) {
  const normalizedDevice = normalizeTrainingSnapshot(device, catalog);
  const normalizedCloud =
    cloud == null ? null : normalizeTrainingSnapshot(cloud, catalog);
  const cloudNeedsUpgrade = cloud?.version === 1;
  return {
    baseline: await readTrainingBaseline(metadata, catalog),
    device: normalizedDevice,
    cloud: normalizedCloud,
    cloudNeedsUpgrade,
  };
}
