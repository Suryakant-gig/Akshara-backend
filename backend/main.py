"""
Akshara backend — FastAPI app.

Run with:  uvicorn main:app --reload --port 8000
Then open  frontend/index.html  (via `python -m http.server` in that folder,
so the browser mic/canvas APIs work) and point it at http://localhost:8000.
"""
import json
import os
import tempfile

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from schemas import FullReport, NumeracyResult
from handwriting import analyze_handwriting_image
from speech import analyze_speech_audio
from codeswitch import analyze_code_switching
from fusion import compute_risk
import database as db

app = FastAPI(title="Akshara Screening API", version="0.1.0-mvp")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://0.0.0.0:5500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "passages.json")


def _load_passage_data():
    with open(DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


@app.on_event("startup")
def startup():
    db.init_db()


@app.get("/api/languages")
def get_languages():
    data = _load_passage_data()
    supported = [name for name in ["telugu", "hindi", "tamil", "kannada"] if name in data]
    return {"supported_languages": supported, "default": "telugu"}


@app.get("/api/passage")
def get_passage(language: str = "telugu"):
    data = _load_passage_data()
    language_key = language.lower().strip()
    if language_key not in data:
        raise HTTPException(404, f"No passage available for language '{language}'")
    return {"passage": data[language_key], "numeracy": data["numeracy"]}


@app.get("/api/demo-case")
def get_demo_case(language: str = "telugu"):
    data = _load_passage_data()
    language_key = language.lower().strip()
    if language_key not in data:
        language_key = "telugu"
    return {
        "child_alias": "Demo-Student",
        "language": language_key,
        "passage": data[language_key],
        "numeracy": data["numeracy"],
        "teacher_summary": f"Demo case prepared for a fast judge walkthrough with a bilingual {language_key} passage and a realistic screening profile.",
        "risk_hint": "watch",
    }


@app.get("/api/sessions/summary")
def sessions_summary():
    rows = db.list_sessions()
    totals = {"low": 0, "watch": 0, "recommend_assessment": 0}
    recent = []
    for row in rows[:5]:
        report = row.get("report_json") if isinstance(row, dict) else None
        if report is not None and isinstance(report, dict):
            risk_level = report.get("risk", {}).get("level", "low")
            if risk_level in totals:
                totals[risk_level] += 1
            recent.append({
                "id": row.get("id"),
                "child_alias": row.get("child_alias"),
                "language": row.get("language"),
                "created_at": row.get("created_at"),
                "risk_level": risk_level,
                "summary": report.get("risk", {}).get("summary", "")
            })
    return {"total_sessions": len(rows), "risk_counts": totals, "recent": recent}


@app.post("/api/session/submit", response_model=FullReport)
async def submit_session(
    child_alias: str = Form(...),
    language: str = Form("telugu"),
    handwriting_image: str = Form(...),   # base64 data URL from the canvas
    audio: UploadFile = File(...),
    numeracy_correct: int = Form(...),
    numeracy_total: int = Form(...),
    manual_transcript: str = Form(""),    # optional teacher-typed transcript for code-switch check
):
    if not child_alias or not child_alias.strip():
        raise HTTPException(400, "child_alias is required")
    if not handwriting_image or "data:image" not in handwriting_image[:20]:
        raise HTTPException(400, "handwriting_image must be a valid base64 data URL")
    if audio is None or audio.filename is None:
        raise HTTPException(400, "audio file is required")
    if numeracy_correct < 0 or numeracy_total <= 0:
        raise HTTPException(400, "numeracy values must be valid")

    # --- Handwriting ---
    hw_result = analyze_handwriting_image(handwriting_image)

    # --- Speech (DSP fluency proxies) ---
    suffix = os.path.splitext(audio.filename or "clip.webm")[1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await audio.read())
        tmp_path = tmp.name
    try:
        speech_result = analyze_speech_audio(tmp_path)
    finally:
        os.remove(tmp_path)

    # --- Code-switch check ---
    # Uses the manual transcript if a teacher supplied one during pilot testing; otherwise falls
    # back to checking the known passage text, so the pipeline still runs end to end without ASR.
    with open(DATA_PATH, encoding="utf-8") as f:
        passage_data = json.load(f)
    text_to_check = manual_transcript.strip() or passage_data.get(language, {}).get("text", "")
    cs_result = analyze_code_switching(text_to_check, primary_script=language)

    # --- Numeracy ---
    if numeracy_total <= 0:
        raise HTTPException(400, "numeracy_total must be > 0")
    numeracy_result = NumeracyResult(
        correct=numeracy_correct,
        total=numeracy_total,
        accuracy=round(numeracy_correct / numeracy_total, 3),
    )

    # --- Fusion ---
    risk = compute_risk(hw_result, speech_result, cs_result, numeracy_result)

    session_id = db.save_session(child_alias, language, {})  # placeholder id first
    report = FullReport(
        session_id=session_id,
        child_alias=child_alias,
        handwriting=hw_result,
        speech=speech_result,
        code_switch=cs_result,
        numeracy=numeracy_result,
        risk=risk,
    )
    # Overwrite stored row with the full report now that we have the session_id inside it too.
    conn = db.get_connection()
    conn.execute("UPDATE sessions SET report_json = ? WHERE id = ?", (report.model_dump_json(), session_id))
    conn.commit()
    conn.close()

    return report


@app.get("/api/session/{session_id}")
def get_session(session_id: str):
    row = db.get_session(session_id)
    if row is None:
        raise HTTPException(404, "Session not found")
    return row["report_json"]


@app.get("/api/sessions")
def list_sessions():
    return db.list_sessions()


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "akshara",
        "database": "sqlite",
        "features": ["handwriting", "speech", "code_switch", "teacher_dashboard"],
    }
