import { useState, useEffect, useRef } from "react";
import { backendToCrossword } from "./utils/transform";
import { generateCrossword, LimitReachedError } from "./api";
import { FEATURED_THEMES, GRID_SIZE, PUZZLE_TIMEZONE, THEME_ICONS } from "./config";
import { HeroCrossword } from "./components/HeroCrossword";
import { useIsDesktop } from "./hooks";
import { Game } from "./components/Game";
import { onAndroidBack } from "./native";
import { describePuzzle, track, type PuzzleType } from "./analytics";
import { PrivacyPolicy } from "./components/PrivacyPolicy";
import { PuzzleLoader } from "./components/PuzzleLoader";
import type { Crossword } from "./types/crossword";

const DAILY_LABEL = "Today's Knowledge Mix";

/** A message shown on the home screen instead of a pop-up. */
type Notice = {
  tone: "limit" | "error";
  title: string;
  body: string;
};

/** "in 3 h 12 min" / "in 25 min" until the given moment. */
export function timeUntil(when: Date, now: Date = new Date()): string {
  const minutes = Math.max(1, Math.ceil((when.getTime() - now.getTime()) / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `in ${m} min`;
  return m === 0 ? `in ${h} h` : `in ${h} h ${m} min`;
}

export function limitNotice(err: LimitReachedError, now: Date = new Date()): Notice {
  const when = timeUntil(err.resetsAt, now);
  if (err.code === "daily_capacity") {
    return {
      tone: "limit",
      title: "Busy day for puzzles!",
      body:
        `So many new puzzles were made today that new themes are paused. ` +
        `They're back ${when}. Today's puzzle and the featured themes are ready to play now.`,
    };
  }
  return {
    tone: "limit",
    title: "That's all your new themes for today",
    body:
      `You've made ${err.limit} new ${err.limit === 1 ? "puzzle" : "puzzles"} today. ` +
      `New themes unlock ${when}. ` +
      `Until then, today's puzzle and the featured themes are free to play.`,
  };
}

/** "Sunday, 15 November" for the puzzle day. */
export function puzzleDateLabel(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: PUZZLE_TIMEZONE,
  }).format(now);
}

const isPrivacyHash = () => window.location.hash === "#privacy";

