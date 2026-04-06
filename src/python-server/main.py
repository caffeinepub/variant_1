"""main.py — FastAPI server for VARIANT math solver

Endpoints:
  POST /api/solve    — extract + solve + validate + generate options
  POST /api/variant  — generate a true variant with new numbers
  GET  /api/health   — health check
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import sympy
import traceback

from extractor import extract_conditions
from solver import solve_question
from validator import validate_answer
from options import generate_options
from variants import generate_variant

app = FastAPI(title="VARIANT Math Solver", version="1.0.0")

# ------------------------------------------------------------------ #
# CORS — allow all origins during development                          #
# ------------------------------------------------------------------ #
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------------ #
# Request / Response Models                                            #
# ------------------------------------------------------------------ #

class SolveRequest(BaseModel):
    question: str


class VariantRequest(BaseModel):
    question: str
    conditions: dict | None = None


# ------------------------------------------------------------------ #
# Error helper                                                         #
# ------------------------------------------------------------------ #

def error_response(message: str, step: str, status: int = 400):
    return JSONResponse(
        status_code=status,
        content={"error": message, "step": step}
    )


# ------------------------------------------------------------------ #
# Endpoints                                                            #
# ------------------------------------------------------------------ #

@app.get("/api/health")
async def health():
    return {"status": "ok", "sympy_version": sympy.__version__}


@app.post("/api/solve")
async def solve(req: SolveRequest):
    """
    Full pipeline: extract → solve → validate → generate options.
    Returns structured MCQ result.
    """
    question = req.question.strip()
    if not question:
        return error_response("Question text is required", "input_validation")

    # Step 1: Extract
    try:
        conditions = extract_conditions(question)
    except ValueError as e:
        return error_response(str(e), "extractor")
    except Exception as e:
        return error_response(f"Extraction failed: {str(e)}", "extractor")

    # Step 2: Solve
    try:
        answer = solve_question(conditions)
    except ValueError as e:
        return error_response(str(e), "solver")
    except Exception as e:
        return error_response(f"Solver failed: {str(e)}", "solver")

    # Step 3: Validate
    try:
        validated = validate_answer(answer, conditions)
    except ValueError as e:
        return error_response(str(e), "validator")
    except Exception as e:
        return error_response(f"Validation failed: {str(e)}", "validator")

    # Step 4: Generate Options
    try:
        options_list, correct_idx = generate_options(validated)
    except Exception as e:
        return error_response(f"Option generation failed: {str(e)}", "options")

    return {
        "answer": {
            "value": validated['value'],
            "unit": validated['unit'],
            "display": validated['display'],
        },
        "options": [o['display'] for o in options_list],
        "options_full": options_list,
        "correct_index": correct_idx,
        "solution_steps": validated.get('steps', []),
        "conditions": conditions,
    }


@app.post("/api/variant")
async def variant(req: VariantRequest):
    """
    Generate a true variant: new numbers, same structure, recomputed answer.
    """
    question = req.question.strip()
    if not question:
        return error_response("Question text is required", "input_validation")

    # Re-extract conditions if not provided
    conditions = req.conditions
    if not conditions:
        try:
            conditions = extract_conditions(question)
        except ValueError as e:
            return error_response(str(e), "extractor")
        except Exception as e:
            return error_response(f"Extraction failed: {str(e)}", "extractor")

    try:
        result = generate_variant(conditions)
    except ValueError as e:
        return error_response(str(e), "variant_generator")
    except Exception as e:
        return error_response(f"Variant generation failed: {str(e)}", "variant_generator")

    return {
        "answer": {
            "value": result['answer']['value'],
            "unit": result['answer']['unit'],
            "display": result['answer']['display'],
        },
        "options": [o['display'] for o in result['options']],
        "options_full": result['options'],
        "correct_index": result['correct_index'],
        "solution_steps": result.get('steps', []),
        "new_question_text": result['new_question_text'],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
