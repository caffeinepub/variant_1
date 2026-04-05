// ============================================================
// VARIANT ENGINE v3 — Mathematical solver + Rule of 4 distractors
// + 3-Filter Validation System
// ============================================================

export interface Settings {
  integerOnly: boolean;
  decimalPrecision: number; // 1–10
  fractionMode: boolean;
  quantity: number; // 2, 3, 4, or 5
}

export interface MCQOption {
  label: "A" | "B" | "C" | "D";
  text: string;
  isCorrect: boolean;
}

/** New enhanced variant type with solution slab */
export interface VariantQuestion {
  id: string;
  questionText: string;
  options: MCQOption[];
  correctAnswer: string;
  correctLabel: "A" | "B" | "C" | "D";
  chapter: string;
  subTopic: string;
  solution: {
    phase1: string; // Given Data / Ratios
    phase2: string; // Core Logic / Equation
    phase3: string; // Final Calculation
  };
}

/** Backwards-compatible alias */
export type GeneratedVariant = VariantQuestion;

export interface GenerationResult {
  variants: VariantQuestion[];
  originalChapter: string;
  originalSubTopic: string;
}

// ── Helpers ────────────────────────────────────────────────

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function roundToDecimals(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function fmt(val: number, settings: Settings, unit = ""): string {
  const u = unit ? ` ${unit}` : "";
  if (settings.fractionMode) {
    const precision = 1000;
    const num = Math.round(val * precision);
    const den = precision;
    const g = gcd(Math.abs(num), den);
    if (num % den === 0) return `${num / den}${u}`;
    return `${num / g}/${den / g}${u}`;
  }
  if (settings.integerOnly) return `${Math.round(val)}${u}`;
  return `${roundToDecimals(val, settings.decimalPrecision).toFixed(settings.decimalPrecision)}${u}`;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Unit Detection ─────────────────────────────────────────

function detectExpectedUnit(questionText: string): string {
  const lower = questionText.toLowerCase();
  if (
    /earn|wage|salary|pay|rupee|₹|cost|price|profit|loss|revenue|sp|cp/.test(
      lower,
    )
  )
    return "currency";
  if (/how long|time taken|days|hours|minutes|weeks/.test(lower)) {
    if (/hours|hour/.test(lower)) return "hours";
    if (/minutes|minute/.test(lower)) return "minutes";
    if (/weeks|week/.test(lower)) return "weeks";
    return "days";
  }
  if (/speed|km\/h|mph|kmph|velocity/.test(lower)) return "km/h";
  if (/distance|km|metres|miles/.test(lower)) return "km";
  if (/percent|%/.test(lower)) return "%";
  return "";
}

function unitFromString(str: string): string {
  const lower = str.toLowerCase();
  if (/₹|rs\.|rupee/.test(lower)) return "currency";
  if (/\bhours?\b/.test(lower)) return "hours";
  if (/\bminutes?\b/.test(lower)) return "minutes";
  if (/\bweeks?\b/.test(lower)) return "weeks";
  if (/\bdays?\b/.test(lower)) return "days";
  if (/km\/h|kmph|mph/.test(lower)) return "km/h";
  if (/\bkm\b|\bkms\b/.test(lower)) return "km";
  if (/%/.test(lower)) return "%";
  return "";
}

// ── 3-Filter Post-Processing ───────────────────────────────

function applyThreeFilters(
  options: MCQOption[],
  correctVal: number,
  settings: Settings,
  unit: string,
  chapter: string,
  questionText: string,
): MCQOption[] {
  const allowNegative = chapter === "Percentage" || chapter === "Profit & Loss";
  const expectedUnit = detectExpectedUnit(questionText);

  // Build mutable working copy
  let opts: MCQOption[] = options.map((o) => ({ ...o }));

  // ── Filter 1: Unit Consistency ──────────────────────────
  if (expectedUnit) {
    opts = opts.map((opt) => {
      if (opt.isCorrect) return opt; // Never replace the correct answer
      const optUnit = unitFromString(opt.text);
      const correctUnit = unitFromString(fmt(correctVal, settings, unit));
      // If option unit is set and differs from expected, replace
      if (optUnit && correctUnit && optUnit !== correctUnit) {
        // Try small offsets to find a valid replacement
        for (let off = 1; off <= 6; off++) {
          const newVal = Math.round(correctVal) + off;
          if (newVal > 0 || allowNegative) {
            return { ...opt, text: fmt(newVal, settings, unit) };
          }
        }
      }
      return opt;
    });
  }

  // ── Filter 2: Integer Integrity ─────────────────────────
  if (settings.integerOnly) {
    opts = opts.map((opt) => {
      if (opt.isCorrect) return opt;
      // If option text contains decimal point in numeric part
      const numericPart = opt.text.split(" ")[0];
      if (numericPart.includes(".")) {
        // Try offsets to find a clean integer
        for (const off of [1, 2, 3, -1, -2, -3, 4, 5, -4, -5]) {
          const newVal = Math.round(correctVal) + off;
          if (newVal > 0 || allowNegative) {
            const newStr = fmt(newVal, settings, unit);
            // Make sure it's not already used
            if (!opts.some((o) => o !== opt && o.text === newStr)) {
              return { ...opt, text: newStr };
            }
          }
        }
      }
      return opt;
    });
  }

  // ── Filter 3: Plausibility Check ────────────────────────
  const seenTexts = new Set<string>();
  let offsetCounter = 1;
  opts = opts.map((opt) => {
    if (opt.isCorrect) {
      seenTexts.add(opt.text);
      return opt;
    }

    const numericPart = Number.parseFloat(opt.text.split(" ")[0]);
    const isDuplicate = seenTexts.has(opt.text);
    const isZeroOrNeg =
      !Number.isNaN(numericPart) && numericPart <= 0 && !allowNegative;
    const isTooLarge =
      !Number.isNaN(numericPart) &&
      correctVal > 0 &&
      numericPart > correctVal * 5;
    const isTooSmall =
      !Number.isNaN(numericPart) &&
      correctVal > 0 &&
      numericPart < correctVal * 0.1;

    if (isDuplicate || isZeroOrNeg || isTooLarge || isTooSmall) {
      // Replace with a plausible value
      while (offsetCounter <= 20) {
        const newVal = Math.round(correctVal * 1.1 + offsetCounter);
        const newStr = fmt(newVal, settings, unit);
        if (!seenTexts.has(newStr) && (newVal > 0 || allowNegative)) {
          seenTexts.add(newStr);
          offsetCounter++;
          return { ...opt, text: newStr };
        }
        offsetCounter++;
      }
    }

    seenTexts.add(opt.text);
    return opt;
  });

  return opts;
}

// ── Build Options ──────────────────────────────────────────

function buildOptions(
  correctVal: number,
  distractors: number[],
  settings: Settings,
  unit = "",
  chapter = "",
  questionText = "",
): {
  options: MCQOption[];
  correctLabel: "A" | "B" | "C" | "D";
  correctAnswer: string;
} {
  const correctStr = fmt(correctVal, settings, unit);
  // Deduplicate distractors, ensure none equal correct
  const seen = new Set<string>([correctStr]);
  const distStrings: string[] = [];
  for (const d of distractors) {
    const s = fmt(d, settings, unit);
    if (!seen.has(s)) {
      seen.add(s);
      distStrings.push(s);
    }
    if (distStrings.length === 3) break;
  }
  // Pad if needed
  let padIdx = 1;
  while (distStrings.length < 3) {
    const padVal = fmt(
      Math.max(1, Math.round(correctVal) + padIdx),
      settings,
      unit,
    );
    if (!seen.has(padVal)) {
      seen.add(padVal);
      distStrings.push(padVal);
    }
    padIdx++;
  }

  const labels: ("A" | "B" | "C" | "D")[] = ["A", "B", "C", "D"];
  const allStrings = shuffleArray([correctStr, ...distStrings]);
  let options: MCQOption[] = allStrings.slice(0, 4).map((text, i) => ({
    label: labels[i],
    text,
    isCorrect: text === correctStr,
  }));

  // Apply 3-filter validation silently
  options = applyThreeFilters(
    options,
    correctVal,
    settings,
    unit,
    chapter,
    questionText,
  );

  // Re-identify correct label after filtering (correct answer text may have shifted for distractors)
  const correctLabel = options.find((o) => o.isCorrect)?.label ?? "A";
  return { options, correctLabel, correctAnswer: correctStr };
}

// ── Auto-Classification ────────────────────────────────────

const CHAPTER_MAP = [
  {
    chapter: "Profit & Loss",
    keywords: [
      "profit",
      "loss",
      "cost price",
      "selling price",
      "cp",
      "sp",
      "markup",
      "discount",
      "gain",
      "bought",
      "sold",
      "buy",
      "sell",
    ],
    subTopics: [
      {
        topic: "Successive Discount",
        keywords: ["successive", "two discount", "double discount"],
      },
      {
        topic: "Marked Price",
        keywords: ["marked", "mark", "mp", "list price"],
      },
      {
        topic: "Equated SP",
        keywords: ["equated", "equal sp", "same profit", "same loss"],
      },
      {
        topic: "Profit Percentage",
        keywords: ["profit percent", "gain percent", "percentage profit"],
      },
      { topic: "Basic Profit/Loss", keywords: [] },
    ],
  },
  {
    chapter: "Time & Distance",
    keywords: [
      "speed",
      "distance",
      "km/h",
      "mph",
      "travels",
      "train",
      "car",
      "bus",
      "kmph",
      "faster",
      "slower",
      "velocity",
    ],
    subTopics: [
      {
        topic: "Relative Speed",
        keywords: [
          "relative",
          "towards",
          "opposite",
          "same direction",
          "meeting",
        ],
      },
      { topic: "Average Speed", keywords: ["average speed", "total distance"] },
      { topic: "Basic Speed-Time", keywords: [] },
    ],
  },
  {
    chapter: "Simple Interest",
    keywords: ["simple interest", "per annum", "annually", "principal"],
    subTopics: [
      {
        topic: "Find SI",
        keywords: ["find interest", "calculate interest", "how much interest"],
      },
      { topic: "Find Principal", keywords: ["find the sum", "find principal"] },
      { topic: "Find Rate", keywords: ["rate", "percent per"] },
      { topic: "Basic SI", keywords: [] },
    ],
  },
  {
    chapter: "Compound Interest",
    keywords: ["compound interest", "compounded", "compound"],
    subTopics: [
      {
        topic: "Half-Yearly CI",
        keywords: ["half yearly", "semi", "half-yearly"],
      },
      { topic: "Annual CI", keywords: ["annual", "yearly"] },
      { topic: "Basic CI", keywords: [] },
    ],
  },
  {
    chapter: "Percentage",
    keywords: ["percent", "percentage", "%", "what percent"],
    subTopics: [
      {
        topic: "Percentage Increase",
        keywords: ["increase", "rise", "grew", "increased by"],
      },
      {
        topic: "Percentage Decrease",
        keywords: ["decrease", "fall", "dropped", "decreased by"],
      },
      { topic: "Basic Percentage", keywords: [] },
    ],
  },
  {
    chapter: "Ratio & Proportion",
    keywords: ["ratio", "proportion", "share", "divided in", "parts"],
    subTopics: [
      {
        topic: "Sharing in Ratio",
        keywords: ["share", "divide", "split", "divided"],
      },
      { topic: "Basic Ratio", keywords: [] },
    ],
  },
  {
    chapter: "Work & Time",
    keywords: [
      "work",
      "complete",
      "together",
      "alone",
      "pipe",
      "tank",
      "fill",
      "empty",
    ],
    subTopics: [
      {
        topic: "Pipes & Cisterns",
        keywords: ["pipe", "tank", "fill", "empty", "cistern"],
      },
      { topic: "Combined Work", keywords: ["together", "combined", "jointly"] },
      { topic: "Basic Work", keywords: [] },
    ],
  },
  {
    chapter: "Wages & Work",
    keywords: [
      "wage",
      "wages",
      "earn",
      "salary",
      "paid",
      "per day",
      "daily",
      "worker",
      "labour",
      "laborer",
    ],
    subTopics: [
      { topic: "Daily Wage", keywords: ["per day", "daily", "day's work"] },
      { topic: "Combined Wages", keywords: ["together", "combined"] },
      { topic: "Basic Wages", keywords: [] },
    ],
  },
  {
    chapter: "Averages",
    keywords: ["average", "mean", "sum of", "numbers are"],
    subTopics: [{ topic: "Basic Average", keywords: [] }],
  },
  {
    chapter: "Algebra",
    keywords: [
      "find x",
      "find y",
      "value of x",
      "value of y",
      "equation",
      "solve for",
    ],
    subTopics: [{ topic: "Linear Equation", keywords: [] }],
  },
  {
    chapter: "Geometry",
    keywords: [
      "area",
      "perimeter",
      "circle",
      "rectangle",
      "triangle",
      "square",
      "radius",
      "diameter",
      "volume",
    ],
    subTopics: [
      {
        topic: "Circle",
        keywords: ["circle", "radius", "diameter", "circumference"],
      },
      {
        topic: "Triangle",
        keywords: ["triangle", "base", "height", "hypotenuse"],
      },
      {
        topic: "Rectangle",
        keywords: ["rectangle", "length", "breadth", "width"],
      },
      { topic: "Basic Geometry", keywords: [] },
    ],
  },
];

export function classify(text: string): { chapter: string; subTopic: string } {
  const lower = text.toLowerCase();
  for (const entry of CHAPTER_MAP) {
    if (entry.keywords.some((k) => lower.includes(k))) {
      for (const st of entry.subTopics) {
        if (
          st.keywords.length > 0 &&
          st.keywords.some((k) => lower.includes(k))
        ) {
          return { chapter: entry.chapter, subTopic: st.topic };
        }
      }
      return {
        chapter: entry.chapter,
        subTopic: entry.subTopics[entry.subTopics.length - 1].topic,
      };
    }
  }
  return { chapter: "General Math", subTopic: "Miscellaneous" };
}

/** Backwards-compatible alias used by GenerateScreen */
export function detectChapterType(questionText: string): string {
  return classify(questionText).chapter;
}

// ── Number extraction ──────────────────────────────────────

interface NumberToken {
  value: number;
  start: number;
  end: number;
}

function extractTokens(text: string): NumberToken[] {
  const regex = /\b\d+(?:\.\d+)?\b/g;
  const tokens: NumberToken[] = [];
  let match = regex.exec(text);
  while (match !== null) {
    tokens.push({
      value: Number.parseFloat(match[0]),
      start: match.index,
      end: match.index + match[0].length,
    });
    match = regex.exec(text);
  }
  return tokens;
}

function replaceTokens(
  text: string,
  tokens: NumberToken[],
  newValues: number[],
): string {
  const sorted = [...tokens]
    .map((t, i) => ({ ...t, newVal: newValues[i] ?? t.value }))
    .sort((a, b) => b.start - a.start);
  let result = text;
  for (const token of sorted) {
    result =
      result.slice(0, token.start) +
      String(token.newVal) +
      result.slice(token.end);
  }
  return result;
}

// ── Scale factors for variants ─────────────────────────────
const SCALE_FACTORS = [1.5, 2, 2.5, 3, 0.5, 0.75, 1.25, 4, 0.25, 1.75];

function scaleNice(n: number, factor: number): number {
  const scaled = n * factor;
  // Try to keep it a nice integer
  const rounded = Math.round(scaled);
  return rounded > 0 ? rounded : Math.max(1, Math.round(n));
}

// ── Chapter-specific solvers ───────────────────────────────

interface SolveResult {
  correct: number;
  distractors: number[];
  solution: { phase1: string; phase2: string; phase3: string };
  unit: string;
}

function solveTimeDistance(nums: number[], _text: string): SolveResult {
  const speed = nums[0] ?? 60;
  const distance = nums[1] ?? 120;
  const time = distance / speed;
  return {
    correct: time,
    distractors: [
      distance * speed, // Partial: multiply instead of divide
      speed / distance, // Swap: S/D instead of D/S
      Math.round(time * 2) / 2, // Rounded to nearest 0.5
    ],
    unit: "hours",
    solution: {
      phase1: `Speed = ${speed} km/h, Distance = ${distance} km`,
      phase2: "Time = Distance ÷ Speed",
      phase3: `Time = ${distance} ÷ ${speed} = ${roundToDecimals(time, 2)} hours`,
    },
  };
}

function solveProfitLoss(nums: number[], text: string): SolveResult {
  const lower = text.toLowerCase();
  const cp = nums[0] ?? 100;
  const pct = nums[1] ?? 20;

  if (lower.includes("loss")) {
    const sp = cp * (1 - pct / 100);
    const loss = cp - sp;
    const correct =
      lower.includes("sp") || lower.includes("selling") ? sp : loss;
    return {
      correct,
      distractors: [
        (cp * pct) / 100, // Partial: only the loss amount
        cp * (1 + pct / 100), // Swap: used profit formula instead
        Math.round(correct / 10) * 10, // Rounded anchor
      ],
      unit: "",
      solution: {
        phase1: `CP = ₹${cp}, Loss% = ${pct}%`,
        phase2: "SP = CP × (1 − Loss%/100)",
        phase3: `SP = ${cp} × ${(1 - pct / 100).toFixed(2)} = ₹${roundToDecimals(sp, 2)}, Loss = ₹${roundToDecimals(loss, 2)}`,
      },
    };
  }

  const sp = cp * (1 + pct / 100);
  const profit = sp - cp;
  const correct =
    lower.includes("sp") || lower.includes("selling") ? sp : profit;
  return {
    correct,
    distractors: [
      (cp * pct) / 100, // Partial: forgot to add CP
      cp / (1 + pct / 100), // Swap: divided instead of multiply
      Math.round(correct / 10) * 10, // Rounded anchor
    ],
    unit: "",
    solution: {
      phase1: `CP = ₹${cp}, Profit% = ${pct}%`,
      phase2: "SP = CP × (1 + Profit%/100)",
      phase3: `SP = ${cp} × ${(1 + pct / 100).toFixed(2)} = ₹${roundToDecimals(sp, 2)}, Profit = ₹${roundToDecimals(profit, 2)}`,
    },
  };
}

function solveSimpleInterest(nums: number[], text: string): SolveResult {
  const lower = text.toLowerCase();
  const P = nums[0] ?? 1000;
  const R = nums[1] ?? 5;
  const T = nums[2] ?? 2;
  const SI = (P * R * T) / 100;
  const total = P + SI;
  const correct =
    lower.includes("total") || lower.includes("amount") ? total : SI;
  return {
    correct,
    distractors: [
      (P * R) / 100, // Partial: forgot T
      (P * T) / 100, // Swap: used T where R should be
      Math.round(correct / 5) * 5, // Rounded anchor
    ],
    unit: "",
    solution: {
      phase1: `Principal = ₹${P}, Rate = ${R}% p.a., Time = ${T} years`,
      phase2: "SI = (P × R × T) / 100",
      phase3: `SI = (${P} × ${R} × ${T}) / 100 = ₹${roundToDecimals(SI, 2)}${lower.includes("amount") ? `, Total = ₹${roundToDecimals(total, 2)}` : ""}`,
    },
  };
}

function solveCompoundInterest(nums: number[], text: string): SolveResult {
  const lower = text.toLowerCase();
  const P = nums[0] ?? 1000;
  const R = nums[1] ?? 10;
  const T = nums[2] ?? 2;
  const amount = P * (1 + R / 100) ** T;
  const CI = amount - P;
  const correct = lower.includes("amount") ? amount : CI;
  return {
    correct,
    distractors: [
      (P * R * T) / 100, // Partial: used SI formula
      amount + P, // Swap: added principal twice
      Math.round(correct / 10) * 10, // Rounded anchor
    ],
    unit: "",
    solution: {
      phase1: `Principal = ₹${P}, Rate = ${R}% p.a., Time = ${T} years`,
      phase2: "Amount = P × (1 + R/100)^T",
      phase3: `= ${P} × (${(1 + R / 100).toFixed(2)})^${T} = ₹${roundToDecimals(amount, 2)}, CI = ₹${roundToDecimals(CI, 2)}`,
    },
  };
}

function solveWorkTime(nums: number[], _text: string): SolveResult {
  const a = nums[0] ?? 6;
  const b = nums[1] ?? 12;
  const together = (a * b) / (a + b);
  return {
    correct: together,
    distractors: [
      a + b, // Partial: added instead of harmonic mean
      (a + b) / (a * b), // Swap: inverted formula
      Math.round(together), // Rounded anchor
    ],
    unit: "days",
    solution: {
      phase1: `A completes work in ${a} days, B completes in ${b} days`,
      phase2: "Together = (A × B) / (A + B)",
      phase3: `= (${a} × ${b}) / (${a} + ${b}) = ${a * b}/${a + b} = ${roundToDecimals(together, 2)} days`,
    },
  };
}

function solveWages(nums: number[], text: string): SolveResult {
  const lower = text.toLowerCase();
  const days = nums[0] ?? 10;
  const ratePerDay = nums[1] ?? 50;
  const totalWage = days * ratePerDay;
  const isPerDay = lower.includes("per day") || lower.includes("daily");
  const correct = isPerDay ? totalWage : ratePerDay;
  return {
    correct,
    distractors: [
      days + ratePerDay, // Partial: added instead of multiply
      ratePerDay * 2, // Swap: wrong multiplier
      Math.round(correct * 1.25), // Rounded anchor
    ],
    unit: "",
    solution: {
      phase1: `Days worked = ${days}, Rate per day = ₹${ratePerDay}`,
      phase2: "Total Wages = Days × Rate per day",
      phase3: `= ${days} × ₹${ratePerDay} = ₹${totalWage}`,
    },
  };
}

function solvePercentage(nums: number[], text: string): SolveResult {
  const lower = text.toLowerCase();
  const V = nums[0] ?? 200;
  const P = nums[1] ?? 25;
  const result = (V * P) / 100;
  const isIncrease =
    lower.includes("increase") ||
    lower.includes("rise") ||
    lower.includes("grew");
  const isDecrease =
    lower.includes("decrease") ||
    lower.includes("fall") ||
    lower.includes("dropped");
  const correct = isIncrease ? V + result : isDecrease ? V - result : result;
  return {
    correct,
    distractors: [
      V + P, // Partial: direct addition
      (V / P) * 100, // Swap: reversed formula
      Math.round(correct / 10) * 10, // Rounded anchor
    ],
    unit: "",
    solution: {
      phase1: `Value = ${V}, Percentage = ${P}%`,
      phase2: `${P}% of ${V} = ${V} × ${P}/100`,
      phase3: `= ${roundToDecimals(result, 2)}${isIncrease ? `, New Value = ${roundToDecimals(V + result, 2)}` : isDecrease ? `, New Value = ${roundToDecimals(V - result, 2)}` : ""}`,
    },
  };
}

function solveGeneric(nums: number[], _text: string): SolveResult {
  const a = nums[0] ?? 10;
  const b = nums[1] ?? 5;
  const correct = a + b;
  return {
    correct,
    distractors: [Math.abs(a - b), a * b, Math.round(correct * 1.5)],
    unit: "",
    solution: {
      phase1: `Given values: ${nums.slice(0, 3).join(", ")}`,
      phase2: "Apply the relevant formula from the question",
      phase3: `Result = ${correct}`,
    },
  };
}

function solveQuestion(
  chapter: string,
  nums: number[],
  text: string,
): SolveResult {
  switch (chapter) {
    case "Time & Distance":
      return solveTimeDistance(nums, text);
    case "Profit & Loss":
      return solveProfitLoss(nums, text);
    case "Simple Interest":
      return solveSimpleInterest(nums, text);
    case "Compound Interest":
      return solveCompoundInterest(nums, text);
    case "Work & Time":
      return solveWorkTime(nums, text);
    case "Wages & Work":
      return solveWages(nums, text);
    case "Percentage":
      return solvePercentage(nums, text);
    default:
      return solveGeneric(nums, text);
  }
}

// ── Main entry point ───────────────────────────────────────

export function generateVariants(
  originalQuestion: string,
  settings: Settings,
): VariantQuestion[] {
  const tokens = extractTokens(originalQuestion);

  if (tokens.length < 1) {
    throw new Error("Please enter a valid numeric question");
  }

  const { chapter, subTopic } = classify(originalQuestion);
  const existing = new Set<string>([originalQuestion]);
  const variants: VariantQuestion[] = [];

  for (let i = 0; i < settings.quantity; i++) {
    const scaleFactor = SCALE_FACTORS[i % SCALE_FACTORS.length];
    const newNums = tokens.map((t) => scaleNice(t.value, scaleFactor));
    let variantText = replaceTokens(originalQuestion, tokens, newNums);

    // Avoid exact duplicates
    if (existing.has(variantText)) {
      const altFactor = SCALE_FACTORS[(i + 3) % SCALE_FACTORS.length];
      const altNums = tokens.map((t) => scaleNice(t.value, altFactor));
      variantText = replaceTokens(originalQuestion, tokens, altNums);
    }
    existing.add(variantText);

    // Solve using the scaled numbers
    const solved = solveQuestion(chapter, newNums, originalQuestion);
    const { options, correctLabel, correctAnswer } = buildOptions(
      solved.correct,
      solved.distractors,
      settings,
      solved.unit,
      chapter,
      originalQuestion,
    );

    variants.push({
      id: `variant-${Date.now()}-${i}`,
      questionText: variantText,
      options,
      correctAnswer,
      correctLabel,
      chapter,
      subTopic,
      solution: solved.solution,
    });
  }

  if (variants.length === 0) {
    throw new Error("Unable to generate variants for this question type");
  }

  return variants;
}

// ── Export formatting ──────────────────────────────────────

export function formatExport(
  originalQuestion: string,
  variants: VariantQuestion[],
  settings: Settings,
): string {
  const settingsParts: string[] = [];
  if (settings.integerOnly) settingsParts.push("Integer Mode");
  else if (settings.fractionMode) settingsParts.push("Fraction Mode");
  else settingsParts.push(`${settings.decimalPrecision} Decimal(s)`);
  settingsParts.push(`Quantity: ${settings.quantity}`);

  const lines: string[] = [
    "VARIANT - Generated Questions",
    "==============================",
    "Original Question:",
    originalQuestion,
    "",
    `Settings: ${settingsParts.join(" | ")}`,
    "==============================",
    "",
  ];

  for (const [idx, v] of variants.entries()) {
    lines.push(`Variant #${idx + 1}: [${v.chapter} — ${v.subTopic}]`);
    lines.push(`Question: ${v.questionText}`);
    for (const o of v.options) {
      lines.push(`${o.label}) ${o.text}${o.isCorrect ? " ✓" : ""}`);
    }
    lines.push(`Correct Answer: ${v.correctLabel}) ${v.correctAnswer}`);
    lines.push("");
  }

  return lines.join("\n");
}
