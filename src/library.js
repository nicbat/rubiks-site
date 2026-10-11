import { methodGroups } from "./learning-methods.js";

export function libraryGroups(
  catalog,
  { section, method = "full", group = "all", query = "" },
) {
  return methodGroups(catalog, section, method)
    .map((entry, index) => ({
      ...entry,
      index,
      cases: entry.cases.filter(
        (c) =>
          (group === "all" || group === entry.name) &&
          `${c.name} ${c.group} ${entry.name}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    }))
    .filter((entry) => entry.cases.length);
}
