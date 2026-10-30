import type { Part, Vec3 } from '../schema';
import { rng } from './stuff';

// Things that show a home is lived in: shoe pairs, coats on hooks or hangers, whisky bottles, board games.
// Each helper returns parts in the caller's frame: (x, y, z) = where the thing stands / hangs, +z = its front.

const part = (id: string, tags: string[], geometry: Part['geometry'], position: Vec3, extra: Partial<Part> = {}): Part => ({
  id, tags, geometry, position, rotation: [0, 0, 0], castShadow: true, glass: false, ...extra,
});
const ell = (id: string, tags: string[], size: Vec3, position: Vec3, extra: Partial<Part> = {}) => part(id, tags, { type: 'ellipsoid', size, segments: 14 }, position, extra);
const box = (id: string, tags: string[], size: Vec3, position: Vec3, { radius, ...extra }: Partial<Part> & { radius?: number } = {}) =>
  part(id, tags, { type: 'box', size, ...(radius ? { radius } : {}) }, position, extra);
const cyl = (id: string, tags: string[], radius: number, height: number, position: Vec3, extra: Partial<Part> = {}) =>
  part(id, tags, { type: 'cylinder', radius, height, segments: 16 }, position, extra);

export const SHOE_COLORS = ['#f2f0ec', '#1f1f22', '#7a6a58', '#2e3a52', '#b8b2a6', '#8a3b2e', '#d9cdb8'];
export const COAT_COLORS = ['#2e3a52', '#7a6a58', '#1f1f22', '#a8763e', '#5e6b52', '#b8b2a6'];

/** A pair of shoes side by side, toes to +z, standing on y. kind: sneaker | boot | loafer. ~22 wide x 28 long. */
export function shoePair(prefix: string, x: number, y: number, z: number, kind = 'sneaker', color = '#f2f0ec'): Part[] {
  const tags = ['shoes', 'contents'];
  const sole = kind === 'sneaker' ? '#f4f2ee' : '#2a2522';
  const h = kind === 'boot' ? 17 : kind === 'loafer' ? 7 : 9;
  const out: Part[] = [];
  for (const [s, side] of [['l', -1], ['r', 1]] as const) {
    const sx = x + side * 5.6;
    out.push(box(`${prefix}-${s}-sole`, tags, [9.2, 1.6, 27], [sx, y + 0.8, z], { color: sole }));
    out.push(ell(`${prefix}-${s}-upper`, tags, [9, h * 1.5, 26], [sx, y + 1.6, z - 0.5], { color }));
    if (kind === 'boot') out.push(cyl(`${prefix}-${s}-shaft`, tags, 4.6, h, [sx, y + 1.6 + h / 2, z - 7], { color }));
  }
  return out;
}

/** Pairs of shoes along a shelf `width` wide, centred on x, toes to the front (z = front edge - 15). */
export function shoeRow(prefix: string, x: number, y: number, zFront: number, width: number, seed = prefix, max = 99): Part[] {
  const rand = rng(seed);
  const n = Math.min(max, Math.max(1, Math.floor((width - 2) / 23)));
  const out: Part[] = [];
  for (let i = 0; i < n; i++) {
    const px = x - ((n - 1) * 23) / 2 + i * 23;
    const kind = rand() < 0.6 ? 'sneaker' : rand() < 0.5 ? 'loafer' : 'boot';
    out.push(...shoePair(`${prefix}-${i}`, px, y, zFront - 15, kind, SHOE_COLORS[Math.floor(rand() * SHOE_COLORS.length)]));
  }
  return out;
}

/**
 * A jacket hanging from (x, top, z): on a hook (front to +z, against the wall) or on a hanger on a rail (turned
 * sideways, so its width runs along z, like in a closet). A flat garment: rounded slab body widening to the hem,
 * padded shoulders, sleeves hanging along the sides, a collar.
 */
