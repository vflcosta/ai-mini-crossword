import { Crossword } from '../types/crossword';

export const crosswordData: Record<string, Crossword> = {
  coffee: {
    size: 5,
    theme: 'Coffee',
    grid: [
      [
        { letter: 'B', number: 1 },
        { letter: 'E', number: 2 },
        { letter: 'A', number: 3 },
        { letter: 'N', number: 4 },
        { letter: 'S' }
      ],
      [
        { letter: 'R' },
        { letter: 'S' },
        { isBlack: true },
        { isBlack: true },
        { isBlack: true }
      ],
      [
        { letter: 'E', number: 5 },
        { letter: 'S', number: 6 },
        { letter: 'P', number: 7 },
        { letter: 'R', number: 8 },
        { letter: 'O' }
      ],
      [
        { letter: 'W' },
        { letter: 'O' },
        { isBlack: true },
        { isBlack: true },
        { isBlack: true }
      ],
      [
        { letter: 'M', number: 9 },
        { letter: 'O', number: 10 },
        { letter: 'C', number: 11 },
        { letter: 'H', number: 12 },
        { letter: 'A' }
      ]
    ],
    clues: {
      across: [
        { number: 1, clue: 'Coffee seeds', answer: 'BEANS', funFact: 'Coffee beans are actually seeds from coffee cherries!', row: 0, col: 0, direction: 'across' },
        { number: 5, clue: 'Strong Italian coffee', answer: 'ESPRO', funFact: 'Espresso means "pressed out" in Italian!', row: 2, col: 0, direction: 'across' },
        { number: 9, clue: 'Coffee with chocolate', answer: 'MOCHA', funFact: 'Named after the port city of Mocha in Yemen!', row: 4, col: 0, direction: 'across' }
      ],
      down: [
        { number: 1, clue: 'Make coffee', answer: 'BREW', funFact: 'The perfect brewing temperature is 195-205°F!', row: 0, col: 0, direction: 'down' },
        { number: 2, clue: 'Coffee choice', answer: 'ESSO', funFact: 'Espresso and drip are popular brewing methods!', row: 0, col: 1, direction: 'down' },
        { number: 3, clue: 'Morning beverage', answer: 'AM', funFact: '64% of Americans drink coffee every day!', row: 0, col: 2, direction: 'down' },
        { number: 4, clue: 'Not decaf', answer: 'NORMAL', funFact: 'Regular coffee has about 95mg of caffeine per cup!', row: 0, col: 3, direction: 'down' }
      ]
    }
  },
  space: {
    size: 6,
    theme: 'Space',
    grid: [
      [
        { letter: 'C', number: 1 },
        { letter: 'O', number: 2 },
        { letter: 'M', number: 3 },
        { letter: 'E', number: 4 },
        { letter: 'T' },
        { isBlack: true }
      ],
      [
        { letter: 'O' },
        { letter: 'R' },
        { isBlack: true },
        { isBlack: true },
        { isBlack: true },
        { isBlack: true }
      ],
      [
        { letter: 'S', number: 5 },
        { letter: 'A', number: 6 },
        { letter: 'T', number: 7 },
        { letter: 'U', number: 8 },
        { letter: 'R', number: 9 },
        { letter: 'N' }
      ],
      [
        { letter: 'M' },
        { letter: 'S' },
        { isBlack: true },
        { isBlack: true },
        { isBlack: true },
        { isBlack: true }
      ],
      [
        { letter: 'O', number: 10 },
        { letter: 'R', number: 11 },
        { letter: 'B', number: 12 },
        { letter: 'I', number: 13 },
        { letter: 'T' },
        { isBlack: true }
      ],
      [
        { letter: 'S' },
        { isBlack: true },
        { isBlack: true },
        { isBlack: true },
        { isBlack: true },
        { isBlack: true }
      ]
    ],
    clues: {
      across: [
        { number: 1, clue: 'Icy space rock with tail', answer: 'COMET', funFact: 'Halley\'s Comet visits Earth every 75-76 years!', row: 0, col: 0, direction: 'across' },
        { number: 5, clue: 'Planet with beautiful rings', answer: 'SATURN', funFact: 'Saturn has 82 known moons!', row: 2, col: 0, direction: 'across' },
        { number: 10, clue: 'Path around a planet', answer: 'ORBIT', funFact: 'The ISS orbits Earth every 90 minutes!', row: 4, col: 0, direction: 'across' }
      ],
      down: [
        { number: 1, clue: 'The universe', answer: 'COSMOS', funFact: 'The observable universe is 93 billion light-years across!', row: 0, col: 0, direction: 'down' },
        { number: 2, clue: 'Celestial body path', answer: 'ORBIT', funFact: 'Planets orbit in elliptical paths!', row: 0, col: 1, direction: 'down' },
        { number: 3, clue: 'Red planet', answer: 'MARS', funFact: 'Mars has the largest dust storms in the solar system!', row: 0, col: 2, direction: 'down' },
        { number: 4, clue: 'Our star', answer: 'SUN', funFact: 'The Sun is 109 times wider than Earth!', row: 0, col: 3, direction: 'down' }
      ]
    }
  },
  art: {
    size: 5,
    theme: 'Art',
    grid: [
      [
        { letter: 'P', number: 1 },
        { letter: 'A', number: 2 },
        { letter: 'I', number: 3 },
        { letter: 'N', number: 4 },
        { letter: 'T' }
      ],
      [
        { letter: 'E' },
        { letter: 'R' },
        { isBlack: true },
        { isBlack: true },
        { isBlack: true }
      ],
      [
        { letter: 'N', number: 5 },
        { letter: 'O', number: 6 },
        { letter: 'I', number: 7 },
        { letter: 'R', number: 8 },
        { isBlack: true }
      ],
      [
        { isBlack: true },
        { letter: 'L' },
        { isBlack: true },
        { isBlack: true },
        { isBlack: true }
      ],
      [
        { letter: 'I', number: 9 },
        { letter: 'M', number: 10 },
        { letter: 'A', number: 11 },
        { letter: 'G', number: 12 },
        { letter: 'E' }
      ]
    ],
    clues: {
      across: [
        { number: 1, clue: 'Color on canvas', answer: 'PAINT', funFact: 'The oldest known paintings are 40,000 years old!', row: 0, col: 0, direction: 'across' },
        { number: 5, clue: 'Dark, shadowy style', answer: 'NOIR', funFact: 'Film noir uses dramatic lighting and shadows!', row: 2, col: 0, direction: 'across' },
        { number: 9, clue: 'Visual picture', answer: 'IMAGE', funFact: 'The first photograph was taken in 1826!', row: 4, col: 0, direction: 'across' }
      ],
      down: [
        { number: 1, clue: 'Writing tool', answer: 'PEN', funFact: 'The ballpoint pen was invented in 1938!', row: 0, col: 0, direction: 'down' },
        { number: 2, clue: 'Creative person', answer: 'AROL', funFact: 'The term artist emerged during the Renaissance!', row: 0, col: 1, direction: 'down' },
        { number: 3, clue: 'Black fluid', answer: 'INK', funFact: 'Ancient Egyptians made ink from soot!', row: 0, col: 2, direction: 'down' },
        { number: 4, clue: 'Not wide', answer: 'NARROW', funFact: 'Perspective in art creates depth!', row: 0, col: 3, direction: 'down' }
      ]
    }
  },
  nature: {
    size: 4,
    theme: 'Nature',
    grid: [
      [
        { letter: 'T', number: 1 },
        { letter: 'R', number: 2 },
        { letter: 'E', number: 3 },
        { letter: 'E' }
      ],
      [
        { letter: 'I' },
        { letter: 'A' },
        { isBlack: true },
        { isBlack: true }
      ],
      [
        { letter: 'D', number: 4 },
        { letter: 'E', number: 5 },
        { letter: 'W', number: 6 },
        { isBlack: true }
      ],
      [
        { letter: 'E' },
        { isBlack: true },
        { isBlack: true },
        { isBlack: true }
      ]
    ],
    clues: {
      across: [
        { number: 1, clue: 'Tall woody plant', answer: 'TREE', funFact: 'The tallest tree is over 380 feet high!', row: 0, col: 0, direction: 'across' },
        { number: 4, clue: 'Morning moisture', answer: 'DEW', funFact: 'Dew forms when air cools below its dew point!', row: 2, col: 0, direction: 'across' }
      ],
      down: [
        { number: 1, clue: 'Ocean wave', answer: 'TIDE', funFact: 'Tides are caused by the moon\'s gravity!', row: 0, col: 0, direction: 'down' },
        { number: 2, clue: 'Precipitation', answer: 'RAIN', funFact: 'Raindrops fall at about 20 mph!', row: 0, col: 1, direction: 'down' },
        { number: 3, clue: 'Planet we call home', answer: 'EARTH', funFact: 'Earth is 4.5 billion years old!', row: 0, col: 2, direction: 'down' }
      ]
    }
  },
  science: {
    size: 7,
    theme: 'Science',
    grid: [
      [
        { letter: 'E', number: 1 },
        { letter: 'N', number: 2 },
        { letter: 'E', number: 3 },
        { letter: 'R', number: 4 },
        { letter: 'G', number: 5 },
        { letter: 'Y' },
        { isBlack: true }
      ],
      [
        { letter: 'L' },
        { letter: 'E' },
        { isBlack: true },
        { isBlack: true },
        { isBlack: true },
        { isBlack: true },
        { isBlack: true }
      ],
      [
        { letter: 'E', number: 6 },
        { letter: 'L', number: 7 },
        { letter: 'E', number: 8 },
        { letter: 'C', number: 9 },
        { letter: 'T', number: 10 },
        { letter: 'R', number: 11 },
        { letter: 'O', number: 12 },
        { letter: 'N' }
      ],
      [
        { letter: 'M' },
        { isBlack: true },
        { isBlack: true },
        { isBlack: true },
        { isBlack: true },
        { isBlack: true },
        { isBlack: true }
      ],
      [
        { letter: 'E', number: 13 },
        { letter: 'X', number: 14 },
        { letter: 'P', number: 15 },
        { letter: 'E', number: 16 },
        { letter: 'R', number: 17 },
        { letter: 'T' },
        { isBlack: true }
      ],
      [
        { letter: 'N' },
        { isBlack: true },
        { isBlack: true },
        { isBlack: true },
        { isBlack: true },
        { isBlack: true },
        { isBlack: true }
      ],
      [
        { letter: 'T', number: 18 },
        { letter: 'H', number: 19 },
        { letter: 'E', number: 20 },
        { letter: 'O', number: 21 },
        { letter: 'R', number: 22 },
        { letter: 'Y' },
        { isBlack: true }
      ]
    ],
    clues: {
      across: [
        { number: 1, clue: 'Power to do work', answer: 'ENERGY', funFact: 'Energy cannot be created or destroyed!', row: 0, col: 0, direction: 'across' },
        { number: 6, clue: 'Tiny charged particle', answer: 'ELECTRON', funFact: 'Electrons are 2000 times lighter than protons!', row: 2, col: 0, direction: 'across' },
        { number: 13, clue: 'Scientific specialist', answer: 'EXPERT', funFact: 'It takes 10,000 hours to become an expert!', row: 4, col: 0, direction: 'across' },
        { number: 18, clue: 'Scientific explanation', answer: 'THEORY', funFact: 'Scientific theories must be testable!', row: 6, col: 0, direction: 'across' }
      ],
      down: [
        { number: 1, clue: 'Basic substance', answer: 'ELEMENT', funFact: 'There are 118 known chemical elements!', row: 0, col: 0, direction: 'down' },
        { number: 2, clue: 'Atomic center', answer: 'NUCLEUS', funFact: 'The nucleus contains 99.9% of an atom\'s mass!', row: 0, col: 1, direction: 'down' },
        { number: 3, clue: 'Fair test', answer: 'EXPERIMENT', funFact: 'Controlled experiments test one variable at a time!', row: 0, col: 2, direction: 'down' },
        { number: 4, clue: 'Chemical process', answer: 'REACTION', funFact: 'Some reactions release energy as heat!', row: 0, col: 3, direction: 'down' }
      ]
    }
  }
};

export const getRandomMixCrossword = (): Crossword => {
  const themes = Object.keys(crosswordData);
  const randomTheme = themes[Math.floor(Math.random() * themes.length)];
  return crosswordData[randomTheme];
};

export const getCrosswordByTheme = (theme: string): Crossword | null => {
  const normalizedTheme = theme.toLowerCase().trim();
  return crosswordData[normalizedTheme] || null;
};
