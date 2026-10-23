import { activitySummary } from "./dashboard.js";
import { moduleById, moduleCases } from "./courses.js";
import { methodGroups } from "./learning-methods.js";

// Both Account and detailed Progress consume the render's one progress index.
export function accountOverview(model, today) {
  const { state, catalog, status, progressIndex } = model;
  const scope = moduleById(state.activeModule);
  const cases =
    scope?.kind === "algorithms"
      ? moduleCases(scope, catalog)
      : ["OLL", "PLL"].flatMap((section) =>
          methodGroups(catalog, section, state.method || "full").flatMap(
            (g) => g.cases,
          ),
        );
  return {
    cases,
    confident: cases.filter((c) => status(c).label === "Confident").length,
    known: cases.filter((c) => status(c).label === "Already known").length,
    activity: activitySummary(
      progressIndex.dailyActivity(),
      state.solves || [],
      {
        today,
        range: state.dashboard?.range || "30",
      },
    ),
  };
}

export function trainingSourceLabel(account, demo) {
  return demo
    ? "Demo training · changes stay in this tab"
    : account?.email
      ? "Account training"
      : "Guest training · this device";
}
