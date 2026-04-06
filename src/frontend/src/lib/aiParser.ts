// ============================================================
// AI PARSER — Smart rule-based question structure extractor
// Uses regex + keyword detection (deterministic, no LLM)
// AI ONLY extracts structure — NEVER computes answers
// ============================================================

export type QuestionTopic =
  | "work_wages"
  | "profit_loss"
  | "time_distance"
  | "simple_interest"
  | "compound_interest"
  | "percentage"
  | "ratio"
  | "work_time"
  | "mixture"
  | "averages"
  | "unknown";

export interface WorkerInfo {
  name: string;
  time: number; // hours or days to complete work
}

export interface DepartureEvent {
  worker: string;
  leaves_after?: number; // leaves after X hours from start
  leaves_before_end?: number; // leaves X hours before completion
}

export interface WorkWagesParams {
  topic: "work_wages";
  workers: WorkerInfo[];
  events: DepartureEvent[];
  total_payment: number;
  asked_worker: string; // which worker's share is being asked
}

export interface ProfitLossParams {
  topic: "profit_loss";
  cp: number;
  markup_pct?: number; // markup over CP
  discount_pct?: number; // discount on marked price
  buying_fraction?: number; // cheating: buys X more (e.g. 1.2 means 20% more)
  selling_fraction?: number; // cheating: sells X less (e.g. 0.8 means 20% less)
  sp?: number; // direct SP if given
  // Free items: x free on every y purchased
  free_items_given?: number; // x free items
  free_items_on?: number; // on y items purchased
  subtype:
    | "standard"
    | "cheat_weight"
    | "successive_discount"
    | "find_sp"
    | "free_items";
}

export interface TimeDistanceParams {
  topic: "time_distance";
  speed?: number;
  distance?: number;
  time?: number;
  speed2?: number; // for relative speed / two-leg problems
  distance2?: number;
  asked: "time" | "speed" | "distance" | "average_speed";
  subtype:
    | "simple"
    | "average"
    | "relative_opposite"
    | "relative_same"
    | "train";
}

export interface SimpleInterestParams {
  topic: "simple_interest";
  principal: number;
  rate: number;
  time: number;
  asked: "si" | "total" | "principal" | "rate" | "time";
}

export interface CompoundInterestParams {
  topic: "compound_interest";
  principal: number;
  rate: number;
  time: number;
  frequency: "annual" | "half_yearly" | "quarterly";
  asked: "ci" | "amount";
}

export interface PercentageParams {
  topic: "percentage";
  value: number;
  percent: number;
  direction: "increase" | "decrease" | "of" | "what_percent";
  second_value?: number; // for "A is what % of B"
}

export interface RatioParams {
  topic: "ratio";
  parts: number[]; // e.g. [2, 3, 5] for A:B:C = 2:3:5
  total: number;
  asked_index: number; // which part is asked
}

export interface WorkTimeParams {
  topic: "work_time";
  workers: WorkerInfo[];
  asked: "together" | "individual";
  pipe_fill?: number; // filling pipe rate
  pipe_empty?: number; // emptying pipe rate
}

// NEW: Mixture & Alligation
export interface MixtureParams {
  topic: "mixture";
  q1: number; // quantity of first ingredient/vessel
  c1: number; // concentration/price of first ingredient
  q2: number; // quantity of second ingredient/vessel
  c2: number; // concentration/price of second ingredient
  mean?: number; // mean price/concentration (for alligation)
  replacement_qty?: number; // for replacement problems
  replacement_times?: number; // number of replacements
  subtype: "two_vessel" | "alligation" | "replacement";
}

// NEW: Averages
export interface AveragesParams {
  topic: "averages";
  values?: number[]; // list of values to average
  count?: number; // number of items
  known_avg?: number; // given average
  weights?: number[]; // for weighted average
  new_element?: number; // element added to set
  remove_element?: number; // element removed from set
  asked_new_avg?: number; // target average after add/remove
  subtype: "simple" | "weighted" | "add_remove";
}

