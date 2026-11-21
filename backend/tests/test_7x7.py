"""
The 7x7 puzzles the game now uses, for today's puzzle and for themes alike:
every answer is one of the AI's words, with its own clue, crossing the others.
The 5x5 puzzles stay available for the first iPhone app version (1.0).
"""
import time

from fastapi.testclient import TestClient

import main
from utils import crossword_gen
from utils.crossword_gen import GAME_SIZE, generate_crossword

from .helpers import letter_runs

client = TestClient(main.app)

MUSIC = [("PIANO", "Instrument with 88 keys"), ("GUITAR", "Six-string instrument"),
         ("VIOLIN", "Played with a bow under the chin"), ("CELLO", "Large bowed instrument"),
         ("DRUMS", "Kit a rock band's timekeeper plays"), ("TEMPO", "Speed of a piece of music"),
         ("CHORD", "Three or more notes played together"), ("MELODY", "A tune you can hum"),
         ("RHYTHM", "Pattern of beats"), ("OPERA", "Drama told entirely in song"),
         ("FLUTE", "Woodwind played sideways"), ("HARP", "Instrument with strings plucked by hand"),
         ("BASS", "Lowest voice in a choir"), ("NOTE", "Single musical sound"),
         ("SCALE", "Do, re, mi and so on"), ("BAND", "Group of musicians"),
         ("JAZZ", "Music born in New Orleans"), ("BLUES", "Sad music from the Deep South"),
         ("ROCK", "Music of the Rolling Stones"), ("LYRIC", "Words of a song"),
         ("VERSE", "Part of a song before the chorus"), ("CHORUS", "Repeated part of a song"),
         ("ALTO", "Voice between soprano and tenor"), ("TENOR", "High male voice"),
         ("TRUMPET", "Brass instrument with three valves"), ("ORGAN", "Church instrument with pipes"),
         ("BANJO", "Twangy country instrument"), ("OBOE", "Double-reed woodwind"),
         ("TUBA", "Largest brass instrument"), ("ARIA", "Solo song in an opera")]
MIXED = [("OCEAN", "Vast body of salt water"), ("PLANET", "Earth is one"),
         ("CASTLE", "Home of a medieval king"), ("TIGER", "Largest wild cat"),
         ("BREAD", "Baked from flour and water"), ("RIVER", "The Nile is the longest one"),
         ("PIANO", "Instrument with 88 keys"), ("SUMMER", "Warmest season"),
         ("APPLE", "Fruit that fell on Newton"), ("CLOUD", "It brings rain"),
         ("ROBOT", "Machine that can act on its own"), ("EAGLE", "National bird of the USA"),
         ("PAINT", "What an artist puts on canvas"), ("MOON", "It controls the tides"),
         ("STORM", "Thunder and lightning"), ("GARDEN", "Place to grow flowers"),
         ("ISLAND", "Land surrounded by water"), ("LEMON", "Sour yellow fruit"),
         ("TRAIN", "It runs on rails"), ("MAPLE", "Tree on Canada's flag")]


def all_clues(puzzle):
    return puzzle["clues"]["across"] + puzzle["clues"]["down"]


def test_the_game_size_is_7x7():
    assert GAME_SIZE == 7
    assert crossword_gen.generate_crossword.__defaults__[-1] == 7


def test_the_api_makes_7x7_puzzles_when_no_size_is_given(fake_ai, monkeypatch):
    monkeypatch.setattr(main, "puzzles", main.make_puzzle_service())
    fake_ai.reply_words(across=MUSIC)
    body = client.post("/generate-crossword", json={"theme": "music"}).json()
    assert len(body["grid"]) == 7 and all(len(row) == 7 for row in body["grid"])


