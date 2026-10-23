// Development defaults never override a production build or save a preference.
export function developmentTestData(saved, development, mode, search) {
  if (!development) return saved;
  const override = new URLSearchParams(search).get("demo");
  if (override === "1" || override === "0") return override === "1";
  if (mode === "demo") return true;
  if (mode === "backend" || mode === "guest") return false;
  return saved;
}
