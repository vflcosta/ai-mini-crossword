import React from "react";
import { Clue } from "../types/crossword";

interface TypingClueBarProps {
  clue: Clue;
  revealed: boolean;
  /** how far the on-screen keyboard reaches up from the bottom of the page, in pixels */
  keyboardInset: number;
  onPrev: () => void;
  onNext: () => void;
  onReveal: () => void;
}

// Tapping a button in the bar must not take the cursor out of the grid,
// otherwise the phone would close the keyboard.
const keepKeyboardOpen = (e: React.SyntheticEvent) => e.preventDefault();

/**
 * Phones only: the current clue, pinned just above the on-screen keyboard
 * while the player is typing, with arrows to move between clues. Without it
 * the keyboard hides the clue card and its Previous / Next buttons.
 */
export const TypingClueBar: React.FC<TypingClueBarProps> = ({
  clue,
  revealed,
  keyboardInset,
  onPrev,
  onNext,
  onReveal,
}) => (
  <div
    className={`typing-bar${keyboardInset === 0 ? " at-screen-bottom" : ""}`}
    style={{ bottom: keyboardInset }}
    role="region"
    aria-label="Current clue"
  >
    <button
      className="typing-bar-btn"
      aria-label="Previous clue"
      onMouseDown={keepKeyboardOpen}
      onClick={onPrev}
    >
      ‹
    </button>
    <div className="typing-bar-text">
      <span className="typing-bar-meta">
        {clue.number} {clue.direction} · {revealed ? clue.answer : `${clue.answer.length} letters`}
      </span>
      <span className="typing-bar-clue">{clue.clue}</span>
    </div>
    {!revealed && (
      <button
        className="typing-bar-btn typing-bar-reveal"
        aria-label="Reveal this answer"
        onMouseDown={keepKeyboardOpen}
        onClick={onReveal}
      >
        💡
      </button>
    )}
    <button
      className="typing-bar-btn"
      aria-label="Next clue"
      onMouseDown={keepKeyboardOpen}
      onClick={onNext}
    >
      ›
    </button>
  </div>
);
