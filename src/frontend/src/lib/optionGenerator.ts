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
 * Random integer in [min, max] inclusive.
 */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate exactly 3 integer distractors following structured spread rules:
 *
 * Tier by answer magnitude:
 *   < 20  → close ±3–5, medium ±6–10, far ±(min 11, max 10 above absC)
 *   20–100 → close ±3–5, medium ±8–15, far ±18–28
 *   > 100 → close ±5%, medium ±10–15%, far ±20–25%
 *
 * Rules:
 * - All distractors are integers of the same sign as `correct`
 * - Each must differ from `correct` and from each other by at least 2
 * - No extreme values (result always positive if correct positive)
 */
function generateIntegerDistractors(correct: number): number[] {
  const isNeg = correct < 0;
  const absC = Math.abs(correct);

  // Compute 3 raw unsigned offsets: close, medium, far
  let closeOff: number;
  let medOff: number;
  let farOff: number;

  if (absC < 20) {
    closeOff = randInt(3, 5);
    medOff = randInt(6, 10);
    // far is at least 11 but capped so the result isn't 0 or negative
    farOff = randInt(
      11,
      Math.max(11, Math.min(Math.round(absC * 0.9) + 2, absC + 10)),
    );
  } else if (absC <= 100) {
    closeOff = randInt(3, 5);
    medOff = randInt(8, 15);
    farOff = randInt(18, 28);
  } else {
    // Percentage-based for large numbers
    closeOff = Math.round(absC * (randInt(4, 6) / 100));
    medOff = Math.round(absC * (randInt(10, 15) / 100));
    farOff = Math.round(absC * (randInt(20, 25) / 100));
  }

  // Ensure minimum spacing between offset tiers (at least 2 apart)
  if (medOff <= closeOff + 1) medOff = closeOff + 2;
  if (farOff <= medOff + 1) farOff = medOff + 2;

  // Each offset is randomly + or -, keeping the result positive (same sign as correct)
  const applyOffset = (base: number, off: number): number => {
    const sign = Math.random() < 0.5 ? 1 : -1;
    const candidate = base + sign * off;
    // If negative result when answer is positive, flip sign
    if (candidate <= 0 && base > 0) return base + off;
    // If positive result when answer is negative (loss%), flip sign
    if (candidate >= 0 && base < 0) return base - off;
    return candidate;
  };

  const rawClose = applyOffset(absC, closeOff);
  const rawMed = applyOffset(absC, medOff);
  const rawFar = applyOffset(absC, farOff);

  // Round to integers and ensure they differ from each other by at least 2
  const candidates = [rawClose, rawMed, rawFar].map(Math.round);

  // Deduplicate: if two candidates are too close, nudge the later one
  for (let i = 1; i < candidates.length; i++) {
    for (let j = 0; j < i; j++) {
      if (Math.abs(candidates[i] - candidates[j]) < 2) {
        candidates[i] = candidates[j] + 2;
      }
    }
    // Also ensure no distractor equals absC
    if (Math.abs(candidates[i] - absC) < 2) {
      candidates[i] = absC + (i + 1) * 2;
    }
  }

  // Re-apply sign
  return candidates.map((v) => (isNeg ? -Math.abs(v) : Math.abs(v)));
}

/**
 * Deduplicate distractors and ensure exactly 3.
 * For INTEGER mode: uses structured close/medium/far additive offsets.
 * For FRACTION/DECIMAL modes: uses percentage-based multipliers (original logic).
 * Enforces minimum gap so small values don't collapse.
 * Handles both positive (profit) and negative (loss%) correct values.
 */
function buildDistractorSet(
  correct: number,
  distractors: number[],
  c: ModeConstraint,
): number[] {
  const isLoss = correct < 0;

  // ── INTEGER MODE: structured spread additive offsets ────────
  if (c.mode === "integer") {
    const structured = generateIntegerDistractors(correct);
    const result: number[] = [];
    const correctKey = fmtRaw(correct, c);
    const seen = new Set<string>([correctKey]);

    // Try structured distractors first, then any topic-specific ones as fallback
    for (const d of [...structured, ...distractors]) {
      if (result.length === 3) break;
      if (!Number.isFinite(d) || Number.isNaN(d)) continue;
      if (isLoss && d >= 0) continue;
      if (!isLoss && d <= 0) continue;
      const rounded = Math.round(d);
      if (Math.abs(rounded - correct) < 2) continue;
      const key = fmtRaw(rounded, c);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(rounded);
    }

    // Fallback: step outward if still short
    let step = 3;
    while (result.length < 3 && step <= 200) {
      const v = Math.round(correct) + (isLoss ? -step : step);
      if (Math.abs(v - correct) >= 2) {
        const key = fmtRaw(v, c);
        if (!seen.has(key) && (isLoss ? v < 0 : v > 0)) {
          seen.add(key);
          result.push(v);
        }
      }
      step += 2;
    }

    return result.slice(0, 3);
  }

  // ── FRACTION / DECIMAL MODE: original multiplier logic ──────
  const absCorrect = Math.abs(correct);
  // Minimum gap: at least 1 unit, or 5% of the correct value — whichever is larger
  const minGap = Math.max(1, absCorrect * 0.05);

  const correctKey = fmtRaw(correct, c);
  const seen = new Set<string>([correctKey]);
  const result: number[] = [];

  const isTooClose = (d: number): boolean => {
    return Math.abs(d - correct) < minGap;
  };

  const tryAdd = (d: number): boolean => {
    if (!Number.isFinite(d) || Number.isNaN(d)) return false;
    if (isLoss && d >= 0) return false;
    if (!isLoss && d <= 0) return false;
    if (isTooClose(d)) return false;
    const snapped = snapToMode(d, c);
    const key = fmtRaw(snapped, c);
    if (seen.has(key)) return false;
    seen.add(key);
    result.push(snapped);
    return true;
  };

  // Try provided distractors first
  for (const d of distractors) {
    tryAdd(d);
    if (result.length === 3) return result;
  }

  // Spread multipliers that guarantee minimum gap on reasonably-sized answers
  const multipliers = [
    0.75, 1.25, 1.5, 0.6, 1.4, 0.85, 1.15, 0.5, 1.33, 0.67, 2.0, 1.6,
  ];
  for (const m of multipliers) {
    tryAdd(correct * m);
    if (result.length === 3) return result;
  }

  // Integer/unit offsets as last resort
  const step = Math.max(1, Math.ceil(minGap));
  for (let off = step; result.length < 3 && off <= step * 200; off += step) {
    tryAdd(correct + off);
    if (result.length < 3) tryAdd(correct - off);
    if (result.length === 3) return result;
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
  const shuffled = shuffleArray([correctStr, ...distStrings.slice(0, 3)]);

  // HARD GUARANTEE: correct answer must be in the final 4 options
  const hasCorrect = shuffled.includes(correctStr);
  const finalStrings = hasCorrect
    ? shuffled.slice(0, 4)
    : [correctStr, ...shuffled.filter((s) => s !== correctStr).slice(0, 3)];

  const options = finalStrings.map((text, i) => ({
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
 * Called AFTER the solver produces a correct answer
 * Returns distractor values (not formatted strings)
 */
export function generateTopicDistractors(
  parsed: ParsedQuestion,
  correct: number,
  c: ModeConstraint,
): number[] {
  // In integer mode, all topics use the same structured spread helper
  if (c.mode === "integer") {
    return generateIntegerDistractors(correct);
  }

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
