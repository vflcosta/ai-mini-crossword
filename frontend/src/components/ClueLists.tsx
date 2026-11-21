import type { Clue } from "../types/crossword";

interface ClueListsProps {
  across: Clue[];
  down: Clue[];
  current: Clue | null;
  revealed: Set<string>;
  onSelect: (clue: Clue) => void;
}

/**
 * All clues, Across and Down, shown next to the grid on wide screens. The
 * clue being solved is highlighted; clicking a clue jumps to it in the grid.
 */
export function ClueLists({ across, down, current, revealed, onSelect }: ClueListsProps) {
  const column = (title: string, clues: Clue[]) => (
    <section className="clue-list" aria-label={`${title} clues`}>
      <h3 className="clue-list-title">{title}</h3>
      <ol>
        {clues.map((clue) => {
          const isCurrent =
            current?.number === clue.number && current.direction === clue.direction;
          return (
            <li key={clue.number}>
              <button
                type="button"
                className={`clue-list-item${isCurrent ? " is-current" : ""}`}
                aria-current={isCurrent ? "true" : undefined}
                onClick={() => onSelect(clue)}
              >
                <span className="clue-list-number">{clue.number}</span>
                <span>
                  {clue.clue}
                  {revealed.has(`${clue.number}-${clue.direction}`) && (
                    <span className="clue-list-revealed"> (answer shown)</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );

  return (
    <div className="clue-lists">
      {column("Across", across)}
      {column("Down", down)}
    </div>
  );
}
