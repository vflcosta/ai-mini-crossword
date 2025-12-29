import os
import json
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

def _empty_grid(size: int) -> List[List[str]]:
    return [["" for _ in range(size)] for _ in range(size)]


def _can_place_across(grid: List[List[str]], word: str, row: int, col: int) -> bool:
    size = len(grid)
    if col + len(word) > size:
        return False
    if col > 0 and grid[row][col - 1] not in ("", "#"):
        return False
    if col + len(word) < size and grid[row][col + len(word)] not in ("", "#"):
        return False
    for i, ch in enumerate(word):
        cell = grid[row][col + i]
        if cell not in ("", ch):
            return False
    return True


def _place_across(grid: List[List[str]], word: str, row: int, col: int):
    for i, ch in enumerate(word):
        grid[row][col + i] = ch


def _can_place_down(grid: List[List[str]], word: str, row: int, col: int) -> bool:
    size = len(grid)
    if row + len(word) > size:
        return False
    if row > 0 and grid[row - 1][col] not in ("", "#"):
        return False
    if row + len(word) < size and grid[row + len(word)][col] not in ("", "#"):
        return False
    for i, ch in enumerate(word):
        cell = grid[row + i][col]
        if cell not in ("", ch):
            return False
    return True


def _place_down(grid: List[List[str]], word: str, row: int, col: int):
    for i, ch in enumerate(word):
        grid[row + i][col] = ch


def _find_best_crossing_spots(grid: List[List[str]], word: str) -> List[Tuple[str, int, int, int]]:
    """
    Return list of (score, dir, row, col) for where this word could cross.
    """
    size = len(grid)
    candidates: List[Tuple[int, str, int, int]] = []
    letters = list(word)

    # across
    for r in range(size):
      for c in range(size - len(word) + 1):
        score = 0
        ok = True
        for i, ch in enumerate(letters):
          cell = grid[r][c + i]
          if cell == ch:
            score += 1
          elif cell not in ("", "#"):
            ok = False
            break
        if ok and score > 0 and _can_place_across(grid, word, r, c):
          candidates.append((score, "across", r, c))

    # down
    for c in range(size):
      for r in range(size - len(word) + 1):
        score = 0
        ok = True
        for i, ch in enumerate(letters):
          cell = grid[r + i][c]
          if cell == ch:
            score += 1
          elif cell not in ("", "#"):
            ok = False
            break
        if ok and score > 0 and _can_place_down(grid, word, r, c):
          candidates.append((score, "down", r, c))

    candidates.sort(key=lambda x: x[0], reverse=True)
    return candidates


def build_crossword_from_words(words: List[Dict[str, str]], size: int = 7):
    grid = _empty_grid(size)
    placed: List[Dict[str, str]] = []

    if not words:
        return grid, {"across": [], "down": []}

    # sort by length desc
    words_sorted = sorted(words, key=lambda w: len(w["answer"]), reverse=True)

    # place first word across in the TOP row (so your UI doesn't show gaps in row 0)
    first = words_sorted[0]
    first_word = first["answer"]
    start_col = (size - len(first_word)) // 2 if len(first_word) <= size else 0
    row = 0
    _place_across(grid, first_word, row, start_col)
    placed.append(
        {"dir": "across", "row": row, "col": start_col,
         "clue": first["clue"], "answer": first_word}
    )

    # place the rest
    for w in words_sorted[1:]:
        word = w["answer"]
        # try to cross
        spots = _find_best_crossing_spots(grid, word)
        placed_flag = False
        for score, dir_, r, c in spots:
            if dir_ == "across" and _can_place_across(grid, word, r, c):
                _place_across(grid, word, r, c)
                placed.append(
                    {"dir": "across", "row": r, "col": c,
                     "clue": w["clue"], "answer": word}
                )
                placed_flag = True
                break
            elif dir_ == "down" and _can_place_down(grid, word, r, c):
                _place_down(grid, word, r, c)
                placed.append(
                    {"dir": "down", "row": r, "col": c,
                     "clue": w["clue"], "answer": word}
                )
                placed_flag = True
                break

        if placed_flag:
            continue

        # fallback: scan across
        simple = False
        for rr in range(size):
            for cc in range(size - len(word) + 1):
                if _can_place_across(grid, word, rr, cc):
                    _place_across(grid, word, rr, cc)
                    placed.append(
                        {"dir": "across", "row": rr, "col": cc,
                         "clue": w["clue"], "answer": word}
                    )
                    simple = True
                    break
            if simple:
                break

        if not simple:
            for cc in range(size):
                for rr in range(size - len(word) + 1):
                    if _can_place_down(grid, word, rr, cc):
                        _place_down(grid, word, rr, cc)
                        placed.append(
                            {"dir": "down", "row": rr, "col": cc,
                             "clue": w["clue"], "answer": word}
                        )
                        simple = True
                        break
                if simple:
                    break

    # fill empties with '#'
    for r in range(size):
        for c in range(size):
            if not grid[r][c]:
                grid[r][c] = "#"

    # renumber with length>=3 only
    num = 1
    across_final = []
    down_final = []

    for r in range(size):
        for c in range(size):
            if grid[r][c] == "#":
                continue

            # across start?
            starts_across = (c == 0 or grid[r][c - 1] == "#") and (c + 1 < size and grid[r][c + 1] != "#")
            if starts_across:
                # read word
                letters = []
                cc = c
                while cc < size and grid[r][cc] != "#":
                    letters.append(grid[r][cc])
                    cc += 1
                if len(letters) >= 3:
                    across_final.append({
                        "number": num,
                        "clue": _find_clue_for_placed(placed, "across", r, c),
                        "answer": "".join(letters),
                    })
                    num += 1

            # down start?
            starts_down = (r == 0 or grid[r - 1][c] == "#") and (r + 1 < size and grid[r + 1][c] != "#")
            if starts_down:
                letters = []
                rr = r
                while rr < size and grid[rr][c] != "#":
                    letters.append(grid[rr][c])
                    rr += 1
                if len(letters) >= 3:
                    down_final.append({
                        "number": num,
                        "clue": _find_clue_for_placed(placed, "down", r, c),
                        "answer": "".join(letters),
                    })
                    num += 1

    return grid, {"across": across_final, "down": down_final}


def _find_clue_for_placed(placed: List[Dict[str, str]], dir_: str, row: int, col: int) -> str:
    """
    Loosened matcher:
    - match on (dir, row, col) ONLY
    - if not found, give simple fallback
    """
    for p in placed:
        if p["dir"] == dir_ and p["row"] == row and p["col"] == col:
            return p["clue"]
    return "Clue to fill"


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