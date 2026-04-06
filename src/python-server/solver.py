"""solver.py — Module 2: SymPy Solver

Uses sympy.Rational for ALL division to ensure exact arithmetic.
Never returns a raw sympy object — always converts to Python int or float.
"""

from typing import Any
from sympy import Rational, Integer, symbols, solve as sym_solve, sqrt
from fractions import Fraction
import re


def _to_python_number(val) -> int | float:
    """Convert sympy number to Python int or float."""
    try:
        f = float(val)
        # If it's very close to an integer, return int
        rounded = round(f)
        if abs(f - rounded) < 1e-9:
            return int(rounded)
        return round(f, 2)
    except Exception:
        return float(val)


def _fmt_display(value: int | float, unit: str) -> str:
    """Format value+unit into a display string."""
    if isinstance(value, float):
        s = f"{value:.2f}".rstrip('0').rstrip('.')
    else:
        s = str(value)
    if unit == '%':
        return f"{s}%"
    elif unit == 'Rs':
        return f"Rs {s}"
    elif unit:
        return f"{s} {unit}"
    return s


def _sympy_exact(val) -> str:
    """Return sympy exact form as string if it's a fraction, else empty."""
    try:
        r = Rational(val).limit_denominator(1000)
        if r.q != 1:
            return str(r)
        return ""
    except Exception:
        return ""


def solve_question(conditions: dict[str, Any]) -> dict[str, Any]:
    """
    Solve based on conditions dict from extractor.
    Returns:
    {
        "value": <Python number>,
        "unit": "<unit string>",
        "display": "<formatted string>",
        "exact": "<sympy exact or empty string>",
        "steps": [<step strings>],
    }
    """
    vars_ = conditions['variables']
    q_type = conditions['questionType']
    unknown = conditions['unknownAsked']
    unit = conditions['unit']
    raw_text = conditions.get('rawText', '')

    steps: list[str] = []
    result_val = None

    # ------------------------------------------------------------------ #
    # Dispatch by question type                                            #
    # ------------------------------------------------------------------ #

    if q_type in ('basic_profit_loss', 'discount_then_profit', 'markup_discount_profit',
                  'find_discount_pct', 'find_mp'):
        result_val, steps = _solve_profit_discount(vars_, unknown, q_type, raw_text, steps)

    elif q_type in ('markup_above_cp', 'percent_above'):
        result_val, steps = _solve_percent_above(vars_, unknown, raw_text, steps)

    elif q_type == 'free_items_profit':
        result_val, steps = _solve_free_items(vars_, unknown, raw_text, steps)

    elif q_type == 'compound_discount_free':
        result_val, steps = _solve_compound(vars_, unknown, raw_text, steps)

    elif q_type == 'alligation':
        result_val, steps = _solve_alligation(vars_, steps)

    elif q_type == 'time_and_work':
        result_val, steps = _solve_time_work(vars_, steps)

    elif q_type == 'simple_interest':
        result_val, steps = _solve_si(vars_, steps)

    elif q_type == 'compound_interest':
        result_val, steps = _solve_ci(vars_, steps)

    else:
        # Fallback: try profit/loss
        result_val, steps = _solve_profit_discount(vars_, unknown, q_type, raw_text, steps)

    if result_val is None:
        raise ValueError(
            f"Could not compute answer for question type '{q_type}'. "
            "Check that all required variables are present."
        )

    # For LOSS questions, allow negative (loss%)
    # For ratio, result_val may be a string
    if isinstance(result_val, str):
        return {
            'value': result_val,
            'unit': unit,
            'display': result_val,
            'exact': '',
            'steps': steps,
        }

    python_val = _to_python_number(result_val)
    exact = _sympy_exact(result_val)
    display = _fmt_display(python_val, unit)

    return {
        'value': python_val,
        'unit': unit,
        'display': display,
        'exact': exact,
        'steps': steps,
    }


# ------------------------------------------------------------------ #
# Sub-solvers                                                          #
# ------------------------------------------------------------------ #

def _get(vars_: dict, key: str, default=None):
    v = vars_.get(key, default)
    if v is None:
        return default
    return v


