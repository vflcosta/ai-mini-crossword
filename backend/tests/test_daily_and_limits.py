"""
Daily puzzles, caching and limits: each puzzle is made once a day and shared,
and new puzzles are limited per player and for everyone together.
"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

import main
from utils.puzzle_service import FEATURED_THEMES, LimitReached, PuzzleService, normalize_theme

ZURICH = ZoneInfo("Europe/Zurich")


class Clock:
    def __init__(self, when):
        self.when = when

    def __call__(self):
        return self.when


def fake_generator():
    """A stand-in for the real generator that counts how often it runs."""
    calls = []

    def generate(theme, size):
        calls.append((theme, size))
        return {"grid": [["A"]], "clues": {"across": [], "down": []},
                "fallback": False, "n": len(calls)}

    generate.calls = calls
    return generate


def service(gen=None, clock=None, **kw):
    kw.setdefault("player_daily_limit", 3)
    kw.setdefault("global_daily_limit", 100)
    return PuzzleService(gen or fake_generator(),
                         now=clock or Clock(datetime(2026, 11, 20, 15, 0, tzinfo=ZURICH)),
                         **kw)


# ---------- caching ----------

def test_todays_puzzle_is_made_once_and_shared_by_everyone():
    gen = fake_generator()
    s = service(gen)
    first, meta1 = s.get_puzzle(None, 5, "alice")
    second, meta2 = s.get_puzzle(None, 5, "bob")
    assert first == second
    assert len(gen.calls) == 1
    assert meta1["cached"] is False and meta2["cached"] is True


@pytest.mark.parametrize("variant", ["space", "  Space ", "SPACE", "space"])
def test_same_theme_in_any_spelling_is_one_puzzle(variant):
    gen = fake_generator()
    s = service(gen)
    s.get_puzzle("Space", 5, "alice")
    s.get_puzzle(variant, 5, "bob")
    assert len(gen.calls) == 1


def test_different_themes_and_sizes_are_different_puzzles():
    gen = fake_generator()
    s = service(gen)
    s.get_puzzle("space", 5, "a")
    s.get_puzzle("ocean", 5, "a")
    s.get_puzzle("space", 7, "a")
    assert len(gen.calls) == 3


def test_a_new_puzzle_is_made_after_midnight():
    gen = fake_generator()
    clock = Clock(datetime(2026, 11, 20, 23, 59, tzinfo=ZURICH))
    s = service(gen, clock)
    s.get_puzzle(None, 5, "alice")
    clock.when += timedelta(minutes=2)  # 00:01 the next day
    s.get_puzzle(None, 5, "alice")
    assert len(gen.calls) == 2


def test_the_day_follows_the_puzzle_time_zone():
    # 23:30 UTC on 20 Nov is already 00:30 on 21 Nov in Zurich
    s = service(clock=Clock(datetime(2026, 11, 20, 23, 30, tzinfo=ZoneInfo("UTC"))))
    assert str(s.today()) == "2026-11-21"
    assert s.resets_at() == datetime(2026, 11, 22, 0, 0, tzinfo=ZURICH)


def test_built_in_fallback_puzzle_is_not_kept_or_counted():
    calls = []

    def flaky(theme, size):
        calls.append(theme)
        return {"grid": [["A"]], "clues": {}, "fallback": len(calls) == 1}

    s = service(flaky)
    puzzle, meta = s.get_puzzle("ocean", 5, "alice")
    assert "fallback" not in puzzle
    assert meta["new_puzzles_left"] == 3  # not charged
    s.get_puzzle("ocean", 5, "alice")
    assert len(calls) == 2  # tried the AI again instead of reusing the fallback


def test_old_days_are_forgotten():
    clock = Clock(datetime(2026, 11, 20, 12, 0, tzinfo=ZURICH))
    s = service(clock=clock)
    s.get_puzzle("space", 5, "a")
    clock.when += timedelta(days=1)
    s.get_puzzle("ocean", 5, "a")
    assert {k[0] for k in s._cache} == {s.today()}


def test_many_people_at_once_trigger_only_one_generation():
    import threading
    import time
    calls = []

    def slow(theme, size):
        calls.append(theme)
        time.sleep(0.2)
        return {"grid": [["A"]], "clues": {}, "fallback": False}

    s = service(slow)
    threads = [threading.Thread(target=s.get_puzzle, args=(None, 5, f"p{i}")) for i in range(20)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert len(calls) == 1


# ---------- limits ----------

def test_player_limit_counts_only_new_themed_puzzles():
    s = service(player_daily_limit=2)
    s.get_puzzle("jazz", 5, "alice")
    s.get_puzzle("ocean", 5, "alice")
    s.get_puzzle("jazz", 5, "alice")    # already made today: free
    with pytest.raises(LimitReached) as hit:
        s.get_puzzle("opera", 5, "alice")
    assert hit.value.code == "player_limit"
    assert hit.value.resets_at == datetime(2026, 11, 21, 0, 0, tzinfo=ZURICH)


def test_replaying_a_puzzle_from_today_is_always_free():
    s = service(player_daily_limit=1)
    s.get_puzzle("jazz", 5, "bob")           # bob made it
    s.get_puzzle("opera", 5, "alice")        # alice uses her one
    puzzle, meta = s.get_puzzle("jazz", 5, "alice")  # already exists: free
    assert meta["cached"] is True


def test_todays_puzzle_and_featured_themes_never_count():
    s = service(player_daily_limit=1)
    s.get_puzzle("my theme", 5, "alice")     # limit used up
    s.get_puzzle(None, 5, "alice")
    for theme in FEATURED_THEMES:
        s.get_puzzle(theme.lower(), 5, "alice")
    assert s.left_for("alice") == 0


def test_players_have_separate_limits():
    s = service(player_daily_limit=1)
    s.get_puzzle("a", 5, "alice")
    s.get_puzzle("b", 5, "bob")
    with pytest.raises(LimitReached):
        s.get_puzzle("c", 5, "alice")


def test_limit_resets_at_midnight():
    clock = Clock(datetime(2026, 11, 20, 22, 0, tzinfo=ZURICH))
    s = service(clock=clock, player_daily_limit=1)
    s.get_puzzle("a", 5, "alice")
    with pytest.raises(LimitReached):
        s.get_puzzle("b", 5, "alice")
    clock.when += timedelta(hours=3)
    s.get_puzzle("b", 5, "alice")


def test_everyone_together_has_a_daily_cap():
    s = service(player_daily_limit=10, global_daily_limit=3)
    for i, player in enumerate(["a", "b", "c"]):
        s.get_puzzle(f"theme {i}", 5, player)
    with pytest.raises(LimitReached) as hit:
        s.get_puzzle("one more", 5, "d")
    assert hit.value.code == "daily_capacity"


def test_todays_puzzle_still_works_when_the_daily_cap_is_reached():
    s = service(global_daily_limit=1)
    s.get_puzzle("theme", 5, "a")
    s.get_puzzle(None, 5, "b")
    s.get_puzzle("History", 5, "b")


def test_meta_tells_the_app_how_many_new_puzzles_are_left():
    s = service(player_daily_limit=3)
    _, meta = s.get_puzzle("jazz", 5, "alice")
    assert meta["new_puzzles_left"] == 2
    _, meta = s.get_puzzle("Space", 5, "alice")
    assert meta["new_puzzles_left"] == 2 and meta["free"] is True
    assert meta["resets_at"] == "2026-11-21T00:00:00+01:00"


def test_theme_normalisation():
    assert normalize_theme("  Ancient   EGYPT ") == "ancient egypt"
    assert normalize_theme(None) == normalize_theme("   ") == ""


def test_featured_themes_match_the_buttons_in_the_app():
    from pathlib import Path
    app = (Path(__file__).parents[2] / "frontend" / "src" / "config.ts").read_text()
    for theme in FEATURED_THEMES:
        assert f'"{theme}"' in app, f"{theme} is free on the server but has no button in the app"


# ---------- through the API ----------

@pytest.fixture
def api(monkeypatch):
    gen = fake_generator()
    monkeypatch.setattr(main, "gen_crossword", lambda theme, size: gen(theme, size))
    monkeypatch.setattr(main, "puzzles", main.make_puzzle_service(player_daily_limit=2,
                                                                 global_daily_limit=100))
    client = TestClient(main.app)
    client.calls = gen.calls
    return client


def post(client, theme, ip="203.0.113.7", **headers):
    return client.post("/generate-crossword", json={"theme": theme, "size": 5},
                       headers={"True-Client-IP": ip, **headers})


def test_api_returns_meta_with_the_puzzle(api, monkeypatch):
    monkeypatch.setenv("CLIENT_IP_HEADER", "True-Client-IP")
    body = post(api, "jazz").json()
    assert body["meta"]["cached"] is False
    assert body["meta"]["new_puzzles_left"] == 1
    assert post(api, "jazz").json()["meta"]["cached"] is True


def test_api_limit_answer_is_friendly_and_machine_readable(api, monkeypatch):
    monkeypatch.setenv("CLIENT_IP_HEADER", "True-Client-IP")
    post(api, "one")
    post(api, "two")
    res = post(api, "three")
    assert res.status_code == 429
    detail = res.json()["detail"]
    assert detail["code"] == "player_limit"
    assert detail["limit"] == 2
    assert "today" in detail["message"]
    assert detail["retry_after_seconds"] > 0
    assert res.headers["Retry-After"] == str(detail["retry_after_seconds"])
    datetime.fromisoformat(detail["resets_at"])
    # another player is not affected, and today's puzzle still works
    assert post(api, "three", ip="198.51.100.9").status_code == 200
    assert post(api, None).status_code == 200


def test_players_are_told_apart_by_the_configured_header(api, monkeypatch):
    monkeypatch.setenv("CLIENT_IP_HEADER", "True-Client-IP")
    post(api, "one", ip="1.1.1.1")
    post(api, "two", ip="1.1.1.1")
    assert post(api, "x", ip="1.1.1.1").status_code == 429
    assert post(api, "x", ip="2.2.2.2").status_code == 200


def test_without_the_header_setting_a_faked_header_is_ignored(api, monkeypatch):
    monkeypatch.delenv("CLIENT_IP_HEADER", raising=False)
    post(api, "one", ip="1.1.1.1")
    post(api, "two", ip="2.2.2.2")
    # both came from the same connection, so they count as the same player
    assert post(api, "three", ip="3.3.3.3").status_code == 429


def test_daily_capacity_answer(api, monkeypatch):
    monkeypatch.setattr(main, "puzzles", main.make_puzzle_service(player_daily_limit=5,
                                                                 global_daily_limit=1))
    post(api, "one")
    res = post(api, "two", ip="9.9.9.9")
    assert res.status_code == 429
    assert res.json()["detail"]["code"] == "daily_capacity"


def test_limits_come_from_the_environment(monkeypatch):
    monkeypatch.setenv("PLAYER_DAILY_LIMIT", "4")
    monkeypatch.setenv("GLOBAL_DAILY_LIMIT", "40")
    monkeypatch.setenv("PUZZLE_TIMEZONE", "America/New_York")
    s = main.make_puzzle_service()
    assert (s.player_daily_limit, s.global_daily_limit, str(s.tz)) == (4, 40, "America/New_York")
