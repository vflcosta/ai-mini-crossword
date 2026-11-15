import { GRID_SIZE } from "../config";

interface PuzzleLoaderProps {
  /** what is being made, e.g. "History" or "Today's Knowledge Mix" */
  label: string;
}

/**
 * Shown while a puzzle is being generated: a grey, shimmering outline of the
 * game screen (grid and clue card) so the player sees what is coming, plus a
 * message that it can take up to a minute.
 */
export function PuzzleLoader({ label }: PuzzleLoaderProps) {
  const cells = Array.from({ length: GRID_SIZE * GRID_SIZE });
  return (
    <div className="play-wrapper loader" role="status" aria-live="polite" aria-busy="true">
      <div className="loader-message">
        <p className="loader-title">Creating your {label} crossword…</p>
        <p className="loader-subtitle">
          This can take up to 1 minute. Your puzzle will open by itself.
        </p>
      </div>

      <div className="grid-wrapper" aria-hidden>
        <div
          className="skeleton-grid"
          style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 48px)` }}
        >
          {cells.map((_, i) => (
            <div
              key={i}
              className="skeleton skeleton-cell"
              style={{ animationDelay: `${((i % GRID_SIZE) + Math.floor(i / GRID_SIZE)) * 0.08}s` }}
            />
          ))}
        </div>
      </div>

      <div className="clue-card" aria-hidden>
        <div className="skeleton skeleton-line" style={{ width: "35%" }} />
        <div className="skeleton skeleton-line" style={{ width: "90%" }} />
        <div className="skeleton skeleton-line" style={{ width: "60%" }} />
      </div>
    </div>
  );
}
