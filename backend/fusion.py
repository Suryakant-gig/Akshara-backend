"""
Fusion layer for Akshara.

Deliberately rule-based and transparent rather than a trained black-box
classifier — every number in the output report traces back to a named
signal a teacher can see, per the "explainable, human stays in the loop"
requirement in the project proposal. A production version may add a
trained fusion model once there's enough pilot data to train one
responsibly; until then, transparency is worth more than a small accuracy
gain, especially for a tool making decisions about a child.
"""
from schemas import HandwritingResult, SpeechResult, CodeSwitchResult, NumeracyResult, RiskFlag

# Weights are a starting point for the MVP, not a validated clinical model.
HANDWRITING_WEIGHT = 0.45
SPEECH_WEIGHT = 0.45
NUMERACY_WEIGHT = 0.10

LOW_THRESHOLD = 0.30
WATCH_THRESHOLD = 0.55


def compute_risk(
    handwriting: HandwritingResult,
    speech: SpeechResult,
    code_switch: CodeSwitchResult,
    numeracy: NumeracyResult,
) -> RiskFlag:
    # Code-switching dampens confidence rather than raising or lowering the score directly —
    # a high code-switch ratio means we have less clean signal to go on, so we shrink the
    # contribution of the affected channel(s) instead of guessing.
    confidence_discount = max(0.4, 1.0 - code_switch.code_switch_ratio)

    numeracy_gap = 1.0 - numeracy.accuracy if numeracy.total > 0 else 0.0

    raw_score = (
        HANDWRITING_WEIGHT * handwriting.overall_score * confidence_discount
        + SPEECH_WEIGHT * speech.overall_score * confidence_discount
        + NUMERACY_WEIGHT * numeracy_gap
    )
    raw_score = min(1.0, raw_score)

    contributing = []
    for s in handwriting.signals:
        if s.severity >= 0.4:
            contributing.append(f"handwriting: {s.label} ({s.severity:.2f})")
    for s in speech.signals:
        if s.severity >= 0.4:
            contributing.append(f"speech: {s.label} ({s.severity:.2f})")
    if numeracy_gap >= 0.4:
        contributing.append(f"numeracy: {numeracy.correct}/{numeracy.total} correct")

    if raw_score < LOW_THRESHOLD:
        level = "low"
        summary = "No strong signals detected in this session."
        next_step = "No action needed based on this screen alone. Continue normal classroom observation."
    elif raw_score < WATCH_THRESHOLD:
        level = "watch"
        summary = "Some signals present, but not strongly enough to recommend formal assessment yet."
        next_step = "Re-screen in a few weeks and share informal observations with the child's parents."
    else:
        level = "recommend_assessment"
        summary = "Multiple signals together suggest this child would benefit from a full expert assessment."
        next_step = "Recommend the family and school arrange a formal assessment (e.g. via DALI or a specialist)."

    if code_switch.code_switch_ratio > 0.3:
        summary += (f" Note: {code_switch.excluded_token_count} code-switched tokens were excluded from "
                     f"scoring, and confidence in this result is reduced accordingly.")

    return RiskFlag(
        level=level,
        score=round(raw_score, 3),
        contributing_signals=contributing,
        excluded_for_code_switching=code_switch.excluded_token_count,
        summary=summary,
        recommended_next_step=next_step,
    )
