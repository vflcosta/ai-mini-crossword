import os
import json
import logging
import random
import re
import zlib
from typing import Optional, List, Dict, Tuple
from dotenv import load_dotenv
import anthropic

from utils.dense_fill import MAX_DENSE_SIZE, fill_dense

# Load ANTHROPIC_API_KEY (and the other settings) from backend/.env
load_dotenv()

# Which Claude model writes the words and clues. Override with AI_MODEL.
AI_MODEL = os.getenv("AI_MODEL", "claude-haiku-5-5")
# How hard the model thinks before answering: low, medium or high.
# "low" is the cheapest and fastest, and enough for words and short clues.
AI_EFFORT = os.getenv("AI_EFFORT", "low")
# Upper limit on each reply, thinking included (a puzzle needs far fewer).
AI_MAX_TOKENS = 4000
AI_TIMEOUT_SECONDS = 30

_client_instance = None


def _client():
    """The Claude client, created on first use (reads ANTHROPIC_API_KEY)."""
    global _client_instance
    if _client_instance is None:
        _client_instance = anthropic.Anthropic(timeout=AI_TIMEOUT_SECONDS, max_retries=1)
    return _client_instance


logger = logging.getLogger("crossword")

ALPHABETIC = re.compile(r"^[A-Z]+$")


# ---------- filters ----------

def _fits_len(word: str, size: int) -> bool:
    return 3 <= len(word) <= size and bool(ALPHABETIC.match(word))


def _looks_like_fragment(word: str) -> bool:
    """
    Extra strict: reject things like ROBINRC, HSTRY, DECLR, etc.
    """
    w = word.upper()
    vowels = set("AEIOUY")

    # must have a vowel somewhere
    if not any(ch in vowels for ch in w):
        return True

    # bad endings: 2-3 consonants with no vowel
    bad_endings = ("RC", "NRC", "NDR", "LTD", "NTH", "STS", "RDS", "RTS", "NRS")
    for end in bad_endings:
        if w.endswith(end):
            return True

    # explicit bad stems we saw
    bad_suffixes = ("PHARO", "INDEP", "INDP", "DECLR", "HSTRY", "WRLD")
    if w in bad_suffixes:
        return True

    return False


def _sanitize_clues(raw: dict, size: int) -> dict:
    """
    Drop placeholders, blank clues, fragments, and too-long words.
    Trim answers like DIRTYGL → DIRTY.
    """
    clean = {"across": [], "down": []}
    BAD_PLACEHOLDERS = {"(clue)", "clue", "(clues)", "n/a", "na", "none", "[clue]"}

    for direction in ("across", "down"):
        for cl in raw.get(direction, []):
            clue_text = (cl.get("clue") or "").strip()
            if not clue_text or clue_text.lower() in BAD_PLACEHOLDERS:
                continue

            ans = (cl.get("answer") or "").strip().upper()
            ans = re.sub(r"[^A-Z]", "", ans)

            # trim trailing consonant junk (DIRTYGL → DIRTY)
            m = re.match(r"([A-Z]*?[AEIOUY][A-Z]*)", ans)
            if m:
                ans = m.group(1)

            if not _fits_len(ans, size):
                continue
            if _looks_like_fragment(ans):
                continue

            clean[direction].append({"clue": clue_text, "answer": ans})
    return clean


def _build_prompt(theme: Optional[str], num: int, size: int) -> str:
    if theme:
        theme_block = f"""
THEME: "{theme}"
- At least 70% must clearly relate to this theme.
- If a natural themed answer is longer than {size}, CHANGE THE CLUE so the answer is a real word 3–{size} letters long.
"""
    else:
        theme_block = """
THEME: Mixed everyday topics.
"""

    return f"""
Return ONLY valid JSON.

You are an expert crossword constructor. Generate at least {num} strong, simple crossword clue-answer pairs for a {size}x{size} mini crossword.

{theme_block}

RULES:
- Answers: single English words, A–Z only, 3–{size} letters.
- NO fragments or stems (e.g. "INDEP") and NO misspellings.
- NO multi-word, NO punctuation, NO numbers.
- Clues should clearly define the answer.
- Prefer common / kid-friendly words.

FORMAT:
{{
  "across": [
    {{"clue": "Clue text 1", "answer": "WORD1"}}
  ],
  "down": [
    {{"clue": "Clue text 2", "answer": "WORD2"}}
  ]
}}
"""


