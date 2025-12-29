from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from utils.crossword_gen import generate_crossword as gen_crossword

# ---------------------------------------------------------
# Initialize app
# ---------------------------------------------------------
app = FastAPI(title="AI Mini Crossword MVP")

# ---------------------------------------------------------
# CORS setup – allows local dev on 3000 (CRA) and 5173 (Vite)
# ---------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=600,
)

# ---------------------------------------------------------
# Request schema
# ---------------------------------------------------------
class GenerateRequest(BaseModel):
    theme: Optional[str] = None
    size: int = 7

# ---------------------------------------------------------
# Routes
# ---------------------------------------------------------
@app.get("/")
def root():
    return {"status": "ok", "message": "AI Mini Crossword backend is running!"}


@app.post("/generate-crossword")
def generate_crossword_ep(req: GenerateRequest):
    """
    POST endpoint to generate a crossword.
    Body: {"theme": <string or null>, "size": <int>}
    """
    try:
        result = gen_crossword(theme=req.theme, size=req.size)

        if isinstance(result, dict) and "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {e}")

# ---------------------------------------------------------
# Run with: uvicorn main:app --reload
# ---------------------------------------------------------
