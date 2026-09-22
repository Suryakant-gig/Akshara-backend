"""
Code-switch detection for Akshara.

This one IS fully real, not a heuristic stand-in: distinguishing Telugu-script
text from Latin-script (English) text is a deterministic Unicode-range check,
so this module needs no trained model or external API and works identically
in the MVP and in production.

Current limitation: it classifies TEXT, and this sandbox has no ASR model to
transcribe the child's spoken audio into text (see speech.py). So for now,
this module is wired to two real, working entry points:
  1. Tagging the read-aloud PASSAGE itself, so the system knows in advance
     which words are intentionally code-switched and should never count
     against a child regardless of how they're read.
  2. An optional manual transcript field the teacher can fill in during
     pilot testing, which flows through this exact same function — so
     dropping in a real ASR model later requires zero changes here.
"""
import re
from typing import List
from schemas import CodeSwitchResult, CodeSwitchSpan

TELUGU_RANGE = (0x0C00, 0x0C7F)


def _script_of_token(token: str) -> str:
    telugu_chars = sum(1 for ch in token if TELUGU_RANGE[0] <= ord(ch) <= TELUGU_RANGE[1])
    latin_chars = sum(1 for ch in token if ch.isalpha() and ch.isascii())
    digit_chars = sum(1 for ch in token if ch.isdigit())
    if telugu_chars == 0 and latin_chars == 0 and digit_chars == 0:
        return "other"
    if digit_chars >= telugu_chars and digit_chars >= latin_chars:
        return "digit"
    return "telugu" if telugu_chars >= latin_chars else "latin"


def analyze_code_switching(text: str, primary_script: str = "telugu") -> CodeSwitchResult:
    tokens = [t for t in re.split(r"(\s+)", text) if t.strip()]
    spans: List[CodeSwitchSpan] = []
    for tok in tokens:
        spans.append(CodeSwitchSpan(text=tok, script=_script_of_token(tok)))

    if not spans:
        return CodeSwitchResult(spans=[], code_switch_ratio=0.0, excluded_token_count=0,
                                 notes="No text provided to check.")

    non_primary = [s for s in spans if s.script not in (primary_script, "digit", "other")]
    ratio = len(non_primary) / len(spans)

    return CodeSwitchResult(
        spans=spans,
        code_switch_ratio=round(ratio, 3),
        excluded_token_count=len(non_primary),
        notes=(f"{len(non_primary)} of {len(spans)} tokens are outside the primary script "
               f"({primary_script}) and are excluded from the handwriting/speech risk score rather "
               f"than counted against the child."),
    )
