// ============================================================
// SHARED UTILITIES for all solvers
// ============================================================

import type { ModeConstraint } from "./types";

export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

export function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b;
}

export function snapToMode(value: number, c: ModeConstraint): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) return 1;
  if (c.mode === "integer") {
    const rounded = Math.round(value);
    // Allow negative integers (e.g. loss%) — only clamp to 1 for non-negative contexts.
    // The caller is responsible for ensuring sign is appropriate.
    return rounded === 0 ? (value < 0 ? -1 : 1) : rounded;
  }
  if (c.mode === "decimal") {
    const v = Number.parseFloat(value.toFixed(c.decimalPrecision));
    // Allow negative decimals (loss%). Only adjust if the rounding produced 0.
    if (v === 0) {
      return Number.parseFloat(
        (value < 0 ? value - 0.1 : value + 0.1).toFixed(c.decimalPrecision),
      );
    }
    return v;
  }
  // fraction: allow negative
  return value === 0 ? (value < 0 ? -0.001 : 0.001) : value;
}

export function fmtRaw(val: number, c: ModeConstraint): string {
  if (c.mode === "integer") return String(Math.round(val));
  if (c.mode === "fraction") return toFractionString(val);
  return val.toFixed(c.decimalPrecision);
}

export function toFractionString(val: number): string {
  if (Number.isInteger(val) || Math.abs(val - Math.round(val)) < 1e-9) {
    return String(Math.round(val));
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
  if (d === 1) return String(n);
  return `${n}/${d}`;
}
