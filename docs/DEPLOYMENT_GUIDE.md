# Deployment Guide — Getting a Public Demo Link

This sandbox has no network access to hosting providers (Render, Netlify,
Vercel, Railway, etc.) or to GitHub itself — I can prepare everything a
deployment needs, but I can't create accounts or push code on your behalf.
Here's the fastest real path to a public link, using the config files
already included in this repo.

## Fastest option: Render (backend) + Netlify (frontend), ~10 minutes total

### 1. Push this repo to GitHub
```bash
cd akshara
git init && git add . && git commit -m "Akshara MVP"
gh repo create akshara --public --source=. --push
# or create a repo on github.com and `git push` to it manually
```

### 2. Deploy the backend on Render
- Go to render.com → New → Blueprint → connect your GitHub repo.
- Render will detect `render.yaml` at the repo root automatically and
  configure the Docker service for you — no manual setup needed.
- Click Deploy. You'll get a URL like `https://akshara-backend.onrender.com`.
- **Note:** Render's free tier spins down after inactivity — the first
  request after idle takes ~30-60s to wake up. Fine for a hackathon demo,
  worth mentioning to judges if they hit a cold start.

### 3. Point the frontend at your live backend
Edit `frontend/app.js`, change:
```js
const API_BASE = "http://localhost:8000";
```
to your Render URL:
```js
const API_BASE = "https://akshara-backend.onrender.com";
```
Commit and push that one-line change.

### 4. Deploy the frontend on Netlify
- Go to app.netlify.com → Add new site → Import from GitHub → select the repo.
- Netlify will detect `netlify.toml` and publish the `frontend/` folder
  automatically.
- You'll get a URL like `https://akshara-demo.netlify.app` — **this is
  your demo/deployment link** for the submission form.

## Why not deployed already
Getting a real public link means creating accounts on Render/Netlify (or
similar) and authorizing a GitHub connection — that has to happen under
your credentials, not something achievable from an automated sandbox.
Everything else — the Dockerfile, the Render blueprint, the Netlify
config — is already done so this is copy-paste-click, not a real setup
task.

## Alternative: run it locally for the demo instead
If a public link isn't strictly required, running it locally per the main
README.md and showing it live (or in the recorded video already included)
is a completely valid substitute — many hackathon judges prefer a working
local demo over a cold-started free-tier deployment anyway.
