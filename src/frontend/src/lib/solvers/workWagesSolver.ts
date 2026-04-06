// ============================================================
// WORK & WAGES SOLVER
// Handles ALL cases including departure conditions
// Uses algebraic equation to find unknown total time T
// ============================================================

import type { WorkWagesParams } from "../aiParser";
import type { ModeConstraint, SolveResult } from "./types";
import { fmtRaw, snapToMode } from "./utils";

/**
 * Core algebra for Work & Wages with departure events
 *
 * Let T = total time to complete the work.
 * For each worker i:
 *   rate_i = 1 / time_i  (fraction of work done per hour)
 *   actual_time_i = depends on departure events:
 *     - No event:              T
 *     - leaves_after = x:      x  (works x hours from start)
 *     - leaves_before_end = y: T - y  (works T-y hours)
 *
 * Work equation:
 *   sum(rate_i * actual_time_i) = 1
 *
 * Since some actual_times contain T and some are constants,
 * we separate the equation:
 *   T * sum(rate_i where time is T or T-y)
 *   + sum(rate_i * fixed_time_i)
 *   - sum(rate_i * y_i)  [for leaves_before_end]
 *   = 1
 *
 * Solving for T:
 *   T = (1 - constant_part + leaves_before_correction) / T_coefficient
 */

