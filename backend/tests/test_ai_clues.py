"""
How the app handles what the AI sends back.

The AI is unpredictable: it can return clean JSON, JSON wrapped in chatter,
nonsense, or nothing at all. Whatever happens, the app must end up with a
usable list of clue/answer pairs and never crash.
"""
import json

from utils.crossword_gen import _fallback, _sanitize_clues, generate_clues


# ---------- cleaning up the AI's words ----------

def test_valid_words_are_kept_and_uppercased():
    raw = {"across": [{"clue": "Feline pet", "answer": "cat"}],
           "down": [{"clue": "Loyal pet", "answer": " Dog "}]}
    assert _sanitize_clues(raw, 7) == {
        "across": [{"clue": "Feline pet", "answer": "CAT"}],
        "down": [{"clue": "Loyal pet", "answer": "DOG"}],
    }


def test_punctuation_and_digits_are_stripped_from_answers():
    raw = {"across": [{"clue": "Feline pet", "answer": "C-A.T!1"}], "down": []}
    assert _sanitize_clues(raw, 7)["across"][0]["answer"] == "CAT"


def test_placeholder_and_blank_clues_are_dropped():
    raw = {"across": [
        {"clue": "(clue)", "answer": "CAT"},
        {"clue": "   ", "answer": "DOG"},
        {"clue": "N/A", "answer": "OWL"},
        {"clue": None, "answer": "RAT"},
        {"clue": "Farm animal", "answer": "PIG"},
    ], "down": []}
    assert [c["answer"] for c in _sanitize_clues(raw, 7)["across"]] == ["PIG"]


def test_answers_that_do_not_fit_the_grid_are_dropped():
    raw = {"across": [
        {"clue": "Too short", "answer": "AT"},
        {"clue": "Too long", "answer": "ELEPHANTS"},
        {"clue": "Just right", "answer": "TIGER"},
        {"clue": "Exactly the grid width", "answer": "PIG" + "LETS"},
    ], "down": []}
    assert [c["answer"] for c in _sanitize_clues(raw, 7)["across"]] == ["TIGER", "PIGLETS"]


def test_vowelless_fragments_are_dropped():
    raw = {"across": [{"clue": "Not a word", "answer": "HSTR"},
                      {"clue": "A word", "answer": "STORY"}], "down": []}
    assert [c["answer"] for c in _sanitize_clues(raw, 7)["across"]] == ["STORY"]


def test_missing_sections_and_missing_answers_do_not_crash():
    assert _sanitize_clues({}, 7) == {"across": [], "down": []}
    assert _sanitize_clues({"across": [{"clue": "No answer"}]}, 7) == {"across": [], "down": []}


# ---------- talking to the AI ----------

def test_clean_ai_reply_is_used(fake_ai):
    fake_ai.reply_words(across=[("CAT", "Feline pet")], down=[("DOG", "Loyal pet")])
    result = generate_clues("animals", 7)
    assert result == {"across": [{"clue": "Feline pet", "answer": "CAT"}],
                      "down": [{"clue": "Loyal pet", "answer": "DOG"}]}
    assert len(fake_ai.calls) == 1


def test_ai_reply_wrapped_in_markdown_or_chatter_is_still_understood(fake_ai):
    body = json.dumps({"across": [{"clue": "Feline pet", "answer": "CAT"}], "down": []})
    fake_ai.reply_text(f"Sure! Here is your crossword:\n```json\n{body}\n```\nEnjoy!")
    assert generate_clues("animals", 7)["across"] == [{"clue": "Feline pet", "answer": "CAT"}]


def test_garbage_reply_is_retried_once_then_falls_back(fake_ai):
    fake_ai.reply_text("I'm sorry, I can't do that.")
    fake_ai.reply_text("{ this is not json")
    assert generate_clues("animals", 7) == _fallback()
    assert len(fake_ai.calls) == 2


def test_second_attempt_is_used_when_first_fails(fake_ai):
    fake_ai.reply_error(TimeoutError("AI timed out"))
    fake_ai.reply_words(across=[("CAT", "Feline pet")])
    assert generate_clues("animals", 7)["across"][0]["answer"] == "CAT"
    assert len(fake_ai.calls) == 2


def test_ai_outage_falls_back_to_built_in_words(fake_ai):
    fake_ai.reply_error(ConnectionError("no internet"))
    fake_ai.reply_error(ConnectionError("no internet"))
    assert generate_clues("animals", 7) == _fallback()


def test_thinking_blocks_in_the_reply_are_ignored(fake_ai):
    from types import SimpleNamespace
    body = json.dumps({"across": [{"clue": "Feline pet", "answer": "CAT"}], "down": []})
    fake_ai.messages.create = lambda **kw: SimpleNamespace(content=[
        SimpleNamespace(type="thinking", thinking='{"across": [{"clue": "x", "answer": "NOPE"}]}'),
        SimpleNamespace(type="text", text=body),
    ])
    assert generate_clues("animals", 7)["across"] == [{"clue": "Feline pet", "answer": "CAT"}]


def test_reply_with_only_unusable_words_falls_back(fake_ai):
    for _ in range(2):
        fake_ai.reply_words(across=[("AT", "Too short"), ("HIPPOPOTAMUS", "Too long")])
    assert generate_clues("animals", 7) == _fallback()


def test_built_in_fallback_words_are_themselves_valid():
    fb = _fallback()
    assert _sanitize_clues(fb, 5) == fb


# ---------- what we ask the AI ----------

def test_prompt_mentions_theme_and_grid_size(fake_ai):
    fake_ai.reply_words(across=[("CAT", "Feline pet")])
    generate_clues("ancient egypt", 6, num=12)
    prompt = fake_ai.last_prompt
    assert '"ancient egypt"' in prompt
    assert "6x6" in prompt
    assert "at least 12" in prompt


def test_prompt_without_theme_asks_for_a_mix(fake_ai):
    fake_ai.reply_words(across=[("CAT", "Feline pet")])
    generate_clues(None, 7)
    assert "Mixed everyday topics" in fake_ai.last_prompt
