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
const listed = new Set(gallery.rooms.flatMap((r) => r.pictures.map((p) => p.file)));
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
for (const room of fs.readdirSync(DIR, { withFileTypes: true }).filter((e) => e.isDirectory())) {
  for (const e of fs.readdirSync(path.join(DIR, room.name))) {
    const rel = `${room.name}/${e}`;
    if (e.endsWith('.jpg') && !listed.has(rel)) console.log(`NOT IN gallery.json: ${rel}`);
  }
  const tdir = path.join(DIR, room.name, 'thumbs');
  if (!fs.existsSync(tdir)) continue;
  for (const e of fs.readdirSync(tdir)) {
    if (!thumbs.has(`${room.name}/thumbs/${e}`)) {
      fs.rmSync(path.join(tdir, e));
      removed++;
    }
  }
}
console.log(`✓ ${listed.size} pictures, ${made} thumbs made, ${removed} old thumbs removed`);
