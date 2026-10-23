/**
 * The machinery every page test needs, so a test file can be its story,
 * arrange, act and assert and nothing else: seed data into a temp folder,
 * serve the app and a stand-in for GitHub on free ports, open a browser
 * pointed at both, count passes and failures, and clean up.
 *
 *   const t = await startTest({ name: 'my-test', seed: { 'file.json': {...} } });
 *   await t.page.goto(t.url('/finance/record/statement/credit-card.html'), { waitUntil: 'networkidle' });
 *   t.expect('it shows up', text.includes('x'), text);   // PASS / FAIL line
 *   t.fail('no way to do the thing — ' + e.message);      // a step that threw
 *   await t.finish(7);                                    // "n/7 passed.", exits
 *
 * `seed` is { 'path/in/data/repo.json': content }, or a function that is
 * given a `write(file, content)` and calls it. `config` replaces the
 * data_configuration the page reads (default: the finance fixture repo).
 * `token` is the GitHub token the browser starts out holding (default 'stub-token'); null means a
 * fresh browser with none. `requireToken` makes the GitHub stand-in refuse any request that does not carry that token.
 * `pageGlobals` are extra values set on `window` before the page loads (how a
 * test points the page at a stand-in that only its own area uses, kept in
 * that area's test/ folder), and `cleanup` is a list of functions to run
 * when the test ends (to stop such a stand-in). `appDir` is the folder served as the
 * site (default: this repository's root); a test of an app that must work on its own
 * passes a folder holding only that app and what it includes.
 * Tests still describe themselves in their own header comment; see
 * how-we-work/testing.md and finance/test/link-to-action.mjs for the style.
 */
import { chromium } from './playwright.mjs';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from './static-server.mjs';
import { startStubServer } from './github-stub-server.mjs';
import { watchForErrors } from './watch-for-errors.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FINANCE_CONFIG = { financeDataRepo: 'Worthy-Company/finance-fixtures', dataRepo: '', branch: 'main' };

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

export async function startTest({ name, seed = {}, config = FINANCE_CONFIG, token = 'stub-token', requireToken = null, pageGlobals = {}, cleanup = [], appDir = repoRoot, timeout = 3000 }) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), name + '-'));
  const write = (file, content) => {
    const filePath = path.join(dataDir, file);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
  };
  if (typeof seed === 'function') seed(write, dataDir);
  else for (const [file, content] of Object.entries(seed)) write(file, content);

  const appPort = await freePort();
  const stubPort = await freePort();
  const appServer = await startStaticServer({ dir: appDir, port: appPort });
  const stubServer = await startStubServer({ dir: dataDir, port: stubPort, requireToken });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors = watchForErrors(page);
  page.setDefaultTimeout(timeout);

  // The page talks to the stand-in, not GitHub.
  await page.addInitScript(({ stub, cfg, tok, extra }) => {
    window.GH_API_BASE = stub;
    Object.assign(window, extra);
    localStorage.setItem('data_configuration', JSON.stringify(cfg));
    if (tok) localStorage.setItem('github_token', tok);
  }, { stub: `http://localhost:${stubPort}`, cfg: config, tok: token, extra: pageGlobals });

  let passes = 0;
  let failures = 0;

  return {
    page,
    pageErrors,
    appPort,
    stubPort,
    url: (p) => `http://localhost:${appPort}${p}`,
    expect(label, ok, detail) {
      if (ok) {
        passes++;
        console.log('PASS  ' + label);
      } else {
        failures++;
        console.error('FAIL  ' + label + (detail ? ' — ' + detail : ''));
      }
    },
    // A step that could not even be done (a button that isn't there).
    fail(message) {
      failures++;
      console.error('FAIL  ' + message);
    },
    // Reports against the count the test expects, so a step that threw early
    // is not mistaken for a smaller, passing run.
    async finish(expected, note = '') {
      await browser.close();
      await appServer.close();
      await stubServer.close();
      for (const fn of cleanup) await fn();
      fs.rmSync(dataDir, { recursive: true, force: true });
      console.log(`\n${passes}/${expected} passed.${note}`);
      process.exit(failures ? 1 : 0);
    }
  };
}
