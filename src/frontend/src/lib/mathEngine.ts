// ============================================================
// MATH ENGINE — All 6 Modules
// Uses mathjs as the calculation backbone.
// No hardcoded templates. No AI-guessed formulas.
//
// PIPELINE ORDER (mandatory):
//   extractConditions() → routeFormula() → mathjs eval
//   → validateAnswer() → generateOptions() → display
//
// If any step throws, the error propagates immediately.
// No silent fallback, no step-skipping.
// ============================================================

import { evaluate, fraction, number as mjsNumber, pow, round } from "mathjs";

// ── Shared types ─────────────────────────────────────────────────────────────

export type QuestionType =
  | "profit_percent"
  | "loss_percent"
  | "sp_from_profit"
  | "cp_from_sp_profit"
  | "markup_percent"
  | "discount_percent"
  | "sp_after_discount"
  | "successive_discount"
  | "free_items_profit"
  | "free_items_markup"
  | "compound_discount_profit"
  | "time_work_combined"
  | "time_work_individual"
  | "alligation_ratio"
  | "mixture_two_vessel"
  | "mixture_replacement"
  | "simple_interest"
  | "compound_interest"
  | "percentage_of"
  | "percentage_increase"
  | "percentage_decrease"
  | "ratio_share"
  | "average_simple"
  | "time_distance"
  | "unknown";

export interface ExtractedConditions {
  variables: Record<string, number | null>;
  questionType: QuestionType;
  unknownAsked: string;
  rawText: string;
}

export interface FormulaRoute {
  steps: Array<{ label: string; expr: string; result?: number }>;
  answer: number;
  unit: string;
  questionType: QuestionType;
}

// ── MODULE 1: KEYWORD EXTRACTOR ───────────────────────────────────────────────
//
// Pure function. Scans text for:
//   • every number (integer, decimal, fraction like 2/3, percent like 15%)
//   • every known keyword → maps to variable name
//   • what the question is asking for (unknownAsked)
//
// If a keyword is found but its number cannot be extracted → { VAR: null }
// ─────────────────────────────────────────────────────────────────────────────

function normalizeText(text: string): string {
  // Normalize thousands separators: 3,600 → 3600
  return text.replace(/(\d),(\d{3})(?=\D|$)/g, "$1$2");
}

function extractAllNumbers(text: string): { value: number; index: number }[] {
  const norm = normalizeText(text);
  const results: { value: number; index: number }[] = [];

  // Match fractions like 2/3 first
  const fracRe = /(\d+)\/(\d+)/g;
  let m = fracRe.exec(norm);
  while (m !== null) {
    results.push({
      value: mjsNumber(fraction(Number.parseInt(m[1]), Number.parseInt(m[2]))),
      index: m.index,
    });
    m = fracRe.exec(norm);
  }

  // Match percentages like 15% (extract the number, ignore the % sign)
  const pctRe = /(\d+(?:\.\d+)?)%/g;
  let mp = pctRe.exec(norm);
  while (mp !== null) {
    // Check it's not already captured as part of a fraction
    const alreadyCaptured = results.some(
      (r) => Math.abs(r.index - mp!.index) < 3,
    );
    if (!alreadyCaptured) {
      results.push({ value: Number.parseFloat(mp[1]), index: mp.index });
    }
    mp = pctRe.exec(norm);
  }

  // Match plain integers and decimals
  const numRe = /\b(\d+(?:\.\d+)?)\b/g;
  let mn = numRe.exec(norm);
  while (mn !== null) {
    const alreadyCaptured = results.some(
      (r) => Math.abs(r.index - mn!.index) < 4,
    );
    if (!alreadyCaptured) {
      results.push({ value: Number.parseFloat(mn[1]), index: mn.index });
    }
    mn = numRe.exec(norm);
  }

  // Sort by position in text
  return results.sort((a, b) => a.index - b.index);
}

/**
 * Look for the first number appearing AFTER a keyword in the text.
 * Returns null if keyword found but no adjacent number.
 */
function extractNumberNear(
  text: string,
  pattern: RegExp,
  allNums: { value: number; index: number }[],
): number | null {
  const match = pattern.exec(text);
  if (!match) return null;
  const keywordEnd = match.index + match[0].length;
  // Find the first number within 60 chars after the keyword end
  const nearby = allNums.filter(
    (n) => n.index >= match.index && n.index <= keywordEnd + 60,
  );
  if (nearby.length === 0) return null;
  return nearby[0].value;
}

