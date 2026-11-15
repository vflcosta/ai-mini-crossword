/**
 * The home screen's signature: the tagline "brain play" drawn as a tiny
 * crossword, with PLAY running down through the A of BRAIN. The letters are
 * "typed in" one after another when the page opens. Decoration only; the
 * tagline is also written out as text for screen readers.
 */
const ROWS = ["  P  ", "  L  ", "BRAIN", "  Y  "];
// order in which the letters appear: BRAIN across, then PLAY down
const ORDER: Record<string, number> = {
  "2-0": 0, "2-1": 1, "2-2": 2, "2-3": 3, "2-4": 4,
  "0-2": 5, "1-2": 6, "3-2": 7,
};
const NUMBERS: Record<string, number> = { "0-2": 1, "2-0": 2 };

export function HeroCrossword() {
  return (
    <div className="hero-grid" aria-hidden>
      {ROWS.map((row, r) =>
        row.split("").map((letter, c) => {
          const key = `${r}-${c}`;
          if (letter === " ") return <span key={key} className="hero-cell hero-cell-empty" />;
          return (
            <span
              key={key}
              className={`hero-cell${r === 2 ? " hero-cell-across" : ""}`}
              style={{ gridRow: r + 1, gridColumn: c + 1 }}
            >
              {NUMBERS[key] && <span className="hero-cell-number">{NUMBERS[key]}</span>}
              <span className="hero-letter" style={{ animationDelay: `${0.25 + ORDER[key] * 0.11}s` }}>
                {letter}
              </span>
            </span>
          );
        })
      )}
    </div>
  );
}
