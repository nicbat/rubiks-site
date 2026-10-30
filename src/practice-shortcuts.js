// Keyboard policy stays independent of the DOM. The controller supplies whether
// a dialog/selector or editable control currently owns keyboard input.
function blocked(event, session) {
  return (
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey ||
    event.blocked ||
    event.editable ||
    session?.mode !== "recognition"
  );
}

export function practiceRatingKey(event, session) {
  if (blocked(event, session) || session.stage !== "answer") return null;
  if (!["1", "2", "3"].includes(event.key)) return null;
  const result = { 1: "help", 2: "effort", 3: "confident" }[event.key];
  return result && (!session.hinted || result === "help") ? result : null;
}

export function practiceShortcut(event, session) {
  if (blocked(event, session)) return null;
  if (session.stage === "setup") {
    if (event.key === "r") return { action: "finished" };
    if (event.key === "h") return { action: "hint" };
  }
  const result = practiceRatingKey(event, session);
  return result ? { action: "rate", result } : null;
}
