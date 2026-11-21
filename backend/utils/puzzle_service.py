"""
Daily puzzles, caching and limits.

Every puzzle costs AI calls, so:

* Each puzzle is kept for the rest of the day and handed to everyone who
  asks for the same thing. "Today's puzzle" (no theme) is therefore made once
  a day, and so is each theme ("Space", "space " and "SPACE" are the same).
* Only brand-new puzzles count towards the limits; replaying a puzzle someone
  already made today is free.
* Each player can make a few new themed puzzles a day (PLAYER_DAILY_LIMIT).
* All players together can make a set number per day (GLOBAL_DAILY_LIMIT),
  which caps the AI bill even if someone gets round the per-player limit.
* Today's puzzle and the featured themes on the home screen never count
  against a player: they are shared, so each is made at most once a day.
* A day starts at midnight in PUZZLE_TIMEZONE.
* Each featured theme has a daily angle (utils/featured.py): the AI is asked
  for "Ancient Egypt (History)" rather than just "History", and the angle is
  sent back in the puzzle's meta so the game can show it.

Everything is kept in memory. If the server restarts, today's puzzles are
made again on the next request (on the free Render plan that happens after
15 idle minutes). Good enough for a first release; a database or file store
can replace the in-memory dicts later.
"""
import re
import threading
from datetime import date, datetime, time, timedelta
from typing import Callable, Dict, Optional, Tuple
from zoneinfo import ZoneInfo

from utils.featured import FEATURED_THEMES, angle_for, prompt_theme  # noqa: F401


class LimitReached(Exception):
    """Raised when a new puzzle would go over a daily limit."""

    def __init__(self, code: str, limit: int, resets_at: datetime):
        super().__init__(code)
        self.code = code            # "player_limit" or "daily_capacity"
        self.limit = limit
        self.resets_at = resets_at


def normalize_theme(theme: Optional[str]) -> str:
    """'  Ancient   EGYPT ' -> 'ancient egypt'; None/blank -> '' (today's puzzle)."""
    return re.sub(r"\s+", " ", (theme or "").strip()).lower()


class PuzzleService:
    def __init__(
        self,
        generate: Callable[[Optional[str], int], dict],
        *,
        player_daily_limit: int = 10,
        global_daily_limit: int = 500,
        timezone: str = "Europe/Zurich",
        now: Callable[[], datetime] = None,
        max_cached_per_day: int = 1000,
    ):
        self._generate = generate
        self.player_daily_limit = player_daily_limit
        self.global_daily_limit = global_daily_limit
        self.tz = ZoneInfo(timezone)
        self._now = now or (lambda: datetime.now(self.tz))
        self.max_cached_per_day = max_cached_per_day
        self._featured = {normalize_theme(t) for t in FEATURED_THEMES}

        self._lock = threading.Lock()
        self._key_locks: Dict[Tuple, threading.Lock] = {}
        self._cache: Dict[Tuple[date, int, str], dict] = {}
        self._made_by_player: Dict[Tuple[date, str], int] = {}
        self._made_today: Dict[date, int] = {}

    # ---------- time ----------

    def today(self) -> date:
        return self._now().astimezone(self.tz).date()

    def resets_at(self) -> datetime:
        """Next midnight in the puzzle time zone."""
        return datetime.combine(self.today() + timedelta(days=1), time(0), self.tz)

    # ---------- public ----------

    def is_free(self, theme: Optional[str]) -> bool:
        """Today's puzzle and the featured themes never count against a player."""
        key = normalize_theme(theme)
        return key == "" or key in self._featured

    def left_for(self, player: str) -> int:
        with self._lock:
            used = self._made_by_player.get((self.today(), player), 0)
        return max(0, self.player_daily_limit - used)

    def get_puzzle(self, theme: Optional[str], size: int, player: str) -> Tuple[dict, dict]:
        """
        Returns (puzzle, meta). Raises LimitReached if a new puzzle is needed
        and the player or everyone together has used up today's allowance.
        """
        day = self.today()
        key = (day, size, normalize_theme(theme))
        free = self.is_free(theme)

        angle = angle_for(theme, day)

        cached = self._cache.get(key)
        if cached is not None:
            return cached, self._meta(player, cached=True, free=free, angle=angle)

        # one lock per puzzle, so 100 people opening today's puzzle at
        # midnight trigger one generation, not 100
        with self._lock:
            key_lock = self._key_locks.setdefault(key, threading.Lock())
        with key_lock:
            cached = self._cache.get(key)
            if cached is not None:
                return cached, self._meta(player, cached=True, free=free, angle=angle)

            self._check_limits(day, player, free)
            puzzle = self._generate(prompt_theme(theme, day), size)
            if puzzle.get("fallback"):
                # the AI was unavailable: show the built-in puzzle, but don't
                # keep it for the day and don't charge the player for it
                puzzle = {k: v for k, v in puzzle.items() if k != "fallback"}
                return puzzle, self._meta(player, cached=False, free=free, angle=angle)
            puzzle = {k: v for k, v in puzzle.items() if k != "fallback"}

            with self._lock:
                self._forget_old_days(day)
                if sum(1 for k in self._cache if k[0] == day) < self.max_cached_per_day:
                    self._cache[key] = puzzle
                self._made_today[day] = self._made_today.get(day, 0) + 1
                if not free:
                    pk = (day, player)
                    self._made_by_player[pk] = self._made_by_player.get(pk, 0) + 1
            return puzzle, self._meta(player, cached=False, free=free, angle=angle)

    # ---------- internals ----------

    def _check_limits(self, day: date, player: str, free: bool):
        with self._lock:
            made_today = self._made_today.get(day, 0)
            made_by_player = self._made_by_player.get((day, player), 0)
        if free:
            return  # shared puzzles: made at most once a day, always allowed
        if made_today >= self.global_daily_limit:
            raise LimitReached("daily_capacity", self.global_daily_limit, self.resets_at())
        if made_by_player >= self.player_daily_limit:
            raise LimitReached("player_limit", self.player_daily_limit, self.resets_at())

    def _meta(self, player: str, *, cached: bool, free: bool, angle: Optional[str] = None) -> dict:
        meta = {
            "cached": cached,
            "free": free,
            "new_puzzles_left": self.left_for(player),
            "resets_at": self.resets_at().isoformat(),
        }
        if angle:
            meta["angle"] = angle  # today's angle of a featured theme
        return meta

    def _forget_old_days(self, today: date):
        for k in [k for k in self._cache if k[0] != today]:
            del self._cache[k]
            self._key_locks.pop(k, None)
        for k in [k for k in self._made_by_player if k[0] != today]:
            del self._made_by_player[k]
        for k in [k for k in self._made_today if k != today]:
            del self._made_today[k]