def _fallback() -> dict:
    return {
        "across": [
            {"clue": "Opposite of old", "answer": "NEW"},
            {"clue": "Color of grass", "answer": "GREEN"},
            {"clue": "Not low", "answer": "HIGH"},
        ],
        "down": [
            {"clue": "Feline pet", "answer": "CAT"},
            {"clue": "Opposite of day", "answer": "NIGHT"},
        ],
    }


def _ask_ai(prompt: str) -> dict:
    """Send one prompt to Claude and return the JSON object in its reply."""
    resp = _client().messages.create(
        model=AI_MODEL,
        max_tokens=AI_MAX_TOKENS,
        messages=[{"role": "user", "content": prompt}],
        output_config={"effort": AI_EFFORT},
    )
    # the reply can contain thinking blocks; only the text blocks hold the answer
    content = "".join(
        block.text for block in resp.content if getattr(block, "type", None) == "text"
    ).strip()
    m = re.search(r"\{.*\}", content, re.DOTALL)
    if m:
        content = m.group(0)
    data = json.loads(content)
    if not isinstance(data, dict):
        raise ValueError("AI reply is not a JSON object")
    return data


def generate_clues(theme: Optional[str], size: int, num: int = 16) -> dict:
    prompt = _build_prompt(theme, num, size)
    for attempt in range(2):
        try:
            clean = _sanitize_clues(_ask_ai(prompt), size)
            if clean["across"] or clean["down"]:
                return clean
            logger.warning("AI reply had no usable words (attempt %d)", attempt + 1)
        except Exception as exc:
            logger.warning("AI word request failed (attempt %d): %r", attempt + 1, exc)
            continue
    logger.error("AI unavailable: using the built-in fallback words")
    return _fallback()


# ---------- clues for the dictionary words in a dense grid ----------

FILL_CLUES_MARKER = "ANSWERS:"


def _build_fill_prompt(answers: List[str], theme: Optional[str]) -> str:
    theme_line = (
        f'The puzzle theme is "{theme}". Relate a clue to the theme only when it fits naturally.'
        if theme else "The puzzle has no special theme."
    )
    example = ", ".join(f'"{a}": "clue"' for a in answers[:2])
    return f"""
Return ONLY valid JSON.

You are an expert crossword constructor. Write one clue for each answer below.
{theme_line}

{FILL_CLUES_MARKER} {", ".join(answers)}

RULES:
- Each clue clearly defines its answer and is at most 8 words.
- Never use the answer word itself (or a form of it) inside its clue.
- Simple, friendly language. No offensive content.

FORMAT (one entry per answer, same spelling as given):
{{{example}}}
"""


def _usable_fill_clue(answer: str, clue) -> bool:
    if not isinstance(clue, str):
        return False
    text = clue.strip()
    if not text or text.lower() in {"clue", "(clue)", "n/a", "none"} or len(text) > 120:
        return False
    return answer.lower() not in re.sub(r"[^a-z]", "", text.lower())


def generate_fill_clues(answers: List[str], theme: Optional[str]) -> Optional[Dict[str, str]]:
    """Ask the AI for a clue for every answer. None if it cannot provide them all."""
    clues: Dict[str, str] = {}
    for attempt in range(2):
        missing = [a for a in answers if a not in clues]
        if not missing:
            break
        try:
            data = _ask_ai(_build_fill_prompt(missing, theme))
        except Exception as exc:
            logger.warning("AI clue request failed (attempt %d): %r", attempt + 1, exc)
            continue
        for key, clue in data.items():
            answer = re.sub(r"[^A-Z]", "", str(key).upper())
            if answer in missing and _usable_fill_clue(answer, clue):
                clues[answer] = clue.strip()
    if any(a not in clues for a in answers):
        return None
    return clues


