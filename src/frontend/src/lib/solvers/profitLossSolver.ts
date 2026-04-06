// ============================================================
// PROFIT & LOSS SOLVER
// Handles: standard, cheat/weight fraud, successive discounts, free items
//
// FREE ITEMS — DUAL MODE:
//   MODE A (find profit%): markup + discount given → compute profit%
//   MODE B (find markup%): discount + profit_target given → solve for markup%
//
//   UNIFIED EQUATION:
//     Total SP = items_paid × MP × (1 - discount/100)
//     Total CP = total_items_given × cp
//     profit_factor = Total SP / Total CP
//     → MP/CP = profit_factor × total_items / (items_paid × (1 - discount/100))
//     → markup% = (MP/CP - 1) × 100
//
// PARAMETER CONSTRAINTS enforced before any computation:
//   - discount_pct must be < 100 (otherwise SP goes negative)
//   - markup_pct must be >= 0
//   - selling_fraction must be > 0 and <= 1
//   - buying_fraction must be > 0
// Loss% results are ALLOWED — do NOT force positive.
// ============================================================

import type { ProfitLossParams } from "../aiParser";
import type { ModeConstraint, SolveResult } from "./types";
import { fmtRaw, snapToMode } from "./utils";

// ── Parameter Validation ───────────────────────────────────────────

export interface ParamValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateProfitLossParams(
  params: ProfitLossParams,
): ParamValidationResult {
  const {
    markup_pct = 20,
    discount_pct,
    buying_fraction = 1,
    selling_fraction = 1,
  } = params;

  if (discount_pct !== undefined && discount_pct >= 100) {
    return {
      valid: false,
      reason: `Discount ${discount_pct}% >= 100% makes selling price zero or negative (impossible)`,
    };
  }

  if (markup_pct < 0) {
    return { valid: false, reason: `Markup ${markup_pct}% cannot be negative` };
  }

  if (selling_fraction <= 0 || selling_fraction > 1) {
    return {
      valid: false,
      reason: `Selling fraction ${selling_fraction} must be in (0, 1]`,
    };
  }
  if (buying_fraction <= 0) {
    return {
      valid: false,
      reason: `Buying fraction ${buying_fraction} must be > 0`,
    };
  }

  const cp = params.cp ?? 100;
  const mp = cp * (1 + markup_pct / 100);
  const sp = discount_pct !== undefined ? mp * (1 - discount_pct / 100) : mp;

  if (sp <= 0) {
    return {
      valid: false,
      reason: `Computed SP = ${sp.toFixed(2)} is non-positive — question is impossible`,
    };
  }

  const realSP = sp / selling_fraction;
  if (realSP <= 0) {
    return {
      valid: false,
      reason: `Real SP = ${realSP.toFixed(2)} is non-positive after selling fraction`,
    };
  }

  return { valid: true };
}

// ── Main solver ────────────────────────────────────────────────────

export function solveProfitLoss(
  params: ProfitLossParams,
  c: ModeConstraint,
): SolveResult {
  if (params.subtype !== "free_items") {
    const validation = validateProfitLossParams(params);
    if (!validation.valid) {
      throw new Error(`Invalid profit/loss parameters: ${validation.reason}`);
    }
  }

  switch (params.subtype) {
    case "free_items":
      return solveFreeItems(params, c);
    case "cheat_weight":
      return solveCheatWeight(params, c);
    case "successive_discount":
      return solveSuccessiveDiscount(params, c);
    default:
      return solveStandard(params, c);
  }
}