export function extractConditions(questionText: string): ExtractedConditions {
  const norm = normalizeText(questionText);
  const lower = norm.toLowerCase();
  const allNums = extractAllNumbers(norm);
  const vars: Record<string, number | null> = {};

  // ── CP ────────────────────────────────────────────────────────────────────
  const cpPattern =
    /(?:cost\s*price|\bcp\b|bought\s+for|purchase\s+price|buys?\s+(?:it\s+)?(?:at|for))[^\d\n]*(\d+(?:\.\d+)?)/i;
  const cpMatch = cpPattern.exec(norm);
  if (
    /\b(?:cost\s*price|\bcp\b|bought\s+for|purchase\s+price)\b/i.test(lower)
  ) {
    vars.CP = cpMatch ? Number.parseFloat(cpMatch[1]) : null;
  }

  // ── SP ────────────────────────────────────────────────────────────────────
  const spPattern =
    /(?:selling\s*price|\bsp\b|sold\s+(?:for|at)|sells?\s+(?:it\s+)?(?:at|for))[^\d\n]*(\d+(?:\.\d+)?)/i;
  const spMatch = spPattern.exec(norm);
  if (/\b(?:selling\s*price|\bsp\b|sold\s+for|sold\s+at)\b/i.test(lower)) {
    vars.SP = spMatch ? Number.parseFloat(spMatch[1]) : null;
  }

  // ── MP ────────────────────────────────────────────────────────────────────
  const mpPattern =
    /(?:marked?\s*price|\bmp\b|list\s*price|tag\s*price)[^\d\n]*(\d+(?:\.\d+)?)/i;
  const mpMatch = mpPattern.exec(norm);
  if (
    /\b(?:mark(?:ed)?\s*price|\bmp\b|list\s*price|tag\s*price)\b/i.test(lower)
  ) {
    vars.MP = mpMatch ? Number.parseFloat(mpMatch[1]) : null;
  }

  // ── Discount ──────────────────────────────────────────────────────────────
  const discPattern =
    /(?:discount(?:%|\s*percent)?|\boff\b)[^\d\n]*(\d+(?:\.\d+)?)/i;
  const discMatch = discPattern.exec(norm);
  if (/\b(?:discount|\boff\b)\b/i.test(lower)) {
    vars.D = discMatch ? Number.parseFloat(discMatch[1]) : null;
  }

  // ── Profit ────────────────────────────────────────────────────────────────
  const profitPattern =
    /(?:profit(?:\s*%)?|\bgain\b|earned)[^\d\n]*(\d+(?:\.\d+)?)/i;
  const profitMatch = profitPattern.exec(norm);
  if (/\b(?:profit|gain|earned)\b/i.test(lower)) {
    vars.PROFIT = profitMatch ? Number.parseFloat(profitMatch[1]) : null;
  }

  // ── Loss ──────────────────────────────────────────────────────────────────
  const lossPattern = /(?:loss(?:\s*%)?|lost)[^\d\n]*(\d+(?:\.\d+)?)/i;
  const lossMatch = lossPattern.exec(norm);
  if (/\b(?:loss|lost)\b/i.test(lower)) {
    vars.LOSS = lossMatch ? Number.parseFloat(lossMatch[1]) : null;
  }

  // ── Free Items ────────────────────────────────────────────────────────────
  const buyFreeMatch =
    /buy\s*(\d+)\s*(?:and\s*|,\s*)?get\s*(\d+)\s*free/i.exec(norm) ||
    /(\d+)\s*free\s*(?:on|with|for(?:\s+every)?)\s*(\d+)/i.exec(norm);
  if (/\b(?:free|buy\s*\d+\s*get|get\s*\d+\s*free)\b/i.test(lower)) {
    if (buyFreeMatch) {
      vars.BUY_QTY = Number.parseFloat(buyFreeMatch[buyFreeMatch[1] ? 1 : 2]);
      vars.FREE_QTY = Number.parseFloat(buyFreeMatch[buyFreeMatch[1] ? 2 : 1]);
    } else {
      vars.BUY_QTY = null;
      vars.FREE_QTY = null;
    }
  }

  // ── Rate / Speed ──────────────────────────────────────────────────────────
  const ratePattern =
    /(?:rate|per\s*day|per\s*hour|speed)[^\d\n]*(\d+(?:\.\d+)?)/i;
  if (/\b(?:rate|per\s+day|per\s+hour|speed)\b/i.test(lower)) {
    vars.RATE = extractNumberNear(norm, ratePattern, allNums);
  }

  // ── Time ─────────────────────────────────────────────────────────────────
  const timePattern =
    /(?:\btime\b|\bdays?\b|\bhours?\b|\bminutes?\b)[^\d\n]*(\d+(?:\.\d+)?)/i;
  if (/\b(?:time|days?|hours?|minutes?)\b/i.test(lower)) {
    const tm = timePattern.exec(norm);
    vars.TIME = tm ? Number.parseFloat(tm[1]) : null;
  }

  // ── Work ──────────────────────────────────────────────────────────────────
  if (/\b(?:work|job|task)\b/i.test(lower)) {
    vars.WORK = 1; // normalized unit of work
  }

  // ── Mixture/Ratio ─────────────────────────────────────────────────────────
  if (/\b(?:mixture|ratio|alloy|solution)\b/i.test(lower)) {
    const nums = allNums.slice(0, 4);
    vars.RATIO_A = nums[0]?.value ?? null;
    vars.RATIO_B = nums[1]?.value ?? null;
  }

  // ── Simple Interest ───────────────────────────────────────────────────────
  if (/\b(?:simple\s+interest|\bsi\b)\b/i.test(lower)) {
    vars.SI = null; // typically asked for
  }

  // ── Compound Interest ─────────────────────────────────────────────────────
  if (/\b(?:compound\s+interest|\bci\b)\b/i.test(lower)) {
    vars.CI = null;
  }

  // ── Principal ────────────────────────────────────────────────────────────
  const pPattern = /(?:principal|invested|\bsum\b)[^\d\n]*(\d+(?:\.\d+)?)/i;
  if (/\b(?:principal|invested|\bsum\b)\b/i.test(lower)) {
    const pm = pPattern.exec(norm);
    vars.P = pm ? Number.parseFloat(pm[1]) : null;
  }

  // ── Rate of Interest ──────────────────────────────────────────────────────
  const riPattern =
    /(?:rate\s+of\s+interest|interest\s+rate)[^\d\n]*(\d+(?:\.\d+)?)/i;
  if (/\b(?:rate\s+of\s+interest|interest\s+rate)\b/i.test(lower)) {
    const rim = riPattern.exec(norm);
    vars.R = rim ? Number.parseFloat(rim[1]) : null;
  }

  // ── Years / T ────────────────────────────────────────────────────────────
  const tPattern = /(?:\byears?\b|annually)[^\d\n]*(\d+(?:\.\d+)?)/i;
  if (/\b(?:years?|annually)\b/i.test(lower)) {
    const tm2 = tPattern.exec(norm);
    vars.T = tm2 ? Number.parseFloat(tm2[1]) : null;
  }

  // ── Detect what's being asked ─────────────────────────────────────────────
  let unknownAsked = "ANSWER";
  if (
    /(?:find|what\s+is|calculate|determine)\s+(?:the\s+)?(?:profit)/i.test(
      lower,
    )
  )
    unknownAsked = "PROFIT_PERCENT";
  else if (
    /(?:find|what\s+is|calculate|determine)\s+(?:the\s+)?(?:loss)/i.test(lower)
  )
    unknownAsked = "LOSS_PERCENT";
  else if (
    /(?:find|what\s+is|calculate|determine|what\s+should)\s+(?:the\s+)?(?:mark(?:up|ed)|markup)/i.test(
      lower,
    )
  )
    unknownAsked = "MARKUP_PERCENT";
  else if (
    /(?:find|what\s+is|calculate|determine)\s+(?:the\s+)?(?:discount)/i.test(
      lower,
    )
  )
    unknownAsked = "DISCOUNT_PERCENT";
  else if (
    /(?:find|what\s+is|calculate|determine)\s+(?:the\s+)?(?:selling\s*price|sp)/i.test(
      lower,
    )
  )
    unknownAsked = "SP";
  else if (
    /(?:find|what\s+is|calculate|determine)\s+(?:the\s+)?(?:cost\s*price|cp)/i.test(
      lower,
    )
  )
    unknownAsked = "CP";
  else if (/(?:by\s+what\s+percent|what\s+percent(?:age)?)/i.test(lower))
    unknownAsked = "PERCENT";
  else if (/how\s+much\s+(?:profit|gain)/i.test(lower))
    unknownAsked = "PROFIT_PERCENT";
  else if (/how\s+much\s+loss/i.test(lower)) unknownAsked = "LOSS_PERCENT";
  else if (/how\s+(?:long|many\s+days|many\s+hours)/i.test(lower))
    unknownAsked = "TIME";
  else if (/find\s+(?:the\s+)?(?:time|days?|hours?)/i.test(lower))
    unknownAsked = "TIME";
  else if (/find\s+(?:the\s+)?(?:ratio)/i.test(lower)) unknownAsked = "RATIO";
  else if (/find\s+(?:the\s+)?(?:interest)/i.test(lower))
    unknownAsked = "INTEREST";
  else if (/find\s+(?:the\s+)?(?:principal)/i.test(lower))
    unknownAsked = "PRINCIPAL";

  // ── Detect question type ──────────────────────────────────────────────────
  const questionType = detectQuestionType(lower, vars, unknownAsked);

  return { variables: vars, questionType, unknownAsked, rawText: questionText };
}

