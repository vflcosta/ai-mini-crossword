import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
from utils.crossword_gen import generate_crossword as gen_crossword

# ---------------------------------------------------------
# Initialize app
# ---------------------------------------------------------
app = FastAPI(title="AI Mini Crossword MVP")

# ---------------------------------------------------------
# CORS setup: which websites may call this backend.
# Local dev (ports 3000 and 5173) is always allowed. For the live site, set
# the ALLOWED_ORIGINS environment variable to the website address, e.g.
#   ALLOWED_ORIGINS=https://ai-mini-crossword.onrender.com
# (several addresses can be separated by commas). ALLOWED_ORIGIN_REGEX can
# allow a pattern of addresses instead; render.yaml uses it for the site's
# onrender.com address.
# ---------------------------------------------------------
LOCAL_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


def allowed_origins() -> list:
    extra = [o.strip().rstrip("/") for o in os.getenv("ALLOWED_ORIGINS", "").split(",")]
    return LOCAL_ORIGINS + [o for o in extra if o]


app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    allow_origin_regex=os.getenv("ALLOWED_ORIGIN_REGEX") or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=600,
)

# ---------------------------------------------------------
# Request schema
# ---------------------------------------------------------
class GenerateRequest(BaseModel):
    theme: Optional[str] = Field(default=None, max_length=80)
    # a mini crossword: at least 3x3, at most 10x10 (5x5 is the classic mini)
    size: int = Field(default=5, ge=3, le=10)

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