export function coat(prefix: string, x: number, top: number, z: number, color = '#2e3a52', onHanger = false, length = 72): Part[] {
  const tags = ['coat', 'contents'];
  const w = 44;
  const d = 9;
  const fab = { color, material: 'nylon-fabric' };
  const sz = (sx: number, sy: number, sd: number): Vec3 => (onHanger ? [sd, sy, sx] : [sx, sy, sd]);
  const at = (dx: number, dy: number, dz = 0): Vec3 => (onHanger ? [x + dz, top + dy, z + dx] : [x + dx, top + dy, z + dz]);
  const slab = (id: string, size: Vec3, pos: Vec3, r: number): Part => ({ ...box(id, tags, size, pos, fab), geometry: { type: 'box', size, radius: r } });
  const out: Part[] = [
    slab(`${prefix}-body`, sz(w - 8, length - 10, d), at(0, -10 - (length - 10) / 2, 0), 3.5),
    slab(`${prefix}-hem`, sz(w - 4, length * 0.45, d - 1), at(0, -length + length * 0.225 + 1, 0.3), 3),
    ell(`${prefix}-shoulders`, tags, sz(w, 12, d + 2), at(0, -9), fab),
    slab(`${prefix}-sleeve-l`, sz(9, length * 0.72, d - 1), at(-w / 2 + 4, -10 - length * 0.36, 0.8), 3.5),
    slab(`${prefix}-sleeve-r`, sz(9, length * 0.72, d - 1), at(w / 2 - 4, -10 - length * 0.36, 0.8), 3.5),
    ell(`${prefix}-collar`, tags, sz(16, 7, d + 2), at(0, -3, 0.5), fab),
  ];
  if (onHanger) out.push(box(`${prefix}-hanger`, ['hanger'], [1, 2, w - 4], [x, top - 4, z], { color: '#c49c68' }));
  else out.push(box(`${prefix}-loop`, tags, [1.5, 5, 0.6], [x, top - 2, z - d / 2 + 1], { color }));
  return out;
}

/** Small kitchen devices on a shelf: air fryer, stand mixer, toaster, kettle (stand on y, back at z0). */
export function devicesRow(prefix: string, x: number, y: number, z0: number, width: number, depth: number, height: number): Part[] {
  const rand = rng(prefix);
  const out: Part[] = [];
  const kinds = ['airfryer', 'mixer', 'toaster', 'kettle', 'blender'];
  let px = x - width / 2 + 1;
  for (let i = 0; px < x + width / 2 - 14; i++) {
    const k = kinds[Math.floor(rand() * kinds.length)];
    const c = ['#1f1f22', '#e9e6e0', '#b8b2a6', '#7a2e2e'][Math.floor(rand() * 4)];
    const dz = z0 + Math.min(depth, 34) / 2;
    if (k === 'airfryer') {
      const s: Vec3 = [27, Math.min(height - 2, 31), 32];
      if (px + s[0] > x + width / 2) break;
      out.push({ ...box(`${prefix}-${i}`, ['device', 'contents'], s, [px + s[0] / 2, y + s[1] / 2, dz], { color: c }), geometry: { type: 'box', size: s, radius: 5 } });
      px += s[0] + 2;
    } else if (k === 'toaster') {
      const s: Vec3 = [28, Math.min(height - 2, 19), 17];
      if (px + s[0] > x + width / 2) break;
      out.push({ ...box(`${prefix}-${i}`, ['device', 'contents'], s, [px + s[0] / 2, y + s[1] / 2, dz], { color: c, material: 'stainless' }), geometry: { type: 'box', size: s, radius: 3 } });
      px += s[0] + 2;
    } else {
      const r = k === 'mixer' ? 10 : 8;
      const h = Math.min(height - 2, k === 'blender' ? 34 : k === 'mixer' ? 30 : 24);
      if (px + 2 * r > x + width / 2) break;
      out.push(cyl(`${prefix}-${i}`, ['device', 'contents'], r, h, [px + r, y + h / 2, dz], { color: c }));
      out.push(cyl(`${prefix}-${i}-top`, ['device', 'contents'], r * 0.8, 2, [px + r, y + h + 1, dz], { color: '#2a2a2a' }));
      px += 2 * r + 2;
    }
  }
  return out;
}

