"""
Dense "newspaper mini" grids.

A mini crossword is a small square where almost every cell is a letter and
every letter belongs to both an across word and a down word. Filling such a
grid needs far more words than the AI's themed list, so we combine:

  * the AI's themed words (used wherever they fit), and
  * a dictionary of common English words (data/words.txt) for the rest.

The result is a filled grid plus the list of words in it. Clues for the
dictionary words are written afterwards by the AI (see crossword_gen).
"""
import random
from functools import lru_cache
from pathlib import Path
from typing import Dict, FrozenSet, List, Optional, Sequence, Tuple

Cell = Tuple[int, int]
Slot = Tuple[str, int, int, int]  # (direction, row, col, length)

WORDS_FILE = Path(__file__).resolve().parent.parent / "data" / "words.txt"
MIN_WORD = 3
MAX_DENSE_SIZE = 5          # larger grids cannot be filled reliably; they use the simple layout
_MAX_TIER = 35              # skip rarer dictionary words when filling
_ATTEMPTS = 300             # different layouts/starts tried per puzzle (about 0.3s in total)
_NODE_LIMIT = 150           # search steps allowed per attempt


# ---------- dictionary ----------

@lru_cache(maxsize=1)
def load_dictionary() -> Dict[str, int]:
    """word -> commonness tier (10 = very common ... 40 = less common)."""
    words: Dict[str, int] = {}
    with open(WORDS_FILE, encoding="utf-8") as fh:
        for line in fh:
            parts = line.split()
            if len(parts) == 2:
                words[parts[0]] = int(parts[1])
    return words


# ---------- grid layouts (where the black squares go) ----------

def _runs(size: int, blacks: FrozenSet[Cell]) -> List[Slot]:
    slots: List[Slot] = []
    for r in range(size):
        c = 0
        while c < size:
            if (r, c) in blacks:
                c += 1
                continue
            start = c
            while c < size and (r, c) not in blacks:
                c += 1
            slots.append(("across", r, start, c - start))
    for c in range(size):
        r = 0
        while r < size:
            if (r, c) in blacks:
                r += 1
                continue
            start = r
            while r < size and (r, c) not in blacks:
                r += 1
            slots.append(("down", start, c, r - start))
    return slots


def _connected(size: int, blacks: FrozenSet[Cell]) -> bool:
    whites = {(r, c) for r in range(size) for c in range(size)} - blacks
    if not whites:
        return False
    stack = [next(iter(whites))]
    seen = set(stack)
    while stack:
        r, c = stack.pop()
        for nxt in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
            if nxt in whites and nxt not in seen:
                seen.add(nxt)
                stack.append(nxt)
    return len(seen) == len(whites)


@lru_cache(maxsize=None)
def layouts(size: int) -> Tuple[FrozenSet[Cell], ...]:
    """
    All newspaper-style layouts for a grid: black squares are placed in
    mirrored pairs (the grid looks the same upside down), every word has at
    least 3 letters, and all white squares are connected.
    """
    max_pairs = {3: 0, 4: 1, 5: 3}.get(size, 0)
    cells = [(r, c) for r in range(size) for c in range(size)]
    half = [cell for cell in cells if cell < (size - 1 - cell[0], size - 1 - cell[1])]
    found: List[FrozenSet[Cell]] = []

    def valid(blacks: FrozenSet[Cell]) -> bool:
        return all(s[3] >= MIN_WORD for s in _runs(size, blacks)) and _connected(size, blacks)

    def extend(start: int, chosen: List[Cell]):
        blacks = frozenset(chosen + [(size - 1 - r, size - 1 - c) for r, c in chosen])
        if valid(blacks):
            found.append(blacks)
        if len(chosen) == max_pairs:
            return
        for i in range(start, len(half)):
            extend(i + 1, chosen + [half[i]])

    extend(0, [])
    return tuple(found)


# ---------- filling ----------

class _WordIndex:
    """Candidate words for one puzzle, indexed for fast pattern matching."""

    def __init__(self, theme: Sequence[str], size: int, rng: random.Random):
        dictionary = load_dictionary()
        self.theme = set(theme)
        self.by_len: Dict[int, List[str]] = {}
        self.themed_mask: Dict[int, int] = {}
        # (length, position, letter) -> bitmask of the words that match
        self.index: Dict[Tuple[int, int, str], int] = {}
        for n in range(MIN_WORD, size + 1):
            themed = [w for w in theme if len(w) == n]
            # common words first; shuffled inside each tier so puzzles vary
            rest = [w for w in dictionary
                    if len(w) == n and w not in self.theme and dictionary[w] <= _MAX_TIER]
            rng.shuffle(rest)
            rest.sort(key=lambda w: dictionary[w])
            words = themed + rest
            self.by_len[n] = words
            self.themed_mask[n] = (1 << len(themed)) - 1
            for i, word in enumerate(words):
                bit = 1 << i
                for pos, ch in enumerate(word):
                    key = (n, pos, ch)
                    self.index[key] = self.index.get(key, 0) | bit
        self.all_mask = {n: (1 << len(words)) - 1 for n, words in self.by_len.items()}


