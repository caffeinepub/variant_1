# VARIANT

## Current State
- profitLossSolver.ts `solveFreeItems` computes profit% from given markup+discount but does NOT support the "find markup given discount+profit target" subtype. When question asks for markup%, the solver returns a tiny profit% instead.
- optionGenerator.ts uses fixed ±20%/±40% percentage spread which collapses to tiny numbers (1–4%) when answer is small, but more critically does NOT scale relative to X: if X=74, X*0.8=59 which is fine, but if the solver wrongly outputs X=3, options become 2.4,3.6,4.2 — all tiny.
- The core issue: `solveFreeItems` ignores the `asked` dimension — it always returns profit%, never markup%. A question like "discount=19%, 2 free on 23, profit=30%, find markup%" needs the inverse formula: MP/CP = profit_factor × total_items / (items_paid × (1-discount)).

## Requested Changes (Diff)

### Add
- `solveFreeItemsMarkup()` function in profitLossSolver: given discount%, free items count, and target profit%, solve for markup% using the unified equation: MP/CP = (1+profit/100)×(y+x) / (y×(1-discount/100)), then markup% = (MP/CP - 1)×100
- Magnitude-aware option scaling in optionGenerator: compute dynamic gap = max(|X|×0.10, 5) then options at X, X-gap, X+gap, X+2×gap
- Parser upgrade: detect "find markup" intent in free_items questions via keywords like "what markup", "what percent above", "mark up by"

### Modify
- `solveFreeItems` in profitLossSolver: detect whether question asks for profit% or markup%, route to correct sub-function
- `generateOptionsFromAnswer` in optionGenerator: replace fixed ×0.8/×1.2/×1.4 with magnitude-aware spread using gap = max(X×0.10, 5); keeps correct answer exact; all options must share same sign
- `parseProfitLoss` in aiParser: when free_items detected, also extract `asked` field ("profit" vs "markup") from question text
- ProfitLossParams interface: add optional `asked?: "profit" | "markup"` field

### Remove
- Nothing removed

## Implementation Plan
1. Add `asked` field to ProfitLossParams interface in aiParser.ts
2. Update `parseProfitLoss` to detect markup-ask intent in free_items questions
3. Add `solveFreeItemsMarkup` function to profitLossSolver.ts
4. Update `solveFreeItems` to route to markup sub-solver when `asked==='markup'`
5. Replace percentage-based option spreads in optionGenerator.ts with magnitude-aware gap logic
6. Validate: X=74 gives options ~65,74,81,89; X=3 gives options ~1,3,5,8 (minimum gap=5 prevents collapse)
