function fmtMoney(n) {
  if (typeof n !== 'number') return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Unique id for a newly saved item. `prefix` only shows up on the fallback
// path, for browsers without crypto.randomUUID.
function newId(prefix = 'id') {
  try { return crypto.randomUUID(); } catch (_) { return prefix + '_' + Math.random().toString(16).slice(2) + '_' + Date.now(); }
}

// A short id (three characters) that isn't in `taken`. A personal app doesn't need a full UUID (see
// root/BACKLOG.md, "ids are far too long"; newId above is the debt). Retries until it is unused, so a
// clash can't happen.
function shortId(taken = []) {
  let id;
  do { id = Math.random().toString(36).slice(2, 5); } while (id.length < 3 || taken.includes(id));
  return id;
}

// Dollars as typed ("140.00", "$1,140") to whole cents, or null if it isn't an amount. Nothing typed is
// nothing (0), not a mistake.
function centsFromTyped(text) {
  const cleaned = String(text || '').replace(/[$,\s]/g, '');
  if (cleaned === '') return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(parseFloat(cleaned) * 100);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Wires the common "disable while saving, show Saving…/Saved./Error"
// pattern around an async write, so each form/control doesn't need to
// hand-roll it. `disable` may be a single element or an array — all are
// disabled up front and re-enabled in a finally, in case the caller's own
// success path doesn't already replace the DOM (if it does, this is a
// harmless no-op on now-detached nodes). A form that clears itself after
// saving passes `successText: ''`: "Saved." beside the Save button of a
// blank form reads as if the blank form had been saved, so that page shows
// what was saved on the saved item instead.
async function withSaveFeedback({ disable, msgEl, successText = 'Saved.' }, work) {
  const controls = (Array.isArray(disable) ? disable : [disable]).filter(Boolean);
  controls.forEach(el => { el.disabled = true; });
  if (msgEl) { msgEl.textContent = 'Saving…'; msgEl.className = 'save-msg'; }
  try {
    await work();
    if (msgEl) { msgEl.textContent = successText; msgEl.className = 'save-msg ok'; }
  } catch (err) {
    if (msgEl) { msgEl.textContent = 'Error: ' + err.message; msgEl.className = 'save-msg error'; }
  } finally {
    controls.forEach(el => { el.disabled = false; });
  }
}

// A statement as lowercase words joined by hyphens, for the human-readable
// tail of an address ("Help my son feel at home" -> "help-my-son-feel-at-home").
// Decoration only: nothing ever looks a record up by this, so rewording it
// (or a stale copy in an old link) can't break anything.
function addressWords(text) {
  return String(text || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
