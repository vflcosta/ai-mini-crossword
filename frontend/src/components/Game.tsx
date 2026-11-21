import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Clue, Crossword } from "../types/crossword";
import {
  afterTyping,
  clueAt,
  clueFontSize,
  clueKey,
  clueOrder,
  firstEmpty,
  formatTime,
  isSolved,
  key,
  stepBack,
  type Answers,
  type Dir,
  type Pos,
} from "../utils/play";
import { ClueLists } from "./ClueLists";

/**
 * The game screen, as designed in Claude Design ("single clue panel"):
 * a 7x7 grid, one clue bar docked above the app's own A–Z keyboard, and a
 * results sheet at the end. No text box is used while solving, so phones never
 * open their own keyboard (no autocorrect, no word suggestions, no Safari
 * bars). A physical keyboard works too.
 */
interface GameProps {
  crossword: Crossword;
  /** "Today's Knowledge Mix" or the theme */
  label: string;
  isDaily: boolean;
  /** wide screens: two columns and the clue lists, no on-screen keyboard */
  isDesktop: boolean;
  onBack: () => void;
  onFinished: (result: { seconds: number; reveals: number }) => void;
}

const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const SITE = "https://ai-mini-crossword.onrender.com";

const emptyAnswers = (cw: Crossword): Answers =>
  Array.from({ length: cw.size }, () => Array(cw.size).fill(""));

function startPosition(cw: Crossword): { pos: Pos; dir: Dir } {
  const first = clueOrder(cw)[0];
  return first ? { pos: { row: first.row, col: first.col }, dir: first.direction } : { pos: { row: 0, col: 0 }, dir: "across" };
}

export function shareText(label: string, isDaily: boolean, seconds: number, shown: number): string {
  const what = isDaily ? "today's AI Mini Crossword" : `a ${label} puzzle on AI Mini Crossword`;
  const help = shown === 0 ? " with no help" : ` with ${shown} ${shown === 1 ? "answer" : "answers"} shown`;
  return `I solved ${what} in ${formatTime(seconds)}${help}! ${SITE}`;
}

