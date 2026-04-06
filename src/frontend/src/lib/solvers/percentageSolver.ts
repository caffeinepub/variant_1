// ============================================================
// PERCENTAGE SOLVER
// ============================================================

import type { PercentageParams } from "../aiParser";
import type { ModeConstraint, SolveResult } from "./types";
import { fmtRaw, snapToMode } from "./utils";

export function solvePercentage(
  params: PercentageParams,
  c: ModeConstraint,
): SolveResult {
  let { value, percent, direction, second_value } = params;

  if (c.mode === "integer") {
    percent = Math.max(5, Math.round(percent / 5) * 5);
    value = Math.max(20, Math.round(value / 20) * 20);
  }

  const pctOfValue = (value * percent) / 100;

  if (direction === "what_percent" && second_value !== undefined) {
    // A is what % of B
    const correctPct = (value / second_value) * 100;
    const correct = snapToMode(correctPct, c);
    return {
      correct,
      distractors: dedup(
        [
          snapToMode((second_value / value) * 100, c), // inverted
          snapToMode(value - second_value, c), // difference
          snapToMode(correct * 2, c),
        ],
        correct,
        c,
      ),
      unit: "%",
      solution: {
        phase1: `A = ${value}, B = ${second_value}`,
        phase2: "% = A/B × 100",
        phase3: `= ${value} / ${second_value} × 100 = ${fmtRaw(correct, c)}%`,
      },
    };
  }

  if (direction === "increase") {
    const correct = snapToMode(value + pctOfValue, c);
    return {
      correct,
      distractors: dedup(
        [
          snapToMode(value - pctOfValue, c), // decreased instead of increased
          snapToMode(pctOfValue, c), // only calculated the % amount
          snapToMode(value * (percent / 100), c), // multiplied raw
        ],
        correct,
        c,
      ),
      unit: "",
      solution: {
        phase1: `Value = ${value}, Increase = ${percent}%`,
        phase2: `Increase amount = ${value} × ${percent}/100 = ${pctOfValue.toFixed(2)}`,
        phase3: `New value = ${value} + ${pctOfValue.toFixed(2)} = ${fmtRaw(correct, c)}`,
      },
    };
  }

  if (direction === "decrease") {
    const correct = snapToMode(Math.max(0, value - pctOfValue), c);
    return {
      correct,
      distractors: dedup(
        [
          snapToMode(value + pctOfValue, c), // increased instead of decreased
          snapToMode(pctOfValue, c),
          snapToMode(value * (1 + percent / 100), c),
        ],
        correct,
        c,
      ),
      unit: "",
      solution: {
        phase1: `Value = ${value}, Decrease = ${percent}%`,
        phase2: `Decrease amount = ${value} × ${percent}/100 = ${pctOfValue.toFixed(2)}`,
        phase3: `New value = ${value} - ${pctOfValue.toFixed(2)} = ${fmtRaw(correct, c)}`,
      },
    };
  }

  // Default: find X% of Y
  const correct = snapToMode(pctOfValue, c);
  return {
    correct,
    distractors: dedup(
      [
        snapToMode(value + percent, c), // added raw
        snapToMode((100 / percent) * value, c), // inverted
        snapToMode(correct * 2, c),
      ],
      correct,
      c,
    ),
    unit: "",
    solution: {
      phase1: `Value = ${value}, Percent = ${percent}%`,
      phase2: `${percent}% of ${value} = ${value} × ${percent} / 100`,
      phase3: `= ${fmtRaw(correct, c)}`,
    },
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
  let off = 5;
  while (result.length < 3) {
    const d = snapToMode(correct + off, c);
    const key = fmtRaw(d, c);
    if (!seen.has(key) && d > 0) {
      seen.add(key);
      result.push(d);
    }
    off += 5;
    if (off > 100) break;
  }
  return result.slice(0, 3);
}
