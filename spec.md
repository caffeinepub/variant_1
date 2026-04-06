# VARIANT — Math Engine Rebuild with mathjs

## Current State

The app has a working math generation system split across:
- `src/frontend/src/lib/aiParser.ts` — rule-based keyword/regex parser that returns a ParsedQuestion object
- `src/frontend/src/lib/variantEngine.ts` — orchestrates parse → solve → validate → generate
- `src/frontend/src/lib/optionGenerator.ts` — builds 4 MCQ options with magnitude-aware gap
- `src/frontend/src/lib/solvers/profitLossSolver.ts` + other solvers — topic-specific formula execution
- `src/frontend/src/lib/vocabEngine.ts` — vocab word bank with memory-tracked repetition control

The current system uses plain JS arithmetic for all math. The vocab engine uses an in-memory array with simple cooldown/history tracking but no Fisher-Yates shuffle or localStorage persistence.

## Requested Changes (Diff)

### Add
- `mathjs` npm dependency for all arithmetic evaluation
- `src/frontend/src/lib/mathEngine.ts` — new central module containing all 6 modules:
  - Module 1: `extractConditions(questionText)` — pure function keyword extractor
  - Module 2: `routeFormula(conditions)` — formula router using mathjs evaluation
  - Module 3: `validateAnswer(answer, questionType)` — hard rule validator
  - Module 4: `generateOptions(correctAnswer, questionType)` — 4-option generator with offset scaling
  - Module 5: `generateVariant(originalQuestion)` — full regeneration variant engine
  - Module 6: Fisher-Yates vocab no-repeat engine functions exported for VocabScreen use
- All mathjs imports throughout the calculation backbone

### Modify
- `src/frontend/src/lib/variantEngine.ts` — replace internal solve/option logic to call the new mathEngine pipeline (extractConditions → routeFormula → mathjs eval → validateAnswer → generateOptions). Keep all exports and interfaces stable so VariantScreen/GenerateScreen do not need to change.
- `src/frontend/src/lib/vocabEngine.ts` — replace in-memory cooldown tracking with Fisher-Yates shuffle stored in localStorage. On first load shuffle the full word array, persist it. Each generation reads current index, returns word, increments. When exhausted, reshuffles.
- `src/frontend/src/lib/optionGenerator.ts` — update `generateOptions` to use mathjs for all arithmetic (offset calculations, rounding). Keep the offset-scaling tiers as specified.
- All solver files — import mathjs and use it for every expression evaluation (pow, fractions, rounding)

### Remove
- All hardcoded plain-JS arithmetic in option generator offset logic (replace with mathjs)
- The old in-memory `usedWords` array and cooldown mechanism in vocabEngine (replaced by localStorage Fisher-Yates)

## Implementation Plan

1. Install mathjs: `pnpm add mathjs` in the frontend directory
2. Create `src/frontend/src/lib/mathEngine.ts` with all 6 modules as specified:
   - Module 1: extractConditions() with all keyword mappings, number scanning (integers, decimals, fractions like 2/3, percentages like 15%), unknown detection from find/calculate/what is keywords
   - Module 2: routeFormula() covering all formula chains (profit/loss, discount, free items, compound conditions, time&work, mixture/alligation, SI, CI) — each formula evaluated with mathjs
   - Module 3: validateAnswer() with hard type-based rules
   - Module 4: generateOptions() with 5-tier offset scaling using mathjs arithmetic
   - Module 5: generateVariant() with template extraction, bounded random regeneration, 5-retry loop, full pipeline execution
   - Module 6: Fisher-Yates shuffle + localStorage index persistence functions
3. Update variantEngine.ts to import and call mathEngine pipeline while keeping all existing interfaces/exports intact
4. Update vocabEngine.ts to use Module 6 Fisher-Yates localStorage engine
5. Update optionGenerator.ts to use mathjs for arithmetic
6. Update solver files to use mathjs pow() for compound interest and other expressions
7. Validate (lint + typecheck + build)
