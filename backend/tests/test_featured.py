"""Featured themes and their daily angles (utils/featured.py)."""
from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient

import main
from utils.featured import ANGLES, FEATURED_THEMES, angle_for, featured_today, prompt_theme
from utils.puzzle_service import PuzzleService

DAY = date(2026, 11, 21)
ZURICH = ZoneInfo("Europe/Zurich")


def test_there_are_six_featured_themes_including_music():
    assert FEATURED_THEMES == ("History", "Space", "Art", "Nature", "Science", "Music")


def test_every_theme_has_plenty_of_distinct_angles():
    for theme, angles in ANGLES.items():
        assert len(angles) >= 20, theme
        assert len(set(angles)) == len(angles), f"{theme} lists an angle twice"
        assert all(0 < len(a) <= 30 for a in angles), "angles must fit under a theme button"


def test_the_angle_is_the_same_all_day_and_changes_the_next_day():
    today = angle_for("History", DAY)
    assert today in ANGLES["History"]
    assert angle_for("History", DAY) == today
    assert angle_for("History", date(2026, 11, 22)) != today


def test_every_angle_comes_round_before_any_repeats():
    angles = ANGLES["Space"]
    days = [date.fromordinal(DAY.toordinal() + i) for i in range(len(angles))]
    assert sorted(angle_for("Space", d) for d in days) == sorted(angles)


def test_themes_do_not_move_in_step():
    # with their own shuffles, the themes are not all on the same list position
    positions = {ANGLES[t].index(angle_for(t, DAY)) for t in FEATURED_THEMES}
    assert len(positions) > 1


def test_any_spelling_of_a_featured_theme_gets_the_angle_and_typed_themes_none():
    assert angle_for("  history ", DAY) == angle_for("History", DAY)
    assert angle_for("volcanoes", DAY) is None
    assert angle_for(None, DAY) is None


def test_the_ai_is_asked_for_the_angle_and_the_theme():
    angle = angle_for("Music", DAY)
    assert prompt_theme("Music", DAY) == f"{angle} (Music)"
    assert prompt_theme("volcanoes", DAY) == "volcanoes"
    assert prompt_theme(None, DAY) is None


def test_featured_today_lists_every_theme_with_its_angle():
    listed = featured_today(DAY)
    assert [x["theme"] for x in listed] == list(FEATURED_THEMES)
    assert all(x["angle"] == angle_for(x["theme"], DAY) for x in listed)


def _service(asked):
    def generate(theme, size):
        asked.append(theme)
        return {"grid": [["A"]], "clues": {"across": [], "down": []}, "fallback": False}
    return PuzzleService(generate, now=lambda: datetime(2026, 11, 21, 10, 0, tzinfo=ZURICH))


def test_a_featured_puzzle_is_made_from_todays_angle_and_says_which_one():
    asked = []
    service = _service(asked)
    _, meta = service.get_puzzle("History", 7, "alice")
    angle = angle_for("History", DAY)
    assert asked == [f"{angle} (History)"]
    assert meta["angle"] == angle and meta["free"] is True


def test_a_featured_puzzle_is_still_made_once_a_day_and_shared():
    asked = []
    service = _service(asked)
    service.get_puzzle("History", 7, "alice")
    _, meta = service.get_puzzle("history", 7, "bob")
    assert len(asked) == 1
    assert meta["cached"] is True and meta["angle"] == angle_for("History", DAY)


def test_typed_themes_and_todays_puzzle_have_no_angle():
    asked = []
    service = _service(asked)
    _, typed = service.get_puzzle("volcanoes", 7, "alice")
    _, daily = service.get_puzzle(None, 7, "alice")
    assert asked == ["volcanoes", None]
    assert "angle" not in typed and "angle" not in daily


def test_the_home_screen_can_ask_for_todays_angles(monkeypatch):
    monkeypatch.setattr(
        main, "puzzles",
        main.make_puzzle_service(now=lambda: datetime(2026, 11, 21, 10, 0, tzinfo=ZURICH)),
    )
    body = TestClient(main.app).get("/featured").json()
    assert body["date"] == "2026-11-21"
    assert body["themes"] == featured_today(DAY)
