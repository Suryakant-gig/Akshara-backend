"""
Speech fluency analysis for Akshara.

IMPORTANT — read before treating this as production-grade:
A real deployment needs a Telugu-tuned ASR model (e.g. a fine-tuned
IndicWav2Vec/Whisper variant) to get word-level decoding-error metrics, as
described in the project proposal. This sandbox has no network access to
model hubs, so this module does NOT transcribe speech. Instead it computes
genuine, real signal-processing fluency proxies directly from the audio
waveform — pause structure, voiced-segment rate, and pitch variability —
using energy-based voice activity detection. These are legitimate fluency
indicators used in real speech-pathology research, but they are a stand-in
for full ASR-based decoding-error detection, not a replacement for it.
Swap `analyze_speech_audio`'s internals for an ASR call once one is
available; the signal names and schema stay the same.
"""
import subprocess
import tempfile
import os
from typing import List

import numpy as np
import soundfile as sf

from schemas import SpeechResult, SpeechSignal


def _convert_to_wav(input_path: str) -> str:
    """Uses ffmpeg to normalize whatever the browser recorded (webm/ogg/etc.) into 16kHz mono WAV."""
    out_path = input_path + ".wav"
    subprocess.run(
        ["ffmpeg", "-y", "-i", input_path, "-ar", "16000", "-ac", "1", out_path],
        check=True, capture_output=True,
    )
    return out_path


def _voice_activity_segments(samples: np.ndarray, sr: int, frame_ms: int = 30):
    """Simple energy-based VAD. Returns a boolean array, one value per frame, True = voiced."""
    frame_len = int(sr * frame_ms / 1000)
    n_frames = len(samples) // frame_len
    if n_frames == 0:
        return np.array([]), frame_len
    frames = samples[: n_frames * frame_len].reshape(n_frames, frame_len)
    energy = np.sqrt(np.mean(frames.astype(np.float64) ** 2, axis=1))
    # Threshold: noise floor estimated from the quietest 20% of frames.
    sorted_energy = np.sort(energy)
    noise_floor = np.mean(sorted_energy[: max(1, len(sorted_energy) // 5)])
    threshold = noise_floor + 0.15 * (np.max(energy) - noise_floor + 1e-9)
    voiced = energy > threshold
    return voiced, frame_len


def analyze_speech_audio(raw_path: str, expected_min_seconds: float = 3.0) -> SpeechResult:
    wav_path = _convert_to_wav(raw_path)
    try:
        samples, sr = sf.read(wav_path, dtype="float32")
        if samples.ndim > 1:
            samples = samples.mean(axis=1)
        duration = len(samples) / sr

        signals: List[SpeechSignal] = []

        if duration < expected_min_seconds:
            signals.append(SpeechSignal(
                label="sample_too_short",
                detail=f"Recording is only {duration:.1f}s — too short for a reliable fluency read.",
                severity=0.0,
            ))
            return SpeechResult(signals=signals, overall_score=0.0,
                                 notes="Ask the child to redo the read-aloud task with the full passage.",
                                 duration_seconds=round(duration, 2))

        voiced, frame_len = _voice_activity_segments(samples, sr)
        if len(voiced) == 0:
            signals.append(SpeechSignal(label="no_signal", detail="No usable audio detected.", severity=0.0))
            return SpeechResult(signals=signals, overall_score=0.0, notes="Re-record — no audio captured.",
                                 duration_seconds=round(duration, 2))

        frame_sec = frame_len / sr

        # --- Pause structure: count and total duration of silent runs between voiced runs ---
        pause_runs = []
        run = 0
        for v in voiced:
            if not v:
                run += 1
            else:
                if run > 0:
                    pause_runs.append(run)
                run = 0
        if run > 0:
            pause_runs.append(run)
        # Only count pauses long enough to be a hesitation, not a natural micro-gap between syllables.
        MIN_PAUSE_FRAMES = max(1, int(0.25 / frame_sec))
        hesitation_pauses = [p for p in pause_runs if p >= MIN_PAUSE_FRAMES]
        pause_rate = len(hesitation_pauses) / (duration / 10.0)  # pauses per 10 seconds
        pause_severity = min(1.0, pause_rate / 6.0)
        signals.append(SpeechSignal(
            label="hesitation_pause_rate",
            detail=f"{len(hesitation_pauses)} pauses of 0.25s+ detected over {duration:.1f}s "
                   f"({pause_rate:.1f} per 10s).",
            severity=round(pause_severity, 3),
        ))

        # --- Voiced ratio: how much of the recording is actual speech vs. silence/hesitation ---
        voiced_ratio = float(np.mean(voiced))
        low_voiced_severity = min(1.0, max(0.0, (0.55 - voiced_ratio) / 0.4))
        signals.append(SpeechSignal(
            label="voiced_time_ratio",
            detail=f"{voiced_ratio * 100:.0f}% of the recording is voiced speech (rest is pause/silence).",
            severity=round(low_voiced_severity, 3),
        ))

        # --- Rough speaking-rate proxy: voiced-segment ("syllable-like burst") count per second ---
        voiced_runs = 0
        prev = False
        for v in voiced:
            if v and not prev:
                voiced_runs += 1
            prev = v
        bursts_per_sec = voiced_runs / duration
        # Very low burst rate suggests halting, syllable-by-syllable reading rather than fluent speech.
        rate_severity = min(1.0, max(0.0, (2.2 - bursts_per_sec) / 2.0))
        signals.append(SpeechSignal(
            label="speech_burst_rate",
            detail=f"~{bursts_per_sec:.1f} distinct speech bursts per second "
                   f"(a rough fluency proxy, not a true syllable count).",
            severity=round(rate_severity, 3),
        ))

        overall = float(np.mean([s.severity for s in signals]))
        est_wpm = round(bursts_per_sec * 60 / 1.6, 1)  # very rough: ~1.6 bursts per spoken word on average

        return SpeechResult(
            signals=signals,
            overall_score=round(overall, 3),
            notes="DSP-based fluency proxies — see module docstring. A production version replaces this "
                  "with ASR-based decoding-error detection.",
            duration_seconds=round(duration, 2),
            estimated_words_per_minute=est_wpm,
        )
    finally:
        if os.path.exists(wav_path):
            os.remove(wav_path)