/**
 * FREE ITEMS — handles two sub-cases:
 *
 * CASE A: asked === "markup" (or profit_target is given)
 *   Given: discount%, free item count (x free on y), profit_target%
 *   Find:  markup%
 *
 *   Unified equation:
 *     Total SP = y × MP × (1 - discount/100)     [customer pays for y, each at discounted MP]
 *     Total CP = (y + x) × cp                     [dealer gives y+x items]
 *     profit_factor = 1 + profit_target/100
 *     profit_factor = Total SP / Total CP
 *     → MP/CP = profit_factor × (y+x) / (y × (1 - discount/100))
 *     → markup% = (MP/CP - 1) × 100
 *
 * CASE B: markup% and discount% are given, find profit%
 *   Total SP = y × cp × (1 + markup/100) × (1 - discount/100)
 *   Total CP = (y + x) × cp
 *   profit% = (Total SP / Total CP - 1) × 100
 */
function solveFreeItems(
  params: ProfitLossParams,
  c: ModeConstraint,
): SolveResult {
  const {
    cp = 100,
    markup_pct = 0,
    discount_pct,
    free_items_given: x = 1,
    free_items_on: y = 9,
    profit_target,
    asked,
  } = params as ProfitLossParams & { profit_target?: number; asked?: string };

  const discount = discount_pct !== undefined ? Math.min(99, discount_pct) : 0;
  const totalItems = y + x;
  const discountFactor = 1 - discount / 100;

  // CASE A: Find markup% (question gives discount + free items + target profit)
  const isMarkupAsked =
    asked === "markup" ||
    (profit_target !== undefined && profit_target > 0 && markup_pct === 0);

  if (isMarkupAsked && profit_target !== undefined) {
    const profitFactor = 1 + profit_target / 100;
    // MP/CP = profitFactor × totalItems / (y × discountFactor)
    const mpCpRatio = (profitFactor * totalItems) / (y * discountFactor);
    const markupPct = (mpCpRatio - 1) * 100;

    if (markupPct <= 0) {
      throw new Error(
        `Computed markup = ${markupPct.toFixed(2)}% is not positive — question is impossible with these values`,
      );
    }

    const correct = snapToMode(markupPct, c);

    // Generate solution steps
    const totalSP = y * cp * mpCpRatio * discountFactor;
    const totalCP = totalItems * cp;
    const verifyProfit = ((totalSP - totalCP) / totalCP) * 100;

    return {
      correct,
      distractors: [],
      unit: "%",
      solution: {
        phase1: [
          `CP per item = ₹${cp}`,
          `Free items: ${x} free on ${y} → total given = ${totalItems}`,
          `Discount = ${discount}%`,
          `Target profit = ${profit_target}%`,
        ].join(", "),
        phase2: [
          `profit_factor = 1 + ${profit_target}/100 = ${profitFactor}`,
          `MP/CP = ${profitFactor} × ${totalItems} / (${y} × ${discountFactor.toFixed(4)})`,
          `MP/CP = ${mpCpRatio.toFixed(4)}`,
        ].join(" | "),
        phase3: `Markup% = (MP/CP − 1) × 100 = (${mpCpRatio.toFixed(4)} − 1) × 100 = ${markupPct.toFixed(2)}% ✓ Verify: profit = ${verifyProfit.toFixed(1)}%`,
      },
    };
  }

  // CASE B: Find profit% (markup + discount given)
  const spPerItem = cp * (1 + markup_pct / 100) * discountFactor;
  const totalCP = totalItems * cp;
  const totalSP = y * spPerItem;
  const profit = totalSP - totalCP;
  const profitPct = (profit / totalCP) * 100;
  const isLoss = profit < 0;

  const correct = snapToMode(profitPct, c);

  return {
    correct,
    distractors: [],
    unit: "%",
    solution: {
      phase1: [
        `CP per item = ₹${cp}`,
        `Free items: ${x} free on ${y} (total given = ${totalItems})`,
        markup_pct > 0 ? `Markup = ${markup_pct}%` : "",
        discount > 0 ? `Discount = ${discount}%` : "",
      ]
        .filter(Boolean)
        .join(", "),
      phase2: [
        `SP per item = ₹${cp} × ${1 + markup_pct / 100}${discount > 0 ? ` × ${discountFactor.toFixed(2)}` : ""} = ₹${spPerItem.toFixed(2)}`,
        `Total CP = ${totalItems} × ₹${cp} = ₹${totalCP}`,
        `Total SP = ${y} × ₹${spPerItem.toFixed(2)} = ₹${totalSP.toFixed(2)}`,
      ].join(" | "),
      phase3: `${isLoss ? "Loss" : "Profit"}% = (${totalSP.toFixed(2)} − ${totalCP}) / ${totalCP} × 100 = ${profitPct.toFixed(2)}%`,
    },
  };
}

