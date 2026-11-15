// frontend/src/components/CrosswordGrid.tsx
import React, { useEffect, useRef } from "react";
import { Cell } from "../types/crossword";

interface CrosswordGridProps {
  grid: Cell[][];
  userAnswers: string[][];
  selectedCell: { row: number; col: number } | null;
  /** direction of the word being filled in; typing and Backspace follow it */
  direction?: "across" | "down";
  onCellClick: (row: number, col: number) => void;
  onAnswerChange: (row: number, col: number, value: string) => void;
}

// 48px squares on phones; index.css sets --cell-size larger on wide screens
const CELL_SIZE = "var(--cell-size, 48px)";

export const CrosswordGrid: React.FC<CrosswordGridProps> = ({
  grid,
  userAnswers,
  selectedCell,
  direction = "across",
  onCellClick,
  onAnswerChange,
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[][]>([]);

  // focus selected cell
  useEffect(() => {
    if (!selectedCell) return;
    const el = inputRefs.current[selectedCell.row]?.[selectedCell.col];
    if (el) el.focus();
  }, [selectedCell]);

  // helper to know if a spot is black / out of bounds
  const isBlack = (r: number, c: number) =>
    r < 0 ||
    c < 0 ||
    r >= grid.length ||
    c >= grid[0].length ||
    grid[r][c].isBlack === true;

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    row: number,
    col: number
  ) => {
    // backspace logic
    if (e.key === "Backspace") {
      e.preventDefault();
      const currentVal = userAnswers[row][col];
      if (currentVal) {
        onAnswerChange(row, col, "");
        return;
      }
      if (direction === "down") {
        // move up within the down word
        if (!isBlack(row - 1, col)) {
          onCellClick(row - 1, col);
          onAnswerChange(row - 1, col, "");
        }
        return;
      }
      // move to previous non-black cell in this row
      let prevCol = col - 1;
      let prevRow = row;
      while (prevCol >= 0 && isBlack(prevRow, prevCol)) {
        prevCol--;
      }
      if (prevCol >= 0) {
        onCellClick(prevRow, prevCol);
        onAnswerChange(prevRow, prevCol, "");
      }
      return;
    }

    // arrow keys
    if (
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight" ||
      e.key === "ArrowUp" ||
      e.key === "ArrowDown"
    ) {
      e.preventDefault();
      let newRow = row;
      let newCol = col;

      if (e.key === "ArrowLeft") newCol--;
      if (e.key === "ArrowRight") newCol++;
      if (e.key === "ArrowUp") newRow--;
      if (e.key === "ArrowDown") newRow++;

      // skip black / out of bounds
      if (!isBlack(newRow, newCol)) {
        onCellClick(newRow, newCol);
      }
    }
  };

  // On a phone, tapping a square that already has the cursor makes iPhone
  // show its "Paste / AutoFill" menu instead of switching between across and
  // down. For that tap the phone's own handling is skipped, and the switch is
  // made here. A tap on any other square (or with the keyboard closed) is left
  // to the phone, so it still moves the cursor and opens the keyboard.
  const handleTouchEnd = (
    e: React.TouchEvent<HTMLInputElement>,
    row: number,
    col: number
  ) => {
    if (document.activeElement !== e.currentTarget) return;
    e.preventDefault();
    onCellClick(row, col);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    row: number,
    col: number
  ) => {
    // Typing on a square that already has a letter replaces it: for a moment
    // the square holds both letters, and the newly typed one is kept.
    // Crossword answers are letters only: digits, spaces and symbols are ignored.
    const typed = e.target.value.toUpperCase();
    const before = userAnswers[row][col] || "";
    if (typed === "") {
      onAnswerChange(row, col, "");
      return;
    }
    const letters = typed.replace(/[^A-Z]/g, "");
    const value =
      typed.length > 1
        ? (letters.replace(before, "") || (letters.length > 1 ? before : "")).slice(-1)
        : letters;
    if (!value) return; // nothing usable was typed: the square stays as it was
    onAnswerChange(row, col, value);

    if (direction === "down") {
      // filling in a down word: move to the square below, stop at the end of the word
      if (!isBlack(row + 1, col)) {
        onCellClick(row + 1, col);
      }
      return;
    }

    // across: move to the next non-black cell in the same row
    let nextCol = col + 1;
    while (nextCol < grid[0].length && isBlack(row, nextCol)) {
      nextCol++;
    }
    if (nextCol < grid[0].length) {
      onCellClick(row, nextCol);
    }
  };

  // the squares of the word being filled in, so it can be highlighted
  const activeWord = new Set<string>();
  if (selectedCell && !isBlack(selectedCell.row, selectedCell.col)) {
    const dr = direction === "down" ? 1 : 0;
    const dc = direction === "down" ? 0 : 1;
    let r = selectedCell.row;
    let c = selectedCell.col;
    while (!isBlack(r - dr, c - dc)) {
      r -= dr;
      c -= dc;
    }
    const cells: string[] = [];
    while (!isBlack(r, c)) {
      cells.push(`${r}-${c}`);
      r += dr;
      c += dc;
    }
    if (cells.length > 1) cells.forEach((k) => activeWord.add(k));
  }

  return (
    <div
      style={{
        background: "#1e1b4b",
        padding: 4,
        borderRadius: 10,
        border: "3px solid #1e1b4b",
        display: "inline-block",
      }}
    >
      {grid.map((row, rIdx) => (
        <div
          key={rIdx}
          style={{
            display: "flex",
            flexDirection: "row",
          }}
        >
          {row.map((cell, cIdx) => {
            // make sure row array exists for refs
            if (!inputRefs.current[rIdx]) {
              inputRefs.current[rIdx] = [];
            }

            const isSelected =
              selectedCell?.row === rIdx && selectedCell?.col === cIdx;

            // render black square
            if (cell.isBlack) {
              return (
                <div
                  key={cIdx}
                  style={{
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    background: "#1e1b4b",
                    border: "1px solid #1e1b4b",
                  }}
                ></div>
              );
            }

            return (
              <div
                key={cIdx}
                onClick={() => onCellClick(rIdx, cIdx)}
                style={{
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    border: "1px solid #1e1b4b",
                    position: "relative",
                    background: isSelected
                      ? "#c4b5fd"
                      : activeWord.has(`${rIdx}-${cIdx}`)
                      ? "#ede9fe"
                      : "#fff",
                }}
              >
                {cell.number ? (
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      left: 4,
                      fontSize: "var(--cell-number-size, 10px)",
                      lineHeight: 1,
                    }}
                  >
                    {cell.number}
                  </span>
                ) : null}
                <input
                  ref={(el) => {
                    inputRefs.current[rIdx][cIdx] = el;
                  }}
                  type="text"
                  data-square
                  // room for one extra character, so a filled square can be typed over
                  maxLength={2}
                  // one letter per square: no word suggestions, no auto-correct
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  value={userAnswers[rIdx][cIdx] || ""}
                  onChange={(e) => handleChange(e, rIdx, cIdx)}
                  onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)}
                  onTouchEnd={(e) => handleTouchEnd(e, rIdx, cIdx)}
                  style={{
                    width: "100%",
                    height: "100%",
                    textAlign: "center",
                    textTransform: "uppercase",
                    fontSize: "var(--cell-letter-size, 22px)",
                    fontWeight: 600,
                    fontFamily: "inherit",
                    color: "#1e1b4b",
                    padding: 0,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    caretColor: "transparent",
                    // no text selection or copy/paste menus on a square
                    WebkitTouchCallout: "none",
                    WebkitUserSelect: "none",
                    userSelect: "none",
                  }}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
