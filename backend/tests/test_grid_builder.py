"""
The rules every generated crossword must obey, whatever words the AI gives us.

Tests marked @known_bug describe correct behaviour that the generator does not
have yet (see conftest.known_bug). Everything else must pass on every push.
"""
import re

import pytest

from utils.crossword_gen import build_crossword_from_words

from .conftest import known_bug
from .helpers import REALISTIC_POOLS, expected_numbers, letter_runs, pool

CELL = re.compile(r"^(#|[A-Z])$")


def build_all(size=7):
    """Build one puzzle per realistic word list (only words that fit the grid,
    which is what the app guarantees before building)."""
    for name, all_words in REALISTIC_POOLS.items():
        words = [w for w in all_words if len(w["answer"]) <= size]
        grid, clues = build_crossword_from_words(words, size=size)
        yield name, words, grid, clues


# ---------- simple puzzles: these work today and must keep working ----------

def test_two_crossing_words():
    grid, clues = build_crossword_from_words(
        pool(("CAT", "Feline pet"), ("TEA", "Hot drink")), size=5
    )
    assert grid == [
        ["#", "C", "A", "T", "#"],
        ["#", "#", "#", "E", "#"],
        ["#", "#", "#", "A", "#"],
        ["#", "#", "#", "#", "#"],
        ["#", "#", "#", "#", "#"],
    ]
    assert clues == {
        "across": [{"number": 1, "clue": "Feline pet", "answer": "CAT"}],
        "down": [{"number": 2, "clue": "Hot drink", "answer": "TEA"}],
    }


def test_three_words_each_keep_their_own_clue():
    grid, clues = build_crossword_from_words(
        pool(("OCEAN", "Big blue"), ("CORAL", "Reef builder"), ("NET", "Fishing tool")),
        size=5,
    )
    assert clues["across"] == [{"number": 1, "clue": "Big blue", "answer": "OCEAN"}]
    assert clues["down"] == [
        {"number": 2, "clue": "Reef builder", "answer": "CORAL"},
        {"number": 3, "clue": "Fishing tool", "answer": "NET"},
    ]


def test_longest_word_goes_first_in_the_top_row():
    grid, _ = build_crossword_from_words(
        pool(("TEA", "Hot drink"), ("PLANT", "It grows")), size=5
    )
    assert "".join(grid[0]) == "PLANT"


def test_word_with_no_room_is_left_out_instead_of_crashing():
    words = pool(("AAAAA", "Filler 1"), ("BBBBB", "Filler 2"), ("CCCCC", "Filler 3"),
                 ("DDDDD", "Filler 4"), ("EEEEE", "Filler 5"), ("ZZZ", "No room left"))
    grid, _ = build_crossword_from_words(words, size=5)
    assert not any("Z" in row for row in grid)


def test_duplicate_answers_from_the_ai_appear_only_once():
    words = pool(("PLANT", "It grows"), ("TREE", "Has a trunk"),
                 ("TREE", "Tall plant"), ("LEAF", "Part of a tree"))
    _, clues = build_crossword_from_words(words, size=5)
    answers = [c["answer"] for d in ("across", "down") for c in clues[d]]
    assert sorted(answers) == ["LEAF", "PLANT", "TREE"]


def test_no_words_gives_an_empty_puzzle():
    grid, clues = build_crossword_from_words([], size=5)
    assert len(grid) == 5
    assert clues == {"across": [], "down": []}


# ---------- rules that already hold for realistic puzzles ----------

@pytest.mark.parametrize("size", [5, 6, 7])
def test_grid_is_square_and_contains_only_letters_or_blocks(size):
    for name, _, grid, _ in build_all(size):
        assert len(grid) == size, name
        for row in grid:
            assert len(row) == size, name
            for cell in row:
                assert CELL.match(cell), f"{name}: bad cell {cell!r}"


