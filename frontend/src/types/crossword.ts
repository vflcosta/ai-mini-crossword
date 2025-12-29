export interface Cell {
  letter: string;
  number?: number;
  isBlack?: boolean;
}

export interface Clue {
  number: number;
  clue: string;
  answer: string;
  funFact?: string;
  row: number;
  col: number;
  direction: 'across' | 'down';
}

export interface Crossword {
  size: number;
  grid: Cell[][];
  clues: {
    across: Clue[];
    down: Clue[];
  };
  theme: string;
}
