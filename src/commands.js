export const commands = [
  ["My learning", "home"],
  ["Courses", "courses"],
  ["Beginner · Start learning", "courses/beginner/beginner-introduction"],
  ["Progress", "progress"],
  ["Find a learner", "people"],
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
  ["Account settings", "account"],
  ["My profile", "account/profile"],
  ["Edit profile", "account/profile/edit"],
  ["Sync status", "sync"],
  ["Data & backups", "data"],
  ["Backup & transfer", "backup"],
];
// Keep the existing order-independent word search within Command's filtering API.
export function commandFilter(label, query) {
  const words = query.toLowerCase().trim().split(/\s+/);
  return words.every((word) => label.toLowerCase().includes(word)) ? 1 : 0;
}