export type ParsedQuestion =
  | WorkWagesParams
  | ProfitLossParams
  | TimeDistanceParams
  | SimpleInterestParams
  | CompoundInterestParams
  | PercentageParams
  | RatioParams
  | WorkTimeParams
  | MixtureParams
  | AveragesParams
  | { topic: "unknown"; nums: number[]; text: string };

// ── Utility helpers ─────────────────────────────────────────────────

function normalize(text: string): string {
  // Normalize thousands separators: 3,600 -> 3600
  return text.replace(/(\d),(\d{3})(?=\D|$)/g, "$1$2");
}

function extractAllNumbers(text: string): number[] {
  const norm = normalize(text);
  const matches = norm.match(/\b\d+(?:\.\d+)?\b/g) ?? [];
  return matches.map(Number).filter((n) => !Number.isNaN(n));
}

function extractCurrencyValue(text: string): number {
  const norm = normalize(text);
  // Match ₹3600 or Rs 3600 or total payment is 3600
  const m =
    norm.match(/[₹Rs\.]+\s*(\d+(?:\.\d+)?)/i) ||
    norm.match(
      /(?:total\s+)?(?:payment|wages?|salary)[^\d]*(\d+(?:\.\d+)?)/i,
    ) ||
    norm.match(/(?:paid|earn|receive)[^\d\n]*(\d{3,})/i);
  return m ? Number.parseFloat(m[1]) : 0;
}

function detectAskedPerson(text: string): string {
  const lower = text.toLowerCase();
  const labels = ["a", "b", "c", "d", "e"];
  // "how much does B receive" / "B's share"
  for (const label of labels) {
    const pattern = new RegExp(
      `\\b${label}\\s*(?:'s)?\\s*(?:share|receive|get|earn|paid|payment|wage)`,
      "i",
    );
    if (pattern.test(lower)) return label.toUpperCase();
    const pattern2 = new RegExp(
      `(?:how much does|what does)\\s+${label}\\b`,
      "i",
    );
    if (pattern2.test(lower)) return label.toUpperCase();
  }
  return "B"; // default
}

// ── Work & Wages Parser ────────────────────────────────────────────────