export function solveWorkWagesAdvanced(
  params: WorkWagesParams,
  c: ModeConstraint,
): SolveResult {
  const { workers, events, total_payment, asked_worker } = params;

  if (workers.length === 0) {
    const fallback = snapToMode(total_payment / 3, c);
    return {
      correct: fallback,
      distractors: [
        snapToMode(total_payment / 2, c),
        snapToMode(total_payment / 4, c),
        snapToMode(total_payment * 0.4, c),
      ],
      unit: "₹",
      solution: {
        phase1: `Total Payment = ₹${total_payment}`,
        phase2: "Distribute equally (no rate info)",
        phase3: `Each ≈ ₹${fallback}`,
      },
    };
  }

  const rates = workers.map((w) => (w.time > 0 ? 1 / w.time : 0));

  // Categorize each worker's time contribution
  // type: "fixed" | "full_T" | "T_minus_y"
  interface WorkerContrib {
    name: string;
    rate: number;
    type: "fixed" | "full_T" | "T_minus_y";
    fixed_time: number; // used when type === "fixed"
    minus_y: number; // used when type === "T_minus_y"
  }

  const contribs: WorkerContrib[] = workers.map((w, i) => {
    const event = events.find((e) => e.worker === w.name);
    if (!event) {
      return {
        name: w.name,
        rate: rates[i],
        type: "full_T",
        fixed_time: 0,
        minus_y: 0,
      };
    }
    if (event.leaves_after !== undefined) {
      return {
        name: w.name,
        rate: rates[i],
        type: "fixed",
        fixed_time: event.leaves_after,
        minus_y: 0,
      };
    }
    if (event.leaves_before_end !== undefined) {
      return {
        name: w.name,
        rate: rates[i],
        type: "T_minus_y",
        fixed_time: 0,
        minus_y: event.leaves_before_end,
      };
    }
    return {
      name: w.name,
      rate: rates[i],
      type: "full_T",
      fixed_time: 0,
      minus_y: 0,
    };
  });

  // Solve for T:
  // sum over all workers: rate_i * time_i = 1
  // T coefficient = sum of rate_i for workers with type=full_T or T_minus_y
  // constant part = sum of rate_i * fixed_time_i for type=fixed
  // correction from T_minus_y: rate_i * (T - y) = rate_i*T - rate_i*y
  //   contributes rate_i to T coefficient and -rate_i*y to constant
  // So: T * T_coeff + constant_part = 1
  // T = (1 - constant_part) / T_coeff

  let T_coeff = 0;
  let constant_part = 0;

  for (const contrib of contribs) {
    if (contrib.type === "fixed") {
      constant_part += contrib.rate * contrib.fixed_time;
    } else if (contrib.type === "full_T") {
      T_coeff += contrib.rate;
    } else {
      // T_minus_y: contributes rate to T_coeff, -rate*y to constant
      T_coeff += contrib.rate;
      constant_part -= contrib.rate * contrib.minus_y;
    }
  }

  let T: number;
  if (Math.abs(T_coeff) < 1e-12) {
    // Degenerate: all workers have fixed times
    T = contribs.reduce((sum, contrib) => {
      if (contrib.type === "fixed") return Math.max(sum, contrib.fixed_time);
      return sum;
    }, 1);
  } else {
    T = (1 - constant_part) / T_coeff;
  }

  // Clamp T to valid range
  T = Math.max(0.01, T);

  // Calculate actual work time for each worker
  const actualTimes = contribs.map((contrib) => {
    if (contrib.type === "fixed") return contrib.fixed_time;
    if (contrib.type === "full_T") return T;
    return Math.max(0, T - contrib.minus_y);
  });

  // Work fractions
  const workDone = contribs.map((contrib, i) => contrib.rate * actualTimes[i]);
  const totalWorkDone = workDone.reduce((s, w) => s + w, 0);

  // Payment proportional to work done
  const normalizedShares = workDone.map((w) =>
    totalWorkDone > 0 ? w / totalWorkDone : 1 / workers.length,
  );

  // Find asked worker index
  const askedIdx = workers.findIndex(
    (w) => w.name === asked_worker.toUpperCase(),
  );
  const targetIdx = askedIdx >= 0 ? askedIdx : 1;

  // Integer mode: find a multiplier of total_payment that gives clean shares
  let scaledPayment = total_payment;
  if (c.mode === "integer") {
    let found = false;
    for (let mult = 1; mult <= 20 && !found; mult++) {
      const candidate = total_payment * mult;
      const shares = normalizedShares.map((s) => s * candidate);
      if (shares.every((s) => Math.abs(s - Math.round(s)) < 0.5)) {
        scaledPayment = candidate;
        found = true;
      }
    }
  }

  const paymentShares = normalizedShares.map((s) =>
    snapToMode(s * scaledPayment, c),
  );

  const correct = paymentShares[targetIdx];
  const others = paymentShares.filter((_, i) => i !== targetIdx);

  // Realistic distractors for Work & Wages:
  // 1. Equal split (forgot efficiency)
  const equalSplit = snapToMode(scaledPayment / workers.length, c);
  // 2. Used time directly instead of efficiency (proportional to time, not 1/time)
  const timeShares = actualTimes.map(
    (t) => t / actualTimes.reduce((s, x) => s + x, 0),
  );
  const wrongByTime = snapToMode(timeShares[targetIdx] * scaledPayment, c);
  // 3. Correct person's pay at full time (ignoring departure)
  const fullTimeShare = rates[targetIdx] / rates.reduce((s, r) => s + r, 0);
  const wrongIgnoreDepart = snapToMode(fullTimeShare * scaledPayment, c);

  const distractorCandidates = [
    equalSplit,
    wrongByTime,
    wrongIgnoreDepart,
    others[0] ?? snapToMode(correct * 1.2, c),
    others[1] ?? snapToMode(correct * 0.8, c),
  ];

  // Deduplicate
  const correctKey = fmtRaw(correct, c);
  const seen = new Set<string>([correctKey]);
  const distractors: number[] = [];
  for (const d of distractorCandidates) {
    if (d > 0 && d !== correct) {
      const key = fmtRaw(d, c);
      if (!seen.has(key)) {
        seen.add(key);
        distractors.push(d);
        if (distractors.length === 3) break;
      }
    }
  }

  // Fallback padding
  let pad = 50;
  while (distractors.length < 3) {
    const d = snapToMode(correct + pad, c);
    const key = fmtRaw(d, c);
    if (!seen.has(key) && d > 0) {
      seen.add(key);
      distractors.push(d);
    }
    pad += 50;
    if (pad > 5000) break;
  }

  // Build solution text
  const askedLabel = workers[targetIdx]?.name ?? "B";
  const workerSummary = workers
    .map((w, i) => {
      const ev = events.find((e) => e.worker === w.name);
      let timeDesc = "T";
      if (ev?.leaves_after !== undefined) timeDesc = `${ev.leaves_after} hrs`;
      else if (ev?.leaves_before_end !== undefined)
        timeDesc = `T - ${ev.leaves_before_end} hrs`;
      return `${w.name}: rate=1/${w.time}, works ${timeDesc}, work done=${workDone[i].toFixed(4)}`;
    })
    .join(" | ");

  return {
    correct,
    distractors: distractors.slice(0, 3),
    unit: "₹",
    solution: {
      phase1: `Workers & rates: ${workers.map((w) => `${w.name}=1/${w.time}`).join(", ")}. Total payment = ₹${scaledPayment}`,
      phase2: `Solve for T: ${T_coeff.toFixed(4)}·T + ${constant_part.toFixed(4)} = 1 → T = ${T.toFixed(4)} hrs. ${workerSummary}`,
      phase3: `${askedLabel}'s share = ${workDone[targetIdx].toFixed(4)} / ${totalWorkDone.toFixed(4)} × ₹${scaledPayment} = ₹${correct}`,
    },
  };
}
