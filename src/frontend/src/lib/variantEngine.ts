// ============================================================
// VARIANT ENGINE v5 — Formula-first deterministic math engine
// Mode-aware: integer / fraction / decimal
// All answers guaranteed mode-valid by construction
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

export interface VariantQuestion {
  id: string;
  questionText: string;
  options: MCQOption[];
  correctAnswer: string;
  correctLabel: "A" | "B" | "C" | "D";
  chapter: string;
  subTopic: string;
  solution: {
    phase1: string;
    phase2: string;
    phase3: string;
  };
}

export type GeneratedVariant = VariantQuestion;

export interface GenerationResult {
  variants: VariantQuestion[];
  originalChapter: string;
  originalSubTopic: string;
}

// ── Mode Constraint ────────────────────────────────────────

export interface ModeConstraint {
  mode: "integer" | "fraction" | "decimal";
  decimalPrecision: number; // 1-10, only used when mode === 'decimal'
}

function getConstraint(settings: Settings): ModeConstraint {
  if (settings.integerOnly) return { mode: "integer", decimalPrecision: 0 };
  if (settings.fractionMode) return { mode: "fraction", decimalPrecision: 2 };
  return { mode: "decimal", decimalPrecision: settings.decimalPrecision ?? 2 };
}

function isValidForMode(value: number, c: ModeConstraint): boolean {
  if (!Number.isFinite(value) || Number.isNaN(value) || value <= 0)
    return false;
  if (c.mode === "integer") return Number.isInteger(value);
  if (c.mode === "fraction") return Number.isFinite(value) && value > 0;
  // decimal: value must round cleanly to decimalPrecision
  const prec = c.decimalPrecision;
  const str = value.toFixed(prec);
  return Number.parseFloat(str) === Number.parseFloat(value.toFixed(prec));
}

function snapToMode(value: number, c: ModeConstraint): number {
  if (c.mode === "integer") return Math.max(1, Math.round(value));
  if (c.mode === "decimal") {
    const v = Number.parseFloat(value.toFixed(c.decimalPrecision));
    return v > 0
      ? v
      : Number.parseFloat((value + 0.1).toFixed(c.decimalPrecision));
  }
  return value; // fraction: keep raw
}

// ── Math helpers ───────────────────────────────────────────

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

function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b;
}

