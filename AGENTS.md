## Cursor Cloud specific instructions

### Overview

Worthy Company is a **100% client-side static web application** (vanilla HTML + JS + CSS, no build step, no package manager, no Node.js). It uses GitHub API as a data persistence layer and optionally Fastmail JMAP for email access. The repo contains two git submodules: `life/` (e-mail-management) and `finance/` (finance).

### Running the app

Serve the workspace root with any static file server:

```
python3 -m http.server 8080
```

Then open `http://localhost:8080/` in Chrome. Pages: `/index.html` (Home), `/setup.html` (Settings), `/finance/finances.html` (Finances), `/life/` (Life).

### Key notes

- There is **no build step, no linting, no automated tests, and no package manager**. The app is plain HTML/JS/CSS served statically.
- Git submodules (`life/` and `finance/`) must be initialized: `git submodule update --init --recursive`.
- The app requires a GitHub Personal Access Token (classic, `repo` scope) configured via the Setup page to persist data. Without it, the Finances page shows "GitHub not configured."
- Fastmail JMAP token is optional (only for email features in the Life app).
- CORS requires serving over HTTP (not `file://`), so always use a local server.