class _Filler:
    def __init__(self, size: int, blacks: FrozenSet[Cell], words: _WordIndex,
                 rng: random.Random):
        self.size = size
        self.blacks = blacks
        self.words = words
        self.rng = rng
        self.slots = _runs(size, blacks)
        self.slot_cells = [self._cells(s) for s in self.slots]
        self.grid: List[List[str]] = [["" for _ in range(size)] for _ in range(size)]
        self.assigned: Dict[int, str] = {}
        self.used: set = set()
        self.nodes = 0
        # which slots pass through each cell
        self.cell_slots: Dict[Cell, List[int]] = {}
        for i, cells in enumerate(self.slot_cells):
            for cell in cells:
                self.cell_slots.setdefault(cell, []).append(i)

    @staticmethod
    def _cells(slot: Slot) -> List[Cell]:
        d, r, c, n = slot
        return [(r, c + i) if d == "across" else (r + i, c) for i in range(n)]

    def _mask(self, i: int) -> int:
        n = self.slots[i][3]
        mask = self.words.all_mask[n]
        index = self.words.index
        for pos, (r, c) in enumerate(self.slot_cells[i]):
            ch = self.grid[r][c]
            if ch:
                mask &= index.get((n, pos, ch), 0)
                if not mask:
                    return 0
        return mask

    def _take(self, n: int, mask: int, limit: int) -> List[str]:
        words = self.words.by_len[n]
        out = []
        while mask and len(out) < limit:
            low = mask & -mask
            word = words[low.bit_length() - 1]
            if word not in self.used:
                out.append(word)
            mask ^= low
        return out

    def _candidates(self, i: int, mask: int) -> List[str]:
        """Themed words first, then the most common matches in a random order."""
        n = self.slots[i][3]
        themed_mask = self.words.themed_mask[n]
        themed = self._take(n, mask & themed_mask, 12)
        self.rng.shuffle(themed)
        common = self._take(n, mask & ~themed_mask, 24)
        self.rng.shuffle(common)
        return themed + common

    def _put(self, i: int, word: str) -> List[Cell]:
        changed = []
        for (r, c), ch in zip(self.slot_cells[i], word):
            if not self.grid[r][c]:
                self.grid[r][c] = ch
                changed.append((r, c))
        self.assigned[i] = word
        self.used.add(word)
        return changed

    def _undo(self, i: int, changed: List[Cell]):
        for r, c in changed:
            self.grid[r][c] = ""
        self.used.discard(self.assigned.pop(i))

    def seed_theme(self, target: int) -> int:
        """
        Before the main search, drop up to `target` themed words into slots
        where they fit and still leave a possible word for every other slot.
        Returns how many were placed.
        """
        words = self.words
        options = []
        for i, slot in enumerate(self.slots):
            n = slot[3]
            for k in range(bin(words.themed_mask[n]).count("1")):
                options.append((i, words.by_len[n][k], 1 << k))
        self.rng.shuffle(options)

        placed = 0
        for i, word, bit in options:
            if placed >= target:
                break
            if i in self.assigned or word in self.used or not (self._mask(i) & bit):
                continue
            changed = self._put(i, word)
            if all(self._mask(j) for j in range(len(self.slots)) if j not in self.assigned):
                placed += 1
            else:
                self._undo(i, changed)
        return placed

    def solve(self) -> bool:
        if self.nodes > _NODE_LIMIT:
            return False
        self.nodes += 1
        # pick the open slot with the fewest possible words
        best_i, best_mask, best_count = -1, 0, None
        for i in range(len(self.slots)):
            if i in self.assigned:
                continue
            mask = self._mask(i)
            if not mask:
                return False
            count = bin(mask).count("1")
            if best_count is None or count < best_count:
                best_i, best_mask, best_count = i, mask, count
        if best_i < 0:
            return True  # every slot is filled

        for word in self._candidates(best_i, best_mask):
            changed = self._put(best_i, word)
            # a slot completed by its crossings must itself be a new, real word
            ok = True
            completed: List[int] = []
            for cell in changed:
                for j in self.cell_slots[cell]:
                    if j in self.assigned:
                        continue
                    cells = self.slot_cells[j]
                    if all(self.grid[r][c] for r, c in cells):
                        text = "".join(self.grid[r][c] for r, c in cells)
                        if text in self.used or not self._mask(j):
                            ok = False
                            break
                        completed.append(j)
                        self.assigned[j] = text
                        self.used.add(text)
                if not ok:
                    break
            if ok and self.solve():
                return True
            for j in completed:
                self.used.discard(self.assigned.pop(j))
            self._undo(best_i, changed)
        return False


def fill_dense(theme_words: Sequence[str], size: int, seed: int = 0):
    """
    Build a dense mini grid.

    Returns (grid, entries) where grid uses "#" for black squares and entries is
    a list of {"dir", "row", "col", "answer", "themed"}; or None if no grid
    could be filled (the caller then falls back to a simpler puzzle).
    """
    if size < MIN_WORD or size > MAX_DENSE_SIZE:
        return None
    options = layouts(size)
    if not options:
        return None

    dictionary = load_dictionary()
    theme = [w for w in dict.fromkeys(theme_words) if MIN_WORD <= len(w) <= size]
    rng = random.Random(seed)
    index = _WordIndex(theme, size, rng)
    best = None
    best_score = None

    for attempt in range(_ATTEMPTS):
        blacks = rng.choice(options)
        filler = _Filler(size, blacks, index, rng)
        # aim for 4, 3, 2 ... themed words in turn: ambitious grids fail more
        # often, so the modest ones guarantee we still get a puzzle
        if theme:
            filler.seed_theme(target=4 - attempt % 4)
        if not filler.solve():
            continue
        words = list(filler.assigned.values())
        themed = sum(1 for w in words if w in index.theme)
        common = sum(1 for w in words if dictionary.get(w, 99) <= 20 or w in index.theme)
        score = (themed, common, -len(blacks))
        if best_score is None or score > best_score:
            best_score, best = score, filler

    if best is None:
        return None

    grid = [[best.grid[r][c] or "#" for c in range(size)] for r in range(size)]
    entries = []
    for i, (d, r, c, _n) in enumerate(best.slots):
        word = best.assigned[i]
        entries.append({"dir": d, "row": r, "col": c, "answer": word,
                        "themed": word in index.theme})
    return grid, entries