// paper = label colour, ink = text colour, cap = the cap / cork top
const WHISKY = [
  { label: 'Lagavulin', color: '#8a4a1a', glass: '#2c3b2a', paper: '#efe6d2', ink: '#1f1f22', cap: '#1f1f22' },
  { label: 'Talisker', color: '#9a5a1e', glass: '#e8e2d6', paper: '#f4efe6', ink: '#8a2a1e', cap: '#c9a227' },
  { label: 'Glenfiddich', color: '#b06a22', glass: '#3a4a3a', paper: '#1f2a24', ink: '#d9b45a', cap: '#c9a227' },
  { label: 'Laphroaig', color: '#8e5420', glass: '#2a3a2c', paper: '#f2f0ec', ink: '#2e5a3a', cap: '#2e5a3a' },
  { label: 'Macallan', color: '#a86322', glass: '#e8e2d6', paper: '#e9dcc4', ink: '#5a1e1e', cap: '#3a2a1e' },
  { label: 'Yamazaki', color: '#b8742c', glass: '#e8e2d6', paper: '#f4f1ea', ink: '#1f1f22', cap: '#c9a227' },
];

/** Whisky bottles (round + square) and a couple of tumblers in a row, `width` wide, centred on x, back at z0. */
export function whiskyRow(prefix: string, x: number, y: number, z0: number, width: number, depth: number, height: number): Part[] {
  const rand = rng(prefix);
  const out: Part[] = [];
  const n = Math.max(1, Math.floor(width / 10));
  const bh = Math.min(height - 3, 24);
  for (let i = 0; i < n; i++) {
    const w = WHISKY[Math.floor(rand() * WHISKY.length)];
    const px = x - ((n - 1) * 10) / 2 + i * 10;
    const pz = z0 + Math.min(depth, 30) / 2 + (rand() - 0.5) * 4;
    const h = bh * (0.82 + rand() * 0.18);
    const body = h * 0.72;
    if (i === n - 1 && n > 2) {
      // two tumblers instead of the last bottle
      for (const dx of [-2.5, 2.5]) out.push(cyl(`${prefix}-glass-${dx}`, ['glass', 'contents'], 3.6, 9, [px + dx, y + 4.5, pz + (dx > 0 ? 5 : -2)], { material: 'glass', glass: true }));
      continue;
    }
    const square = rand() < 0.35;
    const liquid = { color: w.color };
    const lh = body * 0.48; // the paper label, a bit below the middle of the body
    const ly = y + body * 0.45;
    const text = { text: w.label, size: 0.85, offset: [0, 0] as [number, number], color: w.ink, bg: 'none' };
    if (square) {
      out.push({ ...box(`${prefix}-b${i}`, ['bottle', 'whisky', 'contents'], [8, body, 8], [px, y + body / 2, pz], liquid), geometry: { type: 'box', size: [8, body, 8], radius: 0.8 } });
      out.push(box(`${prefix}-b${i}-label`, ['bottle', 'label', 'contents'], [6.4, lh, 0.15], [px, ly, pz + 4.05], { color: w.paper, label: text }));
    } else {
      out.push(cyl(`${prefix}-b${i}`, ['bottle', 'whisky', 'contents'], 3.9, body, [px, y + body / 2, pz], liquid));
      out.push(cyl(`${prefix}-b${i}-label`, ['bottle', 'label', 'contents'], 3.95, lh, [px, ly, pz], { color: w.paper, label: { ...text, size: 0.75 } }));
    }
    out.push(cyl(`${prefix}-b${i}-band`, ['bottle', 'contents'], square ? 4.15 : 3.97, 0.6, [px, ly + lh / 2 + 1.2, pz], { color: w.ink }));
    out.push(ell(`${prefix}-b${i}-shoulder`, ['bottle', 'contents'], [square ? 8 : 7.8, 3.4, square ? 8 : 7.8], [px, y + body, pz], liquid));
    out.push(cyl(`${prefix}-b${i}-neck`, ['bottle', 'contents'], 1.4, h - body - 2, [px, y + body + (h - body - 2) / 2, pz], { color: w.glass }));
    out.push(cyl(`${prefix}-b${i}-cork`, ['bottle', 'contents'], 1.75, 2.4, [px, y + h - 1.2, pz], { color: w.cap }));
  }
  return out;
}

