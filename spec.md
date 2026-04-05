# VARIANT

## Current State

- `src/frontend/src/lib/variantEngine.ts`: Core engine with `generateVariants()`, `classify()`, `buildOptions()`, `solveQuestion()` per-chapter solvers, and `formatExport()`.
- `src/frontend/src/components/GenerateScreen.tsx`: Wraps `InputScreen` + `ResultsScreen`. MCQ options are displayed but NOT clickable (no feedback). No bookmark save to localStorage.
- `src/frontend/src/components/ResultsScreen.tsx`: Shows variant cards with MCQ options as static divs (no click handlers, no green/red feedback, no bookmark icon).
- `src/frontend/src/components/VariantScreen.tsx`: Two-tier chapter/subTopic folder system. Questions are shown in collapsible cards. **Clicking a question does nothing** — no navigation to generate a variant.
- `src/frontend/src/App.tsx`: Tab-based SPA with `activeTab` state. `handleGenerate` is in App. Switching tabs is done via `setActiveTab`. No mechanism to pre-fill a question from the Variant tab and navigate to Generate.
- `variantEngine.ts` currently has NO pre-generation filtering — options are generated and shown immediately with no unit check, integer check, or plausibility check.

## Requested Changes (Diff)

### Add

1. **3-Filter Mechanism in `variantEngine.ts`** — Run these checks inside `generateVariants()` before any variant is returned:
   - **Filter 1 – Unit Consistency**: Detect the expected answer unit from the question text (₹/rupees, days, km, hours, %, kg, etc.). After solving, verify the correct answer and all 3 distractors share the same unit. If a distractor has the wrong unit, replace it with a recalculated one using a different error pattern.
   - **Filter 2 – Integer Integrity**: If `settings.integerOnly` is true, verify the correct answer AND all distractors are whole integers (no `.x` decimals). If any distractor is not an integer, recalculate it using a different offset/pattern until it is. Never round — recalculate.
   - **Filter 3 – Plausibility Check**: Ensure no two options have the same formatted string. Ensure no option is zero or negative unless the chapter allows it. Ensure all distractors are within 0.1x–5x range of the correct answer (i.e., no wildly implausible outliers).

2. **Clickable MCQ options with instant feedback in `ResultsScreen.tsx`**:
   - Each option button is clickable.
   - On click: if correct → turn green (#28A745 bg, white text). If wrong → clicked option turns red (#DC3545), correct option turns green.
   - After any selection, all options are disabled.
   - Per-variant selected state tracked with `useState<Record<string, string>>` (variantId → selected label).

3. **Bookmark save in `ResultsScreen.tsx`**:
   - Add a bookmark icon (top-right of each variant card).
   - On tap: save to localStorage under key `variant_saved_questions` in the same `SavedQuestion` format used by `VariantScreen`.
   - Include `chapter`, `subTopic`, `solution`, `options`, `correctLabel`, `id`, `questionText`, `savedAt`.
   - Show a toast confirmation when saved.

4. **Click-to-Generate in `VariantScreen.tsx`**:
   - Each question row inside a sub-topic folder becomes a tappable card with a small arrow/chevron-right icon.
   - On tap: call an `onNavigateToGenerate(questionText: string)` prop callback.
   - This navigates the user to the Generate tab AND pre-fills the question input with that question text.

5. **`onNavigateToGenerate` wired in `App.tsx`**:
   - `VariantScreen` receives a new prop `onNavigateToGenerate: (questionText: string) => void`.
   - In `App.tsx`, pass a handler that: sets `activeTab` to `"generate"` and stores the question text in a new state variable `prefillQuestion`.
   - `GenerateScreen` / `InputScreen` receives `prefillQuestion` prop and uses it as the initial textarea value (or replaces current value via `useEffect`).

### Modify

- `variantEngine.ts` → `generateVariants()`: Wrap the distractor building step with the 3 filters. The filters are internal — user sees no change except better quality output.
- `App.tsx`: Add `prefillQuestion` state, pass `onNavigateToGenerate` to `VariantScreen`, pass `prefillQuestion` to `GenerateScreen`.
- `GenerateScreen.tsx` / `InputScreen.tsx`: Accept optional `prefillQuestion?: string` prop. In `InputScreen`, use a `useEffect` that sets the textarea value whenever `prefillQuestion` changes (and is non-empty).
- `ResultsScreen.tsx`: Add bookmark icon + click state + green/red feedback logic.
- `VariantScreen.tsx`: Question rows become clickable, accept `onNavigateToGenerate` prop.

### Remove

- Nothing removed.

## Implementation Plan

1. **`variantEngine.ts`** — Add `applyFilters(options, correctVal, settings, unit, chapter)` helper that enforces all 3 filters. Call it inside `generateVariants()` after `buildOptions()`. For integer filter: if any option text contains a decimal point and integerOnly is true, regenerate that distractor by using `correctVal ± small integer offsets` until all are clean integers. For unit filter: all option strings must end with the same unit suffix. For plausibility: reject options outside 0.1x–5x range of correct.

2. **`ResultsScreen.tsx`** — Add `selectedAnswers` state map. Convert option display divs into `<button>` elements. Add bookmark icon using lucide `Bookmark`. Wire up localStorage save.

3. **`VariantScreen.tsx`** — Add `onNavigateToGenerate: (q: string) => void` prop. Wrap each question row in a button. Show a right-arrow icon. On click, call the prop.

4. **`App.tsx`** — Add `prefillQuestion` state. Pass `onNavigateToGenerate` to `VariantScreen`. Pass `prefillQuestion` to `GenerateScreen`.

5. **`InputScreen.tsx`** — Accept `prefillQuestion` prop. Add `useEffect(() => { if (prefillQuestion) setQuestion(prefillQuestion); }, [prefillQuestion])`.

6. **`GenerateScreen.tsx`** — Accept and pass down `prefillQuestion` to `InputScreen`.
