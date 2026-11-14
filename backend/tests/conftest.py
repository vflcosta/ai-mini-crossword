"""
Shared test setup.

The tests never talk to the real OpenAI API: every test gets a fake client,
so the suite is free, fast, and works without an API key or internet.
"""
import json
import os
from types import SimpleNamespace

import pytest

# Must be set before the app is imported, so a real key is never picked up.
os.environ["OPENAI_API_KEY"] = "test-key-not-real"

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


class FakeOpenAI:
    """Stands in for the `openai` module used by crossword_gen."""

    def __init__(self):
        self.replies = []      # queue of str (reply text) or Exception (to raise)
        self.calls = []        # kwargs of every create() call
        self.chat = SimpleNamespace(
            completions=SimpleNamespace(create=self._create)
        )

    def _create(self, **kwargs):
        self.calls.append(kwargs)
        if not self.replies:
            raise RuntimeError("FakeOpenAI: no reply queued for this call")
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=reply))]
        )

    # helpers -------------------------------------------------------------
    def reply_text(self, text: str):
        self.replies.append(text)

    def reply_words(self, across, down=()):
        """Queue a well-formed AI reply. Items are (answer, clue) pairs."""
        self.reply_text(json.dumps({
            "across": [{"clue": c, "answer": a} for a, c in across],
            "down": [{"clue": c, "answer": a} for a, c in down],
        }))

    def reply_error(self, exc: Exception):
        self.replies.append(exc)

    @property
    def last_prompt(self) -> str:
        return self.calls[-1]["messages"][0]["content"]


@pytest.fixture(autouse=True)
def fake_openai(monkeypatch):
    fake = FakeOpenAI()
    monkeypatch.setattr(crossword_gen, "openai", fake)
    return fake
