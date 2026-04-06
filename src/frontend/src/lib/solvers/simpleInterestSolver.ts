// ============================================================
// SIMPLE & COMPOUND INTEREST SOLVER
// ============================================================

import { evaluate, number as mjsNumber } from "mathjs";
import type { CompoundInterestParams, SimpleInterestParams } from "../aiParser";
import type { ModeConstraint, SolveResult } from "./types";
import { fmtRaw, gcd, snapToMode } from "./utils";

function mjsPow(base: number, exp: number): number {
  return mjsNumber(evaluate(`${base} ^ ${exp}`));
}

export function solveSimpleInterest(
  params: SimpleInterestParams,
  c: ModeConstraint,
): SolveResult {
  let { principal, rate, time } = params;

  if (c.mode === "integer") {
    rate = Math.max(5, Math.round(rate / 5) * 5);
    time = Math.max(1, Math.round(time));
    // Snap P so SI = P*R*T/100 is integer
    const rt = rate * time;
    const g = gcd(rt, 100);
    const factor = 100 / g;
    principal = Math.max(factor, Math.round(principal / factor) * factor);
  }

  const SI = (principal * rate * time) / 100;
  const total = principal + SI;

  const asked = params.asked;

  if (asked === "principal") {
    const correct = snapToMode(principal, c);
    return basicSIResult(
      correct,
      SI,
      total,
      principal,
      rate,
      time,
      c,
      "principal",
    );
  }

  if (asked === "rate") {
    const correct = snapToMode(rate, c);
    return basicSIResult(correct, SI, total, principal, rate, time, c, "rate");
  }

  if (asked === "time") {
    const correct = snapToMode(time, c);
    return basicSIResult(correct, SI, total, principal, rate, time, c, "time");
  }

  if (asked === "total") {
    const correct = snapToMode(total, c);
    return basicSIResult(correct, SI, total, principal, rate, time, c, "total");
  }

  // Default: find SI
  const correct = snapToMode(SI, c);
  return basicSIResult(correct, SI, total, principal, rate, time, c, "si");
}

function basicSIResult(
  correct: number,
  SI: number,
  total: number,
  P: number,
  R: number,
  T: number,
  c: ModeConstraint,
  asked: SimpleInterestParams["asked"],
): SolveResult {
  // Realistic distractors:
  // 1. Forgot T (used P*R/100)
  const d1 = snapToMode((P * R) / 100, c);
  // 2. Used T where R should be
  const d2 = snapToMode((P * T) / 100, c);
  // 3. Added interest to wrong base
  const d3 = snapToMode(SI * 2, c);

  return {
    correct,
    distractors: dedup([d1, d2, d3], correct, c),
    unit: "₹",
    solution: {
      phase1: `P = ₹${P}, R = ${R}% p.a., T = ${T} years`,
      phase2: "SI = P × R × T / 100",
      phase3: `= ${P} × ${R} × ${T} / 100 = ₹${SI.toFixed(2)}${asked === "total" ? `, Total = ₹${total.toFixed(2)}` : ""}`,
    },
  };
}

export function solveCompoundInterest(
  params: CompoundInterestParams,
  c: ModeConstraint,
): SolveResult {
  let { principal, rate, time, frequency, asked } = params;

  if (c.mode === "integer") {
    rate = Math.max(5, Math.round(rate / 5) * 5);
    time = Math.max(1, Math.round(time));
    principal = Math.max(100, Math.round(principal / 100) * 100);
  }

  let adjustedRate = rate;
  let adjustedTime = time;

  if (frequency === "half_yearly") {
    adjustedRate = rate / 2;
    adjustedTime = time * 2;
  } else if (frequency === "quarterly") {
    adjustedRate = rate / 4;
    adjustedTime = time * 4;
  }

  const amount = principal * mjsPow(1 + adjustedRate / 100, adjustedTime);
  const CI = amount - principal;
  const SI = (principal * rate * time) / 100;

  const correct = snapToMode(asked === "amount" ? amount : CI, c);

  // Distractors:
  // 1. Used SI formula instead of CI
  const d1 = snapToMode(SI, c);
  // 2. Added principal twice
  const d2 = snapToMode(amount + principal, c);
  // 3. Wrong frequency (used annual when half-yearly)
  const wrongAmount = principal * mjsPow(1 + rate / 100, time);
  const d3 = snapToMode(
    asked === "amount" ? wrongAmount : wrongAmount - principal,
    c,
  );

  return {
    correct,
    distractors: dedup([d1, d2, d3], correct, c),
    unit: "₹",
    solution: {
      phase1: `P = ₹${principal}, R = ${rate}% p.a., T = ${time} years${frequency !== "annual" ? `, Compounded ${frequency}` : ""}`,
      phase2: `Amount = P × (1 + ${adjustedRate}/${100})^${adjustedTime}`,
      phase3: `= ₹${amount.toFixed(2)}, CI = ₹${CI.toFixed(2)}`,
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
  let off = 50;
  while (result.length < 3) {
    const d = snapToMode(correct + off, c);
    const key = fmtRaw(d, c);
    if (!seen.has(key) && d > 0) {
      seen.add(key);
      result.push(d);
    }
    off += 50;
    if (off > 5000) break;
  }
  return result.slice(0, 3);
}
