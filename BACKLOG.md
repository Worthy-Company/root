# Backlog

Planned work, parked here so it isn't lost between sessions. Not a project
plan — just a list to check at the start of a future session.

Tests for these get written at the start of the session that actually
tackles them — genuinely red right before implementing, not drafted ahead
of time against a design that might still change.

- **Store goals as one file per goal** (e.g. `goals/<goalId>.json`) instead
  of one `goals.json` array. Motivation is navigability, not performance:
  Nate wants the goal directory to be browsable outside the app (e.g. on
  GitHub.com, or a local file explorer) — one file per goal, not a JSON
  blob you have to open and search. Trade-off worth remembering when this
  gets built: the goals overview page will need a directory listing plus
  one fetch per goal to show each statement, and Approaches/Actions stay
  on the flat-array pattern unless this gets extended to them too — both
  fine at personal scale, just noted so it's a deliberate choice, not a
  surprise. Also raises a broader principle worth deciding on explicitly:
  should the data repository be navigable and understandable from a plain
  file system, without the app — e.g. nesting folders to mirror the
  Goal → Approach → Action hierarchy directly, not just one file per goal.
  That trades away easy reparenting (moving an Approach to a different
  Goal becomes a file move, and the GitHub Contents API has no move
  operation) and doesn't fit relations that aren't a strict tree (an
  Artifact tied to multiple Actions). Decide before building, not while
  building.
- **Goals overview + drill-down page.** A page listing all Goals
  side-by-side, where clicking one drills into that Goal's Approaches, and
  clicking one of those drills into its Actions. Solves the Goals page
  getting overloaded as Actions accumulate under it. Use a query-param URL
  per goal (`goal.html?id=<goalId>`), not a path segment (`/goal/<id>`) —
  this site is served as plain static files with no server-side routing, so
  path-based routes would need URL-rewrite rules or the GitHub Pages
  404.html SPA-routing hack, which is real fragility for a cosmetic win.
  The artifacts action-picker (both the capture-form checklist and the
  retroactive-link dropdown) has the same flat-list problem and would
  benefit from the same Goal → Approach → Action grouping — deliberately
  deferred, at Nate's call, until the action list actually gets
  unnavigable rather than building it against today's handful of items.
  If/when both pages need the same grouping logic, pull it into a shared
  helper (e.g. `js/hierarchy.js`) rather than duplicating it — but only
  once there are two real call sites to compare, not before.
- **Does "life area" actually mean "goal"?** `a-life-area` (free text:
  "Health, Finance, Kids, …") on an artifact might be filling in for a
  fuzzy, not-yet-specific link to a Goal, rather than being its own
  concept — Nate's question was "I wonder if the need for life area is
  actually a need to map to a goal." Before changing anything, audit the
  real `lifeArea` values already recorded in `life-management-data`'s
  `artifacts.json` against the real Goals that exist, to see empirically
  whether they'd cleanly collapse into "which Goal" — deliberately
  deferred until that audit happens, rather than reasoned through
  abstractly now.
- **Ongoing understanding of the mortgage, in the Finance app.** Nate wants
  an ongoing understanding of the mortgage (balance, payments, etc.) —
  this belongs in `finance/`, not the Goals/Approaches/Actions/Artifacts
  system. Raised while capturing a mortgage-statement artifact and
  deliberately punted to a fresh thread to keep context cost down — no
  design decisions made yet; start by looking at what `finance/` already
  has (e.g. `investing.js`'s per-account tracking) before designing
  something new.
- **A broader branch name than `transactions` for the finance data.** The
  finance data repo (`personal-financial-data`) is read and written on a
  branch named `transactions` by default (`getFinanceBranch` in
  `finance/config.js`, also `js/company.js` and the Setup page text), but it
  now holds budgets, statements, investing data and more — the name is too
  narrow. No new name chosen yet. Renaming the branch on GitHub is Nate's to
  do; the code side is changing that default and the Setup wording.
- **Goal.subject, mapped from Artifact.patient.** A generic `subject`
  field on Goal (who/what it's about — could be a person, could be the
  household) would be more honest than the healthcare-specific `patient`
  field on Artifact, and would mean a linked artifact doesn't need
  `patient` re-entered by hand if it's already recoverable by following
  the chain up to its Goal. `Action.provider` was considered alongside
  this and rejected — a provider is usually per-encounter, not a stable
  property of the Action itself, so it doesn't generalize the same way.
