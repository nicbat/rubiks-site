import catalog from "../public/pfps/catalog.json" with { type: "json" };
export const profilePictures = catalog;
export const DEFAULT_AVATAR_ID = "cube";
// Resolve only bundled choices. Saved IDs never become paths or external URLs.
export function profilePicture(id) {
  const picture =
    catalog.find((item) => item.id === id) ||
    catalog.find((item) => item.id === DEFAULT_AVATAR_ID);
  return { ...picture, src: `/pfps/${picture.file}` };
}
