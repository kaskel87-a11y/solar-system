// Parse-checks every first-party module (and index.html's inline module) as ESM, so a broken line can't ship.
// node tests/test-syntax-unit.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), tmp = mkdtempSync(join(tmpdir(), 'syn-'));
const files = execFileSync('git', ['ls-files', '*.js'], { cwd: root, encoding: 'utf8' }).split('\n').filter(f => f && !/^(vendor|tests|tools|node_modules)\//.test(f) && f !== 'sw.js');
const bad = [];
const check = (name, src) => { const f = join(tmp, 'x.mjs'); writeFileSync(f, src); try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { bad.push(name + ': ' + String(e.stderr).split('\n').slice(0, 4).join(' | ')); } };
for (const f of files) check(f, readFileSync(join(root, f), 'utf8'));
const html = readFileSync(join(root, 'index.html'), 'utf8'); let i = 0;
for (const m of html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)) check('index.html#module' + i++, m[1]);
console.log(bad.length ? 'FAIL\n' + bad.join('\n') : `PASS ${files.length} modules + ${i} inline`); process.exit(bad.length ? 1 : 0);
