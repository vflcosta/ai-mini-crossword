"""
The newspaper-style mini: a (nearly) full 5x5 grid where every letter belongs
to an across word and a down word.
"""
import re

import pytest

from utils import crossword_gen
from utils.crossword_gen import _fallback, generate_crossword
from utils.dense_fill import MAX_DENSE_SIZE, fill_dense, layouts, load_dictionary

from .helpers import REALISTIC_POOLS, letter_runs

THEMES = {name: [w["answer"] for w in words] for name, words in REALISTIC_POOLS.items()}
OCEAN = [("OCEAN", "Vast body of salt water"), ("WAVE", "Surfer's ride"), ("FISH", "It has gills"),
         ("CORAL", "Reef builder"), ("SHARK", "Jaws, for one"), ("WHALE", "Largest sea mammal"),
         ("TIDE", "It rises and falls daily"), ("SAND", "Beach covering"), ("REEF", "Ridge under the sea"),
         ("SHIP", "Large seagoing vessel"), ("SAIL", "It catches the wind"), ("CRAB", "Sideways walker"),
         ("SEAL", "Barking swimmer"), ("KELP", "Giant seaweed"), ("SALT", "Sea water has lots of it"),
         ("BEACH", "Sandy shore"), ("SHELL", "Seaside souvenir"), ("SWIM", "Do laps"),
         ("DIVE", "Plunge in"), ("BOAT", "Small vessel"), ("PORT", "Harbor town"), ("EEL", "Snakelike fish")]


# ---------- the dictionary ----------

def test_dictionary_holds_thousands_of_clean_common_words():
    words = load_dictionary()
    assert len(words) > 10000
    for word, tier in words.items():
        assert re.fullmatch(r"[A-Z]{3,7}", word), word
        assert tier in (10, 20, 35, 40), word
    for common in ("CAT", "TREE", "HOUSE", "WATER"):
        assert common in words


# ---------- layouts (where black squares go) ----------

@pytest.mark.parametrize("size", [3, 4, 5])
def test_layouts_follow_newspaper_rules(size):
    options = layouts(size)
    assert options, "there must be at least one layout"
    for blacks in options:
        grid = [["#" if (r, c) in blacks else "A" for c in range(size)] for r in range(size)]
        # no one- or two-letter words anywhere
        assert all(len(w) >= 3 for _, _, _, w in letter_runs(grid, min_len=1))
        # looks the same upside down
        assert {(size - 1 - r, size - 1 - c) for r, c in blacks} == set(blacks)
        # mostly letters
        assert len(blacks) <= 6


def test_a_5x5_can_have_between_zero_and_six_black_squares():
    assert {len(b) for b in layouts(5)} == {0, 2, 4, 6}


# ---------- filled grids ----------

@pytest.mark.parametrize("theme", sorted(THEMES))
def test_dense_grid_obeys_every_crossword_rule(theme):
    grid, entries = fill_dense(THEMES[theme], 5, seed=7)
    allowed = set(load_dictionary()) | set(THEMES[theme])

    assert len(grid) == 5 and all(len(row) == 5 for row in grid)
    assert all(re.fullmatch(r"#|[A-Z]", cell) for row in grid for cell in row)

    runs = letter_runs(grid, min_len=1)
    # every run of letters is a real word of 3+ letters...
    for _, _, _, word in runs:
        assert len(word) >= 3 and word in allowed, word
    # ...listed exactly once among the entries, at the right place
    assert sorted((d, r, c, w) for d, r, c, w in runs) == sorted(
        (e["dir"], e["row"], e["col"], e["answer"]) for e in entries
    )
    # no word appears twice
    answers = [e["answer"] for e in entries]
    assert len(answers) == len(set(answers))
    # it is dense: at most 6 black squares
    assert sum(row.count("#") for row in grid) <= 6


@pytest.mark.parametrize("theme", sorted(THEMES))
def test_every_letter_is_part_of_an_across_and_a_down_word(theme):
    grid, _ = fill_dense(THEMES[theme], 5, seed=3)
    covered = {"across": set(), "down": set()}
    for d, r, c, word in letter_runs(grid, min_len=3):
        for i in range(len(word)):
            covered[d].add((r, c + i) if d == "across" else (r + i, c))
    letters = {(r, c) for r in range(5) for c in range(5) if grid[r][c] != "#"}
    assert covered["across"] == letters
    assert covered["down"] == letters


@pytest.mark.parametrize("theme", sorted(THEMES))
def test_themed_words_are_used(theme):
    _, entries = fill_dense(THEMES[theme], 5, seed=11)
    themed = [e["answer"] for e in entries if e["themed"]]
    assert len(themed) >= 2
    assert set(themed) <= set(THEMES[theme])


def test_same_words_and_seed_give_the_same_grid():
    assert fill_dense(THEMES["space"], 5, seed=5) == fill_dense(THEMES["space"], 5, seed=5)


def test_different_seeds_give_different_grids():
    grids = {str(fill_dense(THEMES["space"], 5, seed=s)[0]) for s in range(4)}
    assert len(grids) > 1


def test_works_without_any_themed_words():
    grid, entries = fill_dense([], 5, seed=1)
    assert len(entries) >= 8
    assert not any(e["themed"] for e in entries)


@pytest.mark.parametrize("size", [3, 4])
def test_smaller_grids_are_dense_too(size):
    grid, _ = fill_dense(THEMES["animals"], size, seed=2)
    assert len(grid) == size
    assert all(len(w) >= 3 for _, _, _, w in letter_runs(grid, min_len=1))


