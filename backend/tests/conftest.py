"""
Shared test setup.

The tests never talk to the real Claude API: every test gets a fake client,
so the suite is free, fast, and works without an API key or internet.
"""
import json
import os
from types import SimpleNamespace

import pytest

# Must be set before the app is imported, so a real key is never picked up.
os.environ["ANTHROPIC_API_KEY"] = "test-key-not-real"

from utils import crossword_gen  # noqa: E402


def known_bug(reason: str):
    """
    Marks a test that describes CORRECT behaviour the app does not have yet.

    - While the bug exists, the test is reported as "xfailed" and does not
      block pushes.
    - As soon as the bug is fixed, the test starts passing and pytest fails
      with "XPASS(strict)". That is the signal to delete the @known_bug line
      so the test protects the fix from then on.
    """
    return pytest.mark.xfail(strict=True, reason=f"KNOWN BUG: {reason}")


class FakeAI:
    """Stands in for the Claude client used by crossword_gen."""

    def __init__(self):
        self.replies = []      # queue of str (reply text) or Exception (to raise)
        self.calls = []        # kwargs of every create() call
        self.fill_clue_writer = None  # see write_fill_clues()
        self.messages = SimpleNamespace(create=self._create)

    def _create(self, **kwargs):
        self.calls.append(kwargs)
        prompt = kwargs["messages"][0]["content"]
        if self.fill_clue_writer and crossword_gen.FILL_CLUES_MARKER in prompt:
            answers = self.fill_answers_in(prompt)
            return self._message(json.dumps({a: self.fill_clue_writer(a) for a in answers}))
        if not self.replies:
            raise RuntimeError("FakeAI: no reply queued for this call")
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return self._message(reply)

    @staticmethod
    def _message(text: str):
        # shaped like a real Claude reply: a thinking block, then the text
        return SimpleNamespace(content=[
            SimpleNamespace(type="thinking", thinking="(model thinking)"),
            SimpleNamespace(type="text", text=text),
        ])

    @staticmethod
    def fill_answers_in(prompt: str):
        """The answers a "write clues for these words" prompt asks about."""
        line = next(l for l in prompt.splitlines() if l.startswith(crossword_gen.FILL_CLUES_MARKER))
        return [a.strip() for a in line[len(crossword_gen.FILL_CLUES_MARKER):].split(",")]

    # helpers -------------------------------------------------------------
    def reply_text(self, text: str):
        self.replies.append(text)

    def reply_words(self, across, down=()):
        """Queue a well-formed AI reply. Items are (answer, clue) pairs."""
        self.reply_text(json.dumps({
            "across": [{"clue": c, "answer": a} for a, c in across],
            "down": [{"clue": c, "answer": a} for a, c in down],
        }))

    def write_fill_clues(self, writer=lambda answer: f"Fake clue number {len(answer)}"):
        """
        From now on, answer every "write clues for these words" request (the
        second AI call of a dense puzzle) automatically, using writer(answer).
        """
        self.fill_clue_writer = writer

    def reply_error(self, exc: Exception):
        self.replies.append(exc)

    @property
    def prompts(self):
        return [call["messages"][0]["content"] for call in self.calls]

    @property
    def last_prompt(self) -> str:
        return self.prompts[-1]


@pytest.fixture(autouse=True)
def fake_ai(monkeypatch):
    fake = FakeAI()
    monkeypatch.setattr(crossword_gen, "_client", lambda: fake)
    return fake
