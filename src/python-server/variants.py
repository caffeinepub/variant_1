"""variants.py — Module 5: Variant Generator

Generates a true variant: new numbers, same question structure, recomputed answer.
Never just shuffles options.
"""

import random
import re
from typing import Any

from extractor import extract_conditions
from solver import solve_question
from validator import validate_answer
from options import generate_options


def _mutate_number(original: float, min_val: float = 1.0) -> float:
    """Generate a new number by ±10–40% of original, rounded to integer."""
    percent = random.choice([0.10, 0.15, 0.20, 0.25, 0.30, 0.40])
    sign = random.choice([1, -1])
    new_val = original * (1 + sign * percent)
    new_val = round(new_val)
    # Clamp
    new_val = max(min_val, new_val)
    new_val = min(original * 10, new_val)
    return float(new_val)


def _replace_numbers_in_text(text: str, original_nums: list[float], new_nums: list[float]) -> str:
    """Replace each original number occurrence in text with the corresponding new number."""
    # Build a list of (position, old_str, new_str) replacements
    result = text
    # We need to replace in reverse order to preserve positions
    pattern = re.compile(r'\b(\d+\.?\d*)\b')
    matches = list(pattern.finditer(text))

    replacements = []
    used = {}
    for match in matches:
        val = float(match.group(1))
        for i, orig in enumerate(original_nums):
            if i in used:
                continue
            if abs(val - orig) < 1e-9:
                replacements.append((match.start(), match.end(), str(int(new_nums[i]) if new_nums[i] == int(new_nums[i]) else new_nums[i])))
                used[i] = True
                break

    # Apply in reverse order
    for start, end, new_str in sorted(replacements, key=lambda x: x[0], reverse=True):
        result = result[:start] + new_str + result[end:]

    return result


def generate_variant(original_conditions: dict[str, Any]) -> dict[str, Any]:
    """
    Generate a variant of the original question.
    Returns the full solve result plus new_question_text.

    Raises ValueError if unable to generate valid variant after 5 retries.
    """
    variables = original_conditions.get('variables', {})
    raw_text = original_conditions.get('rawText', '')
    if not raw_text:
        raise ValueError("rawText is required to generate variants")

    # Extract numeric values from variables
    numeric_vars = {k: v for k, v in variables.items() if isinstance(v, (int, float))}

    # Determine constraints from original
    has_mp_gt_cp = (
        'MP' in numeric_vars and 'CP' in numeric_vars and
        numeric_vars['MP'] > numeric_vars['CP']
    )
    orig_discount = numeric_vars.get('D', None)

    max_retries = 5
    for attempt in range(max_retries):
        # Mutate all numeric variables
        new_vars = {}
        for key, orig_val in numeric_vars.items():
            if key in ('D', 'D1', 'D2'):
                # Discounts: clamp below 100
                new_val = _mutate_number(orig_val, 1)
                new_val = min(95, new_val)
            elif key in ('MARKUP_PCT', 'PROFIT_GIVEN'):
                # Percentages: keep positive and reasonable
                new_val = _mutate_number(orig_val, 1)
                new_val = min(100, new_val)
            elif key in ('BUY_QTY', 'FREE_QTY'):
                # Keep as small integers
                new_val = _mutate_number(orig_val, 1)
                new_val = min(20, round(new_val))
            elif key in ('WORKER_A', 'WORKER_B', 'TIME', 'T'):
                new_val = max(1, _mutate_number(orig_val, 1))
            else:
                new_val = _mutate_number(orig_val, 1)

            new_vars[key] = new_val

        # Enforce constraints
        if has_mp_gt_cp and 'MP' in new_vars and 'CP' in new_vars:
            if new_vars['MP'] <= new_vars['CP']:
                # Force MP to be larger
                new_vars['MP'] = new_vars['CP'] * (1 + random.uniform(0.1, 0.6))
                new_vars['MP'] = round(new_vars['MP'])

        if orig_discount is not None and 'D' in new_vars:
            new_vars['D'] = min(95, max(1, new_vars['D']))

        # Build new conditions
        new_conditions = dict(original_conditions)
        new_conditions['variables'] = {**variables, **{k: v for k, v in new_vars.items()}}

        try:
            # Run through full pipeline
            answer = solve_question(new_conditions)
            validated = validate_answer(answer, new_conditions)
            options_list, correct_idx = generate_options(validated)

            # Rebuild question text
            orig_nums = list(numeric_vars.values())
            new_nums = list(new_vars.values())
            new_text = _replace_numbers_in_text(raw_text, orig_nums, new_nums)

            # Confirm it's different
            if new_text == raw_text:
                continue

            return {
                'answer': validated,
                'options': options_list,
                'correct_index': correct_idx,
                'steps': answer.get('steps', []),
                'new_question_text': new_text,
            }

        except Exception as e:
            # Retry with different offsets
            continue

    raise ValueError(
        "Could not generate valid variant — try a different question. "
        f"All {max_retries} attempts failed."
    )
