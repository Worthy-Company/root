/** Shared GitHub API helpers. Set window.GH_APP_ID before loading (e.g. 'worthy-life', 'worthy-finances'). */
(function () {
  const appId = (typeof window !== 'undefined' && window.GH_APP_ID) || 'worthy-company';
  const GH_USER_AGENT = appId + ' (+https://github.com/Worthy-Company/worthy-company)';
  const GH_MSG = (m) => appId + ': ' + m;
  async function ghFetch(path, token, opts = {}) {
    const r = await fetch('https://api.github.com' + path, {
      ...opts,
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + token,
        'User-Agent': GH_USER_AGENT,
        ...(opts.headers || {})
      }
    });
    return r;
  }
  window.GH_USER_AGENT = GH_USER_AGENT;
  window.GH_MSG = GH_MSG;
  window.ghFetch = ghFetch;
})();
