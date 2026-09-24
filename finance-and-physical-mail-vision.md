# Finance & physical mail — vision sketch

A design doc for a Finance area, separate repos, and physical mail processing. Evolve this as thinking develops.

---

## Storage principle

**localStorage is for authentication keys only** — not for organization or data that should survive and persist across browser sessions and devices. Tokens (Fastmail, GitHub) live in localStorage. Transactions, tasks, budgets, and other organizational data live in repositories.

**Fallback:** A localStorage cache can be useful for testing or when GitHub is down. In that case, the user must see a clear warning: "Data is cached locally only. Subject to loss. Configure GitHub for persistence."

## Task design: area-focused, software-first

**Critique of traditional email:** A jumble of topics side-by-side, no indication of priority, high mental overhead from constant context-switching. Not a good model.

**Principles:**

1. **Software reads and categorizes.** Humans don't open emails to process them. Software parses, extracts, routes.
2. **Tasks only when software can't.** If software can't access something (e.g. link-only Citi content), it creates a task for the human. The task contains whatever the human needs (link, instructions). Or software may automate retrieval if possible.
3. **Tasks segregated by life area.** Finance tasks in one place. Health tasks in another. Kids & school in another. No mixed list.
4. **Focused context.** Work on one area at a time. Low context-switching. Clear boundaries.

Tasks are typed: Finance tasks, Health tasks, etc. The system supports a focused mind on one area of life at a time.

**Tasks can live in life-management or in areas.** If someone's only using one area (e.g. Finance) at least initially, associated tasks can live there. Flexible by adoption path.

- **Tasks library:** A shared component across repos / services / products. Consistent task model, typed by area, available wherever it's needed.
- **Personal task datastore:** Each person can have their own task store (e.g. `tasks-data` private repo, or a slice of `finance-data` when Finance-only). Tasks persist per user.
- **Exposed in area-specific views:** Finance app shows Finance tasks; Health app shows Health tasks. Each area focuses on its slice. Tasks can live in the area's data store.
- **Viewed centrally under life-management:** When using multiple areas, all tasks in one place — categorized and aggregated by area, not a jumble. Life-management can aggregate from area stores or from a shared task datastore.

---

## Multi-app, multi-repo model

**Principle:** Apps should be independently usable. Someone may only want life-management (inbox, email, categorization). Someone else may only want finance management. They share data via well-defined contracts.

### Repos (candidate)

| Repo | Purpose |
|------|---------|
| **life-management** | Email inbox by life area, transaction extraction from Citi emails, scan/delete, tasks inferred from email. Fastmail JMAP from browser. |
| **life-management-secrets** | Tokens, credentials. Private. |
| **finance** (software) | Budgeting, categorization, spending views, reports. Own product; can live on its own subdomain. Consumes transactions. |
| **finance-data** (data) | Transactions, budgets, categorizations, Finance tasks (when Finance-only). Private. |
| **tasks-data** *(optional)* | Personal task store. Private. Shared across areas when using multiple; or tasks live in area data stores (finance-data, etc.). |
| *(optional)* **physical-mail** (software) | Process, organize, and digitize physical mail. Tasks, scans, links to email. May share a data repo with life-management or have its own. |

### Inter-app communication

- **Transactions** are the main contract between Life and Finances:
  - **Life** parses Citi emails → writes to `life-management-data/transaction-inbox.json`. Only Life writes to life-management-data.
  - **Finances** reads the transaction inbox, imports into `personal-financial-data`. Only Finances writes to personal-financial-data.
  - Life reads personal-financial-data (read-only) to display transactions in its inbox view. Finances reads life-management-data (read-only) to pull new transactions.

