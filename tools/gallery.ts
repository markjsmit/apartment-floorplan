// npm run gallery — makes the small copies (thumbs/) of every gallery picture, removes thumbs nobody uses,
// and lists pictures in assets/renders/ that gallery.json doesn't show. macOS (sips).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, loadBundleFromDisk } from './load-files';
import { thumbFile } from '../src/model/gallery';

const DIR = path.join(ROOT, 'assets/renders');
const THUMB_PX = 720;

const gallery = loadBundleFromDisk().gallery;
if (!gallery) {
  console.log('no assets/renders/gallery.json (or it has errors: npm run check)');
  process.exit(1);
}
const listed = new Set([...gallery.rooms, ...(gallery.experiments ?? [])].flatMap((r) => r.pictures.map((p) => p.file)));
let made = 0;
for (const file of listed) {
  const src = path.join(DIR, file);
  const dst = path.join(DIR, thumbFile(file));
  if (!fs.existsSync(src)) {
    console.log(`MISSING ${file}`);
    continue;
  }
  if (fs.existsSync(dst) && fs.statSync(dst).mtimeMs >= fs.statSync(src).mtimeMs) continue;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  execFileSync('sips', ['-Z', String(THUMB_PX), '-s', 'formatOptions', '70', src, '--out', dst], { stdio: 'ignore' });
  made++;
}
const thumbs = new Set([...listed].map(thumbFile));
let removed = 0;
// walk every folder (rooms, and experiments/<id>/): report unlisted pictures, drop unused thumbs
const walk = (rel: string) => {
  for (const e of fs.readdirSync(path.join(DIR, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory() && e.name === 'thumbs') {
      for (const t of fs.readdirSync(path.join(DIR, r))) {
        if (!thumbs.has(`${r}/${t}`)) {
          fs.rmSync(path.join(DIR, r, t));
          removed++;
        }
      }
    } else if (e.isDirectory()) walk(r);
    else if (rel && e.name.endsWith('.jpg') && !listed.has(r)) console.log(`NOT IN gallery.json: ${r}`);
  }
};
walk('');
console.log(`✓ ${listed.size} pictures, ${made} thumbs made, ${removed} old thumbs removed`);
