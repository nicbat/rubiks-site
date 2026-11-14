// One outstanding full-envelope transaction per view. Do not queue captured full
// snapshots: a later snapshot could erase an earlier transaction's changes.
export function createTrainingV2Writer({ session, isCurrent = () => true }) {
  let pending = false;
  return {
    get pending() {
      return pending;
    },
    async commit(candidate) {
      if (pending)
        throw Error("A save is still in progress. Retry this change.");
      if (!isCurrent()) throw Error("Training source changed. Try again.");
      pending = true;
      try {
        const result = await session.commit(candidate);
        if (!isCurrent())
          throw Error(
            "Training source changed; the original source keeps its saved data.",
          );
        return result;
      } finally {
        pending = false;
      }
    },
  };
}
