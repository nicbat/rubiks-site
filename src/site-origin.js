import { validateBackup } from "./training-backup.js";

export const CANONICAL_ORIGIN = "https://lastlayer.net";
export const recoveryLinks = [
  "https://cube.nicbat.com",
  "https://www.lastlayer.net",
].map((origin) => ({
  label: new URL(origin).hostname,
  href: `${origin}/?recover-origin=1`,
}));

export function originRecovery(href) {
  const from = new URL(href);
  if (from.searchParams.get("recover-origin") !== "1") return null;
  const to = new URL(CANONICAL_ORIGIN);
  from.searchParams.delete("recover-origin");
  to.pathname = from.pathname;
  to.search = from.search;
  to.hash = from.hash;
  return { hostname: from.hostname, canonicalHref: to.href };
}

export function earlierLearningBackup(storage, catalog) {
  const raw = storage.getItem("last-layer.progress.v1");
  if (raw === null)
    throw Error("No earlier learning data was found at this address.");
  const value = JSON.parse(raw);
  if (value?.format !== undefined || value?.version !== 1)
    throw Error(
      "Earlier learning data could not be read. Its stored copy is kept.",
    );
  return validateBackup(value, catalog).progress;
}
