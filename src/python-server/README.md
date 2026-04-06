# VARIANT — Python Math Solver Server

A FastAPI backend that handles all math solving, option generation, and variant generation for the VARIANT app.

## Setup

### 1. Install Python dependencies

```bash
cd src/python-server
pip install -r requirements.txt
```

Or with a virtual environment (recommended):

```bash
cd src/python-server
python3 -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Run the server

```bash
python main.py
```

Or with uvicorn directly:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The server starts on **http://localhost:8000**.

## Endpoints

### `GET /api/health`
Verify the server is running.

```json
{"status": "ok", "sympy_version": "1.12"}
```

### `POST /api/solve`
Solve a question and return MCQ options.

**Request:**
```json
{
  "question": "A shopkeeper buys at Rs 80, marks up 50%, gives 10% discount. Find profit%."
}
```

**Response:**
```json
{
  "answer": {"value": 35, "unit": "%", "display": "35%"},
  "options": ["25%", "30%", "35%", "40%"],
  "correct_index": 2,
  "solution_steps": ["MP = 80*(1+50/100) = 120", "SP = 120*(1-10/100) = 108", "Profit% = (108-80)/80*100 = 35%"]
}
```

**Error:**
```json
{"error": "Could not determine what the question is asking for...", "step": "extractor"}
```

### `POST /api/variant`
Generate a variant with new numbers.

**Request:**
```json
{
  "question": "Original question text",
  "conditions": { ... }   // optional, re-extracted if omitted
}
```

**Response:** same as `/api/solve` plus `new_question_text`.

## Architecture

```
main.py         FastAPI app, CORS, routing
extractor.py    Regex-based condition extraction (Module 1)
solver.py       SymPy exact-math solver (Module 2)
validator.py    Sign/range validation (Module 3)
options.py      4-option MCQ generator (Module 4)
variants.py     True variant generator (Module 5)
```

## Configuration

The frontend connects to this server via `const SOLVER_URL = "http://localhost:8000"` in `src/frontend/src/lib/solverApi.ts`. Change that constant to point to a deployed server URL.
