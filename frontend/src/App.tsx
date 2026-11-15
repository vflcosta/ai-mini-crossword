import React, { useState, useEffect } from "react";
import { CrosswordGrid } from "./components/CrosswordGrid";
import { backendToCrossword } from "./utils/transform";
import { generateCrossword, LimitReachedError } from "./api";
import { FEATURED_THEMES, GRID_SIZE, PUZZLE_TIMEZONE, THEME_ICONS } from "./config";
import { HeroCrossword } from "./components/HeroCrossword";
import { ClueLists } from "./components/ClueLists";
import { useIsDesktop } from "./hooks";
import { describePuzzle, track, type PuzzleType } from "./analytics";
import { PrivacyPolicy } from "./components/PrivacyPolicy";
import { PuzzleLoader } from "./components/PuzzleLoader";
import { Crossword, Clue } from "./types/crossword";

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
  const [userAnswers, setUserAnswers] = useState<string[][]>([]);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [currentClue, setCurrentClue] = useState<Clue | null>(null);
  const [currentDirection, setCurrentDirection] = useState<"across" | "down">("across");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [completionTime, setCompletionTime] = useState<number | null>(null);
  const [showCompletion, setShowCompletion] = useState(false);
  const [loading, setLoading] = useState(false);
  const [revealedClues, setRevealedClues] = useState<Set<string>>(new Set());
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

  // timer
  useEffect(() => {
    let id: number | undefined;
    if (isTimerRunning) {
      id = window.setInterval(() => setElapsedTime((t) => t + 1), 1000);
    }
    return () => {
      if (id) window.clearInterval(id);
    };
  }, [isTimerRunning]);

  // auto-finish check
  useEffect(() => {
    if (!currentCrossword || !isTimerRunning) return;
    let complete = true;
    for (let r = 0; r < currentCrossword.size; r++) {
      for (let c = 0; c < currentCrossword.size; c++) {
        const cell = currentCrossword.grid[r][c];
        if (!cell.isBlack && userAnswers[r][c] !== cell.letter) {
          complete = false;
          break;
        }
      }
    }
    if (complete) {
      setIsTimerRunning(false);
      setCompletionTime(elapsedTime);
      setShowCompletion(true);
      track({
        name: "puzzle_completed",
        puzzle_type: puzzleType,
        seconds: elapsedTime,
        reveals: revealedClues.size,
      });
    }
  }, [userAnswers, currentCrossword, isTimerRunning, elapsedTime]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const startGame = (cw: Crossword, label: string) => {
    setCurrentCrossword(cw);
    setUserAnswers(Array.from({ length: cw.size }, () => Array(cw.size).fill("")));
    setSelectedCell(null);
    setCurrentClue(null);
    setCurrentDirection("across");
    setElapsedTime(0);
    setIsTimerRunning(true);
    setRevealedClues(new Set());
    setView("playing");
    console.log(`Generated "${label}" crossword`);
  };

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

  // find clue for cell & direction
  const findClueForCell = (
    row: number,
    col: number,
    dir: "across" | "down"
  ): Clue | null => {
    if (!currentCrossword) return null;
    const list = dir === "across" ? currentCrossword.clues.across : currentCrossword.clues.down;
    for (const clue of list) {
      if (dir === "across") {
        if (clue.row === row && col >= clue.col && col < clue.col + clue.answer.length) {
          return clue;
        }
      } else {
        if (clue.col === col && row >= clue.row && row < clue.row + clue.answer.length) {
          return clue;
        }
      }
    }
    return null;
  };

  const handleCellClick = (row: number, col: number) => {
    if (selectedCell?.row === row && selectedCell?.col === col) {
      // toggle direction if clicking same cell
      const nextDir = currentDirection === "across" ? "down" : "across";
      setCurrentDirection(nextDir);
      setCurrentClue(findClueForCell(row, col, nextDir));
    } else {
      // try current direction first
      const clue = findClueForCell(row, col, currentDirection);
      if (clue) {
        setCurrentClue(clue);
      } else {
        // fallback to the other
        const other = currentDirection === "across" ? "down" : "across";
        const otherClue = findClueForCell(row, col, other);
        if (otherClue) {
          setCurrentDirection(other);
          setCurrentClue(otherClue);
        }
      }
    }
    setSelectedCell({ row, col });
  };

  const handleAnswerChange = (row: number, col: number, value: string) => {
    const next = userAnswers.map((r) => [...r]);
    next[row][col] = value.toUpperCase();
    setUserAnswers(next);
  };

  const getAllClues = (): Clue[] => {
    if (!currentCrossword) return [];
    return [...currentCrossword.clues.across, ...currentCrossword.clues.down].sort((a, b) => {
      if (a.number !== b.number) return a.number - b.number;
      // across first if same number
      return a.direction === "across" ? -1 : 1;
    });
  };

  const handlePrevClue = () => {
    if (!currentClue) return;
    const all = getAllClues();
    const i = all.findIndex(
      (c) => c.number === currentClue.number && c.direction === currentClue.direction
    );
    if (i > 0) {
      const prev = all[i - 1];
      setCurrentClue(prev);
      setCurrentDirection(prev.direction);
      setSelectedCell({ row: prev.row, col: prev.col });
    }
  };

  const handleSelectClue = (clue: Clue) => {
    setCurrentClue(clue);
    setCurrentDirection(clue.direction);
    setSelectedCell({ row: clue.row, col: clue.col });
  };

  const handleNextClue = () => {
    if (!currentClue) return;
    const all = getAllClues();
    const i = all.findIndex(
      (c) => c.number === currentClue.number && c.direction === currentClue.direction
    );
    if (i < all.length - 1) {
      const nxt = all[i + 1];
      setCurrentClue(nxt);
      setCurrentDirection(nxt.direction);
      setSelectedCell({ row: nxt.row, col: nxt.col });
    }
  };

  const handleBackHome = () => {
    setView("home");
    setIsTimerRunning(false);
  };

  // start the same puzzle again: empty grid, timer and reveals back to zero
  // (no new puzzle is requested, so it costs nothing and needs no network)
  const handleReset = () => {
    if (currentCrossword) startGame(currentCrossword, currentCrossword.theme);
    setShowCompletion(false);
    setCompletionTime(null);
  };

  const clueKey = (c: Clue) => `${c.number}-${c.direction}`;

  const revealClue = () => {
    if (!currentClue) return;
    setRevealedClues((prev) => {
      const n = new Set(prev);
      n.add(clueKey(currentClue));
      return n;
    });
  };

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
                A fresh 5×5 puzzle every day, with topics from all over. Takes about 5 minutes.
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
                    <strong>Solve it in minutes.</strong> A 5×5 mini crossword, made fresh by AI.
                    Stuck? Reveal an answer and keep going.
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
          <div className="play-wrapper play-game">
            <div className="play-topbar">
              <button className="link-btn" onClick={handleBackHome}>
                ← Back to Home
              </button>
              <div className="timer-box">
                <span className="timer-icon" aria-hidden>
                  ⏱
                </span>
                <span className="timer-text">{formatTime(elapsedTime)}</span>
              </div>
              <button className="link-btn" onClick={handleReset}>
                ⟲ Reset
              </button>
            </div>

            <div className="grid-wrapper">
              <CrosswordGrid
                grid={currentCrossword.grid}
                userAnswers={userAnswers}
                selectedCell={selectedCell}
                direction={currentDirection}
                onCellClick={handleCellClick}
                onAnswerChange={handleAnswerChange}
              />
            </div>

            <div className="play-side">
            <div className="clue-card">
              {currentClue ? (
                <>
                  <div className="clue-header">
                    <span className="clue-pill">
                      {currentClue.number} {currentDirection}
                    </span>
                    {revealedClues.has(clueKey(currentClue)) && (
                      <span className="clue-revealed">revealed</span>
                    )}
                  </div>
                  <h3 className="clue-title">{currentClue.clue}</h3>
                  <p className="clue-meta">
                    {currentClue.direction === "across" ? "Across" : "Down"} •{" "}
                    {currentClue.answer.length} letters
                  </p>

                  <div className="answer-block">
                    <p className="answer-label">ANSWER</p>
                    <p className="answer-value">
                      {revealedClues.has(clueKey(currentClue))
                        ? currentClue.answer
                        : currentClue.answer.replace(/./g, "•")}
                    </p>
                    {!revealedClues.has(clueKey(currentClue)) && (
                      <button className="reveal-btn" onClick={revealClue}>
                        Reveal answer
                      </button>
                    )}
                  </div>

                  <div className="clue-nav">
                    <button className="secondary-btn small" onClick={handlePrevClue}>
                      ← Previous
                    </button>
                    <button className="secondary-btn small" onClick={handleNextClue}>
                      Next →
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="clue-title">Select a clue</h3>
                  <p className="clue-meta">Click on a numbered cell to see its clue</p>
                </>
              )}
            </div>
            {isDesktop && (
              <ClueLists
                across={currentCrossword.clues.across}
                down={currentCrossword.clues.down}
                current={currentClue}
                revealed={revealedClues}
                onSelect={handleSelectClue}
              />
            )}
            </div>

            {showCompletion && (
              <div className="modal-backdrop" onClick={() => setShowCompletion(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()}>
                  <h2>🎉 Puzzle complete!</h2>
                  <p>You solved it in {formatTime(completionTime || 0)}.</p>
                  <p className="reveal-summary">
                    {revealedClues.size === 0
                      ? "🌟 No reveals – solved all on your own!"
                      : `💡 ${revealedClues.size} ${
                          revealedClues.size === 1 ? "answer" : "answers"
                        } revealed`}
                  </p>
                  <div className="modal-actions">
                    <button className="primary-btn" onClick={handleBackHome}>
                      Back to home
                    </button>
                    <button className="secondary-btn" onClick={() => setShowCompletion(false)}>
                      Review
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}