def _numbered_clues(entries: List[Dict]) -> Dict[str, List[Dict]]:
    """Standard numbering: left to right, top to bottom; an across and a down
    word that start in the same square share one number."""
    starts = sorted({(e["row"], e["col"]) for e in entries})
    number_of = {cell: i + 1 for i, cell in enumerate(starts)}
    clues: Dict[str, List[Dict]] = {"across": [], "down": []}
    for e in sorted(entries, key=lambda e: (e["row"], e["col"])):
        clues[e["dir"]].append({
            "number": number_of[(e["row"], e["col"])],
            "clue": e["clue"],
            "answer": e["answer"],
        })
    return clues


def build_dense_crossword(words: List[Dict[str, str]], theme: Optional[str], size: int):
    """
    A newspaper-style mini: a (nearly) full grid where every letter is part of
    an across word and a down word. Uses the AI's themed words where they fit
    and common dictionary words elsewhere, then asks the AI to clue the
    dictionary words. Returns None if that is not possible.
    """
    if size > MAX_DENSE_SIZE:
        return None
    clue_for = {}
    for w in words:
        clue_for.setdefault(w["answer"], w["clue"])
    seed = zlib.crc32(" ".join(sorted(clue_for)).encode())
    filled = fill_dense(list(clue_for), size, seed=seed)
    if filled is None:
        return None
    grid, entries = filled

    need = [e["answer"] for e in entries if e["answer"] not in clue_for]
    if need:
        extra = generate_fill_clues(need, theme)
        if extra is None:
            logger.warning("Could not get clues for the fill words; using the simple layout")
            return None
        clue_for.update(extra)
    for e in entries:
        e["clue"] = clue_for[e["answer"]]
    return grid, _numbered_clues(entries)


# ---------- simple layout (used when a dense grid is not possible) ----------
#
# Rules that make the result a real crossword:
#   * every word after the first must cross a word that is already there
#   * words never sit side by side or end to end, so the only letter runs in
#     the grid are the words we placed on purpose (no accidental words)
#   * each word keeps the clue it was written for

_EXTRA_TRIES = 60  # extra word orders to try per puzzle (about 0.1s in total)


class _Board:
    def __init__(self, size: int):
        self.size = size
        self.letters: List[List[str]] = [["" for _ in range(size)] for _ in range(size)]
        # which cells already belong to an across / a down word
        self.used = {
            "across": [[False] * size for _ in range(size)],
            "down": [[False] * size for _ in range(size)],
        }
        self.placed: List[Dict] = []
        self.crossings = 0

    def _filled(self, row: int, col: int) -> bool:
        return 0 <= row < self.size and 0 <= col < self.size and self.letters[row][col] != ""

    def count_crossings(self, word: str, dir_: str, row: int, col: int) -> Optional[int]:
        """How many existing words this placement would cross, or None if it is not allowed."""
        dr, dc = (0, 1) if dir_ == "across" else (1, 0)
        end_row = row + dr * (len(word) - 1)
        end_col = col + dc * (len(word) - 1)
        if row < 0 or col < 0 or end_row >= self.size or end_col >= self.size:
            return None
        # the squares just before and just after the word must be free
        if self._filled(row - dr, col - dc) or self._filled(end_row + dr, end_col + dc):
            return None

        crossings = 0
        for i, ch in enumerate(word):
            r, c = row + dr * i, col + dc * i
            existing = self.letters[r][c]
            if existing:
                # may only reuse a letter of a word running the other way
                if existing != ch or self.used[dir_][r][c]:
                    return None
                crossings += 1
            elif self._filled(r + dc, c + dr) or self._filled(r - dc, c - dr):
                # a new letter must not touch another word sideways
                return None
        return crossings

    def place(self, entry: Dict[str, str], dir_: str, row: int, col: int, crossings: int = 0):
        word = entry["answer"]
        dr, dc = (0, 1) if dir_ == "across" else (1, 0)
        for i, ch in enumerate(word):
            r, c = row + dr * i, col + dc * i
            self.letters[r][c] = ch
            self.used[dir_][r][c] = True
        self.placed.append(
            {"dir": dir_, "row": row, "col": col, "clue": entry["clue"], "answer": word}
        )
        self.crossings += crossings

    def best_spot(self, word: str) -> Optional[Tuple[int, str, int, int]]:
        """The legal position with the most crossings: (crossings, dir, row, col)."""
        best: Optional[Tuple[int, str, int, int]] = None
        for dir_ in ("across", "down"):
            for row in range(self.size):
                for col in range(self.size):
                    n = self.count_crossings(word, dir_, row, col)
                    if n and (best is None or n > best[0]):
                        best = (n, dir_, row, col)
        return best


