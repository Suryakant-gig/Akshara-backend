# Akshara — Project Description

**Global Innovation Hackathon 2026 — "Innovate Without Borders"**

## One-line summary
Akshara is a classroom screening tool that flags children who may benefit
from a dyslexia/dysgraphia assessment, built specifically for Indic-script
handwriting and multilingual, code-switching children — a population every
major existing AI screening tool overlooks.

## The problem
An estimated 5–20% of school-age children show signs of dyslexia or
dysgraphia. In India, most go undiagnosed until they've already fallen
years behind, because the only validated screening instrument for Indian
languages (DALI) requires expert administration that most government and
low-fee schools don't have access to. Meanwhile, nearly every AI-based
screening tool on the market was built and validated on English or
Mandarin — languages that don't share the structural features of Indic
scripts (conjunct consonants, matra diacritics) or the reality of
bilingual code-switching that most Indian children grow up with.

## What we built
A classroom-teacher-administrable app: a child completes a short
handwriting task, a read-aloud task, and a numeracy task on a shared
tablet, in their own script and language. The system analyzes handwriting
for script-appropriate error patterns, analyzes read-aloud audio for
fluency, and — critically — filters out code-switching before it can be
mistaken for a risk signal. The output is a plain-language flag for the
teacher: never a diagnosis, always a "worth a proper assessment" signal
when warranted.

## What's real right now
This isn't a concept — it's a working prototype. The code-switch detector,
the speech fluency analysis, the handwriting feature extraction, and the
explainable risk-scoring layer are all functioning end to end today, built
and tested during the hackathon. The two components that need real-world
training data before they can be fully production-grade — the trained
handwriting-error CNN and the Telugu-tuned ASR — are clearly documented as
such in the code, with working, honest placeholders standing in for them
(see `docs/ARCHITECTURE.md` in the source repository for exactly where).

## Why it matters
Early identification is the single strongest lever in literacy
intervention research. A 10-minute, teacher-run screen removes the two
real barriers standing in the way of that today: specialist cost and
specialist availability. And because the tool is built to recognize
healthy bilingual behavior rather than misread it, it should reduce false
positives for exactly the multilingual children most existing tools get
wrong.

## Where it goes from here
The architecture is designed to extend one language/script "pack" at a
time — Hindi, Kannada, Tamil, and beyond — without a rebuild, and the
same code-switch-aware approach applies anywhere multilingual education
is the norm, which is most of the world.

*For full technical detail, see the source repository's README.md,
docs/ARCHITECTURE.md, and docs/ROADMAP.md.*
