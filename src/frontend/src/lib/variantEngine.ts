// ============================================================
// VARIANT ENGINE v13 — Per-Variant Option Binding + Minimum-Gap Distractors
// Stage 1: AI Parser (rule-based, deterministic)
// Stage 2-4: Dedicated Solvers (formula-first, exact math)
// Stage 5: Option Generator (topic-aware mistake patterns)
// Hardening: Parser Validation, Solver Coverage Map, Back-Verification
// All math is in code. AI never touches final numbers.
// ============================================================

import { parseQuestion } from "./aiParser";
import type { ParsedQuestion } from "./aiParser";
import { buildOptions, generateTopicDistractors } from "./optionGenerator";
import { solvePercentage as solvePercentageNew } from "./solvers/percentageSolver";
import {
  solveProfitLoss,
  validateProfitLossParams,
} from "./solvers/profitLossSolver";
import { solveRatio } from "./solvers/ratioSolver";
import {
  solveCompoundInterest as solveCompoundInterestNew,
  solveSimpleInterest as solveSimpleInterestNew,
} from "./solvers/simpleInterestSolver";
import { solveTimeDistance as solveTimeDistanceNew } from "./solvers/timeDistanceSolver";
import type { ModeConstraint, SolveResult } from "./solvers/types";
import {
  fmtRaw as fmtRawNew,
  snapToMode as snapToModeNew,
} from "./solvers/utils";
import { solveWorkTime } from "./solvers/workTimeSolver";
import { solveWorkWagesAdvanced } from "./solvers/workWagesSolver";

// ── Public interfaces ─────────────────────────────────────

export interface Settings {
  integerOnly: boolean;
  decimalPrecision: number; // 1–10
  fractionMode: boolean;
  quantity: number; // 2, 3, 4, or 5
}

export interface MCQOption {
  label: "A" | "B" | "C" | "D";
  text: string;
  isCorrect: boolean;
}

export interface VariantQuestion {
  id: string;
  questionText: string;
  options: MCQOption[];
  correctAnswer: string;
  correctLabel: "A" | "B" | "C" | "D";
  chapter: string;
  subTopic: string;
  solution: {
    phase1: string;
    phase2: string;
    phase3: string;
  };
}

export type GeneratedVariant = VariantQuestion;

export interface GenerationResult {
  variants: VariantQuestion[];
  originalChapter: string;
  originalSubTopic: string;
}

// ── Mode Constraint ────────────────────────────────────────

function getConstraint(settings: Settings): ModeConstraint {
  if (settings.integerOnly) return { mode: "integer", decimalPrecision: 0 };
  if (settings.fractionMode) return { mode: "fraction", decimalPrecision: 2 };
  return { mode: "decimal", decimalPrecision: settings.decimalPrecision ?? 2 };
}

function isValidForMode(value: number, c: ModeConstraint): boolean {
  if (!Number.isFinite(value) || Number.isNaN(value) || value <= 0)
    return false;
  if (c.mode === "integer") return Number.isInteger(value);
  if (c.mode === "fraction") return Number.isFinite(value) && value > 0;
  const prec = c.decimalPrecision;
  const str = value.toFixed(prec);
  return Number.parseFloat(str) === Number.parseFloat(value.toFixed(prec));
}

