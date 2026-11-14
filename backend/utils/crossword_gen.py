import os
import json
import random
import re
from typing import Optional, List, Dict, Tuple
from dotenv import load_dotenv
import openai

# Load OpenAI API key
load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

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


def generate_clues(theme: Optional[str], size: int, num: int = 16) -> dict:
    prompt = _build_prompt(theme, num, size)
    for _ in range(2):
        try:
            resp = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.4,
            )
            content = resp.choices[0].message.content.strip()
            m = re.search(r"\{.*\}", content, re.DOTALL)
            if m:
                content = m.group(0)
            data = json.loads(content)
            clean = _sanitize_clues(data, size)
            if clean["across"] or clean["down"]:
                return clean
        except Exception:
            continue
    return _fallback()


# ---------- placement engine ----------
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

    # standard numbering: left to right, top to bottom; an across and a down
    # word that start in the same square share one number
    starts = sorted({(p["row"], p["col"]) for p in best.placed})
    number_of = {cell: i + 1 for i, cell in enumerate(starts)}

    clues: Dict[str, List[Dict]] = {"across": [], "down": []}
    for p in sorted(best.placed, key=lambda p: (p["row"], p["col"])):
        clues[p["dir"]].append({
            "number": number_of[(p["row"], p["col"])],
            "clue": p["clue"],
            "answer": p["answer"],
        })
    return grid, clues


# ---------- public entrypoint ----------

def generate_crossword(theme: Optional[str] = None, size: int = 7):
    raw = generate_clues(theme, size, num=18)
    # pool everything; placement will decide orientation
    words_pool = raw["across"] + raw["down"]
    if not words_pool:
        return {"error": "Could not generate clues."}

    grid, final_clues = build_crossword_from_words(words_pool, size=size)
    return {
        "grid": grid,
        "clues": final_clues,
    }