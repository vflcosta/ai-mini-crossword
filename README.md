# AI Mini Crossword

**Daily brain play!** Challenge your mind with daily, themed mini crosswords and
learn something new every day.

Play it at **https://ai-mini-crossword.onrender.com**

AI Mini Crossword makes 5x5 newspaper-style mini crosswords with Claude. Play
today's puzzle, tap a featured theme, or type any topic you are curious about.


## Highlights

* **Today's Knowledge Mix** – one mixed-topic puzzle a day, the same for everyone
* **Featured themes** – History, Space, Art, Nature and Science, one tap each
* **Any theme** – type a topic and get a puzzle about it
* **Newspaper-style grid** – a dense 5x5 where every letter belongs to an across and a down word
* **Made for phones and desktop** – one column on phones, grid plus full clue lists on wide screens
* **Daily limits** – each puzzle is made once a day and shared, which keeps the AI cost low
* **Private by design** – no accounts, no cookies, and the themes players type are never put in the statistics
* **iPhone app** – the same game packed for the App Store (in progress)
* **Tested** – every change must pass the automated tests before it is merged


## Example puzzle (theme: Animals)

```
■ W I F E
■ H O L E
F A T A L
A L A S ■
D E S K ■
```

| Across | Clue | Answer |
| ------ | ---- | ------ |
| 1 | Married woman | WIFE |
| 5 | A burrow is one | HOLE |
| 6 | Deadly | FATAL |
| 7 | "What a pity!" | ALAS |
| 8 | Office furniture | DESK |

| Down | Clue | Answer |
| ---- | ---- | ------ |
| 1 | Largest sea mammal | WHALE |
| 2 | Tiny amounts | IOTAS |
| 3 | Lab bottle | FLASK |
| 4 | Snake-like fish | EEL |
| 6 | Passing craze | FAD |

Themed words go in wherever they fit (here WHALE and EEL) and common English
words fill the rest. See "How a puzzle is built" below.


## API overview

### `POST /generate-crossword`

Returns a puzzle. Without a theme it returns today's puzzle.

#### Example request

```json
{
  "theme": "animals",
  "size": 5
}
```

#### Example response

```json
{
  "grid": [
    ["#", "W", "I", "F", "E"],
    ["#", "H", "O", "L", "E"],
    ["F", "A", "T", "A", "L"],
    ["A", "L", "A", "S", "#"],
    ["D", "E", "S", "K", "#"]
  ],
  "clues": {
    "across": [
      { "number": 1, "clue": "Married woman", "answer": "WIFE" },
      { "number": 5, "clue": "A burrow is one", "answer": "HOLE" }
    ],
    "down": [
      { "number": 1, "clue": "Largest sea mammal", "answer": "WHALE" },
      { "number": 2, "clue": "Tiny amounts", "answer": "IOTAS" }
    ]
  },
  "meta": {
    "cached": false,
    "free": false,
    "new_puzzles_left": 9,
    "resets_at": "2026-11-16T00:00:00+01:00"
  }
}
```

`#` is a black square. `meta` says whether the puzzle already existed today
(`cached`), whether it counts towards the player's daily limit (`free`), how
many new themed puzzles the player has left, and when the limit resets.

When a daily limit is reached the answer is `429` with
`{"detail": {"code", "message", "limit", "resets_at", "retry_after_seconds"}}`,
where `code` is `player_limit` or `daily_capacity`.


## Tech stack

| Part | Technology |
| ---- | ---------- |
| Website | React, TypeScript, Vite |
| Server | Python 3.10+, FastAPI, Uvicorn |
| AI model | Claude Haiku 5.5 (Anthropic) |
| iPhone app | Capacitor 8 |
| Statistics | PostHog (cookieless, EU) |
| Hosting | Render |
| Tests | pytest, Vitest, GitHub Actions |


## Local setup