// ── Math helpers ────────────────────────────────────────────

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function roundToDecimals(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

// ── Fraction formatter ─────────────────────────────────────

function toFractionString(val: number, unit: string): string {
  if (Number.isInteger(val) || Math.abs(val - Math.round(val)) < 1e-9) {
    const int = Math.round(val);
    return unit ? `${int} ${unit}` : `${int}`;
  }
  let bestNum = 1;
  let bestDen = 1;
  let bestErr = Number.POSITIVE_INFINITY;
  for (let den = 1; den <= 100; den++) {
    const num = Math.round(val * den);
    const err = Math.abs(val - num / den);
    if (err < bestErr) {
      bestErr = err;
      bestNum = num;
      bestDen = den;
    }
    if (err < 1e-9) break;
  }
  const g = gcd(Math.abs(bestNum), bestDen);
  const n = bestNum / g;
  const d = bestDen / g;
  const u = unit ? ` ${unit}` : "";
  if (d === 1) return `${n}${u}`;
  return `${n}/${d}${u}`;
}

// ── Formatter (used by formatExport) ──────────────────────

function fmtLegacy(val: number, settings: Settings, unit = ""): string {
  const u = unit ? ` ${unit}` : "";
  if (settings.fractionMode) return toFractionString(val, unit);
  if (settings.integerOnly) return `${Math.round(val)}${u}`;
  return `${roundToDecimals(val, settings.decimalPrecision).toFixed(settings.decimalPrecision)}${u}`;
}

// ── Number sanitization ────────────────────────────────────

function sanitizeNumber(n: number): number {
  const rounded = Math.round(n);
  if (rounded === 0) return 1;
  const diff = Math.abs(n - rounded) / Math.max(1, Math.abs(rounded));
  return diff < 0.02 ? rounded : n;
}

function formatNumberForText(n: number): string {
  const clean = sanitizeNumber(n);
  if (Number.isInteger(clean)) return String(Math.round(clean));
  return Number.parseFloat(clean.toFixed(2)).toString();
}

// ── Unit detection ─────────────────────────────────────────

function detectExpectedUnit(questionText: string): string {
  const lower = questionText.toLowerCase();
  if (
    /earn|wage|wages|salary|pay|rupee|₹|cost|price|profit|loss|revenue|sp|cp|receive|gets|payment|distributed|share|how much does|how much will|total payment/.test(
      lower,
    )
  )
    return "currency";
  if (/how long|time taken|days|hours|minutes|weeks/.test(lower)) {
    if (/hours?\b/.test(lower)) return "hours";
    if (/minutes?\b/.test(lower)) return "minutes";
    if (/weeks?\b/.test(lower)) return "weeks";
    return "days";
  }
  if (/speed|km\/h|mph|kmph|velocity/.test(lower)) return "km/h";
  if (/distance|km|metres|miles/.test(lower)) return "km";
  if (/percent|%/.test(lower)) return "%";
  return "";
}

// ── Auto-Classification ────────────────────────────────────

const CHAPTER_MAP = [
  {
    chapter: "Profit & Loss",
    keywords: [
      "profit",
      "loss",
      "cost price",
      "selling price",
      "cp",
      "sp",
      "markup",
      "discount",
      "gain",
      "bought",
      "sold",
      "buy",
      "sell",
    ],
    subTopics: [
      {
        topic: "Successive Discount",
        keywords: ["successive", "two discount", "double discount"],
      },
      {
        topic: "Marked Price",
        keywords: ["marked", "mark", "mp", "list price"],
      },
      {
        topic: "Equated SP",
        keywords: ["equated", "equal sp", "same profit", "same loss"],
      },
      {
        topic: "Profit Percentage",
        keywords: ["profit percent", "gain percent", "percentage profit"],
      },
      { topic: "Basic Profit/Loss", keywords: [] },
    ],
  },
  {
    chapter: "Time & Distance",
    keywords: [
      "speed",
      "distance",
      "km/h",
      "mph",
      "travels",
      "train",
      "car",
      "bus",
      "kmph",
      "faster",
      "slower",
      "velocity",
    ],
    subTopics: [
      {
        topic: "Relative Speed",
        keywords: [
          "relative",
          "towards",
          "opposite",
          "same direction",
          "meeting",
        ],
      },
      { topic: "Average Speed", keywords: ["average speed", "total distance"] },
      { topic: "Basic Speed-Time", keywords: [] },
    ],
  },
  {
    chapter: "Simple Interest",
    keywords: ["simple interest", "per annum", "annually", "principal"],
    subTopics: [
      {
        topic: "Find SI",
        keywords: ["find interest", "calculate interest", "how much interest"],
      },
      { topic: "Find Principal", keywords: ["find the sum", "find principal"] },
      { topic: "Find Rate", keywords: ["rate", "percent per"] },
      { topic: "Basic SI", keywords: [] },
    ],
  },
  {
    chapter: "Compound Interest",
    keywords: ["compound interest", "compounded", "compound"],
    subTopics: [
      {
        topic: "Half-Yearly CI",
        keywords: ["half yearly", "semi", "half-yearly"],
      },
      { topic: "Annual CI", keywords: ["annual", "yearly"] },
      { topic: "Basic CI", keywords: [] },
    ],
  },
  {
    chapter: "Percentage",
    keywords: ["percent", "percentage", "%", "what percent"],
    subTopics: [
      {
        topic: "Percentage Increase",
        keywords: ["increase", "rise", "grew", "increased by"],
      },
      {
        topic: "Percentage Decrease",
        keywords: ["decrease", "fall", "dropped", "decreased by"],
      },
      { topic: "Basic Percentage", keywords: [] },
    ],
  },
  {
    chapter: "Ratio & Proportion",
    keywords: ["ratio", "proportion", "share", "divided in", "parts"],
    subTopics: [
      {
        topic: "Sharing in Ratio",
        keywords: ["share", "divide", "split", "divided"],
      },
      { topic: "Basic Ratio", keywords: [] },
    ],
  },
  {
    chapter: "Work & Time",
    keywords: [
      "work",
      "complete",
      "together",
      "alone",
      "pipe",
      "tank",
      "fill",
      "empty",
    ],
    subTopics: [
      {
        topic: "Pipes & Cisterns",
        keywords: ["pipe", "tank", "fill", "empty", "cistern"],
      },
      { topic: "Combined Work", keywords: ["together", "combined", "jointly"] },
      { topic: "Basic Work", keywords: [] },
    ],
  },
  {
    chapter: "Wages & Work",
    keywords: [
      "wage",
      "wages",
      "earn",
      "salary",
      "paid",
      "per day",
      "daily",
      "worker",
      "labour",
      "laborer",
    ],
    subTopics: [
      { topic: "Daily Wage", keywords: ["per day", "daily", "day's work"] },
      { topic: "Combined Wages", keywords: ["together", "combined"] },
      { topic: "Basic Wages", keywords: [] },
    ],
  },
  {
    chapter: "Averages",
    keywords: ["average", "mean", "sum of", "numbers are"],
    subTopics: [{ topic: "Basic Average", keywords: [] }],
  },
  {
    chapter: "Algebra",
    keywords: [
      "find x",
      "find y",
      "value of x",
      "value of y",
      "equation",
      "solve for",
    ],
    subTopics: [{ topic: "Linear Equation", keywords: [] }],
  },
  {
    chapter: "Geometry",
    keywords: [
      "area",
      "perimeter",
      "circle",
      "rectangle",
      "triangle",
      "square",
      "radius",
      "diameter",
      "volume",
    ],
    subTopics: [
      {
        topic: "Circle",
        keywords: ["circle", "radius", "diameter", "circumference"],
      },
      {
        topic: "Triangle",
        keywords: ["triangle", "base", "height", "hypotenuse"],
      },
      {
        topic: "Rectangle",
        keywords: ["rectangle", "length", "breadth", "width"],
      },
      { topic: "Basic Geometry", keywords: [] },
    ],
  },
];

export function classify(text: string): { chapter: string; subTopic: string } {
  const lower = text.toLowerCase();

  // Work+Wages combo — detect BEFORE main loop
  const hasWorkKeywords =
    /\b(work|complete|together|alone|sort|sorting|pack|packages|task)\b/.test(
      lower,
    );
  const hasPaymentKeywords =
    /\b(wage|wages|earn|salary|paid|payment|receive|gets|how much does|total payment|distributed)\b/.test(
      lower,
    );
  if (hasWorkKeywords && hasPaymentKeywords) {
    return { chapter: "Work & Wages", subTopic: "Proportional Wages" };
  }

  for (const entry of CHAPTER_MAP) {
    if (entry.keywords.some((k) => lower.includes(k))) {
      for (const st of entry.subTopics) {
        if (
          st.keywords.length > 0 &&
          st.keywords.some((k) => lower.includes(k))
        ) {
          return { chapter: entry.chapter, subTopic: st.topic };
        }
      }
      return {
        chapter: entry.chapter,
        subTopic: entry.subTopics[entry.subTopics.length - 1].topic,
      };
    }
  }
  return { chapter: "General Math", subTopic: "Miscellaneous" };
}

export function detectChapterType(questionText: string): string {
  return classify(questionText).chapter;
}

// ── Number extraction ──────────────────────────────────────

interface NumberToken {
  value: number;
  start: number;
  end: number;
}

function extractTokens(text: string): NumberToken[] {
  // Normalize thousands-separator commas (3,600 -> 3600)
  const normalized = text.replace(/(\d),(\d{3})\b/g, "$1$2");
  const regex = /\b\d+(?:\.\d+)?\b/g;
  const tokens: NumberToken[] = [];
  let match = regex.exec(normalized);
  while (match !== null) {
    tokens.push({
      value: Number.parseFloat(match[0]),
      start: match.index,
      end: match.index + match[0].length,
    });
    match = regex.exec(normalized);
  }
  return tokens;
}

function replaceTokens(
  text: string,
  tokens: NumberToken[],
  newValues: number[],
): string {
  const normalized = text.replace(/(\d),(\d{3})\b/g, "$1$2");
  const sorted = [...tokens]
    .map((t, i) => ({ ...t, newVal: newValues[i] ?? t.value }))
    .sort((a, b) => b.start - a.start);
  let result = normalized;
  for (const token of sorted) {
    result =
      result.slice(0, token.start) +
      formatNumberForText(token.newVal) +
      result.slice(token.end);
  }
  return result;
}

function validateQuestionText(text: string): boolean {
  return !/\d,\d/.test(text);
}

// ── Scale helpers ──────────────────────────────────────────

function scaleNice(n: number, factor: number): number {
  const scaled = n * factor;
  const rounded = Math.round(scaled);
  const result = rounded > 0 ? rounded : Math.max(1, Math.round(n));
  return sanitizeNumber(result);
}

// ── HARDENING LAYER 1: Parser Validation ──────────────────
// Counts numbers in original text vs numbers captured in the
// parsed structure. If parser missed >40% of numbers, we flag
// it so the solver knows to be conservative.

function countNumbersInText(text: string): number {
  const norm = text.replace(/(\d),(\d{3})\b/g, "$1$2");
  return (norm.match(/\b\d+(?:\.\d+)?\b/g) ?? []).length;
}

function getParsedNumberCount(parsed: ParsedQuestion): number {
  if (parsed.topic === "unknown") return parsed.nums.length;
  // Count numeric values embedded in the JSON representation
  const json = JSON.stringify(parsed);
  return (json.match(/\b\d+(?:\.\d+)?\b/g) ?? []).length;
}

function isParserConfident(
  originalQuestion: string,
  parsed: ParsedQuestion,
): boolean {
  const originalNumCount = countNumbersInText(originalQuestion);
  const parsedNumCount = getParsedNumberCount(parsed);
  // Confident if parser captured at least 60% of the original numbers
  return parsedNumCount >= Math.ceil(originalNumCount * 0.6);
}

// ── HARDENING LAYER 2: Solver Coverage Map ────────────────
// Every topic in ParsedQuestion maps to exactly one solver.
// If we detect a topic but the parser didn't extract the key
// fields for that topic, we fall back gracefully rather than
// letting the solver receive malformed input.

const SOLVER_COVERAGE: Record<string, boolean> = {
  work_wages: true,
  profit_loss: true,
  time_distance: true,
  simple_interest: true,
  compound_interest: true,
  percentage: true,
  ratio: true,
  work_time: true,
  unknown: true, // generic fallback
};

function hasSolverCoverage(parsed: ParsedQuestion): boolean {
  return SOLVER_COVERAGE[parsed.topic] === true;
}

// ── HARDENING LAYER 3: Back-Verification ──────────────────
// After solving, plug the result back into basic sanity checks.
// This catches cases where the solver produced a technically
// valid number but it violates domain constraints.

function backVerify(
  solved: SolveResult,
  parsed: ParsedQuestion,
  originalQuestion: string,
): boolean {
  // Must be a finite number
  if (!Number.isFinite(solved.correct) || Number.isNaN(solved.correct))
    return false;
  if (Math.abs(solved.correct) > 1e9) return false; // Unreasonably large

  // profit_loss: answer CAN be negative (loss%). Do NOT block negatives.
  // For all other topics (wages, time, distance, interest) result must be > 0.
  if (parsed.topic !== "profit_loss" && solved.correct <= 0) return false;

  // For work_wages: monetary result — reject time units
  if (parsed.topic === "work_wages") {
    if (solved.unit && /days?|hours?|minutes?|weeks?/i.test(solved.unit))
      return false;
  }

  // Unit back-check: if question expects currency, discard time units
  const expUnit = detectExpectedUnit(originalQuestion);
  if (expUnit === "currency") {
    if (solved.unit && /days?|hours?|minutes?|weeks?/i.test(solved.unit))
      return false;
  }

  // Distractors must be finite.
  // For profit_loss: distractors can be negative (loss%). All must share same sign as correct.
  // For other topics: distractors must be positive.
  const isLossResult = parsed.topic === "profit_loss" && solved.correct < 0;
  for (const d of solved.distractors) {
    if (!Number.isFinite(d) || Number.isNaN(d)) return false;
    if (isLossResult && d >= 0) return false; // loss question — all options negative
    if (!isLossResult && d <= 0) return false; // profit/other — all options positive
  }

  // All options (correct + distractors) must be unique
  const allValues = [solved.correct, ...solved.distractors];
  const unique = new Set(allValues.map((v) => Math.round(v * 1000)));
  if (unique.size < allValues.length) return false;

  return true;
}

// ── Solver dispatcher ──────────────────────────────────────

function solveFromParsed(
  parsed: ParsedQuestion,
  c: ModeConstraint,
): SolveResult {
  switch (parsed.topic) {
    case "work_wages":
      return solveWorkWagesAdvanced(parsed, c);
    case "profit_loss":
      return solveProfitLoss(parsed, c);
    case "time_distance":
      return solveTimeDistanceNew(parsed, c);
    case "simple_interest":
      return solveSimpleInterestNew(parsed, c);
    case "compound_interest":
      return solveCompoundInterestNew(parsed, c);
    case "percentage":
      return solvePercentageNew(parsed, c);
    case "ratio":
      return solveRatio(parsed, c);
    case "work_time":
      return solveWorkTime(parsed, c);
    default:
      return solveGenericFallback(parsed.nums, c);
  }
}

function solveGenericFallback(nums: number[], c: ModeConstraint): SolveResult {
  const a = nums[0] ?? 10;
  const b = nums[1] ?? 5;
  const correct = snapToModeNew(a + b, c);
  return {
    correct,
    distractors: [
      snapToModeNew(Math.abs(a - b), c),
      snapToModeNew(a * b, c),
      snapToModeNew(correct * 1.5, c),
    ],
    unit: "",
    solution: {
      phase1: `Given values: ${nums.slice(0, 3).join(", ")}`,
      phase2: "Apply the relevant formula from the question",
      phase3: `Result = ${fmtRawNew(correct, c)}`,
    },
  };
}

// ── Mutate parsed params for variant generation ────────────

function mutateParsed(parsed: ParsedQuestion, factor: number): ParsedQuestion {
  if (parsed.topic === "work_wages") {
    return {
      ...parsed,
      workers: parsed.workers.map((w) => ({
        ...w,
        time: Math.max(1, Math.round(w.time * factor)),
      })),
      total_payment: Math.max(100, Math.round(parsed.total_payment * factor)),
      events: parsed.events.map((e) => ({
        ...e,
        leaves_after:
          e.leaves_after !== undefined
            ? Math.max(1, Math.round(e.leaves_after * factor))
            : undefined,
        leaves_before_end:
          e.leaves_before_end !== undefined
            ? Math.max(1, Math.round(e.leaves_before_end * factor))
            : undefined,
      })),
    };
  }

  if (parsed.topic === "profit_loss") {
    // Scale CP only. markup_pct and discount_pct are percentages — scaling them
    // with the same factor as CP would quickly produce discount >= 100% which
    // makes SP negative. Keep markup/discount as-is; only scale the base price.
    // The parameter validator in profitLossSolver will reject any invalid combo.
    const newCp = Math.max(20, Math.round(parsed.cp * factor));
    // Clamp discount to max 95% (safety rail — should already be valid from parser)
    const safeDiscount =
      parsed.discount_pct !== undefined
        ? Math.min(95, Math.max(1, parsed.discount_pct))
        : undefined;
    return {
      ...parsed,
      cp: newCp,
      discount_pct: safeDiscount,
    };
  }

  if (parsed.topic === "time_distance") {
    return {
      ...parsed,
      speed:
        parsed.speed !== undefined
          ? Math.max(10, Math.round(parsed.speed * factor))
          : undefined,
      distance:
        parsed.distance !== undefined
          ? Math.max(10, Math.round(parsed.distance * factor))
          : undefined,
    };
  }

  if (parsed.topic === "simple_interest") {
    return {
      ...parsed,
      principal: Math.max(100, Math.round(parsed.principal * factor)),
    };
  }

  if (parsed.topic === "compound_interest") {
    return {
      ...parsed,
      principal: Math.max(100, Math.round(parsed.principal * factor)),
    };
  }

  if (parsed.topic === "ratio") {
    return {
      ...parsed,
      total: Math.max(100, Math.round(parsed.total * factor)),
    };
  }

  if (parsed.topic === "percentage") {
    return {
      ...parsed,
      value: Math.max(20, Math.round(parsed.value * factor)),
    };
  }

  if (parsed.topic === "work_time") {
    return {
      ...parsed,
      workers: parsed.workers.map((w) => ({
        ...w,
        time: Math.max(1, Math.round(w.time * factor)),
      })),
    };
  }

  // unknown: scale all nums
  const scaled = (
    parsed as { topic: "unknown"; nums: number[]; text: string }
  ).nums.map((n) => Math.max(1, Math.round(n * factor)));
  return { topic: "unknown", nums: scaled, text: parsed.text };
}

// ── Validate a generated variant ──────────────────────────

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

function validateVariant(
  solved: SolveResult,
  c: ModeConstraint,
  unit: string,
  questionText: string,
  topic?: string,
): ValidationResult {
  // For profit_loss, the answer can be negative (loss%) — isValidForMode
  // checks positivity, so we bypass it for profit_loss.
  const isProfitLoss = topic === "profit_loss";
  if (!isProfitLoss && !isValidForMode(solved.correct, c)) {
    return {
      valid: false,
      reason: `Correct answer ${solved.correct} invalid for mode ${c.mode}`,
    };
  }

  // For profit_loss with a loss result, just check finiteness
  if (isProfitLoss && !Number.isFinite(solved.correct)) {
    return { valid: false, reason: "Profit/loss answer is not finite" };
  }

  if (solved.distractors.length === 0) {
    return { valid: false, reason: "No distractors generated" };
  }

  const expectedUnit = detectExpectedUnit(questionText);
  if (expectedUnit === "currency" && unit !== "₹" && unit !== "") {
    if (/days?|hours?|minutes?|weeks?/i.test(unit)) {
      return {
        valid: false,
        reason: `Unit mismatch: expected currency, got ${unit}`,
      };
    }
  }

  // Only block non-positive for non-profit_loss topics
  if (!isProfitLoss && solved.correct <= 0) {
    return { valid: false, reason: "Correct answer is non-positive" };
  }

  return { valid: true };
}

// ── Main entry point ───────────────────────────────────────

export function generateVariants(
  originalQuestion: string,
  settings: Settings,
): VariantQuestion[] {
  const tokens = extractTokens(originalQuestion);
  if (tokens.length < 1) {
    throw new Error("Please enter a valid numeric question");
  }

  const { chapter, subTopic } = classify(originalQuestion);
  const constraint = getConstraint(settings);

  // Stage 1: Parse question structure
  const baseParsed = parseQuestion(originalQuestion);

  // HARDENING LAYER 1: Parser Validation
  // Log confidence but continue — if parser missed some numbers, the
  // solver will still try to run (it may succeed anyway).
  const parserConfident = isParserConfident(originalQuestion, baseParsed);
  if (!parserConfident && baseParsed.topic === "unknown") {
    // Parser couldn't extract structure AND missed many numbers.
    // We still continue, the generic fallback solver will handle it.
  }

  // HARDENING LAYER 2: Solver Coverage Map
  // If no dedicated solver is registered for this topic, log it.
  // hasSolverCoverage() always returns true with our current registry
  // but this guard will catch future topics that lack a solver.
  const coverageOk = hasSolverCoverage(baseParsed);
  if (!coverageOk) {
    throw new Error(
      "Unable to generate variants for this question type — solver not implemented yet",
    );
  }

  const existing = new Set<string>([originalQuestion]);
  const usedFactors = new Set<number>();
  const variants: VariantQuestion[] = [];

  const scaleFactors = [2, 3, 1.5, 4, 2.5, 0.5, 5, 6, 1.25, 0.75, 1.75, 8, 10];

  for (let i = 0; i < settings.quantity; i++) {
    let generated = false;

    for (const factor of scaleFactors) {
      if (usedFactors.has(factor)) continue;

      const mutated = mutateParsed(baseParsed, factor);

      let solved: SolveResult;
      try {
        solved = solveFromParsed(mutated, constraint);
      } catch {
        continue;
      }

      // HARDENING LAYER 3: Back-Verification
      // Plug result back into sanity checks before accepting it.
      if (!backVerify(solved, mutated, originalQuestion)) continue;

      // Explicit finite check (belt-and-suspenders)
      // profit_loss can produce negative results (loss%) — allow them
      if (!Number.isFinite(solved.correct) || Number.isNaN(solved.correct)) {
        continue;
      }
      if (mutated.topic !== "profit_loss" && solved.correct <= 0) {
        continue;
      }

      // Unit back-check: if question expects currency, unit must not be time
      const expUnit = detectExpectedUnit(originalQuestion);
      if (
        expUnit === "currency" &&
        solved.unit &&
        solved.unit !== "₹" &&
        /days?|hours?/i.test(solved.unit)
      ) {
        continue;
      }

      // Stage 4: Validate
      const validation = validateVariant(
        solved,
        constraint,
        solved.unit,
        originalQuestion,
        mutated.topic,
      );
      if (!validation.valid) continue;

      // Build variant text by scaling all number tokens
      const newValues = tokens.map((t) =>
        t.value === 0 ? 0 : scaleNice(t.value, factor),
      );
      const variantText = replaceTokens(originalQuestion, tokens, newValues);

      if (!validateQuestionText(variantText)) continue;
      if (existing.has(variantText)) continue;

      existing.add(variantText);
      usedFactors.add(factor);

      // Stage 5: Build options using option generator
      // CRITICAL FIX: regenerate distractors from THIS variant's mutated parsed data
      // so options are always anchored to this variant's own computed answer — never reused
      const variantDistractors = generateTopicDistractors(
        mutated,
        solved.correct,
        constraint,
      );
      const { options, correctLabel, correctAnswer } = buildOptions(
        solved.correct,
        variantDistractors.length >= 3
          ? variantDistractors
          : solved.distractors,
        constraint,
        solved.unit,
        mutated,
      );

      variants.push({
        id: `variant-${Date.now()}-${i}`,
        questionText: variantText,
        options,
        correctAnswer,
        correctLabel,
        chapter,
        subTopic,
        solution: solved.solution,
      });

      generated = true;
      break;
    }

    // Fallback: if no factor worked, use integer offset
    if (!generated) {
      const offset = (i + 1) * 5;
      const fallbackParsed = mutateParsed(baseParsed, 1);

      let fallbackSolved: SolveResult;
      try {
        fallbackSolved = solveFromParsed(fallbackParsed, constraint);
      } catch {
        continue;
      }

      // Apply back-verification to fallback as well
      if (!backVerify(fallbackSolved, fallbackParsed, originalQuestion))
        continue;

      const newNums = tokens.map((t) =>
        Math.max(1, Math.round(t.value) + offset),
      );
      const variantText = replaceTokens(originalQuestion, tokens, newNums);
      if (!validateQuestionText(variantText)) continue;
      if (existing.has(variantText)) continue;

      existing.add(variantText);

      // CRITICAL FIX: use fallbackParsed (not baseParsed) so distractors match this variant
      const fallbackDistractors = generateTopicDistractors(
        fallbackParsed,
        fallbackSolved.correct,
        constraint,
      );
      const { options, correctLabel, correctAnswer } = buildOptions(
        fallbackSolved.correct,
        fallbackDistractors.length >= 3
          ? fallbackDistractors
          : fallbackSolved.distractors,
        constraint,
        fallbackSolved.unit,
        fallbackParsed,
      );

      variants.push({
        id: `variant-${Date.now()}-${i}`,
        questionText: variantText,
        options,
        correctAnswer,
        correctLabel,
        chapter,
        subTopic,
        solution: fallbackSolved.solution,
      });
    }
  }

  if (variants.length === 0) {
    throw new Error("Unable to generate variants for this question type");
  }

  return variants;
}

// ── Export formatting ──────────────────────────────────────

export function formatExport(
  originalQuestion: string,
  variants: VariantQuestion[],
  settings: Settings,
): string {
  const settingsParts: string[] = [];
  if (settings.integerOnly) settingsParts.push("Integer Mode");
  else if (settings.fractionMode) settingsParts.push("Fraction Mode");
  else settingsParts.push(`${settings.decimalPrecision} Decimal(s)`);
  settingsParts.push(`Quantity: ${settings.quantity}`);

  const lines: string[] = [
    "VARIANT - Generated Questions",
    "==============================",
    "Original Question:",
    originalQuestion,
    "",
    `Settings: ${settingsParts.join(" | ")}`,
    "==============================",
    "",
  ];

  for (const [idx, v] of variants.entries()) {
    lines.push(`Variant #${idx + 1}: [${v.chapter} — ${v.subTopic}]`);
    lines.push(`Question: ${v.questionText}`);
    for (const o of v.options) {
      lines.push(`${o.label}) ${o.text}${o.isCorrect ? " ✓" : ""}`);
    }
    lines.push(`Correct Answer: ${v.correctLabel}) ${v.correctAnswer}`);
    lines.push("");
  }

  return lines.join("\n");
}

// Suppress unused-export warning — fmtLegacy is available for future use
export { fmtLegacy };
