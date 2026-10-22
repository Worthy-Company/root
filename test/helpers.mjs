/**
 * Shared arrange-phase helpers for the Playwright checks in this directory.
 * Each check still owns its own server lifecycle and browser page — these
 * just remove the copy-pasted "get the app into a known state" steps so
 * each check file reads as its own action + assertion, not boilerplate.
 */

export async function stubAuth(page, { stubPort }) {
  await page.addInitScript(({ stub }) => {
    window.GH_API_BASE = stub;
    localStorage.setItem('data_configuration', JSON.stringify({ dataRepo: 'x/y', tasksBranch: 'main' }));
    localStorage.setItem('github_token', 'stub-token');
  }, { stub: `http://localhost:${stubPort}` });
}

export async function createGoal(page, { appPort, statement }) {
  await page.goto(`http://localhost:${appPort}/life/goals.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.fill('#g-statement', statement);
  await page.click('#btn-goal-save');
  await page.waitForTimeout(500);
}

// Assumes the goal (if any) already exists — pass its statement to link this
// approach to it via the #ap-goal dropdown.
export async function createApproach(page, { appPort, title, goalStatement }) {
  await page.goto(`http://localhost:${appPort}/life/goals.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  if (goalStatement) {
    await page.selectOption('#ap-goal', { label: goalStatement });
  }
  await page.fill('#ap-title', title);
  await page.click('#btn-approach-save');
  await page.waitForTimeout(500);
}

// Assumes the approach (and the action-add-form under its row) already
// exists — locates the approach's row by title, then adds the action there.
export async function createAction(page, { appPort, approachTitle, title }) {
  await page.goto(`http://localhost:${appPort}/life/goals.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const row = page.locator('.item-row', { hasText: approachTitle });
  await row.locator('.action-title-input').fill(title);
  await row.locator('.action-add-form button[type="submit"]').click();
  await page.waitForTimeout(500);
}

export async function createArtifact(page, { appPort, counterparty }) {
  await page.goto(`http://localhost:${appPort}/life/artifacts.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.fill('#a-counterparty', counterparty);
  await page.click('#btn-save');
  await page.waitForTimeout(500);
}