function parseWorkWages(text: string): WorkWagesParams | null {
  const norm = normalize(text);
  const lower = norm.toLowerCase();

  const hasWorkKeyword = /\b(work|complete|sort|pack|fill|task|job)\b/.test(
    lower,
  );
  const hasPaymentKeyword =
    /\b(wage|wages|earn|salary|paid|payment|receive|share)\b/.test(lower);
  if (!hasWorkKeyword || !hasPaymentKeyword) return null;

  // Extract worker names and their completion times
  // Pattern: "A can complete in 40 hours" / "A in 40 hours" / "A takes 40"
  const workerPattern =
    /\b([A-E])\b[^.]*?\b(\d+)\s*(?:hours?|days?|hrs?|h\b)/gi;
  const workers: WorkerInfo[] = [];
  let match = workerPattern.exec(norm);
  while (match !== null) {
    const existing = workers.find((w) => w.name === match![1].toUpperCase());
    if (!existing) {
      workers.push({
        name: match[1].toUpperCase(),
        time: Number.parseInt(match[2], 10),
      });
    }
    match = workerPattern.exec(norm);
  }

  // Extract departure events
  const events: DepartureEvent[] = [];

  // "after X hours, A leaves" / "A leaves after X hours"
  const leavesAfterPattern =
    /\b([A-E])\b[^.]*?(?:leaves?|left|departs?)[^.]*?after\s+(\d+)\s*(?:hours?|days?)/gi;
  let m2 = leavesAfterPattern.exec(lower);
  while (m2 !== null) {
    events.push({
      worker: m2[1].toUpperCase(),
      leaves_after: Number.parseInt(m2[2], 10),
    });
    m2 = leavesAfterPattern.exec(lower);
  }

  // "after X hours, A leaves" (reverse word order)
  const afterXPattern =
    /after\s+(\d+)\s*(?:hours?|days?)[^.]*?\b([A-E])\b[^.]*?(?:leaves?|left|departs?)/gi;
  let m3 = afterXPattern.exec(lower);
  while (m3 !== null) {
    const workerName = m3[2].toUpperCase();
    if (
      !events.find(
        (e) => e.worker === workerName && e.leaves_after !== undefined,
      )
    ) {
      events.push({
        worker: workerName,
        leaves_after: Number.parseInt(m3[1], 10),
      });
    }
    m3 = afterXPattern.exec(lower);
  }

  // "C leaves X hours before completion/end/finish"
  const leavesBeforePattern =
    /\b([A-E])\b[^.]*?(?:leaves?|left|departs?)[^.]*?(\d+)\s*(?:hours?|days?)[^.]*?(?:before|prior)[^.]*?(?:completion|end|finish|done)/gi;
  let m4 = leavesBeforePattern.exec(lower);
  while (m4 !== null) {
    events.push({
      worker: m4[1].toUpperCase(),
      leaves_before_end: Number.parseInt(m4[2], 10),
    });
    m4 = leavesBeforePattern.exec(lower);
  }

  // "C leaves 14 hours before the work is finished"
  const beforeEndPattern =
    /(\d+)\s*(?:hours?|days?)[^.]*?before[^.]*?(?:completion|end|finish|done|sorting|packing|work)[^.]*?\b([A-E])\b[^.]*?(?:leaves?|left)/gi;
  let m5 = beforeEndPattern.exec(lower);
  while (m5 !== null) {
    const workerName = m5[2].toUpperCase();
    if (
      !events.find(
        (e) => e.worker === workerName && e.leaves_before_end !== undefined,
      )
    ) {
      events.push({
        worker: workerName,
        leaves_before_end: Number.parseInt(m5[1], 10),
      });
    }
    m5 = beforeEndPattern.exec(lower);
  }

  // Also catch "C leaves 14 hours before the work finishes" with different ordering
  const altBeforePattern =
    /\b([A-E])\b[^.]*?leaves?[^.]*?(\d+)\s*(?:hours?|days?)\s*before/gi;
  let m6 = altBeforePattern.exec(lower);
  while (m6 !== null) {
    const workerName = m6[1].toUpperCase();
    if (!events.find((e) => e.worker === workerName)) {
      events.push({
        worker: workerName,
        leaves_before_end: Number.parseInt(m6[2], 10),
      });
    }
    m6 = altBeforePattern.exec(lower);
  }

  // Extract total payment
  let total_payment = extractCurrencyValue(norm);
  if (!total_payment) {
    // fallback: largest number in question
    const nums = extractAllNumbers(norm);
    total_payment = Math.max(...nums) || 3600;
  }

  if (workers.length === 0) return null;

  return {
    topic: "work_wages",
    workers,
    events,
    total_payment,
    asked_worker: detectAskedPerson(text),
  };
}

// ── Profit & Loss Parser ──────────────────────────────────────────────

