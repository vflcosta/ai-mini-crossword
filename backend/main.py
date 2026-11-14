import logging
import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
from utils.crossword_gen import generate_crossword as gen_crossword
from utils.puzzle_service import LimitReached, PuzzleService

logger = logging.getLogger("crossword")

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
# Daily puzzles and limits (see utils/puzzle_service.py)
#   PLAYER_DAILY_LIMIT  new themed puzzles one player can make per day (10)
#   GLOBAL_DAILY_LIMIT  new puzzles all players together can make per day (500)
#   PUZZLE_TIMEZONE     when a new day starts (Europe/Zurich)
#   CLIENT_IP_HEADER    header holding the visitor's real address when the
#                       backend sits behind a proxy; on Render: True-Client-IP
# ---------------------------------------------------------
def make_puzzle_service(**overrides) -> PuzzleService:
    settings = dict(
        player_daily_limit=int(os.getenv("PLAYER_DAILY_LIMIT", "10")),
        global_daily_limit=int(os.getenv("GLOBAL_DAILY_LIMIT", "500")),
        timezone=os.getenv("PUZZLE_TIMEZONE", "Europe/Zurich"),
    )
    settings.update(overrides)
    # looked up on every call, so tests can swap gen_crossword
    return PuzzleService(lambda theme, size: gen_crossword(theme=theme, size=size), **settings)


puzzles = make_puzzle_service()


def client_id(request: Request) -> str:
    """Who is asking, for the per-player limit: the visitor's IP address."""
    header = os.getenv("CLIENT_IP_HEADER", "").strip()
    if header:
        value = request.headers.get(header, "").split(",")[0].strip()
        if value:
            return value
    return request.client.host if request.client else "unknown"


LIMIT_MESSAGES = {
    "player_limit": "You've made all your new puzzles for today.",
    "daily_capacity": "So many puzzles were made today that new themes are paused until tomorrow.",
}


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
def generate_crossword_ep(req: GenerateRequest, request: Request):
    """
    Body: {"theme": <string or null>, "size": <int>}
    No theme = today's puzzle (the same for everyone, new every day).

    200: {"grid", "clues", "meta": {"cached", "free", "new_puzzles_left", "resets_at"}}
    429: {"detail": {"code", "message", "limit", "resets_at", "retry_after_seconds"}}
    """
    try:
        result, meta = puzzles.get_puzzle(req.theme, req.size, client_id(request))
    except LimitReached as limit:
        wait = max(1, int((limit.resets_at - puzzles._now()).total_seconds()))
        return JSONResponse(
            status_code=429,
            headers={"Retry-After": str(wait)},
            content={"detail": {
                "code": limit.code,
                "message": LIMIT_MESSAGES[limit.code],
                "limit": limit.limit,
                "resets_at": limit.resets_at.isoformat(),
                "retry_after_seconds": wait,
            }},
        )
    except Exception:
        logger.exception("Puzzle generation failed")
        raise HTTPException(status_code=500, detail="Something went wrong while making the puzzle.")

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return {**result, "meta": meta}

# ---------------------------------------------------------
# Run with: uvicorn main:app --reload
# ---------------------------------------------------------
