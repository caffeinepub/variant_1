# VARIANT - UI Rebuild

## Current State
The app is fully functional with 4 screens (Generate, Variant, Drill, Settings) and a fixed bottom nav bar. All backend logic (variantEngine.ts) and authentication (Internet Identity) are working. The current UI has some layout/spacing issues and a few interaction bugs.

## Requested Changes (Diff)

### Add
- Proper ID attributes on every interactive button (data-ocid already present on most, need to verify completeness)
- Toggle-style Switch component for Integer Only (currently a pill button — keep as toggle for cleaner layout)
- Row layout for Decimal Precision: label left + value right on same row, then slider below
- Proper dashed border textarea (16px radius, 120px height, 16px padding)
- Paste button: 40px height, 12px horizontal padding, 12px border radius, blue outline style
- Consistent 16px left/right screen padding throughout all screens
- 20px vertical section spacing throughout

### Modify
- **GenerateScreen**: Complete layout rebuild per spec:
  - Header: VARIANT (large bold blue) + "Question Generator" subtitle 8px below, 20px gap to next section
  - Paste button: top-left, blue outline, 40px height, 12px radius
  - Input box: dashed border, 16px radius, ~120px height, 16px padding, text top-left
  - Integer Only: label left, Switch toggle right (standard row layout)
  - Decimal Precision: "Decimal Precision" label left + current value right on row 1; slider on row 2; ruler ticks 1-10 below
  - Fraction Mode: label left, Switch toggle right
  - Quantity: row of 3 bubbles [3][4][5], selected=solid blue, unselected=light grey
  - Generate button: wide, rounded (27px), solid blue, 54px height, uppercase bold white text
  - Result cards: white, rounded-2xl, VARIANT #1 blue label, question text, MCQ options
- **All screens**: Use #F5F7FA background, white cards with subtle shadows, no dark boxes
- **Integer Only toggle**: Use shadcn Switch component (not custom pill button) for label-left toggle-right layout
- **Fraction Mode toggle**: Already using Switch, keep but ensure consistent row alignment
- **Decimal slider**: When Integer Only is ON, disable slider + fraction mode with opacity-40
- All buttons must have unique data-ocid IDs

### Remove
- Custom pill button for Integer Only (replace with standard Switch row)
- Any dark theme colors or grey-heavy areas
- Glow effects (box-shadow with high rgba opacity on generate button — reduce to subtle)
- Oversized elements that break mobile layout

## Implementation Plan
1. Rebuild GenerateScreen.tsx with precise layout per spec:
   - Fix Integer Only to use Switch component in label-left/toggle-right row layout
   - Fix Decimal Precision row: label+value on row 1, slider on row 2, ticks below
   - Fix Paste button: 40px, 12px radius, blue outline
   - Fix textarea: dashed border, 16px radius, 120px height
   - Fix spacing: 16px screen padding, 20px section gaps, 12px between items
   - Fix Generate button: standard shadow (no heavy glow), wide rounded
2. Ensure all interactive buttons have unique data-ocid IDs
3. Verify DrillScreen, VariantScreen, SettingsScreen follow same light theme
4. Fix any broken button interactions (all onClick handlers properly wired)
5. Validate and build
