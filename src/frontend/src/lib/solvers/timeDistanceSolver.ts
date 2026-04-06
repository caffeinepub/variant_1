// ============================================================
// TIME & DISTANCE SOLVER
// ============================================================

import type { TimeDistanceParams } from "../aiParser";
import type { ModeConstraint, SolveResult } from "./types";
import { fmtRaw, snapToMode } from "./utils";

export function solveTimeDistance(
  params: TimeDistanceParams,
  c: ModeConstraint,
): SolveResult {
  switch (params.subtype) {
    case "average":
      return solveAverageSpeed(params, c);
    case "relative_opposite":
      return solveRelativeOpposite(params, c);
    case "relative_same":
      return solveRelativeSame(params, c);
    default:
      return solveSimple(params, c);
  }
}

function solveSimple(
  params: TimeDistanceParams,
  c: ModeConstraint,
): SolveResult {
  let speed = params.speed ?? 60;
  let distance = params.distance ?? 120;

  if (c.mode === "integer") {
    speed = Math.max(10, Math.round(speed / 10) * 10);
    const time = Math.max(1, Math.round(distance / speed));
    distance = speed * time;
  }

  if (params.asked === "speed") {
    const t = params.time ?? Math.round(distance / speed);
    const correctSpeed = distance / t;
    const correct = snapToMode(correctSpeed, c);
    return {
      correct,
      distractors: dedup(
        [
          snapToMode(distance * t, c), // multiplied instead of divided
          snapToMode(distance - t, c), // subtracted
          snapToMode(correct * 2, c),
        ],
        correct,
        c,
      ),
      unit: "km/h",
      solution: {
        phase1: `Distance = ${distance} km, Time = ${t} hours`,
        phase2: "Speed = Distance ÷ Time",
        phase3: `Speed = ${distance} ÷ ${t} = ${fmtRaw(correct, c)} km/h`,
      },
    };
  }

  if (params.asked === "distance") {
    const t = params.time ?? Math.round(distance / speed);
    const correctDist = speed * t;
    const correct = snapToMode(correctDist, c);
    return {
      correct,
      distractors: dedup(
        [
          snapToMode(distance / t, c), // divided instead of multiplied
          snapToMode(speed + t, c), // added
          snapToMode(correct + speed, c),
        ],
        correct,
        c,
      ),
      unit: "km",
      solution: {
        phase1: `Speed = ${speed} km/h, Time = ${t} hours`,
        phase2: "Distance = Speed × Time",
        phase3: `Distance = ${speed} × ${t} = ${fmtRaw(correct, c)} km`,
      },
    };
  }

  // Default: find time
  const time = distance / speed;
  const correct = snapToMode(time, c);
  return {
    correct,
    distractors: dedup(
      [
        snapToMode(distance * speed, c), // multiplied instead of divided
        snapToMode(speed / distance, c), // inverted
        snapToMode(correct + 1, c),
      ],
      correct,
      c,
    ),
    unit: "hours",
    solution: {
      phase1: `Speed = ${speed} km/h, Distance = ${distance} km`,
      phase2: "Time = Distance ÷ Speed",
      phase3: `Time = ${distance} ÷ ${speed} = ${fmtRaw(correct, c)} hours`,
    },
  };
}

function solveAverageSpeed(
  params: TimeDistanceParams,
  c: ModeConstraint,
): SolveResult {
  const s1 = params.speed ?? 40;
  const s2 = params.speed2 ?? params.distance ?? 60;

  // Average speed for equal distances: 2*s1*s2 / (s1+s2)
  const avgSpeed = (2 * s1 * s2) / (s1 + s2);
  const correct = snapToMode(avgSpeed, c);

  return {
    correct,
    distractors: dedup(
      [
        snapToMode((s1 + s2) / 2, c), // arithmetic mean (wrong)
        snapToMode((s1 * s2) / (s1 + s2), c), // forgot to multiply by 2
        snapToMode(correct * 1.1, c),
      ],
      correct,
      c,
    ),
    unit: "km/h",
    solution: {
      phase1: `Speed onward = ${s1} km/h, Speed return = ${s2} km/h`,
      phase2: "Average Speed = 2 × s1 × s2 / (s1 + s2)",
      phase3: `= 2 × ${s1} × ${s2} / (${s1} + ${s2}) = ${fmtRaw(correct, c)} km/h`,
    },
  };
}

function solveRelativeOpposite(
  params: TimeDistanceParams,
  c: ModeConstraint,
): SolveResult {
  const s1 = params.speed ?? 40;
  const s2 = params.speed2 ?? 30;
  const d = params.distance ?? 350;

  // Meeting time: distance / (s1 + s2)
  const relSpeed = s1 + s2;
  const meetTime = d / relSpeed;
  const correct = snapToMode(meetTime, c);

  return {
    correct,
    distractors: dedup(
      [
        snapToMode(d / (s1 - s2), c), // used difference instead of sum
        snapToMode(d / Math.max(s1, s2), c), // used one speed only
        snapToMode(correct + 1, c),
      ],
      correct,
      c,
    ),
    unit: "hours",
    solution: {
      phase1: `Speed A = ${s1} km/h, Speed B = ${s2} km/h, Distance = ${d} km`,
      phase2: "Relative speed (opposite) = s1 + s2",
      phase3: `Time = ${d} / (${s1} + ${s2}) = ${fmtRaw(correct, c)} hours`,
    },
  };
}

function solveRelativeSame(
  params: TimeDistanceParams,
  c: ModeConstraint,
): SolveResult {
  const s1 = params.speed ?? 60;
  const s2 = params.speed2 ?? 40;
  const d = params.distance ?? 100;

  const relSpeed = Math.abs(s1 - s2);
  if (relSpeed < 1e-9) {
    return solveSimple(params, c);
  }
  const overtakeTime = d / relSpeed;
  const correct = snapToMode(overtakeTime, c);

  return {
    correct,
    distractors: dedup(
      [
        snapToMode(d / (s1 + s2), c), // used sum instead of diff
        snapToMode(d / Math.max(s1, s2), c), // used one speed
        snapToMode(correct * 2, c),
      ],
      correct,
      c,
    ),
    unit: "hours",
    solution: {
      phase1: `Speed A = ${s1} km/h, Speed B = ${s2} km/h, Head start = ${d} km`,
      phase2: "Relative speed (same direction) = |s1 - s2|",
      phase3: `Time = ${d} / |${s1} - ${s2}| = ${fmtRaw(correct, c)} hours`,
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
  let off = 1;
  while (result.length < 3) {
    const d = snapToMode(correct + off, c);
    const key = fmtRaw(d, c);
    if (!seen.has(key) && d > 0) {
      seen.add(key);
      result.push(d);
    }
    off++;
    if (off > 50) break;
  }
  return result.slice(0, 3);
}
