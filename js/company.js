/**
 * Home bridge — shared bridge for inter-app data.
 * Life gets finance data via worthyCompany (not by reading repos directly).
 * Only Finances writes to personal-financial-data; bridge reads to serve Life.
 */
(function () {
  if (typeof ghFetch !== 'function') {
    console.warn('company.js requires github.js loaded first');
    return;
  }

  function getFinanceDataRepo(ghConfig) {
    return ghConfig?.financeDataRepo || '';
  }

  async function getFinanceData(ghConfig, token) {
    const repo = getFinanceDataRepo(ghConfig);
    if (!repo) return [];
    const [owner, repoName] = repo.split('/');
    const branch = ghConfig.branch || 'transactions';
    const file = ghConfig.transactionsFile || 'transactions.json';
    const r = await ghFetch(`/repos/${owner}/${repoName}/contents/${file}?ref=${branch}`, token);
    if (r.status === 404) return [];
    if (!r.ok) throw new Error('GitHub: ' + (await r.json()).message || r.statusText);
    const data = await r.json();
    const parsed = JSON.parse(atob(data.content.replace(/\n/g, '')));
    return parsed.transactions || parsed;
  }

  async function getProcessedRecurring(ghConfig, token) {
    const repo = getFinanceDataRepo(ghConfig);
    if (!repo) return { keys: [] };
    const [owner, repoName] = repo.split('/');
    const branch = ghConfig.branch || 'transactions';
    const r = await ghFetch(`/repos/${owner}/${repoName}/contents/processed-recurring.json?ref=${branch}`, token);
    if (r.status === 404) return { keys: [] };
    if (!r.ok) return { keys: [] };
    const data = await r.json();
    const parsed = JSON.parse(atob(data.content.replace(/\n/g, '')));
    return parsed;
  }

  window.worthyCompany = {
    getFinanceData,
    getProcessedRecurring
  };
})();