def _solve_profit_discount(vars_, unknown, q_type, raw_text, steps):
    """Handle all profit/loss/discount/SP/CP/MP variants."""
    CP = _get(vars_, 'CP')
    SP = _get(vars_, 'SP')
    MP = _get(vars_, 'MP')
    MARKUP_PCT = _get(vars_, 'MARKUP_PCT')
    D = _get(vars_, 'D')
    D1 = _get(vars_, 'D1')
    D2 = _get(vars_, 'D2')
    PROFIT_GIVEN = _get(vars_, 'PROFIT_GIVEN')

    result = None

    # Derive SP from discount if needed
    if MP is not None and D is not None and SP is None:
        SP = MP * Rational(100 - int(D), 100)
        steps.append(f"SP after {D}% discount on MP {MP} = {_to_python_number(SP)}")

    # Derive MP from markup % if needed
    if CP is not None and MARKUP_PCT is not None and MP is None:
        MP = CP * Rational(100 + int(MARKUP_PCT), 100)
        steps.append(f"MP = CP * (1 + {MARKUP_PCT}/100) = {_to_python_number(MP)}")
        if D is not None and SP is None:
            SP = MP * Rational(100 - int(D), 100)
            steps.append(f"SP after {D}% discount on MP {_to_python_number(MP)} = {_to_python_number(SP)}")

    # Successive discounts
    if D1 is not None and D2 is not None and MP is not None:
        net = D1 + D2 - Rational(int(D1) * int(D2), 100)
        SP = MP * Rational(int(100 - net), 100) if net < 100 else MP * (100 - net) / 100
        steps.append(f"Successive discounts {D1}% + {D2}%: net discount = {_to_python_number(net)}%")
        steps.append(f"SP = {_to_python_number(SP)}")

    # Profit % from CP/SP
    if unknown == 'PROFIT_PERCENT':
        if SP is not None and CP is not None:
            profit_pct = Rational(int(SP) - int(CP), int(CP)) * 100 if isinstance(SP, int) and isinstance(CP, int) else \
                         (SP - CP) / CP * 100
            steps.append(f"Profit% = (SP-CP)/CP * 100 = ({_to_python_number(SP)}-{_to_python_number(CP)})/{_to_python_number(CP)} * 100")
            result = profit_pct
        elif PROFIT_GIVEN is not None and CP is not None:
            result = Rational(int(PROFIT_GIVEN), int(CP)) * 100
            steps.append(f"Profit% = (profit/CP)*100 = {PROFIT_GIVEN}/{CP}*100")

    elif unknown == 'LOSS_PERCENT':
        if SP is not None and CP is not None:
            loss_pct = (CP - SP) / CP * 100
            steps.append(f"Loss% = (CP-SP)/CP*100")
            result = loss_pct

    elif unknown == 'SP':
        if CP is not None and PROFIT_GIVEN is not None:
            result = CP * Rational(100 + int(PROFIT_GIVEN), 100)
            steps.append(f"SP = CP*(1+profit%) = {CP}*(1+{PROFIT_GIVEN}/100)")
        elif SP is not None:
            result = SP

    elif unknown == 'CP':
        if SP is not None and PROFIT_GIVEN is not None:
            result = SP / Rational(100 + int(PROFIT_GIVEN), 100)
            steps.append(f"CP = SP/(1+profit/100) = {_to_python_number(SP)}/(1+{PROFIT_GIVEN}/100)")

    elif unknown == 'MP':
        if MP is not None:
            result = MP
        elif CP is not None and MARKUP_PCT is not None:
            result = CP * Rational(100 + int(MARKUP_PCT), 100)
            steps.append(f"MP = CP*(1+markup%) = {CP}*(1+{MARKUP_PCT}/100)")

    elif unknown == 'DISCOUNT_PERCENT':
        if MP is not None and SP is not None:
            result = (MP - SP) / MP * 100
            steps.append(f"Discount% = (MP-SP)/MP*100 = ({_to_python_number(MP)}-{_to_python_number(SP)})/{_to_python_number(MP)}*100")

    return result, steps


