// ============================================================
// MIXTURE & ALLIGATION SOLVER
// Topics: two-vessel mixing, rule of alligation, replacement
// ============================================================

import type { MixtureParams } from "../aiParser";
import type { ModeConstraint, SolveResult } from "./types";
import { snapToMode } from "./utils";

export function solveMixture(
  params: MixtureParams,
  c: ModeConstraint,
): SolveResult {
  switch (params.subtype) {
    case "alligation":
      return solveAlligation(params, c);
    case "replacement":
      return solveReplacement(params, c);
    default:
      return solveTwoVessel(params, c);
  }
}

/**
 * Two-vessel mixing:
 *   (q1 * c1 + q2 * c2) / (q1 + q2) = final concentration
 */
function solveTwoVessel(params: MixtureParams, c: ModeConstraint): SolveResult {
  const { q1, c1, q2, c2 } = params;

  const totalQuantity = q1 + q2;
  const finalConc = (q1 * c1 + q2 * c2) / totalQuantity;

  const correct = snapToMode(finalConc, c);

  return {
    correct,
    distractors: [],
    unit: "%",
    solution: {
      phase1: `Vessel 1: ${q1} litres at ${c1}%, Vessel 2: ${q2} litres at ${c2}%`,
      phase2: `Mixture = (${q1}\u00d7${c1} + ${q2}\u00d7${c2}) / (${q1}+${q2})`,
      phase3: `Final concentration = ${finalConc.toFixed(2)}%`,
    },
  };
}

/**
 * Rule of Alligation:
 *   Find ratio in which two ingredients at price/conc c1 and c2
 *   must be mixed to get mean c_mean.
 *
 *   Ratio = (c2 - c_mean) : (c_mean - c1)
 *   Answer = ratio of cheaper to costlier (or vice versa)
 */
function solveAlligation(
  params: MixtureParams,
  c: ModeConstraint,
): SolveResult {
  const { c1, c2, mean } = params;

  if (mean === undefined || mean <= c1 || mean >= c2) {
    // Swap so c1 <= mean <= c2
    const lo = Math.min(c1, c2);
    const hi = Math.max(c1, c2);
    const safeMean = mean !== undefined ? mean : (lo + hi) / 2;

    const partLo = hi - safeMean;
    const partHi = safeMean - lo;

    const correct = snapToMode(partLo / partHi, c);
    return {
      correct,
      distractors: [],
      unit: "",
      solution: {
        phase1: `Cheaper: ${lo}, Costlier: ${hi}, Mean: ${safeMean}`,
        phase2: `Cheaper part = ${hi} \u2212 ${safeMean} = ${partLo}`,
        phase3: `Ratio (cheaper:costlier) = ${partLo}:${partHi} = ${(partLo / partHi).toFixed(2)}`,
      },
    };
  }

  const partC1 = c2 - mean;
  const partC2 = mean - c1;
  const correct = snapToMode(partC1 / partC2, c);

  return {
    correct,
    distractors: [],
    unit: "",
    solution: {
      phase1: `Ingredient 1: ${c1}, Ingredient 2: ${c2}, Mean: ${mean}`,
      phase2: `Part of ingredient 1 = ${c2} \u2212 ${mean} = ${partC1}`,
      phase3: `Ratio = ${partC1}:${partC2} = ${(partC1 / partC2).toFixed(2)}`,
    },
  };
}

/**
 * Replacement:
 *   After replacing x litres from volume V of pure liquid with water,
 *   n times:
 *   Remaining pure = V * ((V - x) / V)^n
 *   Fraction remaining = ((V - x) / V)^n
 */
function solveReplacement(
  params: MixtureParams,
  c: ModeConstraint,
): SolveResult {
  const { q1: V, replacement_qty: x = 10, replacement_times: n = 1 } = params;

  const fraction = ((V - x) / V) ** n;
  const pureRemaining = V * fraction;
  const percent = fraction * 100;

  const correct = snapToMode(percent, c);

  return {
    correct,
    distractors: [],
    unit: "%",
    solution: {
      phase1: `Initial volume = ${V}, Replaced each time = ${x}, Times = ${n}`,
      phase2: `Fraction remaining = ((${V}\u2212${x})/${V})^${n} = ${fraction.toFixed(4)}`,
      phase3: `Pure liquid remaining = ${pureRemaining.toFixed(2)} litres = ${percent.toFixed(2)}%`,
    },
  };
}
