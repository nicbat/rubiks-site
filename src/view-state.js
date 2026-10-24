// Publish fresh reactive boundaries without copying the potentially large history.
// Views only read these inputs. Controllers mutate domain state and publish again;
// the progress index consumes attempts once per render, never once per component.
export function snapshotViewState(state) {
  return {
    ...state,
    progress: { ...state.progress },
    preferences: { ...state.preferences },
    solves: state.solves.map((solve) => ({ ...solve })),
    session: state.session && { ...state.session },
    practicePicker: state.practicePicker && { ...state.practicePicker },
    bulkEdit: state.bulkEdit && { ...state.bulkEdit },
    timerBulkEdit: state.timerBulkEdit && { ...state.timerBulkEdit },
    pllQuiz: state.pllQuiz && {
      ...state.pllQuiz,
      question: { ...state.pllQuiz.question },
    },
  };
}