function parseProfitLoss(text: string): ProfitLossParams | null {
  const norm = normalize(text);
  const lower = norm.toLowerCase();

  if (
    !/\b(profit|loss|cp|sp|cost|selling|markup|discount|gain|buy|sell|free|bonus)\b/.test(
      lower,
    )
  )
    return null;

  const nums = extractAllNumbers(norm);

  // FREE ITEMS detection: "buy X get Y free" / "X free on every Y"
  const freeOnMatch =
    norm.match(/(\d+)\s*free\s+(?:on|with|for every|per)\s*(\d+)/i) ||
    norm.match(/buy\s*(\d+)\s*(?:and|,)?\s*get\s*(\d+)\s*free/i) ||
    norm.match(
      /(\d+)\s*free\s+(?:articles?|items?|pieces?)\s*(?:on|with|for)\s*(\d+)/i,
    );

  if (freeOnMatch) {
    const freeGiven = Number.parseInt(freeOnMatch[1], 10);
    const paidFor = Number.parseInt(freeOnMatch[2], 10);
    // CP: look for cost price explicitly
    const cpMatch =
      norm.match(/(?:cp|cost price)[^\d]*(\d+)/i) ||
      norm.match(/[₹Rs]+\s*(\d+)/i);
    const cp = cpMatch
      ? Number.parseFloat(cpMatch[1])
      : (nums.find((n) => n > 10) ?? 100);
    const markupMatch = norm.match(
      /(?:mark(?:ed)?|markup)[^\d]*(\d+(?:\.\d+)?)\s*%/i,
    );
    const discountMatch = norm.match(/discount[^\d]*(\d+(?:\.\d+)?)\s*%/i);
    const markup = markupMatch ? Number.parseFloat(markupMatch[1]) : 0;
    const discount = discountMatch ? Number.parseFloat(discountMatch[1]) : 0;
    return {
      topic: "profit_loss",
      cp,
      markup_pct: markup,
      discount_pct: discount > 0 ? discount : undefined,
      free_items_given: freeGiven,
      free_items_on: paidFor,
      subtype: "free_items",
    };
  }

  // Detect cheating/weight fraud
  const isCheat =
    /dishonest|cheat|fraud|tamper|weigh|weights?|measure|scale|deficient|more than|less than/.test(
      lower,
    );

  if (isCheat) {
    // Extract "buys X% more" or "200g instead of 500g"
    const buyMore = norm.match(
      /(\d+)(?:\.\d+)?\s*%?\s*more(?:\s+than\s+stated)?/i,
    );
    const sellLess = norm.match(
      /(\d+)(?:\.\d+)?\s*%?\s*less(?:\s+than\s+stated)?/i,
    );
    const deficientBuy = norm.match(
      /(?:pays for|buys)\s*(\d+)\s*(?:but gets|and gets)\s*(\d+)/i,
    );
    const deficientSell = norm.match(
      /(?:sells|gives)\s*(\d+)\s*(?:but charges for|charging for)\s*(\d+)/i,
    );

    let buyFraction = 1;
    let sellFraction = 1;

    if (buyMore) {
      buyFraction = 1 + Number.parseFloat(buyMore[1]) / 100;
    } else if (deficientBuy) {
      // pays for X but gets Y: buying fraction = Y/X
      buyFraction =
        Number.parseFloat(deficientBuy[2]) / Number.parseFloat(deficientBuy[1]);
    }

    if (sellLess) {
      sellFraction = 1 - Number.parseFloat(sellLess[1]) / 100;
    } else if (deficientSell) {
      sellFraction =
        Number.parseFloat(deficientSell[1]) /
        Number.parseFloat(deficientSell[2]);
    }

    // Markup %
    const markupMatch =
      norm.match(
        /(?:mark(?:ed)?(?:\s+up)?|price)\s+(?:at\s+)?(?:a\s+)?(?:gain|profit|markup)\s+of\s+(\d+(?:\.\d+)?)\s*%/i,
      ) ||
      norm.match(
        /(\d+(?:\.\d+)?)\s*%\s*(?:above|over|more than)\s*(?:cp|cost)/i,
      );
    const markup = markupMatch
      ? Number.parseFloat(markupMatch[1])
      : (nums[1] ?? 20);

    return {
      topic: "profit_loss",
      cp: nums[0] ?? 100,
      markup_pct: markup,
      buying_fraction: buyFraction,
      selling_fraction: sellFraction,
      subtype: "cheat_weight",
    };
  }

  // Successive discounts
  const succDiscount = /successive|two discount|double discount/.test(lower);
  if (succDiscount) {
    const discounts = nums.filter((n) => n < 100);
    return {
      topic: "profit_loss",
      cp: nums[0] ?? 100,
      discount_pct: discounts[0] ?? 20,
      markup_pct: discounts[1] ?? 10,
      subtype: "successive_discount",
    };
  }

  // Standard markup + discount
  const markupMatch = norm.match(
    /(?:mark(?:ed)?(?:\s+up)?)[^\d]*(\d+(?:\.\d+)?)\s*%/i,
  );
  const discountMatch = norm.match(/discount[^\d]*(\d+(?:\.\d+)?)\s*%/i);
  const cpMatch =
    norm.match(/(?:cost\s+price|cp)[^\u20b9\d]*(\d+(?:\.\d+)?)/i) ||
    norm.match(/[\u20b9Rs]+\s*(\d+(?:\.\d+)?)/i);

  const cp = cpMatch ? Number.parseFloat(cpMatch[1]) : (nums[0] ?? 100);
  const markup = markupMatch
    ? Number.parseFloat(markupMatch[1])
    : (nums[1] ?? 20);
  const rawDiscount = discountMatch
    ? Number.parseFloat(discountMatch[1])
    : undefined;

  // PARAMETER VALIDATION: discount >= 100% makes SP <= 0 (impossible question).
  // If the parser extracts such a value it means the question itself is invalid.
  // We clamp to 95% as an emergency rail and let the solver's validator catch it.
  const discount =
    rawDiscount !== undefined
      ? Math.min(99, Math.max(0, rawDiscount))
      : undefined;

  return {
    topic: "profit_loss",
    cp,
    markup_pct: markup,
    discount_pct: discount,
    subtype: discount !== undefined ? "find_sp" : "standard",
  };
}

