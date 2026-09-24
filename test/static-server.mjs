#!/usr/bin/env node
/**
 * Minimal static file server for the app's own HTML/JS/CSS, so tests don't
 * depend on Python (or anything else) being installed. Test tooling only —
 * not how the app is actually served to a real user (see serve.ps1 / AGENTS.md
 * for that).
 *
 * CLI usage: node test/static-server.mjs [--dir .] [--port 8098]
 * Programmatic usage: import { startStaticServer } from './static-server.mjs'
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

/** Start the static server in-process. Returns { server, port, close() }. */
export function startStaticServer({ dir, port }) {
  const root = path.resolve(dir);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const filePath = path.join(root, pathname);
    if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve({ server, port, close: () => new Promise(r => server.close(r)) });
    });
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const argVal = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
  };
  const dir = argVal('dir', '.');
  const port = parseInt(argVal('port', '8098'), 10);
  startStaticServer({ dir, port }).then(({ port: p }) => {
    console.log(`Static app server serving ${path.resolve(dir)} at http://localhost:${p}`);
  });
}
