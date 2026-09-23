"""
Pydantic response/request models for the Akshara screening API.
"""
from pydantic import BaseModel
from typing import List, Optional


class HandwritingSignal(BaseModel):
    label: str
    detail: str
    severity: float  # 0.0 (no concern) - 1.0 (strong concern)


class HandwritingResult(BaseModel):
    signals: List[HandwritingSignal]
    overall_score: float  # 0-1, higher = more concerning
    notes: str


class SpeechSignal(BaseModel):
    label: str
    detail: str
    severity: float


class SpeechResult(BaseModel):
    signals: List[SpeechSignal]
    overall_score: float
    notes: str
    duration_seconds: float
    estimated_words_per_minute: Optional[float] = None


class CodeSwitchSpan(BaseModel):
    text: str
    script: str  # "telugu" | "latin" | "digit" | "other"


class CodeSwitchResult(BaseModel):
    spans: List[CodeSwitchSpan]
    code_switch_ratio: float  # fraction of tokens that are non-primary script
    excluded_token_count: int
    notes: str


class NumeracyResult(BaseModel):
    correct: int
    total: int
    accuracy: float


class SessionSubmission(BaseModel):
    child_alias: str
    language: str = "telugu"


class RiskFlag(BaseModel):
    level: str  # "low" | "watch" | "recommend_assessment"
    score: float
    contributing_signals: List[str]
    excluded_for_code_switching: int
    summary: str
    recommended_next_step: str


class FullReport(BaseModel):
    session_id: str
    child_alias: str
    handwriting: HandwritingResult
    speech: SpeechResult
    code_switch: CodeSwitchResult
    numeracy: NumeracyResult
    risk: RiskFlag
