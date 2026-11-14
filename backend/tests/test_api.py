"""The web API the frontend calls: POST /generate-crossword."""
import pytest
from fastapi.testclient import TestClient

import main

client = TestClient(main.app)

ANIMALS = dict(across=[("TIGER", "Striped cat"), ("OTTER", "River swimmer")],
               down=[("GOAT", "Bearded farm animal"), ("RAT", "Small rodent")])


def test_health_check():
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_generate_returns_a_grid_and_numbered_clues(fake_openai):
    fake_openai.reply_words(**ANIMALS)
    res = client.post("/generate-crossword", json={"theme": "animals", "size": 5})
    assert res.status_code == 200
    body = res.json()
    assert set(body) == {"grid", "clues"}
    assert len(body["grid"]) == 5 and all(len(row) == 5 for row in body["grid"])
    assert set(body["clues"]) == {"across", "down"}
    for direction in ("across", "down"):
        for clue in body["clues"][direction]:
            assert set(clue) == {"number", "clue", "answer"}
            assert isinstance(clue["number"], int)
    answers = {c["answer"] for d in ("across", "down") for c in body["clues"][d]}
    assert answers and answers <= {"TIGER", "OTTER", "GOAT", "RAT"}


def test_theme_reaches_the_ai(fake_openai):
    fake_openai.reply_words(**ANIMALS)
    client.post("/generate-crossword", json={"theme": "dinosaurs", "size": 7})
    assert '"dinosaurs"' in fake_openai.last_prompt


def test_random_puzzle_needs_no_theme(fake_openai):
    fake_openai.reply_words(**ANIMALS)
    res = client.post("/generate-crossword", json={"theme": None})
    assert res.status_code == 200
    assert len(res.json()["grid"]) == 7  # default size
    assert "Mixed everyday topics" in fake_openai.last_prompt


def test_empty_body_uses_defaults(fake_openai):
    fake_openai.reply_words(**ANIMALS)
    res = client.post("/generate-crossword", json={})
    assert res.status_code == 200
    assert len(res.json()["grid"]) == 7


def test_still_returns_a_puzzle_when_the_ai_is_down(fake_openai):
    fake_openai.reply_error(ConnectionError("no internet"))
    fake_openai.reply_error(ConnectionError("no internet"))
    res = client.post("/generate-crossword", json={"theme": "animals", "size": 7})
    assert res.status_code == 200
    assert res.json()["clues"]["across"]


def test_generator_error_becomes_a_400(monkeypatch):
    monkeypatch.setattr(main, "gen_crossword", lambda **kw: {"error": "Could not generate clues."})
    res = client.post("/generate-crossword", json={"theme": "x", "size": 7})
    assert res.status_code == 400
    assert res.json()["detail"] == "Could not generate clues."


def test_unexpected_crash_becomes_a_500(monkeypatch):
    def boom(**kw):
        raise RuntimeError("boom")
    monkeypatch.setattr(main, "gen_crossword", boom)
    res = client.post("/generate-crossword", json={"theme": "x", "size": 7})
    assert res.status_code == 500


def test_non_numeric_size_is_rejected():
    res = client.post("/generate-crossword", json={"theme": "x", "size": "huge"})
    assert res.status_code == 422


def test_frontend_dev_server_is_allowed_by_cors():
    res = client.options(
        "/generate-crossword",
        headers={"Origin": "http://localhost:3000",
                 "Access-Control-Request-Method": "POST"},
    )
    assert res.headers.get("access-control-allow-origin") == "http://localhost:3000"


@pytest.mark.parametrize("size", [-1, 0, 1, 2])
def test_too_small_size_is_rejected(size):
    res = client.post("/generate-crossword", json={"theme": "x", "size": size})
    assert res.status_code == 422


@pytest.mark.parametrize("size", [11, 500])
def test_too_large_size_is_rejected(size):
    res = client.post("/generate-crossword", json={"theme": "x", "size": size})
    assert res.status_code == 422


@pytest.mark.parametrize("size", [3, 5, 10])
def test_smallest_and_largest_allowed_sizes_work(fake_openai, size):
    fake_openai.reply_words(**ANIMALS)
    res = client.post("/generate-crossword", json={"theme": "x", "size": size})
    assert res.status_code == 200
    assert len(res.json()["grid"]) == size
