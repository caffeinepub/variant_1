// ============================================================
// OPTION GENERATOR — Topic-aware realistic mistake patterns
// Every distractor is based on a real student error, not random
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
 * Deduplicate distractors and ensure exactly 3.
 * Handles both positive (profit) and negative (loss%) correct values.
 * When correct < 0, all distractors must also be negative (same sign).
 */
function buildDistractorSet(
  correct: number,
  distractors: number[],
  c: ModeConstraint,
): number[] {
  const isLoss = correct < 0;
  const correctKey = fmtRaw(correct, c);
  const seen = new Set<string>([correctKey]);
  const result: number[] = [];

  for (const d of distractors) {
    if (!Number.isFinite(d) || Number.isNaN(d)) continue;
    // Sign consistency: loss answer → only negative distractors; profit → only positive
    if (isLoss && d >= 0) continue;
    if (!isLoss && d <= 0) continue;
    const snapped = snapToMode(d, c);
    const key = fmtRaw(snapped, c);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(snapped);
      if (result.length === 3) return result;
    }
  }

  // Fill remaining with offset-based fallbacks (preserving sign)
  const multipliers = [0.75, 1.25, 1.5, 0.5, 1.1, 0.9, 1.33, 0.67];
  for (const m of multipliers) {
    const d = snapToMode(correct * m, c);
    if (!Number.isFinite(d)) continue;
    if (isLoss && d >= 0) continue;
    if (!isLoss && d <= 0) continue;
    const key = fmtRaw(d, c);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(d);
      if (result.length === 3) return result;
    }
  }

  // Integer offsets as last resort (shift around correct, preserving sign)
  for (let off = 1; result.length < 3 && off <= 100; off++) {
    // Try both directions
    for (const candidate of [
      snapToMode(correct + off * (isLoss ? -1 : 1), c),
      snapToMode(correct - off * (isLoss ? -1 : 1), c),
    ]) {
      if (!Number.isFinite(candidate)) continue;
      if (isLoss && candidate >= 0) continue;
      if (!isLoss && candidate <= 0) continue;
      const key = fmtRaw(candidate, c);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(candidate);
        if (result.length === 3) break;
      }
    }
  }

  return result.slice(0, 3);
}

/**
 * Build exactly 4 MCQ options with one correct answer
 * Shuffles positions so correct isn't always A
 */
export function buildOptions(
  correct: number,
  distractors: number[],
  c: ModeConstraint,
  unit: string,
  _parsed?: ParsedQuestion,
): BuiltOptions {
  const snappedCorrect = snapToMode(correct, c);
  const finalDistractors = buildDistractorSet(snappedCorrect, distractors, c);

  const correctStr = fmt(snappedCorrect, c, unit);
  const distStrings: string[] = [];
  const seenStrings = new Set<string>([correctStr]);

  for (const d of finalDistractors) {
    const s = fmt(d, c, unit);
    if (!seenStrings.has(s)) {
      seenStrings.add(s);
      distStrings.push(s);
    }
  }

  // Pad if still short — preserve sign of correct answer
  const isNegativeResult = snappedCorrect < 0;
  let padOff = 1;
  while (distStrings.length < 3) {
    // Shift in the direction that keeps the same sign
    const padVal = snapToMode(
      snappedCorrect + padOff * 5 * (isNegativeResult ? -1 : 1),
      c,
    );
    if (!Number.isFinite(padVal)) {
      padOff++;
      continue;
    }
    if (isNegativeResult && padVal >= 0) {
      padOff++;
      continue;
    }
    if (!isNegativeResult && padVal <= 0) {
      padOff++;
      continue;
    }
    const padStr = fmt(padVal, c, unit);
    if (!seenStrings.has(padStr)) {
      seenStrings.add(padStr);
      distStrings.push(padStr);
    }
    padOff++;
    if (padOff > 100) break;
  }

  const labels: ("A" | "B" | "C" | "D")[] = ["A", "B", "C", "D"];
  const allStrings = shuffleArray([correctStr, ...distStrings.slice(0, 3)]);

  const options = allStrings.slice(0, 4).map((text, i) => ({
    label: labels[i] as "A" | "B" | "C" | "D",
    text,
    isCorrect: text === correctStr,
  }));

  const correctLabel = options.find((o) => o.isCorrect)?.label ?? "A";
  return { options, correctLabel, correctAnswer: correctStr };
}

/**
 * Topic-specific distractor generation
 * Called AFTER the solver produces a correct answer
 * Returns distractor values (not formatted strings)
 */
export function generateTopicDistractors(
  parsed: ParsedQuestion,
  correct: number,
  c: ModeConstraint,
): number[] {
  switch (parsed.topic) {
    case "work_wages":
      return generateWorkWagesDistractors(
        parsed.total_payment,
        parsed.workers.length,
        correct,
        c,
      );
    case "profit_loss":
      return generateProfitLossDistractors(correct, c);
    case "time_distance":
      return generateTimeDistanceDistractors(correct, c);
    case "simple_interest":
      return generateSIDistractors(
        parsed.principal,
        parsed.rate,
        parsed.time,
        correct,
        c,
      );
    case "ratio":
      return generateRatioDistractors(parsed.parts, parsed.total, correct, c);
    default:
      return generateGenericDistractors(correct, c);
  }
}

function generateWorkWagesDistractors(
  totalPayment: number,
  numWorkers: number,
  correct: number,
  c: ModeConstraint,
): number[] {
  return [
    // Equal split (forgot efficiency)
    snapToMode(totalPayment / numWorkers, c),
    // Wrong proportions
    snapToMode(correct * 1.2, c),
    snapToMode(correct * 0.8, c),
  ];
}

function generateProfitLossDistractors(
  correct: number,
  c: ModeConstraint,
): number[] {
  // For loss (correct < 0): nearby loss% values
  // For profit (correct > 0): nearby profit% values
  // All must share the same sign as correct
  return [
    snapToMode(correct + 5, c), // off by +5%
    snapToMode(correct - 5, c), // off by -5%
    snapToMode(correct * 0.85, c), // scaled down
  ];
}

function generateTimeDistanceDistractors(
  correct: number,
  c: ModeConstraint,
): number[] {
  return [
    snapToMode(correct + 1, c),
    snapToMode(correct - 1 > 0 ? correct - 1 : correct + 2, c),
    snapToMode(correct * 2, c),
  ];
}

function generateSIDistractors(
  P: number,
  R: number,
  T: number,
  correct: number,
  c: ModeConstraint,
): number[] {
  return [
    snapToMode((P * R) / 100, c), // forgot T
    snapToMode((P * T) / 100, c), // used T where R should be
    snapToMode(correct * 1.1, c),
  ];
}

function generateRatioDistractors(
  parts: number[],
  total: number,
  correct: number,
  c: ModeConstraint,
): number[] {
  const sum = parts.reduce((s, p) => s + p, 0);
  return [
    snapToMode(total / parts.length, c), // equal split
    snapToMode(total / sum, c), // unit part
    snapToMode(correct * 1.5, c),
  ];
}

function generateGenericDistractors(
  correct: number,
  c: ModeConstraint,
): number[] {
  return [
    snapToMode(correct * 0.9, c),
    snapToMode(correct * 1.1, c),
    snapToMode(correct * 1.25, c),
  ];
}
