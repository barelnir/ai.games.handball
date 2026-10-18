// Deploy step: stamp every CSS/JS URL with the build version (?v=<sha>) so a phone never mixes
// files from two different versions out of its cache. Rewrites files in place (run on CI only).
// Usage: node tools/stamp.mjs <version>
import fs from 'node:fs';
import path from 'node:path';

const v = (process.argv[2] || Date.now().toString(36)).slice(0, 12);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const files = [
  'index.html', 'mock/index.html', 'mock/eitan.html', 'sw.js',
  ...fs.readdirSync(path.join(root, 'js')).filter((f) => f.endsWith('.js')).map((f) => `js/${f}`),
];
let n = 0;
for (const f of files) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  let s = fs.readFileSync(p, 'utf8');
  const before = s;
  // ES module imports: from './x.js' / from '../js/x.js'
  s = s.replace(/(from\s+['"])(\.{1,2}\/[^'"?]+\.js)(['"])/g, `$1$2?v=${v}$3`);
  // <script src="js/main.js"> and <link href="css/style.css">
  s = s.replace(/((?:src|href)=")((?:js|css)\/[^"?]+\.(?:js|css))(")/g, `$1$2?v=${v}$3`);
  // service worker cache name
  s = s.replace(/const CACHE = 'handball(\d+)-[^']*'/, `const CACHE = 'handball$1-${v}'`);
  if (s !== before) { fs.writeFileSync(p, s); n++; }
}
console.log(`stamped ${n} files with v=${v}`);
