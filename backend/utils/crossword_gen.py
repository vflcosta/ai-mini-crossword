import os
import json
from dotenv import load_dotenv
import openai

# Load OpenAI API key
load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")


def generate_clues(theme=None, num_clues=5):
    """
    Generate clues and answers from GPT for a fixed 5x5 grid.
    All answers are 3–5 letters to fit the grid.
    Returns a dictionary: {"across": [...], "down": [...]}
    """
    if theme:
        prompt = f"""
        Assume you are an expert crossword constructor.
        Generate {num_clues} family-friendly clues and answers for a 5x5 mini crossword puzzle
        about the theme '{theme}'.
        **All answers must be 3–5 letters long** to fit a 5x5 grid.
        Return a JSON object like:
        {{
            "across": [{{"number": 1, "clue": "Clue text", "answer": "ANSWER"}}],
            "down": [{{"number": 2, "clue": "Clue text", "answer": "ANSWER"}}]
        }}
        Ensure answers are full words (no truncation) and PG-13.
        """
    else:
        prompt = f"""
        Assume you are an expert crossword constructor.
        Generate {num_clues} family-friendly clues and answers for a random multi-topic 5x5 mini crossword.
        **All answers must be 3–5 letters long** to fit the 5x5 grid.
        Return a JSON object like:
        {{
            "across": [{{"number": 1, "clue": "Clue text", "answer": "ANSWER"}}],
            "down": [{{"number": 2, "clue": "Clue text", "answer": "ANSWER"}}]
        }}
        Ensure answers are full words (no truncation) and PG-13.
        Do NOT use the words 'null', 'nothing', or 'empty' as a theme.
        """

    try:
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
        )

        return json.loads(response.choices[0].message.content)

    except json.JSONDecodeError:
        return {"error": "Failed to parse GPT output.", "raw": response.choices[0].message.content}
    except Exception as e:
        return {"error": str(e)}


def place_words_in_grid(clues, size=5):
    """
    Place words from clues into a 5x5 grid.
    Tries to maximize intersections between across and down words.
    Returns: 2D list with letters and "" for empty cells.
    """
    grid = [["" for _ in range(size)] for _ in range(size)]

    # Across: place words in rows 0,2,4
    for idx, word_obj in enumerate(clues.get("across", [])):
        row = idx * 2
        if row >= size:
            continue
        word = word_obj["answer"].upper()
        # Try to start at a column that intersects existing down words
        start_col = 0
        for col in range(size - len(word) + 1):
            can_place = True
            for i, letter in enumerate(word):
                if grid[row][col + i] not in ("", letter):
                    can_place = False
                    break
            if can_place:
                start_col = col
                break
        # Place the word
        for i, letter in enumerate(word[:size]):
            grid[row][start_col + i] = letter

    # Down: place words in columns 0,2,4
    for idx, word_obj in enumerate(clues.get("down", [])):
        col = idx * 2
        if col >= size:
            continue
        word = word_obj["answer"].upper()
        # Try to start at a row that intersects existing across words
        start_row = 0
        for row in range(size - len(word) + 1):
            can_place = True
            for i, letter in enumerate(word):
                if grid[row + i][col] not in ("", letter):
                    can_place = False
                    break
            if can_place:
                start_row = row
                break
        # Place the word
        for i, letter in enumerate(word[:size]):
            grid[start_row + i][col] = letter

    return grid


def generate_crossword(theme=None, size=5):
    """
    Generate a crossword JSON ready for frontend rendering.
    Returns: {"grid": [...], "clues": {...}}
    """
    clues = generate_clues(theme=theme, num_clues=5)
    if "error" in clues:
        return clues

    grid = place_words_in_grid(clues, size=size)
    return {"grid": grid, "clues": clues}