def _layout(order: List[Dict[str, str]], size: int) -> _Board:
    """Build one candidate puzzle: order[0] goes in the top row, the rest are
    added in order wherever they cross best."""
    board = _Board(size)
    first = order[0]
    board.place(first, "across", 0, (size - len(first["answer"])) // 2)

    pending = order[1:]
    progress = True
    while pending and progress:  # retry skipped words: new words open new spots
        progress = False
        still_pending = []
        for entry in pending:
            spot = board.best_spot(entry["answer"])
            if spot:
                n, dir_, row, col = spot
                board.place(entry, dir_, row, col, n)
                progress = True
            else:
                still_pending.append(entry)
        pending = still_pending
    return board


def build_crossword_from_words(words: List[Dict[str, str]], size: int = 7):
    # keep only words that fit, and only the first copy of a repeated answer
    seen = set()
    usable: List[Dict[str, str]] = []
    for w in words:
        answer = w["answer"]
        if answer in seen or not (1 <= len(answer) <= size):
            continue
        seen.add(answer)
        usable.append(w)

    if not usable:
        return [["#"] * size for _ in range(size)], {"across": [], "down": []}

    # Try several word orders and keep the puzzle with the most words (ties:
    # most crossings, then the earliest try). First: longest word first, with
    # each word in turn as the starting word. Then a fixed set of shuffles;
    # the fixed seed means the same words always give the same puzzle.
    usable.sort(key=lambda w: len(w["answer"]), reverse=True)
    orders = [[usable[i]] + usable[:i] + usable[i + 1:] for i in range(len(usable))]
    rng = random.Random(0)
    for _ in range(_EXTRA_TRIES):
        shuffled = usable[:]
        rng.shuffle(shuffled)
        orders.append(shuffled)

    best: Optional[_Board] = None
    for order in orders:
        board = _layout(order, size)
        if best is None or (len(board.placed), board.crossings) > (len(best.placed), best.crossings):
            best = board

    grid = [[cell or "#" for cell in row] for row in best.letters]

    return grid, _numbered_clues(best.placed)


# ---------- public entrypoint ----------

def generate_crossword(theme: Optional[str] = None, size: int = 5):
    """
    Returns {"grid", "clues", "fallback"}. "fallback" is True when the AI was
    unavailable and the built-in words were used (such a puzzle should not be
    kept and shown to everyone for the rest of the day).
    """
    # ask for plenty of themed words: the more there are, the more fit the grid
    raw = generate_clues(theme, size, num=30)
    words_pool = raw["across"] + raw["down"]
    if not words_pool:
        return {"error": "Could not generate clues."}
    used_fallback = raw == _fallback()

    # 1) newspaper-style dense grid (needs the AI for the extra clues)
    if not used_fallback:
        dense = build_dense_crossword(words_pool, theme, size)
        if dense is not None:
            grid, final_clues = dense
            return {"grid": grid, "clues": final_clues, "fallback": False}

    # 2) simple layout: only the AI's (or the built-in) words, crossing each other
    grid, final_clues = build_crossword_from_words(words_pool, size=size)
    return {
        "grid": grid,
        "clues": final_clues,
        "fallback": used_fallback,
    }
