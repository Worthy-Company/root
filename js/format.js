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

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Wires the common "disable while saving, show Saving…/Saved./Error"
// pattern around an async write, so each form/control doesn't need to
// hand-roll it. `disable` may be a single element or an array — all are
// disabled up front and re-enabled in a finally, in case the caller's own
// success path doesn't already replace the DOM (if it does, this is a
// harmless no-op on now-detached nodes).
async function withSaveFeedback({ disable, msgEl }, work) {
  const controls = (Array.isArray(disable) ? disable : [disable]).filter(Boolean);
  controls.forEach(el => { el.disabled = true; });
  if (msgEl) { msgEl.textContent = 'Saving…'; msgEl.className = 'save-msg'; }
  try {
    await work();
    if (msgEl) { msgEl.textContent = 'Saved.'; msgEl.className = 'save-msg ok'; }
  } catch (err) {
    if (msgEl) { msgEl.textContent = 'Error: ' + err.message; msgEl.className = 'save-msg error'; }
  } finally {
    controls.forEach(el => { el.disabled = false; });
  }
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