def test_themed_7x7_uses_only_the_ais_words_with_their_own_clues(fake_ai):
    fake_ai.reply_words(across=MUSIC)
    puzzle = generate_crossword("music", 7)
    assert puzzle["fallback"] is False
    ai_clue = dict(MUSIC)
    for clue in all_clues(puzzle):
        assert clue["answer"] in ai_clue
        assert clue["clue"] == ai_clue[clue["answer"]]


def test_todays_7x7_puzzle_also_uses_only_the_ais_words(fake_ai):
    fake_ai.reply_words(across=MIXED)
    puzzle = generate_crossword(None, 7)
    assert puzzle["fallback"] is False
    assert {c["answer"] for c in all_clues(puzzle)} <= dict(MIXED).keys()
    assert "Mixed everyday topics" in fake_ai.prompts[0]


def test_a_7x7_puzzle_needs_only_one_ai_call(fake_ai):
    fake_ai.reply_words(across=MIXED)
    generate_crossword(None, 7)
    fake_ai.reply_words(across=MUSIC)
    generate_crossword("music", 7)
    assert len(fake_ai.calls) == 2


def test_a_7x7_puzzle_has_enough_crossing_answers_and_no_accidental_words(fake_ai):
    for theme, words in (("music", MUSIC), (None, MIXED)):
        fake_ai.reply_words(across=words)
        puzzle = generate_crossword(theme, 7)
        assert len(puzzle["grid"]) == 7
        assert len(all_clues(puzzle)) >= crossword_gen.MIN_WORDS_7X7
        in_grid = sorted((d, w) for d, _, _, w in letter_runs(puzzle["grid"], min_len=2))
        assert in_grid == sorted((d, c["answer"]) for d in ("across", "down")
                                 for c in puzzle["clues"][d])


def test_when_too_few_words_fit_the_ai_is_asked_once_more(fake_ai):
    fake_ai.reply_words(across=MUSIC[:3])
    fake_ai.reply_words(across=MUSIC[3:])
    puzzle = generate_crossword("music", 7)
    assert len(fake_ai.calls) == 2
    assert puzzle["fallback"] is False
    assert len(all_clues(puzzle)) >= crossword_gen.MIN_WORDS_7X7


def test_a_7x7_puzzle_is_still_returned_when_the_ai_is_down(fake_ai):
    fake_ai.reply_error(ConnectionError("no internet"))
    fake_ai.reply_error(ConnectionError("no internet"))
    puzzle = generate_crossword("music", 7)
    assert puzzle["fallback"] is True
    assert len(puzzle["grid"]) == 7 and all_clues(puzzle)


def test_the_ai_is_asked_for_short_clues_and_long_ones_are_dropped(fake_ai):
    long_clue = "A " + "very " * 25 + "long clue"
    assert len(long_clue) > crossword_gen.CLUE_MAX_CHARS
    fake_ai.reply_words(across=MUSIC + [("SONG", long_clue)])
    puzzle = generate_crossword("music", 7)
    assert "at most 90 characters" in fake_ai.prompts[0]
    assert all(len(c["clue"]) <= crossword_gen.CLUE_MAX_CHARS for c in all_clues(puzzle))
    assert "SONG" not in {c["answer"] for c in all_clues(puzzle)}


def test_the_same_words_always_give_the_same_7x7_puzzle(fake_ai):
    fake_ai.reply_words(across=MUSIC)
    first = generate_crossword("music", 7)
    fake_ai.reply_words(across=MUSIC)
    assert generate_crossword("music", 7) == first


def test_building_a_7x7_puzzle_is_fast_enough_for_a_web_request(fake_ai):
    fake_ai.reply_words(across=MUSIC)
    start = time.time()
    generate_crossword("music", 7)
    assert time.time() - start < 5


def test_5x5_puzzles_still_work_for_the_first_iphone_app_version(fake_ai):
    fake_ai.reply_words(across=MUSIC)
    puzzle = generate_crossword("music", 5)
    assert len(puzzle["grid"]) == 5
    assert all(len(c["answer"]) <= 5 for c in all_clues(puzzle))
