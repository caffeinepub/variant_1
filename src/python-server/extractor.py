"""extractor.py — Module 1: Condition Extractor

Extracts numbers, variable mappings, the unknown being asked,
unit, and question type from a raw question text string.
"""

import re
from typing import Any


def extract_conditions(question_text: str) -> dict[str, Any]:
    """
    Scan question_text and return a structured conditions dict:
    {
        "variables": {"CP": 80, "D": 10, ...},
        "unknownAsked": "PROFIT_PERCENT",
        "unit": "%",
        "questionType": "discount_then_profit",
        "rawText": <original string>
    }
    """
    text = question_text
    lower = text.lower()

    # ------------------------------------------------------------------ #
    # 1. Extract all numbers (integers, decimals, fractions, percentages) #
    # ------------------------------------------------------------------ #

    # Percentage: e.g. "15%", "33.33%"
    pct_pattern = re.compile(r'(\d+\.?\d*)\s*%')
    pct_matches = [(float(m.group(1)), m.start()) for m in pct_pattern.finditer(text)]

    # Fractions: e.g. "2/3"
    frac_pattern = re.compile(r'(\d+)\s*/\s*(\d+)')
    frac_matches = []
    for m in frac_pattern.finditer(text):
        num = int(m.group(1))
        den = int(m.group(2))
        if den != 0:
            frac_matches.append((num / den, m.start()))

    # Plain numbers: integers / decimals (not already consumed by pct or frac)
    plain_pattern = re.compile(r'\b(\d+\.?\d*)\b')
    all_numbers = [float(m.group(1)) for m in plain_pattern.finditer(text)]

    # ------------------------------------------------------------------ #
    # 2. Map keywords to variable names                                    #
    # ------------------------------------------------------------------ #

    variables: dict[str, Any] = {}
    number_positions: list[tuple[float, int]] = []

    for m in plain_pattern.finditer(text):
        number_positions.append((float(m.group(1)), m.start()))

    def nearest_number_after(pos: int, limit: int = 80) -> float | None:
        """
        Return the nearest plain number that appears AFTER position `pos`
        within `limit` characters. Prefer percentage values if present.
        """
        # Check percentages first
        for val, ppos in pct_matches:
            if ppos >= pos and (ppos - pos) <= limit:
                return val
        # Fallback to plain
        for val, npos in number_positions:
            if npos >= pos and (npos - pos) <= limit:
                return val
        return None

    def nearest_number_before(pos: int, limit: int = 80) -> float | None:
        """
        Return the nearest plain number BEFORE position `pos` within `limit`.
        """
        best = None
        best_dist = limit + 1
        for val, npos in number_positions:
            if npos < pos and (pos - npos) <= limit:
                dist = pos - npos
                if dist < best_dist:
                    best_dist = dist
                    best = val
        return best

    # Cost Price
    for pat in [r'cost\s+price', r'\bcost\b', r'\bcp\b', r'bought\s+at', r'buys\s+at',
                r'purchase\s+price', r'\bpurchase\b', r'bought\s+for', r'buy\s+at']:
        m = re.search(pat, lower)
        if m:
            val = nearest_number_after(m.end())
            if val is None:
                val = nearest_number_before(m.start())
            if val is not None:
                variables.setdefault('CP', val)
            break

    # Selling Price
    for pat in [r'selling\s+price', r'\bsp\b', r'sold\s+at', r'sells\s+at', r'sold\s+for']:
        m = re.search(pat, lower)
        if m:
            val = nearest_number_after(m.end())
            if val is None:
                val = nearest_number_before(m.start())
            if val is not None:
                variables.setdefault('SP', val)
            break

    # Marked / Listed Price
    for pat in [r'marked\s+price', r'\bmp\b', r'list\s+price', r'tag\s+price',
                r'marks\s+up', r'mark\s+up', r'marked\s+at']:
        m = re.search(pat, lower)
        if m:
            # For "marks up X%", the number after is the markup percent
            if 'mark' in lower[m.start():m.end()+4] and 'up' in lower[m.end():m.end()+10]:
                val = nearest_number_after(m.end())
                if val is not None:
                    variables.setdefault('MARKUP_PCT', val)
            else:
                val = nearest_number_after(m.end())
                if val is None:
                    val = nearest_number_before(m.start())
                if val is not None:
                    variables.setdefault('MP', val)
            break

    # Discount
    # Handle successive / double discounts
    if re.search(r'successive\s+discount|two\s+discount|double\s+discount', lower):
        pct_vals = [v for v, _ in pct_matches]
        if len(pct_vals) >= 2:
            variables['D1'] = pct_vals[0]
            variables['D2'] = pct_vals[1]
    else:
        for pat in [r'discount\s+of', r'\bdiscount\b', r'\boff\b', r'\breduction\b']:
            m = re.search(pat, lower)
            if m:
                val = nearest_number_after(m.end())
                if val is not None:
                    variables.setdefault('D', val)
                break

    # Profit (given vs asked is resolved in unknownAsked step)
    for pat in [r'profit\s+of', r'profit\s+%', r'gain\s+of', r'gained',
                r'earned\s+profit', r'makes\s+a\s+profit']:
        m = re.search(pat, lower)
        if m:
            val = nearest_number_after(m.end())
            if val is not None:
                variables.setdefault('PROFIT_GIVEN', val)
            break

    # Loss (given)
    for pat in [r'loss\s+of', r'\bloss\b', r'\blost\b', r'below\s+cost']:
        m = re.search(pat, lower)
        if m:
            val = nearest_number_after(m.end())
            if val is not None:
                variables.setdefault('LOSS_GIVEN', val)
            break

    # Free items / buy-get-free
    free_m = re.search(
        r'buy\s+(\d+)\s+get\s+(\d+)\s+free'
        r'|(\d+)\s+free\s+on\s+(?:purchasing|buying)?\s*(\d+)'
        r'|(\d+)\s+free\s+(?:with|on)\s+(\d+)'
        r'|gets?\s+(\d+)\s+free',
        lower
    )
    if free_m:
        g = free_m.groups()
        if g[0] and g[1]:
            variables['BUY_QTY'] = int(g[0])
            variables['FREE_QTY'] = int(g[1])
        elif g[2] and g[3]:
            variables['FREE_QTY'] = int(g[2])
            variables['BUY_QTY'] = int(g[3])
        elif g[4] and g[5]:
            variables['FREE_QTY'] = int(g[4])
            variables['BUY_QTY'] = int(g[5])
        elif g[6]:
            variables['FREE_QTY'] = int(g[6])

    # Time / Days / Hours / Minutes
    for pat in [r'(\d+)\s+days?', r'(\d+)\s+hours?', r'(\d+)\s+minutes?']:
        m = re.search(pat, lower)
        if m:
            variables.setdefault('TIME', float(m.group(1)))

    # Work / Time workers
    work_ms = list(re.finditer(
        r'(\d+)\s+days?|can\s+do\s+in\s+(\d+)|finishes?\s+in\s+(\d+)', lower
    ))
    if work_ms and 'work' in lower:
        times = []
        for wm in work_ms:
            val = next((g for g in wm.groups() if g is not None), None)
            if val:
                times.append(float(val))
        if len(times) >= 2:
            variables['WORKER_A'] = times[0]
            variables['WORKER_B'] = times[1]
        elif len(times) == 1:
            variables['WORKER_A'] = times[0]

    # Simple / Compound Interest
    for pat in [r'principal\s+(?:of\s+)?(?:rs\.?\s*)?(\d+)', r'sum\s+(?:of\s+)?(?:rs\.?\s*)?(\d+)',
                r'invested\s+(?:rs\.?\s*)?(\d+)', r'lends?\s+(?:rs\.?\s*)?(\d+)']:
        m = re.search(pat, lower)
        if m:
            variables.setdefault('P', float(m.group(1)))
            break

    for pat in [r'rate\s+(?:of\s+interest\s+)?(?:of\s+)?(\d+\.?\d*)\s*%',
                r'interest\s+rate\s+(?:of\s+)?(\d+\.?\d*)\s*%',
                r'at\s+the\s+rate\s+(?:of\s+)?(\d+\.?\d*)\s*%',
                r'at\s+(\d+\.?\d*)\s*%\s+per\s+annum',
                r'at\s+(\d+\.?\d*)\s*%\s+p\.?a\.?']:
        m = re.search(pat, lower)
        if m:
            variables.setdefault('R', float(m.group(1)))
            break

    for pat in [r'(\d+)\s+years?', r'for\s+(\d+)\s+years?', r'period\s+of\s+(\d+)\s+years?']:
        m = re.search(pat, lower)
        if m:
            variables.setdefault('T', float(m.group(1)))
            break

    # Mixture / Alligation
    mix_m = re.search(
        r'(\d+)\s*(?:litres?|kg|units?)\s+(?:of\s+)?(?:the\s+)?(?:first|cheaper|lower)'
        r'|(\d+)\s+rupees?.*?(\d+)\s*(?:litres?|kg|units?)',
        lower
    )
    if 'mixture' in lower or 'alloy' in lower or 'solution' in lower or 'alligat' in lower:
        nums_in_q = [float(m.group()) for m in re.finditer(r'\d+\.?\d*', text)]
        if len(nums_in_q) >= 3:
            variables.setdefault('PRICE_LOWER', nums_in_q[0])
            variables.setdefault('PRICE_HIGHER', nums_in_q[1])
            variables.setdefault('MEAN_PRICE', nums_in_q[2])

    # Speed / Distance
    for pat in [r'speed\s+(?:of\s+)?(\d+)', r'(\d+)\s+km/h', r'(\d+)\s+kmph',
                r'(\d+)\s+mph', r'at\s+(\d+)\s+km']:
        m = re.search(pat, lower)
        if m:
            variables.setdefault('SPEED', float(m.group(1)))
            break

    for pat in [r'distance\s+(?:of\s+)?(\d+)', r'(\d+)\s+km\b', r'(\d+)\s+km\s+(?:away|far)']:
        m = re.search(pat, lower)
        if m:
            variables.setdefault('DISTANCE', float(m.group(1)))
            break

    # ------------------------------------------------------------------ #
    # 3. Detect what is being asked (unknownAsked)                         #
    # ------------------------------------------------------------------ #

    unknown_asked: str | None = None

    ask_patterns: list[tuple[str, str]] = [
        # Profit %
        (r'find\s+(?:the\s+)?profit\s*%', 'PROFIT_PERCENT'),
        (r'find\s+(?:the\s+)?profit\s+percent', 'PROFIT_PERCENT'),
        (r'what\s+is\s+(?:the\s+)?profit\s+percent', 'PROFIT_PERCENT'),
        (r'profit\s+percent(?:age)?\??', 'PROFIT_PERCENT'),
        (r'gain\s+percent(?:age)?\??', 'PROFIT_PERCENT'),
        (r'find\s+(?:the\s+)?gain\s*%', 'PROFIT_PERCENT'),
        (r'percentage\s+profit', 'PROFIT_PERCENT'),
        # Loss %
        (r'find\s+(?:the\s+)?loss\s*%', 'LOSS_PERCENT'),
        (r'find\s+(?:the\s+)?loss\s+percent', 'LOSS_PERCENT'),
        (r'loss\s+percent(?:age)?\??', 'LOSS_PERCENT'),
        (r'what\s+is\s+(?:the\s+)?loss', 'LOSS_PERCENT'),
        # SP
        (r'find\s+(?:the\s+)?(?:selling\s+price|sp)\b', 'SP'),
        (r'what\s+is\s+(?:the\s+)?(?:selling\s+price|sp)\b', 'SP'),
        (r'(?:at\s+what\s+price|for\s+how\s+much).*?sold', 'SP'),
        # CP
        (r'find\s+(?:the\s+)?(?:cost\s+price|cp)\b', 'CP'),
        (r'what\s+is\s+(?:the\s+)?(?:cost\s+price|cp)\b', 'CP'),
        # MP
        (r'find\s+(?:the\s+)?(?:marked\s+price|mp)\b', 'MP'),
        (r'what\s+is\s+(?:the\s+)?(?:marked\s+price|mp)\b', 'MP'),
        (r'mark\s+(?:up|the\s+price)\s+(?:of|by|to)', 'PERCENT_ABOVE'),
        (r'markup\s+percent(?:age)?', 'PERCENT_ABOVE'),
        (r'marked\s+(?:\d+%?\s+)?above', 'PERCENT_ABOVE'),
        # Discount %
        (r'discount\s+percent(?:age)?\??', 'DISCOUNT_PERCENT'),
        (r'rate\s+of\s+discount', 'DISCOUNT_PERCENT'),
        (r'find\s+(?:the\s+)?discount\s*%', 'DISCOUNT_PERCENT'),
        (r'what\s+(?:percent)?.*?discount', 'DISCOUNT_PERCENT'),
        # % above (markup, percent increase)
        (r'by\s+what\s+percent(?:age)?', 'PERCENT_ABOVE'),
        (r'how\s+much\s+percent\s+more', 'PERCENT_ABOVE'),
        (r'percent\s+(?:above|more|higher|greater)', 'PERCENT_ABOVE'),
        (r'percentage\s+(?:increase|above|more)', 'PERCENT_ABOVE'),
        (r'how\s+much\s+(?:above|more|higher)', 'PERCENT_ABOVE'),
        # Time
        (r'(?:in\s+)?how\s+many\s+days', 'TIME_DAYS'),
        (r'time\s+taken\s+(?:to\s+)?complete', 'TIME_DAYS'),
        (r'(?:in\s+)?how\s+many\s+hours', 'TIME_HOURS'),
        (r'(?:in\s+)?how\s+many\s+minutes', 'TIME_MINUTES'),
        # Interest
        (r'(?:find\s+)?simple\s+interest', 'SI'),
        (r'(?:find\s+)?(?:the\s+)?s\.?i\.?\b', 'SI'),
        (r'(?:find\s+)?compound\s+interest', 'CI'),
        (r'(?:find\s+)?(?:the\s+)?c\.?i\.?\b', 'CI'),
        # Ratio
        (r'in\s+what\s+ratio', 'RATIO'),
        (r'find\s+(?:the\s+)?ratio', 'RATIO'),
    ]

    for pattern, label in ask_patterns:
        if re.search(pattern, lower):
            unknown_asked = label
            break

    # Heuristic fallback: if profit/loss keywords exist and no SP/CP asked
    if unknown_asked is None:
        if re.search(r'\bprofit\b|\bgain\b', lower) and not re.search(
            r'profit\s+(?:of|is|=|:|was)', lower
        ):
            unknown_asked = 'PROFIT_PERCENT'
        elif re.search(r'\bloss\b', lower) and 'loss of' not in lower:
            unknown_asked = 'LOSS_PERCENT'
        elif re.search(r'\bsimple\s+interest\b', lower):
            unknown_asked = 'SI'
        elif re.search(r'\bcompound\s+interest\b', lower):
            unknown_asked = 'CI'
        elif re.search(r'\bhow\s+long\b|\btime\s+taken\b', lower):
            unknown_asked = 'TIME_DAYS'
        elif re.search(r'\bdiscount\b', lower) and 'SP' not in variables and 'MARKUP_PCT' not in variables:
            unknown_asked = 'DISCOUNT_PERCENT'

    if unknown_asked is None:
        raise ValueError(
            "Could not determine what the question is asking for. "
            "Check question text. (Tip: use phrases like 'find profit%', "
            "'what is the discount%', 'how many days', etc.)"
        )

    # ------------------------------------------------------------------ #
    # 4. Assign unit based on unknownAsked                                 #
    # ------------------------------------------------------------------ #

    unit_map: dict[str, str] = {
        'PROFIT_PERCENT': '%',
        'LOSS_PERCENT': '%',
        'DISCOUNT_PERCENT': '%',
        'PERCENT_ABOVE': '%',
        'SP': 'Rs',
        'CP': 'Rs',
        'MP': 'Rs',
        'SI': 'Rs',
        'CI': 'Rs',
        'PROFIT_RUPEES': 'Rs',
        'LOSS_RUPEES': 'Rs',
        'TIME_DAYS': 'days',
        'TIME_HOURS': 'hours',
        'TIME_MINUTES': 'minutes',
        'RATIO': 'ratio',
    }

    unit = unit_map.get(unknown_asked)
    if unit is None:
        # Try to detect unit word from question
        for kw in ['kg', 'kilogram', 'litres', 'liter', 'items', 'units', 'metres', 'meter']:
            if kw in lower:
                unit = kw
                break
        if unit is None:
            unit = ''

    # ------------------------------------------------------------------ #
    # 5. Determine questionType                                            #
    # ------------------------------------------------------------------ #

    question_type = _detect_question_type(lower, variables, unknown_asked)

    return {
        'variables': variables,
        'unknownAsked': unknown_asked,
        'unit': unit,
        'questionType': question_type,
        'rawText': question_text,
    }


