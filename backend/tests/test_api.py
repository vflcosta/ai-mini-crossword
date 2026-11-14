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


def test_generate_returns_a_grid_and_numbered_clues(fake_ai):
    fake_ai.reply_words(**ANIMALS)
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


def test_theme_reaches_the_ai(fake_ai):
    fake_ai.reply_words(**ANIMALS)
    client.post("/generate-crossword", json={"theme": "dinosaurs", "size": 7})
    assert '"dinosaurs"' in fake_ai.prompts[0]


def test_random_puzzle_needs_no_theme(fake_ai):
    fake_ai.reply_words(**ANIMALS)
    res = client.post("/generate-crossword", json={"theme": None})
    assert res.status_code == 200
    assert len(res.json()["grid"]) == 5  # default size: the classic 5x5 mini
    assert "Mixed everyday topics" in fake_ai.prompts[0]


def test_empty_body_uses_defaults(fake_ai):
    fake_ai.reply_words(**ANIMALS)
    res = client.post("/generate-crossword", json={})
    assert res.status_code == 200
    assert len(res.json()["grid"]) == 5


def test_still_returns_a_puzzle_when_the_ai_is_down(fake_ai):
    fake_ai.reply_error(ConnectionError("no internet"))
    fake_ai.reply_error(ConnectionError("no internet"))
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


def test_very_long_theme_is_rejected():
    res = client.post("/generate-crossword", json={"theme": "x" * 81, "size": 5})
    assert res.status_code == 422


def test_live_website_address_comes_from_the_environment(monkeypatch):
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://my-crossword.example.com/, https://www.example.com")
    origins = main.allowed_origins()
    assert "https://my-crossword.example.com" in origins
    assert "https://www.example.com" in origins
    assert "http://localhost:3000" in origins  # local development keeps working


def test_without_configuration_only_local_development_is_allowed(monkeypatch):
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
    assert main.allowed_origins() == main.LOCAL_ORIGINS


def test_live_website_pattern_is_allowed_and_strangers_are_not(monkeypatch):
    import importlib
    monkeypatch.setenv("ALLOWED_ORIGIN_REGEX", r"https://ai-mini-crossword(-[a-z0-9]+)?\.onrender\.com")
    live = TestClient(importlib.reload(main).app)
    try:
        def allowed(origin):
            res = live.options("/generate-crossword", headers={
                "Origin": origin, "Access-Control-Request-Method": "POST"})
            return res.headers.get("access-control-allow-origin") == origin

        assert allowed("https://ai-mini-crossword.onrender.com")
        assert allowed("https://ai-mini-crossword-x7k2.onrender.com")
        assert allowed("http://localhost:3000")
        assert not allowed("https://someone-else.onrender.com")
        assert not allowed("https://ai-mini-crossword.onrender.com.evil.com")
    finally:
        monkeypatch.delenv("ALLOWED_ORIGIN_REGEX")
        importlib.reload(main)


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
def test_smallest_and_largest_allowed_sizes_work(fake_ai, size):
    fake_ai.reply_words(**ANIMALS)
    res = client.post("/generate-crossword", json={"theme": "x", "size": size})
    assert res.status_code == 200
    assert len(res.json()["grid"]) == size
