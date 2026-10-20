import { dayKey, emptyProgress, setKnown } from "./progress.js";
import { twoLookCases } from "./learning-methods.js";
import { generateScramble } from "./solve-timer.js";
import { trainingBackup } from "./training-backup.js";

// Fixed seed and local calendar arithmetic keep fixtures repeatable across DST.
export function createTestData(catalog, now = new Date()) {
  let seed = 20261017;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const pick = (length) => Math.floor(random() * length);
  const progress = emptyProgress();
  progress.activeCourse = "cfop";
  progress.resume = { cfop: "full-pll" };
  progress.reviewed = ["cross", "f2l"];
  catalog.forEach((c, i) => {
    progress.variants[c.id] = i % 5 === 0 ? c.algorithms.length - 1 : 0;
    if (i % 6 !== 4) progress.selected.push(c.id);
    if (i % 6 === 0) setKnown(progress, c.id, progress.variants[c.id], true);
  });
  const cubeCollection = {
    defaultId: "test-main",
    cubes: [
      {
        id: "test-main",
        name: "Main 3×3",
        description: "Magnetic daily driver",
      },
      {
        id: "test-travel",
        name: "Travel cube",
        description: "Practice on the go",
      },
      { id: "test-backup", name: "Backup 3×3", description: "Looser setup" },
      {
        id: "test-retired",
        name: "First cube",
        description: "",
        deleted: true,
      },
    ],
  };
  const solves = [];
  const practiceCases = catalog.filter((_, i) => [0, 1, 2, 5].includes(i % 6));
  for (let ago = 547; ago >= 0; ago--) {
    // Rest days and a longer break give the heatmap several activity densities.
    if (ago !== 0 && ((ago >= 160 && ago <= 175) || random() < 0.24)) continue;
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - ago,
    );
    const end =
      ago === 0
        ? now
        : new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
    const day = dayKey(start);
    const stamp = (i, count) =>
      new Date(
        +start + Math.floor(((+end - +start) * (i + 1)) / (count + 1)),
      ).toISOString();
    const count = ago === 0 ? 36 : 3 + pick(43);
    for (let i = 0; i < count; i++) {
      const penalty = random();
      const cubeId =
        ago > 390
          ? "test-retired"
          : ["test-main", "test-main", "test-travel", "test-backup", null][
              pick(5)
            ];
      solves.push({
        id: `test-solve-${ago}-${i}`,
        cubeId,
        // A slow improvement with session variation, occasional long solves and PBs.
        elapsed: Math.round(
          (19 +
            (25 * ago) / 547 +
            random() * 16 +
            (random() < 0.025 ? 65 : 0)) *
            1000,
        ),
        date: stamp(i, count),
        day,
        scramble: generateScramble(pick),
        ...(penalty < 0.035
          ? { penalty: "dnf" }
          : penalty < 0.09
            ? { penalty: "+2" }
            : {}),
        ...(i % 13 === 0
          ? {
              notes: [
                "Smooth F2L; paused before PLL.",
                "Cross planned before starting.\nTry fewer rotations next time.",
                "Lost the pair at the back.",
              ][pick(3)],
            }
          : {}),
      });
    }
    const attempts = ago === 0 ? practiceCases.length : 2 + pick(19);
    for (let i = 0; i < attempts; i++) {
      const c =
        ago === 0
          ? practiceCases[i]
          : practiceCases[pick(practiceCases.length)];
      const bucket = catalog.indexOf(c) % 6;
      progress.attempts.push({
        id: `test-attempt-${ago}-${i}`,
        caseId: c.id,
        variant: progress.variants[c.id],
        mode: i % 5 === 0 && bucket !== 2 ? "rehearsal" : "recognition",
        result: bucket === 2 ? ["help", "effort"][pick(2)] : "confident",
        method:
          twoLookCases.includes(c.id) && random() < 0.3 ? "two-look" : "full",
        at: stamp(i, attempts),
        day,
      });
    }
  }
  return trainingBackup(progress, solves, cubeCollection);
}