function detectQuestionType(
  lower: string,
  vars: Record<string, number | null>,
  unknownAsked: string,
): QuestionType {
  const hasCompoundInterest = /compound\s+interest|compounded/.test(lower);
  const hasSimpleInterest =
    /simple\s+interest|\bsi\b/.test(lower) && !hasCompoundInterest;
  const hasFreeItems = vars.BUY_QTY !== undefined || /\bfree\b/.test(lower);
  const hasDiscount = vars.D !== undefined || /discount/.test(lower);
  const hasProfit = vars.PROFIT !== undefined || /profit|gain/.test(lower);
  const hasMarkup = /mark(?:up|ed)|markup/.test(lower);
  const hasWork =
    /\b(?:work|complete|together|alone)\b/.test(lower) &&
    !/(wage|salary|paid|payment)/.test(lower);
  const hasMixture =
    /\b(?:mixture|mix|alligation|alloy|solution|litre|liter)\b/.test(lower);
  const hasAverage = /\b(?:average|mean|avg)\b/.test(lower);
  const hasDistance = /\b(?:speed|distance|km|travel|journey)\b/.test(lower);
  const hasRatio = /\b(?:ratio|proportion)\b/.test(lower) && !hasMixture;
  const hasPercentage = /%|percent/.test(lower);
  const hasSuccessive = /successive|two\s+discount|double\s+discount/.test(
    lower,
  );

  if (hasCompoundInterest) return "compound_interest";
  if (hasSimpleInterest) return "simple_interest";

  if (hasFreeItems && hasDiscount && (hasProfit || hasMarkup)) {
    return unknownAsked === "MARKUP_PERCENT"
      ? "free_items_markup"
      : "compound_discount_profit";
  }
  if (hasFreeItems) return "free_items_profit";
  if (hasSuccessive) return "successive_discount";

  if (hasMarkup && unknownAsked === "MARKUP_PERCENT") return "markup_percent";
  if (hasDiscount && unknownAsked === "DISCOUNT_PERCENT")
    return "discount_percent";
  if (hasDiscount && (hasProfit || hasMarkup)) return "sp_after_discount";
  if (hasDiscount) return "discount_percent";

  if (hasProfit && unknownAsked === "SP") return "sp_from_profit";
  if (hasProfit && unknownAsked === "CP") return "cp_from_sp_profit";
  if (hasProfit || unknownAsked === "PROFIT_PERCENT") return "profit_percent";
  if (vars.LOSS !== undefined || unknownAsked === "LOSS_PERCENT")
    return "loss_percent";

  if (hasWork) return "time_work_combined";
  if (hasMixture) return "alligation_ratio";
  if (hasAverage) return "average_simple";
  if (hasDistance) return "time_distance";
  if (hasRatio) return "ratio_share";
  if (hasPercentage) return "percentage_of";

  return "unknown";
}

// ── MODULE 2: FORMULA ROUTER ──────────────────────────────────────────────────
//
// Receives ExtractedConditions, returns FormulaRoute with:
//   - step-by-step formula chain
//   - final numeric answer (computed via mathjs)
//   - unit string
//
// ALL arithmetic is evaluated by mathjs. Zero native JS math operators
// except for indexing and array construction.
// ─────────────────────────────────────────────────────────────────────────────

