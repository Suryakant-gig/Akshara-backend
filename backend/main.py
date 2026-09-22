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
    allow_origins=["*"],  # tighten before any real deployment
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "passages.json")


@app.on_event("startup")
def startup():
    db.init_db()


@app.get("/api/passage")
def get_passage(language: str = "telugu"):
    with open(DATA_PATH, encoding="utf-8") as f:
        data = json.load(f)
    if language not in data:
        raise HTTPException(404, f"No passage available for language '{language}'")
    return {"passage": data[language], "numeracy": data["numeracy"]}


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
    return {"status": "ok"}
