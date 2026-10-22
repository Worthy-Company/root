#!/usr/bin/env node
/**
 * Local stand-in for the GitHub Contents/Git API, backed by a directory on
 * disk instead of a real repo. Point a page at it with window.GH_API_BASE
 * (see js/github.js) to test against fixture data with no GitHub credentials,
 * no network, and nothing to clean up afterward.
 *
 * Reads come straight from disk. Writes (PUT contents) are held in memory
 * only, per process — they never touch the files on disk, and are gone the
 * moment this server stops. This is test tooling only; it does not ship as
 * part of the app.
 *
 * CLI usage: node test/github-stub-server.mjs [--dir finance/fixtures] [--port 8877]
 * Programmatic usage: import { startStubServer } from './github-stub-server.mjs'
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function fakeSha(input) {
  // Not a real git sha — just needs to look like one and be stable per content.
  let h = 0;
  for (let i = 0; i < input.length; i++) { h = (h * 31 + input.charCodeAt(i)) | 0; }
  return Math.abs(h).toString(16).padStart(40, '0').slice(0, 40);
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
    'Access-Control-Allow-Origin': '*'
  });
  res.end(json);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

/**
 * Start the stub server in-process. Returns { server, port, close() }.
 * `requireToken`, if given, makes the stand-in answer 401 to any request that does not carry
 * exactly that token, as GitHub does for a private repo, so a test can tell the page really
 * used the key it was given.
 */
export function startStubServer({ dir, port, requireToken = null }) {
  const fixturesDir = path.resolve(dir);
  if (!fs.existsSync(fixturesDir)) {
    throw new Error(`Fixtures dir not found: ${fixturesDir}`);
  }
  // In-memory overlay for writes (PUT). Keyed by "owner/repo/path". Never
  // touches disk, never persists across a restart.
  const writes = new Map();

  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept'
      });
      return res.end();
    }

    const url = new URL(req.url, `http://localhost:${port}`);
    const pathname = decodeURIComponent(url.pathname);

    if (requireToken && req.headers.authorization !== 'Bearer ' + requireToken) {
      return send(res, 401, { message: 'Bad credentials' });
    }

    // GET /repos/:owner/:repo/git/ref/heads/:branch — pretend every branch exists.
    let m = pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/git\/ref\/heads\/(.+)$/);
    if (m && req.method === 'GET') {
      const [, , , branch] = m;
      return send(res, 200, { ref: `refs/heads/${branch}`, object: { sha: fakeSha(branch) } });
    }

    // GET or PUT /repos/:owner/:repo/contents/:path
    m = pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/contents\/(.+)$/);
    if (m) {
      const [, owner, repo, filePath] = m;
      const key = `${owner}/${repo}/${filePath}`;

      if (req.method === 'GET') {
        if (writes.has(key)) {
          const w = writes.get(key);
          return send(res, 200, { content: Buffer.from(JSON.stringify(w.content, null, 2)).toString('base64'), sha: w.sha });
        }
        const onDisk = path.join(fixturesDir, filePath);
        if (!onDisk.startsWith(fixturesDir)) return send(res, 400, { message: 'Bad path' });
        if (!fs.existsSync(onDisk)) return send(res, 404, { message: 'Not Found' });
        const raw = fs.readFileSync(onDisk, 'utf8');
        return send(res, 200, { content: Buffer.from(raw).toString('base64'), sha: fakeSha(key) });
      }

      if (req.method === 'PUT') {
        const body = JSON.parse(await readBody(req));
        const content = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
        const sha = fakeSha(key + Date.now());
        writes.set(key, { content, sha });
        return send(res, 200, { content: { sha }, commit: { sha } });
      }
    }

    return send(res, 404, { message: 'Not Found (stub server, unimplemented route)' });
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve({ server, port, close: () => new Promise(r => server.close(r)) });
    });
  });
}

// CLI entrypoint — only runs when this file is executed directly, not when imported.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const argVal = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
  };
  const dir = argVal('dir', 'finance/fixtures');
  const port = parseInt(argVal('port', '8877'), 10);
  startStubServer({ dir, port }).then(({ port: p }) => {
    console.log(`GitHub API stub serving ${path.resolve(dir)} at http://localhost:${p}`);
    console.log(`Set window.GH_API_BASE = "http://localhost:${p}" before loading js/github.js to use it.`);
  }).catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
