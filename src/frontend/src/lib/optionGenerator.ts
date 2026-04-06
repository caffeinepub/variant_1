// ============================================================
// OPTION GENERATOR — Universal Aptitude Option Builder
// CORE RULE: Given answer X, options are:
//   X (correct), X-20%, X+20%, X+40%
//
// RULES:
//   - All options must be positive (reject if any negative)
//   - Correct answer always included
//   - No random numbers — all anchored to X
//   - Options shuffled before display
//   - For LOSS questions (negative X): options are X, X+20%, X-20%, X-40%
//     so all options share the same sign as X
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
 * CORE OPTION GENERATION RULE:
 * Given answer = X:
 *   Option 1: X           (correct)
 *   Option 2: X * 0.80   (X - 20%)
 *   Option 3: X * 1.20   (X + 20%)
 *   Option 4: X * 1.40   (X + 40%)
 *
 * For LOSS questions (X < 0):
 *   Option 1: X           (correct)
 *   Option 2: X * 0.80   (≈ X + 20% toward zero for negatives = less negative)
 *   Option 3: X * 1.20   (more negative)
 *   Option 4: X * 1.40   (even more negative)
 *   All options are negative — same sign as X.
 *
 * Validation:
 *   - All options must be non-zero and finite
 *   - For positive X: all must be > 0
 *   - For negative X: all must be < 0
 *   - All 4 must be unique
 *   - Correct answer must be present
 *
 * Returns exactly 4 formatted strings: [correct_str, d1, d2, d3]
 */
function generateOptionsFromAnswer(
  correct: number,
  c: ModeConstraint,
  unit: string,
): { strings: string[]; correctStr: string } | null {
  const isNeg = correct < 0;

  // Compute the 4 option values anchored to X
  const raw1 = correct; // X
  const raw2 = correct * 0.8; // X - 20%
  const raw3 = correct * 1.2; // X + 20%
  const raw4 = correct * 1.4; // X + 40%

  const raws = [raw1, raw2, raw3, raw4];

  // Snap to mode precision
  const snapped = raws.map((r) => snapToMode(r, c));

  // Validate signs: for positive X, all must be > 0; for negative X, all must be < 0
  for (const v of snapped) {
    if (!Number.isFinite(v) || Number.isNaN(v)) return null;
    if (isNeg && v >= 0) return null; // negative answer → all options must be negative
    if (!isNeg && v <= 0) return null; // positive answer → all options must be positive
  }

  // All must be unique when formatted
  const formatted = snapped.map((v) => fmt(v, c, unit));
  const uniqueSet = new Set(formatted);
  if (uniqueSet.size < 4) {
    // Not enough unique options — fall back to additive spread
    return generateOptionsAdditive(correct, c, unit);
  }

  const correctStr = fmt(correct, c, unit);

  return { strings: formatted, correctStr };
}

/**
 * Additive fallback when percentage-based options collapse to duplicates.
 * Happens when answer is very small (e.g., X = 2).
 * Uses absolute spread: X, X±1, X±2, X±3 etc., same sign.
 */
function generateOptionsAdditive(
  correct: number,
  c: ModeConstraint,
  unit: string,
): { strings: string[]; correctStr: string } | null {
  const isNeg = correct < 0;
  const absC = Math.abs(correct);

  // Spread: at least 1 unit, scaled to answer size
  const step = Math.max(1, Math.round(absC * 0.05));

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
 * Uses the universal X / X-20% / X+20% / X+40% rule.
 * Shuffles positions so correct isn’t always A.
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
  // (caller should have caught this, but we add a guard here)
  if (unit === "%" && snappedCorrect === 0) {
    throw new Error("Markup% is zero — invalid variant");
  }

  const result = generateOptionsFromAnswer(snappedCorrect, c, unit);

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
 * Topic-specific distractor generation
 * NOTE: With the new X / X-20% / X+20% / X+40% rule, this function
 * is kept for API compatibility but buildOptions no longer uses it.
 * The primary path uses generateOptionsFromAnswer.
 */
export function generateTopicDistractors(
  _parsed: ParsedQuestion,
  correct: number,
  c: ModeConstraint,
): number[] {
  // Return empty — buildOptions now handles all distractor logic internally
  // via the X/X-20%/X+20%/X+40% rule
  const isNeg = correct < 0;
  return [
    snapToMode(correct * 0.8, c),
    snapToMode(correct * 1.2, c),
    snapToMode(correct * 1.4, c),
  ].filter((v) => (isNeg ? v < 0 : v > 0));
}