/**
 * Standard profit/loss:
 *   MP = CP × (1 + markup/100)
 *   SP = MP × (1 − discount/100)
 *   Profit% = (SP − CP) / CP × 100
 */
function solveStandard(
  params: ProfitLossParams,
  c: ModeConstraint,
): SolveResult {
  let { cp, markup_pct = 20, discount_pct } = params;

  if (c.mode === "integer") {
    cp = Math.max(20, Math.round(cp / 20) * 20);
    markup_pct = Math.max(5, Math.round(markup_pct / 5) * 5);
    if (discount_pct !== undefined) {
      discount_pct = Math.min(
        95,
        Math.max(5, Math.round(discount_pct / 5) * 5),
      );
    }
  }

  const mpCpRatio = 1 + markup_pct / 100;
  const mp = cp * mpCpRatio;

  const computedMarkupPct = (mpCpRatio - 1) * 100;
  if (computedMarkupPct < 0) {
    throw new Error(
      `Markup% = ${computedMarkupPct.toFixed(2)} is negative — invalid`,
    );
  }

  const sp = discount_pct !== undefined ? mp * (1 - discount_pct / 100) : mp;
  const profit = sp - cp;
  const profitPct = (profit / cp) * 100;
  const isLoss = profit < 0;

  const correct = snapToMode(
    discount_pct !== undefined ? profitPct : markup_pct,
    c,
  );

  const d1Raw = markup_pct;
  const d2Raw = discount_pct ?? markup_pct * 0.5;
  const d3Raw = markup_pct - (discount_pct ?? 0);

  const d1 = snapToMode(d1Raw, c);
  const d2 = snapToMode(d2Raw, c);
  const d3 = snapToMode(d3Raw, c);

  return {
    correct,
    distractors: dedup([d1, d2, d3], correct, c, isLoss),
    unit: "%",
    solution: {
      phase1: `CP = ₹${cp}, Markup = ${markup_pct}%${discount_pct !== undefined ? `, Discount = ${discount_pct}%` : ""}`,
      phase2: `MP/CP ratio = ${mpCpRatio.toFixed(2)}, MP = ₹${mp.toFixed(2)}${discount_pct !== undefined ? `, SP = MP × (1 − ${discount_pct}/100) = ₹${sp.toFixed(2)}` : ""}`,
      phase3: `${isLoss ? "Loss" : "Profit"}% = (SP − CP)/CP × 100 = (${sp.toFixed(2)} − ${cp})/${cp} × 100 = ${profitPct.toFixed(2)}%`,
    },
  };
}

/**
 * Cheating dealer (weight fraud):
 *   Real CP = CP / buying_fraction
 *   Real SP = SP / selling_fraction
 *   Profit% = (Real_SP - Real_CP) / Real_CP * 100
 */
