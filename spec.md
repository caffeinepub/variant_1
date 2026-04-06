# VARIANT — Universal Aptitude System

## Current State

VARIANT has a working math engine covering: work_wages, profit_loss, time_distance, simple_interest, compound_interest, percentage, ratio, work_time. Options are generated with a 3-tier spread (close/medium/far) for integer mode. The system validates parameters, back-verifies answers, and ensures per-variant option generation.

**Missing topics:** Mixture/Alligation, Averages, Free Items (bonus adjustment on Profit & Loss), full Discount-as-topic coverage.

**Known bug:** Markup questions can produce negative MP/CP ratios or negative options. Option generation currently uses additive spread; user wants X, X-20%, X+20%, X+40% anchored to the correct answer.

## Requested Changes (Diff)

### Add
- `mixtureSolver.ts` — handles mixture and alligation (two vessels, rule of alligation, replacement)
- `averagesSolver.ts` — handles simple average, weighted average, average after adding/removing element
- Free-items support in `profitLossSolver.ts` — `x free on y` bonus adjustment: effective CP = (y+x)/y * CP, total SP = y * SP_per_item
- New parser entries in `aiParser.ts` for: mixture, averages, free_items subtypes
- Solver coverage map entries for `mixture`, `averages`
- New option generation rule: given answer X, produce exactly [X, X*0.80, X*1.20, X*1.40], all rounded and positive, shuffled

### Modify
- `profitLossSolver.ts` — fix markup computation: always compute MP/CP ratio first, markup% = (MP/CP - 1)*100, enforce positive markup, reject if markup <= 0
- `optionGenerator.ts` — new `buildOptionsFromAnswer(X, unit, c)` function following X / X-20% / X+20% / X+40% rule; reject if any option negative; correct answer always included
- `variantEngine.ts` — wire new solvers to dispatcher; update SOLVER_COVERAGE map; use new option generator for all topics
- `aiParser.ts` — add `mixture` and `averages` topic parsers; add `free_items` subtype to profit_loss parser

### Remove
- Nothing removed — backward compatible

## Implementation Plan

1. Create `src/frontend/src/lib/solvers/mixtureSolver.ts` with alligation, two-vessel mixing, replacement
2. Create `src/frontend/src/lib/solvers/averagesSolver.ts` with simple/weighted average, add/remove element
3. Update `aiParser.ts`: add MixtureParams, AveragesParams types; add parsers; add free_items detection in profit_loss parser
4. Update `profitLossSolver.ts`: fix markup computation to always use MP/CP ratio; add free_items subtype handler
5. Update `optionGenerator.ts`: replace distractor logic with X / X-20% / X+20% / X+40% rule; validate no negatives; guarantee correct in output
6. Update `variantEngine.ts`: add mixture/averages to dispatcher and coverage map; wire mutateParsed for new topics
7. Frontend agent validates build