// ── Time & Distance Parser ───────────────────────────────────────────────

function parseTimeDistance(text: string): TimeDistanceParams | null {
  const norm = normalize(text);
  const lower = norm.toLowerCase();

  if (
    !/\b(speed|distance|km|mph|kmph|km\/h|train|car|bus|travels?|journey)\b/.test(
      lower,
    )
  )
    return null;

  const nums = extractAllNumbers(norm);
  const speedMatch = norm.match(
    /(\d+(?:\.\d+)?)\s*(?:km\/h|kmph|mph|km per hour)/i,
  );
  const distanceMatch = norm.match(/(\d+(?:\.\d+)?)\s*km/i);
  const timeMatch = norm.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i);

  const speed = speedMatch ? Number.parseFloat(speedMatch[1]) : (nums[0] ?? 60);
  const distance = distanceMatch
    ? Number.parseFloat(distanceMatch[1])
    : (nums[1] ?? 120);
  const time = timeMatch ? Number.parseFloat(timeMatch[1]) : undefined;

  // Detect relative speed
  const isRelativeOpposite =
    /towards|opposite direction|coming from|head-on/.test(lower);
  const isRelativeSame = /same direction|overtake|following/.test(lower);
  const isAverage = /average speed|total distance/.test(lower);
  const isTrain = /\btrain\b/.test(lower);

  const asked: TimeDistanceParams["asked"] = /how long|time taken/.test(lower)
    ? "time"
    : /how fast|speed/.test(lower)
      ? "speed"
      : /how far|distance/.test(lower)
        ? "distance"
        : isAverage
          ? "average_speed"
          : "time";

  return {
    topic: "time_distance",
    speed,
    distance,
    time,
    asked,
    subtype: isRelativeOpposite
      ? "relative_opposite"
      : isRelativeSame
        ? "relative_same"
        : isAverage
          ? "average"
          : isTrain
            ? "train"
            : "simple",
  };
}

// ── Simple Interest Parser ───────────────────────────────────────────────

function parseSimpleInterest(text: string): SimpleInterestParams | null {
  const norm = normalize(text);
  const lower = norm.toLowerCase();

  if (!/simple interest|\bsi\b|per annum|per year/.test(lower)) return null;
  if (/compound/.test(lower)) return null;

  const nums = extractAllNumbers(norm);
  const P = nums[0] ?? 1000;
  const R = nums[1] ?? 5;
  const T = nums[2] ?? 2;

  const asked: SimpleInterestParams["asked"] = /total|amount/.test(lower)
    ? "total"
    : /find.*principal|what.*principal/.test(lower)
      ? "principal"
      : /find.*rate|what.*rate/.test(lower)
        ? "rate"
        : /find.*time|how many years/.test(lower)
          ? "time"
          : "si";

  return { topic: "simple_interest", principal: P, rate: R, time: T, asked };
}

// ── Compound Interest Parser ───────────────────────────────────────────────

function parseCompoundInterest(text: string): CompoundInterestParams | null {
  const norm = normalize(text);
  const lower = norm.toLowerCase();

  if (!/compound interest|compounded/.test(lower)) return null;

  const nums = extractAllNumbers(norm);
  const P = nums[0] ?? 1000;
  const R = nums[1] ?? 10;
  const T = nums[2] ?? 2;

  const freq: CompoundInterestParams["frequency"] =
    /half.?yearly|semi.?annual/.test(lower)
      ? "half_yearly"
      : /quarter/.test(lower)
        ? "quarterly"
        : "annual";

  const asked: CompoundInterestParams["asked"] = /\bamount\b/.test(lower)
    ? "amount"
    : "ci";

  return {
    topic: "compound_interest",
    principal: P,
    rate: R,
    time: T,
    frequency: freq,
    asked,
  };
}

