// ============================================================
// VARIANT ENGINE — pure TypeScript, no external dependencies
// ============================================================

export interface Settings {
  integerOnly: boolean;
  decimalPrecision: number; // 1–10
  fractionMode: boolean;
  quantity: number; // 3, 4, or 5
}

export interface MCQOption {
  label: "A" | "B" | "C";
  text: string;
}

export interface GeneratedVariant {
  questionText: string;
  options: MCQOption[];
  correctLabel: "A" | "B" | "C";
}

// ── Types for formula patterns ─────────────────────────────
type FormulaType =
  | "speed_distance_time"
  | "price_quantity_total"
  | "percentage"
  | "area"
  | "generic_ratio";

interface NumberToken {
  value: number;
  start: number;
  end: number;
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

function simplifyFraction(num: number, den: number): string {
  if (den === 0) return "0";
  const g = gcd(Math.abs(num), Math.abs(den));
  const sn = num / g;
  const sd = den / g;
  if (sd === 1) return `${sn}`;
  return `${sn}/${sd}`;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function countDecimalPlaces(n: number): number {
  const s = n.toString();
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

function roundToDecimals(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

// Format a number answer according to settings
function formatAnswer(
  value: number,
  numerator: number,
  denominator: number,
  settings: Settings,
  unit: string,
): string {
  if (settings.integerOnly) {
    return `${Math.round(value)} ${unit}`.trim();
  }
  if (settings.fractionMode) {
    const frac = simplifyFraction(numerator, denominator);
    return `${frac} ${unit}`.trim();
  }
  const rounded = roundToDecimals(value, settings.decimalPrecision);
  return `${rounded.toFixed(settings.decimalPrecision)} ${unit}`.trim();
}

// ── Number extraction ──────────────────────────────────────

function extractNumbers(text: string): NumberToken[] {
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

// Replace numbers positionally in the question text
function replaceNumbers(
  text: string,
  tokens: NumberToken[],
  newValues: number[],
): string {
  // Work backwards so indices don't shift
  const sortedTokens = [...tokens]
    .map((t, i) => ({ ...t, newVal: newValues[i] }))
    .sort((a, b) => b.start - a.start);

  let result = text;
  for (const token of sortedTokens) {
    const newNum = token.newVal.toString();
    result = result.slice(0, token.start) + newNum + result.slice(token.end);
  }
  return result;
}

// ── Formula detection ──────────────────────────────────────

function detectFormula(text: string): FormulaType {
  const lower = text.toLowerCase();

  // Speed / Distance / Time
  if (
    /\bkm\/h\b|\bmph\b|\bspeed\b|\btravel\b|\bdistance\b|\bvelocity\b/.test(
      lower,
    )
  ) {
    return "speed_distance_time";
  }

  // Price / Quantity / Total
  if (
    /\bprice\b|\bcost\b|\beach\b|\btotal\b|\bbuy\b|\bpurchase\b|\bdollar\b|\b\$/.test(
      lower,
    )
  ) {
    return "price_quantity_total";
  }

  // Percentage
  if (/\bpercent\b|\bpercentage\b|%/.test(lower)) {
    return "percentage";
  }

  // Area
  if (/\barea\b|\blength\b|\bwidth\b|\brectangle\b|\bsquare\b/.test(lower)) {
    return "area";
  }

  // Generic ratio fallback
  return "generic_ratio";
}

// ── Distractor generation ──────────────────────────────────

function generateDistractors(
  correct: number,
  unit: string,
  settings: Settings,
  numerator: number,
  denominator: number,
): string[] {
  const offsets = [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4];
  const used = new Set<string>();
  const correctStr = formatAnswer(
    correct,
    numerator,
    denominator,
    settings,
    unit,
  );
  used.add(correctStr);

  const distractors: string[] = [];
  const directions = [1, -1];

  let attempts = 0;
  let offsetIdx = 0;

  while (distractors.length < 2 && attempts < 200) {
    attempts++;
    const offset = offsets[offsetIdx % offsets.length];
    const dir = directions[distractors.length % 2];
    let wrongVal = correct + dir * correct * offset;

    // Ensure positive
    if (wrongVal <= 0) wrongVal = correct + correct * offset;

    let wrongStr: string;
    if (settings.fractionMode) {
      // Generate a near fraction
      const wrongNum = Math.round(
        numerator + dir * Math.max(1, Math.round(numerator * offset)),
      );
      const wrongFrac = simplifyFraction(Math.abs(wrongNum), denominator);
      wrongStr = `${wrongFrac} ${unit}`.trim();
    } else if (settings.integerOnly) {
      wrongStr = `${Math.max(1, Math.round(wrongVal))} ${unit}`.trim();
    } else {
      wrongStr =
        `${roundToDecimals(wrongVal, settings.decimalPrecision).toFixed(settings.decimalPrecision)} ${unit}`.trim();
    }

    if (!used.has(wrongStr)) {
      used.add(wrongStr);
      distractors.push(wrongStr);
    }
    offsetIdx++;
  }

  // Fallback if still not enough
  while (distractors.length < 2) {
    const fallback =
      `${Math.max(1, Math.round(correct) + distractors.length + 1)} ${unit}`.trim();
    if (!used.has(fallback)) {
      used.add(fallback);
      distractors.push(fallback);
    } else {
      distractors.push(
        `${Math.round(correct) + 10 + distractors.length} ${unit}`.trim(),
      );
    }
  }

  return distractors;
}

function shuffleOptions(
  correct: string,
  distractors: string[],
): { options: MCQOption[]; correctLabel: "A" | "B" | "C" } {
  const all = [correct, ...distractors];
  // Fisher-Yates shuffle
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  const labels: ("A" | "B" | "C")[] = ["A", "B", "C"];
  const options: MCQOption[] = all.slice(0, 3).map((text, i) => ({
    label: labels[i],
    text,
  }));
  const correctLabel = options.find((o) => o.text === correct)?.label ?? "A";
  return { options, correctLabel };
}

// ── Per-formula variant generators ────────────────────────

const SPEED_VALUES = [
  10, 15, 20, 25, 30, 40, 45, 50, 55, 60, 70, 75, 80, 90, 100, 110, 120,
];

function generateSpeedDistanceTime(
  originalQuestion: string,
  tokens: NumberToken[],
  settings: Settings,
  existing: Set<string>,
): GeneratedVariant | null {
  const unit = "hours";

  for (let attempt = 0; attempt < 100; attempt++) {
    const speed = randomPick(SPEED_VALUES);
    let distance: number;
    let answerNum: number;
    let answerDen: number;

    if (settings.integerOnly) {
      const multiplier = randomInt(1, 10);
      distance = speed * multiplier;
      answerNum = distance;
      answerDen = speed;
    } else if (settings.fractionMode) {
      // Pick a distance that gives a fractional answer
      const multiplierNum = randomInt(1, 20);
      const nonDivisible = speed * multiplierNum + randomInt(1, speed - 1);
      distance = nonDivisible;
      answerNum = nonDivisible;
      answerDen = speed;
    } else {
      // Need answer with EXACTLY decimalPrecision decimal places
      let found = false;
      distance = speed;
      answerNum = distance;
      answerDen = speed;
      for (let inner = 0; inner < 100; inner++) {
        const candidateDistance = speed * (randomInt(10, 999) / 10);
        const ans = candidateDistance / speed;
        const rounded = roundToDecimals(ans, settings.decimalPrecision);
        if (
          countDecimalPlaces(rounded) === settings.decimalPrecision &&
          rounded > 0
        ) {
          distance = candidateDistance;
          answerNum = candidateDistance * 10;
          answerDen = speed * 10;
          found = true;
          break;
        }
      }
      if (!found) continue;
    }

    if (distance <= 0 || speed <= 0) continue;
    const answer = distance / speed;
    if (answer <= 0) continue;

    // Build replacement values, preserving extra tokens beyond 2
    const newValues: number[] = tokens.map((t, i) => {
      if (i === 0) return speed;
      if (i === 1) return distance;
      return t.value;
    });

    const newQuestion = replaceNumbers(originalQuestion, tokens, newValues);
    if (existing.has(newQuestion)) continue;
    existing.add(newQuestion);

    const correctStr = formatAnswer(
      answer,
      answerNum,
      answerDen,
      settings,
      unit,
    );
    const distractors = generateDistractors(
      answer,
      unit,
      settings,
      answerNum,
      answerDen,
    );
    const { options, correctLabel } = shuffleOptions(correctStr, distractors);

    return { questionText: newQuestion, options, correctLabel };
  }
  return null;
}

function generatePriceQuantityTotal(
  originalQuestion: string,
  tokens: NumberToken[],
  settings: Settings,
  existing: Set<string>,
): GeneratedVariant | null {
  const unit = "";

  for (let attempt = 0; attempt < 100; attempt++) {
    const price = randomPick([2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25]);
    let quantity: number;
    let answer: number;
    let answerNum: number;
    let answerDen: number;

    if (settings.integerOnly) {
      quantity = randomInt(2, 20);
      answer = price * quantity;
      answerNum = answer;
      answerDen = 1;
    } else if (settings.fractionMode) {
      quantity = randomInt(2, 10);
      const partialQty = quantity * 10 + randomInt(1, 9);
      answer = (price * partialQty) / 10;
      answerNum = price * partialQty;
      answerDen = 10;
    } else {
      quantity = randomInt(2, 20);
      const partialQty = quantity + randomInt(1, 9) / 10;
      answer = roundToDecimals(price * partialQty, settings.decimalPrecision);
      answerNum = Math.round(answer * 10 ** settings.decimalPrecision);
      answerDen = 10 ** settings.decimalPrecision;
      if (countDecimalPlaces(answer) !== settings.decimalPrecision) continue;
    }

    if (answer <= 0) continue;

    const newValues: number[] = tokens.map((t, i) => {
      if (i === 0) return price;
      if (i === 1) return quantity;
      return t.value;
    });

    const newQuestion = replaceNumbers(originalQuestion, tokens, newValues);
    if (existing.has(newQuestion)) continue;
    existing.add(newQuestion);

    const correctStr = formatAnswer(
      answer,
      answerNum,
      answerDen,
      settings,
      unit,
    );
    const distractors = generateDistractors(
      answer,
      unit,
      settings,
      answerNum,
      answerDen,
    );
    const { options, correctLabel } = shuffleOptions(correctStr, distractors);

    return { questionText: newQuestion, options, correctLabel };
  }
  return null;
}

function generatePercentage(
  originalQuestion: string,
  tokens: NumberToken[],
  settings: Settings,
  existing: Set<string>,
): GeneratedVariant | null {
  const unit = "";

  for (let attempt = 0; attempt < 100; attempt++) {
    const percentValues = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 80];
    const percent = randomPick(percentValues);
    const baseValues = [50, 80, 100, 120, 150, 200, 250, 300, 400, 500];
    const base = randomPick(baseValues);

    let answer: number;
    let answerNum: number;
    let answerDen: number;

    if (settings.integerOnly) {
      answer = (percent / 100) * base;
      if (!Number.isInteger(answer)) continue;
      answerNum = answer;
      answerDen = 1;
    } else if (settings.fractionMode) {
      answerNum = percent * base;
      answerDen = 100;
      answer = answerNum / answerDen;
    } else {
      answer = roundToDecimals(
        (percent / 100) * base,
        settings.decimalPrecision,
      );
      if (countDecimalPlaces(answer) !== settings.decimalPrecision) continue;
      answerNum = Math.round(answer * 10 ** settings.decimalPrecision);
      answerDen = 10 ** settings.decimalPrecision;
    }

    if (answer <= 0) continue;

    const newValues: number[] = tokens.map((t, i) => {
      if (i === 0) return percent;
      if (i === 1) return base;
      return t.value;
    });

    const newQuestion = replaceNumbers(originalQuestion, tokens, newValues);
    if (existing.has(newQuestion)) continue;
    existing.add(newQuestion);

    const correctStr = formatAnswer(
      answer,
      answerNum,
      answerDen,
      settings,
      unit,
    );
    const distractors = generateDistractors(
      answer,
      unit,
      settings,
      answerNum,
      answerDen,
    );
    const { options, correctLabel } = shuffleOptions(correctStr, distractors);

    return { questionText: newQuestion, options, correctLabel };
  }
  return null;
}

function generateArea(
  originalQuestion: string,
  tokens: NumberToken[],
  settings: Settings,
  existing: Set<string>,
): GeneratedVariant | null {
  const unit = "sq units";

  for (let attempt = 0; attempt < 100; attempt++) {
    const lengthVals = [3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20];
    const length = randomPick(lengthVals);
    let width: number;
    let answer: number;
    let answerNum: number;
    let answerDen: number;

    if (settings.integerOnly) {
      width = randomInt(2, 15);
      answer = length * width;
      answerNum = answer;
      answerDen = 1;
    } else if (settings.fractionMode) {
      const widthNum = randomInt(2, 30);
      const widthDen = randomPick([2, 4, 5]);
      width = widthNum / widthDen;
      answerNum = length * widthNum;
      answerDen = widthDen;
      answer = answerNum / answerDen;
    } else {
      width = randomInt(2, 15) + randomInt(1, 9) / 10;
      answer = roundToDecimals(length * width, settings.decimalPrecision);
      if (countDecimalPlaces(answer) !== settings.decimalPrecision) continue;
      answerNum = Math.round(answer * 10 ** settings.decimalPrecision);
      answerDen = 10 ** settings.decimalPrecision;
    }

    if (answer <= 0) continue;

    const newValues: number[] = tokens.map((t, i) => {
      if (i === 0) return length;
      if (i === 1) return width;
      return t.value;
    });

    const newQuestion = replaceNumbers(originalQuestion, tokens, newValues);
    if (existing.has(newQuestion)) continue;
    existing.add(newQuestion);

    const correctStr = formatAnswer(
      answer,
      answerNum,
      answerDen,
      settings,
      unit,
    );
    const distractors = generateDistractors(
      answer,
      unit,
      settings,
      answerNum,
      answerDen,
    );
    const { options, correctLabel } = shuffleOptions(correctStr, distractors);

    return { questionText: newQuestion, options, correctLabel };
  }
  return null;
}

function generateGenericRatio(
  originalQuestion: string,
  tokens: NumberToken[],
  settings: Settings,
  existing: Set<string>,
): GeneratedVariant | null {
  const unit = "";

  for (let attempt = 0; attempt < 100; attempt++) {
    let num1: number;
    let num2: number;
    let answer: number;
    let answerNum: number;
    let answerDen: number;

    if (settings.integerOnly) {
      num2 = randomPick([2, 3, 4, 5, 6, 8, 10]);
      const multiplier = randomInt(1, 10);
      num1 = num2 * multiplier;
      answer = num1 / num2;
      answerNum = answer;
      answerDen = 1;
    } else if (settings.fractionMode) {
      num2 = randomPick([2, 3, 4, 5, 6]);
      num1 = randomInt(num2 + 1, num2 * 10);
      answerNum = num1;
      answerDen = num2;
      answer = num1 / num2;
    } else {
      num2 = randomPick([2, 4, 5, 8, 10]);
      num1 = randomInt(num2, num2 * 10);
      answer = roundToDecimals(num1 / num2, settings.decimalPrecision);
      if (countDecimalPlaces(answer) !== settings.decimalPrecision) continue;
      answerNum = Math.round(answer * 10 ** settings.decimalPrecision);
      answerDen = 10 ** settings.decimalPrecision;
    }

    if (answer <= 0 || num2 === 0) continue;

    const newValues: number[] = tokens.map((t, i) => {
      if (i === 0) return num1;
      if (i === 1) return num2;
      return t.value;
    });

    const newQuestion = replaceNumbers(originalQuestion, tokens, newValues);
    if (existing.has(newQuestion)) continue;
    existing.add(newQuestion);

    const correctStr = formatAnswer(
      answer,
      answerNum,
      answerDen,
      settings,
      unit,
    );
    const distractors = generateDistractors(
      answer,
      unit,
      settings,
      answerNum,
      answerDen,
    );
    const { options, correctLabel } = shuffleOptions(correctStr, distractors);

    return { questionText: newQuestion, options, correctLabel };
  }
  return null;
}

// ── Main entry point ───────────────────────────────────────

export function generateVariants(
  originalQuestion: string,
  settings: Settings,
): GeneratedVariant[] {
  const tokens = extractNumbers(originalQuestion);

  if (tokens.length < 2) {
    throw new Error("Please enter a valid numeric question");
  }

  const formula = detectFormula(originalQuestion);

  const existing = new Set<string>();
  existing.add(originalQuestion); // Don't duplicate the original

  const variants: GeneratedVariant[] = [];

  for (let i = 0; i < settings.quantity; i++) {
    let variant: GeneratedVariant | null = null;

    switch (formula) {
      case "speed_distance_time":
        variant = generateSpeedDistanceTime(
          originalQuestion,
          tokens,
          settings,
          existing,
        );
        break;
      case "price_quantity_total":
        variant = generatePriceQuantityTotal(
          originalQuestion,
          tokens,
          settings,
          existing,
        );
        break;
      case "percentage":
        variant = generatePercentage(
          originalQuestion,
          tokens,
          settings,
          existing,
        );
        break;
      case "area":
        variant = generateArea(originalQuestion, tokens, settings, existing);
        break;
      case "generic_ratio":
        variant = generateGenericRatio(
          originalQuestion,
          tokens,
          settings,
          existing,
        );
        break;
    }

    if (!variant) {
      // Fallback to generic ratio if specific formula exhausted
      variant = generateGenericRatio(
        originalQuestion,
        tokens,
        settings,
        existing,
      );
    }

    if (variant) {
      variants.push(variant);
    }
  }

  if (variants.length === 0) {
    throw new Error("Unable to generate variants for this question type");
  }

  return variants;
}

// ── Export formatting ──────────────────────────────────────

export function formatExport(
  originalQuestion: string,
  variants: GeneratedVariant[],
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
    lines.push(`Variant #${idx + 1}:`);
    lines.push(`Question: ${v.questionText}`);
    for (const o of v.options) {
      lines.push(`${o.label}) ${o.text}`);
    }
    lines.push(`Correct Answer: ${v.correctLabel}`);
    lines.push("");
  }

  return lines.join("\n");
}
