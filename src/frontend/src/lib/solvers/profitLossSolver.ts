// ============================================================
// PROFIT & LOSS SOLVER
// Handles: standard, cheat/weight fraud, successive discounts, free items
// PARAMETER CONSTRAINTS enforced before any computation:
//   - discount_pct must be < 100 (otherwise SP goes negative)
//   - markup_pct must be >= 0
//   - selling_fraction must be > 0 and <= 1
//   - buying_fraction must be > 0
// Loss% results are ALLOWED — do NOT force positive.
// MARKUP FIX: Always compute MP/CP ratio first; markup% = (MP/CP - 1) * 100
// FREE ITEMS: Effective CP = (y + x) / y * CP per item
// ============================================================

import type { ProfitLossParams } from "../aiParser";
import type { ModeConstraint, SolveResult } from "./types";
import { fmtRaw, snapToMode } from "./utils";

// ── Parameter Validation ───────────────────────────────────────────

export interface ParamValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates profit/loss parameters BEFORE solving.
 * Returns invalid if any parameter would produce an impossible question:
 *   - Discount >= 100% → SP would be zero or negative
 *   - Selling fraction <= 0 → division by zero or negative SP
 *   - Buying fraction <= 0 → division by zero
 *   - Markup < 0 → undefined behavior
 */
export function validateProfitLossParams(
  params: ProfitLossParams,
): ParamValidationResult {
  const {
    markup_pct = 20,
    discount_pct,
    buying_fraction = 1,
    selling_fraction = 1,
  } = params;

  // Rule 1: discount must be strictly less than 100%
  if (discount_pct !== undefined && discount_pct >= 100) {
    return {
      valid: false,
      reason: `Discount ${discount_pct}% >= 100% makes selling price zero or negative (impossible)`,
    };
  }

  // Rule 2: markup must be >= 0
  if (markup_pct < 0) {
    return {
      valid: false,
      reason: `Markup ${markup_pct}% cannot be negative`,
    };
  }

  // Rule 3: fractions must be (0, 1]
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

  // Rule 4: compute the selling price and verify it's > 0
  const cp = params.cp ?? 100;
  const mp = cp * (1 + markup_pct / 100);
  const sp = discount_pct !== undefined ? mp * (1 - discount_pct / 100) : mp;

  if (sp <= 0) {
    return {
      valid: false,
      reason: `Computed SP = ${sp.toFixed(2)} is non-positive — question is impossible`,
    };
  }

  // Rule 5: real SP (after selling cheat) must be > 0
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
  // Validate parameters FIRST — reject before any math runs
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
 * FREE ITEMS:
 *   If x items free on every y purchased:
 *   Total items given = y + x
 *   Effective CP per unit = (y + x)/y * CP_per_unit  (pays for y+x, gets y+x)
 *   OR: pays for y, gets y+x  → effective CP per item received = y/(y+x) * CP
 *
 *   The correct interpretation:
 *   - Dealer BUYS (y+x) items but SELLS only y at SP each
 *   - Total CP = (y+x) * cp_per_item
 *   - Total SP = y * SP_per_item  where SP = CP * (1 + markup/100) * (1 - discount/100)
 *   - Profit% = (Total SP - Total CP) / Total CP * 100
 *
 *   MARKUP QUESTION: asked for markup% to achieve desired profit%
 *   - If markup_pct is 0 and discount_pct is 0, solve for profit% directly
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
  } = params;

  // Clamp discount
  const discount = discount_pct !== undefined ? Math.min(99, discount_pct) : 0;

  const spPerItem = cp * (1 + markup_pct / 100) * (1 - discount / 100);

  const totalCP = (y + x) * cp;
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
        `Free items: ${x} free on every ${y} (total given = ${y + x})`,
        markup_pct > 0 ? `Markup = ${markup_pct}%` : "",
        discount > 0 ? `Discount = ${discount}%` : "",
      ]
        .filter(Boolean)
        .join(", "),
      phase2: [
        `SP per item = ₹${cp} × ${1 + markup_pct / 100}${discount > 0 ? ` × ${(1 - discount / 100).toFixed(2)}` : ""} = ₹${spPerItem.toFixed(2)}`,
        `Total CP = ${y + x} × ₹${cp} = ₹${totalCP}`,
        `Total SP = ${y} × ₹${spPerItem.toFixed(2)} = ₹${totalSP.toFixed(2)}`,
      ].join(" | "),
      phase3: `${isLoss ? "Loss" : "Profit"}% = (${totalSP.toFixed(2)} − ${totalCP}) / ${totalCP} × 100 = ${profitPct.toFixed(2)}%`,
    },
  };
}