// ── Percentage Parser ──────────────────────────────────────────────────────

function parsePercentage(text: string): PercentageParams | null {
  const norm = normalize(text);
  const lower = norm.toLowerCase();

  if (!/percent|%|percentage/.test(lower)) return null;
  // Exclude interest and profit/loss which have more specific parsers
  if (/interest|profit|loss|discount|markup/.test(lower)) return null;

  const nums = extractAllNumbers(norm);
  const value = nums[0] ?? 200;
  const percent = nums[1] ?? 25;

  const direction: PercentageParams["direction"] =
    /increase|rise|grew|goes up/.test(lower)
      ? "increase"
      : /decrease|fall|dropped|goes down|reduced/.test(lower)
        ? "decrease"
        : /what percent|what %|how much percent/.test(lower)
          ? "what_percent"
          : "of";

  return {
    topic: "percentage",
    value,
    percent,
    direction,
    second_value: nums[2],
  };
}

// ── Ratio Parser ───────────────────────────────────────────────────────────────

function parseRatio(text: string): RatioParams | null {
  const norm = normalize(text);
  const lower = norm.toLowerCase();

  if (!/\b(ratio|proportion|\d+\s*:\s*\d+)\b/.test(lower)) return null;

  // Extract ratio like 2:3:5 or 2 : 3
  const ratioMatch = norm.match(/(\d+)\s*:\s*(\d+)(?:\s*:\s*(\d+))?/);
  let parts: number[] = [1, 1];
  if (ratioMatch) {
    parts = [
      Number.parseInt(ratioMatch[1], 10),
      Number.parseInt(ratioMatch[2], 10),
    ];
    if (ratioMatch[3]) parts.push(Number.parseInt(ratioMatch[3], 10));
  }

  const nums = extractAllNumbers(norm);
  const total =
    nums.find((n) => n > 100 && !parts.includes(n)) ??
    nums[nums.length - 1] ??
    100;

  const asked_index = 0; // default first

  return { topic: "ratio", parts, total, asked_index };
}

// ── Work & Time Parser ─────────────────────────────────────────────────────

function parseWorkTime(text: string): WorkTimeParams | null {
  const norm = normalize(text);
  const lower = norm.toLowerCase();

  if (!/ \b(work|complete|together|alone|pipe|tank|fill|empty)\b/.test(lower))
    return null;
  // Exclude wage questions (handled by work_wages)
  if (/\b(wage|wages|earn|salary|paid|payment)\b/.test(lower)) return null;

  const workerPattern = /\b([A-E])\b[^.]*?\b(\d+)\s*(?:hours?|days?|hrs?)/gi;
  const workers: WorkerInfo[] = [];
  let m = workerPattern.exec(norm);
  while (m !== null) {
    const existing = workers.find((w) => w.name === m![1].toUpperCase());
    if (!existing) {
      workers.push({
        name: m[1].toUpperCase(),
        time: Number.parseInt(m[2], 10),
      });
    }
    m = workerPattern.exec(norm);
  }

  if (workers.length < 2) {
    const nums = extractAllNumbers(norm).filter((n) => n < 500);
    for (let i = 0; i < Math.min(nums.length, 3); i++) {
      workers.push({ name: String.fromCharCode(65 + i), time: nums[i] });
    }
  }

  const isPipe = /pipe|tank|cistern|fill|empty/.test(lower);

  return {
    topic: "work_time",
    workers,
    asked: "together",
    pipe_fill: isPipe ? workers[0]?.time : undefined,
    pipe_empty: isPipe ? workers[1]?.time : undefined,
  };
}

// ── Mixture & Alligation Parser ───────────────────────────────────────────────

