import { validateBackup, trainingBackup } from "./training-backup.js";
import { canonical } from "./training-merge.js";

// File-scoped identities make retries of legacy backups safe. Do not guess that
// matching timestamps/results from different files are the same practice event.
export async function prepareBackupImport(value, catalog) {
  const backup = validateBackup(value, catalog);
  const legacy = backup.progress.attempts.filter((a) => !a.id).length;
  if (legacy) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(canonical(backup.progress)),
    );
    const hash = Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const ids = new Set(backup.progress.attempts.map((a) => a.id));
    backup.progress.attempts.forEach((a, i) => {
      if (a.id) return;
      let id = `backup-${hash}-${i}`;
      while (ids.has(id)) id += "-legacy";
      a.id = id;
      ids.add(id);
    });
  }
  return { ...backup, legacyAttempts: legacy };
}

export function trainingCounts(data) {
  return {
    attempts: data.progress.attempts.length,
    selected: data.progress.selected.length,
    reviewed: data.progress.reviewed?.length || 0,
    known: new Set(
      ["known", "twoLookKnown"].flatMap((field) =>
        Object.entries(data.progress[field] || {}).flatMap(([id, variants]) =>
          variants.map((variant) => `${id}:${variant}`),
        ),
      ),
    ).size,
    solves: data.solves?.length || 0,
    cubes: data.cubeCollection?.cubes.length || 0,
  };
}

// An explicit import adds information; unlike sync it never interprets absence
// as deletion or fills fields on an existing record from an older backup.
export function mergeBackup(current, incoming, catalog) {
  const left = validateBackup(current, catalog);
  const right = validateBackup(
    incoming.format
      ? incoming
      : incoming.solves
        ? trainingBackup(
            incoming.progress,
            incoming.solves,
            incoming.cubeCollection,
          )
        : incoming.progress || incoming,
    catalog,
  );
  let duplicates = 0,
    conflicts = 0;
  const union = (a = [], b = []) => [...new Set([...a, ...b])];
  function records(a, b) {
    if (a.some((record) => !record.id))
      throw Error("Prepare legacy practice history before merging.");
    const ids = new Map(a.map((record) => [record.id, record]));
    for (const record of b) {
      if (!record.id)
        throw Error("Prepare legacy practice history before merging.");
      if (ids.has(record.id)) {
        duplicates++;
        if (canonical(ids.get(record.id)) !== canonical(record)) conflicts++;
      } else ids.set(record.id, record);
    }
    return [...ids.values()];
  }
  const a = left.progress,
    b = right.progress;
  const progress = {
    ...b,
    ...a,
    selected: union(a.selected, b.selected),
    variants: { ...b.variants, ...a.variants },
    attempts: records(a.attempts, b.attempts),
  };
  for (const field of ["known", "twoLookKnown"])
    if (a[field] || b[field])
      progress[field] = Object.fromEntries(
        union(Object.keys(a[field] || {}), Object.keys(b[field] || {})).map(
          (id) => [id, union(a[field]?.[id], b[field]?.[id])],
        ),
      );
  if (a.reviewed || b.reviewed)
    progress.reviewed = union(a.reviewed, b.reviewed);
  if (a.resume || b.resume) progress.resume = { ...b.resume, ...a.resume };
  if (a.transfers || b.transfers)
    progress.transfers = [
      ...new Map(
        [...(a.transfers || []), ...(b.transfers || [])].map((t) => [
          canonical(t),
          t,
        ]),
      ).values(),
    ];
  let candidate = progress;
  if (right.solves) {
    if (!left.solves)
      throw Error(
        "Current solves and cubes are needed to merge a full backup.",
      );
    candidate = trainingBackup(progress, records(left.solves, right.solves), {
      cubes: records(left.cubeCollection.cubes, right.cubeCollection.cubes),
      defaultId: left.cubeCollection.defaultId,
    });
  }
  const backup = validateBackup(candidate, catalog);
  const before = trainingCounts(left),
    after = trainingCounts(backup);
  const added = Object.fromEntries(
    Object.keys(before).map((key) => [
      key,
      key === "solves" || key === "cubes"
        ? right.solves
          ? after[key] - before[key]
          : 0
        : after[key] - before[key],
    ]),
  );
  return { backup, summary: { before, added, duplicates, conflicts } };
}

export function hasUnmergedGuestProgress(current, guest, catalog) {
  return Object.values(mergeBackup(current, guest, catalog).summary.added).some(
    (count) => count > 0,
  );
}