export function Game({ crossword: cw, label, isDaily, isDesktop, onBack, onFinished }: GameProps) {
  const start = useMemo(() => startPosition(cw), [cw]);
  const [answers, setAnswers] = useState<Answers>(() => emptyAnswers(cw));
  const [pos, setPos] = useState<Pos>(start.pos);
  const [dir, setDir] = useState<Dir>(start.dir);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [sheet, setSheet] = useState(false);
  // clues whose answer was shown at least once (counted), and those showing now
  const [shownEver, setShownEver] = useState<Set<string>>(new Set());
  const [showing, setShowing] = useState<Set<string>>(new Set());
  // squares typed while their answer was on show: they get a corner flag
  const [helped, setHelped] = useState<Set<string>>(new Set());
  const [shareNote, setShareNote] = useState("");

  const clue: Clue | null =
    clueAt(cw, pos, dir) ?? clueAt(cw, pos, dir === "across" ? "down" : "across");
  const curDir: Dir = clue?.direction ?? dir;
  const word = new Set(clue ? cellsKeys(clue) : []);
  const answerOnShow = clue ? showing.has(clueKey(clue)) : false;
  const reviewing = finished && !sheet;

  // timer: runs until the puzzle is solved
  useEffect(() => {
    if (finished) return;
    const id = window.setInterval(() => setElapsed((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [finished]);

  // solved? stop the clock and show the results
  const reported = useRef(false);
  useEffect(() => {
    if (finished || !isSolved(cw, answers)) return;
    setFinished(true);
    setSheet(true);
    if (!reported.current) {
      reported.current = true;
      onFinished({ seconds: elapsed, reveals: shownEver.size });
    }
  }, [answers]); // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (c: Clue) => {
    setPos(firstEmpty(c, answers));
    setDir(c.direction);
  };

  const step = (by: number) => {
    if (!clue) return;
    const order = clueOrder(cw);
    const i = order.findIndex((c) => clueKey(c) === clueKey(clue));
    goTo(order[(i + by + order.length) % order.length]);
  };

  const switchDirection = () => {
    const other: Dir = curDir === "across" ? "down" : "across";
    if (clueAt(cw, pos, other)) setDir(other);
  };

  const tapCell = (p: Pos) => {
    if (cw.grid[p.row][p.col].isBlack) return;
    if (p.row === pos.row && p.col === pos.col) return switchDirection();
    setPos(p);
    if (!clueAt(cw, p, curDir)) setDir(curDir === "across" ? "down" : "across");
    else setDir(curDir);
  };

  const typeLetter = useCallback(
    (letter: string) => {
      if (finished || !clue) return;
      const next = answers.map((r) => [...r]);
      next[pos.row][pos.col] = letter;
      if (showing.has(clueKey(clue))) setHelped((h) => new Set(h).add(key(pos)));
      setAnswers(next);
      const to = afterTyping(cw, next, pos, clue);
      setPos(to.pos);
      setDir(to.dir);
    },
    [finished, clue, answers, pos, showing, cw]
  );

  const deleteLetter = useCallback(() => {
    if (finished || !clue) return;
    const next = answers.map((r) => [...r]);
    if (next[pos.row][pos.col]) {
      next[pos.row][pos.col] = "";
    } else {
      const back = stepBack(pos, clue);
      next[back.row][back.col] = "";
      setPos(back);
    }
    setAnswers(next);
  }, [finished, clue, answers, pos]);

  const move = useCallback(
    (dr: number, dc: number) => {
      const r = pos.row + dr;
      const c = pos.col + dc;
      setDir(dr === 0 ? "across" : "down");
      if (r < 0 || c < 0 || r >= cw.size || c >= cw.size || cw.grid[r][c].isBlack) return;
      setPos({ row: r, col: c });
    },
    [pos, cw]
  );

  // a physical keyboard (computers, tablets with a keyboard) types too
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[a-z]$/i.test(e.key)) {
        e.preventDefault();
        typeLetter(e.key.toUpperCase());
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        deleteLetter();
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const moves: Record<string, [number, number]> = {
          ArrowLeft: [0, -1],
          ArrowRight: [0, 1],
          ArrowUp: [-1, 0],
          ArrowDown: [1, 0],
        };
        const m = moves[e.key];
        if (m) move(m[0], m[1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [typeLetter, deleteLetter, move]);

  const toggleAnswer = () => {
    if (!clue) return;
    const k = clueKey(clue);
    setShowing((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
    setShownEver((s) => new Set(s).add(k));
  };

  const reset = () => {
    setAnswers(emptyAnswers(cw));
    setPos(start.pos);
    setDir(start.dir);
    setElapsed(0);
    setFinished(false);
    setSheet(false);
    setShownEver(new Set());
    setShowing(new Set());
    setHelped(new Set());
    setShareNote("");
    reported.current = false;
  };

  const share = async () => {
    const text = shareText(label, isDaily, elapsed, shownEver.size);
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setShareNote("Copied, ready to paste");
      }
    } catch {
      // the player closed the share menu: nothing to do
    }
  };

  const helpCount = shownEver.size;

  const clueBar = clue && (
    <section className="clue-bar" aria-label="Current clue">
      <button type="button" className="clue-bar-arrow" aria-label="Previous clue" onClick={() => step(-1)}>
        <Chevron dir="left" />
      </button>
      <button
        type="button"
        className="clue-bar-text"
        aria-label={`${clue.number} ${curDir}, ${clue.answer.length} letters: ${clue.clue}. Tap to switch between across and down`}
        onClick={switchDirection}
      >
        {answerOnShow ? (
          <span className="clue-bar-answer">
            <span className="clue-bar-answer-label">Answer</span>
            <span className="clue-bar-answer-word">{clue.answer}</span>
          </span>
        ) : (
          <span className="clue-bar-tag">
            {clue.number} {curDir} · {clue.answer.length} letters
          </span>
        )}
        <span className="clue-bar-clue" style={{ fontSize: clueFontSize(clue.clue) }}>
          {clue.clue}
        </span>
      </button>
      {!reviewing && (
        <button
          type="button"
          className={`clue-bar-bulb${answerOnShow ? " is-on" : ""}`}
          aria-label={answerOnShow ? "Hide answer" : "Show answer for this clue"}
          aria-pressed={answerOnShow}
          onClick={toggleAnswer}
        >
          <BulbIcon />
        </button>
      )}
      <button type="button" className="clue-bar-arrow" aria-label="Next clue" onClick={() => step(1)}>
        <Chevron dir="right" />
      </button>
    </section>
  );

  const keyboard = (
    <div className="letter-keyboard" aria-label="Letter keyboard">
      {KEY_ROWS.map((row, i) => (
        <div key={row} className={`letter-keyboard-row${i === 1 ? " is-middle" : ""}`}>
          {row.split("").map((k) => (
            <button key={k} type="button" className="letter-key" onClick={() => typeLetter(k)}>
              {k}
            </button>
          ))}
          {i === 2 && (
            <button type="button" className="letter-key letter-key-delete" aria-label="Delete" onClick={deleteLetter}>
              <DeleteIcon />
            </button>
          )}
        </div>
      ))}
    </div>
  );

  const results = (
    <section role="dialog" aria-label="Puzzle complete" className="results-sheet">
      <div className="results-head">
        <div className="results-check" aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </div>
        <h2 className="results-title">Puzzle complete!</h2>
        <p className="results-text">
          You solved {isDaily ? "today's puzzle" : `the ${label} puzzle`} in {formatTime(elapsed)}.
        </p>
      </div>
      <div className="results-stats">
        <div className="results-stat">
          <div className="results-stat-value">{formatTime(elapsed)}</div>
          <div className="results-stat-label">Time</div>
        </div>
        <div className="results-stat">
          <div className="results-stat-value">{helpCount}</div>
          <div className="results-stat-label">
            {helpCount === 0 ? "No help used" : helpCount === 1 ? "Answer shown" : "Answers shown"}
          </div>
        </div>
      </div>
      <div className="results-actions">
        <button type="button" className="primary-btn results-home" onClick={onBack}>
          Back to home
        </button>
        <div className="results-row">
          <button type="button" className="results-btn" onClick={() => setSheet(false)}>
            Review puzzle
          </button>
          <button type="button" className="results-btn" onClick={share}>
            <ShareIcon />
            Share result
          </button>
        </div>
        {shareNote && (
          <p className="results-note" role="status">
            {shareNote}
          </p>
        )}
      </div>
    </section>
  );

  const reviewBar = (
    <div className="review-bar">
      <span>Reviewing · tap any square or use the arrows</span>
      <button type="button" className="results-btn" onClick={() => setSheet(true)}>
        Results
      </button>
    </div>
  );

  return (
    <div className={`game${isDesktop ? " is-desktop" : ""}`}>
      <header className="game-header">
        <button type="button" className="game-back" aria-label="Back to Home" onClick={onBack}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5" />
            <path d="M11 6l-6 6 6 6" />
          </svg>
        </button>
        {finished ? (
          <div className="game-timer is-done">Solved in {formatTime(elapsed)}</div>
        ) : (
          <div className="game-timer" aria-label="Time">
            {formatTime(elapsed)}
          </div>
        )}
        <button type="button" className="game-reset" onClick={reset}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 12a8 8 0 1 0 2.4-5.7" />
            <path d="M4 4v4h4" />
          </svg>
          Reset
        </button>
      </header>

      <div className="game-body">
        <main className="game-main">
          <div
            role="grid"
            aria-label="Crossword grid"
            className="game-grid"
            style={{ gridTemplateColumns: `repeat(${cw.size}, minmax(0, 1fr))` }}
          >
            {cw.grid.map((row, r) =>
              row.map((cell, c) => {
                const k = `${r},${c}`;
                const isCur = r === pos.row && c === pos.col;
                const letter = answers[r][c];
                const state = cell.isBlack
                  ? " is-black"
                  : isCur
                    ? " is-current"
                    : word.has(k)
                      ? " is-word"
                      : "";
                return (
                  <button
                    key={k}
                    type="button"
                    data-square={cell.isBlack ? undefined : k}
                    className={`game-cell${state}`}
                    disabled={cell.isBlack}
                    aria-label={
                      cell.isBlack
                        ? "Black square"
                        : `Row ${r + 1}, column ${c + 1}${letter ? `, ${letter}` : ", empty"}`
                    }
                    onClick={() => tapCell({ row: r, col: c })}
                  >
                    {cell.number && <span className="game-cell-number">{cell.number}</span>}
                    {letter}
                    {helped.has(k) && <span className="game-cell-flag" data-flag aria-hidden="true" />}
                  </button>
                );
              })
            )}
          </div>
        </main>

        <div className="game-side">
          {!sheet && clueBar}
          {isDesktop && !sheet && (
            <ClueLists
              across={cw.clues.across}
              down={cw.clues.down}
              current={clue}
              revealed={shownEver}
              onSelect={goTo}
            />
          )}
          {!finished && !isDesktop && keyboard}
          {sheet && results}
          {reviewing && reviewBar}
        </div>
      </div>
    </div>
  );
}

function cellsKeys(clue: Clue): string[] {
  return Array.from({ length: clue.answer.length }, (_, i) =>
    clue.direction === "across" ? `${clue.row},${clue.col + i}` : `${clue.row + i},${clue.col}`
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

function BulbIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 5H9l-6 7 6 7h12z" />
      <path d="M17 9l-6 6" />
      <path d="M11 9l6 6" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M7 8l5-5 5 5" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  );
}