function solveCheatWeight(
  params: ProfitLossParams,
  c: ModeConstraint,
): SolveResult {
  const {
    cp = 100,
    markup_pct = 20,
    discount_pct,
    buying_fraction = 1,
    selling_fraction = 1,
  } = params;

  const mpCpRatio = 1 + markup_pct / 100;
  const mp = cp * mpCpRatio;
  const sp = discount_pct !== undefined ? mp * (1 - discount_pct / 100) : mp;

  const realCP = cp / buying_fraction;
  const realSP = sp / selling_fraction;

  const profit = realSP - realCP;
  const profitPct = (profit / realCP) * 100;
  const isLoss = profit < 0;

  const correct = snapToMode(profitPct, c);

  const d1Raw = ((sp / selling_fraction - cp) / cp) * 100;
  const d2Raw = ((sp - cp / buying_fraction) / (cp / buying_fraction)) * 100;
  const d3Raw = markup_pct;

  const d1 = snapToMode(d1Raw, c);
  const d2 = snapToMode(d2Raw, c);
  const d3 = snapToMode(d3Raw, c);

  return {
    correct,
    distractors: dedup([d1, d2, d3], correct, c, isLoss),
    unit: "%",
    solution: {
      phase1: `CP = ₹${cp}, Markup = ${markup_pct}%, Buying fraction = ${buying_fraction}, Selling fraction = ${selling_fraction}`,
      phase2: `MP/CP ratio = ${mpCpRatio.toFixed(2)}, Real CP = ${cp}/${buying_fraction} = ₹${realCP.toFixed(2)}, SP = ₹${sp.toFixed(2)}, Real SP = ${sp.toFixed(2)}/${selling_fraction} = ₹${realSP.toFixed(2)}`,
      phase3: `${isLoss ? "Loss" : "Profit"}% = (${realSP.toFixed(2)} − ${realCP.toFixed(2)}) / ${realCP.toFixed(2)} × 100 = ${profitPct.toFixed(2)}%`,
    },
  };
}

/**
 * Successive discounts: d1% then d2%
 *   Net discount% = d1 + d2 - d1*d2/100
 *   Final price = CP * (1 - d1/100) * (1 - d2/100)
 */
function solveSuccessiveDiscount(
  params: ProfitLossParams,
  c: ModeConstraint,
): SolveResult {
  const { cp = 100, markup_pct: d1 = 20, discount_pct: d2 = 10 } = params;

  const sp = cp * (1 - (d1 ?? 0) / 100) * (1 - (d2 ?? 0) / 100);
  const netDiscountPct = (d1 ?? 0) + (d2 ?? 0) - ((d1 ?? 0) * (d2 ?? 0)) / 100;
  const discount = cp - sp;

  const correct = snapToMode(discount, c);

  const d1_mistake = snapToMode((cp * ((d1 ?? 0) + (d2 ?? 0))) / 100, c);
  const d2_mistake = snapToMode((cp * (d1 ?? 0)) / 100, c);
  const d3_mistake = snapToMode(sp, c);

  return {
    correct,
    distractors: dedup([d1_mistake, d2_mistake, d3_mistake], correct, c, false),
    unit: "₹",
    solution: {
      phase1: `CP = ₹${cp}, Successive discounts = ${d1}% and ${d2}%`,
      phase2: `SP = ${cp} × (1 − ${d1}/100) × (1 − ${d2}/100) = ₹${sp.toFixed(2)}`,
      phase3: `Net Discount = ${netDiscountPct.toFixed(2)}%, Discount amount = ₹${discount.toFixed(2)}`,
    },
  };
}

function dedup(
  candidates: number[],
  correct: number,
  c: ModeConstraint,
  isLoss: boolean,
): number[] {
  const correctKey = fmtRaw(correct, c);
  const seen = new Set<string>([correctKey]);
  const result: number[] = [];

  for (const d of candidates) {
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

  let off = 5;
  while (result.length < 3 && off <= 100) {
    const d = snapToMode(correct + off, c);
    const d2 = isLoss
      ? snapToMode(correct - off, c)
      : snapToMode(correct - off > 0 ? correct - off : correct + off * 2, c);

    for (const candidate of [d, d2]) {
      if (!Number.isFinite(candidate)) continue;
      if (isLoss && candidate >= 0) continue;
      if (!isLoss && candidate <= 0) continue;
      const key = fmtRaw(candidate, c);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(candidate);
        if (result.length === 3) return result;
      }
    }
    off += 5;
  }

  return result.slice(0, 3);
}
