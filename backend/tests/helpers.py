"""Small helpers for checking that a generated crossword is a valid one."""
from typing import Dict, List, Tuple

Run = Tuple[str, int, int, str]  # (direction, row, col, letters)


def pool(*pairs) -> List[Dict[str, str]]:
    """pool(("CAT", "Feline pet"), ...) -> the word list the builder expects."""
    return [{"answer": a, "clue": c} for a, c in pairs]


def letter_runs(grid: List[List[str]], min_len: int = 2) -> List[Run]:
    """Every horizontal and vertical run of letters in the grid."""
    size = len(grid)
    runs: List[Run] = []
    for r in range(size):
        c = 0
        while c < size:
            if grid[r][c] != "#":
                start = c
                while c < size and grid[r][c] != "#":
                    c += 1
                if c - start >= min_len:
                    runs.append(("across", r, start, "".join(grid[r][start:c])))
            else:
                c += 1
    for c in range(size):
        r = 0
        while r < size:
            if grid[r][c] != "#":
                start = r
                while r < size and grid[r][c] != "#":
                    r += 1
                if r - start >= min_len:
                    runs.append(
                        ("down", start, c, "".join(grid[i][c] for i in range(start, r)))
                    )
            else:
                r += 1
    return runs


def expected_numbers(grid: List[List[str]]) -> Dict[Tuple[int, int], int]:
    """
    Standard crossword numbering: scan left-to-right, top-to-bottom; a cell gets
    the next number if a word of 3+ letters starts there (across, down or both).
    A cell that starts both an across and a down word has ONE number.
    """
    starts = {(r, c) for _, r, c, w in letter_runs(grid, min_len=3)}
    return {cell: i + 1 for i, cell in enumerate(sorted(starts))}


SPACE = pool(
    ("PLANET", "Orbits a star"), ("ROCKET", "Launch vehicle"), ("STAR", "Sun, e.g."),
    ("MOON", "Earth's satellite"), ("ORBIT", "Path around a planet"),
    ("COMET", "Icy visitor"), ("MARS", "The red planet"), ("NASA", "US space agency"),
    ("EARTH", "Our home"), ("VENUS", "Second planet"), ("ALIEN", "Visitor from afar"),
    ("NOVA", "Exploding star"), ("LUNAR", "Of the moon"), ("SPACE", "Final frontier"),
)

ANIMALS = pool(
    ("TIGER", "Striped cat"), ("HORSE", "It gallops"), ("EAGLE", "Bird of prey"),
    ("SNAKE", "It slithers"), ("OTTER", "River swimmer"), ("CAT", "Feline pet"),
    ("DOG", "Loyal pet"), ("OWL", "Nocturnal bird"), ("RAT", "Small rodent"),
    ("GOAT", "Bearded farm animal"), ("LION", "King of the jungle"),
    ("BEAR", "Honey lover"), ("WOLF", "Pack hunter"), ("DEER", "Has antlers"),
)

FOOD = pool(
    ("BREAD", "Baked loaf"), ("APPLE", "Keeps the doctor away"), ("RICE", "Sushi base"),
    ("PASTA", "Italian staple"), ("SALAD", "Leafy dish"), ("EGG", "Breakfast item"),
    ("TEA", "Hot drink"), ("PIE", "Baked dessert"), ("SOUP", "Served in a bowl"),
    ("CAKE", "Birthday treat"), ("MILK", "Dairy drink"), ("CORN", "Grows on a cob"),
)

REALISTIC_POOLS = {"space": SPACE, "animals": ANIMALS, "food": FOOD}