- **Healthcare bills** follow the same shape (implemented 2026-09-18): Life would write candidate bills parsed from mail/email to `life-management-data/healthcare-bill-inbox.json` (not yet implemented — no mail/bill parser exists yet, so this file is currently unwritten). `finance/healthcare.html` already reads it read-only and offers an Import action, same UX as the transaction inbox. Once physical-mail or email bill-detection exists, it only needs to write that one file — Finances is already wired to consume it. Finance owns `healthcare-bills.json` (billed/owed/paid, status, insurance) in `personal-financial-data`; `js/company.js` exposes it read-only via `worthyCompany.getHealthcareBills()` for Life to display later.
- **Repo ownership:**
  - Only Life talks to life-management-data (read/write).
  - Only Finances talks to personal-financial-data (read/write).
  - Life talks to Finances to get financial data (Life reads from personal-financial-data).
  - Finances talks to Life to get life data (Finances reads from life-management-data).

- **Shared data repos** keep things simple:
  - `life-management-secrets` — tokens for Fastmail, git host, etc.
  - `finance-data` — transactions, categories, maybe physical-mail metadata.
  - Contracts: file formats (JSON), branch names, what each app expects to find.

- **Git handled by the service:** Consider making the git piece part of the service — create repos, branches, initial files on behalf of the human. Less manual setup.

- **No lock-in to GitHub:** Design the git-host layer as an abstraction. Support GitHub today, but allow GitLab, Gitea, self-hosted, or other git hosting. Same contracts (branches, files); pluggable backends.
  - **This goes further than swapping git hosts.** Treating GitHub's Contents API as the app's database (repo = table, branch = environment, file = row-set) is a good bootstrap, not necessarily the long-term data layer — Nate flagged (2026-09-18) that GitHub-as-datastore likely isn't permanent. The mitigation already in place: every page talks to GitHub through one thin surface, `ghFetch`/`ghReadFile`/`ghWriteFile`/`ghEnsureBranch` in `js/github.js`, not ad hoc `fetch` calls scattered through each page's JS. Whatever the eventual data layer is (a real backend, something local, anything else), it's a swap behind that seam — the per-page code (`finances.js`, `healthcare.js`, `trusts.js`, etc.) shouldn't need to change.

---

## Finance area (high level)

Finance is a big area in people's lives. It could be its own product, live on its own subdomain, and have its own repository.

- **Inputs:** Transactions (from life-management), manual entry, CSV import.
- **Core:** Categorization, spending by category/time, budgets, simple reports. Finance tasks (e.g. "Retrieve Annual Summary") when using Finance standalone.
- **Outputs:** Views, exports, optional alerts.

Design for a separate repo and data store; talk to life-management only via transaction format. Finance tasks can live in Finance when that's the only area in use.

---

## Financial planning goals

**Core questions:**

1. **How much have we spent, and on what?** — Spend by category over time. Use transaction history (Citi and others) as the source of truth.
2. **What might we spend in the future?** — Use past spending to set realistic budgets and expectations, not wishful thinking.
3. **How much might we have left down the road?** — Income, spending, savings → project future cash / runway.

**Flow:** History → categorization → spend by category → realistic budgets → projections.

### Data sources (beyond Citi transactions)

- **Transaction-level:** Citi card (from email parsing), manual entry, CSV from other accounts.
- **Annual Account Summary (Citi):** A different email type — yearly aggregates, category breakdowns. Excluded from transaction parsing today, but could be parsed separately and fed into finance as a validation or high-level view (e.g. "Citi says we spent $X in Dining; our categorized transactions sum to $Y").
- **Other:** Bank statements (manual/CSV), investment accounts, income records — as the Finance app grows.

### Annual Account Summary — software-driven workflow

The Annual Summary email is **link-only**: no useful data in the body, just a "view your message" link. Software handles it:

1. **Software reads and categorizes** the email (Finance area). No human opens it.
2. **Software creates a task** only when it can't do the rest: "Retrieve 2025 Annual Summary from Citi." The task includes the link. Human does *only* what software can't.
3. **Option:** Software retrieves the summary (browser automation, headless fetch if Citi allows) and ingests the data. No human task.

**Task storage:** In a repository (`tasks.json` on `tasks` branch), not localStorage. Preserves organization across browser sessions and devices.

