# VARIANT

## Current State

VARIANT is a production PWA MCQ generator for quantitative aptitude. It has four tabs: Generate, Variant (saved questions), Drill, and Settings. The math engine is fully deterministic (JS solvers, AI only for parsing). The app is installable as a PWA.

Current distractor logic in `optionGenerator.ts`:
- `buildDistractorSet` uses percentage-based multipliers (0.75, 1.25, etc.) and a minimum gap of `max(1, correct * 0.05)`
- `generateGenericDistractors` uses 0.9x, 1.1x, 1.25x offsets
- All topic-specific distractor generators use small multipliers (±5%, ±10%, ±20%)
- Integer mode and decimal/fraction modes all share the same distractor spread logic

Current modes in Settings (GenerateScreen):
- Integer Only toggle
- Decimal Precision slider (1-10)
- Fraction Mode toggle
- Fraction and Decimal modes are always available regardless of Integer Only toggle

The app has 4 navigation tabs: Generate, Variant, Drill, Settings.

## Requested Changes (Diff)

### Add
- **Vocabulary Mode** — a new 5th tab (or mode within the app) with:
  - Word display with synonym/antonym MCQ (4 options A-D)
  - Difficulty slider (1-10 levels: 1-3 basic, 4-6 moderate, 7-8 advanced, 9-10 professional/exam-level)
  - Synonym / Antonym toggle
  - Root word display (etymology, e.g. "abund (Latin: to overflow)")
  - Save word feature (localStorage) with word, meaning, root, type, difficulty
  - Saved words organized in folders by difficulty tier (Beginner / Intermediate / Advanced)
  - AI-powered word generation (AI is reliable for language tasks unlike math)
  - No image toggle (skipped — no API key)

- **Wide-spread distractor logic for Integer mode**:
  - In Integer mode, distractors can be anywhere from ~1 to ~100 units away from the correct answer (realistic exam feel like 38, 40, 50 around 47)
  - Correct answer is always exact and always present
  - Fraction and Decimal modes keep their existing precise distractor logic unchanged

### Modify
- `optionGenerator.ts` — add a `wideSpread` flag/path in `buildDistractorSet` that is used when mode is `integer`. Instead of percentage multipliers that produce close values, use offsets in the range 3-30 (randomized) to produce exam-realistic distractors.
- `generateTopicDistractors` — when mode is integer, use wide offsets instead of tight ±10% multipliers
- Navigation — add a 5th tab for Vocabulary (BookOpen icon)
- `App.tsx` — add `vocab` to the Tab type and render VocabScreen
- **Format controls behavior**: Fraction and Decimal sliders should be visually disabled/greyed when Integer Only is ON (they already are), but make it explicit in the UI that they are off. No behavior change needed — the `getConstraint` function already handles this.

### Remove
- Nothing removed

## Implementation Plan

1. **`src/frontend/src/lib/optionGenerator.ts`**
   - In `buildDistractorSet`, add a branch for `c.mode === 'integer'`: instead of multiplier-based distractors, use random integer offsets in range [3, 30] (both + and -) relative to `correct`, ensuring all are positive (or same sign as correct), unique, and at least 3 apart from each other
   - In `generateGenericDistractors`, when mode is integer, use wide offsets
   - All topic-specific generators: when `c.mode === 'integer'`, return wide-spread integer offsets instead of tight multipliers

2. **`src/frontend/src/lib/vocabEngine.ts`** (new file)
   - `generateVocabQuestion(difficulty: number, type: 'synonym' | 'antonym')` — calls AI to generate a word appropriate for the difficulty level, its correct synonym/antonym, three plausible but wrong options, the word's meaning, and its etymological root
   - Returns structured data: `{ word, meaning, root, type, difficulty, correctAnswer, options: [{label, text, isCorrect}], correctLabel }`
   - AI prompt is carefully structured to get reliable language output
   - `SavedWord` interface matching the JSON structure from the spec
   - `getSavedWords()` / `saveWord()` / `deleteSavedWord()` using localStorage key `variant_saved_words`

3. **`src/frontend/src/components/VocabScreen.tsx`** (new file)
   - Header: VARIANT logo + "Vocabulary" subtitle
   - Difficulty slider (1-10) with tier labels (Basic/Moderate/Advanced/Pro)
   - Synonym / Antonym pill toggle
   - "Generate Word" button
   - Word card: shows the word, its meaning, the MCQ options (A-D clickable), etymology root, and a heart/save button
   - After answering, shows correct/wrong feedback
   - "Next Word" button to generate a new one
   - Saved Words section at bottom (collapsible), grouped by tier: Beginner (1-3), Intermediate (4-6), Advanced (7-10)
   - All UI matches existing Soft UI style (same card borders, fonts, colors, toggles)

4. **`src/frontend/src/App.tsx`**
   - Add `'vocab'` to Tab type
   - Import VocabScreen
   - Add BookOpen icon from lucide-react for the vocab tab
   - Add vocab tab to tabs array with label "Vocab"
   - Render VocabScreen in AnimatePresence
   - Nav bar now has 5 tabs — adjust spacing

5. **Validate** — run frontend validation, fix any TypeScript/lint errors