def _solve_percent_above(vars_, unknown, raw_text, steps):
    """Compute markup% (MP above CP) or any percent-above question."""
    CP = _get(vars_, 'CP')
    MP = _get(vars_, 'MP')
    MARKUP_PCT = _get(vars_, 'MARKUP_PCT')
    SP = _get(vars_, 'SP')
    D = _get(vars_, 'D')
    PROFIT_GIVEN = _get(vars_, 'PROFIT_GIVEN')
    BUY_QTY = _get(vars_, 'BUY_QTY')
    FREE_QTY = _get(vars_, 'FREE_QTY')

    result = None

    # Compound: discount + free items + target profit → find markup%
    if PROFIT_GIVEN is not None and D is not None and (BUY_QTY is not None or FREE_QTY is not None):
        buy = _get(vars_, 'BUY_QTY', 0)
        free = _get(vars_, 'FREE_QTY', 0)
        total_items = buy + free
        # Let CP per unit = 1 (reference). Effective CP = (buy * 1)/total_items per sold unit
        # SP per unit after discount from MP: SP = MP * (1 - D/100)
        # Profit% target: PROFIT_GIVEN/100
        # Equation: SP * buy / (total_items * 1) = 1 + PROFIT_GIVEN/100
        # => MP * (1-D/100) * buy / total_items = 1 + PROFIT_GIVEN/100
        # => MP = (1 + PROFIT_GIVEN/100) * total_items / ((1 - D/100) * buy)
        # Markup% = (MP - 1) / 1 * 100 = (MP - 1) * 100
        factor = Rational(100 + int(PROFIT_GIVEN), 100) * Rational(int(total_items), 1) \
                 / (Rational(100 - int(D), 100) * Rational(int(buy), 1))
        markup_pct = (factor - 1) * 100
        steps.append(f"Using: MP = (1+profit%)*(buy+free) / ((1-D%)*buy)")
        steps.append(f"MP/CP = {_to_python_number(factor)}, Markup% = {_to_python_number(markup_pct)}%")
        result = markup_pct

    elif CP is not None and MP is not None:
        result = (MP - CP) / CP * 100
        if float(result) < 0:
            raise ValueError("MP cannot be less than CP for this question type")
        steps.append(f"Markup% = (MP-CP)/CP*100 = ({_to_python_number(MP)}-{_to_python_number(CP)})/{_to_python_number(CP)}*100")

    elif CP is not None and MARKUP_PCT is not None:
        result = MARKUP_PCT
        steps.append(f"Markup% is directly given: {MARKUP_PCT}%")

    return result, steps


def _solve_free_items(vars_, unknown, raw_text, steps):
    """Profit% when shopkeeper gives free items."""
    CP = _get(vars_, 'CP')
    SP = _get(vars_, 'SP')
    MP = _get(vars_, 'MP')
    D = _get(vars_, 'D')
    BUY_QTY = _get(vars_, 'BUY_QTY', 0)
    FREE_QTY = _get(vars_, 'FREE_QTY', 0)
    MARKUP_PCT = _get(vars_, 'MARKUP_PCT')

    # Derive SP from MP + discount
    if SP is None and MP is not None and D is not None:
        SP = MP * Rational(100 - int(D), 100)
        steps.append(f"SP after discount = {_to_python_number(SP)}")

    if SP is None and CP is not None and MARKUP_PCT is not None:
        MP_derived = CP * Rational(100 + int(MARKUP_PCT), 100)
        if D is not None:
            SP = MP_derived * Rational(100 - int(D), 100)
        else:
            SP = MP_derived
        steps.append(f"SP = {_to_python_number(SP)}")

    total_items = int(BUY_QTY) + int(FREE_QTY)
    if CP is None or total_items == 0:
        raise ValueError("Missing variables for free-items problem: need CP, BUY_QTY, FREE_QTY")

    effective_CP = Rational(int(CP) * int(BUY_QTY), total_items) if BUY_QTY else CP
    steps.append(f"Effective CP per item = {CP}*{BUY_QTY}/{total_items} = {_to_python_number(effective_CP)}")

    if SP is None:
        SP = CP  # fallback: sold at CP (discount only)

    profit_pct = (SP - effective_CP) / effective_CP * 100
    steps.append(f"Profit% = (SP - eff_CP)/eff_CP * 100 = {_to_python_number(profit_pct)}%")
    return profit_pct, steps