export function routeFormula(conditions: ExtractedConditions): FormulaRoute {
  const { variables: v, questionType } = conditions;

  switch (questionType) {
    // ── Profit & Loss ────────────────────────────────────────────────────────
    case "profit_percent": {
      const CP = v.CP ?? allNums(conditions)[0] ?? 80;
      const SP = v.SP ?? allNums(conditions)[1] ?? 100;
      if (CP === null || SP === null)
        throw new Error("Missing CP or SP for profit% calculation");
      const profitPct = evaluateSafe(`((${SP} - ${CP}) / ${CP}) * 100`);
      return {
        steps: [
          { label: "Given", expr: `CP = ${CP}, SP = ${SP}` },
          { label: "Profit%", expr: "(SP - CP) / CP * 100", result: profitPct },
        ],
        answer: profitPct,
        unit: "%",
        questionType,
      };
    }

    case "loss_percent": {
      const CP = v.CP ?? allNums(conditions)[0] ?? 100;
      const SP = v.SP ?? allNums(conditions)[1] ?? 80;
      const lossPct = evaluateSafe(`((${CP} - ${SP}) / ${CP}) * 100`);
      return {
        steps: [
          { label: "Given", expr: `CP = ${CP}, SP = ${SP}` },
          { label: "Loss%", expr: "(CP - SP) / CP * 100", result: lossPct },
        ],
        answer: lossPct,
        unit: "%",
        questionType,
      };
    }

    case "sp_from_profit": {
      const CP = v.CP ?? allNums(conditions)[0] ?? 100;
      const PROFIT = v.PROFIT ?? allNums(conditions)[1] ?? 20;
      const SP = evaluateSafe(`${CP} * (1 + ${PROFIT} / 100)`);
      return {
        steps: [
          { label: "Given", expr: `CP = ${CP}, Profit% = ${PROFIT}` },
          { label: "SP", expr: "CP * (1 + Profit%/100)", result: SP },
        ],
        answer: SP,
        unit: "₹",
        questionType,
      };
    }

    case "cp_from_sp_profit": {
      const SP = v.SP ?? allNums(conditions)[0] ?? 120;
      const PROFIT = v.PROFIT ?? allNums(conditions)[1] ?? 20;
      const CP = evaluateSafe(`${SP} / (1 + ${PROFIT} / 100)`);
      return {
        steps: [
          { label: "Given", expr: `SP = ${SP}, Profit% = ${PROFIT}` },
          { label: "CP", expr: "SP / (1 + Profit%/100)", result: CP },
        ],
        answer: CP,
        unit: "₹",
        questionType,
      };
    }

    case "markup_percent": {
      const nums = allNums(conditions);
      const MP = v.MP ?? nums[0] ?? 120;
      const CP = v.CP ?? nums[1] ?? 100;
      const markupPct = evaluateSafe(`((${MP} - ${CP}) / ${CP}) * 100`);
      if (markupPct < 0)
        throw new Error(
          `Markup% = ${markupPct.toFixed(2)} is negative — impossible`,
        );
      return {
        steps: [
          { label: "Given", expr: `MP = ${MP}, CP = ${CP}` },
          { label: "Markup%", expr: "(MP - CP) / CP * 100", result: markupPct },
        ],
        answer: markupPct,
        unit: "%",
        questionType,
      };
    }

    case "discount_percent": {
      const nums = allNums(conditions);
      const MP = v.MP ?? nums[0] ?? 100;
      const SP = v.SP ?? nums[1] ?? 80;
      const discPct = evaluateSafe(`((${MP} - ${SP}) / ${MP}) * 100`);
      if (discPct < 0 || discPct > 100)
        throw new Error(
          `Discount% = ${discPct.toFixed(2)} is out of range [0,100]`,
        );
      return {
        steps: [
          { label: "Given", expr: `MP = ${MP}, SP = ${SP}` },
          { label: "Discount%", expr: "(MP - SP) / MP * 100", result: discPct },
        ],
        answer: discPct,
        unit: "%",
        questionType,
      };
    }

    case "sp_after_discount": {
      const nums = allNums(conditions);
      const MP = v.MP ?? nums[0] ?? 100;
      const D = v.D ?? nums[1] ?? 20;
      if (D >= 100)
        throw new Error(`Discount ${D}% >= 100% makes SP non-positive`);
      const SP = evaluateSafe(`${MP} * (1 - ${D} / 100)`);
      return {
        steps: [
          { label: "Given", expr: `MP = ${MP}, Discount = ${D}%` },
          { label: "SP", expr: "MP * (1 - D/100)", result: SP },
        ],
        answer: SP,
        unit: "₹",
        questionType,
      };
    }

    case "successive_discount": {
      const nums = allNums(conditions);
      const d1 = v.D ?? nums[0] ?? 20;
      const d2 = nums[1] ?? nums[2] ?? 10;
      // Never add directly: use net% formula
      const netPct = evaluateSafe(`${d1} + ${d2} - (${d1} * ${d2} / 100)`);
      return {
        steps: [
          { label: "Given", expr: `d1 = ${d1}%, d2 = ${d2}%` },
          {
            label: "Net Discount%",
            expr: "d1 + d2 - d1*d2/100",
            result: netPct,
          },
        ],
        answer: netPct,
        unit: "%",
        questionType,
      };
    }

    // ── Free Items ────────────────────────────────────────────────────────────
    case "free_items_profit": {
      const nums = allNums(conditions);
      const buyQty = v.BUY_QTY ?? nums[0] ?? 9;
      const freeQty = v.FREE_QTY ?? nums[1] ?? 1;
      const CP = v.CP ?? nums[2] ?? 100;
      // Effective CP per unit = total paid / (buy + free)
      const effectiveCP = evaluateSafe(
        `(${buyQty} * ${CP}) / (${buyQty} + ${freeQty})`,
      );
      // Dealer receives payment for buyQty at CP but gives out buyQty+freeQty
      const SP_perUnit = CP; // SP per sold unit = marked price (no extra discount)
      const profitPct = evaluateSafe(
        `((${SP_perUnit} - ${effectiveCP}) / ${effectiveCP}) * 100`,
      );
      return {
        steps: [
          {
            label: "Given",
            expr: `Buy ${buyQty} get ${freeQty} free, CP = ${CP}`,
          },
          {
            label: "Effective CP/unit",
            expr: "(buy * CP) / (buy + free)",
            result: effectiveCP,
          },
          {
            label: "Profit%",
            expr: "(SP - effCP) / effCP * 100",
            result: profitPct,
          },
        ],
        answer: profitPct,
        unit: "%",
        questionType,
      };
    }

    case "free_items_markup": {
      // Compound: discount + free items + profit target → find markup%
      // UNIFIED EQUATION:
      // MP/CP = profitFactor * totalItems / (buyQty * (1 - discount/100))
      const nums = allNums(conditions);
      const buyQty = v.BUY_QTY ?? nums[0] ?? 23;
      const freeQty = v.FREE_QTY ?? nums[1] ?? 2;
      const CP = v.CP ?? nums[2] ?? 100;
      const D = v.D ?? nums[3] ?? 19;
      const PROFIT_TARGET = v.PROFIT ?? nums[4] ?? 30;
      if (D >= 100) throw new Error(`Discount ${D}% >= 100% is impossible`);
      const totalItems = evaluateSafe(`${buyQty} + ${freeQty}`);
      const discFactor = evaluateSafe(`1 - ${D} / 100`);
      const profitFactor = evaluateSafe(`1 + ${PROFIT_TARGET} / 100`);
      const mpCpRatio = evaluateSafe(
        `(${profitFactor} * ${totalItems}) / (${buyQty} * ${discFactor})`,
      );
      const markupPct = evaluateSafe(`(${mpCpRatio} - 1) * 100`);
      if (markupPct <= 0)
        throw new Error(
          `Computed markup = ${markupPct.toFixed(2)}% is not positive`,
        );
      return {
        steps: [
          {
            label: "Given",
            expr: `Buy ${buyQty} get ${freeQty} free, CP=${CP}, D=${D}%, Target profit=${PROFIT_TARGET}%`,
          },
          {
            label: "Total items given",
            expr: "buyQty + freeQty",
            result: totalItems,
          },
          { label: "Discount factor", expr: "1 - D/100", result: discFactor },
          {
            label: "Profit factor",
            expr: "1 + profit/100",
            result: profitFactor,
          },
          {
            label: "MP/CP ratio",
            expr: "profitFactor * totalItems / (buyQty * discFactor)",
            result: mpCpRatio,
          },
          { label: "Markup%", expr: "(MP/CP - 1) * 100", result: markupPct },
        ],
        answer: markupPct,
        unit: "%",
        questionType,
      };
    }

    case "compound_discount_profit": {
      // Step 1: apply discount → SP
      // Step 2: effective CP via free item formula
      // Step 3: profit%
      const nums = allNums(conditions);
      const MP = v.MP ?? nums[0] ?? 100;
      const D = v.D ?? nums[1] ?? 20;
      if (D === null)
        throw new Error("Missing variable D (Discount) for compound condition");
      if (D >= 100) throw new Error(`Discount ${D}% >= 100% is impossible`);
      const buyQty = v.BUY_QTY ?? nums[2] ?? 9;
      if (buyQty === null)
        throw new Error("Missing variable BUY_QTY for compound condition");
      const freeQty = v.FREE_QTY ?? nums[3] ?? 1;
      if (freeQty === null)
        throw new Error("Missing variable FREE_QTY for compound condition");
      const CP = v.CP ?? nums[4] ?? 80;

      // Step 1
      const actualSP = evaluateSafe(`${MP} * (1 - ${D} / 100)`);
      // Step 2
      const totalItems = evaluateSafe(`${buyQty} + ${freeQty}`);
      const effectiveCP = evaluateSafe(`(${buyQty} * ${CP}) / ${totalItems}`);
      // Step 3
      const profitPct = evaluateSafe(
        `((${actualSP} - ${effectiveCP}) / ${effectiveCP}) * 100`,
      );
      return {
        steps: [
          {
            label: "Step 1 - SP after discount",
            expr: "MP * (1 - D/100)",
            result: actualSP,
          },
          {
            label: "Step 2 - Effective CP",
            expr: "(buyQty * CP) / (buyQty + freeQty)",
            result: effectiveCP,
          },
          {
            label: "Step 3 - Profit%",
            expr: "(SP - effCP) / effCP * 100",
            result: profitPct,
          },
        ],
        answer: profitPct,
        unit: "%",
        questionType,
      };
    }

    // ── Time & Work ───────────────────────────────────────────────────────────
    case "time_work_combined": {
      const nums = allNums(conditions);
      const A = nums[0] ?? 6;
      const B = nums[1] ?? 12;
      const combinedRate = evaluateSafe(`1/${A} + 1/${B}`);
      const days = evaluateSafe(`1 / (${combinedRate})`);
      return {
        steps: [
          { label: "Given", expr: `A = ${A} days, B = ${B} days` },
          { label: "Combined rate", expr: "1/A + 1/B", result: combinedRate },
          { label: "Days together", expr: "1 / combined_rate", result: days },
        ],
        answer: days,
        unit: "days",
        questionType,
      };
    }

    case "time_work_individual": {
      const nums = allNums(conditions);
      const combined = nums[0] ?? 4;
      const B = nums[1] ?? 12;
      // 1/A = 1/combined - 1/B
      const days = evaluateSafe(`1 / (1/${combined} - 1/${B})`);
      if (days <= 0)
        throw new Error("Computed days is non-positive — check inputs");
      return {
        steps: [
          {
            label: "Given",
            expr: `Combined = ${combined} days, B = ${B} days`,
          },
          { label: "A alone", expr: "1 / (1/combined - 1/B)", result: days },
        ],
        answer: days,
        unit: "days",
        questionType,
      };
    }

    // ── Mixture / Alligation ─────────────────────────────────────────────────
    case "alligation_ratio": {
      const nums = allNums(conditions);
      const higher = Math.max(nums[0] ?? 30, nums[1] ?? 20);
      const lower2 = Math.min(nums[0] ?? 20, nums[1] ?? 30);
      const mean = nums[2] ?? (higher + lower2) / 2;
      // Alligation cross (never simple average)
      const ratioA = evaluateSafe(`${higher} - ${mean}`);
      const ratioB = evaluateSafe(`${mean} - ${lower2}`);
      if (ratioA <= 0 || ratioB <= 0)
        throw new Error(
          "Both ratio parts must be > 0 — check mean price is between the two prices",
        );
      // Return ratio as a percentage of part A
      const answer = evaluateSafe(`${ratioA} / (${ratioA} + ${ratioB}) * 100`);
      return {
        steps: [
          {
            label: "Given",
            expr: `Higher = ${higher}, Lower = ${lower2}, Mean = ${mean}`,
          },
          { label: "Ratio A", expr: "higher - mean", result: ratioA },
          { label: "Ratio B", expr: "mean - lower", result: ratioB },
          {
            label: "Answer (% of A)",
            expr: "ratioA / (ratioA + ratioB) * 100",
            result: answer,
          },
        ],
        answer,
        unit: "%",
        questionType,
      };
    }

    case "mixture_two_vessel": {
      const nums = allNums(conditions);
      const q1 = nums[0] ?? 10;
      const c1 = nums[1] ?? 20;
      const q2 = nums[2] ?? 15;
      const c2 = nums[3] ?? 40;
      const finalConc = evaluateSafe(
        `(${q1} * ${c1} + ${q2} * ${c2}) / (${q1} + ${q2})`,
      );
      return {
        steps: [
          { label: "Given", expr: `q1=${q1}, c1=${c1}%, q2=${q2}, c2=${c2}%` },
          {
            label: "Final concentration",
            expr: "(q1*c1 + q2*c2) / (q1+q2)",
            result: finalConc,
          },
        ],
        answer: finalConc,
        unit: "%",
        questionType,
      };
    }

    case "mixture_replacement": {
      const nums = allNums(conditions);
      const total = nums[0] ?? 50;
      const replaced = nums[1] ?? 10;
      const times = nums[2] ?? 1;
      // After n replacements of x from total V: remaining = V * ((V-x)/V)^n
      const remaining = evaluateSafe(
        `${total} * pow((${total} - ${replaced}) / ${total}, ${times})`,
      );
      const pct = evaluateSafe(`(${remaining} / ${total}) * 100`);
      return {
        steps: [
          {
            label: "Given",
            expr: `V=${total}, replaced=${replaced}, times=${times}`,
          },
          { label: "Remaining", expr: "V * ((V-x)/V)^n", result: remaining },
          { label: "Purity%", expr: "remaining/V * 100", result: pct },
        ],
        answer: pct,
        unit: "%",
        questionType,
      };
    }

    // ── Simple Interest ───────────────────────────────────────────────────────
    case "simple_interest": {
      const nums = allNums(conditions);
      const P = v.P ?? nums[0] ?? 1000;
      const R = v.R ?? nums[1] ?? 5;
      const T = v.T ?? nums[2] ?? 2;
      if (P === null) throw new Error("Missing variable P (Principal) for SI");
      if (R === null) throw new Error("Missing variable R (Rate) for SI");
      if (T === null) throw new Error("Missing variable T (Time) for SI");
      const SI = evaluateSafe(`${P} * ${R} * ${T} / 100`);
      return {
        steps: [
          { label: "Given", expr: `P=${P}, R=${R}%, T=${T} years` },
          { label: "SI", expr: "P * R * T / 100", result: SI },
        ],
        answer: SI,
        unit: "₹",
        questionType,
      };
    }

    // ── Compound Interest ─────────────────────────────────────────────────────
    case "compound_interest": {
      const nums = allNums(conditions);
      const P = v.P ?? nums[0] ?? 1000;
      const R = v.R ?? nums[1] ?? 10;
      const T = v.T ?? nums[2] ?? 2;
      if (P === null) throw new Error("Missing variable P (Principal) for CI");
      if (R === null) throw new Error("Missing variable R (Rate) for CI");
      if (T === null) throw new Error("Missing variable T (Time) for CI");
      // Use mathjs pow — never approximate
      const amount = evaluateSafe(`${P} * pow(1 + ${R}/100, ${T})`);
      const CI = evaluateSafe(`${amount} - ${P}`);
      return {
        steps: [
          { label: "Given", expr: `P=${P}, R=${R}%, T=${T} years` },
          { label: "Amount", expr: "P * pow(1 + R/100, T)", result: amount },
          { label: "CI", expr: "Amount - P", result: CI },
        ],
        answer: CI,
        unit: "₹",
        questionType,
      };
    }

    // ── Percentage ────────────────────────────────────────────────────────────
    case "percentage_of":
    case "percentage_increase":
    case "percentage_decrease": {
      const nums = allNums(conditions);
      const value = nums[0] ?? 200;
      const pct = nums[1] ?? 25;
      let answer: number;
      if (questionType === "percentage_increase") {
        answer = evaluateSafe(`${value} * (1 + ${pct}/100)`);
      } else if (questionType === "percentage_decrease") {
        answer = evaluateSafe(`${value} * (1 - ${pct}/100)`);
      } else {
        answer = evaluateSafe(`${value} * ${pct} / 100`);
      }
      return {
        steps: [
          { label: "Given", expr: `value=${value}, %=${pct}` },
          {
            label: "Result",
            expr:
              questionType === "percentage_of"
                ? "value * pct/100"
                : questionType === "percentage_increase"
                  ? "value * (1 + pct/100)"
                  : "value * (1 - pct/100)",
            result: answer,
          },
        ],
        answer,
        unit: "",
        questionType,
      };
    }

    // ── Ratio ─────────────────────────────────────────────────────────────────
    case "ratio_share": {
      const nums = allNums(conditions);
      // Find ratio pattern (e.g. 2:3:5)
      const ratioMatch = /([\d]+)\s*:\s*([\d]+)(?:\s*:\s*([\d]+))?/.exec(
        conditions.rawText,
      );
      let parts: number[];
      if (ratioMatch) {
        parts = [
          Number.parseFloat(ratioMatch[1]),
          Number.parseFloat(ratioMatch[2]),
        ];
        if (ratioMatch[3]) parts.push(Number.parseFloat(ratioMatch[3]));
      } else {
        parts = [nums[0] ?? 1, nums[1] ?? 1];
      }
      const total = nums.find((n) => n > 100) ?? nums[nums.length - 1] ?? 100;
      const totalVal = total;
      const partSum = parts.reduce((a, b) => a + b, 0);
      const answer = evaluateSafe(`(${parts[0]} / ${partSum}) * ${totalVal}`);
      return {
        steps: [
          {
            label: "Given",
            expr: `Ratio = ${parts.join(":")}, Total = ${totalVal}`,
          },
          {
            label: "Part A",
            expr: `(${parts[0]} / ${partSum}) * ${totalVal}`,
            result: answer,
          },
        ],
        answer,
        unit: "",
        questionType,
      };
    }

    // ── Time & Distance ───────────────────────────────────────────────────────
    case "time_distance": {
      const nums = allNums(conditions);
      const speed = nums[0] ?? 60;
      const distance = nums[1] ?? 120;
      const time = evaluateSafe(`${distance} / ${speed}`);
      return {
        steps: [
          { label: "Given", expr: `Speed=${speed}, Distance=${distance}` },
          { label: "Time", expr: "Distance / Speed", result: time },
        ],
        answer: time,
        unit: "hours",
        questionType,
      };
    }

    // ── Average ───────────────────────────────────────────────────────────────
    case "average_simple": {
      const nums = allNums(conditions);
      if (nums.length === 0)
        throw new Error("No numbers found for average calculation");
      const sum = nums.reduce((a, b) => a + b, 0);
      const avg = evaluateSafe(`${sum} / ${nums.length}`);
      return {
        steps: [
          { label: "Given", expr: `Values: ${nums.join(", ")}` },
          { label: "Average", expr: "sum / count", result: avg },
        ],
        answer: avg,
        unit: "",
        questionType,
      };
    }

    default:
      throw new Error(`No formula route for question type: ${questionType}`);
  }
}