/**
 * Standard profit/loss:
 *   MARKUP FIX: Compute MP = CP × (1 + markup/100)
 *   Then markup% = (MP/CP − 1) × 100 (always positive if markup_pct >= 0)
 *   SP = MP × (1 − discount/100)
 *   Profit% = (SP − CP) / CP × 100
 *
 * NOTE: profitPct CAN be negative (loss). We do NOT block negative results.
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
      // Clamp discount to max 95% to keep questions sane in integer mode
      discount_pct = Math.min(
        95,
        Math.max(5, Math.round(discount_pct / 5) * 5),
      );
    }
  }

  // MARKUP FIX: compute MP/CP ratio first, then derive markup%
  const mpCpRatio = 1 + markup_pct / 100;
  const mp = cp * mpCpRatio;

  // Markup% is always (MP/CP - 1) * 100; must be positive
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

  // Distractors: common student mistakes — must match sign of correct
  const d1Raw = markup_pct; // confused markup with profit
  const d2Raw = discount_pct ?? markup_pct * 0.5; // only used discount
  const d3Raw = markup_pct - (discount_pct ?? 0); // just subtracted pcts

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
 *   Real CP = CP / buying_fraction   (buys more than stated)
 *   Real SP = SP / selling_fraction  (sells less than stated)
 *   Profit% = (Real_SP - Real_CP) / Real_CP * 100
 *
 * NOTE: result CAN be negative (net loss despite cheating).
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

  // MARKUP FIX: compute from ratio
  const mpCpRatio = 1 + markup_pct / 100;
  const mp = cp * mpCpRatio;
  const sp = discount_pct !== undefined ? mp * (1 - discount_pct / 100) : mp;

  const realCP = cp / buying_fraction;
  const realSP = sp / selling_fraction;

  const profit = realSP - realCP;
  const profitPct = (profit / realCP) * 100;
  const isLoss = profit < 0;

  const correct = snapToMode(profitPct, c);

  // Common mistakes — may be positive or negative depending on what was forgotten
  const d1Raw = ((sp / selling_fraction - cp) / cp) * 100; // forgot buying cheat
  const d2Raw = ((sp - cp / buying_fraction) / (cp / buying_fraction)) * 100; // forgot selling cheat
  const d3Raw = markup_pct; // used markup directly as profit

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

  // Mistakes:
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

/**
 * Dedup distractors.
 * isLoss=true means the correct answer is negative — distractors should also be
 * negative (nearby loss%) so all 4 options are consistent in sign.
 * isLoss=false means all options should be positive.
 */
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
    // Skip NaN/Infinity
    if (!Number.isFinite(d)) continue;
    // For loss questions: all options should be negative
    // For profit questions: all options should be positive
    if (isLoss && d >= 0) continue;
    if (!isLoss && d <= 0) continue;

    const key = fmtRaw(d, c);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(d);
      if (result.length === 3) return result;
    }
  }

  // Fallback: generate nearby values with the same sign as correct
  let off = 5;
  while (result.length < 3 && off <= 100) {
    const d = isLoss
      ? snapToMode(correct + off, c) // correct is negative; adding makes it less negative
      : snapToMode(correct + off, c);
    const d2 = isLoss
      ? snapToMode(correct - off, c) // more negative
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
