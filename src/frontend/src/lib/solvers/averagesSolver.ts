// ============================================================
// AVERAGES SOLVER
// Topics: simple average, weighted average, add/remove element
// ============================================================

import type { AveragesParams } from "../aiParser";
import type { ModeConstraint, SolveResult } from "./types";
import { snapToMode } from "./utils";

export function solveAverages(
  params: AveragesParams,
  c: ModeConstraint,
): SolveResult {
  switch (params.subtype) {
    case "weighted":
      return solveWeighted(params, c);
    case "add_remove":
      return solveAddRemove(params, c);
    default:
      return solveSimpleAverage(params, c);
  }
}

/**
 * Simple average: sum / count
 */
function solveSimpleAverage(
  params: AveragesParams,
  c: ModeConstraint,
): SolveResult {
  const { values, count } = params;

  let avg: number;
  let sum: number;

  if (values && values.length > 0) {
    sum = values.reduce((a, b) => a + b, 0);
    avg = sum / values.length;
  } else {
    // Given average and count, asked for sum (or vice versa)
    sum = (params.known_avg ?? 0) * (count ?? 1);
    avg = params.known_avg ?? sum / (count ?? 1);
  }

  const correct = snapToMode(avg, c);

  return {
    correct,
    distractors: [],
    unit: "",
    solution: {
      phase1: `Values: ${values?.join(", ") ?? `Count = ${count}, Sum = ${sum}`}`,
      phase2: `Sum = ${sum?.toFixed ? sum.toFixed(2) : sum}`,
      phase3: `Average = Sum / Count = ${avg.toFixed(2)}`,
    },
  };
}

/**
 * Weighted average:
 *   (w1*v1 + w2*v2 + ...) / (w1 + w2 + ...)
 */
function solveWeighted(params: AveragesParams, c: ModeConstraint): SolveResult {
  const { weights = [], values = [] } = params;

  if (weights.length === 0 || values.length === 0) {
    return solveSimpleAverage(params, c);
  }

  const numerator = weights.reduce(
    (sum, w, i) => sum + w * (values[i] ?? 0),
    0,
  );
  const denominator = weights.reduce((sum, w) => sum + w, 0);
  const avg = numerator / denominator;

  const correct = snapToMode(avg, c);

  return {
    correct,
    distractors: [],
    unit: "",
    solution: {
      phase1: `Groups: ${weights.map((w, i) => `${w} items at ${values[i]}`).join(", ")}`,
      phase2: `Weighted sum = ${numerator.toFixed(2)}, Total weight = ${denominator}`,
      phase3: `Weighted average = ${numerator.toFixed(2)} / ${denominator} = ${avg.toFixed(2)}`,
    },
  };
}

/**
 * Average after adding/removing an element:
 *   new_avg = (old_avg * n ± new_element) / (n ± 1)
 */
function solveAddRemove(
  params: AveragesParams,
  c: ModeConstraint,
): SolveResult {
  const {
    count = 5,
    known_avg = 20,
    new_element,
    remove_element,
    asked_new_avg,
  } = params;

  const oldSum = known_avg * count;

  if (asked_new_avg && new_element !== undefined) {
    // Asked: what is new element if new avg is given
    const newSum = asked_new_avg * (count + 1);
    const newEl = newSum - oldSum;
    const correct = snapToMode(newEl, c);
    return {
      correct,
      distractors: [],
      unit: "",
      solution: {
        phase1: `Old average = ${known_avg}, n = ${count}, New average = ${asked_new_avg}`,
        phase2: `Old sum = ${known_avg} × ${count} = ${oldSum}`,
        phase3: `New element = ${asked_new_avg} × ${count + 1} − ${oldSum} = ${newEl}`,
      },
    };
  }

  if (new_element !== undefined) {
    const newAvg = (oldSum + new_element) / (count + 1);
    const correct = snapToMode(newAvg, c);
    return {
      correct,
      distractors: [],
      unit: "",
      solution: {
        phase1: `Old average = ${known_avg}, n = ${count}, New element = ${new_element}`,
        phase2: `New sum = ${oldSum} + ${new_element} = ${oldSum + new_element}`,
        phase3: `New average = ${oldSum + new_element} / ${count + 1} = ${newAvg.toFixed(2)}`,
      },
    };
  }

  if (remove_element !== undefined) {
    const newAvg = (oldSum - remove_element) / (count - 1);
    const correct = snapToMode(newAvg, c);
    return {
      correct,
      distractors: [],
      unit: "",
      solution: {
        phase1: `Old average = ${known_avg}, n = ${count}, Removed element = ${remove_element}`,
        phase2: `New sum = ${oldSum} − ${remove_element} = ${oldSum - remove_element}`,
        phase3: `New average = ${oldSum - remove_element} / ${count - 1} = ${newAvg.toFixed(2)}`,
      },
    };
  }

  // Fallback: simple average
  return solveSimpleAverage(params, c);
}
