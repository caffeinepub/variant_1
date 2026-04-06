// ============================================================
// OPTION GENERATOR — Universal Aptitude Option Builder
// CORE RULE: Given answer X, options are dynamically spaced
//   based on the magnitude of X to avoid scale collapse.
//
// MAGNITUDE-AWARE GAP RULE:
//   gap = max(|X| * 0.10, 5)
//   Option A = X (correct)
//   Option B = X - gap
//   Option C = X + gap
//   Option D = X + 2 * gap
//
//   For LOSS questions (X < 0): same gap logic, all options negative
//
// RULES:
//   - All options must share the same sign as X
//   - Correct answer always included exactly
//   - All 4 must be unique
//   - Shuffled before display
//
// MARKUP RULE: markup% must be POSITIVE before options are generated.
//   If markup% <= 0, reject the variant entirely.
// ============================================================

import type { ParsedQuestion } from "./aiParser";
import type { ModeConstraint } from "./solvers/types";
import { fmtRaw, snapToMode } from "./solvers/utils";

export interface BuiltOptions {
  options: Array<{
    label: "A" | "B" | "C" | "D";
    text: string;
    isCorrect: boolean;
  }>;
  correctLabel: "A" | "B" | "C" | "D";
  correctAnswer: string;
}

/**
 * Format a value according to mode settings
 */
