"""
Keeps backend and frontend in sync.

tests/fixtures/sample_payload.json is an example of exactly what the backend
sends to the frontend. The frontend has its own test that reads the same file.

If this test fails, the shape of the backend's answer has changed. Update the
fixture to the new output, then run the frontend tests: they will tell you
whether the app can still display it.
"""
import json
from pathlib import Path

from utils.crossword_gen import build_crossword_from_words

FIXTURE = Path(__file__).parent / "fixtures" / "sample_payload.json"


def test_backend_output_matches_the_shared_example():
    sample = json.loads(FIXTURE.read_text())
    grid, clues = build_crossword_from_words(sample["words"], size=sample["size"])
    assert {"grid": grid, "clues": clues} == sample["payload"]
