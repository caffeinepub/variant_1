// ============================================================
// WORK & TIME SOLVER
// Handles: two/three workers together, pipes & cisterns
// ============================================================

import type { WorkTimeParams } from "../aiParser";
import type { ModeConstraint, SolveResult } from "./types";
import { fmtRaw, lcm, snapToMode } from "./utils";

export function solveWorkTime(
  params: WorkTimeParams,
  c: ModeConstraint,
): SolveResult {
  const { workers, pipe_fill, pipe_empty } = params;

  if (pipe_fill !== undefined && pipe_empty !== undefined) {
    return solvePipeCistern(pipe_fill, pipe_empty, c);
  }

  if (workers.length < 2) {
    return solveOneWorker(workers[0]?.time ?? 10, c);
  }

  // For integer mode, use pairs with known integer results
  if (c.mode === "integer") {
    return solveIntegerTogether(workers, c);
  }

  // Fraction / Decimal mode
  const rates = workers.map((w) => (w.time > 0 ? 1 / w.time : 0));
  const totalRate = rates.reduce((s, r) => s + r, 0);
  const together = 1 / totalRate;
  const correct = snapToMode(together, c);

  return {
    correct,
    distractors: dedup(
      [
        snapToMode(
          workers.reduce((s, w) => s + w.time, 0),
          c,
        ), // sum of times
        snapToMode(
          workers.map((w) => w.time).reduce((a, b) => a + b) / workers.length,
          c,
        ), // average
        snapToMode(correct * 1.5, c),
      ],
      correct,
      c,
    ),
    unit: "days",
    solution: buildWorkTimeSolution(workers, together, c),
  };
}

function solveIntegerTogether(
  workers: { name: string; time: number }[],
  c: ModeConstraint,
): SolveResult {
  // Find LCM of worker times → integer work unit
  let l = workers[0]?.time ?? 6;
  for (let i = 1; i < workers.length; i++) {
    l = lcm(l, workers[i].time);
  }
  // Rates in LCM units per day
  const ratesLCM = workers.map((w) => l / w.time);
  const totalRateLCM = ratesLCM.reduce((s, r) => s + r, 0);

  if (totalRateLCM === 0) {
    return solveOneWorker(workers[0]?.time ?? 10, c);
  }

  // together = LCM / totalRateLCM
  const togetherExact = l / totalRateLCM;
  const correct = snapToMode(togetherExact, c);

  return {
    correct,
    distractors: dedup(
      [
        snapToMode(
          workers.reduce((s, w) => s + w.time, 0),
          c,
        ), // sum (wrong)
        snapToMode(l / ratesLCM[0], c), // only first person
        snapToMode(correct + 1, c),
      ],
      correct,
      c,
    ),
    unit: "days",
    solution: buildWorkTimeSolution(workers, togetherExact, c),
  };
}

function solveOneWorker(time: number, c: ModeConstraint): SolveResult {
  const correct = snapToMode(time, c);
  return {
    correct,
    distractors: [
      snapToMode(correct * 2, c),
      snapToMode(correct / 2, c),
      snapToMode(correct + 5, c),
    ],
    unit: "days",
    solution: {
      phase1: `Worker completes in ${time} days alone`,
      phase2: "Single worker",
      phase3: `Time = ${fmtRaw(correct, c)} days`,
    },
  };
}

function solvePipeCistern(
  fillTime: number,
  emptyTime: number,
  c: ModeConstraint,
): SolveResult {
  // Net rate = 1/fill - 1/empty
  const fillRate = 1 / fillTime;
  const emptyRate = 1 / emptyTime;
  const netRate = fillRate - emptyRate;

  if (netRate <= 0) {
    const correct = snapToMode(emptyTime * fillTime, c);
    return {
      correct,
      distractors: [
        snapToMode(correct * 2, c),
        snapToMode(correct / 2, c),
        snapToMode(emptyTime + fillTime, c),
      ],
      unit: "hours",
      solution: {
        phase1: `Fill pipe: ${fillTime} hrs, Empty pipe: ${emptyTime} hrs`,
        phase2: "Net rate negative — tank cannot be filled",
        phase3: `Empty pipe faster: result ${correct} hrs`,
      },
    };
  }

  const fillWithBoth = 1 / netRate;
  const correct = snapToMode(fillWithBoth, c);

  return {
    correct,
    distractors: dedup(
      [
        snapToMode(1 / (fillRate + emptyRate), c), // added rates (treated empty as fill)
        snapToMode(fillTime + emptyTime, c),
        snapToMode(correct * 1.5, c),
      ],
      correct,
      c,
    ),
    unit: "hours",
    solution: {
      phase1: `Fill rate = 1/${fillTime}, Empty rate = 1/${emptyTime}`,
      phase2: "Net rate = fill rate − empty rate",
      phase3: `Net = 1/${fillTime} − 1/${emptyTime} = ${netRate.toFixed(4)}, Time = ${fmtRaw(correct, c)} hours`,
    },
  };
}

function buildWorkTimeSolution(
  workers: { name: string; time: number }[],
  together: number,
  c: ModeConstraint,
): SolveResult["solution"] {
  const rateStr = workers.map((w) => `1/${w.time}`).join(" + ");
  const names = workers.map((w) => w.name).join(", ");
  return {
    phase1: `${names} complete work in ${workers.map((w) => w.time).join(", ")} days respectively`,
    phase2: `Combined rate = ${rateStr} = ${workers
      .map((w) => 1 / w.time)
      .reduce((s, r) => s + r, 0)
      .toFixed(4)} per day`,
    phase3: `Together = 1 / combined rate = ${fmtRaw(snapToMode(together, c), c)} days`,
  };
}

function dedup(
  candidates: number[],
  correct: number,
  c: ModeConstraint,
): number[] {
  const correctKey = fmtRaw(correct, c);
  const seen = new Set<string>([correctKey]);
  const result: number[] = [];
  for (const d of candidates) {
    if (d <= 0 || !Number.isFinite(d)) continue;
    const key = fmtRaw(d, c);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(d);
      if (result.length === 3) return result;
    }
  }
  let off = 1;
  while (result.length < 3) {
    const d = snapToMode(correct + off, c);
    const key = fmtRaw(d, c);
    if (!seen.has(key) && d > 0) {
      seen.add(key);
      result.push(d);
    }
    off++;
    if (off > 50) break;
  }
  return result.slice(0, 3);
}
