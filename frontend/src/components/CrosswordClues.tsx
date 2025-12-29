import React from "react";
import { Clue } from "../types/crossword";

interface CrosswordCluesProps {
  across: Clue[];
  down: Clue[];
  onSelectClue: (direction: "across" | "down", index: number, row: number, col: number) => void;
  selectedClueIndex: number | null;
  activeDirection: "across" | "down";
}

export const CrosswordClues: React.FC<CrosswordCluesProps> = ({
  across,
  down,
  onSelectClue,
  selectedClueIndex,
  activeDirection,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Across */}
      <div>
        <h2 className="font-semibold mb-2">Across</h2>
        <ul className="space-y-1">
          {across.map((clue, idx) => {
            const isSelected = activeDirection === "across" && selectedClueIndex === idx;
            return (
              <li
                key={clue.number ?? idx}
                onClick={() =>
                  onSelectClue("across", idx, clue.row ?? 0, clue.col ?? 0)
                }
                className={`cursor-pointer px-2 py-1 rounded ${
                  isSelected ? "bg-blue-100" : "hover:bg-gray-100"
                }`}
              >
                <span className="font-semibold mr-1">{clue.number}.</span>
                <span>{clue.clue}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Down */}
      <div>
        <h2 className="font-semibold mb-2">Down</h2>
        <ul className="space-y-1">
          {down.map((clue, idx) => {
            const isSelected = activeDirection === "down" && selectedClueIndex === idx;
            return (
              <li
                key={clue.number ?? idx}
                onClick={() =>
                  onSelectClue("down", idx, clue.row ?? 0, clue.col ?? 0)
                }
                className={`cursor-pointer px-2 py-1 rounded ${
                  isSelected ? "bg-blue-100" : "hover:bg-gray-100"
                }`}
              >
                <span className="font-semibold mr-1">{clue.number}.</span>
                <span>{clue.clue}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};