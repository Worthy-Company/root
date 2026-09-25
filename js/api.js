/**
 * App API — how the apps (life, finance) get each other's data without reading
 * each other's files. Not GitHub's API (see github.js for that). A stand-in for
 * a proper interface between the apps.
 * Life gets finance data via api.getFinanceData; only Finances writes to
 * personal-financial-data. Finance gets life's actions via api.getActions.
 */
(function () {
  if (typeof ghFetch !== 'function') {
    console.warn('api.js requires github.js loaded first');
    return;
  }

  function getFinanceDataRepo(ghConfig) {
    return ghConfig?.financeDataRepo || '';
  }

  // Not working yet. life/email.html used this to get card-purchase entries
  // (`merchant`, `amount` like "$45.20", `cardLast4`) from `transactions.json`,
  // as written by finance/finances.js. `transactions.json` is now where every
  // recorded payment goes, in the shape finance/record.html writes
  // (`counterparty`, `amountCents`, `type`), and card purchases are meant to be
  // recorded there too. The old card entries were set aside in `garbage.json`,
  // and finances.js writes there now. Until card purchases are recorded in the
  // new shape and this reads that shape, it fails outright instead of handing
  // back entries life/email.html can't use.
  async function getFinanceData() {
    throw new Error('api.getFinanceData is not working yet: transactions.json now uses the recorded-payment shape, and card purchases are not recorded in it yet.');
  }

  async function getProcessedRecurring(ghConfig, token) {
    const repo = getFinanceDataRepo(ghConfig);
    if (!repo) return { keys: [] };
    const [owner, repoName] = repo.split('/');
    const branch = ghConfig.branch || DEFAULT_DATA_BRANCH;
    const r = await ghFetch(`/repos/${owner}/${repoName}/contents/processed-recurring.json?ref=${branch}`, token);
    if (r.status === 404) return { keys: [] };
    if (!r.ok) return { keys: [] };
    const data = await r.json();
    const parsed = JSON.parse(atob(data.content.replace(/\n/g, '')));
    return parsed;
  }

  async function getHealthcareBills(ghConfig, token) {
    const repo = getFinanceDataRepo(ghConfig);
    if (!repo) return [];
    const [owner, repoName] = repo.split('/');
    const branch = ghConfig.branch || DEFAULT_DATA_BRANCH;
    const r = await ghFetch(`/repos/${owner}/${repoName}/contents/healthcare-bills.json?ref=${branch}`, token);
    if (r.status === 404) return [];
    if (!r.ok) throw new Error('GitHub: ' + (await r.json()).message || r.statusText);
    const data = await r.json();
    const parsed = JSON.parse(atob(data.content.replace(/\n/g, '')));
    return parsed.bills || [];
  }

  // Every action, each with the approach it belongs to and the goal that
  // serves, attached as separate fields (null when there isn't one), so a
  // caller never needs to know how life stores goals, approaches and actions.
  //   { id, title, approach: { id, title } | null, goal: { id, statement } | null }
  async function getActions(ghConfig, token) {
    const repo = ghConfig?.dataRepo || '';
    if (!repo) return [];
    const branch = ghConfig.tasksBranch || 'tasks';
    const read = async (file, key) => {
      const f = await ghReadFile(token, repo, file, branch);
      return f ? (f.content[key] || []) : [];
    };
    const [actions, approaches, goals] = await Promise.all([
      read('actions.json', 'actions'), read('approaches.json', 'approaches'), read('goals.json', 'goals')
    ]);
    const approachesById = new Map(approaches.map(a => [a.id, a]));
    const goalsById = new Map(goals.map(g => [g.id, g]));
    return actions.map(act => {
      const approach = approachesById.get(act.approachId) || null;
      const goal = approach ? goalsById.get(approach.goalId) || null : null;
      return {
        id: act.id,
        title: act.title || '(untitled action)',
        approach: approach && { id: approach.id, title: approach.title || '(untitled approach)' },
        goal: goal && { id: goal.id, statement: goal.statement || '(untitled goal)' }
      };
    });
  }

  window.api = {
    getActions,
    getFinanceData,
    getProcessedRecurring,
    getHealthcareBills
  };
})();
