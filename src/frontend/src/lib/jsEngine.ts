// ============================================================
// JS ENGINE — Pure browser math engine (no server required)
// Pipeline: parseQuestion → routeToSolver → buildOptions → format
// Replaces Python FastAPI server calls entirely.
// ============================================================

import { parseQuestion } from "./aiParser";
import { buildOptions } from "./optionGenerator";
import { solveAverages } from "./solvers/averagesSolver";
import { solveMixture } from "./solvers/mixtureSolver";
import { solvePercentage } from "./solvers/percentageSolver";
import { solveProfitLoss } from "./solvers/profitLossSolver";
import { solveRatio } from "./solvers/ratioSolver";
import {
  solveCompoundInterest,
  solveSimpleInterest,
} from "./solvers/simpleInterestSolver";
import { solveTimeDistance } from "./solvers/timeDistanceSolver";
import type {
  ModeConstraint,
  SolveResult as SolverResult,
} from "./solvers/types";
import { fmtRaw } from "./solvers/utils";
import { solveWorkTime } from "./solvers/workTimeSolver";
import { solveWorkWagesAdvanced } from "./solvers/workWagesSolver";
import type { Settings } from "./variantEngine";

// Re-export types to match solverApi.ts shape
export interface SolverOption {
  value: number | string;
  unit: string;
  display: string;
}

export interface SolverAnswer {
  value: number | string;
  unit: string;
  display: string;
}

export interface SolveResult {
  answer: SolverAnswer;
  options: string[];
  options_full: SolverOption[];
  correct_index: number;
  solution_steps: string[];
  conditions?: Record<string, unknown>;
}

export interface VariantResult extends SolveResult {
  new_question_text: string;
}

// ── Mode constraint builder ─────────────────────────────────────────────

function buildConstraint(settings: Settings): ModeConstraint {
  if (settings.integerOnly) return { mode: "integer", decimalPrecision: 0 };
  if (settings.fractionMode) return { mode: "fraction", decimalPrecision: 2 };
  return { mode: "decimal", decimalPrecision: settings.decimalPrecision ?? 2 };
}

// ── Unit formatter ──────────────────────────────────────────────────────

function formatWithUnit(
  value: number,
  unit: string,
  c: ModeConstraint,
): string {
  const raw = fmtRaw(value, c);
  if (!unit) return raw;
  if (unit === "₹" || unit === "currency") return `₹${raw}`;
  if (unit === "Rs") return `Rs ${raw}`;
  if (unit === "%") return `${raw}%`;
  // Suffix units: days, hours, km, kg, litres, etc.
  return `${raw} ${unit}`;
}

// ── Dispatch to correct solver ──────────────────────────────────────────

function dispatch(text: string, c: ModeConstraint): SolverResult {
  const parsed = parseQuestion(text);

  if (parsed.topic === "unknown") {
    throw new Error(
      "Could not identify the question type. Try adding keywords like 'profit', 'discount', 'time', 'speed', 'mixture', 'average', 'interest', etc.",
    );
  }

  switch (parsed.topic) {
    case "work_wages":
      return solveWorkWagesAdvanced(parsed, c);
    case "profit_loss":
      return solveProfitLoss(parsed, c);
    case "time_distance":
      return solveTimeDistance(parsed, c);
    case "simple_interest":
      return solveSimpleInterest(parsed, c);
    case "compound_interest":
      return solveCompoundInterest(parsed, c);
    case "percentage":
      return solvePercentage(parsed, c);
    case "ratio":
      return solveRatio(parsed, c);
    case "work_time":
      return solveWorkTime(parsed, c);
    case "mixture":
      return solveMixture(parsed, c);
    case "averages":
      return solveAverages(parsed, c);
    default:
      throw new Error("Unsupported question type");
  }
}

// ── Build solution steps array ─────────────────────────────────────────

function buildSolutionSteps(solution: SolverResult["solution"]): string[] {
  const steps: string[] = [];
  if (solution.phase1) steps.push(solution.phase1);
  if (solution.phase2) steps.push(solution.phase2);
  if (solution.phase3) steps.push(solution.phase3);
  return steps.filter(Boolean);
}

