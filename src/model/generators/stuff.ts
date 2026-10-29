import type { Part, Vec3 } from '../schema';
import { bagsSpot, cleaningRow, devicesRow, gameStack, keysSpot, shoeRow, whiskyRow } from './wear';

// Random things to make shelves look used: books, cardboard boxes, plastic bins, odds and ends.
// Deterministic per seed, so the same shelf always shows the same stuff.
// Local space: origin back-centre on the surface, x across (-width/2..width/2), z from the back (0) to the front (depth).

export type StuffKind = 'books' | 'boxes' | 'bins' | 'stuff' | 'shoes' | 'whisky' | 'games' | 'devices' | 'keys' | 'bags' | 'cleaning';
export const STUFF_KINDS: StuffKind[] = ['books', 'boxes', 'bins', 'stuff'];
// never picked by `random`: shoes (a pair per level; a cube > 26 high gets a shelf insert and 2 levels), whisky,
// games, devices, keys (tray + bowl), bags (tote + backpack), cleaning (broom closet: vacuum, mop, ironing board ...)
const SHOW_KINDS: StuffKind[] = ['shoes', 'whisky', 'games', 'devices', 'keys', 'bags', 'cleaning'];

const BOOK_COLORS = ['#7a2e2e', '#2e4a7a', '#3d6b4a', '#c9a227', '#ece6d6', '#3a3a3a', '#8a5a9e', '#d06a3a', '#5a8fa8'];
const CARDBOARD = ['#b48a5a', '#c49a68', '#a87d50'];

const num = (v: unknown, d: number) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

/** Small deterministic random generator. */
export function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** Checks a contents value: books | boxes | bins | stuff | random | "" (null = empty). */
export function stuffKind(v: unknown): StuffKind | 'random' | null {
  const k = String(v ?? '').trim().toLowerCase();
  if (k === '' || k === '-' || k === 'none') return null;
  if (k !== 'random' && !STUFF_KINDS.includes(k as StuffKind) && !SHOW_KINDS.includes(k as StuffKind)) throw new Error(`unknown contents "${k}" (use books, boxes, bins, stuff, shoes, whisky, games, devices, keys, bags, cleaning, random or "")`);
  return k as StuffKind | 'random';
}

/**
 * Fills a space `width` x `depth` x `height` with stuff. Long spaces are split into ~30-45 cm segments, each with
 * its own kind when kind = random (and sometimes left empty). Ids are `<prefix>-...`.
 */