function roundToDecimals(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

// ── Fraction formatter ─────────────────────────────────────

function toFractionString(val: number, unit: string): string {
  if (Number.isInteger(val) || Math.abs(val - Math.round(val)) < 1e-9) {
    const int = Math.round(val);
    return unit ? `${int} ${unit}` : `${int}`;
  }
  // Find best rational approximation with denominator up to 100
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
  const u = unit ? ` ${unit}` : "";
  if (d === 1) return `${n}${u}`;
  return `${n}/${d}${u}`;
}

// ── Formatter ──────────────────────────────────────────────

function fmt(val: number, settings: Settings, unit = ""): string {
  const u = unit ? ` ${unit}` : "";
  if (settings.fractionMode) return toFractionString(val, unit);
  if (settings.integerOnly) return `${Math.round(val)}${u}`;
  return `${roundToDecimals(val, settings.decimalPrecision).toFixed(settings.decimalPrecision)}${u}`;
}

function fmtRaw(val: number, c: ModeConstraint): string {
  if (c.mode === "integer") return String(Math.round(val));
  if (c.mode === "fraction") return toFractionString(val, "");
  return val.toFixed(c.decimalPrecision);
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Number sanitization ────────────────────────────────────

function sanitizeNumber(n: number): number {
  const rounded = Math.round(n);
  if (rounded === 0) return 1;
  const diff = Math.abs(n - rounded) / Math.max(1, Math.abs(rounded));
  return diff < 0.02 ? rounded : n;
}

function formatNumberForText(n: number): string {
  const clean = sanitizeNumber(n);
  if (Number.isInteger(clean)) return String(Math.round(clean));
  return Number.parseFloat(clean.toFixed(2)).toString();
}

// ── Unit detection ─────────────────────────────────────────

function detectExpectedUnit(questionText: string): string {
  const lower = questionText.toLowerCase();
  if (
    /earn|wage|wages|salary|pay|rupee|₹|cost|price|profit|loss|revenue|sp|cp|receive|gets|payment|distributed|share|how much does|how much will|total payment/.test(
      lower,
    )
  )
    return "currency";
  if (/how long|time taken|days|hours|minutes|weeks/.test(lower)) {
    if (/hours?\b/.test(lower)) return "hours";
    if (/minutes?\b/.test(lower)) return "minutes";
    if (/weeks?\b/.test(lower)) return "weeks";
    return "days";
  }
  if (/speed|km\/h|mph|kmph|velocity/.test(lower)) return "km/h";
  if (/distance|km|metres|miles/.test(lower)) return "km";
  if (/percent|%/.test(lower)) return "%";
  return "";
}

// ── Mode-aware distractor builder ──────────────────────────

function buildModeAwareDistractors(
  correct: number,
  rawDistractors: number[],
  constraint: ModeConstraint,
): number[] {
  const seen = new Set<string>([fmtRaw(correct, constraint)]);
  const result: number[] = [];

  // Try raw distractors first, snapping to mode
  for (const d of rawDistractors) {
    if (!Number.isFinite(d) || d <= 0) continue;
    const snapped = snapToMode(d, constraint);
    const key = fmtRaw(snapped, constraint);
    if (snapped > 0 && !seen.has(key)) {
      seen.add(key);
      result.push(snapped);
      if (result.length === 3) return result;
    }
  }

  // Fill remaining with scaled multiples of correct
  const multipliers = [
    1.25, 0.75, 1.5, 0.5, 2.0, 1.1, 0.9, 1.33, 0.67, 3.0, 0.4, 1.6, 1.8, 0.6,
  ];
  for (const m of multipliers) {
    const d = snapToMode(correct * m, constraint);
    const key = fmtRaw(d, constraint);
    if (d > 0 && !seen.has(key)) {
      seen.add(key);
      result.push(d);
      if (result.length === 3) return result;
    }
  }

  // Fallback: integer offsets
  for (let off = 1; off <= 30 && result.length < 3; off++) {
    const d = snapToMode(correct + off, constraint);
    const key = fmtRaw(d, constraint);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(d);
    }
  }

  return result.slice(0, 3);
}

// ── Build Options ──────────────────────────────────────────

function buildOptions(
  correctVal: number,
  distractors: number[],
  settings: Settings,
  unit = "",
  questionText = "",
): {
  options: MCQOption[];
  correctLabel: "A" | "B" | "C" | "D";
  correctAnswer: string;
} {
  const constraint = getConstraint(settings);
  // Snap correct value to mode
  const snappedCorrect = snapToMode(correctVal, constraint);
  const correctStr = fmt(snappedCorrect, settings, unit);

  // Build mode-aware distractors
  const modeDistractors = buildModeAwareDistractors(
    snappedCorrect,
    distractors,
    constraint,
  );

  const seen = new Set<string>([correctStr]);
  const distStrings: string[] = [];
  for (const d of modeDistractors) {
    const s = fmt(d, settings, unit);
    if (!seen.has(s)) {
      seen.add(s);
      distStrings.push(s);
    }
    if (distStrings.length === 3) break;
  }

  // Pad if still short
  let padIdx = 1;
  while (distStrings.length < 3) {
    const padVal = snapToMode(snappedCorrect + padIdx, constraint);
    const padStr = fmt(padVal, settings, unit);
    if (!seen.has(padStr)) {
      seen.add(padStr);
      distStrings.push(padStr);
    }
    padIdx++;
    if (padIdx > 50) break;
  }

  const labels: ("A" | "B" | "C" | "D")[] = ["A", "B", "C", "D"];
  const allStrings = shuffleArray([correctStr, ...distStrings.slice(0, 3)]);
  const options: MCQOption[] = allStrings.slice(0, 4).map((text, i) => ({
    label: labels[i],
    text,
    isCorrect: text === correctStr,
  }));

  // Unit safety: if expected unit is currency, strip any time unit from distractors
  const expectedUnit = detectExpectedUnit(questionText);
  if (expectedUnit === "currency") {
    for (const opt of options) {
      if (opt.isCorrect) continue;
      if (/\b(days?|hours?|minutes?|weeks?)\b/i.test(opt.text)) {
        // Replace with a clean numeric fallback
        const fallback = snapToMode(snappedCorrect * 1.15 + padIdx, constraint);
        opt.text = fmt(fallback, settings, unit);
        padIdx++;
      }
    }
  }

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

  // Work+Wages combo — detect BEFORE main loop
  const hasWorkKeywords =
    /\b(work|complete|together|alone|sort|sorting|pack|packages|task)\b/.test(
      lower,
    );
  const hasPaymentKeywords =
    /\b(wage|wages|earn|salary|paid|payment|receive|gets|how much does|total payment|distributed)\b/.test(
      lower,
    );
  if (hasWorkKeywords && hasPaymentKeywords) {
    return { chapter: "Work & Wages", subTopic: "Proportional Wages" };
  }

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
  // Normalize thousands-separator commas (3,600 -> 3600)
  const normalized = text.replace(/(\d),(\d{3})\b/g, "$1$2");
  const regex = /\b\d+(?:\.\d+)?\b/g;
  const tokens: NumberToken[] = [];
  let match = regex.exec(normalized);
  while (match !== null) {
    tokens.push({
      value: Number.parseFloat(match[0]),
      start: match.index,
      end: match.index + match[0].length,
    });
    match = regex.exec(normalized);
  }
  return tokens;
}

function replaceTokens(
  text: string,
  tokens: NumberToken[],
  newValues: number[],
): string {
  const normalized = text.replace(/(\d),(\d{3})\b/g, "$1$2");
  const sorted = [...tokens]
    .map((t, i) => ({ ...t, newVal: newValues[i] ?? t.value }))
    .sort((a, b) => b.start - a.start);
  let result = normalized;
  for (const token of sorted) {
    result =
      result.slice(0, token.start) +
      formatNumberForText(token.newVal) +
      result.slice(token.end);
  }
  return result;
}

function validateQuestionText(text: string): boolean {
  return !/\d,\d/.test(text);
}

// ── Scale helpers ──────────────────────────────────────────

function scaleNice(n: number, factor: number): number {
  const scaled = n * factor;
  const rounded = Math.round(scaled);
  const result = rounded > 0 ? rounded : Math.max(1, Math.round(n));
  return sanitizeNumber(result);
}

// ── Solvers ────────────────────────────────────────────────
// Each solver accepts constraint and returns a correct value that
// satisfies isValidForMode(correct, constraint) by construction.

interface SolveResult {
  correct: number;
  distractors: number[];
  solution: { phase1: string; phase2: string; phase3: string };
  unit: string;
}

// ── Time & Distance ────────────────────────────────────────
// Formula: time = distance / speed
// Integer mode: pick time first, then set distance = speed * time

function solveTimeDistance(
  nums: number[],
  text: string,
  c: ModeConstraint,
): SolveResult {
  const lower = text.toLowerCase();
  const askingSpeed = /speed/.test(lower) && !/time|how long/.test(lower);
  const askingDistance =
    /distance|how far/.test(lower) && !/time|how long/.test(lower);

  let speed = nums[0] ?? 60;
  let distance = nums[1] ?? 120;

  if (c.mode === "integer") {
    // Reverse-engineer: pick speed and time as integers, compute distance
    speed = Math.max(10, Math.round(speed / 10) * 10); // nice round speed
    const time = Math.max(1, Math.round(distance / speed)); // derive integer time
    distance = speed * time; // guaranteed integer

    if (askingSpeed) {
      const d2 = distance;
      const t2 = Math.max(1, Math.round(d2 / speed));
      const correctSpeed = Math.round(d2 / t2);
      return {
        correct: correctSpeed,
        distractors: [
          correctSpeed * 2,
          Math.round(correctSpeed * 1.5),
          correctSpeed + 10,
        ],
        unit: "km/h",
        solution: {
          phase1: `Distance = ${d2} km, Time = ${t2} hours`,
          phase2: "Speed = Distance ÷ Time",
          phase3: `Speed = ${d2} ÷ ${t2} = ${correctSpeed} km/h`,
        },
      };
    }
    if (askingDistance) {
      const d3 = speed * time;
      return {
        correct: d3,
        distractors: [
          d3 + speed,
          d3 - speed > 0 ? d3 - speed : d3 + speed * 2,
          d3 * 2,
        ],
        unit: "km",
        solution: {
          phase1: `Speed = ${speed} km/h, Time = ${time} hours`,
          phase2: "Distance = Speed × Time",
          phase3: `Distance = ${speed} × ${time} = ${d3} km`,
        },
      };
    }
    return {
      correct: time,
      distractors: [
        Math.round(distance * speed), // wrong: multiply
        Math.max(1, time + 1),
        Math.max(1, time + 2),
      ],
      unit: "hours",
      solution: {
        phase1: `Speed = ${speed} km/h, Distance = ${distance} km`,
        phase2: "Time = Distance ÷ Speed",
        phase3: `Time = ${distance} ÷ ${speed} = ${time} hours`,
      },
    };
  }

  // fraction / decimal mode
  const time = distance / speed;
  const snappedTime = snapToMode(time, c);
  return {
    correct: snappedTime,
    distractors: [
      snapToMode(distance * speed, c),
      snapToMode(speed / distance, c),
      snapToMode(time * 2, c),
    ],
    unit: "hours",
    solution: {
      phase1: `Speed = ${speed} km/h, Distance = ${distance} km`,
      phase2: "Time = Distance ÷ Speed",
      phase3: `Time = ${distance} ÷ ${speed} = ${fmtRaw(snappedTime, c)} hours`,
    },
  };
}

// ── Profit & Loss ──────────────────────────────────────────
// Integer mode: pick CP as multiple of 100, pct as multiple of 5
// so SP = CP*(1+pct/100) is always integer.

function solveProfitLoss(
  nums: number[],
  text: string,
  c: ModeConstraint,
): SolveResult {
  const lower = text.toLowerCase();
  let cp = nums[0] ?? 100;
  let pct = nums[1] ?? 20;

  if (c.mode === "integer") {
    // Snap CP to nearest multiple of 20 and pct to multiple of 5
    cp = Math.max(20, Math.round(cp / 20) * 20);
    pct = Math.max(5, Math.round(pct / 5) * 5);
  }

  const isLoss = lower.includes("loss");
  if (isLoss) {
    const sp = cp * (1 - pct / 100);
    const loss = cp - sp;
    const askSP = lower.includes("sp") || lower.includes("selling");
    const correct = snapToMode(askSP ? sp : loss, c);
    return {
      correct,
      distractors: [
        snapToMode((cp * pct) / 100, c),
        snapToMode(cp * (1 + pct / 100), c),
        snapToMode(correct + (c.mode === "integer" ? 10 : 5), c),
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
  const askSP = lower.includes("sp") || lower.includes("selling");
  const correct = snapToMode(askSP ? sp : profit, c);
  return {
    correct,
    distractors: [
      snapToMode((cp * pct) / 100, c),
      snapToMode(cp / (1 + pct / 100), c),
      snapToMode(correct + (c.mode === "integer" ? 10 : 5), c),
    ],
    unit: "",
    solution: {
      phase1: `CP = ₹${cp}, Profit% = ${pct}%`,
      phase2: "SP = CP × (1 + Profit%/100)",
      phase3: `SP = ${cp} × ${(1 + pct / 100).toFixed(2)} = ₹${roundToDecimals(sp, 2)}, Profit = ₹${roundToDecimals(profit, 2)}`,
    },
  };
}

// ── Simple Interest ────────────────────────────────────────
// Integer mode: pick R (5 or 10), T (2..4), then set P = SI_target*100/(R*T)
// where SI_target is a clean round number.

function solveSimpleInterest(
  nums: number[],
  text: string,
  c: ModeConstraint,
): SolveResult {
  const lower = text.toLowerCase();
  let P = nums[0] ?? 1000;
  let R = nums[1] ?? 5;
  let T = nums[2] ?? 2;

  if (c.mode === "integer") {
    // Snap R to nearest 5, T to integer
    R = Math.max(5, Math.round(R / 5) * 5);
    T = Math.max(1, Math.round(T));
    // Snap P so that SI = P*R*T/100 is integer
    // P must be divisible by (100/gcd(R*T,100))
    const rt = R * T;
    const g = gcd(rt, 100);
    const factor = 100 / g; // P must be multiple of this
    P = Math.max(factor, Math.round(P / factor) * factor);
  }

  const SI = (P * R * T) / 100;
  const total = P + SI;
  const askTotal = lower.includes("total") || lower.includes("amount");
  const correct = snapToMode(askTotal ? total : SI, c);

  return {
    correct,
    distractors: [
      snapToMode((P * R) / 100, c), // forgot T
      snapToMode((P * T) / 100, c), // used T where R should be
      snapToMode(correct * 1.25, c), // rounded anchor
    ],
    unit: "",
    solution: {
      phase1: `Principal = ₹${P}, Rate = ${R}% p.a., Time = ${T} years`,
      phase2: "SI = (P × R × T) / 100",
      phase3: `SI = (${P} × ${R} × ${T}) / 100 = ₹${roundToDecimals(SI, 2)}${askTotal ? `, Total = ₹${roundToDecimals(total, 2)}` : ""}`,
    },
  };
}

// ── Compound Interest ──────────────────────────────────────

function solveCompoundInterest(
  nums: number[],
  text: string,
  c: ModeConstraint,
): SolveResult {
  const lower = text.toLowerCase();
  let P = nums[0] ?? 1000;
  let R = nums[1] ?? 10;
  let T = nums[2] ?? 2;

  if (c.mode === "integer") {
    R = Math.max(5, Math.round(R / 5) * 5);
    T = Math.max(1, Math.round(T));
    P = Math.max(100, Math.round(P / 100) * 100);
  }

  const amount = P * (1 + R / 100) ** T;
  const CI = amount - P;
  const askAmount = lower.includes("amount");
  const correct = snapToMode(askAmount ? amount : CI, c);

  return {
    correct,
    distractors: [
      snapToMode((P * R * T) / 100, c), // used SI formula
      snapToMode(amount + P, c), // added principal twice
      snapToMode(correct * 1.1, c),
    ],
    unit: "",
    solution: {
      phase1: `Principal = ₹${P}, Rate = ${R}% p.a., Time = ${T} years`,
      phase2: "Amount = P × (1 + R/100)^T",
      phase3: `= ${P} × (${(1 + R / 100).toFixed(2)})^${T} = ₹${roundToDecimals(amount, 2)}, CI = ₹${roundToDecimals(CI, 2)}`,
    },
  };
}

// ── Work & Time ────────────────────────────────────────────
// Formula: together = (a*b)/(a+b)
// Integer mode: pick together first (clean integer), then derive a & b

function solveWorkTime(
  nums: number[],
  _text: string,
  c: ModeConstraint,
): SolveResult {
  let a = nums[0] ?? 6;
  let b = nums[1] ?? 12;

  if (c.mode === "integer") {
    // To guarantee together = (a*b)/(a+b) is integer:
    // Use a = k*m, b = k*n where gcd(m,n)=1, together = k*m*n/(m+n)
    // Simplest: pick together directly, then set a=2t, b=2t
    // Or use known integer triples: (a,b,together)
    const intPairs: [number, number][] = [
      [6, 12],
      [4, 12],
      [6, 6],
      [8, 8],
      [10, 15],
      [12, 24],
      [6, 18],
      [4, 6],
      [3, 6],
      [5, 20],
      [9, 18],
      [15, 30],
    ];
    // Pick one close to the input
    let best: [number, number] = intPairs[0];
    let bestDiff = Number.POSITIVE_INFINITY;
    for (const pair of intPairs) {
      const diff = Math.abs(pair[0] - a) + Math.abs(pair[1] - b);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = pair;
      }
    }
    [a, b] = best;
  }

  const together = (a * b) / (a + b);
  const correct = snapToMode(together, c);

  return {
    correct,
    distractors: [
      snapToMode(a + b, c),
      snapToMode((a + b) / (a * b), c),
      snapToMode(together * 1.5, c),
    ],
    unit: "days",
    solution: {
      phase1: `A completes work in ${a} days, B completes in ${b} days`,
      phase2: "Together = (A × B) / (A + B)",
      phase3: `= (${a} × ${b}) / (${a} + ${b}) = ${a * b}/${a + b} = ${fmtRaw(correct, c)} days`,
    },
  };
}

// ── Work & Wages (multi-person proportional payment) ────────
// Integer mode: scale totalPayment to be divisible by LCM of work-shares

function solveWorkWages(
  nums: number[],
  text: string,
  c: ModeConstraint,
): SolveResult {
  const lower = text.toLowerCase();

  // Extract total payment
  let totalPayment = 0;
  const paymentMatch =
    text.match(/[₹]\s*(\d[\d,]*)/i) ||
    text.match(/payment[^₹\d]*(\d[\d,]*)/i) ||
    text.match(/wages[^₹\d]*(\d[\d,]*)/i);
  if (paymentMatch) {
    totalPayment = Number.parseInt(paymentMatch[1].replace(/,/g, ""), 10);
  }
  if (!totalPayment) totalPayment = Math.max(...nums);

  // Find individual rates (smaller numbers = days/hours to complete)
  const rateNums = nums.filter((n) => n !== totalPayment && n < totalPayment);
  const rates = rateNums.slice(0, 3);

  if (rates.length === 0) {
    const eq = snapToMode(totalPayment / 3, c);
    return {
      correct: eq,
      distractors: [
        snapToMode(totalPayment / 2, c),
        snapToMode(totalPayment / 4, c),
        snapToMode(totalPayment * 0.4, c),
      ],
      unit: "",
      solution: {
        phase1: `Total Payment = ₹${totalPayment}`,
        phase2: "Distribute equally",
        phase3: `Each = ₹${eq}`,
      },
    };
  }

  // Determine who is being asked
  let askedPerson = 1; // default B
  if (
    /\ba\s+(receive|get|earn|paid|share)/.test(lower) ||
    /does\s+a\b/.test(lower)
  )
    askedPerson = 0;
  else if (
    /\bc\s+(receive|get|earn|paid|share)/.test(lower) ||
    /does\s+c\b/.test(lower)
  )
    askedPerson = 2;

  // Efficiencies = 1/rate
  const efficiencies = rates.map((r) => (r > 0 ? 1 / r : 0));
  const totalEfficiency = efficiencies.reduce((s, e) => s + e, 0);
  const workShares = efficiencies.map((e) =>
    totalEfficiency > 0 ? e / totalEfficiency : 0,
  );

  // In integer mode, scale totalPayment to ensure integer shares
  let scaledPayment = totalPayment;
  if (c.mode === "integer") {
    // Find LCM of denominators of work-share fractions
    // workShare[i] = (1/rates[i]) / sum(1/rates[j])
    // Use rates product as common denominator
    // shares as numerators when denominator = rateProd / rate[i]
    // find LCM of work-share denominators by trying multiples of totalPayment
    let found = false;
    for (let mult = 1; mult <= 100 && !found; mult++) {
      const candidate = totalPayment * mult;
      const shares = workShares.map((s) => s * candidate);
      if (
        shares.every(
          (s) =>
            Number.isInteger(Math.round(s)) &&
            Math.abs(s - Math.round(s)) < 0.01,
        )
      ) {
        scaledPayment = candidate;
        found = true;
      }
    }
    // Also try finding a clean base from LCM of rates
    if (!found) {
      let l = rates[0];
      for (let i = 1; i < rates.length; i++) l = lcm(l, rates[i]);
      // payment should be divisible by l * (something)
      scaledPayment = Math.round(totalPayment / l) * l;
      if (scaledPayment <= 0) scaledPayment = l * 100;
    }
  }

  const paymentShares = workShares.map((s) => snapToMode(s * scaledPayment, c));
  const idx = Math.min(askedPerson, paymentShares.length - 1);
  const correct = paymentShares[idx];

  const others = paymentShares.filter((_, i) => i !== idx);
  const wrongCalc = snapToMode(scaledPayment / rates.length, c);

  const distractors = [
    others[0] ?? snapToMode(correct * 1.2, c),
    others[1] ?? snapToMode(correct * 0.8, c),
    wrongCalc,
  ];

  const personLabels = ["A", "B", "C"];
  const askedLabel = personLabels[idx] ?? "B";

  return {
    correct,
    distractors,
    unit: "",
    solution: {
      phase1: `Rates: A=${rates[0]}hrs, B=${rates[1] ?? "?"}hrs${rates[2] ? `, C=${rates[2]}hrs` : ""}. Total payment = ₹${scaledPayment}`,
      phase2: `Work done ∝ 1/rate. ${askedLabel}'s efficiency = 1/${rates[idx] ?? rates[0]}. Total eff = Σ(1/rate)`,
      phase3: `${askedLabel}'s share = (1/${rates[idx] ?? rates[0]}) / (${efficiencies.map((e) => e.toFixed(4)).join(" + ")}) × ₹${scaledPayment} = ₹${correct}`,
    },
  };
}

// ── Wages (simple) ─────────────────────────────────────────

function solveWages(
  nums: number[],
  text: string,
  c: ModeConstraint,
): SolveResult {
  const lower = text.toLowerCase();
  let days = nums[0] ?? 10;
  let ratePerDay = nums[1] ?? 50;

  if (c.mode === "integer") {
    days = Math.max(1, Math.round(days));
    ratePerDay = Math.max(1, Math.round(ratePerDay / 10) * 10);
  }

  const totalWage = days * ratePerDay;
  const isPerDay = lower.includes("per day") || lower.includes("daily");
  const correct = snapToMode(isPerDay ? totalWage : ratePerDay, c);

  return {
    correct,
    distractors: [
      snapToMode(days + ratePerDay, c),
      snapToMode(ratePerDay * 2, c),
      snapToMode(correct * 1.25, c),
    ],
    unit: "",
    solution: {
      phase1: `Days worked = ${days}, Rate per day = ₹${ratePerDay}`,
      phase2: "Total Wages = Days × Rate per day",
      phase3: `= ${days} × ₹${ratePerDay} = ₹${totalWage}`,
    },
  };
}

// ── Percentage ─────────────────────────────────────────────

function solvePercentage(
  nums: number[],
  text: string,
  c: ModeConstraint,
): SolveResult {
  const lower = text.toLowerCase();
  let V = nums[0] ?? 200;
  let P = nums[1] ?? 25;

  if (c.mode === "integer") {
    // Snap P to multiple of 5 and V to multiple of 20 to ensure result is integer
    P = Math.max(5, Math.round(P / 5) * 5);
    V = Math.max(20, Math.round(V / 20) * 20);
  }

  const result = (V * P) / 100;
  const isIncrease =
    lower.includes("increase") ||
    lower.includes("rise") ||
    lower.includes("grew");
  const isDecrease =
    lower.includes("decrease") ||
    lower.includes("fall") ||
    lower.includes("dropped");
  const rawCorrect = isIncrease ? V + result : isDecrease ? V - result : result;
  const correct = snapToMode(rawCorrect, c);

  return {
    correct,
    distractors: [
      snapToMode(V + P, c),
      snapToMode((V / P) * 100, c),
      snapToMode(correct * 1.1, c),
    ],
    unit: "",
    solution: {
      phase1: `Value = ${V}, Percentage = ${P}%`,
      phase2: `${P}% of ${V} = ${V} × ${P}/100`,
      phase3: `= ${roundToDecimals(result, 2)}${isIncrease ? `, New Value = ${roundToDecimals(V + result, 2)}` : isDecrease ? `, New Value = ${roundToDecimals(V - result, 2)}` : ""}`,
    },
  };
}

// ── Generic ────────────────────────────────────────────────

function solveGeneric(
  nums: number[],
  _text: string,
  c: ModeConstraint,
): SolveResult {
  const a = nums[0] ?? 10;
  const b = nums[1] ?? 5;
  const correct = snapToMode(a + b, c);
  return {
    correct,
    distractors: [
      snapToMode(Math.abs(a - b), c),
      snapToMode(a * b, c),
      snapToMode(correct * 1.5, c),
    ],
    unit: "",
    solution: {
      phase1: `Given values: ${nums.slice(0, 3).join(", ")}`,
      phase2: "Apply the relevant formula from the question",
      phase3: `Result = ${fmtRaw(correct, c)}`,
    },
  };
}

// ── Solver dispatcher ──────────────────────────────────────

function solveQuestion(
  chapter: string,
  nums: number[],
  text: string,
  c: ModeConstraint,
): SolveResult {
  switch (chapter) {
    case "Time & Distance":
      return solveTimeDistance(nums, text, c);
    case "Profit & Loss":
      return solveProfitLoss(nums, text, c);
    case "Simple Interest":
      return solveSimpleInterest(nums, text, c);
    case "Compound Interest":
      return solveCompoundInterest(nums, text, c);
    case "Work & Time":
      return solveWorkTime(nums, text, c);
    case "Work & Wages":
      return solveWorkWages(nums, text, c);
    case "Wages & Work":
      return solveWages(nums, text, c);
    case "Percentage":
      return solvePercentage(nums, text, c);
    default:
      return solveGeneric(nums, text, c);
  }
}

// ── Find valid scale factor ────────────────────────────────

function findValidScaleFactor(
  tokens: NumberToken[],
  chapter: string,
  text: string,
  constraint: ModeConstraint,
  excludeFactors: Set<number>,
): { newNums: number[]; factor: number } | null {
  const candidates = [
    2, 3, 1.5, 4, 2.5, 0.5, 5, 6, 1.25, 0.75, 1.75, 8, 10, 0.25,
  ];
  for (const factor of candidates) {
    if (excludeFactors.has(factor)) continue;
    const newNums = tokens.map((t) => scaleNice(t.value, factor));
    if (newNums.some((n) => n <= 0)) continue;
    const solved = solveQuestion(chapter, newNums, text, constraint);
    if (isValidForMode(solved.correct, constraint)) {
      return { newNums, factor };
    }
  }

  // Last resort for integer mode: force-round nums and re-solve
  if (constraint.mode === "integer") {
    for (const factor of candidates) {
      if (excludeFactors.has(factor)) continue;
      const newNums = tokens.map((t) =>
        Math.max(1, Math.round(t.value * factor)),
      );
      const solved = solveQuestion(chapter, newNums, text, constraint);
      const snapped = snapToMode(solved.correct, constraint);
      if (snapped > 0) {
        return { newNums, factor };
      }
    }
  }

  return null;
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
  const constraint = getConstraint(settings);
  const existing = new Set<string>([originalQuestion]);
  const usedFactors = new Set<number>();
  const variants: VariantQuestion[] = [];

  for (let i = 0; i < settings.quantity; i++) {
    const found = findValidScaleFactor(
      tokens,
      chapter,
      originalQuestion,
      constraint,
      usedFactors,
    );

    if (!found) {
      // Fallback: use original numbers with slight int offset for each variant
      const offset = i + 1;
      const newNums = tokens.map((t) =>
        Math.max(1, Math.round(t.value) + offset * 5),
      );
      const solved = solveQuestion(
        chapter,
        newNums,
        originalQuestion,
        constraint,
      );
      const variantText = replaceTokens(originalQuestion, tokens, newNums);
      if (!validateQuestionText(variantText)) continue;

      const { options, correctLabel, correctAnswer } = buildOptions(
        solved.correct,
        solved.distractors,
        settings,
        solved.unit,
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
      continue;
    }

    usedFactors.add(found.factor);
    let variantText = replaceTokens(originalQuestion, tokens, found.newNums);

    if (!validateQuestionText(variantText)) continue;
    if (existing.has(variantText)) continue;
    existing.add(variantText);

    const solved = solveQuestion(
      chapter,
      found.newNums,
      originalQuestion,
      constraint,
    );
    const { options, correctLabel, correctAnswer } = buildOptions(
      solved.correct,
      solved.distractors,
      settings,
      solved.unit,
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
