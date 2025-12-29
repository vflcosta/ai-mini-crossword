// frontend/src/components/CrosswordGrid.tsx
import React, { useEffect, useRef } from "react";
import { Cell } from "../types/crossword";

interface CrosswordGridProps {
  grid: Cell[][];
  userAnswers: string[][];
  selectedCell: { row: number; col: number } | null;
  onCellClick: (row: number, col: number) => void;
  onAnswerChange: (row: number, col: number, value: string) => void;
}

const CELL_SIZE = 48; // px – adjust if you want it a bit larger

export const CrosswordGrid: React.FC<CrosswordGridProps> = ({
  grid,
  userAnswers,
  selectedCell,
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    row: number,
    col: number
  ) => {
    const value = e.target.value.toUpperCase().slice(-1);
    onAnswerChange(row, col, value);

    // if user typed a letter, move to the next non-black cell in the same row
    if (value) {
      let nextRow = row;
      let nextCol = col + 1;

      while (nextCol < grid[0].length && isBlack(nextRow, nextCol)) {
        nextCol++;
      }

      if (nextCol < grid[0].length && !isBlack(nextRow, nextCol)) {
        onCellClick(nextRow, nextCol);
      }
    }
  };

  return (
    <div
      style={{
        background: "#111827",
        padding: 4,
        borderRadius: 8,
        border: "3px solid #111827",
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
                    background: "#0f172a",
                    border: "1px solid #1f2937",
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
                    border: "1px solid #9ca3af",
                    position: "relative",
                    background: isSelected ? "#dbeafe" : "#fff",
                }}
              >
                {cell.number ? (
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      left: 4,
                      fontSize: 10,
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
                  maxLength={1}
                  value={userAnswers[rIdx][cIdx] || ""}
                  onChange={(e) => handleChange(e, rIdx, cIdx)}
                  onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)}
                  style={{
                    width: "100%",
                    height: "100%",
                    textAlign: "center",
                    textTransform: "uppercase",
                    fontSize: 20,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    caretColor: "transparent",
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
