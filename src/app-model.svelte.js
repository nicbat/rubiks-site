let snapshot = $state.raw(null);
export const appModel = {
  get snapshot() {
    return snapshot;
  },
  set snapshot(next) {
    snapshot = next;
  },
};

export const liveClock = $state({ text: "" });
export const commandState = $state({ open: false, query: "" });
