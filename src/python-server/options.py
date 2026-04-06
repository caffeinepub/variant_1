"""options.py — Module 4: Option Generator

Generates exactly 4 options (shuffled), always including the correct answer.
Magnitude-aware offset scaling, sign protection, uniqueness guarantee.
"""

import random
from typing import Any


def _get_candidate_offsets(value: float) -> list[int | float]:
    """Return candidate offsets based on answer magnitude."""
    abs_val = abs(value)
    if abs_val <= 10:
        return [1, 2, 3, 4, 5]
    elif abs_val <= 50:
        return [3, 5, 7, 8, 10]
    elif abs_val <= 200:
        return [5, 8, 10, 12, 15]
    elif abs_val <= 1000:
        return [10, 15, 20, 25, 30]
    else:
        return [50, 75, 100, 125, 150]


def _round_to_match(wrong_val: float, correct_val: int | float) -> int | float:
    """Round wrong option to match the precision style of the correct answer."""
    if isinstance(correct_val, int):
        return round(wrong_val)

    # Repeating third: 33.33, 66.67, etc.
    repeating_thirds = [16.67, 25.0, 33.33, 50.0, 66.67, 75.0, 83.33]
    if abs(correct_val - 33.33) < 0.01 or abs(correct_val - 66.67) < 0.01:
        # Only use repeating-third pool
        candidates = [v for v in repeating_thirds if abs(v - correct_val) > 0.01]
        if candidates:
            return min(candidates, key=lambda v: abs(v - wrong_val))

    # Ends in .5
    if abs(correct_val * 2 - round(correct_val * 2)) < 0.01:  # half
        r = round(wrong_val * 2) / 2
        return r

    # Above 100: round to nearest 5
    if abs(correct_val) > 100:
        return round(wrong_val / 5) * 5

    # Default: match decimal places
    s = str(correct_val)
    if '.' in s:
        dp = len(s.split('.')[1])
    else:
        dp = 0
    return round(wrong_val, dp)


def generate_options(answer: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Generate 4 options as a list of dicts:
    [{ "value": ..., "unit": ..., "display": ... }, ...]
    Also returns correct_index indicating which position is correct.

    Returns the options list + appends correct_index to the returned answer dict.
    Actually returns: (options_list, correct_index)
    """
    value = answer['value']
    unit = answer.get('unit', '')
    display = answer.get('display', str(value))

    # Ratio answers: generate string variations
    if isinstance(value, str):
        opts = _generate_ratio_options(value, unit)
        random.shuffle(opts)
        correct_idx = next(i for i, o in enumerate(opts) if o['value'] == value)
        return opts, correct_idx

    float_val = float(value)
    offsets = _get_candidate_offsets(float_val)

    # Pick 3 random offsets (with sign variations)
    random.shuffle(offsets)
    chosen = offsets[:3]

    wrong_vals = []
    for i, off in enumerate(chosen):
        # Alternate sign: +, -, + for variety
        sign = 1 if i % 2 == 0 else -1
        wrong = float_val + sign * off
        wrong_vals.append(wrong)

    # Round wrong options to match correct answer style
    wrong_rounded = [_round_to_match(w, value) for w in wrong_vals]

    # ---- Sign protection ----
    positive_units = {'%', 'Rs', 'days', 'hours', 'minutes', 'kg', 'litres', 'items', 'units', 'metres'}
    if unit in positive_units:
        fixed = []
        for w in wrong_rounded:
            if isinstance(w, (int, float)) and w <= 0:
                old = w
                w = abs(w)
                if w == 0:
                    w = offsets[0]
                print(f"[SIGN FIX] Replaced {old} with {w} for unit {unit}")
            fixed.append(w)
        wrong_rounded = fixed

    # ---- Uniqueness check ----
    seen = {value}
    unique_wrong = []
    extra_offset_idx = 3  # start pulling from further offsets if collision
    for w in wrong_rounded:
        if w in seen:
            # Adjust by next available offset
            extra = offsets[extra_offset_idx % len(offsets)] if extra_offset_idx < len(offsets) + 3 else offsets[-1] + extra_offset_idx
            w = _round_to_match(float_val + offsets[-1] + (extra_offset_idx - 2) * offsets[0], value)
            if unit in positive_units and w <= 0:
                w = abs(w) or offsets[0]
            extra_offset_idx += 1
        seen.add(w)
        unique_wrong.append(w)

    def _make_display(v: int | float, u: str) -> str:
        if isinstance(v, float):
            s = f"{v:.2f}".rstrip('0').rstrip('.')
        else:
            s = str(v)
        if u == '%':
            return f"{s}%"
        elif u == 'Rs':
            return f"Rs {s}"
        elif u:
            return f"{s} {u}"
        return s

    all_opts = [
        {'value': value, 'unit': unit, 'display': display},
        *[{'value': w, 'unit': unit, 'display': _make_display(w, unit)} for w in unique_wrong]
    ]

    # Shuffle
    random.shuffle(all_opts)

    # ---- Correct answer guarantee ----
    correct_idx = next(
        (i for i, o in enumerate(all_opts) if o['value'] == value),
        None
    )
    if correct_idx is None:
        # Insert by replacing the option furthest from correct
        farthest = max(range(len(all_opts)), key=lambda i: abs(float(all_opts[i]['value']) - float_val))
        all_opts[farthest] = {'value': value, 'unit': unit, 'display': display}
        correct_idx = farthest

    return all_opts, correct_idx


def _generate_ratio_options(value: str, unit: str) -> list[dict]:
    """Generate 4 ratio options around the correct ratio string."""
    try:
        parts = [int(p.strip()) for p in value.split(':')]
        a, b = parts[0], parts[1]
    except Exception:
        # fallback
        variants = [value, '1:2', '2:3', '3:4']
        return [{'value': v, 'unit': unit, 'display': v} for v in variants]

    candidates = [
        f"{a}:{b}",
        f"{a+1}:{b}",
        f"{a}:{b+1}",
        f"{a+1}:{b+1}",
        f"{a-1}:{b}" if a > 1 else f"{a+2}:{b}",
        f"{a}:{b-1}" if b > 1 else f"{a}:{b+2}",
    ]
    # Remove duplicates, keep 4
    seen = set()
    result = []
    for c in candidates:
        if c not in seen:
            seen.add(c)
            result.append({'value': c, 'unit': unit, 'display': c})
        if len(result) == 4:
            break
    while len(result) < 4:
        result.append({'value': f"{a+len(result)}:{b}", 'unit': unit, 'display': f"{a+len(result)}:{b}"})
    return result
