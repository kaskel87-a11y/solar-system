// v7.5.2: modules must import each other WITHOUT ?v= (index.html's import map adds the version). A stray ?v= loads a second module copy.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'); const skip = new Set(['tests', 'tools', 'vendor', 'shots', '.git', 'node_modules']);
const bad = []; const walk = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { if (f.isDirectory()) { if (!skip.has(f.name)) walk(path.join(d, f.name)); } else if (f.name.endsWith('.js') && f.name !== 'sw.js') { const s = fs.readFileSync(path.join(d, f.name), 'utf8'); for (const m of s.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+\?v=[^'"]*)['"]/g)) bad.push(`${path.relative(root, path.join(d, f.name))}: ${m[1]}`); } } };
walk(root);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'); const map = JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(html)[1]).imports;
const V = /sw\.js\?v=([0-9.]+)/.exec(html)[1]; const off = Object.entries(map).filter(([k, u]) => k !== 'three' && k !== 'three/addons/' && !u.endsWith('?v=' + V));
for (const m of html.matchAll(/(?:from|import)\s*\(?\s*['"](\.[^'"]+\?v=[^'"]*)['"]/g)) bad.push('index.html: ' + m[1]);
if (bad.length || off.length) { console.log('FAIL\n' + bad.join('\n') + (off.length ? '\nimport map entries not at v' + V + ': ' + off.map(e => e[0]).join(', ') : '')); process.exit(1); }
console.log(`imports OK: ${Object.keys(map).length} map entries at v${V}, no ?v= in source imports`);
