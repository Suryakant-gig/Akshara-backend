# Akshara — Technology Stack

## Backend
- **Python 3 / FastAPI** — REST API, request validation via Pydantic
- **OpenCV + Pillow + NumPy** — handwriting image processing (connected-component
  geometry analysis for spacing, baseline, glyph-size, and mark-isolation signals)
- **SciPy + NumPy + SoundFile** — audio digital signal processing (energy-based
  voice activity detection, pause structure, speaking-rate proxy)
- **ffmpeg** — normalizes browser-recorded audio (webm/ogg) to WAV for analysis
- **SQLite** — session storage (swap for PostgreSQL beyond single-classroom pilots)

## Frontend
- **Vanilla HTML / CSS / JavaScript** — no build step, so it runs directly in a
  classroom tablet's browser; chosen deliberately over a framework for the MVP
  to keep the deployment surface as simple as possible
- **Canvas API** — handwriting capture (touch + mouse + stylus)
- **MediaRecorder API** — read-aloud audio capture

## Data
- Sample Telugu passage with a deliberate embedded code-switch word, used both
  to test the code-switch detector and as the default text-checking source in
  the absence of a live ASR transcript

## Planned / next-phase technology (not yet integrated — see docs/ROADMAP.md)
- **Trained CNN** (transfer learning from an existing handwriting-analysis
  backbone) for the script-specific handwriting error classifier, once a
  labeled Indic-script dataset exists
- **Telugu-tuned ASR** (e.g. a fine-tuned IndicWav2Vec or Whisper variant) for
  decoding-error detection, replacing the current DSP fluency proxies
- **On-device / quantized inference** for full offline classroom deployment
- **PWA packaging** so the web app installs like a native app on shared tablets

## Why these choices
Every technology here was picked because it's necessary to the specific
problem, not to sound impressive: OpenCV and SciPy give genuine, explainable,
non-random signals without needing external model access; SQLite keeps the
MVP dependency-light; and a build-free frontend means the tool can be picked
up and run in a real classroom with nothing more than a browser.
