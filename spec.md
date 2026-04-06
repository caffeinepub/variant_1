# VARIANT — Python Math Solver Server

## Current State

The VARIANT app is a React/TypeScript PWA with a full frontend-only math engine:
- `mathEngine.ts` — Modules 1–5: extractConditions, routeFormula, validateAnswer, generateOptions, generateVariant (all using mathjs)
- `variantEngine.ts` — Primary pipeline orchestrator, falling back to legacy solver files
- `aiParser.ts`, `optionGenerator.ts`, and `solvers/*.ts` — Legacy solver files
- `App.tsx` handles `generateVariants()` call via `handleGenerate()`
- `GenerateScreen.tsx` renders variants, options, and the MCQ UI

The frontend currently does ALL math: extraction, formula routing, sympy-equivalent evaluation, validation, option generation, and variant generation.

## Requested Changes (Diff)

### Add
- `src/python-server/` directory with a complete FastAPI Python server
  - `main.py` — FastAPI app, CORS, endpoints: POST /api/solve, POST /api/variant, GET /api/health
  - `extractor.py` — `extract_conditions()` function (regex-based number/keyword extractor)
  - `solver.py` — `solve_question()` function (sympy-based exact math solver)
  - `validator.py` — `validate_answer()` function (sign and range validator)
  - `options.py` — `generate_options()` function (magnitude-aware 4-option generator)
  - `variants.py` — `generate_variant()` function (true variant: new numbers + recomputed answer)
  - `requirements.txt` — fastapi, uvicorn, sympy, python-multipart
  - `README.md` — how to run the server
- `src/frontend/src/lib/solverApi.ts` — single-file API client with `SOLVER_URL` const and typed functions: `solveQuestion()`, `generateVariant()`, `checkHealth()`

### Modify
- `App.tsx` — `handleGenerate()` now calls `solverApi.solveQuestion()` (POST /api/solve) instead of `generateVariants()`. Shows loading spinner. Shows red error card on server error. Displays returned options directly.
- `GenerateScreen.tsx` — receives options directly from server response (already `{ label, text, isCorrect }` format). Pass loading state and error state as props. Show spinner while awaiting server. Show error in red card if server returns error.

### Remove
- No files deleted. All existing math logic files (`mathEngine.ts`, `variantEngine.ts`, `solvers/*.ts`) remain in place but are no longer called from the main generate flow. They serve as dead code that can be cleaned up later.

## Implementation Plan

1. Create `src/python-server/requirements.txt` with: fastapi, uvicorn[standard], sympy, python-multipart
2. Create `src/python-server/extractor.py` — regex extraction of numbers and keywords, unknownAsked detection, unit assignment
3. Create `src/python-server/solver.py` — sympy.Rational-based solver for all question types
4. Create `src/python-server/validator.py` — sign/range validation by unit field
5. Create `src/python-server/options.py` — magnitude-aware 4-option generator with sign protection, uniqueness, and correct-answer guarantee
6. Create `src/python-server/variants.py` — variant generator that regenerates numbers and runs full pipeline
7. Create `src/python-server/main.py` — FastAPI app with CORS, /api/solve, /api/variant, /api/health
8. Create `src/python-server/README.md` — setup and run instructions
9. Create `src/frontend/src/lib/solverApi.ts` — typed API client with SOLVER_URL, solveQuestion(), generateVariant(), checkHealth()
10. Update `App.tsx` — replace generateVariants() call with solverApi.solveQuestion(), add loading/error state
11. Update `GenerateScreen.tsx` — add loading spinner prop, error card prop, accept server-formatted options directly