You need Python 3.10 or newer ([python.org/downloads](https://www.python.org/downloads/))
and Node 22 or newer ([nodejs.org](https://nodejs.org)).

1. **Get the code**

   ```bash
   git clone https://github.com/vflcosta/ai-mini-crossword.git
   cd ai-mini-crossword
   ```

2. **Start the server** (first Terminal window)

   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate        # Windows: venv\Scripts\activate
   pip install -r requirements-dev.txt
   echo "ANTHROPIC_API_KEY=your_api_key_here" > .env
   uvicorn main:app --reload
   ```

   The server runs at http://localhost:8000 (API docs at http://localhost:8000/docs).

3. **Start the website** (second Terminal window)

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   Open the address it prints (http://localhost:3000 or http://localhost:5173).


## Folder structure

```
ai-mini-crossword/
├── backend/
│   ├── main.py                  # the API
│   ├── utils/
│   │   ├── crossword_gen.py     # asks Claude for words and clues, builds the puzzle
│   │   ├── dense_fill.py        # fills the 5x5 newspaper-style grid
│   │   └── puzzle_service.py    # today's puzzles and the daily limits
│   ├── data/words.txt           # common English words for the fill
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # home screen and game
│   │   ├── components/          # grid, clues, loader, privacy policy
│   │   ├── api.ts               # talks to the server
│   │   ├── analytics.ts         # usage statistics
│   │   ├── config.ts            # settings
│   │   └── __tests__/
│   ├── ios/                     # the iPhone app (Xcode project)
│   └── capacitor.config.ts
├── scripts/test-all.sh          # runs every check
├── .githooks/pre-push           # runs the checks before every push
├── .github/workflows/tests.yml  # runs the checks on GitHub
└── render.yaml                  # hosting setup
```


## Testing

Every change (yours or an AI's) has to pass the tests before it can be pushed.

**One-time setup on your computer**

```bash
cd backend && source venv/bin/activate && pip install -r requirements-dev.txt && cd ..
cd frontend && npm install && cd ..
git config core.hooksPath .githooks   # turns on the "tests before push" check
```

**Run all checks by hand**

```bash
./scripts/test-all.sh
```

| What | Where | Run only this part |
| ---- | ----- | ------------------ |
| Puzzle generator, AI replies, API | `backend/tests/` | `cd backend && python -m pytest` |
| Puzzle display, gameplay, backend call | `frontend/src/__tests__/` | `cd frontend && npm test` |

* The tests never call the real AI, so they are free and need no API key.
* `git push` runs everything first and is cancelled if anything fails.
* GitHub runs the same checks on every push and pull request (`.github/workflows/tests.yml`).

**Known bugs.** Some tests describe how the app *should* behave but does not yet.
They are marked `@known_bug(...)` in the backend and `it.fails('KNOWN BUG: ...')`
in the frontend, and show up as "xfailed" / "expected fail" without blocking pushes.
When a bug is fixed, its test starts passing and the run fails with a message
asking you to remove the marker. From then on the test protects the fix.


## How a puzzle is built

1. The AI is asked for about 30 words and clues on the theme.
2. A 5x5 newspaper-style grid is filled: themed words go in wherever they fit
   (usually about 3 of the 10 answers) and common English words from
   `backend/data/words.txt` fill the rest, so every letter belongs to an across
   word and a down word.
3. The AI writes clues for the non-themed words.
4. If step 2 or 3 is not possible (AI offline, or a grid larger than 5x5), a
   simpler layout is used that contains only the AI's words crossing each other.

Each puzzle is kept for the rest of the day and shared: "Today's Knowledge Mix"
(no theme) is made once a day, and so is each theme. Only brand-new puzzles
count towards the daily limits; today's puzzle and the featured themes never
do. See `backend/utils/puzzle_service.py`.

Settings (environment variables on the backend):

| Variable | What it does | Default |
| -------- | ------------ | ------- |
| `ANTHROPIC_API_KEY` | Your Claude API key (required) | none |
| `AI_MODEL` | Which Claude model writes words and clues | `claude-haiku-5-5` |
| `AI_EFFORT` | How much the model thinks: `low`, `medium` or `high` | `low` |
| `PLAYER_DAILY_LIMIT` | New themed puzzles one player can make per day | `10` |
| `GLOBAL_DAILY_LIMIT` | New puzzles all players together can make per day | `500` |
| `PUZZLE_TIMEZONE` | When a new day (and today's puzzle) starts | `Europe/Zurich` |
| `CLIENT_IP_HEADER` | Header with the visitor's real address behind a proxy | none (`True-Client-IP` on Render) |
| `ALLOWED_ORIGINS` | Website addresses allowed to call the backend, comma separated | local dev only |
| `ALLOWED_ORIGIN_REGEX` | Same, as a pattern | none |

Usage statistics go to PostHog (see `frontend/src/analytics.ts`): visits plus
the events `puzzle_started`, `puzzle_completed` and `limit_reached`. They are
cookieless, never include the theme text a player types, and are only sent
from the live site (a production build), not during development. In PostHog,
"Cookieless server hash mode" must be on (Settings > Project > Web analytics).
Build with `VITE_POSTHOG_KEY=` (empty) to switch statistics off.

The website reads the backend's address from `VITE_API_URL` when it is built
(default: `http://127.0.0.1:8000`).

The word list comes from SCOWL (see `backend/data/WORDS_LICENSE.txt`).


## Going live (Render)

`render.yaml` describes the whole setup: a web service for the backend (Starter
size, $7/month) and a free static site for the website.

1. Create an account at [render.com](https://render.com) and connect GitHub.
2. Choose **New > Blueprint** and pick this repository.
3. When asked, paste your `ANTHROPIC_API_KEY`. Click **Apply**.
4. Open the address of the `ai-mini-crossword` site when both services are green.

Every push to `main` then deploys automatically.

The backend runs on Render's Starter size so it is always awake. On the free
size (`plan: free` in `render.yaml`) it sleeps after 15 minutes without
visitors, and the next puzzle takes about a minute while it wakes up. Change the
size in `render.yaml`, not in the Render dashboard: the file is in charge, and a
dashboard change can be undone by the next deploy.


## iPhone app

The iPhone app is the same game packed into an app with [Capacitor](https://capacitorjs.com).
The app project lives in `frontend/ios` and is opened with Xcode (needs a Mac,
Xcode 26 or newer, and Node 22 or newer).

```
cd frontend
npm install
npm run ios
```

`npm run ios` rebuilds the game for the app, copies it into the Xcode project
and opens Xcode. Run it again after every change to the game, then press the
play button in Xcode to try it on a simulator or your iPhone.

Things to know:

- The app talks to the live backend. Its address is in `frontend/.env.ios`;
  change it there if the backend moves.
- The backend accepts the app automatically (`APP_ORIGINS` in `backend/main.py`).
- The app's permanent identity (`appId` in `frontend/capacitor.config.ts`, the
  same value as the Bundle Identifier in Xcode) cannot be changed after the
  first upload to Apple.
- For each new App Store upload, raise the version or build number in Xcode
  (App target, General tab).
- Statistics mark every event with `platform`: `web` or `ios`.

## Next steps

* Release the iPhone app in the App Store, then Google Play
* Difficulty levels (easy, medium, hard)
* Player accounts that remember how many days in a row you have played
* Keep today's puzzles and the limit counters when the server restarts


## Author

**Valentina Lopes da Costa**
Product-minded creator passionate about blending AI, design, and user experience.
[LinkedIn](https://www.linkedin.com/in/valentinahelloworld/) • [GitHub](https://github.com/vflcosta)


## License

MIT License © 2025
