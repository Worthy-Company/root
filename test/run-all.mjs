#!/usr/bin/env node
/**
 * Shared test runner. Each area keeps its own checks next to its own code
 * (life/test/*.mjs, finance/test/*.mjs, things/test/*.mjs); this file and the rest of
 * test/ (servers, helpers, Playwright) are the shared infrastructure they run on.
 *
 * Checks run one at a time (each owns its own server lifecycle on fixed
 * ports, so they can't run concurrently) and report one combined pass/fail.
 *
 *   node run-all.mjs            every area (use after touching shared js/ or css/)
 *   node run-all.mjs life       just life/test
 *   node run-all.mjs finance    just finance/test
 *   node run-all.mjs things     just things/test
 *
 * `npm test`, `npm run test:life`, `npm run test:finance` from test/ do the same.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const areas = ['life', 'finance', 'things'];

const requested = process.argv[2];
if (requested && !areas.includes(requested)) {
  console.error(`Unknown area "${requested}". Choose one of: ${areas.join(', ')} (or none for all).`);
  process.exit(2);
}

const files = (requested ? [requested] : areas).flatMap(area => {
  const dir = path.join(repoRoot, area, 'test');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.mjs')).sort().map(f => path.join(dir, f));
});

let failures = 0;
for (const file of files) {
  console.log(`\n--- ${path.relative(repoRoot, file)} ---`);
  const result = spawnSync(process.execPath, [file], { stdio: 'inherit' });
  if (result.status !== 0) failures++;
}

console.log(`\n=== ${files.length - failures}/${files.length} test files passed ===`);
process.exit(failures ? 1 : 0);
