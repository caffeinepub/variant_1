# VARIANT

## Current State

The app has a fully-featured frontend (React/TypeScript) with all UI, navigation, vocab engine, PWA setup, and settings intact. Math question solving is done via `solverApi.ts` which calls a Python FastAPI server at `http://localhost:8000`. This server is NOT available on the deployed URL — users get "failed to fetch" when they open the live app and try to generate questions.

The frontend already has:
- `mathEngine.ts` — a large but partially-used JS engine (not fully wired as primary)
- `variantEngine.ts` — variant generation logic
- Individual solvers: `profitLossSolver.ts`, `mixtureSolver.ts`, `averagesSolver.ts`, `percentageSolver.ts`, `ratioSolver.ts`, `simpleInterestSolver.ts`, `timeDistanceSolver.ts`, `workTimeSolver.ts`, `workWagesSolver.ts`
- `optionGenerator.ts` — magnitude-aware option builder with sign enforcement
- `solverApi.ts` — only used for Python server calls (to be replaced)
- `aiParser.ts` — question text parser

## Requested Changes (Diff)

### Add
- A new `jsEngine.ts` module that wraps the existing solvers into a single pipeline: `extractConditions → routeFormula → mathjs evaluation → validateAnswer → generateOptions`
- Unit extraction: detects the unit being asked for (%, Rs, days, hours, km, kg, litres) from question text and attaches to every option
- Sign enforcement: no negative options unless it's a loss question
- The JS engine must return results in the same shape as `SolveResult` / `VariantResult` from `solverApi.ts`

### Modify
- `App.tsx` `handleGenerate`: replace calls to `solveQuestion()` and `generateVariantFromServer()` with calls to the new JS engine. No server calls. No loading state for network. Results are synchronous (or very fast).
- `solverApi.ts`: keep for reference/types but no longer called in the main flow
- Error handling: if JS engine fails, show a clear error message to the user with what step failed

### Remove
- Dependency on `SOLVER_URL = "http://localhost:8000"` in the main generation flow
- Network errors about "failed to fetch" or "make sure Python server is running"

## Implementation Plan

1. Create `src/frontend/src/lib/jsEngine.ts`:
   - `extractConditions(text)`: regex-based extraction of numbers, keywords, unit detection, unknownAsked
   - `routeAndSolve(conditions)`: routes to the correct existing solver based on questionType
   - `validateAnswer(answer, unit)`: blocks negative % / Rs / days (except loss questions)
   - `generateOptions(correct, unit, mode)`: uses existing `buildOptions` from `optionGenerator.ts`
   - `generateVariantJS(question, settings)`: mutates numbers ±10-40%, re-runs pipeline, retries 5x
   - `solveQuestionJS(question, settings)`: full pipeline, returns `SolveResult`-compatible object

2. Update `App.tsx`:
   - Import `solveQuestionJS` and `generateVariantJS` from `jsEngine.ts`
   - Replace `solveQuestion()` with `solveQuestionJS()`
   - Replace `generateVariantFromServer()` with `generateVariantJS()`
   - Remove Python server health check / error messages about localhost
   - Keep all UI, structure, and other logic unchanged

3. Keep all existing solver files unchanged — jsEngine.ts acts as orchestrator