def _solve_compound(vars_, unknown, raw_text, steps):
    """Compound condition: discount + free items + target profit → markup%."""
    CP = _get(vars_, 'CP')
    D = _get(vars_, 'D')
    BUY_QTY = _get(vars_, 'BUY_QTY', 0)
    FREE_QTY = _get(vars_, 'FREE_QTY', 0)
    PROFIT_GIVEN = _get(vars_, 'PROFIT_GIVEN')
    MARKUP_PCT = _get(vars_, 'MARKUP_PCT')

    if PROFIT_GIVEN is None:
        raise ValueError("Missing PROFIT_GIVEN for compound problem")
    if D is None:
        raise ValueError("Missing D (discount%) for compound problem")

    total_items = int(BUY_QTY) + int(FREE_QTY)
    buy = int(BUY_QTY) if BUY_QTY else 1

    # SP = MP * (1 - D/100)
    # Effective CP = CP (or 1 unit reference)
    # Profit equation: (buy * SP) / (total_items * CP) = 1 + PROFIT_GIVEN/100
    # => buy * MP * (1-D/100) / (total_items * CP) = 1 + PROFIT_GIVEN/100
    # => MP/CP = (1+profit%) * total_items / (buy * (1-D/100))

    if CP is None:
        CP = 1  # use unit cost

    mp_cp_ratio = Rational(100 + int(PROFIT_GIVEN), 100) * Rational(total_items, 1) \
                  / (Rational(100 - int(D), 100) * Rational(buy, 1))
    markup_pct = (mp_cp_ratio - 1) * 100

    steps.append(f"Step 1: SP = MP*(1-{D}/100)")
    steps.append(f"Step 2: Effective CP accounts for {FREE_QTY} free items in {total_items} total")
    steps.append(f"Step 3: MP/CP = {_to_python_number(mp_cp_ratio)}, Markup% = {_to_python_number(markup_pct)}%")

    if float(markup_pct) <= 0:
        raise ValueError(f"Computed markup {_to_python_number(markup_pct)}% is invalid (must be positive)")

    return markup_pct, steps


def _solve_alligation(vars_, steps):
    """Alligation/mixture ratio."""
    lower_price = _get(vars_, 'PRICE_LOWER')
    higher_price = _get(vars_, 'PRICE_HIGHER')
    mean_price = _get(vars_, 'MEAN_PRICE')

    if lower_price is None or higher_price is None or mean_price is None:
        raise ValueError("Missing PRICE_LOWER, PRICE_HIGHER, or MEAN_PRICE for alligation")

    ratio_A = int(mean_price - lower_price)
    ratio_B = int(higher_price - mean_price)

    if ratio_A <= 0 or ratio_B <= 0:
        raise ValueError("Invalid alligation: mean price must be between lower and higher prices")

    from math import gcd
    g = gcd(ratio_A, ratio_B)
    result_str = f"{ratio_A // g}:{ratio_B // g}"
    steps.append(f"Alligation: ratio = (mean-lower):(higher-mean) = {ratio_A}:{ratio_B}")
    return result_str, steps


def _solve_time_work(vars_, steps):
    """Time and Work: two people working together."""
    A = _get(vars_, 'WORKER_A')
    B = _get(vars_, 'WORKER_B')

    if A is None:
        raise ValueError("Missing WORKER_A days for time-and-work problem")
    if B is None:
        raise ValueError("Missing WORKER_B days for time-and-work problem")

    combined_rate = Rational(1, int(A)) + Rational(1, int(B))
    days = 1 / combined_rate  # sympy keeps exact
    steps.append(f"Combined rate = 1/{A} + 1/{B} = {_to_python_number(combined_rate)}")
    steps.append(f"Days to complete together = 1/combined_rate = {_to_python_number(days)}")
    return days, steps


def _solve_si(vars_, steps):
    """Simple Interest."""
    P = _get(vars_, 'P')
    R = _get(vars_, 'R')
    T = _get(vars_, 'T')

    if None in (P, R, T):
        raise ValueError(f"Missing SI variables. Got P={P}, R={R}, T={T}")

    si = Rational(int(P) * int(R) * int(T), 100)
    steps.append(f"SI = P*R*T/100 = {P}*{R}*{T}/100 = {_to_python_number(si)}")
    return si, steps


def _solve_ci(vars_, steps):
    """Compound Interest."""
    P = _get(vars_, 'P')
    R = _get(vars_, 'R')
    T = _get(vars_, 'T')

    if None in (P, R, T):
        raise ValueError(f"Missing CI variables. Got P={P}, R={R}, T={T}")

    ci = P * (Rational(100 + int(R), 100) ** int(T)) - P
    steps.append(f"CI = P*(1+R/100)^T - P = {P}*(1+{R}/100)^{T} - {P} = {_to_python_number(ci)}")
    return ci, steps
