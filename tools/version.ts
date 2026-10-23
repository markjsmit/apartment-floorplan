// npm run versions -- list | suggest [--from <id>] [--note "..."] [--force] | promote [--force]
//                    | save "<name>" [--from <id>] | drop-suggestion
import fs from 'node:fs';
import path from 'node:path';
import { makeSuggestion, promote, slugify, versionIdFromPath, versionPath, type RawHouse } from '../src/model/versions';

const root = path.resolve(import.meta.dirname, '..');
const abs = (rel: string) => path.join(root, rel);
const read = (id: string): RawHouse => JSON.parse(fs.readFileSync(abs(versionPath(id)), 'utf8'));
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
const VALUE_FLAGS = ['--from', '--note'];
const positional = args.filter((a, i) => !a.startsWith('--') && !VALUE_FLAGS.includes(args[i - 1]));

function list() {
  const ids: string[] = [];
  if (exists('current')) ids.push('current');
  if (exists('suggestion')) ids.push('suggestion');
  const savedDir = abs('house/saved');
  if (fs.existsSync(savedDir)) {
    for (const f of fs.readdirSync(savedDir).filter((f) => f.endsWith('.json')).sort()) {
      ids.push(versionIdFromPath(`house/saved/${f}`));
    }
  }
  for (const id of ids) {
    const h = read(id);
    console.log(`${id.padEnd(30)} ${String(h.meta.name)}${h.meta.note ? ` — ${h.meta.note}` : ''}`);
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
    write('suggestion', makeSuggestion(read(from), flag('note')));
    console.log(`created suggestion from ${from}`);
    break;
  }
  case 'promote': {
    const res = promote(read('current'), read('suggestion'), { force: has('force') });
    write('current', res.house);
    console.log(`changed rooms: ${res.changed.join(', ') || '(none)'}`);
    if (res.conflicts.length && !has('force')) {
      console.log(`CONFLICTS (Current also changed these, kept Current's): ${res.conflicts.join(', ')}`);
      console.log('suggestion kept; re-run with --force to take the suggestion for those rooms');
    } else {
      fs.rmSync(abs(versionPath('suggestion')));
      console.log('suggestion promoted into current and removed');
    }
    break;
  }
  case 'save': {
    if (!arg) {
      console.error('usage: npm run versions -- save "<name>" [--from <id>]');
      process.exit(1);
    }
    const from = flag('from') ?? 'current';
    const h = structuredClone(read(from));
    const id = `saved/${slugify(arg)}`;
    h.meta = { ...h.meta, name: arg, kind: 'saved', createdAt: new Date().toISOString() };
    delete h.meta.baseRoomHashes;
    write(id, h);
    console.log(`saved ${from} as ${id}`);
    break;
  }
  case 'drop-suggestion':
    if (exists('suggestion')) fs.rmSync(abs(versionPath('suggestion')));
    console.log('suggestion removed');
    break;
  default:
    console.log('usage: npm run versions -- list | suggest [--from id] [--note ..] [--force] | promote [--force] | save "<name>" [--from id] | drop-suggestion');
    process.exit(cmd ? 1 : 0);
}
