// ============================================================
// SHARED TYPES & INTERFACES for all solvers
// ============================================================

export interface ModeConstraint {
  mode: "integer" | "fraction" | "decimal";
  decimalPrecision: number;
}

export interface SolveResult {
  correct: number;
  distractors: number[];
  unit: string;
  solution: {
    phase1: string;
    phase2: string;
    phase3: string;
  };
}