// c = lid colour, a = the art / band colour, ink = title colour
const GAMES = [
  { t: 'CATAN', c: '#c8452c', a: '#e9b44c', ink: '#fff6e0' }, { t: 'Ticket to Ride', c: '#2e5a8a', a: '#c8452c', ink: '#f4efe6' },
  { t: 'AZUL', c: '#e8e0cf', a: '#2e6fb0', ink: '#1f3f6a' }, { t: 'CODENAMES', c: '#1f1f22', a: '#c8452c', ink: '#f4efe6' },
  { t: 'Carcassonne', c: '#3d6b4a', a: '#d9c48a', ink: '#f4efe6' }, { t: 'DiXiT', c: '#d9a43a', a: '#6a4a8a', ink: '#3a1e4a' },
  { t: 'Wingspan', c: '#7fa3b8', a: '#e8e0cf', ink: '#1f2a3a' }, { t: 'PANDEMIC', c: '#2c6b6b', a: '#c8452c', ink: '#f4efe6' },
  { t: 'Splendor', c: '#6a4a8a', a: '#d9b45a', ink: '#f4efe6' }, { t: 'ROOT', c: '#b8742c', a: '#3d6b4a', ink: '#fff6e0' },
];

/** Board-game boxes: a flat stack (big boxes) next to a few standing on edge like books. */
export function gameStack(prefix: string, x: number, y: number, z0: number, width: number, depth: number, height: number): Part[] {
  const rand = rng(prefix);
  const out: Part[] = [];
  const pick = () => GAMES[Math.floor(rand() * GAMES.length)];
  const big = Math.min(width - 2, 30, depth - 2);
  let yy = y;
  for (let i = 0; yy < y + height - 12 && i < 4; i++) {
    const g = pick();
    const h = 5 + rand() * 3;
    const s = big - i * 1.5;
    const gx = x + (rand() - 0.5);
    const gz = z0 + depth / 2;
    // a cardboard base with the printed lid over most of it, the title + a band of art on the front, art on top
    const lidH = h * 0.78;
    out.push(box(`${prefix}-flat-${i}`, ['game', 'contents'], [s - 0.3, h, s - 0.3], [gx, yy + h / 2, gz], { color: '#e9e4d8', radius: 0.2 }));
    out.push(box(`${prefix}-flat-${i}-lid`, ['game', 'lid', 'contents'], [s, lidH, s], [gx, yy + h - lidH / 2, gz], { color: g.c, radius: 0.3 }));
    const size = Math.min(1.5, (s - 3) / (g.t.length * 0.62), lidH * 0.42);
    out.push(box(`${prefix}-flat-${i}-band`, ['game', 'contents'], [s * 0.34, lidH * 0.62, 0.12], [gx - s * 0.3, yy + h - lidH / 2, gz + s / 2 + 0.06], { color: g.a, radius: 0 }));
    out.push(box(`${prefix}-flat-${i}-title`, ['game', 'contents'], [s * 0.6, lidH * 0.7, 0.1], [gx + s * 0.16, yy + h - lidH / 2, gz + s / 2 + 0.05], { color: g.c, radius: 0, label: { text: g.t, size, offset: [0, 0], color: g.ink, bg: 'none' } }));
    if (yy + h >= y + height - 12 || i === 3 || rand() < 0.4) {
      // cover art on the top of the lid (seen from above): a frame and a picture
      out.push(box(`${prefix}-flat-${i}-art`, ['game', 'contents'], [s * 0.72, 0.12, s * 0.5], [gx, yy + h + 0.06, gz + s * 0.08], { color: g.a, radius: 0 }));
      out.push(cyl(`${prefix}-flat-${i}-art-2`, ['game', 'contents'], s * 0.12, 0.16, [gx - s * 0.12, yy + h + 0.1, gz + s * 0.05], { color: g.ink }));
    }
    yy += h;
  }
  return out;
}

