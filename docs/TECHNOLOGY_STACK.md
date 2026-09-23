# Akshara - Full Technology Stack

## 1. Product scope

Akshara is a browser-based classroom screening prototype for multilingual
children. It combines handwriting, read-aloud fluency, numeracy, and
code-switching signals into an explainable screening report.

The result is a risk flag, not a diagnosis. A teacher or qualified specialist
must make the final decision about observation, re-screening, or referral.

## 2. Architecture summary

```text
Teacher browser
    |
    | HTML form, Canvas image, MediaRecorder audio, Fetch API
    v
FastAPI REST API
    |
    +--> handwriting.py  -> OpenCV/Pillow/NumPy geometry signals
    +--> speech.py       -> FFmpeg/SoundFile/NumPy DSP signals
    +--> codeswitch.py   -> Unicode script classification
    +--> fusion.py       -> weighted explainable risk score
    +--> database.py     -> SQLite session persistence
    v
JSON screening report and teacher dashboard data
```

The frontend has no compilation step. The backend is a Python service that
orchestrates analysis modules and returns typed JSON responses.

## 3. Backend stack

| Layer | Technology | Purpose |
|---|---|---|
| Language | Python 3.12 | Backend implementation and signal processing |
| Web framework | FastAPI | REST endpoints, async upload handling, OpenAPI generation |
| ASGI server | Uvicorn | Local and containerized application server |
| Validation | Pydantic 2 | Typed request and response models |
| Image processing | Pillow, OpenCV, NumPy | Decode, threshold, and measure handwriting images |
| Audio processing | SoundFile, NumPy | Read normalized WAV audio and calculate waveform features |
| Numerical processing | SciPy-compatible scientific Python stack | Signal-processing foundation and future DSP extensions |
| Media conversion | FFmpeg | Convert browser WebM/OGG recordings to mono 16 kHz WAV |
| Persistence | SQLite | Store session metadata and JSON reports |
| Packaging | Docker | Reproducible backend runtime with FFmpeg installed |

The exact Python dependency ranges are defined in `backend/requirements.txt`.

## 4. Backend modules

### `backend/main.py`

Creates the FastAPI application, configures CORS, loads language data, accepts
session submissions, coordinates the analysis modules, and exposes health,
demo, session, passage, and summary endpoints.

### `backend/schemas.py`

Defines the Pydantic contracts used by the API:

- `HandwritingResult`
- `SpeechResult`
- `CodeSwitchResult`
- `NumeracyResult`
- `RiskFlag`
- `FullReport`

### `backend/handwriting.py`

Accepts a Base64 image data URL from the browser. The image is converted to
grayscale, binarized, and analyzed with OpenCV connected components.

Current signals:

- Inter-stroke spacing drift
- Baseline deviation
- Component-size variance
- Isolated or floating small marks

These are explainable geometry heuristics. They are not a clinically validated
classifier and are intended to be replaced by a script-specific trained model
when labeled data is available.

### `backend/speech.py`

Normalizes the uploaded recording with FFmpeg, reads the waveform, and applies
energy-based voice activity detection.

Current signals:

- Hesitation-pause rate
- Voiced-time ratio
- Speech-burst rate
- Estimated words-per-minute proxy

The prototype does not perform transcription, phoneme recognition, or
pronunciation scoring.

### `backend/codeswitch.py`

Uses deterministic Unicode ranges to classify tokens as Telugu, Hindi,
Tamil, Kannada, Latin, digit, or other. Tokens outside the selected primary
script are reported and excluded from the affected risk signal rather than
being treated as evidence of difficulty.

### `backend/fusion.py`

Combines the analysis results with transparent weights:

- Handwriting: 45%
- Speech: 45%
- Numeracy: 10%

Risk levels are currently:

- `low`: score below `0.30`
- `watch`: score from `0.30` through `0.549`
- `recommend_assessment`: score of `0.55` or higher

These thresholds are prototype values and have not been clinically validated.

### `backend/database.py`

