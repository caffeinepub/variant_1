// ============================================================
// RATIO & PROPORTION SOLVER
// ============================================================

import type { RatioParams } from "../aiParser";
import type { ModeConstraint, SolveResult } from "./types";
import { fmtRaw, snapToMode } from "./utils";

export function solveRatio(
  params: RatioParams,
  c: ModeConstraint,
): SolveResult {
  const { parts, total, asked_index } = params;
  const partSum = parts.reduce((s, p) => s + p, 0);

  if (partSum === 0) {
    return {
      correct: snapToMode(total / parts.length, c),
      distractors: [
        snapToMode(total / 2, c),
        snapToMode(total / 3, c),
        snapToMode(total / 4, c),
      ],
      unit: "",
      solution: {
        phase1: `Total = ${total}, Parts = ${parts.join(":")}`,
        phase2: "Equal distribution (sum of parts = 0)",
        phase3: `Each = ${total / parts.length}`,
      },
    };
  }

  const idx = Math.min(asked_index, parts.length - 1);
  const correct = snapToMode((parts[idx] / partSum) * total, c);

  // Common mistakes:
  // 1. Used wrong denominator (only the asked part vs total)
  const d1 = snapToMode(total / parts[idx], c);
  // 2. Divided total by number of people equally
  const d2 = snapToMode(total / parts.length, c);
  // 3. Another person's share
  const otherIdx = idx === 0 ? 1 : 0;
  const d3 = snapToMode((parts[otherIdx] / partSum) * total, c);

  return {
    correct,
    distractors: dedup([d1, d2, d3], correct, c),
    unit: "",
    solution: {
      phase1: `Total = ${total}, Ratio = ${parts.join(":")}, Sum of parts = ${partSum}`,
      phase2: `Part for position ${idx + 1} = ${parts[idx]} / ${partSum} × ${total}`,
      phase3: `= ${parts[idx]} × ${total} / ${partSum} = ${fmtRaw(correct, c)}`,
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
    if (off > 500) break;
  }
  return result.slice(0, 3);
}
