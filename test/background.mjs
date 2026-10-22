#!/usr/bin/env node
/**
 * Run the tests so nobody has to wait for them or be confused by them.
 *
 *   node test/background.mjs            every area
 *   node test/background.mjs finance    just finance/test
 *   node test/background.mjs life       just life/test
 *
 * For an agent: start this with your tool's background option and carry on. It runs the whole suite
 * (as often as you like; running it excessively is fine, waiting for it is not), keeps the long output
 * in a log file, and prints only a short result when it ends. That result starts with
 * "[automated: ... not from Nate]" on purpose: when a background run finishes, the tool reports it
 * where the person's own messages arrive, and a finish must never be read as an answer to a question
 * that is still open. Report the result, and keep waiting for his answer.
 *
 * Exits with the suite's exit code, so a failure is also a failed command.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const area = process.argv[2] || '';
const label = area || 'all';
const logPath = path.join(os.tmpdir(), `worthy-tests-${label}.log`);

// Everything the suite prints goes to the log, not to the conversation.
const log = fs.openSync(logPath, 'w');
const result = spawnSync(process.execPath, [path.join(__dirname, 'run-all.mjs'), ...(area ? [area] : [])], {
  stdio: ['ignore', log, log]
});
fs.closeSync(log);

const output = fs.readFileSync(logPath, 'utf8');
const summary = (output.match(/^=== .* ===$/m) || ['=== the run did not finish ==='])[0].replace(/^=== | ===$/g, '');

// A file failed if it printed a FAIL line, or never reported that it passed.
const failed = output
  .split(/^--- (.+) ---$/m)
  .reduce((acc, part, i, parts) => {
    if (i % 2 === 1) {
      const body = parts[i + 1] || '';
      const firstFail = body.split('\n').find(line => line.startsWith('FAIL'));
      if (firstFail || !/\d+\/\d+ passed/.test(body)) acc.push({ file: part, why: (firstFail || 'no result reported').slice(0, 160) });
    }
    return acc;
  }, []);

console.log(`[automated: ${label} test run finished, not from Nate] ${summary}`);
for (const f of failed.slice(0, 10)) console.log(`  FAILED ${f.file}: ${f.why}`);
if (failed.length > 10) console.log(`  ...and ${failed.length - 10} more`);
console.log(`Full log: ${logPath}`);
process.exit(result.status === 0 ? 0 : 1);
