# VARIANT

## Current State
- VocabScreen has a `SavedWordsSection` that groups saved words by difficulty tier (Beginner, Intermediate, Advanced, Professional).
- Each saved word card shows: word, type badge, meaning, root (italic), and a delete button.
- No copy button exists on saved word cards.
- No root-word based folder grouping exists — only difficulty-tier grouping.

## Requested Changes (Diff)

### Add
- **Root Word Folder View**: A new collapsible section (or tab within Saved Words) that groups saved words by their Latin/Greek root. Each root becomes a folder header. Words sharing the same root family are nested under it.
- **Copy button** on each saved word card in the folder view. Copies the word, meaning, and root to clipboard. Shows a checkmark confirmation briefly.

### Modify
- `SavedWordsSection` in `VocabScreen.tsx`: Add a toggle between "By Difficulty" (current) and "By Root" (new folder view). Root folders are collapsible. Each word card in both views gets a copy button.
- `vocabEngine.ts`: Extract the root prefix (the part before the parenthetical, e.g. "abund" from "abund (Latin: to overflow)") to use as the folder key for grouping.

### Remove
- Nothing removed.

## Implementation Plan
1. Update `SavedWordsSection` to add a two-pill toggle: "By Level" / "By Root".
2. In "By Root" mode, parse root strings to extract a short folder label (e.g. "abund — Latin", "bene — Latin"), group saved words by this key, render each group as a collapsible folder with word cards inside.
3. Add a copy button to every word card in both views. On click: copy `"${word}\nMeaning: ${meaning}\nRoot: ${root}"` to clipboard, briefly show a checkmark icon.
4. Root extraction helper: parse the `root` string — take the text before the first `(` or `:` as the root key, trim it.