**Task complete:** Calculated, not explicitly marked. If Finance has a copy of the Annual Spending Summary, the task is complete. Finance computes this (e.g. in memory or from stored data); no status field to update. No manual "Done" button.

---

## Physical mail processing

**Idea:** Software to help process and organize the contents of physical mail — tasks, deadlines, and digital copies of what arrives in the mailbox.

### Scope

1. **Tasks from mail**
   - Similar to tasks inferred from email (e.g. "pay this bill by X").
   - Often *connected* to an email (e.g. insurer sends letter + follow-up email).
   - Track: due date, source (physical vs email), status.

2. **Digital copies (scans)**
   - Parse and organize scans of physical mail.
   - OCR/text extraction to create searchable, categorizable records.
   - Link scans to tasks, to related emails, to transactions.

3. **Organization**
   - By sender, by life area (same categories as email), by date, by action required.
   - Archive of "handled" items.
   - Tasks from physical mail follow the same area segregation: Finance mail → Finance tasks; Health mail → Health tasks.

### Overlap with life-management

- Same life-area taxonomy (Finance, Kids & school, Health, etc.).
- Tasks can originate from email *or* physical mail; unified task list is plausible.
- Some physical mail *is* financial (bills, statements) → ties into Finance app and transaction data.

### Possible architecture

- **Option A:** Physical-mail as a module under life-management (tasks + scans live there).
- **Option B:** Separate physical-mail app/repo; shares data contract with life-management (tasks, maybe a `physical-mail` data repo).
- **Option C:** Physical-mail features split: tasks in life-management; scan storage/OCR in a dedicated app that writes into a shared task/mail archive.

### Recycle vs. process

Not everything that arrives needs a task or a record. An explicit "no action needed, recycle this" option should sit next to task-creation as a first-class choice, not an afterthought — organizing is a means, not an end, for this project (see `AGENTS.md`, "Working With This Human").

### Reconciling across pieces that arrive out of order

A single real-world matter — e.g. an alleged doctor visit (a claim to reconcile, not a confirmed fact — the record shouldn't assume the visit, the amount, or the date are settled just because one piece of paper says so) — surfaces as separate artifacts over time: a card charge (seen during credit-card/transaction review), a provider bill, an insurance EOB, a reimbursement check. Nate may encounter and process these in any order, and won't always know or remember identifying details like the exact date — sometimes the date itself is uncertain or disputed (e.g. contested insurance coverage, or a charge that turns out not to match a real visit at all). Whatever piece is being processed, the system should recognize an opportunity to close the loop with something already captured (fuzzy match on provider/amount/rough date), rather than assuming a fixed bill → payment sequence or treating any single piece of paper as ground truth.

**Not yet built:** `finance/finances.js` (credit-card/transaction review) and `finance/healthcare.js` (`healthcare-bills.json`) don't talk to each other. A transaction can't currently be tagged "this may relate to a healthcare visit, possibly paid in full" and linked to or reconciled against a healthcare record.

### Open questions

- How do scans get into the system? (Manual upload, scanner integration, mobile app?)
- OCR stack: local (Tesseract) vs cloud? Privacy considerations.
- Link model: task → email, task → scan, scan → transaction?

---

## Next steps (when ready)

1. Define transaction schema and where it lives (branch name, file format) so finance can consume.
2. Create `finance` repo skeleton; document how it reads from life-management’s output.
3. Implement area-segregated task model: tasks typed by life area, Finance/Health/Kids views, software creates tasks when human action needed.
4. Capture physical-mail use cases; decide if it starts under life-management or as its own app.
5. Sketch a shared task model if tasks will span email and physical mail.
6. **Git host abstraction:** Introduce a `GitStore` or similar interface; implement GitHub adapter; keep door open for GitLab, Gitea, etc.
7. **Service-managed git:** Explore having the service create repos, branches, and initial structure on behalf of the user — less manual setup.

---

*Created from design discussion. Update as decisions are made.*