export default function App() {
  const [view, setView] = useState<"home" | "playing">("home");
  const [theme, setTheme] = useState("");
  const [currentCrossword, setCurrentCrossword] = useState<Crossword | null>(null);
  // a new number for every puzzle, so the game screen starts fresh
  const [gameId, setGameId] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [newPuzzlesLeft, setNewPuzzlesLeft] = useState<number | null>(null);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [puzzleType, setPuzzleType] = useState<PuzzleType>("daily");
  const isDesktop = useIsDesktop();

  // the privacy policy has its own address (…/#privacy) so it can be linked to
  const [showPrivacy, setShowPrivacy] = useState(isPrivacyHash);
  useEffect(() => {
    const onHashChange = () => {
      setShowPrivacy(isPrivacyHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Android's Back button: privacy policy -> close it, puzzle -> home screen.
  // A ref keeps the listener reading the current screen without re-registering.
  const backRef = useRef<() => boolean>(() => false);
  backRef.current = () => {
    if (showPrivacy) {
      window.location.hash = "";
      return true;
    }
    if (view === "playing") {
      handleBackHome();
      return true;
    }
    return false;
  };
  useEffect(() => onAndroidBack(() => backRef.current()), []);

  const startGame = (cw: Crossword, label: string) => {
    setCurrentCrossword(cw);
    setGameId((n) => n + 1);
    setView("playing");
    console.log(`Generated "${label}" crossword`);
  };

  const handleFinished = ({ seconds, reveals }: { seconds: number; reveals: number }) =>
    track({ name: "puzzle_completed", puzzle_type: puzzleType, seconds, reveals });

  // Generate a puzzle for the given theme text (empty = random mix).
  // The theme is passed in explicitly so callers never depend on React state
  // that has not updated yet (e.g. the theme chips).
  const generate = async (themeText: string) => {
    const wanted = themeText.trim();
    const label = wanted || DAILY_LABEL;
    setNotice(null);
    try {
      setLoadingLabel(label);
      setLoading(true);
      const payload = await generateCrossword(wanted || null, GRID_SIZE);
      if (payload.meta) setNewPuzzlesLeft(payload.meta.new_puzzles_left);
      const cw = backendToCrossword(payload, label);
      const kind = describePuzzle(wanted);
      setPuzzleType(kind.puzzle_type);
      track({ name: "puzzle_started", ...kind, cached: payload.meta?.cached });
      startGame(cw, label);
      // the puzzle was made, so the theme box is empty again for the next idea
      // (after a failure or a reached limit the typed theme is kept)
      setTheme("");
    } catch (err) {
      if (err instanceof LimitReachedError) {
        if (err.code === "player_limit") setNewPuzzlesLeft(0);
        setNotice(limitNotice(err));
        track({ name: "limit_reached", code: err.code });
      } else {
        console.error(err);
        setNotice({
          tone: "error",
          title: "We couldn't make that puzzle",
          body: "Something went wrong on our side. Please try again in a moment.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFromTheme = () => generate(theme);

  const handleRandom = () => generate("");

  const handleBackHome = () => setView("home");

  return (
    <div className="app-bg">
      <div className="app-shell">
        {loading && <PuzzleLoader label={loadingLabel} />}

        {view === "home" && !loading && showPrivacy && <PrivacyPolicy />}

        {view === "home" && !loading && !showPrivacy && (
          <div className="home-layout">
            <div className="home-col">
            <header className="hero">
              <h1 className="app-title">AI Mini Crossword</h1>
              <HeroCrossword />
              <p className="app-tagline">Daily brain play!</p>
              <p className="app-subtitle">
                Challenge your mind with daily, themed mini crosswords.
              </p>
            </header>
            </div>

            <div className="home-col home-col-actions">
            {/* 1. the fastest way to play: one tap, no decisions */}
            <section className="daily-card" aria-labelledby="daily-title">
              <p className="daily-date">{puzzleDateLabel()}</p>
              <h2 className="daily-title" id="daily-title">
                {DAILY_LABEL}
              </h2>
              <p className="daily-text">
                A fresh 7×7 puzzle every day, with topics from all over. Takes about 5 minutes.
              </p>
              <button type="button" className="primary-btn primary-btn-large" onClick={handleRandom}>
                Play today's puzzle
              </button>
              <p className="daily-note">The same puzzle for everyone, new every day</p>
            </section>

            {/* 2. for players who want a topic of their own */}
            <section className="home-section" aria-labelledby="theme-title">
              <h2 className="section-title" id="theme-title">
                Or pick a theme
              </h2>
              {notice && (
                <div
                  className={`notice notice-${notice.tone}`}
                  role={notice.tone === "error" ? "alert" : "status"}
                >
                  <p className="notice-title">{notice.title}</p>
                  <p className="notice-body">{notice.body}</p>
                  {notice.tone === "limit" && (
                    <button type="button" className="notice-action" onClick={handleRandom}>
                      Play today's puzzle instead
                    </button>
                  )}
                  <button
                    type="button"
                    className="notice-close"
                    aria-label="Dismiss message"
                    onClick={() => setNotice(null)}
                  >
                    ×
                  </button>
                </div>
              )}
              <div className="pill-row">
                {FEATURED_THEMES.map((label) => (
                  <button
                    key={label}
                    type="button"
                    className="pill-btn"
                    onClick={() => {
                      setTheme(label);
                      generate(label);
                    }}
                  >
                    <span aria-hidden>{THEME_ICONS[label]}</span>
                    {label}
                  </button>
                ))}
              </div>
              <p className="daily-caption">Featured themes are free to play anytime</p>

              <label className="field-label" htmlFor="theme-input">
                Curious about something else?
              </label>
              <div className="theme-row">
                <input
                  id="theme-input"
                  className="text-input"
                  placeholder="Type any theme"
                  value={theme}
                  maxLength={80}
                  onChange={(e) => setTheme(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && theme.trim()) handleGenerateFromTheme();
                  }}
                />
                <button
                  type="button"
                  className="secondary-btn theme-btn"
                  onClick={handleGenerateFromTheme}
                  disabled={!theme.trim()}
                >
                  Create puzzle
                </button>
              </div>
              {newPuzzlesLeft !== null && newPuzzlesLeft <= 3 && (
                <p className="limit-hint">
                  {newPuzzlesLeft === 0
                    ? "No new themes left today. Themes someone already played today still work."
                    : `${newPuzzlesLeft} new ${newPuzzlesLeft === 1 ? "theme" : "themes"} left today`}
                </p>
              )}
            </section>

            </div>

            {/* 3. for visitors who want to know more before playing */}
            <section className="home-section home-how" aria-labelledby="how-title">
              <h2 className="section-title" id="how-title">
                How it works
              </h2>
              <ol className="how-list">
                <li>
                  <span className="how-number" aria-hidden>
                    1
                  </span>
                  <span>
                    <strong>Pick your puzzle.</strong> Play today's mix or choose any theme you are
                    curious about.
                  </span>
                </li>
                <li>
                  <span className="how-number" aria-hidden>
                    2
                  </span>
                  <span>
                    <strong>Solve it in minutes.</strong> A 7×7 mini crossword, made fresh by AI.
                    Stuck? Show an answer and keep going.
                  </span>
                </li>
                <li>
                  <span className="how-number" aria-hidden>
                    3
                  </span>
                  <span>
                    <strong>Learn something new.</strong> Every clue is a small fact, so you leave
                    knowing a little more than when you came.
                  </span>
                </li>
              </ol>
            </section>

            <footer className="site-footer">
              <a href="#privacy">Privacy Policy</a>
            </footer>
          </div>
        )}

        {view === "playing" && currentCrossword && (
          <Game
            key={gameId}
            crossword={currentCrossword}
            label={currentCrossword.theme}
            isDaily={puzzleType === "daily"}
            isDesktop={isDesktop}
            onBack={handleBackHome}
            onFinished={handleFinished}
          />
        )}
      </div>
    </div>
  );
}