/** Key drop: a wooden tray with keys, a small bowl, sunglasses (stand on y, back at z0). */
export function keysSpot(prefix: string, x: number, y: number, z0: number, width: number, depth: number): Part[] {
  const rand = rng(prefix);
  const tz = z0 + Math.min(depth, 30) / 2;
  const tw = Math.min(width - 4, 26);
  const out: Part[] = [
    { ...box(`${prefix}-tray`, ['tray', 'contents'], [tw, 2, 16], [x, y + 1, tz], { material: 'wood-oak-light' }), geometry: { type: 'box', size: [tw, 2, 16], radius: 0.8 } },
    ell(`${prefix}-bowl`, ['bowl', 'contents'], [11, 4, 11], [x + tw / 2 - 6, y + 3.5, tz - 2], { color: ['#c9a227', '#d9cfbf', '#3a3a3a'][Math.floor(rand() * 3)] }),
    box(`${prefix}-key-1`, ['keys', 'contents'], [5, 0.6, 2], [x - 4, y + 2.4, tz + 2], { color: '#b8b8b8' }),
    box(`${prefix}-key-2`, ['keys', 'contents'], [4, 0.6, 2.2], [x - 2, y + 2.4, tz - 1], { color: '#c9a227' }),
    { ...box(`${prefix}-fob`, ['keys', 'contents'], [3, 1.2, 4], [x - 7, y + 2.6, tz - 3], { color: '#2a2a2a' }), geometry: { type: 'box', size: [3, 1.2, 4], radius: 0.5 } },
  ];
  if (rand() < 0.6) out.push({ ...box(`${prefix}-glasses`, ['contents'], [14, 3, 5], [x + 1, y + 4, tz + 5], { color: '#1f1f22' }), geometry: { type: 'box', size: [14, 3, 5], radius: 1.4 } });
  return out;
}

/** A closed laptop lying flat with its charger next to it, sometimes a notebook under it (stand on y, back at z0). */
export function laptopSpot(prefix: string, x: number, y: number, z0: number, width: number, depth: number): Part[] {
  const rand = rng(prefix);
  const lw = Math.min(width - 2, 31);
  const ld = Math.min(depth - 2, 22);
  const lz = z0 + Math.min(depth, 34) / 2;
  const out: Part[] = [];
  let top = y;
  if (rand() < 0.5) {
    out.push(box(`${prefix}-notebook`, ['contents'], [Math.min(lw, 21), 1.2, Math.min(ld, 28)], [x, y + 0.6, lz], { color: ['#2e3a52', '#d9cdb8', '#5e6b52'][Math.floor(rand() * 3)] }));
    top += 1.2;
  }
  out.push(box(`${prefix}-laptop`, ['laptop', 'contents'], [lw, 1.6, ld], [x, top + 0.8, lz], { color: rand() < 0.5 ? '#c8c9cc' : '#3a3b3e', radius: 0.6 }));
  if (width - lw > 0) out.push(box(`${prefix}-charger`, ['contents'], [6, 2.4, 6], [x + lw / 2 - 4, top + 2.8, lz + ld / 2 - 4], { color: '#efefef', radius: 0.8 }));
  return out;
}

/** Everyday bags: a canvas tote and a small backpack (stand on y, back at z0). */
export function bagsSpot(prefix: string, x: number, y: number, z0: number, width: number, depth: number, height: number): Part[] {
  const rand = rng(prefix);
  const h = Math.min(height - 3, 28);
  const tz = z0 + Math.min(depth, 32) / 2;
  const c1 = ['#d9cdb8', '#5e6b52', '#2e3a52'][Math.floor(rand() * 3)];
  const c2 = ['#1f1f22', '#7a6a58', '#a8763e'][Math.floor(rand() * 3)];
  const slab = (id: string, size: Vec3, pos: Vec3, color: string, r: number): Part => ({ ...box(id, ['bag', 'contents'], size, pos, { color, material: 'nylon-fabric' }), geometry: { type: 'box', size, radius: r } });
  return [
    { ...slab(`${prefix}-tote`, [Math.min(width / 2 - 1, 15), h * 0.85, 8], [x - width / 4, y + (h * 0.85) / 2, tz], c1, 2.5), rotation: [0, 0, -4] as Vec3 },
    slab(`${prefix}-pack`, [Math.min(width / 2 - 2, 14), h, 12], [x + width / 4, y + h / 2, tz], c2, 4),
    slab(`${prefix}-pocket`, [10, h * 0.35, 3], [x + width / 4, y + h * 0.3, tz + 6.5], c2, 1.2),
  ];
}