// ── Core solve function ─────────────────────────────────────────────────

export function solveQuestionJS(
  question: string,
  settings: Settings,
): SolveResult {
  const c = buildConstraint(settings);
  const solved = dispatch(question, c);

  const { options: builtOptions } = buildOptions(
    solved.correct,
    solved.distractors,
    c,
    solved.unit,
  );

  // Map to options_full
  const options_full: SolverOption[] = builtOptions.map((o) => ({
    value: o.text,
    unit: solved.unit,
    display: o.text,
  }));

  const options: string[] = builtOptions.map((o) => o.text);

  const correct_index = builtOptions.findIndex((o) => o.isCorrect);

  const display = formatWithUnit(solved.correct, solved.unit, c);

  return {
    answer: {
      value: solved.correct,
      unit: solved.unit,
      display,
    },
    options,
    options_full,
    correct_index: correct_index >= 0 ? correct_index : 0,
    solution_steps: buildSolutionSteps(solved.solution),
    conditions: {},
  };
}

// ── Number token helpers for variant generation ─────────────────────────

interface NumberToken {
  value: number;
  start: number;
  end: number;
}

function extractTokens(text: string): NumberToken[] {
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
    const numStr = Number.isInteger(token.newVal)
      ? String(Math.round(token.newVal))
      : Number.parseFloat(token.newVal.toFixed(2)).toString();
    result = result.slice(0, token.start) + numStr + result.slice(token.end);
  }
  return result;
}

function mutateSingle(value: number): number {
  // ±10–40% mutation, always rounded to integer, minimum 1
  const pctOptions = [0.1, 0.15, 0.2, 0.25, 0.3, 0.4];
  const pct = pctOptions[Math.floor(Math.random() * pctOptions.length)];
  const sign = Math.random() < 0.5 ? 1 : -1;
  const mutated = value * (1 + sign * pct);
  return Math.max(1, Math.round(mutated));
}

// ── Variant generation ──────────────────────────────────────────────────

export function generateVariantJS(
  question: string,
  settings: Settings,
): VariantResult {
  const c = buildConstraint(settings);
  const tokens = extractTokens(question);

  if (tokens.length === 0) {
    // No numbers — just solve the original
    const base = solveQuestionJS(question, settings);
    return { ...base, new_question_text: question };
  }

  const MAX_RETRIES = 5;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Mutate all numeric tokens
      const newValues = tokens.map((t) => {
        // Don't mutate small counting numbers (1, 2, 3) too aggressively
        if (t.value <= 3)
          return Math.max(1, t.value + Math.floor(Math.random() * 3));
        return mutateSingle(t.value);
      });

      const newQuestionText = replaceTokens(question, tokens, newValues);

      // Must differ from original
      if (newQuestionText === question) continue;

      // Run full pipeline on mutated question
      const solved = dispatch(newQuestionText, c);

      // Basic sanity: answer must be finite and meaningful
      if (!Number.isFinite(solved.correct) || Number.isNaN(solved.correct)) {
        continue;
      }

      const { options: builtOptions } = buildOptions(
        solved.correct,
        solved.distractors,
        c,
        solved.unit,
      );

      const options_full: SolverOption[] = builtOptions.map((o) => ({
        value: o.text,
        unit: solved.unit,
        display: o.text,
      }));

      const options: string[] = builtOptions.map((o) => o.text);
      const correct_index = builtOptions.findIndex((o) => o.isCorrect);
      const display = formatWithUnit(solved.correct, solved.unit, c);

      return {
        answer: { value: solved.correct, unit: solved.unit, display },
        options,
        options_full,
        correct_index: correct_index >= 0 ? correct_index : 0,
        solution_steps: buildSolutionSteps(solved.solution),
        conditions: {},
        new_question_text: newQuestionText,
      };
    } catch {
      // Retry with different mutation
    }
  }

  // All retries failed — return original solve result
  const base = solveQuestionJS(question, settings);
  return { ...base, new_question_text: question };
}