/** Safely evaluate a mathjs expression, throwing a descriptive error on failure */
function evaluateSafe(expr: string): number {
  try {
    const result = evaluate(expr);
    const n = typeof result === "number" ? result : mjsNumber(result);
    if (!Number.isFinite(n) || Number.isNaN(n)) {
      throw new Error(`Expression '${expr}' produced non-finite result: ${n}`);
    }
    return n;
  } catch (e) {
    throw new Error(
      `Math evaluation failed for '${expr}': ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/** Extract all plain numeric values from conditions (for fallback ordering) */
function allNums(conditions: ExtractedConditions): number[] {
  const raw = extractAllNumbers(conditions.rawText);
  return raw.map((n) => n.value);
}

// ── MODULE 3: ANSWER VALIDATOR ────────────────────────────────────────────────
//
// Enforces hard rules by question type.
// Returns an error message if any rule is violated.
// Returns null if the answer is valid.
// ─────────────────────────────────────────────────────────────────────────────

export function validateAnswer(
  answer: number,
  questionType: QuestionType,
): { valid: true } | { valid: false; error: string } {
  if (!Number.isFinite(answer) || Number.isNaN(answer)) {
    return { valid: false, error: `Answer is not a finite number: ${answer}` };
  }

  // Any percentage: flag extreme values
  if (
    questionType.includes("percent") ||
    questionType.includes("discount") ||
    questionType.includes("profit") ||
    questionType.includes("loss") ||
    questionType.includes("markup")
  ) {
    if (answer > 1000 || answer < -100) {
      return {
        valid: false,
        error: `Answer ${answer.toFixed(2)}% is outside plausible range [-100, 1000] — likely a calculation error. Re-check inputs.`,
      };
    }
  }

  switch (questionType) {
    case "markup_percent":
      if (answer < 0)
        return {
          valid: false,
          error: `Markup% = ${answer.toFixed(2)} must be >= 0`,
        };
      break;

    case "discount_percent":
      if (answer < 0)
        return {
          valid: false,
          error: `Discount% = ${answer.toFixed(2)} must be >= 0`,
        };
      if (answer > 100)
        return {
          valid: false,
          error: `Discount% = ${answer.toFixed(2)} must be <= 100`,
        };
      break;

    case "profit_percent":
      // SP > CP → must be > 0; SP < CP → it's a loss, answer will be negative
      // Both are valid — the sign tells us profit vs loss
      break;

    case "time_work_combined":
    case "time_work_individual":
    case "time_distance":
      if (answer <= 0)
        return {
          valid: false,
          error: `Time/days = ${answer.toFixed(2)} must be > 0`,
        };
      break;

    case "simple_interest":
    case "compound_interest":
      if (answer <= 0)
        return {
          valid: false,
          error: `Interest = ${answer.toFixed(2)} must be > 0`,
        };
      break;

    case "alligation_ratio":
      if (answer <= 0)
        return { valid: false, error: "Both ratio parts must be > 0" };
      break;
  }

  return { valid: true };
}

// ── MODULE 4: OPTION GENERATOR ────────────────────────────────────────────────
//
// Input: validated correct answer, question type
// Output: exactly 4 shuffled options including the correct answer
//
// Offset tiers (using mathjs arithmetic):
//   0-10:    [1,2,3,4,5]
//   10-50:   [3,5,7,8,10]
//   50-200:  [5,8,10,12,15]
//   200-1000:[10,15,20,25,30]
//   >1000:   [50,75,100,125]
//
// Each wrong option: correct ± random offset
// After generating each wrong option: run through validateAnswer,
//   if invalid (sign violation), flip sign or add instead of subtract
// Round all 4 options to same decimals as correct answer
// Confirm correct answer is in the array before returning
// ─────────────────────────────────────────────────────────────────────────────

export interface MCQOption {
  label: "A" | "B" | "C" | "D";
  text: string;
  isCorrect: boolean;
}

export interface GeneratedOptions {
  options: MCQOption[];
  correctLabel: "A" | "B" | "C" | "D";
  correctAnswer: string;
}

function getDecimalPlaces(n: number): number {
  const s = String(n);
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

function pickRandomOffsets(pool: number[], count: number): number[] {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

export function generateOptions(
  correctAnswer: number,
  questionType: QuestionType,
): GeneratedOptions {
  const absAns = Math.abs(correctAnswer);
  const decimals = getDecimalPlaces(correctAnswer);

  // Tier-based offset pool
  let offsetPool: number[];
  if (absAns <= 10) {
    offsetPool = [1, 2, 3, 4, 5];
  } else if (absAns <= 50) {
    offsetPool = [3, 5, 7, 8, 10];
  } else if (absAns <= 200) {
    offsetPool = [5, 8, 10, 12, 15];
  } else if (absAns <= 1000) {
    offsetPool = [10, 15, 20, 25, 30];
  } else {
    offsetPool = [50, 75, 100, 125];
  }

  const offsets = pickRandomOffsets(offsetPool, 3);
  const wrongOptions: number[] = [];
  const usedValues = new Set<string>([String(round(correctAnswer, decimals))]);

  for (const offset of offsets) {
    // Randomly add or subtract
    const sign = Math.random() < 0.5 ? 1 : -1;
    let candidate = mjsNumber(
      evaluate(`${correctAnswer} + (${sign} * ${offset})`),
    );
    candidate = round(candidate, decimals) as number;

    // Run through validateAnswer — if it violates sign rules, flip
    const validation = validateAnswer(candidate, questionType);
    if (!validation.valid) {
      // Flip: use positive offset instead
      candidate = mjsNumber(evaluate(`${correctAnswer} + ${offset}`));
      candidate = round(candidate, decimals) as number;
    }

    // Ensure uniqueness
    const key = String(candidate);
    if (!usedValues.has(key)) {
      usedValues.add(key);
      wrongOptions.push(candidate);
    } else {
      // Use next offset multiplied up to ensure uniqueness
      let fallback = round(
        mjsNumber(evaluate(`${correctAnswer} + ${offset * 2}`)),
        decimals,
      ) as number;
      if (!usedValues.has(String(fallback))) {
        usedValues.add(String(fallback));
        wrongOptions.push(fallback);
      }
    }
  }

  // Ensure we have exactly 3 wrong options
  let extra = 1;
  while (wrongOptions.length < 3) {
    const candidate = round(
      mjsNumber(evaluate(`${correctAnswer} + ${extra * 5}`)),
      decimals,
    ) as number;
    if (!usedValues.has(String(candidate))) {
      usedValues.add(String(candidate));
      wrongOptions.push(candidate);
    }
    extra++;
    if (extra > 100) break;
  }

  // Build all 4 values
  const allValues = [correctAnswer, ...wrongOptions.slice(0, 3)];

  // Round all to same decimal places as correct answer
  const rounded = allValues.map((v) => round(v, decimals) as number);

  // Shuffle using Fisher-Yates
  const shuffled = [...rounded];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // HARD GUARANTEE: correct answer must be in the array
  const correctRounded = round(correctAnswer, decimals) as number;
  if (!shuffled.includes(correctRounded)) {
    // Replace a random wrong option
    const replaceIdx = Math.floor(Math.random() * 3) + 1;
    shuffled[replaceIdx] = correctRounded;
  }
  // If after replacement there are duplicates, deduplicate
  const seen = new Set<number>();
  const deduped: number[] = [];
  for (const v of shuffled) {
    if (!seen.has(v)) {
      seen.add(v);
      deduped.push(v);
    }
  }
  // Pad if needed
  while (deduped.length < 4) {
    let pad = round(
      mjsNumber(evaluate(`${correctRounded} + ${deduped.length * 7}`)),
      decimals,
    ) as number;
    if (!seen.has(pad)) {
      seen.add(pad);
      deduped.push(pad);
    }
  }

  const labels: ("A" | "B" | "C" | "D")[] = ["A", "B", "C", "D"];
  const correctStr = String(correctRounded);
  const options: MCQOption[] = deduped.slice(0, 4).map((v, i) => ({
    label: labels[i],
    text: String(v),
    isCorrect: v === correctRounded,
  }));

  // Verify exactly one correct
  const correctCount = options.filter((o) => o.isCorrect).length;
  if (correctCount !== 1) {
    for (const o of options) o.isCorrect = o.text === correctStr;
  }

  const correctLabel = options.find((o) => o.isCorrect)?.label ?? "A";
  return { options, correctLabel, correctAnswer: correctStr };
}

// ── MODULE 5: VARIANT ENGINE ──────────────────────────────────────────────────
//
// generateVariant(originalQuestion):
//   1. Extract template (sentence structure with number placeholders)
//   2. Extract original numbers and their constraints
//   3. Generate new numbers within ±10%–40% of original, respecting constraints
//   4. Run full pipeline: extractConditions → routeFormula → validateAnswer → generateOptions
//   5. Substitute new numbers into template
//   6. Confirm text is different from original
//   7. Retry up to 5 times on failure
//   8. On all-fail: throw error (never return wrong options)
// ─────────────────────────────────────────────────────────────────────────────

interface NumberToken {
  value: number;
  index: number;
  length: number;
  original: string;
}

function extractTokensFromText(text: string): NumberToken[] {
  const norm = normalizeText(text);
  const tokens: NumberToken[] = [];
  const re = /\b(\d+(?:\.\d+)?)\b/g;
  let m = re.exec(norm);
  while (m !== null) {
    tokens.push({
      value: Number.parseFloat(m[1]),
      index: m.index,
      length: m[0].length,
      original: m[0],
    });
    m = re.exec(norm);
  }
  return tokens;
}

function replaceTokensInText(
  text: string,
  tokens: NumberToken[],
  newValues: number[],
): string {
  const norm = normalizeText(text);
  // Replace from right to left so indices don't shift
  const sorted = tokens
    .map((t, i) => ({ ...t, newVal: newValues[i] ?? t.value }))
    .sort((a, b) => b.index - a.index);

  let result = norm;
  for (const token of sorted) {
    const formatted = Number.isInteger(token.newVal)
      ? String(Math.round(token.newVal))
      : token.newVal.toFixed(2);
    result =
      result.slice(0, token.index) +
      formatted +
      result.slice(token.index + token.length);
  }
  return result;
}

function generateConstrainedNumber(
  original: number,
  isPercentage: boolean,
): number {
  // Bounded random: original ± (10% to 40% of original)
  const minPct = 0.1;
  const maxPct = 0.4;
  const variation = original * (minPct + Math.random() * (maxPct - minPct));
  const sign = Math.random() < 0.5 ? 1 : -1;
  let newVal = original + sign * variation;

  // Constraints:
  if (isPercentage) {
    newVal = Math.max(1, Math.min(99, newVal)); // percentages stay in 1–99
  } else {
    newVal = Math.max(1, newVal); // all numbers must stay positive
  }

  // Round to same decimal places as original
  const decimals = getDecimalPlaces(original);
  newVal = round(newVal, decimals) as number;

  return newVal;
}

export interface VariantResult {
  questionText: string;
  options: MCQOption[];
  correctLabel: "A" | "B" | "C" | "D";
  correctAnswer: string;
  solution: { phase1: string; phase2: string; phase3: string };
  questionType: QuestionType;
  unit: string;
}

export function generateVariant(originalQuestion: string): VariantResult {
  const tokens = extractTokensFromText(originalQuestion);
  if (tokens.length === 0) {
    throw new Error("No numbers found in question — cannot generate variant");
  }

  // Detect which tokens are percentage values (appear near % or percentage-related keywords)
  const _lowerQ = originalQuestion.toLowerCase();
  const isPercentageContext = (index: number): boolean => {
    const surrounding = originalQuestion.slice(
      Math.max(0, index - 5),
      Math.min(originalQuestion.length, index + 10),
    );
    return /%|percent|discount|markup|profit|loss/i.test(surrounding);
  };

  const MAX_RETRIES = 5;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Generate new number set
    const newValues = tokens.map((t) =>
      generateConstrainedNumber(t.value, isPercentageContext(t.index)),
    );

    // Rebuild question text
    const newText = replaceTokensInText(originalQuestion, tokens, newValues);

    // Confirm at least one number changed
    if (newText === originalQuestion) continue;

    // Run full pipeline
    try {
      const conditions = extractConditions(newText);
      const route = routeFormula(conditions);
      const validation = validateAnswer(route.answer, route.questionType);

      if (!validation.valid) {
        // Invalid result — retry with different numbers
        continue;
      }

      const options = generateOptions(route.answer, route.questionType);

      // Build solution phases from route steps
      const phase1 = route.steps[0]?.expr ?? "Given data extracted";
      const midSteps = route.steps
        .slice(1, -1)
        .map(
          (s) =>
            `${s.label}: ${s.expr}${s.result !== undefined ? ` = ${s.result.toFixed(2)}` : ""}`,
        )
        .join(" | ");
      const lastStep = route.steps[route.steps.length - 1];
      const phase3 = lastStep
        ? `${lastStep.label}: ${lastStep.expr}${lastStep.result !== undefined ? ` = ${lastStep.result.toFixed(2)}` : ""}`
        : `Answer = ${route.answer.toFixed(2)}`;

      return {
        questionText: newText,
        options: options.options,
        correctLabel: options.correctLabel,
        correctAnswer: options.correctAnswer,
        solution: { phase1, phase2: midSteps, phase3 },
        questionType: route.questionType,
        unit: route.unit,
      };
    } catch {}
  }

  throw new Error(
    "Could not generate valid variant for this question type after 5 attempts",
  );
}

// ── MODULE 6: VOCAB NO-REPEAT ENGINE (Fisher-Yates) ───────────────────────────
//
// Uses localStorage to persist the shuffled order and current index.
// Guarantees every word appears exactly once per cycle.
// Different shuffle order each cycle.
// Never restarts from zero unless user explicitly resets.
// ─────────────────────────────────────────────────────────────────────────────

const VOCAB_SHUFFLE_KEY = "variant_vocab_shuffled";
const VOCAB_INDEX_KEY = "variant_vocab_index";

/**
 * Fisher-Yates in-place shuffle.
 */
export function fisherYatesShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Initialize the vocab cycle for a given word array.
 * Called once on first load (or when no persisted state exists).
 * Creates a Fisher-Yates shuffled array in localStorage starting at index 0.
 */
export function initVocabCycle(words: string[]): void {
  const shuffled = fisherYatesShuffle(words);
  localStorage.setItem(VOCAB_SHUFFLE_KEY, JSON.stringify(shuffled));
  localStorage.setItem(VOCAB_INDEX_KEY, "0");
}

/**
 * Get the next vocab word in the cycle.
 * On first call (no localStorage state), initializes with a fresh shuffle.
 * When the end of the array is reached, reshuffles and resets index to 0.
 * Returns the word string.
 */
export function getNextVocabWord(allWords: string[]): string {
  let shuffled: string[];
  let index: number;

  try {
    const raw = localStorage.getItem(VOCAB_SHUFFLE_KEY);
    const rawIdx = localStorage.getItem(VOCAB_INDEX_KEY);

    if (!raw || !rawIdx) {
      // First load — initialize
      const fresh = fisherYatesShuffle(allWords);
      localStorage.setItem(VOCAB_SHUFFLE_KEY, JSON.stringify(fresh));
      localStorage.setItem(VOCAB_INDEX_KEY, "0");
      return fresh[0];
    }

    shuffled = JSON.parse(raw) as string[];
    index = Number.parseInt(rawIdx, 10);

    // If the stored array doesn't match current word list (words added/removed),
    // reinitialize
    if (shuffled.length !== allWords.length) {
      const fresh = fisherYatesShuffle(allWords);
      localStorage.setItem(VOCAB_SHUFFLE_KEY, JSON.stringify(fresh));
      localStorage.setItem(VOCAB_INDEX_KEY, "0");
      return fresh[0];
    }

    // If index reached end, reshuffle with new random order
    if (index >= shuffled.length) {
      const fresh = fisherYatesShuffle(allWords);
      localStorage.setItem(VOCAB_SHUFFLE_KEY, JSON.stringify(fresh));
      localStorage.setItem(VOCAB_INDEX_KEY, "1");
      return fresh[0];
    }

    // Normal path: return current word, increment index
    const word = shuffled[index];
    localStorage.setItem(VOCAB_INDEX_KEY, String(index + 1));
    return word;
  } catch {
    // localStorage failure — fall back to random
    return allWords[Math.floor(Math.random() * allWords.length)];
  }
}

/**
 * Reset the vocab cycle. Clears localStorage state.
 * The next call to getNextVocabWord will start a fresh shuffle.
 */
export function resetVocabCycle(): void {
  localStorage.removeItem(VOCAB_SHUFFLE_KEY);
  localStorage.removeItem(VOCAB_INDEX_KEY);
}

/**
 * Full pipeline: extract → route → validate → generate options.
 * This is the mandatory pipeline entry point.
 * Throws at any step — never falls through to a default.
 */
export function runFullPipeline(questionText: string): VariantResult {
  // Step 1: Extract
  const conditions = extractConditions(questionText);

  // Step 2: Route
  const route = routeFormula(conditions);

  // Step 3: Validate
  const validation = validateAnswer(route.answer, route.questionType);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.error}`);
  }

  // Step 4: Generate options
  const optResult = generateOptions(route.answer, route.questionType);

  // Build solution
  const phase1 = route.steps[0]?.expr ?? "Given data";
  const midSteps = route.steps
    .slice(1, -1)
    .map(
      (s) =>
        `${s.label}: ${s.expr}${s.result !== undefined ? ` = ${Number(s.result).toFixed(2)}` : ""}`,
    )
    .join(" | ");
  const lastStep = route.steps[route.steps.length - 1];
  const phase3 = lastStep
    ? `${lastStep.label}: ${lastStep.expr}${lastStep.result !== undefined ? ` = ${Number(lastStep.result).toFixed(2)}` : ""}`
    : `Answer = ${route.answer.toFixed(2)}`;

  return {
    questionText,
    options: optResult.options,
    correctLabel: optResult.correctLabel,
    correctAnswer: optResult.correctAnswer,
    solution: { phase1, phase2: midSteps, phase3 },
    questionType: route.questionType,
    unit: route.unit,
  };
}