export function stuffParts(kind: StuffKind | 'random', prefix: string, width: number, depth: number, height: number): Part[] {
  if (kind === 'shoes') {
    const levels = height > 26 ? 2 : 1;
    const out: Part[] = [];
    for (let l = 0; l < levels; l++) {
      const y = (l * height) / levels;
      if (l > 0) out.push({ id: `${prefix}-shelf-${l}`, tags: ['shelf', 'contents'], geometry: { type: 'box', size: [width - 0.4, 1.6, depth - 1] }, position: [0, y - 0.8, depth / 2], rotation: [0, 0, 0], material: 'white-laminate', castShadow: true, glass: false });
      out.push(...shoeRow(`${prefix}-l${l}`, 0, y, depth, width, `${prefix}-${l}`));
    }
    return out;
  }
  if (kind === 'whisky') return whiskyRow(prefix, 0, 0, Math.max(0, depth - 30), width, Math.min(depth, 30), height);
  if (kind === 'keys') return keysSpot(prefix, 0, 0, Math.max(0, depth - 30), width, Math.min(depth, 30));
  if (kind === 'bags') return bagsSpot(prefix, 0, 0, Math.max(0, depth - 32), width, Math.min(depth, 32), height);
  if (kind === 'devices') return devicesRow(prefix, 0, 0, Math.max(0, depth - 34), width, Math.min(depth, 34), height);
  if (kind === 'cleaning') return cleaningRow(prefix, 0, 0, 0, width, depth, height);
  if (kind === 'games') return gameStack(prefix, 0, 0, Math.max(0, depth - 32), width, Math.min(depth, 32), height);
  const rand = rng(prefix);
  const out: Part[] = [];
  const add = (id: string, tag: string, size: Vec3, position: Vec3, extra: Partial<Part>) =>
    out.push({ id: `${prefix}-${id}`, tags: ['contents', tag], geometry: { type: 'box', size }, position, rotation: [0, 0, 0], castShadow: true, glass: false, ...extra });
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

  const segments: [number, number][] = [];
  if (width <= 50) segments.push([-width / 2, width]);
  else {
    let x = -width / 2;
    while (x < width / 2 - 12) {
      const w = Math.min(width / 2 - x, 30 + rand() * 15);
      segments.push([x, w]);
      x += w + 2;
    }
  }
  segments.forEach(([x0, w], si) => {
    if (kind === 'random' && segments.length > 1 && rand() < 0.15) return; // a few empty spots
    const k = kind === 'random' ? pick(STUFF_KINDS) : kind;
    const p = `s${si}`;
    const d = Math.max(4, depth - 2);
    if (k === 'books') {
      let x = x0 + 1;
      for (let i = 0; x < x0 + w - 5; i++) {
        const t = 2.2 + rand() * 2.6;
        const h = Math.min(height - 1.5, 19 + rand() * 11);
        const bd = Math.min(d, 14 + rand() * 9);
        add(`${p}-book-${i}`, 'books', [t, h, bd], [x + t / 2, h / 2, depth - 1 - bd / 2], { color: pick(BOOK_COLORS) });
        x += t + 0.15;
      }
    } else if (k === 'boxes') {
      const bw = Math.min(w - 1, 30), bd = Math.min(d, 30);
      let y = 0;
      for (let i = 0; i < 3; i++) {
        const h = 8 + rand() * 7;
        if (y + h > height - 1.5) break;
        const ww = bw - i * 2.5, dd = bd - i * 2.5;
        add(`${p}-box-${i}`, 'boxes', [ww, h, dd], [x0 + w / 2 + (rand() - 0.5) * 2, y + h / 2, depth - 1 - dd / 2], {
          color: pick(CARDBOARD),
          ...(i === 0 && ww > 16 ? { label: { text: pick(['Misc', 'Spare', 'Old stuff', 'Manuals', 'Keep']), size: 1.8, offset: [0, 0] as [number, number], color: '#2b2b2b' } } : {}),
        });
        y += h;
      }
    } else if (k === 'bins') {
      const bw = Math.min(w - 1, 31), bd = Math.min(d, 34), h = Math.min(height - 1.5, 24);
      add(`${p}-bin`, 'bins', [bw, h, bd], [x0 + w / 2, h / 2, depth - 1 - bd / 2], { color: pick(['#d9dcde', '#c7d3dc', '#e4e1da']) });
    } else {
      const cw = Math.min(w * 0.55, 18), ch = Math.min(height - 1.5, 12), cd = Math.min(d, 22);
      add(`${p}-crate`, 'stuff', [cw, ch, cd], [x0 + cw / 2 + 1, ch / 2, depth - 1 - cd / 2], { color: pick(['#8aa1b1', '#6f8f72', '#b0a08a']) });
      const jr = Math.min(4, d / 2 - 0.5), jh = Math.min(height - 1.5, 14);
      out.push({
        id: `${prefix}-${p}-jar`, tags: ['contents', 'stuff'], geometry: { type: 'cylinder', radius: jr, height: jh, segments: 16 },
        position: [x0 + w - jr - 1, jh / 2, depth - 1 - jr - 2], rotation: [0, 0, 0], color: pick(['#e0c48a', '#cfd8dc', '#a3473a']), castShadow: true, glass: false,
      });
      const sh = 3 + rand() * 2;
      if (ch + sh < height - 1.5) add(`${p}-stack`, 'stuff', [Math.min(cw + 4, w - 2), sh, Math.min(16, d)], [x0 + cw / 2 + 1, ch + sh / 2, depth - 1 - Math.min(16, d) / 2], { color: pick(BOOK_COLORS) });
    }
  });
  return out;
}

/** Moves stuff (local frame above) into another frame: `quarterTurns` × 90° about y, then shifted by `move`. */
export function placeStuff(parts: Part[], quarterTurns: number, move: Vec3): Part[] {
  const q = ((quarterTurns % 4) + 4) % 4;
  return parts.map((p) => {
    const [x, y, z] = p.position;
    // +90° about y (three.js) maps (x, z) → (z, -x)
    const [rx, rz] = q === 0 ? [x, z] : q === 1 ? [z, -x] : q === 2 ? [-x, -z] : [-z, x];
    return { ...p, position: [rx + move[0], y + move[1], rz + move[2]], rotation: [p.rotation[0], p.rotation[1] + q * 90, p.rotation[2]] };
  });
}

/** A standalone pile of stuff, e.g. on top of a cabinet. Params: width, depth, height (free space), kind, seed. */
export function stuff(params: Record<string, unknown>): Part[] {
  const kind = stuffKind(params.kind ?? 'random') ?? 'random';
  return stuffParts(kind, `stuff-${String(params.seed ?? '')}`, num(params.width, 60), num(params.depth, 30), num(params.height, 35));
}
