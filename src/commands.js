export const commands = [
  ["My learning", "home"],
  ["Courses", "courses"],
  ["Account", "account"],
  ["Progress", "account/progress"],
  ["Profile settings", "account/profile"],
  ["Sync and data", "account/sync"],
  ["People", "people"],
  ["Timer", "timer"],
  ["Cubes", "cubes"],
  ["CFOP · Cross", "cfop/cross"],
  ["CFOP · F2L", "cfop/f2l"],
  ...["OLL", "PLL"].flatMap((section) => [
    ...["Two-look", "Full"].map((method) => [
      `CFOP · ${section} · ${method}`,
      `cfop/${section.toLowerCase()}/${method.toLowerCase()}`,
    ]),
    [`Algorithm library · ${section}`, `library/${section.toLowerCase()}/full`],
  ]),
  ...["Cross", "F2L", "Notation"].map((section) => [
    `Guides · ${section}`,
    `guides/${section.toLowerCase()}`,
  ]),
  ["Settings", "settings"],
  ["Backup & transfer", "backup"],
];
// Keep the existing order-independent word search within Command's filtering API.
export function commandFilter(label, query) {
  const words = query.toLowerCase().trim().split(/\s+/);
  return words.every((word) => label.toLowerCase().includes(word)) ? 1 : 0;
}
