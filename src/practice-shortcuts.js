// Keyboard policy stays independent of the DOM. The controller supplies whether
// a dialog/selector or editable control currently owns keyboard input.
export function practiceRatingKey(event, session) {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey ||
    event.blocked ||
    event.editable ||
    session?.mode !== "recognition" ||
    session.stage !== "answer"
  )
    return null;
  if (!["1", "2", "3"].includes(event.key)) return null;
  const result = { 1: "help", 2: "effort", 3: "confident" }[event.key];
  return result && (!session.hinted || result === "help") ? result : null;
}