/** Cordless stick vacuum standing on y, floor head to +z (or along x with `turned`). ~112 high. */
export function stickVacuum(prefix: string, x: number, y: number, z: number, h = 112, turned = false): Part[] {
  const tags = ['cleaning', 'vacuum', 'contents'];
  const head: Vec3 = turned ? [9, 5, 25] : [25, 5, 9];
  const wand = h - 34;
  return [
    { ...box(`${prefix}-head`, tags, head, [x, y + 2.5, z], { color: '#3a3a3c' }), geometry: { type: 'box', size: head, radius: 2 } },
    { ...box(`${prefix}-brush`, tags, turned ? [7.6, 1.2, 23] : [23, 1.2, 7.6], [x, y + 0.6, z], { color: '#c9a227' }), geometry: { type: 'box', size: turned ? [7.6, 1.2, 23] : [23, 1.2, 7.6], radius: 0.5 } },
    cyl(`${prefix}-wand`, tags, 1.6, wand, [x, y + 5 + wand / 2, z], { material: 'aluminium-grey' }),
    cyl(`${prefix}-bin`, tags, 4.8, 13, [x, y + h - 25, z + 2], { color: '#cfd6dc', glass: true }),
    cyl(`${prefix}-motor`, tags, 4.2, 9, [x, y + h - 14, z + 2], { color: '#7b4fb0' }),
    { ...box(`${prefix}-battery`, tags, [5, 8, 6], [x, y + h - 21, z - 4], { color: '#2a2a2c' }), geometry: { type: 'box', size: [5, 8, 6], radius: 1.2 } },
    { ...box(`${prefix}-handle`, tags, [3, 13, 3.5], [x, y + h - 6.5, z - 4], { color: '#2a2a2c' }), geometry: { type: 'box', size: [3, 13, 3.5], radius: 1.2 } },
  ];
}

/** Flat mop standing on its head (on y): handle up, head across x (or along z with `turned`). */
export function flatMop(prefix: string, x: number, y: number, z: number, h = 130, turned = false): Part[] {
  const tags = ['cleaning', 'mop', 'contents'];
  const pad: Vec3 = turned ? [12, 2.5, 32] : [32, 2.5, 12];
  return [
    { ...box(`${prefix}-pad`, tags, pad, [x, y + 1.25, z], { color: '#d8dde2', material: 'linen-white' }), geometry: { type: 'box', size: pad, radius: 1 } },
    { ...box(`${prefix}-plate`, tags, turned ? [10, 1.2, 30] : [30, 1.2, 10], [x, y + 3.1, z], { color: '#4f7fa8' }), geometry: { type: 'box', size: turned ? [10, 1.2, 30] : [30, 1.2, 10], radius: 0.5 } },
    cyl(`${prefix}-joint`, tags, 1.6, 4, [x, y + 5.5, z], { color: '#2a2a2c' }),
    cyl(`${prefix}-handle`, tags, 1.1, h - 7, [x, y + 7 + (h - 7) / 2, z], { color: '#4f7fa8' }),
    cyl(`${prefix}-grip`, tags, 1.4, 14, [x, y + h - 8, z], { color: '#2a2a2c' }),
  ];
}

/** Broom with the head on the floor (on y) and a dustpan leaning against it. */
export function broom(prefix: string, x: number, y: number, z: number, h = 125): Part[] {
  const tags = ['cleaning', 'broom', 'contents'];
  return [
    { ...box(`${prefix}-bristles`, tags, [24, 7, 4.5], [x, y + 3.5, z], { color: '#c9b27a' }), geometry: { type: 'box', size: [24, 7, 4.5], radius: 0.8 } },
    { ...box(`${prefix}-block`, tags, [26, 3.5, 5.5], [x, y + 8.5, z], { color: '#3d6b4a' }), geometry: { type: 'box', size: [26, 3.5, 5.5], radius: 1.2 } },
    cyl(`${prefix}-handle`, tags, 1.1, h - 10, [x, y + 10 + (h - 10) / 2, z], { color: '#3d6b4a' }),
    { ...box(`${prefix}-pan`, tags, [24, 22, 1.2], [x, y + 11, z + 4], { color: '#3d6b4a' }), geometry: { type: 'box', size: [24, 22, 1.2], radius: 0.5 }, rotation: [-12, 0, 0] as Vec3 },
  ];
}