@pytest.mark.parametrize("size", [5, 7])
def test_every_clue_answer_can_be_read_in_the_grid(size):
    for name, _, grid, clues in build_all(size):
        in_grid = {(d, w) for d, _, _, w in letter_runs(grid, min_len=3)}
        for direction in ("across", "down"):
            for clue in clues[direction]:
                assert (direction, clue["answer"]) in in_grid, f"{name}: {clue}"


@pytest.mark.parametrize("size", [5, 7])
def test_every_word_in_the_grid_has_a_clue(size):
    for name, _, grid, clues in build_all(size):
        for direction in ("across", "down"):
            words_in_grid = sorted(w for d, _, _, w in letter_runs(grid, 3) if d == direction)
            answers = sorted(c["answer"] for c in clues[direction])
            assert words_in_grid == answers, f"{name} {direction}"


@pytest.mark.parametrize("size", [5, 7])
def test_puzzle_has_a_playable_number_of_clues(size):
    for name, _, _, clues in build_all(size):
        assert len(clues["across"]) + len(clues["down"]) >= 4, name


def test_same_words_always_give_the_same_puzzle():
    first = [(g, c) for _, _, g, c in build_all()]
    second = [(g, c) for _, _, g, c in build_all()]
    assert first == second


# ---------- rules the generator breaks today ----------

@known_bug("words get stacked side by side, so the puzzle contains made-up "
           "answers like PLANETL or PROCEVA that the AI never gave")
def test_every_answer_is_a_real_word_from_the_ai():
    for name, words, _, clues in build_all():
        allowed = {w["answer"] for w in words}
        for direction in ("across", "down"):
            for clue in clues[direction]:
                assert clue["answer"] in allowed, f"{name}: made-up answer {clue['answer']}"


@known_bug("accidental words get the placeholder text 'Clue to fill'")
def test_no_placeholder_clues():
    for name, _, _, clues in build_all():
        for direction in ("across", "down"):
            for clue in clues[direction]:
                assert clue["clue"] != "Clue to fill", f"{name}: {clue}"


@known_bug("a clue can end up attached to a different answer than the one it was written for")
def test_each_clue_stays_with_its_own_answer():
    for name, words, _, clues in build_all():
        clue_for = {w["answer"]: w["clue"] for w in words}
        for direction in ("across", "down"):
            for clue in clues[direction]:
                if clue["answer"] in clue_for:
                    assert clue["clue"] == clue_for[clue["answer"]], f"{name}: {clue}"
                else:
                    pytest.fail(f"{name}: '{clue['clue']}' is attached to {clue['answer']}")


@known_bug("neighbouring words touch and create stray two-letter pairs that are not words")
def test_no_stray_two_letter_pairs():
    words = pool(("GREEN", "Color of grass"), ("NIGHT", "Opposite of day"),
                 ("HIGH", "Not low"), ("NEW", "Opposite of old"), ("CAT", "Feline pet"))
    grid, _ = build_crossword_from_words(words, size=7)
    stray = [w for _, _, _, w in letter_runs(grid, min_len=2) if len(w) == 2]
    assert stray == []


@known_bug("when an across and a down word start in the same square they get "
           "two different numbers instead of sharing one")
def test_across_and_down_starting_in_the_same_square_share_a_number():
    grid, clues = build_crossword_from_words(
        pool(("CAT", "Feline pet"), ("COW", "It moos")), size=5
    )
    assert clues["across"][0]["number"] == clues["down"][0]["number"] == 1


@known_bug("clue numbers do not follow standard crossword numbering")
def test_clue_numbers_follow_standard_crossword_numbering():
    for name, _, grid, clues in build_all():
        numbers = expected_numbers(grid)
        starts = {(d, w): (r, c) for d, r, c, w in letter_runs(grid, 3)}
        for direction in ("across", "down"):
            for clue in clues[direction]:
                cell = starts[(direction, clue["answer"])]
                assert clue["number"] == numbers[cell], f"{name}: {clue}"
