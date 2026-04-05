# VARIANT — Deterministic Formula-First Math Engine

## Current State
- variantEngine.ts has solver functions per chapter (solveTimeDistance, solveProfitLoss, etc.)
- Solvers compute correct answers and distractors in floating point
- Integer mode rounds output after the fact — does NOT guarantee clean integers throughout
- Fraction mode calls fmt() at display time — not enforced during solver
- Decimal mode does not control intermediate precision — fmt() just formats the final output
- Distractor generation uses simple arithmetic offsets, not mode-aware logic
- The 3-filter post-processing tries to patch up bad options but cannot fix fundamentally wrong values
- Scale factors (SCALE_FACTORS array) are applied blindly — no check that scaled numbers produce a clean-mode answer

## Requested Changes (Diff)

### Add
- `ModeConstraint` type: `{ mode: 'integer' | 'fraction' | 'decimal', decimalPrecision?: number }`
- `enforceMode(value: number, constraint: ModeConstraint): number` — snaps a number to the required mode
- `isValidForMode(value: number, constraint: ModeConstraint): boolean` — checks if a value is valid for the mode
- `reverseEngineerScaleFactor(tokens, chapter, constraint)` — finds a scale factor that produces a mode-valid answer
- `buildModeAwareDistractors(correct, chapter, constraint, unit)` — generates 3 distractors that are all valid for the mode
- Fraction output: `toFraction(value): string` — returns simplified fraction string like "3/4" or "5/2"
- Each solver gains a new parameter `constraint: ModeConstraint` and internally adjusts its numbers so the answer is mode-valid BEFORE returning

### Modify
- All solvers (`solveTimeDistance`, `solveProfitLoss`, `solveSimpleInterest`, `solveCompoundInterest`, `solveWorkTime`, `solveWorkWages`, `solveWages`, `solvePercentage`, `solveGeneric`) must:
  1. Accept `constraint: ModeConstraint`
  2. Pick/scale input numbers so the correct answer satisfies the constraint natively
  3. Generate distractors that also satisfy the constraint (no post-hoc rounding)
- `generateVariants()` must:
  1. Determine constraint from settings (priority: integer > fraction > decimal)
  2. Pass constraint to solvers
  3. When scaling numbers for a variant, find a scale factor that keeps the answer mode-valid
  4. Reject and retry a scale factor if it produces a non-mode-valid answer (up to 10 attempts)
- `fmt()` must be updated so that fraction mode outputs true simplified fractions like "3/4" not "750/1000"
- `buildOptions()` passes constraint to distractor builder

### Remove
- Post-hoc rounding of correct answers in Filter 2 (integer integrity) — the answer is now correct by construction
- Blind `sanitizeNumber()` calls that could corrupt valid decimal/fraction values

## Implementation Plan
1. Add `ModeConstraint` type and `isValidForMode()` / `enforceMode()` helpers
2. Add `toFraction(n)` proper simplified fraction formatter
3. Update `fmt()` to use `toFraction()` for true fractions
4. Rewrite each solver to accept and satisfy constraint
5. Add `findValidScaleFactor()` that tries SCALE_FACTORS until answer is mode-valid
6. Update `generateVariants()` to use constraint-aware scaling
7. Rewrite `buildModeAwareDistractors()` — distractors built from realistic math errors, all mode-valid
8. Update `buildOptions()` to use new distractor builder
9. Keep 3-filter post-processing as a safety net but it should rarely need to fire
