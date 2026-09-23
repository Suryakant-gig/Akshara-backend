# Akshara — Classroom Learning-Difference Screening (MVP Prototype)

Global Innovation Hackathon 2026 — "Innovate Without Borders"

A classroom-teacher-administrable screening tool for dyslexia/dysgraphia
indicators in Indic-script, multilingual children, built around two things
the existing global tools don't do: analyze handwriting errors using a
taxonomy that matches how Indic scripts (conjuncts, matras) actually work,
and filter out normal bilingual code-switching before it can be mistaken
for a risk signal.

**This is a screening aid, not a diagnostic tool. It never outputs a
diagnosis — only a flag suggesting whether a full expert assessment would
be worthwhile.**

## What's actually working in this MVP

Everything in this repo runs end-to-end right now — there is no mocked API
response anywhere. Specifically real:

- **Code-switch detection** — genuine Unicode-range script identification.
  No external model, no approximation. Given any text, it correctly
  separates Telugu tokens from English/Latin tokens.
- **Speech fluency analysis** — genuine digital signal processing
  (energy-based voice activity detection, pause structure, voiced-time
  ratio) run directly on the recorded audio.
- **Handwriting analysis** — genuine computer-vision feature extraction
  (connected-component geometry: spacing, baseline consistency, glyph-size
  variance, isolated-mark detection) run directly on the submitted drawing.
- **Fusion + risk scoring** — a transparent, rule-based combination of all
  of the above into an explainable flag, with the code-switch ratio used
  to discount confidence rather than silently skewing the score.
- **Full session storage** in SQLite, a FastAPI backend, and a working
  browser frontend (canvas handwriting capture + microphone recording).

## What's a placeholder, and why

Two pieces described in the project proposal need components that require
either a trained model on labeled data that doesn't yet exist, or a model
hub/API this sandbox can't reach:

1. **Handwriting error classification** is currently done with explainable
   CV heuristics (see the docstring in `backend/handwriting.py`), not the
   trained script-specific CNN from the proposal. No public labeled dataset
   of Indic-script child handwriting errors exists yet — that's the whole
   reason this project matters. The heuristics give a real, non-random
   signal today and are built to be swapped for the trained model later
   without touching the rest of the pipeline.
2. **Speech decoding-error detection** would normally use a Telugu-tuned
   ASR model (e.g. IndicWav2Vec) to catch specific mispronunciations. This
   environment has no access to model hubs, so `backend/speech.py` computes
   real fluency proxies from the raw waveform instead (pause rate, voiced
   ratio, burst rate) — legitimate speech-pathology signals, but not full
   ASR-based error detection. Swap-in point is documented in that file.

Both are marked clearly in code comments and in the report UI itself, so
nobody — including a judge reading the code — mistakes the MVP heuristics
for the finished product.

## Running it locally

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
Requires `ffmpeg` on PATH (used to normalize whatever audio format the
browser records into WAV before analysis).

### Frontend
```bash
cd frontend
python3 -m http.server 5500
```
Open `http://localhost:5500` in a browser (Chrome/Edge recommended for
`MediaRecorder` support). It talks to the backend at `http://localhost:8000`
— change `API_BASE` at the top of `app.js` if you run the backend elsewhere.

## Project layout
```
akshara/
├── backend/
│   ├── main.py          FastAPI app and routes
│   ├── handwriting.py   CV heuristics (documented placeholder for trained CNN)
│   ├── speech.py        DSP fluency analysis (documented placeholder for ASR)
│   ├── codeswitch.py    Real Unicode-based code-switch detection
│   ├── fusion.py        Transparent rule-based risk scoring
│   ├── database.py      SQLite session storage
│   └── schemas.py       Pydantic models shared across the app
├── frontend/
│   ├── index.html       Four-step wizard: setup → handwriting → read-aloud → numeracy → report
│   ├── app.js            Canvas capture, MediaRecorder audio, API calls, report rendering
│   └── style.css
├── data/
│   └── passages.json    Sample Telugu passage (with one deliberate code-switch word)
└── docs/
    ├── ARCHITECTURE.md
    └── ROADMAP.md
```

## Known limitations (stated honestly, not hidden)
- Sample passage content needs review by a Telugu-language educator and,
  ideally, a speech-language pathologist before any real classroom use.
- No accuracy figures are claimed anywhere in this repo. None exist yet —
  they can only come from piloting against expert assessment as ground
  truth, which hasn't happened.
- Heuristic thresholds in `handwriting.py` and `speech.py` are reasonable
  starting points, not validated cutoffs.
- Currently supports Telugu only; the architecture is designed to extend
  to other Indic scripts via new "packs" (see `docs/ROADMAP.md`), not yet
  implemented.
