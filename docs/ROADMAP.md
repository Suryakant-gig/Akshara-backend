# Roadmap

## Immediate next steps (post-hackathon)
1. Partner with one school for a small, consent-based pilot to start
   collecting labeled handwriting and speech samples — the input the
   trained models actually need.
2. Get the sample Telugu passage(s) reviewed by a language educator and,
   ideally, a speech-language pathologist.
3. Replace `handwriting.py`'s CV heuristics with a CNN trained on the
   pilot data, using the documented error taxonomy (conjunct malformation,
   matra placement, akshara-boundary confusion) as the label schema.
4. Integrate a Telugu-tuned ASR model for real decoding-error detection in
   `speech.py`, replacing the DSP fluency proxies.
5. Validate the fusion risk score against expert assessment (e.g. DALI) as
   ground truth, and only then start stating any accuracy numbers.

## Script/language expansion ("packs")
Each new script is: a new error taxonomy definition, a small labeled
dataset, and a fine-tuned model — not a rebuild of the app. Suggested
order based on speaker population and script-family overlap:
1. Hindi / Devanagari
2. Kannada, Tamil (Dravidian family, closer to Telugu's structure)
3. Bengali
4. Non-Indic abugida/syllabic scripts elsewhere in the Global South

## Deployment path
Local dev server → offline-capable PWA on shared classroom tablets →
district-level rollout with a central (anonymized, opt-in) admin dashboard
→ NGO literacy-program integration across multiple language regions.
