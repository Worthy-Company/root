# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Worthy Company is a **static HTML/CSS/JS** personal life-management dashboard. There is no build system, no package manager, no test framework, and no linter — it is vanilla browser code served as static files.

### Structure

- **Root** (`index.html`, `setup.html`, `js/`) — Home page, Settings page, shared helpers (`github.js`, `company.js`).
- **`life/`** — git submodule (`Worthy-Company/e-mail-management`). Currently contains planning docs only (no HTML app yet).
- **`finance/`** — git submodule (`Worthy-Company/finance`). Contains `finances.html`, the Finances dashboard.

### Running the app

Serve the repo root with any static HTTP server. Example:

```
python3 -m http.server 8080 --directory /workspace
```

Then open `http://localhost:8080/`. The app is fully client-side; all API calls (GitHub, Fastmail JMAP) happen in the browser. The Finances page at `/finance/finances.html` requires GitHub tokens configured via the Setup page — without them it shows "GitHub not configured", which is expected.

### No lint / test / build

There are no automated tests, linters, or build steps. Code quality verification is done by manual browser testing.

### External dependencies (runtime, browser-side)

- **GitHub API** — used as storage backend (tokens entered in Settings page, stored in `localStorage`).
- **Fastmail JMAP API** — used for email features (tokens entered in Settings page).

No server-side secrets or environment variables are needed to serve the app locally.
