// Saved changes start on the next microtask, after the controller commits its
// state. Coalesce same-turn saves and drain changes made during an upload.
export function createSyncQueue(engine) {
  let active = true,
    dirty = false,
    pendingChoice,
    task = null;
  function request(choice) {
    if (!active) return Promise.resolve();
    dirty = true;
    if (choice) pendingChoice = choice;
    if (!task) {
      task = Promise.resolve()
        .then(async () => {
          let retries = 0;
          while (active && dirty) {
            dirty = false;
            const choice = pendingChoice;
            pendingChoice = undefined;
            await engine.sync(choice);
            if (!active) break;
            const state = engine.snapshot;
            if (["error", "conflict"].includes(state.status)) {
              dirty = false;
              break;
            }
            if (dirty) retries = 0;
            else if (state.retry && retries < 2) {
              dirty = true;
              retries++;
            }
          }
          // Automatic contention retries are bounded; real saves always drain.
        })
        .finally(() => {
          task = null;
          if (dirty && active) void request();
        });
    }
    return task;
  }
  return {
    request,
    cancel() {
      active = dirty = false;
      pendingChoice = undefined;
      engine.cancel();
    },
  };
}