def test_grids_larger_than_5x5_are_not_attempted():
    assert MAX_DENSE_SIZE == 5
    assert fill_dense(THEMES["space"], 6, seed=1) is None


def test_filling_is_fast_enough_for_a_web_request():
    import time
    start = time.time()
    fill_dense(THEMES["food"], 5, seed=9)
    assert time.time() - start < 5


# ---------- the whole puzzle, with the AI faked ----------

def all_clues(puzzle):
    return [c for d in ("across", "down") for c in puzzle["clues"][d]]


def test_full_puzzle_is_dense_and_every_word_has_its_own_clue(fake_openai):
    fake_openai.reply_words(across=OCEAN)
    fake_openai.write_fill_clues(lambda answer: f"Fill clue #{len(answer)}")
    puzzle = generate_crossword("ocean", 5)

    assert sum(row.count("#") for row in puzzle["grid"]) <= 6
    in_grid = sorted((d, w) for d, _, _, w in letter_runs(puzzle["grid"], min_len=1))
    assert in_grid == sorted((d, c["answer"]) for d in ("across", "down") for c in puzzle["clues"][d])

    ai_clue = dict(OCEAN)
    themed = 0
    for clue in all_clues(puzzle):
        if clue["answer"] in ai_clue:
            assert clue["clue"] == ai_clue[clue["answer"]]  # the AI's own clue is kept
            themed += 1
        else:
            assert clue["clue"] == f"Fill clue #{len(clue['answer'])}"
    assert themed >= 2


def test_full_puzzle_numbering_is_standard(fake_openai):
    fake_openai.reply_words(across=OCEAN)
    fake_openai.write_fill_clues()
    puzzle = generate_crossword("ocean", 5)
    from .helpers import expected_numbers
    numbers = expected_numbers(puzzle["grid"])
    starts = {(d, w): (r, c) for d, r, c, w in letter_runs(puzzle["grid"], 3)}
    for d in ("across", "down"):
        listed = [c["number"] for c in puzzle["clues"][d]]
        assert listed == sorted(listed)
        for clue in puzzle["clues"][d]:
            assert clue["number"] == numbers[starts[(d, clue["answer"])]]


def test_second_ai_call_asks_for_clues_only_for_the_dictionary_words(fake_openai):
    fake_openai.reply_words(across=OCEAN)
    fake_openai.write_fill_clues()
    puzzle = generate_crossword("ocean", 5)
    assert len(fake_openai.calls) == 2
    asked = set(fake_openai.fill_answers_in(fake_openai.prompts[1]))
    ai_words = {a for a, _ in OCEAN}
    assert asked == {c["answer"] for c in all_clues(puzzle)} - ai_words
    assert '"ocean"' in fake_openai.prompts[1]


def test_a_clue_that_gives_away_its_answer_is_rejected_and_asked_again(fake_openai):
    fake_openai.reply_words(across=OCEAN)
    attempts = {}

    def writer(answer):
        attempts[answer] = attempts.get(answer, 0) + 1
        return f"The word {answer.lower()}" if attempts[answer] == 1 else "A proper clue"

    fake_openai.write_fill_clues(writer)
    puzzle = generate_crossword("ocean", 5)
    assert len(fake_openai.calls) == 3  # words, clues, clues again
    for clue in all_clues(puzzle):
        assert clue["answer"].lower() not in clue["clue"].lower()


def test_falls_back_to_the_simple_layout_when_fill_clues_cannot_be_written(fake_openai):
    fake_openai.reply_words(across=OCEAN)
    fake_openai.reply_error(TimeoutError("AI timed out"))
    fake_openai.reply_text("not json")
    puzzle = generate_crossword("ocean", 5)
    ai_words = {a for a, _ in OCEAN}
    assert all_clues(puzzle)
    assert {c["answer"] for c in all_clues(puzzle)} <= ai_words  # only the AI's own words


def test_ai_outage_gives_the_built_in_puzzle_without_extra_ai_calls(fake_openai):
    fake_openai.reply_error(ConnectionError("no internet"))
    fake_openai.reply_error(ConnectionError("no internet"))
    puzzle = generate_crossword("ocean", 5)
    built_in = {w["answer"] for d in ("across", "down") for w in _fallback()[d]}
    assert {c["answer"] for c in all_clues(puzzle)} <= built_in
    assert len(fake_openai.calls) == 2


def test_grids_larger_than_5x5_use_the_simple_layout(fake_openai):
    fake_openai.reply_words(across=OCEAN)
    puzzle = generate_crossword("ocean", 7)
    assert len(puzzle["grid"]) == 7
    assert len(fake_openai.calls) == 1
    assert {c["answer"] for c in all_clues(puzzle)} <= {a for a, _ in OCEAN}


def test_ai_is_asked_with_the_configured_model(fake_openai, monkeypatch):
    monkeypatch.setattr(crossword_gen, "OPENAI_MODEL", "some-new-model")
    fake_openai.reply_words(across=OCEAN)
    fake_openai.write_fill_clues()
    generate_crossword("ocean", 5)
    assert {call["model"] for call in fake_openai.calls} == {"some-new-model"}


def test_default_model_is_not_the_retired_one():
    assert "gpt-3.5" not in crossword_gen.OPENAI_MODEL