Uses Python's built-in SQLite driver. Each session stores a UUID, child alias,
language, UTC timestamp, and serialized JSON report. SQLite is appropriate for
local demos and small pilots; PostgreSQL is the planned production database.

## 5. Frontend stack

| Technology | Use |
|---|---|
| HTML5 | Semantic workflow structure and form controls |
| CSS3 | Responsive layout, report styling, dashboard styling, and states |
| Vanilla JavaScript | Application state, workflow transitions, API integration |
| Canvas API | Touch, mouse, and stylus handwriting capture |
| MediaRecorder API | Browser microphone recording |
| Fetch API | REST communication with FastAPI |
| Local storage | Optional local report or demo-state persistence |
| Web App Manifest | PWA-ready metadata |

The frontend is intentionally framework-free. This keeps the deployment small,
avoids a Node.js build dependency, and supports use on shared classroom tablets.
Chrome or Edge is recommended because microphone support depends on browser
permissions and MediaRecorder compatibility.

## 6. Supported language data

Language passages and numeracy tasks are stored in `data/passages.json`.
The current language-pack design supports:

- Telugu
- Hindi
- Tamil
- Kannada

Each language pack contains a passage ID, passage text, translation note, and
target words. Numeracy questions are shared across language packs in the MVP.

## 7. API surface

| Method | Route | Function |
|---|---|---|
| GET | `/api/health` | Service health and feature status |
| GET | `/api/languages` | Supported languages and default language |
| GET | `/api/passage` | Language passage and numeracy task |
| GET | `/api/demo-case` | Pre-filled demonstration case |
| POST | `/api/session/submit` | Analyze and save a screening session |
| GET | `/api/session/{session_id}` | Retrieve one report |
| GET | `/api/sessions` | List stored sessions |
| GET | `/api/sessions/summary` | Dashboard totals and recent sessions |

The submit route accepts multipart form data containing the child alias,
language, handwriting data URL, audio file, numeracy result, and optional manual
transcript.

## 8. Runtime and deployment

### Local development

Backend:

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
python -m http.server 5500
```

The default local URLs are:

- Frontend: `http://127.0.0.1:5500`
- Backend: `http://127.0.0.1:8000`
- API documentation: `http://127.0.0.1:8000/docs`

### Backend deployment

`backend/Dockerfile` uses `python:3.12-slim`, installs FFmpeg, installs the
Python requirements, copies the backend and data files, and starts Uvicorn on
port `8000`.

`render.yaml` defines a Render web service with `/api/health` as its health
check.

### Frontend deployment

`netlify.toml` publishes the `frontend/` directory without a build command.
The deployed frontend must point its API base URL to the public backend URL.

## 9. Security, privacy, and production gaps

The current prototype does not yet provide:

- Teacher authentication or role-based access
- Production-grade CORS allowlisting
- Encryption and retention policies for child media
- PostgreSQL or multi-tenant data isolation
- Audit logs
- Clinically validated thresholds
- Expert-reviewed language assessment content
- ASR-based speech decoding analysis

Before real classroom deployment, add authentication, HTTPS enforcement,
restricted CORS, secure media handling, database backups, deletion controls,
and review by language educators and qualified assessment professionals.

## 10. Planned production upgrades

- Indic-script CNN trained on labeled handwriting samples
- Telugu, Hindi, Tamil, and Kannada ASR models
- Phoneme and word-level pronunciation analysis
- PostgreSQL-backed multi-school deployment
- OAuth or JWT authentication
- Object storage with explicit media retention controls
- Offline-capable PWA and quantized on-device inference
- Expert-calibrated scoring thresholds and evaluation metrics

## 11. Technology rationale

The MVP favors explainability and low deployment complexity. OpenCV and
waveform analysis produce measurable signals without requiring a model-hosting
service. Unicode script detection is deterministic and easy to audit. SQLite
keeps classroom pilots portable, while FastAPI, Pydantic, Docker, and the
framework-free frontend leave clear upgrade paths for production scale.

This document describes the intended technology architecture. Before a final
release, remove any unresolved merge-conflict markers from source files and
run the backend and frontend smoke tests to verify that the checked-in code
matches this documentation.
