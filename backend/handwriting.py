"""
Handwriting analysis for Akshara.

IMPORTANT — read before treating this as production-grade:
This module implements explainable, measurable computer-vision heuristics
(connected-component geometry) as a stand-in for the trained, script-specific
CNN classifier described in the project proposal. A real deployment needs
that CNN trained on labeled Indic-script handwriting samples, which does not
yet exist as a public dataset. Until then, these heuristics give a genuine,
non-random signal derived from stroke geometry, so the pipeline is real and
demonstrable end to end — but the thresholds below are reasonable starting
points, not clinically validated cutoffs. Swap `analyze_handwriting_image`
for a call to the trained model once it exists; the rest of the pipeline
(schemas, fusion) does not need to change.

Signals produced (mapped to the script-specific error taxonomy from the
proposal):
  - spacing_drift        -> spacing / baseline consistency
  - baseline_deviation    -> baseline consistency
  - component_size_variance -> proxy for conjunct (samyuktakshara) malformation
  - floating_mark_isolation -> proxy for matra placement errors
"""
import base64
import io
from typing import List

import cv2
import numpy as np
from PIL import Image

from schemas import HandwritingResult, HandwritingSignal


def _decode_data_url(data_url: str) -> np.ndarray:
    """Accepts a base64 PNG (optionally as a data: URL) and returns a grayscale numpy array."""
    if "," in data_url and data_url.strip().startswith("data:"):
        data_url = data_url.split(",", 1)[1]
    raw = base64.b64decode(data_url)
    img = Image.open(io.BytesIO(raw)).convert("L")
    return np.array(img)


def _binarize(gray: np.ndarray) -> np.ndarray:
    # Canvas strokes are drawn dark-on-light by default in the frontend.
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    return binary


def analyze_handwriting_image(data_url: str) -> HandwritingResult:
    gray = _decode_data_url(data_url)
    binary = _binarize(gray)

    if binary.sum() == 0:
        return HandwritingResult(
            signals=[],
            overall_score=0.0,
            notes="No strokes detected in the submitted sample — nothing to analyze.",
        )

    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(binary, connectivity=8)
    # label 0 is background
    components = stats[1:]
    comp_centroids = centroids[1:]

    signals: List[HandwritingSignal] = []

    if len(components) < 2:
        signals.append(HandwritingSignal(
            label="insufficient_strokes",
            detail="Too few distinct strokes to assess spacing or component structure reliably.",
            severity=0.0,
        ))
        return HandwritingResult(signals=signals, overall_score=0.0,
                                  notes="Sample too sparse for a confident read — consider asking for a longer sample.")

    # Sort components left-to-right by x-centroid to approximate reading order.
    order = np.argsort(comp_centroids[:, 0])
    ordered_stats = components[order]
    ordered_centroids = comp_centroids[order]

    # --- Spacing drift: variance in horizontal gap between consecutive components ---
    x_left = ordered_stats[:, 0]
    widths = ordered_stats[:, 2]
    x_right = x_left + widths
    gaps = x_left[1:] - x_right[:-1]
    gaps = gaps[gaps > -5]  # drop heavily overlapping/nested boxes (diacritics stacked on a base glyph)
    if len(gaps) >= 2:
        gap_cv = float(np.std(gaps) / (np.mean(np.abs(gaps)) + 1e-6))
        spacing_severity = min(1.0, gap_cv / 3.0)
    else:
        spacing_severity = 0.0
    signals.append(HandwritingSignal(
        label="spacing_drift",
        detail=f"Coefficient of variation in inter-stroke spacing: {spacing_severity:.2f} (0 = perfectly even).",
        severity=round(spacing_severity, 3),
    ))

    # --- Baseline deviation: variance in vertical centroid position ---
    y_centroids = ordered_centroids[:, 1]
    heights = ordered_stats[:, 3]
    normalized_y = (y_centroids - y_centroids.mean()) / (np.mean(heights) + 1e-6)
    baseline_severity = min(1.0, float(np.std(normalized_y)) / 1.5)
    signals.append(HandwritingSignal(
        label="baseline_deviation",
        detail=f"Normalized baseline scatter: {baseline_severity:.2f} (0 = strokes sit on one consistent line).",
        severity=round(baseline_severity, 3),
    ))

    # --- Component size variance: proxy for conjunct (samyuktakshara) malformation ---
    areas = ordered_stats[:, 4].astype(float)
    size_cv = float(np.std(areas) / (np.mean(areas) + 1e-6))
    # A well-formed script sample has moderate size variance (matras are smaller than base
    # glyphs by design); extreme variance suggests malformed or fused conjuncts.
    conjunct_severity = min(1.0, max(0.0, (size_cv - 0.6) / 1.4))
    signals.append(HandwritingSignal(
        label="component_size_variance",
        detail=f"Glyph-size variability: {size_cv:.2f} coefficient of variation.",
        severity=round(conjunct_severity, 3),
    ))

    # --- Floating mark isolation: proxy for matra placement errors ---
    # Small components (candidate diacritics) whose nearest larger neighbor is far away
    # or below them (rather than directly attached above/beside) suggest a displaced matra.
    median_area = float(np.median(areas))
    small_idx = [i for i, a in enumerate(areas) if a < median_area * 0.4]
    isolated_count = 0
    for i in small_idx:
        cx, cy = ordered_centroids[i]
        distances = []
        for j in range(len(areas)):
            if j == i or areas[j] < median_area * 0.4:
                continue
            ox, oy = ordered_centroids[j]
            distances.append(((cx - ox) ** 2 + (cy - oy) ** 2) ** 0.5)
        if distances and min(distances) > 2.5 * np.mean(heights):
            isolated_count += 1
    matra_severity = min(1.0, isolated_count / max(1, len(small_idx) or 1))
    signals.append(HandwritingSignal(
        label="floating_mark_isolation",
        detail=f"{isolated_count} of {len(small_idx)} small marks sit unusually far from any base glyph "
               f"(possible displaced matra).",
        severity=round(matra_severity, 3),
    ))

    overall = float(np.mean([s.severity for s in signals]))
    return HandwritingResult(
        signals=signals,
        overall_score=round(overall, 3),
        notes="Heuristic geometry-based read — see module docstring. Not a substitute for the trained "
              "script-specific classifier once labeled data is available.",
    )