function fmt(val: number, c: ModeConstraint, unit: string): string {
  const raw = fmtRaw(val, c);
  if (!unit) return raw;
  // Currency: prefix
  if (unit === "₹" || unit === "currency") return `₹${raw}`;
  // Suffix units
  return `${raw} ${unit}`;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * MAGNITUDE-AWARE OPTION GENERATION:
 *
 * gap = max(|X| * 0.10, 5)
 *
 * For positive X:
 *   Option 1: X           (correct)
 *   Option 2: X - gap
 *   Option 3: X + gap
 *   Option 4: X + 2*gap
 *
 * For negative X (loss):
 *   gap = max(|X| * 0.10, 5)
 *   Option 1: X           (correct, most negative)
 *   Option 2: X + gap     (less negative)
 *   Option 3: X - gap     (more negative)
 *   Option 4: X + 2*gap   (least negative, closest to 0)
 *   All options remain negative.
 *
 * Examples:
 *   X=74  → gap=7.4 → options: 74, 67, 81, 89
 *   X=3   → gap=5   → options: 3, 8, 13 (clamp neg away), but fallback used for <0
 *   X=-40 → gap=5   → options: -40, -35, -45, -30 (all negative)
 *   X=150 → gap=15  → options: 150, 135, 165, 180
 */
function generateOptionsFromAnswer(
  correct: number,
  c: ModeConstraint,
  unit: string,
): { strings: string[]; correctStr: string } | null {
  const isNeg = correct < 0;
  const absC = Math.abs(correct);

  // Magnitude-aware gap: at least 5, or 10% of |X|
  const rawGap = Math.max(absC * 0.1, 5);
  // Round gap to a clean number for integer mode
  const gap = c.mode === "integer" ? Math.max(1, Math.round(rawGap)) : rawGap;

  let raws: number[];
  if (isNeg) {
    // For loss: all options must stay negative
    raws = [
      correct, // correct (most negative)
      correct + gap, // less negative
      correct - gap, // more negative
      correct + 2 * gap, // least negative
    ];
    // Ensure none go positive
    raws = raws.map((v) => {
      if (v >= 0) return correct - Math.abs(gap) * (raws.indexOf(v) + 1);
      return v;
    });
  } else {
    // For profit/positive: all options must stay positive
    raws = [
      correct, // correct
      correct - gap, // below
      correct + gap, // above
      correct + 2 * gap, // further above
    ];
    // Ensure none go non-positive
    raws = raws.map((v, i) => {
      if (v <= 0) return correct + gap * (i + 1); // push positive
      return v;
    });
  }

  // Snap to mode precision
  const snapped = raws.map((r) => snapToMode(r, c));

  // Validate signs: for positive X, all must be > 0; for negative X, all must be < 0
  for (const v of snapped) {
    if (!Number.isFinite(v) || Number.isNaN(v)) return null;
    if (isNeg && v >= 0) return null;
    if (!isNeg && v <= 0) return null;
  }

  // All must be unique when formatted
  const formatted = snapped.map((v) => fmt(v, c, unit));
  const uniqueSet = new Set(formatted);
  if (uniqueSet.size < 4) {
    // Increase gap and retry once
    return generateOptionsWithLargerGap(correct, c, unit, gap * 2);
  }

  const correctStr = fmt(correct, c, unit);

  return { strings: formatted, correctStr };
}

/**
 * Retry with a larger gap when first attempt produces duplicates.
 */
function generateOptionsWithLargerGap(
  correct: number,
  c: ModeConstraint,
  unit: string,
  gap: number,
): { strings: string[]; correctStr: string } | null {
  const isNeg = correct < 0;

  let raws: number[];
  if (isNeg) {
    raws = [correct, correct + gap, correct - gap, correct + 2 * gap];
    raws = raws.map((v) => (v >= 0 ? correct - gap : v));
  } else {
    raws = [correct, correct - gap, correct + gap, correct + 2 * gap];
    raws = raws.map((v) => (v <= 0 ? correct + gap : v));
  }

  const snapped = raws.map((r) => snapToMode(r, c));
  const formatted = snapped.map((v) => fmt(v, c, unit));
  const uniqueSet = new Set(formatted);

  if (uniqueSet.size < 4) return null;

  for (const v of snapped) {
    if (!Number.isFinite(v) || Number.isNaN(v)) return null;
    if (isNeg && v >= 0) return null;
    if (!isNeg && v <= 0) return null;
  }

  const correctStr = fmt(correct, c, unit);
  return { strings: formatted, correctStr };
}

/**
 * Additive fallback when magnitude-based options still collapse.
 * Happens for very small numbers (e.g., X = 0.5).
 */
function generateOptionsAdditive(
  correct: number,
  c: ModeConstraint,
  unit: string,
): { strings: string[]; correctStr: string } | null {
  const isNeg = correct < 0;
  const absC = Math.abs(correct);

  const step = Math.max(1, Math.round(absC * 0.1));

  const candidates: number[] = [correct];
  let off = step;
  while (candidates.length < 4 && off <= absC * 2 + 100) {
    const plus = isNeg ? correct - off : correct + off;
    const minus = isNeg ? correct + off : correct - off;
    if (isNeg ? plus < 0 : plus > 0) candidates.push(plus);
    if (candidates.length < 4) {
      if (isNeg ? minus < 0 : minus > 0) candidates.push(minus);
    }
    off += step;
  }

  if (candidates.length < 4) return null;

  const snapped = candidates.slice(0, 4).map((v) => snapToMode(v, c));
  const formatted = snapped.map((v) => fmt(v, c, unit));
  const correctStr = fmt(correct, c, unit);

  return { strings: formatted, correctStr };
}

/**
 * Build exactly 4 MCQ options with one correct answer.
 * Uses magnitude-aware gap: gap = max(|X|*0.10, 5)
 * Shuffles positions so correct isn't always A.
 */
export function buildOptions(
  correct: number,
  _distractors: number[], // kept for API compatibility, not used in primary path
  c: ModeConstraint,
  unit: string,
  _parsed?: ParsedQuestion,
): BuiltOptions {
  const snappedCorrect = snapToMode(correct, c);

  // MARKUP VALIDATION: if this is a markup question and markup% <= 0, reject
  if (unit === "%" && snappedCorrect === 0) {
    throw new Error("Markup% is zero — invalid variant");
  }

  let result = generateOptionsFromAnswer(snappedCorrect, c, unit);

  // Fallback 1: additive spread
  if (!result) {
    result = generateOptionsAdditive(snappedCorrect, c, unit);
  }

  let finalStrings: string[];
  let correctStr: string;

  if (result) {
    finalStrings = result.strings;
    correctStr = result.correctStr;
  } else {
    // Ultimate fallback: manual spread
    correctStr = fmt(snappedCorrect, c, unit);
    const isNeg = snappedCorrect < 0;
    const absC = Math.abs(snappedCorrect);
    const step = Math.max(1, Math.round(absC * 0.1));
    const d1 = fmt(
      snapToMode(isNeg ? snappedCorrect - step : snappedCorrect + step, c),
      c,
      unit,
    );
    const d2 = fmt(
      snapToMode(
        isNeg ? snappedCorrect - step * 2 : snappedCorrect + step * 2,
        c,
      ),
      c,
      unit,
    );
    const d3 = fmt(
      snapToMode(
        isNeg
          ? snappedCorrect + step
          : snappedCorrect - step > 0
            ? snappedCorrect - step
            : snappedCorrect + step * 3,
        c,
      ),
      c,
      unit,
    );
    finalStrings = [correctStr, d1, d2, d3];
  }

  const labels: ("A" | "B" | "C" | "D")[] = ["A", "B", "C", "D"];

  // Shuffle
  const shuffled = shuffleArray(finalStrings);

  // HARD GUARANTEE: correct answer must be in the final 4 options
  const hasCorrect = shuffled.includes(correctStr);
  const shuffledFinal = hasCorrect
    ? shuffled.slice(0, 4)
    : [correctStr, ...shuffled.filter((s) => s !== correctStr).slice(0, 3)];

  const options = shuffledFinal.map((text, i) => ({
    label: labels[i] as "A" | "B" | "C" | "D",
    text,
    isCorrect: text === correctStr,
  }));

  // Post-check: verify exactly one correct option exists
  const correctCount = options.filter((o) => o.isCorrect).length;
  if (correctCount !== 1) {
    for (const opt of options) {
      opt.isCorrect = opt.text === correctStr;
    }
  }

  const correctLabel = options.find((o) => o.isCorrect)?.label ?? "A";
  return { options, correctLabel, correctAnswer: correctStr };
}

/**
 * Topic-specific distractor generation — kept for API compatibility.
 * buildOptions now handles all distractor logic internally.
 */
export function generateTopicDistractors(
  _parsed: ParsedQuestion,
  correct: number,
  c: ModeConstraint,
): number[] {
  const isNeg = correct < 0;
  const absC = Math.abs(correct);
  const gap = Math.max(absC * 0.1, 5);
  return [
    snapToMode(correct + gap, c),
    snapToMode(correct - gap, c),
    snapToMode(correct + 2 * gap, c),
  ].filter((v) => (isNeg ? v < 0 : v > 0));
}
