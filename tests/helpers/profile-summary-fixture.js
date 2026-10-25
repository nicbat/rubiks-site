import { emptyProgress } from "../../src/progress.js";
import { trainingBackup } from "../../src/training-backup.js";

export function summaryFixture() {
  const progress = emptyProgress();
  // Distinct local dates count; rehearing and repeat same-day successes do not
  // manufacture confidence. Current variants and explicit known marks matter.
  progress.variants = { "pll-Ub": 1 };
  progress.known = { "pll-H": [0] };
  const attempt = (caseId, day, result = "confident", extra = {}) => ({
    caseId,
    variant: 0,
    mode: "recognition",
    result,
    day: `2026-10-${String(day).padStart(2, "0")}`,
    at: `2026-10-${String(day).padStart(2, "0")}T12:00:00Z`,
    ...extra,
  });
  progress.attempts = [
    ...[1, 2, 3].flatMap((d) => [
      attempt("pll-Ua", d),
      attempt("pll-Ub", d),
      attempt("pll-H", d),
      attempt("oll-2", d, "confident", { method: "two-look" }),
      attempt("pll-T", d),
    ]),
    attempt("pll-Ua", 3),
    attempt("pll-T", 4, "effort"),
    attempt("pll-T", 5),
    attempt("pll-T", 6),
    attempt("pll-Z", 7, "confident", { mode: "rehearsal" }),
  ];
  const solves = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((n) => ({
    id: `public-solve-${n}`,
    elapsed: n * 1000,
    date: `2026-10-08T00:00:${String(n).padStart(2, "0")}Z`,
    day: "2026-10-07",
    scramble: Array(10).fill("R U").join(" "),
    notes: "private summary canary",
    ...(n === 1 ? { penalty: "+2" } : n >= 13 ? { penalty: "dnf" } : {}),
  }));
  return trainingBackup(progress, solves, { cubes: [], defaultId: null });
}
