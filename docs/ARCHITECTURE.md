# Architecture

## Flow
```
Child completes 3 tasks on a shared tablet
        │
        ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  Handwriting   │   │  Read-aloud   │   │   Numeracy    │
│  canvas (PNG)  │   │  audio (blob) │   │   answers     │
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        ▼                   ▼                   │
┌───────────────┐   ┌───────────────┐            │
│ handwriting.py │   │   speech.py   │            │
│ CV heuristics  │   │  DSP fluency  │            │
└───────┬───────┘   └───────┬───────┘            │
        │                   │                    │
        │           ┌───────────────┐            │
        │           │ codeswitch.py │            │
        │           │ (on passage/  │            │
        │           │ manual text)  │            │
        │           └───────┬───────┘            │
        ▼                   ▼                    ▼
              ┌─────────────────────────┐
              │        fusion.py         │
              │  explainable risk score  │
              └────────────┬─────────────┘
                            ▼
                  Plain-language teacher report
```

## Why rule-based fusion instead of a trained fusion model
The project proposal calls for an explainable scoring layer so a teacher —
not the model — makes the final call. A hand-specified, documented rule
(see `fusion.py`) is auditable line by line; a trained fusion model at this
stage would need labeled outcome data we don't have, and would trade
transparency for a small, unproven accuracy gain. Revisit once pilot data
with expert-assessment ground truth exists.

## Why code-switching discounts confidence instead of adjusting the score directly
A child mixing languages doesn't tell us anything about their handwriting
or reading ability by itself — it tells us we have less clean signal in
the channels affected by it. Rather than guessing whether to nudge the
score up or down, `fusion.py` reduces the weight given to the affected
channels proportionally to the code-switch ratio. This is a deliberate,
conservative design choice: when in doubt, say less, not more.

## Extension points for a real deployment
| Component | MVP implementation | Production replacement |
|---|---|---|
| Handwriting classifier | CV heuristics (`handwriting.py`) | Trained CNN on labeled Indic-script error data |
| Speech analysis | DSP fluency proxies (`speech.py`) | Telugu-tuned ASR + decoding-error detection |
| Storage | SQLite | PostgreSQL, once beyond single-classroom pilots |
| Deployment | Local dev server | Offline-capable PWA / quantized on-device models |

Every extension point is called out with a code comment at its definition,
so the swap doesn't require touching the rest of the pipeline.
