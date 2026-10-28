// npm run storage -- [room] [--names]  — usable storage in litres per version (see src/model/storage.ts for what counts).
// --names: write "(… L)" behind the name of every saved version that is about that room (meta.rooms = [room]).
import fs from 'node:fs';
import { loadBundleFromDisk } from './load-files';
import { roomStorage } from '../src/model/storage';
import { versionPath } from '../src/model/versions';

const args = process.argv.slice(2);
const roomId = args.find((a) => !a.startsWith('--')) ?? 'storage';
const bundle = loadBundleFromDisk();
const round = (l: number) => Math.round(l / 10) * 10;
for (const vid of bundle.versionOrder) {
  const room = bundle.versions[vid].rooms.find((r) => r.id === roomId);
  if (!room) continue;
  const s = roomStorage(room, bundle.furniture);
  console.log(
    `${vid.padEnd(48)} ${String(round(s.total)).padStart(5)} L  (kallax ${round(s.kallax)}, shelves ${round(s.shelves)}, tops ${round(s.tops)}, other ${round(s.other)}; ${s.kallaxLostCubes} cubes not reachable)`,
  );
  const meta = bundle.versions[vid].meta;
  if (args.includes('--names') && meta.kind === 'saved' && meta.rooms?.length === 1 && meta.rooms[0] === roomId) {
    const file = versionPath(vid);
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    raw.meta.name = `${String(raw.meta.name).replace(/\s*\(~?[\d,.]+ L\)$/, '')} (${round(s.total).toLocaleString('en-US')} L)`;
    fs.writeFileSync(file, JSON.stringify(raw, null, 2) + '\n');
  }
}
