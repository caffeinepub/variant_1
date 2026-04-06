// solverApi.ts — API client for the Python math solver server
// Change SOLVER_URL here to switch between local and deployed server.

export const SOLVER_URL = "http://localhost:8000";

// ------------------------------------------------------------------ //
// Types                                                                //
// ------------------------------------------------------------------ //

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
  /** Display strings, e.g. ["25%", "30%", "35%", "40%"] */
  options: string[];
  /** Full option objects with value/unit/display */
  options_full: SolverOption[];
  /** Index into `options` / `options_full` that is correct */
  correct_index: number;
  solution_steps: string[];
  /** Extracted conditions — pass to /api/variant to avoid re-extraction */
  conditions?: Record<string, unknown>;
}

export interface VariantResult extends SolveResult {
  new_question_text: string;
}

export interface ServerError {
  error: string;
  step: string;
}

// ------------------------------------------------------------------ //
// Helpers                                                              //
// ------------------------------------------------------------------ //

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${SOLVER_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await response.json();

  if (!response.ok) {
    const err = json as ServerError;
    throw new SolverApiError(
      err.error ?? `Server error ${response.status}`,
      err.step ?? "unknown",
      response.status,
    );
  }

  return json as T;
}

export class SolverApiError extends Error {
  readonly step: string;
  readonly statusCode: number;

  constructor(message: string, step: string, statusCode = 400) {
    super(message);
    this.name = "SolverApiError";
    this.step = step;
    this.statusCode = statusCode;
  }
}

// ------------------------------------------------------------------ //
// Public API                                                           //
// ------------------------------------------------------------------ //

/**
 * Solve a question: runs extract → solve → validate → generate options on the server.
 * Throws SolverApiError on any server error.
 */
export async function solveQuestion(question: string): Promise<SolveResult> {
  return post<SolveResult>("/api/solve", { question });
}

/**
 * Generate a true variant: new numbers, same structure, recomputed answer.
 * Pass previously extracted conditions to avoid re-extraction.
 */
export async function generateVariantFromServer(
  question: string,
  conditions?: Record<string, unknown>,
): Promise<VariantResult> {
  return post<VariantResult>("/api/variant", { question, conditions });
}

/**
 * Health check — call before solving to confirm server is reachable.
 */
export async function checkHealth(): Promise<{
  status: string;
  sympy_version: string;
}> {
  const response = await fetch(`${SOLVER_URL}/api/health`);
  if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
  return response.json();
}
