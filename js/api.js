/**
 * App API — how the apps (life, finance) get each other's data without reading
 * each other's files. Not GitHub's API (see github.js for that). A stand-in for
 * a proper interface between the apps.
 * Life gets finance data via api.getFinanceData; only Finances writes to
 * personal-financial-data. Finance gets life's actions via api.getActions.
 * Life's own pages get their goals through it too (api.getGoal), so that only
 * this file needs to know how life's data is stored.
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

  // Life's goals, approaches and actions, each as stored. The one place that
  // knows which files hold them; null when no life data repo is configured.
  async function readLifeLists(ghConfig, token) {
    const repo = ghConfig?.dataRepo || '';
    if (!repo) return null;
    const branch = ghConfig.tasksBranch || 'tasks';
    const read = async (file, key) => {
      const f = await ghReadFile(token, repo, file, branch);
      return f ? (f.content[key] || []) : [];
    };
    const [actions, approaches, goals] = await Promise.all([
      read('actions.json', 'actions'), read('approaches.json', 'approaches'), read('goals.json', 'goals')
    ]);
    return { actions, approaches, goals };
  }

  // One goal with its approaches, each with its actions, for life's own pages.
  // Fields come through as stored; null when there is no such goal.
  //   { ...goal, approaches: [{ ...approach, actions: [{ ...action }] }] } | null
  async function getGoal(ghConfig, token, goalId) {
    const lists = await readLifeLists(ghConfig, token);
    const goal = lists?.goals.find(g => g.id === goalId);
    if (!goal) return null;
    return {
      ...goal,
      approaches: lists.approaches
        .filter(ap => ap.goalId === goal.id)
        .map(ap => ({ ...ap, actions: lists.actions.filter(a => a.approachId === ap.id) }))
    };
  }

  // Where life's data is kept. Throws when no life data repo is configured.
  function lifeTarget(ghConfig) {
    const repo = ghConfig?.dataRepo || '';
    if (!repo) throw new Error('No life data repo configured.');
    return { repo, branch: ghConfig.tasksBranch || 'tasks' };
  }

  // A short random id (lowercase letters and digits) that no other record in
  // the list has. It starts at `length` characters and only gets longer once
  // every id that short is used up, so it can never run out.
  function newShortId(taken, length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (let len = length; ; len++) {
      const usedAtThisLength = [...taken].filter(id => id.length === len).length;
      if (usedAtThisLength >= Math.pow(chars.length, len)) continue;
      for (;;) {
        const id = Array.from(crypto.getRandomValues(new Uint8Array(len)), b => chars[b % chars.length]).join('');
        if (!taken.has(id)) return id;
      }
    }
  }

  // Puts a new record at the top of one of life's lists and returns it as
  // saved, with a short id of at least `idLength` characters. Reads the list
  // fresh, so a save never overwrites one made elsewhere since the page loaded.
  async function addToLifeList(ghConfig, token, file, key, fields, message, idLength) {
    const { repo, branch } = lifeTarget(ghConfig);
    const current = await ghReadFile(token, repo, file, branch);
    const list = current?.content[key] || [];
    const record = { id: newShortId(new Set(list.map(r => r.id)), idLength), ...fields, createdAt: new Date().toISOString() };
    await ghSaveJson(token, repo, file, { [key]: [record, ...list] }, branch, message);
    return record;
  }

  // Changes some fields of one record in one of life's lists and returns it as
  // saved. Only the fields in `changes` are touched. Throws if there is no such
  // record. Reads the list fresh, like addToLifeList.
  async function updateInLifeList(ghConfig, token, file, key, id, changes, message) {
    const { repo, branch } = lifeTarget(ghConfig);
    const current = await ghReadFile(token, repo, file, branch);
    let updated = null;
    const list = (current?.content[key] || []).map(r => r.id === id ? (updated = { ...r, ...changes }) : r);
    if (!updated) throw new Error('That item was not found.');
    await ghSaveJson(token, repo, file, { [key]: list }, branch, message);
    return updated;
  }

  // Every goal, approach and action, as stored (empty lists when there is no
  // life data repo configured).
  async function getLife(ghConfig, token) {
    return (await readLifeLists(ghConfig, token)) || { goals: [], approaches: [], actions: [] };
  }

  // Writes down a new goal.
  function addGoal(ghConfig, token, statement, notes = null) {
    return addToLifeList(ghConfig, token, 'goals.json', 'goals', { statement, notes }, 'Add goal', 1);
  }

  // Writes down a new approach, under a goal or (goalId null) not yet under one.
  function addApproach(ghConfig, token, goalId, title, notes = null) {
    return addToLifeList(ghConfig, token, 'approaches.json', 'approaches', { goalId, title, notes }, 'Add approach', 2);
  }

  // Writes down a new, open next step (an action) under an approach.
  function addAction(ghConfig, token, approachId, title) {
    return addToLifeList(ghConfig, token, 'actions.json', 'actions', { approachId, title, status: 'open', outcome: null }, 'Add action', 3);
  }

  // Changes fields of a goal, such as its notes. Only the fields passed are
  // touched: changing the notes leaves the goal's wording alone.
  function updateGoal(ghConfig, token, goalId, changes) {
    return updateInLifeList(ghConfig, token, 'goals.json', 'goals', goalId, changes, 'Update goal');
  }

  // Changes fields of an approach, such as which goal it is in service of.
  function updateApproach(ghConfig, token, approachId, changes) {
    return updateInLifeList(ghConfig, token, 'approaches.json', 'approaches', approachId, changes, 'Update approach');
  }

  // Changes fields of an action, such as closing it out with how it went.
  function updateAction(ghConfig, token, actionId, changes) {
    return updateInLifeList(ghConfig, token, 'actions.json', 'actions', actionId, changes, 'Update action');
  }

  // Every action, each with the approach it belongs to and the goal that
  // serves, attached as separate fields (null when there isn't one), so a
  // caller never needs to know how life stores goals, approaches and actions.
  // `status` is 'open' or 'done' (an action saved without one counts as open).
  //   { id, title, status, approach: { id, title } | null, goal: { id, statement } | null }
  async function getActions(ghConfig, token) {
    const lists = await readLifeLists(ghConfig, token);
    if (!lists) return [];
    const { actions, approaches, goals } = lists;
    const approachesById = new Map(approaches.map(a => [a.id, a]));
    const goalsById = new Map(goals.map(g => [g.id, g]));
    return actions.map(act => {
      const approach = approachesById.get(act.approachId) || null;
      const goal = approach ? goalsById.get(approach.goalId) || null : null;
      return {
        id: act.id,
        title: act.title || '(untitled action)',
        status: act.status === 'done' ? 'done' : 'open',
        approach: approach && { id: approach.id, title: approach.title || '(untitled approach)' },
        goal: goal && { id: goal.id, statement: goal.statement || '(untitled goal)' }
      };
    });
  }

  window.api = {
    getActions,
    getGoal,
    getLife,
    addGoal,
    addApproach,
    addAction,
    updateGoal,
    updateApproach,
    updateAction,
    getFinanceData,
    getProcessedRecurring,
    getHealthcareBills
  };
})();
