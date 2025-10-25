from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
from utils.crossword_gen import generate_crossword  # We'll create this next

app = FastAPI(title="AI Mini Crossword MVP")

# Optional request model for the generate endpoint
class CrosswordRequest(BaseModel):
    theme: Optional[str] = None  # User can provide a theme or leave it blank
    size: Optional[int] = 5      # Default size of the crossword

@app.get("/")
def read_root():
    return {"message": "Backend is working!"}

@app.post("/generate-crossword")
def generate(request: CrosswordRequest):
    """
    Generates a crossword puzzle.
    If theme is provided, uses that theme.
    Otherwise generates a random multi-topic puzzle.
    """
    puzzle = generate_crossword(theme=request.theme, size=request.size)
    return puzzle
