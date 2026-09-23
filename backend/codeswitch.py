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

<<<<<<< HEAD
SCRIPT_RANGES = {
    "telugu": (0x0C00, 0x0C7F),
    "tamil": (0x0B80, 0x0BFF),
    "kannada": (0x0C80, 0x0CFF),
    "hindi": (0x0900, 0x097F),
    "latin": (0x0041, 0x007A),
}


def _script_of_token(token: str) -> str:
    counts = {name: 0 for name in SCRIPT_RANGES}
    digit_chars = 0
    other_chars = 0

    for ch in token:
        if ch.isdigit():
            digit_chars += 1
            continue
        if ch.isspace():
            continue
        matched = False
        for script_name, (lower, upper) in SCRIPT_RANGES.items():
            if lower <= ord(ch) <= upper:
                counts[script_name] += 1
                matched = True
                break
        if not matched and ch.isalpha() and ch.isascii():
            counts["latin"] += 1
        elif not matched:
            other_chars += 1

    if digit_chars > 0 and digit_chars >= max(counts.values(), default=0) and digit_chars >= other_chars:
        return "digit"

    if not any(counts.values()) and other_chars == 0:
        return "other"

    best_script = max(counts, key=counts.get)
    return best_script if counts[best_script] > 0 else "other"


def analyze_code_switching(text: str, primary_script: str = "telugu") -> CodeSwitchResult:
    primary = (primary_script or "telugu").lower().strip()
    if primary == "english":
        primary = "latin"
    elif primary not in SCRIPT_RANGES:
        primary = "telugu"

=======
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
>>>>>>> 1b6b45549fd36e347fb91ade279cad86a6326095
    tokens = [t for t in re.split(r"(\s+)", text) if t.strip()]
    spans: List[CodeSwitchSpan] = []
    for tok in tokens:
        spans.append(CodeSwitchSpan(text=tok, script=_script_of_token(tok)))

    if not spans:
        return CodeSwitchResult(spans=[], code_switch_ratio=0.0, excluded_token_count=0,
                                 notes="No text provided to check.")

<<<<<<< HEAD
    non_primary = [s for s in spans if s.script not in (primary, "digit", "other")]
=======
    non_primary = [s for s in spans if s.script not in (primary_script, "digit", "other")]
>>>>>>> 1b6b45549fd36e347fb91ade279cad86a6326095
    ratio = len(non_primary) / len(spans)

    return CodeSwitchResult(
        spans=spans,
        code_switch_ratio=round(ratio, 3),
        excluded_token_count=len(non_primary),
        notes=(f"{len(non_primary)} of {len(spans)} tokens are outside the primary script "
<<<<<<< HEAD
               f"({primary}) and are excluded from the handwriting/speech risk score rather "
=======
               f"({primary_script}) and are excluded from the handwriting/speech risk score rather "
>>>>>>> 1b6b45549fd36e347fb91ade279cad86a6326095
               f"than counted against the child."),
    )
