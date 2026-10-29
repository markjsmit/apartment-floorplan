import type { Part, Vec3 } from '../schema';
import { rng } from './stuff';

// Things that show a home is lived in: shoe pairs, coats on hooks or hangers, whisky bottles, board games.
// Each helper returns parts in the caller's frame: (x, y, z) = where the thing stands / hangs, +z = its front.

const part = (id: string, tags: string[], geometry: Part['geometry'], position: Vec3, extra: Partial<Part> = {}): Part => ({
  id, tags, geometry, position, rotation: [0, 0, 0], castShadow: true, glass: false, ...extra,
});
const ell = (id: string, tags: string[], size: Vec3, position: Vec3, extra: Partial<Part> = {}) => part(id, tags, { type: 'ellipsoid', size, segments: 14 }, position, extra);
const box = (id: string, tags: string[], size: Vec3, position: Vec3, extra: Partial<Part> = {}) => part(id, tags, { type: 'box', size }, position, extra);
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

const WHISKY = [
  { label: 'Lagavulin', color: '#8a4a1a', glass: '#2c3b2a' },
  { label: 'Talisker', color: '#9a5a1e', glass: '#e8e2d6' },
  { label: 'Glenfiddich', color: '#b06a22', glass: '#3a4a3a' },
  { label: 'Laphroaig', color: '#8e5420', glass: '#2a3a2c' },
  { label: 'Macallan', color: '#a86322', glass: '#e8e2d6' },
  { label: 'Yamazaki', color: '#b8742c', glass: '#e8e2d6' },
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
    out.push(square
      ? box(`${prefix}-b${i}`, ['bottle', 'whisky', 'contents'], [8, body, 8], [px, y + body / 2, pz], { ...liquid, label: { text: w.label, size: 1.1, offset: [0, 0], color: '#f4efe6' } })
      : cyl(`${prefix}-b${i}`, ['bottle', 'whisky', 'contents'], 3.9, body, [px, y + body / 2, pz], liquid));
    out.push(cyl(`${prefix}-b${i}-neck`, ['bottle', 'contents'], 1.4, h - body - 2, [px, y + body + (h - body - 2) / 2, pz], { color: w.glass }));
    out.push(cyl(`${prefix}-b${i}-cork`, ['bottle', 'contents'], 1.7, 2, [px, y + h - 1, pz], { color: '#3a2a1e' }));
  }
  return out;
}

const GAMES = [
  { t: 'Catan', c: '#c8452c' }, { t: 'Ticket to Ride', c: '#2e5a8a' }, { t: 'Azul', c: '#e8e0cf' }, { t: 'Codenames', c: '#1f1f22' },
  { t: 'Carcassonne', c: '#3d6b4a' }, { t: 'Dixit', c: '#d9a43a' }, { t: 'Wingspan', c: '#7fa3b8' }, { t: 'Pandemic', c: '#2c6b6b' },
  { t: 'Splendor', c: '#6a4a8a' }, { t: 'Root', c: '#b8742c' },
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
    out.push(box(`${prefix}-flat-${i}`, ['game', 'contents'], [s, h, s], [x + (rand() - 0.5), yy + h / 2, z0 + depth / 2], { color: g.c, label: { text: g.t, size: 1.4, offset: [0, 0], color: g.c === '#e8e0cf' ? '#2b2b2b' : '#f4efe6' } }));
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