function parseMixture(text: string): MixtureParams | null {
  const norm = normalize(text);
  const lower = norm.toLowerCase();

  if (
    !/\b(mixture|mix|alligation|blend|solution|concentration|litre|liter|vessel|replace|replacement|dilut)\b/.test(
      lower,
    )
  )
    return null;

  const nums = extractAllNumbers(norm);

  // Replacement: "X litres withdrawn and replaced"
  const isReplacement = /replace|withdraw|repeated|successive/.test(lower);
  if (isReplacement) {
    const v = nums[0] ?? 50; // total volume
    const x = nums[1] ?? 10; // replaced each time
    const n = nums[2] ?? 1; // times repeated
    return {
      topic: "mixture",
      q1: v,
      c1: 100, // starts as pure
      q2: 0,
      c2: 0,
      replacement_qty: x,
      replacement_times: n,
      subtype: "replacement",
    };
  }

  // Alligation: "mean price" or "ratio in which"
  const isAlligation = /mean price|in what ratio|alligation|which ratio/.test(
    lower,
  );
  if (isAlligation) {
    const c1 = nums[0] ?? 20;
    const c2 = nums[1] ?? 30;
    const mean = nums[2] ?? (c1 + c2) / 2;
    return {
      topic: "mixture",
      q1: c2 - mean,
      c1,
      q2: mean - c1,
      c2,
      mean,
      subtype: "alligation",
    };
  }

  // Two vessel mixing
  const q1 = nums[0] ?? 10;
  const c1 = nums[1] ?? 20;
  const q2 = nums[2] ?? 15;
  const c2 = nums[3] ?? 40;

  return {
    topic: "mixture",
    q1,
    c1,
    q2,
    c2,
    subtype: "two_vessel",
  };
}

// ── Averages Parser ────────────────────────────────────────────────────────────────

function parseAverages(text: string): AveragesParams | null {
  const norm = normalize(text);
  const lower = norm.toLowerCase();

  if (!/\b(average|mean|avg|arithmetic mean)\b/.test(lower)) return null;

  const nums = extractAllNumbers(norm);

  // Add/remove element scenario: "average increases/decreases after adding/removing"
  const isAddRemove =
    /(?:add|include|join|new|enter|leave|remov|replac|withdraw|exit)/.test(
      lower,
    );
  if (isAddRemove) {
    const count = nums[0] ?? 5;
    const knownAvg = nums[1] ?? 20;
    const newEl = nums[2] ?? 30;
    const askedNewAvg = nums[3];
    return {
      topic: "averages",
      count,
      known_avg: knownAvg,
      new_element: newEl,
      asked_new_avg: askedNewAvg,
      subtype: "add_remove",
    };
  }

  // Weighted average: "group of X at avg Y and group of Z at avg W"
  const isWeighted = /group|section|class|department|two sets|weighted/.test(
    lower,
  );
  if (isWeighted && nums.length >= 4) {
    return {
      topic: "averages",
      weights: [nums[0], nums[2]],
      values: [nums[1], nums[3]],
      subtype: "weighted",
    };
  }

  // Simple average
  if (nums.length >= 2) {
    return {
      topic: "averages",
      values: nums.slice(0, Math.min(nums.length, 6)),
      count: nums.length,
      subtype: "simple",
    };
  }

  return null;
}

// ── Main export ────────────────────────────────────────────────────────────────

export function parseQuestion(text: string): ParsedQuestion {
  // Priority order: most specific first
  const workWages = parseWorkWages(text);
  if (workWages) return workWages;

  const td = parseTimeDistance(text);
  if (td) return td;

  const pl = parseProfitLoss(text);
  if (pl) return pl;

  const ci = parseCompoundInterest(text);
  if (ci) return ci;

  const si = parseSimpleInterest(text);
  if (si) return si;

  const pct = parsePercentage(text);
  if (pct) return pct;

  const ratio = parseRatio(text);
  if (ratio) return ratio;

  const mixture = parseMixture(text);
  if (mixture) return mixture;

  const averages = parseAverages(text);
  if (averages) return averages;

  const workTime = parseWorkTime(text);
  if (workTime) return workTime;

  const nums = extractAllNumbers(text);
  return { topic: "unknown", nums, text };
}