/** Folded ironing board standing on its end on y, flat side to +z (turned: flat side to +x). */
export function ironingBoard(prefix: string, x: number, y: number, z: number, len = 120, w = 34, turned = false): Part[] {
  const tags = ['cleaning', 'ironing board', 'contents'];
  const nose = Math.min(32, len * 0.3);
  const pts: [number, number][] = [[-w / 2, -len / 2], [w / 2, -len / 2], [w / 2, len / 2 - nose]];
  for (let i = 1; i < 10; i++) {
    const a = (i / 10) * Math.PI;
    pts.push([(Math.cos(a) * w) / 2, len / 2 - nose + Math.sin(a) * nose]);
  }
  pts.push([-w / 2, len / 2 - nose]);
  const yaw = turned ? 90 : 0;
  const along = (d: number): [number, number] => (turned ? [x + d, z] : [x, z + d]);
  const [bx, bz] = along(-2.2);
  return [
    { id: `${prefix}-top`, tags, geometry: { type: 'prism', points: pts, depth: 3, bevel: 0.8 }, position: [x, y + len / 2 + 0.8, z], rotation: [0, yaw, 0], color: '#9fb3c8', material: 'linen-white', castShadow: true, glass: false },
    { ...box(`${prefix}-legs`, tags, [w * 0.7, len * 0.8, 1.6], [bx, y + len * 0.45, bz], { material: 'aluminium-grey' }), geometry: { type: 'box', size: [w * 0.7, len * 0.8, 1.6], radius: 0.6 }, rotation: [0, yaw, 0] as Vec3 },
  ];
}

/** Two spray bottles + a roll of kitchen paper (stand on y). */
export function cleaningSprays(prefix: string, x: number, y: number, z: number): Part[] {
  const tags = ['cleaning', 'contents'];
  return [
    cyl(`${prefix}-spray-1`, tags, 3.2, 17, [x - 7, y + 8.5, z], { color: '#5aa0c8' }),
    { ...box(`${prefix}-spray-1-head`, tags, [3, 4, 6], [x - 7, y + 19, z + 1], { color: '#f2f0ec' }), geometry: { type: 'box', size: [3, 4, 6], radius: 0.8 } },
    cyl(`${prefix}-spray-2`, tags, 3, 15, [x, y + 7.5, z + 1], { color: '#e9a23b' }),
    { ...box(`${prefix}-spray-2-head`, tags, [3, 4, 6], [x, y + 16.5, z + 2], { color: '#2a2a2c' }), geometry: { type: 'box', size: [3, 4, 6], radius: 0.8 } },
    cyl(`${prefix}-paper`, tags, 5.5, 22, [x + 9, y + 11, z], { color: '#f4f1ea' }),
  ];
}

/** A broom-closet compartment `width` x `depth` x `height` (back at z0): ironing board at the back, vacuum, mop, broom, sprays on a shelf. */
export function cleaningRow(prefix: string, x: number, y: number, z0: number, width: number, depth: number, height: number): Part[] {
  const out: Part[] = [];
  const tall = Math.min(height - 4, 130);
  if (width >= 38) out.push(...ironingBoard(`${prefix}-iron`, x, y, z0 + 2.5, Math.min(tall, 120), Math.min(34, width - 4)));
  else if (depth >= 36) out.push(...ironingBoard(`${prefix}-iron`, x + width / 2 - 3, y, z0 + depth / 2, Math.min(tall, 120), Math.min(34, depth - 4), true));
  const front = z0 + Math.min(depth - 8, 30);
  const narrow = width < 45;
  out.push(...stickVacuum(`${prefix}-vac`, x - width / 2 + (narrow ? 7 : 15), y, front - (narrow ? 4 : 0), Math.min(tall, 112), narrow));
  out.push(...flatMop(`${prefix}-mop`, x + width / 2 - (narrow ? 14 : 18), y, front, tall, narrow));
  if (width >= 55) out.push(...broom(`${prefix}-broom`, x + 2, y, front - 2, Math.min(tall, 125)));
  // narrow broom cabinet: the broom stands between the vacuum and the mop, a bit further back
  else if (depth >= 34) out.push(...broom(`${prefix}-broom`, x + 1, y, front - 12, Math.min(tall, 125)));
  if (height >= 160) {
    const sy = y + height - 26;
    out.push({ ...box(`${prefix}-shelf`, ['shelf', 'cleaning'], [width - 1, 1.6, Math.min(depth - 2, 30)], [x, sy - 0.8, z0 + Math.min(depth - 2, 30) / 2], { color: '#f2f0ec' }), geometry: { type: 'box', size: [width - 1, 1.6, Math.min(depth - 2, 30)], radius: 0.4 } });
    out.push(...cleaningSprays(`${prefix}-sprays`, x, sy, z0 + 12));
  }
  return out;
}