def _detect_question_type(lower: str, variables: dict, unknown_asked: str) -> str:
    """Heuristic question type classifier."""
    has_free = 'BUY_QTY' in variables or 'FREE_QTY' in variables or 'free' in lower
    has_discount = 'D' in variables or 'D1' in variables or 'discount' in lower
    has_markup = 'MARKUP_PCT' in variables or re.search(r'mark(?:s)?\s+up|markup', lower)
    has_cp = 'CP' in variables
    has_mp = 'MP' in variables
    has_sp = 'SP' in variables
    is_interest = unknown_asked in ('SI', 'CI')
    is_time = unknown_asked in ('TIME_DAYS', 'TIME_HOURS', 'TIME_MINUTES')
    is_ratio = unknown_asked == 'RATIO'
    is_profit_pct = unknown_asked in ('PROFIT_PERCENT', 'LOSS_PERCENT')
    is_percent_above = unknown_asked == 'PERCENT_ABOVE'

    if is_ratio and ('mixture' in lower or 'alloy' in lower or 'alligat' in lower):
        return 'alligation'
    if is_time and ('work' in lower or 'task' in lower or 'job' in lower):
        return 'time_and_work'
    if is_interest and 'simple' in lower:
        return 'simple_interest'
    if is_interest and 'compound' in lower:
        return 'compound_interest'
    if has_free and has_discount and (is_profit_pct or is_percent_above):
        return 'compound_discount_free'
    if has_free and (is_profit_pct or is_percent_above):
        return 'free_items_profit'
    if has_discount and has_markup and is_profit_pct:
        return 'markup_discount_profit'
    if is_percent_above and has_cp and (has_mp or has_markup):
        return 'markup_above_cp'
    if is_percent_above:
        return 'percent_above'
    if has_discount and (is_profit_pct or unknown_asked == 'SP'):
        return 'discount_then_profit'
    if has_discount and unknown_asked == 'DISCOUNT_PERCENT':
        return 'find_discount_pct'
    if unknown_asked == 'MP' or (has_cp and has_sp and not has_discount):
        return 'find_mp'
    if is_profit_pct:
        return 'basic_profit_loss'
    return 'general'
