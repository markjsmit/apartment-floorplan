// npm run versions -- list | suggest [--from <id>] [--note "..."] [--room <id>]... [--force]
//                    | promote [--room <id>]... [--force] | save "<name>" [--from <id>] [--room <id>]... | drop-suggestion
// Files are whole houses; the viewer shows versions per room. --room = the room(s) a version is about (meta.rooms).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EMPTY_ID, emptyVersion, makeSuggestion, markPromoted, promote, suggestionChanges, savedId, versionIdFromPath, versionPath, type RawHouse } from '../src/model/versions';

const root = fileURLToPath(new URL('..', import.meta.url));
const abs = (rel: string) => path.join(root, rel);
const read = (id: string): RawHouse =>
  id === EMPTY_ID ? emptyVersion(read('current')) : JSON.parse(fs.readFileSync(abs(versionPath(id)), 'utf8'));
const write = (id: string, h: RawHouse) => {
  fs.mkdirSync(path.dirname(abs(versionPath(id))), { recursive: true });
  fs.writeFileSync(abs(versionPath(id)), JSON.stringify(h, null, 2) + '\n');
};
const exists = (id: string) => fs.existsSync(abs(versionPath(id)));

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? '') : undefined;
};
const has = (name: string) => args.includes(`--${name}`);
/** all values of a repeatable flag (--room a --room b) */
const flags = (name: string) => args.flatMap((a, i) => (a === `--${name}` && args[i + 1] !== undefined ? [args[i + 1]] : []));
const VALUE_FLAGS = ['--from', '--note', '--room'];
const USAGE =
  'usage: npm run versions -- list | suggest [--from id] [--note ..] [--room id].. [--force] | promote [--room id].. [--force]' +
  ' | save "<name>" [--from id] [--room id].. | drop-suggestion';

/** --room values, checked against the version they're taken from */
function roomsFlag(h: RawHouse, from: string): string[] | undefined {
  const rooms = flags('room');
  if (!rooms.length) return undefined;
  const missing = rooms.filter((r) => !h.rooms.some((x) => x.id === r));
  if (missing.length) {
    console.error(`${from} has no room ${missing.join(', ')} (have: ${h.rooms.map((x) => x.id).join(', ')})`);
    process.exit(1);
  }
  return [...new Set(rooms)];
}
const positional = args.filter((a, i) => !a.startsWith('--') && !VALUE_FLAGS.includes(args[i - 1]));

function list() {
  const ids: string[] = [];
  if (exists('current')) ids.push('current', EMPTY_ID);
  if (exists('suggestion')) ids.push('suggestion');
  const savedDir = abs('house/saved');
  if (fs.existsSync(savedDir)) {
    for (const f of fs.readdirSync(savedDir).filter((f) => f.endsWith('.json')).sort()) {
      ids.push(versionIdFromPath(`house/saved/${f}`));
    }
  }
  for (const id of ids) {
    const h = read(id);
    const rooms = Array.isArray(h.meta.rooms) && h.meta.rooms.length ? ` [rooms: ${h.meta.rooms.join(', ')}]` : '';
    console.log(`${id.padEnd(30)} ${String(h.meta.name)}${rooms}${h.meta.note ? ` — ${h.meta.note}` : ''}`);
  }
}

const [cmd, arg] = positional;
switch (cmd) {
  case 'list':
    list();
    break;
  case 'suggest': {
    if (exists('suggestion') && !has('force')) {
      console.error('house/suggestion.json already exists (use --force to replace it, or promote/drop it first)');
      process.exit(1);
    }
    const from = flag('from') ?? 'current';
    const base = read(from);
    const rooms = roomsFlag(base, from);
    write('suggestion', makeSuggestion(base, flag('note'), rooms));
    console.log(`created suggestion from ${from}${rooms ? ` (about: ${rooms.join(', ')})` : ''}`);
    break;
  }
  case 'promote': {
    if (!exists('suggestion')) {
      console.error('no house/suggestion.json to promote');
      process.exit(1);
    }
    const suggestion = read('suggestion');
    const rooms = flags('room').length ? [...new Set(flags('room'))] : undefined;
    let res;
    try {
      res = promote(read('current'), suggestion, { force: has('force'), rooms });
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }
    write('current', res.house);
    console.log(`changed rooms${rooms ? ` (of ${rooms.join(', ')})` : ''}: ${res.changed.join(', ') || '(none)'}`);
    if (res.conflicts.length && !has('force')) {
      console.log(`CONFLICTS (Current also changed these, kept Current's): ${res.conflicts.join(', ')}`);
      console.log('suggestion kept; re-run with --force to take the suggestion for those rooms');
    }
    // only some rooms promoted: keep the suggestion for its other changes (promoted rooms no longer count as changed)
    const rest = markPromoted(suggestion, res.applied);
    const remaining = suggestionChanges(rest);
    if (remaining.length) {
      write('suggestion', rest);
      if (res.applied.length) console.log(`promoted ${res.applied.join(', ')}; suggestion kept for: ${remaining.join(', ')}`);
    } else {
      fs.rmSync(abs(versionPath('suggestion')));
      console.log('suggestion promoted into current and removed');
    }
    break;
  }
  case 'save': {
    if (!arg) {
      console.error('usage: npm run versions -- save "<name>" [--from <id>] [--room <id>]...');
      process.exit(1);
    }
    const from = flag('from') ?? 'current';
    const h = structuredClone(read(from));
    const rooms = roomsFlag(h, from);
    const id = savedId(arg, exists);
    h.meta = { ...h.meta, name: arg, kind: 'saved', createdAt: new Date().toISOString() };
    delete h.meta.baseRoomHashes;
    if (rooms) h.meta.rooms = rooms;
    write(id, h);
    console.log(`saved ${from} as ${id}${rooms ? ` (about: ${rooms.join(', ')})` : ''}`);
    break;
  }
  case 'drop-suggestion':
    if (exists('suggestion')) fs.rmSync(abs(versionPath('suggestion')));
    console.log('suggestion removed');
    break;
  default:
    console.log(USAGE);
    process.exit(cmd ? 1 : 0);
}
