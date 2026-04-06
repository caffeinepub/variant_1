"""validator.py — Module 3: Sign Validator

Rules are based purely on the `unit` field of the answer dict.
Never looks at question type string for sign rules.
"""

from typing import Any

# Units that must always be positive (unless it's a loss question)
_POSITIVE_UNITS = {'%', 'Rs', 'days', 'hours', 'minutes', 'kg', 'litres', 'items', 'units', 'metres'}

# unknownAsked values where negative is allowed (loss questions)
_LOSS_UNKNOWNS = {'LOSS_PERCENT', 'LOSS_RUPEES'}


def validate_answer(answer: dict[str, Any], conditions: dict[str, Any] | None = None) -> dict[str, Any]:
    """
    Validate the answer dict from the solver.
    Returns the answer unchanged if valid.
    Raises ValueError with a clear message if invalid.

    answer = {"value": <number or string>, "unit": str, "display": str, ...}
    conditions (optional) = the full conditions dict from extractor
    """
    value = answer.get('value')
    unit = answer.get('unit', '')
    unknown = (conditions or {}).get('unknownAsked', '')

    # Ratio answers are strings — no numeric validation
    if isinstance(value, str):
        return answer

    # Loss questions: allow negative
    if unknown in _LOSS_UNKNOWNS:
        return answer

    # For positive-required units
    if unit in _POSITIVE_UNITS:
        if isinstance(value, (int, float)) and value <= 0:
            raise ValueError(
                f"Answer {value}{unit} is invalid — "
                f"{unit} answers for this question must be positive. "
                "Check that CP, SP, and other variables are correctly identified."
            )

    return answer
