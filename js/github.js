/** Shared GitHub API helpers. Set window.GH_APP_ID before loading (e.g. 'worthy-life', 'worthy-finances'). */

// TEMPORARY one-time key migration — DELETE after everyone has loaded a page once.
// Old life-era key names -> new generic names. Copies only if the new key is empty,
// then removes the old key so this leaves nothing behind.
(function migrateLegacyKeys() {
  try {
    const renames = { life_github_token: 'github_token', life_gh_config: 'data_configuration' };
    for (const [oldKey, newKey] of Object.entries(renames)) {
      const oldVal = localStorage.getItem(oldKey);
      if (oldVal !== null) {
        if (localStorage.getItem(newKey) === null) localStorage.setItem(newKey, oldVal);
        localStorage.removeItem(oldKey);
      }
    }
  } catch (_) { /* localStorage unavailable — nothing to migrate */ }
})();

(function () {
  const appId = (typeof window !== 'undefined' && window.GH_APP_ID) || 'root';
  const GH_USER_AGENT = appId + ' (+https://github.com/worthy-company/root)';
  const GH_MSG = (m) => appId + ': ' + m;
  async function ghFetch(path, token, opts = {}) {
    const base = (typeof window !== 'undefined' && window.GH_API_BASE) || 'https://api.github.com';
    const r = await fetch(base + path, {
      ...opts,
      // GitHub's contents API GET responses are cacheable, and this app reads
      // the same URL again immediately after writing (to refresh the UI) —
      // without this, the browser's HTTP cache can serve the pre-write
      // snapshot, showing "Saved." while the just-saved item is missing.
      cache: 'no-store',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + token,
        'User-Agent': GH_USER_AGENT,
        ...(opts.headers || {})
      }
    });
    return r;
  }
  /** Ensure a branch exists; create from mainBranch if not. */
  async function ghEnsureBranch(token, repo, mainBranch, branchName) {
    const [owner, repoName] = repo.split('/');
    const refPath = '/repos/' + owner + '/' + repoName + '/git/ref/heads/' + encodeURIComponent(branchName);
    const r = await ghFetch(refPath, token);
    if (r.ok) return;
    const mainRef = await ghFetch('/repos/' + owner + '/' + repoName + '/git/ref/heads/' + encodeURIComponent(mainBranch), token);
    const mainData = await mainRef.json();
    const sha = mainData.object?.sha;
    if (!sha) throw new Error('Could not get base branch sha');
    const create = await ghFetch('/repos/' + owner + '/' + repoName + '/git/refs', token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: 'refs/heads/' + branchName, sha })
    });
    if (!create.ok) throw new Error((await create.json().catch(() => ({}))).message || 'Create branch failed');
  }
  /** Read a JSON file; returns { content, sha } or null if 404. */
  async function ghReadFile(token, repo, filePath, ref) {
    const [owner, repoName] = repo.split('/');
    const path = '/repos/' + owner + '/' + repoName + '/contents/' + encodeURIComponent(filePath) + '?ref=' + encodeURIComponent(ref);
    const r = await ghFetch(path, token);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'GitHub read failed');
    const data = await r.json();
    const b64 = data.content?.replace(/\n/g, '') || '';
    return { content: JSON.parse(decodeURIComponent(escape(atob(b64)))), sha: data.sha };
  }
  /**
   * GitHub's Contents API can briefly serve a read-replica response that
   * still shows pre-write content right after a PUT succeeds. Poll a plain
   * read until it reflects the sha we just wrote, backing off each try, and
   * give up silently after a few seconds (a normal read error still throws
   * through ghReadFile). This is what lets every page that reads-to-render
   * immediately after a write (goals, artifacts, the finance pages) show
   * the just-saved data without each of them having to know why.
   */
  async function ghWaitForFreshRead(token, repo, filePath, ref, expectedSha, { maxWaitMs = 5000, initialDelayMs = 250 } = {}) {
    const start = Date.now();
    let delay = initialDelayMs;
    while (Date.now() - start < maxWaitMs) {
      const current = await ghReadFile(token, repo, filePath, ref);
      if (current?.sha === expectedSha) return;
      await new Promise(res => setTimeout(res, delay));
      delay = Math.min(delay * 2, 1500);
    }
  }
  /** Write a JSON file (payload object). Waits for a subsequent read on the
   * same ref to reflect the write before returning — see ghWaitForFreshRead. */
  async function ghWriteFile(token, repo, filePath, payload, branchName, sha, message) {
    const [owner, repoName] = repo.split('/');
    const body = {
      message,
      content: btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2)))),
      branch: branchName
    };
    if (sha) body.sha = sha;
    const r = await ghFetch('/repos/' + owner + '/' + repoName + '/contents/' + encodeURIComponent(filePath), token, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'GitHub write failed');
    const data = await r.json();
    const newSha = data.content?.sha;
    if (newSha) await ghWaitForFreshRead(token, repo, filePath, branchName, newSha);
    return { sha: newSha, commitSha: data.commit?.sha };
  }
  /**
   * Save a JSON file (payload object, stamped with updatedAt) over whatever
   * is there now. The file may have changed on GitHub between our read and
   * our write (e.g. another save landed first), so on failure retry once
   * with a freshly-read sha.
   */
  async function ghSaveJson(token, repo, filePath, payload, branchName, message) {
    const content = { ...payload, updatedAt: new Date().toISOString() };
    async function attemptOnce() {
      const existing = await ghReadFile(token, repo, filePath, branchName);
      return ghWriteFile(token, repo, filePath, content, branchName, existing?.sha, GH_MSG(message));
    }
    try {
      return await attemptOnce();
    } catch (err) {
      return await attemptOnce();
    }
  }
  /**
   * Change a JSON file that is a plain list and save it. Reads the list fresh, lets `change` return the
   * new list, and writes it; a missing file counts as an empty list. Like ghSaveJson (which stamps an
   * updatedAt onto an object, so it cannot save a bare list), it retries once with a fresh read if the
   * file moved on in between. Returns the saved list.
   */
  async function ghUpdateList(token, repo, filePath, branchName, change, message) {
    async function attemptOnce() {
      const existing = await ghReadFile(token, repo, filePath, branchName);
      const list = change(Array.isArray(existing?.content) ? existing.content : []);
      await ghWriteFile(token, repo, filePath, list, branchName, existing?.sha, GH_MSG(message));
      return list;
    }
    try {
      return await attemptOnce();
    } catch (err) {
      return await attemptOnce();
    }
  }
  /** Create a PR or return existing open PR URL. */
  async function ghCreateOrUpdatePr(token, repo, mainBranch, headBranch, title, body) {
    const [owner, repoName] = repo.split('/');
    const listRes = await ghFetch('/repos/' + owner + '/' + repoName + '/pulls?head=' + encodeURIComponent(owner + ':' + headBranch) + '&base=' + encodeURIComponent(mainBranch) + '&state=open', token);
    const list = await listRes.json();
    if (Array.isArray(list) && list.length > 0) return list[0].html_url;
    const createRes = await ghFetch('/repos/' + owner + '/' + repoName + '/pulls', token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, head: headBranch, base: mainBranch })
    });
    if (!createRes.ok) throw new Error((await createRes.json().catch(() => ({}))).message || 'PR create failed');
    const pr = await createRes.json();
    return pr.html_url;
  }
  // The branch of the finance data repo used when none is configured. One
  // definition, so Setup and every page that reads the config agree.
  window.DEFAULT_DATA_BRANCH = 'updates';
  window.GH_USER_AGENT = GH_USER_AGENT;
  window.GH_MSG = GH_MSG;
  window.ghFetch = ghFetch;
  window.ghEnsureBranch = ghEnsureBranch;
  window.ghReadFile = ghReadFile;
  window.ghWriteFile = ghWriteFile;
  window.ghSaveJson = ghSaveJson;
  window.ghUpdateList = ghUpdateList;
  window.ghWaitForFreshRead = ghWaitForFreshRead;
  window.ghCreateOrUpdatePr = ghCreateOrUpdatePr;
})();
