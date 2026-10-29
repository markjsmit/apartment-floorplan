import type { Part, Vec3 } from '../schema';
import { box as sharpBox, cyl, num, str, type Extra, type WithStates } from './builtins';
import { placeStuff, stuffKind, stuffParts } from './stuff';
import { COAT_COLORS, cleaningSprays, coat, flatMop, ironingBoard, shoeRow, stickVacuum } from './wear';
import { rng } from './stuff';

// Simple design furniture for trying out room styles: tables, stools, chairs, benches, media units, shelves, rugs,
// lamps, plants, curtains, wall art, cushions. Low detail on purpose (see the realism memory: furniture stays simple
// until Mark asks). Item convention: origin back-centre on the floor, +z out of the front.
// Look params: `material` (texture id) and/or `color` (hex; tints the material, or is the plain colour on its own).

/**
 * Every box here gets eased edges: nothing real has a perfect 90° edge (wood is sanded to ~1 cm, fronts ~3 mm,
 * upholstery is padded — pass a bigger `radius` for that). Pass radius 0 for a truly sharp box.
 */
function box(id: string, tags: string[], size: Vec3, position: Vec3, extra: Extra & { radius?: number } = {}): Part {
  const { radius, ...rest } = extra;
  const r = radius ?? Math.min(1, Math.min(...size) * 0.3);
  const b = sharpBox(id, tags, size, position, rest);
  return r > 0.05 && b.geometry?.type === 'box' ? { ...b, geometry: { ...b.geometry, radius: r } } : b;
}
const SOFT = 3; // padded seats, cushions

const look = (p: Record<string, unknown>, prefix: string, material: string, color?: string): Extra => {
  const m = p[`${prefix}Material`] ?? (prefix === '' ? p.material : undefined);
  const c = p[`${prefix}Color`] ?? (prefix === '' ? p.color : undefined);
  const out: Extra = {};
  if (m !== '' && m !== 'none') out.material = str(m, material);
  const col = typeof c === 'string' && c ? c : color;
  if (col) out.color = col;
  if (m === 'none') delete out.material;
  return out;
};
const lookOf = (p: Record<string, unknown>, key: string, material: string, color?: string): Extra => look(p, key, material, color);

/** Opaque dark shades (black metal) don't glow; their light comes from a bulb under the shade instead. */
function darkColor(c: string): boolean {
  const m = /^#([0-9a-f]{6})$/i.exec(c);
  if (!m) return false;
  const v = parseInt(m[1], 16);
  return 0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255) < 90;
}

function ell(id: string, tags: string[], size: Vec3, position: Vec3, extra: Extra = {}): Part {
  return { id, tags, geometry: { type: 'ellipsoid', size, segments: 18 }, position, rotation: [0, 0, 0], castShadow: true, glass: false, ...extra };
}

/** A tabletop: round/oval as a squashed cylinder (ellipsoid sides would look soft), rect as a box. */
function top(id: string, shape: string, w: number, d: number, t: number, y: number, z: number, extra: Extra): Part {
  if (shape === 'round' || shape === 'oval') {
    const p = cyl(id, ['top'], w / 2, t, [0, y, z], extra);
    // oval: scale the round slab via a prism outline instead
    if (shape === 'oval' && Math.abs(w - d) > 1) {
      const pts: [number, number][] = [];
      const n = 40;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        // superellipse-ish: rounder ends like a racetrack table
        const c = Math.cos(a);
        const s = Math.sin(a);
        pts.push([(Math.sign(c) * Math.abs(c) ** 0.7 * w) / 2, (Math.sign(s) * Math.abs(s) ** 0.7 * d) / 2]);
      }
      return { id, tags: ['top'], geometry: { type: 'prism', points: pts, depth: t, bevel: 0.6 }, position: [0, y, z], rotation: [90, 0, 0], castShadow: true, glass: false, ...extra };
    }
    return p;
  }
  return box(id, ['top'], [w, t, d], [0, y, z], extra);
}

/** Dining / side table. params: shape (round | rect | oval), width, depth, height, base (legs | tapered | pedestal | tulip | trestle). */
export function designTable(p: Record<string, unknown>): Part[] {
  const shape = str(p.shape, 'rect');
  const W = num(p.width, shape === 'round' ? 110 : 160);
  const D = shape === 'round' ? W : num(p.depth, 90);
  const H = num(p.height, 75);
  const T = num(p.topThickness, 3);
  const base = str(p.base, 'legs');
  const topLook = look(p, '', 'wood-oak-light');
  const legLook = lookOf(p, 'leg', typeof p.material === 'string' ? p.material : 'wood-oak-light');
  const cz = D / 2;
  const parts: Part[] = [top('top', shape, W, D, T, H - T / 2, cz, topLook)];
  const legH = H - T;
  if (base === 'pedestal' || base === 'tulip') {
    const r = Math.min(W, D) * (base === 'tulip' ? 0.09 : 0.12);
    parts.push(cyl('column', ['base'], r, legH - 4, [0, (legH - 4) / 2 + 4, cz], legLook));
    parts.push(cyl('foot', ['base'], Math.min(W, D) * (base === 'tulip' ? 0.26 : 0.22), 4, [0, 2, cz], legLook));
  } else if (base === 'trestle') {
    for (const sx of [-1, 1]) {
      const x = sx * (W / 2 - 18);
      parts.push(box(`end-${sx > 0 ? 'r' : 'l'}`, ['leg'], [4, legH, D - 16], [x, legH / 2, cz], { ...legLook }));
    }
  } else {
    const inset = shape === 'rect' ? 6 : W * 0.22;
    const lw = base === 'tapered' ? 4 : num(p.legSize, 5);
    const pts: [number, number][] =
      shape === 'rect'
        ? [[-W / 2 + inset, -D / 2 + inset], [W / 2 - inset, -D / 2 + inset], [-W / 2 + inset, D / 2 - inset], [W / 2 - inset, D / 2 - inset]]
        : [[-inset, -inset], [inset, -inset], [-inset, inset], [inset, inset]];
    pts.forEach(([x, z], i) => {
      if (base === 'tapered') parts.push(cyl(`leg-${i + 1}`, ['leg'], lw / 2, legH, [x, legH / 2, cz + z], legLook));
      else parts.push(box(`leg-${i + 1}`, ['leg'], [lw, legH, lw], [x, legH / 2, cz + z], legLook));
    });
  }
  return parts;
}

/** Coffee table with drawers. params: shape (rect | round | oval), width, depth, height, drawers (per long side, front), base (box | legs | tapered | metal-frame). */
export function coffeeTable(p: Record<string, unknown>): Part[] {
  const shape = str(p.shape, 'rect');
  const W = num(p.width, 110);
  const D = shape === 'round' ? W : num(p.depth, 60);
  const H = num(p.height, 40);
  const n = num(p.drawers, 2);
  const base = str(p.base, 'legs');
  const wood = look(p, '', 'wood-oak-light');
  const legLook = lookOf(p, 'leg', typeof p.material === 'string' ? p.material : 'wood-oak-light');
  const frontLook = lookOf(p, 'front', typeof p.material === 'string' ? p.material : 'wood-oak-light');
  const cz = D / 2;
  const T = 3;
  const bodyH = base === 'box' ? H - T : 14;
  const bodyY = H - T - bodyH;
  const parts: Part[] = [top('top', shape, W, D, T, H - T / 2, cz, wood)];
  if (shape === 'rect') {
    parts.push(box('body', ['body'], [W - 4, bodyH, D - 4], [0, bodyY + bodyH / 2, cz], wood));
  } else {
    parts.push(cyl('body', ['body'], Math.min(W, D) / 2 - 3, bodyH, [0, bodyY + bodyH / 2, cz], wood));
  }
  // drawer fronts on the +z side (towards the sofa), pull out on double-click
  const fw = (shape === 'rect' ? W - 10 : Math.min(W, D) * 0.6) / Math.max(n, 1);
  const fh = Math.min(bodyH - 3, 12);
  const fz = shape === 'rect' ? D - 2 + 0.9 : cz + Math.min(W, D) / 2 - 3 + 0.9;
  for (let i = 0; i < n; i++) {
    const x = -((n - 1) * fw) / 2 + i * fw;
    const y = bodyY + bodyH - fh / 2 - 1.5;
    parts.push({ ...box(`drawer-${i + 1}`, ['drawer'], [fw - 0.6, fh, 1.8], [x, y, fz], frontLook), section: `drawer-${i + 1}`, open: { position: [x, y, fz + 30] } });
    parts.push({ ...box(`pull-${i + 1}`, ['handle'], [8, 1.2, 1.2], [x, y, fz + 1.4], { color: str(p.pullColor, '#2a2a2a') }), section: `drawer-${i + 1}`, open: { position: [x, y, fz + 31.4] } });
  }
  if (base !== 'box') {
    const lh = bodyY;
    const inset = shape === 'rect' ? 5 : Math.min(W, D) * 0.28;
    const pts: [number, number][] = shape === 'rect'
      ? [[-W / 2 + inset, -D / 2 + inset], [W / 2 - inset, -D / 2 + inset], [-W / 2 + inset, D / 2 - inset], [W / 2 - inset, D / 2 - inset]]
      : [[0, -inset], [inset * 0.87, inset / 2], [-inset * 0.87, inset / 2]];
    pts.forEach(([x, z], i) => {
      if (base === 'tapered') parts.push(cyl(`leg-${i + 1}`, ['leg'], 2, lh, [x, lh / 2, cz + z], legLook));
      else parts.push(box(`leg-${i + 1}`, ['leg'], base === 'metal-frame' ? [2.5, lh, 2.5] : [5, lh, 5], [x, lh / 2, cz + z], legLook));
    });
    if (base === 'metal-frame' && shape === 'rect') parts.push(box('shelf', ['shelf'], [W - 10, 2, D - 10], [0, 8, cz], wood));
  }
  return parts;
}

/** Counter / bar stool. params: seatHeight, seat (round | square | saddle), seatSize, back (backrest height above the seat, 0 = none), base (four | pedestal | drum | sled), materials. */
export function stool(p: Record<string, unknown>): Part[] {
  const SH = num(p.seatHeight, 65);
  const S = num(p.seatSize, 40);
  const seatShape = str(p.seat, 'round');
  const back = num(p.back, 0);
  const base = str(p.base, 'four');
  const seatLook = look(p, 'seat', 'wood-oak-light');
  const legLook = lookOf(p, 'leg', 'wood-oak-light');
  const cz = S / 2 + 4;
  const parts: Part[] = [];
  const st = 5;
  if (seatShape === 'square') parts.push(box('seat', ['seat'], [S, st, S], [0, SH - st / 2, cz], seatLook));
  else parts.push({ ...cyl('seat', ['seat'], S / 2, st, [0, SH - st / 2, cz], seatLook) });
  if (base === 'drum') {
    parts.push(cyl('drum', ['base'], S / 2 - 2, SH - st, [0, (SH - st) / 2, cz], legLook));
  } else if (base === 'pedestal') {
    parts.push(cyl('column', ['base'], 2.5, SH - st, [0, (SH - st) / 2, cz], legLook));
    parts.push(cyl('foot', ['base'], S / 2 - 2, 2, [0, 1, cz], legLook));
    parts.push({ ...cyl('footrest', ['footrest'], S / 2 - 4, 1.2, [0, SH * 0.42, cz], legLook) });
  } else {
    const o = S / 2 - 3;
    [[-o, -o], [o, -o], [-o, o], [o, o]].forEach(([x, z], i) => parts.push(cyl(`leg-${i + 1}`, ['leg'], 1.6, SH - st, [x * 1.08, (SH - st) / 2, cz + z * 1.08], legLook)));
    parts.push(box('footrest-f', ['footrest'], [S - 4, 2, 2], [0, SH * 0.36, cz + o], legLook));
    parts.push(box('footrest-b', ['footrest'], [S - 4, 2, 2], [0, SH * 0.36, cz - o], legLook));
  }
  if (back > 0) {
    // back sits on the -z side, so the sitter faces +z (the item's front)
    parts.push(box('back', ['back'], [S * 0.85, back, 3], [0, SH + back / 2, cz - S / 2 + 2], lookOf(p, 'back', typeof p.seatMaterial === 'string' ? p.seatMaterial : 'wood-oak-light', typeof p.seatColor === 'string' ? p.seatColor : undefined)));
  }
  return parts;
}

/** Dining chair. params: style (wood | rattan | round), width, depth, seatHeight, backHeight, materials. */
export function designChair(p: Record<string, unknown>): Part[] {
  const style = str(p.style, 'wood');
  const W = num(p.width, 48);
  const D = num(p.depth, 52);
  const SH = num(p.seatHeight, 46);
  const BH = num(p.backHeight, 82);
  const seatLook = look(p, 'seat', 'wood-oak-light');
  const legLook = lookOf(p, 'leg', 'wood-oak-light');
  const backLook = lookOf(p, 'back', typeof p.seatMaterial === 'string' ? p.seatMaterial : 'wood-oak-light', typeof p.seatColor === 'string' ? p.seatColor : undefined);
  const parts: Part[] = [];
  if (style === 'round') {
    // rounded tub chair (bouclé): soft seat + curved back as an ellipsoid shell
    parts.push(ell('seat', ['seat'], [W, 10, D - 4], [0, SH - 5, D / 2 + 2], seatLook));
    parts.push(ell('back', ['back'], [W + 2, BH - SH + 8, 16], [0, (SH + BH) / 2 - 2, 9], backLook));
  } else {
    parts.push(box('seat', ['seat'], [W, 5, D - 4], [0, SH - 2.5, D / 2 + 2], { ...seatLook, radius: style === 'rattan' ? 1.5 : 2 }));
    if (style === 'rattan') {
      parts.push(box('back', ['back', 'cane'], [W - 4, BH - SH - 10, 2.5], [0, SH + (BH - SH) / 2 + 3, 4], { ...backLook, radius: 1 }));
      parts.push(box('back-rail', ['back'], [W, 4, 3], [0, BH - 2, 4], { ...legLook, radius: 1.4 }));
    } else {
      parts.push(box('back', ['back'], [W - 2, (BH - SH) * 0.45, 2.5], [0, BH - (BH - SH) * 0.25, 4], backLook));
    }
  }
  const lh = SH - 5;
  const o = W / 2 - 3;
  [[-o, 4], [o, 4], [-o, D - 3], [o, D - 3]].forEach(([x, z], i) => parts.push(cyl(`leg-${i + 1}`, ['leg'], 1.6, i < 2 && style !== 'round' ? BH - 4 : lh, [x, (i < 2 && style !== 'round' ? BH - 4 : lh) / 2, z], legLook)));
  return parts;
}

/** Bench / banquette. params: width, depth, height, legs (legs | box | metal), cushion color (adds a seat cushion), backrest height (0 = none). */
export function bench(p: Record<string, unknown>): Part[] {
  const W = num(p.width, 140);
  const D = num(p.depth, 40);
  const H = num(p.height, 45);
  const legs = str(p.legs, 'legs');
  const wood = look(p, '', 'wood-oak-light');
  const legLook = lookOf(p, 'leg', typeof p.material === 'string' ? p.material : 'wood-oak-light');
  const parts: Part[] = [];
  if (legs === 'box') parts.push(box('body', ['body', 'storage'], [W, H - 4, D], [0, (H - 4) / 2, D / 2], wood));
  else {
    parts.push(box('seat', ['seat'], [W, 4, D], [0, H - 2 - (p.cushionColor ? 6 : 0), D / 2], wood));
    const lh = H - 4 - (p.cushionColor ? 6 : 0);
    for (const sx of [-1, 1]) {
      const x = sx * (W / 2 - 4);
      if (legs === 'metal') parts.push(box(`frame-${sx > 0 ? 'r' : 'l'}`, ['leg'], [3, lh, D - 4], [x, lh / 2, D / 2], legLook));
      else for (const z of [5, D - 5]) parts.push(box(`leg-${sx > 0 ? 'r' : 'l'}-${z}`, ['leg'], [4, lh, 4], [x, lh / 2, z], legLook));
    }
  }
  if (legs === 'box' || p.cushionColor) {
    const c = str(p.cushionColor, '#e9e2d4');
    parts.push(box('cushion', ['cushion'], [W - 2, 6, D - 2], [0, H - 3, D / 2], { material: str(p.cushionMaterial, 'linen-white'), color: c, radius: SOFT }));
  }
  // shoe bench: a slatted shelf low between the legs with pairs on it
  if (num(p.shoes, 0) > 0 && legs !== 'box') {
    parts.push(box('shoe-shelf', ['shelf'], [W - 10, 2, D - 6], [0, 9, D / 2], legLook));
    parts.push(...shoeRow('shoes', 0, 10, D - 1, W - 12, String(p.seed ?? 'bench'), num(p.shoes, 0)));
  }
  const back = num(p.backrest, 0);
  if (back > 0) parts.push(box('backrest', ['back'], [W, back, 8], [0, H + back / 2, 4], { material: str(p.cushionMaterial, 'linen-white'), color: str(p.cushionColor, '#e9e2d4'), radius: SOFT }));
  return parts;
}

/** Low media unit / sideboard. params: width, depth, height, legHeight, modules (string like "drawer,door,open,door"), fluted (bool), rounded (bool), finishedBack. */
export function mediaUnit(p: Record<string, unknown>): Part[] {
  const W = num(p.width, 180);
  const D = num(p.depth, 42);
  const H = num(p.height, 50);
  const lh = num(p.legHeight, 10);
  const mods = str(p.modules, 'door,drawer,drawer,door').split(',').map((s) => s.trim());
  const body = look(p, '', 'wood-oak-light');
  const front = lookOf(p, 'front', typeof p.material === 'string' ? p.material : 'wood-oak-light', typeof p.color === 'string' ? p.color : undefined);
  const legLook = lookOf(p, 'leg', 'metal-black');
  const bh = H - lh;
  const parts: Part[] = [];
  if (p.rounded) {
    parts.push(box('body', ['body'], [W - D, bh, D], [0, lh + bh / 2, D / 2], body));
    for (const sx of [-1, 1]) parts.push(cyl(`end-${sx > 0 ? 'r' : 'l'}`, ['body'], D / 2, bh, [sx * (W / 2 - D / 2), lh + bh / 2, D / 2], body));
  } else parts.push(box('body', ['body'], [W, bh, D], [0, lh + bh / 2, D / 2], body));
  const inner = p.rounded ? W - D : W - 4;
  const mw = inner / mods.length;
  mods.forEach((m, i) => {
    const x = -inner / 2 + mw * i + mw / 2;
    const y = lh + bh / 2;
    if (m === 'open') {
      parts.push(box(`open-${i + 1}`, ['shelf', 'open'], [mw - 2, bh - 6, 2], [x, y, D - 12], { color: '#2b2622' }));
      return;
    }
    if (p.fluted) {
      const n = Math.max(3, Math.round(mw / 4));
      for (let k = 0; k < n; k++) parts.push({ ...cyl(`flute-${i + 1}-${k}`, ['front', 'flute'], (mw - 1) / n / 2, bh - 4, [x - (mw - 1) / 2 + ((k + 0.5) * (mw - 1)) / n, y, D + 0.2], front), section: `front-${i + 1}` });
    } else {
      parts.push({ ...box(`front-${i + 1}`, ['front', m], [mw - 0.6, bh - 3, 1.8], [x, y, D + 0.9], front), section: `front-${i + 1}` });
      if (m === 'drawer') parts.push({ ...box(`pull-${i + 1}`, ['handle'], [10, 1.2, 1.2], [x, y + bh / 2 - 6, D + 2.4], { color: str(p.pullColor, '#2a2a2a') }), section: `front-${i + 1}` });
    }
  });
  if (lh > 0) {
    for (const [x, z] of [[-W / 2 + 6, 5], [W / 2 - 6, 5], [-W / 2 + 6, D - 5], [W / 2 - 6, D - 5]]) {
      parts.push(cyl(`leg-${x}-${z}`, ['leg'], 1.8, lh, [x, lh / 2, z], legLook));
    }
  }
  return parts;
}

/** Open shelving / bookcase. params: width, depth, height, shelves, frame (metal | wood | ladder), materials, styled (adds books/vases). */
export function shelfUnit(p: Record<string, unknown>): Part[] {
  const W = num(p.width, 100);
  const D = num(p.depth, 35);
  const H = num(p.height, 180);
  const n = num(p.shelves, 5);
  const frame = str(p.frame, 'metal');
  const shelfLook = look(p, '', 'wood-oak-light');
  const frameLook = lookOf(p, 'frame', frame === 'metal' ? 'metal-black' : 'wood-oak-light');
  const parts: Part[] = [];
  const ft = frame === 'metal' ? 2.5 : 3;
  for (const sx of [-1, 1]) for (const z of [ft / 2, D - ft / 2]) parts.push(box(`post-${sx}-${z}`, ['frame'], [ft, H, ft], [sx * (W / 2 - ft / 2), H / 2, z], frameLook));
  const rand = rng(String(p.seed ?? 'shelf'));
  for (let i = 0; i < n; i++) {
    const y = 6 + (i * (H - 8)) / Math.max(n - 1, 1);
    parts.push(box(`shelf-${i + 1}`, ['shelf'], [W - (frame === 'metal' ? 0 : 2 * ft), 2.5, D], [0, y, D / 2], shelfLook));
    if (p.styled !== false && i < n - 1) {
      // a few books + an object per shelf, so it reads as a styled shelf
      let x = -W / 2 + 6;
      const books = 3 + Math.floor(rand() * 5);
      for (let b = 0; b < books; b++) {
        const bw = 2 + rand() * 2.5;
        const bh = 18 + rand() * 10;
        parts.push(box(`book-${i}-${b}`, ['book'], [bw, bh, 20], [x + bw / 2, y + 1.25 + bh / 2, D / 2], { color: ['#d9cfbf', '#8b6d4f', '#3d3a36', '#a8b59a', '#c9a27c', '#ece6d6'][Math.floor(rand() * 6)] }));
        x += bw + 0.3;
      }
      const vx = W / 2 - 14 - rand() * 10;
      parts.push(cyl(`vase-${i}`, ['vase'], 5 + rand() * 3, 12 + rand() * 10, [vx, y + 1.25 + 10, D / 2], { color: ['#efe9df', '#c56a43', '#3a3a3a', '#b7a58a'][Math.floor(rand() * 4)] }));
    }
  }
  return parts;
}

/** Flat rug (walk-on; < 3 cm high so it never blocks walking). params: shape (rect | round), width, depth, color, borderColor. */
export function rug(p: Record<string, unknown>): Part[] {
  const shape = str(p.shape, 'rect');
  const W = num(p.width, 200);
  const D = shape === 'round' ? W : num(p.depth, 290);
  const c = str(p.color, '#e8e0d0');
  const mat = str(p.material, 'linen-white');
  const parts: Part[] = [];
  if (shape === 'round') parts.push({ ...cyl('rug', ['rug'], W / 2, 1, [0, 0.5, D / 2], { material: mat, color: c }), castShadow: false });
  else parts.push({ ...box('rug', ['rug'], [W, 1, D], [0, 0.5, D / 2], { material: mat, color: c }), castShadow: false });
  if (p.borderColor && shape === 'rect') {
    const b = num(p.border, 6);
    const bc = { material: mat, color: String(p.borderColor) };
    parts.push({ ...box('border-n', ['rug'], [W, 1.2, b], [0, 0.6, b / 2], bc), castShadow: false });
    parts.push({ ...box('border-s', ['rug'], [W, 1.2, b], [0, 0.6, D - b / 2], bc), castShadow: false });
    parts.push({ ...box('border-w', ['rug'], [b, 1.2, D], [-W / 2 + b / 2, 0.6, D / 2], bc), castShadow: false });
    parts.push({ ...box('border-e', ['rug'], [b, 1.2, D], [W / 2 - b / 2, 0.6, D / 2], bc), castShadow: false });
  }
  if (p.pattern === 'stripes' && shape === 'rect') {
    for (let i = 1; i < 6; i++) parts.push({ ...box(`stripe-${i}`, ['rug'], [W - 20, 1.1, 3], [0, 0.55, (i * D) / 6], { material: mat, color: str(p.borderColor, '#b9ab93') }), castShadow: false });
  }
  return parts;
}

/**
 * Pendant lamp hanging from the ceiling. Origin = the floor point under it (use `position`); params: ceiling (the
 * ceiling height there), bottom (shade bottom above the floor), shape (globe | drum | dome | lantern | cage | linear | mushroom), diameter, count + spacing (a row along x).
 */
export function pendant(p: Record<string, unknown>): Part[] {
  const C = num(p.ceiling, 277);
  const bottom = num(p.bottom, 150);
  const shape = str(p.shape, 'globe');
  const d = num(p.diameter, 40);
  const n = num(p.count, 1);
  const sp = num(p.spacing, 60);
  const color = str(p.color, '#f3efe6');
  const shadeLook: Extra = typeof p.shadeMaterial === 'string' && p.shadeMaterial ? { material: p.shadeMaterial, color } : { color };
  const emit = { color: str(p.lightColor, '#ffd9a8'), intensity: num(p.intensity, 9000), kind: 'point' as const };
  const parts: Part[] = [];
  for (let i = 0; i < n; i++) {
    const x = -((n - 1) * sp) / 2 + i * sp;
    const sh = shape === 'linear' ? 8 : shape === 'drum' || shape === 'cage' ? d * 0.7 : shape === 'lantern' ? d * 1.1 : shape === 'dome' || shape === 'mushroom' ? d * 0.45 : d;
    const top = bottom + sh;
    parts.push({ ...cyl(`cord-${i}`, ['cord'], 0.4, Math.max(C - top, 1), [x, (C + top) / 2, 0], { color: '#222' }), castShadow: false });
    parts.push({ ...cyl(`canopy-${i}`, ['canopy'], 5, 2, [x, C - 1, 0], { color: '#222' }), castShadow: false });
    const y = bottom + sh / 2;
    if (darkColor(color)) {
      // black metal: the shade stays dark, a bulb just under it lights up
      const shadeOnly = { ...shadeLook, color };
      if (shape === 'dome' || shape === 'mushroom') parts.push({ ...ell(`shade-${i}`, ['shade'], [d, sh * 2, d], [x, bottom, 0], shadeOnly), castShadow: false });
      else if (shape === 'linear') parts.push({ ...box(`shade-${i}`, ['shade'], [d, sh, 8], [x, y, 0], shadeOnly), castShadow: false });
      else parts.push({ ...cyl(`shade-${i}`, ['shade'], d / 2, sh, [x, y, 0], shadeOnly), castShadow: false });
      parts.push({ ...ell(`bulb-${i}`, ['bulb'], [7, 9, 7], [x, bottom - 2, 0], { color: '#fff4e0' }), castShadow: false, emit });
      continue;
    }
    if (shape === 'linear') parts.push({ ...box(`shade-${i}`, ['shade'], [d, sh, 8], [x, y, 0], shadeLook), castShadow: false, emit });
    else if (shape === 'drum' || shape === 'cage') parts.push({ ...cyl(`shade-${i}`, ['shade'], d / 2, sh, [x, y, 0], shadeLook), castShadow: false, emit });
    else if (shape === 'dome' || shape === 'mushroom') parts.push({ ...ell(`shade-${i}`, ['shade'], [d, sh * 2, d], [x, bottom, 0], shadeLook), castShadow: false, emit });
    else if (shape === 'lantern') parts.push({ ...ell(`shade-${i}`, ['shade'], [d, sh, d], [x, y, 0], shadeLook), castShadow: false, emit });
    else parts.push({ ...ell(`shade-${i}`, ['shade'], [d, d, d], [x, y, 0], shadeLook), castShadow: false, emit });
  }
  return parts;
}

/** Floor lamp. params: height, shade (drum | paper | globe | dome | arc | tripod), shadeColor, baseColor. */
export function floorLamp(p: Record<string, unknown>): Part[] {
  const H = num(p.height, 155);
  const shape = str(p.shade, 'drum');
  const shadeColor = str(p.shadeColor, '#f1ebe0');
  const baseLook = lookOf(p, 'base', 'metal-black');
  const emit = { color: str(p.lightColor, '#ffd9a8'), intensity: num(p.intensity, 7000), kind: 'point' as const };
  const parts: Part[] = [];
  const cz = 18;
  let sx = 0;
  if (shape === 'tripod') {
    for (const [i, a] of [0, 120, 240].entries()) {
      const r = (a * Math.PI) / 180;
      parts.push({ ...cyl(`leg-${i}`, ['leg'], 1.3, H - 30, [Math.sin(r) * 12, (H - 30) / 2, cz + Math.cos(r) * 12], baseLook), rotation: [Math.cos(r) * 8, 0, -Math.sin(r) * 8] });
    }
  } else if (shape === 'arc') {
    parts.push(cyl('base', ['base'], 15, 4, [0, 2, cz], { material: 'plaster', color: str(p.baseColor, '#e8e6e1') }));
    parts.push(cyl('pole', ['pole'], 1.2, H - 10, [0, (H - 10) / 2, cz], baseLook));
    parts.push({ ...box('arm', ['pole'], [90, 2, 2], [45, H - 8, cz], baseLook) });
    sx = 85;
  } else {
    parts.push(cyl('base', ['base'], 14, 3, [0, 1.5, cz], baseLook));
    parts.push(cyl('pole', ['pole'], 1.2, H - 30, [0, (H - 30) / 2 + 3, cz], baseLook));
  }
  const y = shape === 'arc' ? H - 25 : H - 18;
  const shade: Extra = { material: str(p.shadeMaterial, 'linen-white'), color: shadeColor };
  if (darkColor(shadeColor)) {
    parts.push({ ...ell('shade', ['shade'], [38, 30, 38], [sx, y + 6, cz], shade), castShadow: false });
    parts.push({ ...ell('bulb', ['bulb'], [8, 10, 8], [sx, y - 6, cz], { color: '#fff4e0' }), castShadow: false, emit });
    return parts;
  }
  if (shape === 'paper' || shape === 'globe') parts.push({ ...ell('shade', ['shade'], shape === 'paper' ? [36, 50, 36] : [34, 34, 34], [sx, y - 6, cz], shade), castShadow: false, emit });
  else if (shape === 'dome' || shape === 'arc') parts.push({ ...ell('shade', ['shade'], [38, 30, 38], [sx, y + 6, cz], shade), castShadow: false, emit });
  else parts.push({ ...cyl('shade', ['shade'], 20, 28, [sx, y, cz], shade), castShadow: false, emit });
  return parts;
}

// Real (CC0, Poly Haven) models a plant or vase can use instead of the simple leaf shapes: file under assets/, and
// width/depth as a fraction of the height (the model is scaled to `height`, pot included).
export const MODELS: Record<string, { file: string; w: number; d: number }> = {
  'leafy-tree': { file: 'models/potted_plant_01/potted_plant_01_1k.gltf', w: 0.44, d: 0.47 },
  syngonium: { file: 'models/potted_plant_02/potted_plant_02_1k.gltf', w: 0.83, d: 0.79 },
  succulent: { file: 'models/potted_plant_04/potted_plant_04_1k.gltf', w: 0.63, d: 0.7 },
  'vase-round': { file: 'models/ceramic_vase_01/ceramic_vase_01_1k.gltf', w: 0.51, d: 0.51 },
  'vase-jug': { file: 'models/ceramic_vase_04/ceramic_vase_04_1k.gltf', w: 0.54, d: 0.53 },
};

/** A model part standing on y0, scaled to height h, back edge on z = 0. */
function modelPart(id: string, name: string, h: number, y0: number, tags: string[]): Part {
  const m = MODELS[name];
  return { id, tags, geometry: { type: 'model', file: m.file, size: [m.w * h, h, m.d * h] }, position: [0, y0 + h / 2, (m.d * h) / 2], rotation: [0, 0, 0], castShadow: true, glass: false };
}

/**
 * Potted plant. params: kind (tree | fig | bush | snake | palm | monstera | trailing | strelitzia), height (total, pot
 * included; a trailing plant's vines hang down from the pot instead — put it on a shelf or a hook), spread, potDiameter, potHeight, potColor/potMaterial, leafColor, seed, stand (plant-stand height, 0 = on the floor).
 */
export function plant(p: Record<string, unknown>): Part[] {
  const kind = str(p.kind, 'bush');
  const H = num(p.height, 120);
  const S = num(p.spread, H * 0.5);
  const pd = num(p.potDiameter, Math.max(20, S * 0.45));
  const ph = num(p.potHeight, pd * 0.9);
  const stand = num(p.stand, 0);
  const leaf = str(p.leafColor, kind === 'tree' ? '#7f8f63' : kind === 'snake' ? '#4f6b3f' : '#3f6b3a');
  const rand = rng(String(p.seed ?? kind));
  const cz = Math.max(pd, S) / 2;
  const potLook: Extra = { ...look(p, 'pot', 'plaster', str(p.potColor, '#e9e4da')) };
  const parts: Part[] = [];
  if (stand > 0) {
    parts.push(cyl('stand-top', ['stand'], pd / 2 + 2, 2, [0, stand - 1, cz], lookOf(p, 'stand', 'wood-oak-light')));
    for (const [i, a] of [45, 135, 225, 315].entries()) {
      const r = (a * Math.PI) / 180;
      parts.push(cyl(`stand-leg-${i}`, ['stand'], 1, stand - 2, [Math.sin(r) * pd * 0.35, (stand - 2) / 2, cz + Math.cos(r) * pd * 0.35], lookOf(p, 'stand', 'wood-oak-light')));
    }
  }
  const y0 = stand;
  if (typeof p.model === 'string' && MODELS[p.model]) {
    // a real model (pot included), centred where the simple plant would stand
    const mp = modelPart('plant', p.model, H, y0, ['plant', 'leaves']);
    mp.position = [0, mp.position[1], cz];
    return [...parts, mp];
  }
  parts.push({ ...cyl('pot', ['pot'], pd / 2, ph, [0, y0 + ph / 2, cz], potLook) });
  parts.push({ ...cyl('soil', ['soil'], pd / 2 - 1.5, 1, [0, y0 + ph - 1.5, cz], { color: '#3b2d22' }), castShadow: false });
  const top = y0 + ph;
  const green = (k: number) => {
    // small variations of the leaf colour so foliage doesn't look flat
    const c = parseInt(leaf.slice(1), 16);
    const f = 0.85 + k * 0.3;
    const ch = (s: number) => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * f)));
    return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
  };
  const foliageH = H - ph;
  if (kind === 'tree' || kind === 'fig') {
    const trunkH = foliageH * (kind === 'tree' ? 0.45 : 0.3);
    parts.push(cyl('trunk', ['trunk'], kind === 'tree' ? 2.2 : 1.6, trunkH + 10, [0, top + trunkH / 2 - 5, cz], { color: kind === 'tree' ? '#8a7a66' : '#6e5a44' }));
    const crownH = foliageH - trunkH;
    // leaves on short twigs around the crown; a fig has big leaves along the stem, an olive many small ones
    const n = kind === 'tree' ? 70 : 34;
    const [lw, lh] = kind === 'tree' ? [7, 2.2] : [Math.min(22, S * 0.45), Math.min(26, S * 0.53)];
    for (let i = 0; i < n; i++) {
      const t = rand();
      const a = rand() * Math.PI * 2;
      const shape = kind === 'tree' ? 0.5 + 0.5 * Math.sin(Math.PI * t) : 0.45 + 0.35 * Math.sin(Math.PI * t);
      const r = (S / 2 - lw / 2) * shape * (0.55 + rand() * 0.45);
      const by = top + trunkH + crownH * (0.05 + t * 0.9);
      const leaf = ell(`leaf-${i}`, ['leaves'], [lw, 0.8, lh], [Math.cos(a) * r, by, cz + Math.sin(a) * r], { color: green(rand()) });
      leaf.rotation = [(rand() - 0.5) * 70, (-a * 180) / Math.PI + 90, (rand() - 0.5) * 50];
      parts.push(leaf);
    }
    if (kind === 'tree') for (let i = 0; i < 3; i++) parts.push({ ...cyl(`branch-${i}`, ['trunk'], 1, crownH * 0.6, [0, top + trunkH + crownH * 0.3, cz], { color: '#8a7a66' }), rotation: [(i - 1) * 25, 0, (rand() - 0.5) * 40] });
  } else if (kind === 'snake' || kind === 'strelitzia') {
    const n = kind === 'snake' ? 9 : 7;
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const r = rand() * pd * 0.25;
      const lh = foliageH * (0.6 + rand() * 0.4);
      const tilt = (rand() - 0.5) * (kind === 'snake' ? 14 : 24);
      const w = kind === 'snake' ? 5 + rand() * 3 : 4;
      const part: Part = { ...ell(`leaf-${i}`, ['leaves'], [w, lh, kind === 'snake' ? 1.2 : 1], [Math.cos(a) * r, top + lh / 2 - 3, cz + Math.sin(a) * r], { color: green(rand()) }), rotation: [tilt, (a * 180) / Math.PI, 0] };
      parts.push(part);
      if (kind === 'strelitzia') parts.push({ ...ell(`blade-${i}`, ['leaves'], [S * 0.28, foliageH * 0.28, 1.2], [Math.cos(a) * (r + 6), top + lh * 0.82, cz + Math.sin(a) * (r + 6)], { color: green(rand()) }), rotation: [tilt, (a * 180) / Math.PI, 0] });
    }
  } else if (kind === 'palm' || kind === 'monstera') {
    const n = kind === 'palm' ? 10 : 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 360 + rand() * 20;
      let lean = 25 + rand() * 35;
      const len = kind === 'palm' ? foliageH * (0.7 + rand() * 0.3) : S * 0.45;
      // a palm frond leans only as far as the spread allows (tip stays inside it)
      if (kind === 'palm') lean = Math.min(lean, (Math.asin(Math.max(0, Math.min(1, (S / 2 - 6) / len))) * 180) / Math.PI);
      const stemH = kind === 'monstera' ? foliageH * (0.35 + rand() * 0.5) : 0;
      const ar = (a * Math.PI) / 180;
      const out = kind === 'palm' ? Math.sin((lean * Math.PI) / 180) * len * 0.5 : Math.min(Math.sin((lean * Math.PI) / 180) * len * 0.5, S / 2 - len * 0.375);
      const yy = top + (kind === 'palm' ? Math.cos((lean * Math.PI) / 180) * len * 0.5 : stemH);
      if (kind === 'monstera') parts.push(cyl(`stem-${i}`, ['stem'], 0.6, stemH, [Math.sin(ar) * out * 0.4, top + stemH / 2, cz + Math.cos(ar) * out * 0.4], { color: '#4d6b3a' }));
      parts.push({ ...ell(`frond-${i}`, ['leaves'], kind === 'palm' ? [len * 0.22, len, 1] : [len * 0.75, len * 0.9, 1.2], [Math.sin(ar) * out, yy, cz + Math.cos(ar) * out], { color: green(rand()) }), rotation: kind === 'palm' ? [lean * Math.cos(ar), 0, -lean * Math.sin(ar)] : [70 + rand() * 15, a, 0] });
    }
  } else if (kind === 'trailing') {
    parts.push(ell('crown', ['leaves'], [pd * 1.2, pd * 0.5, pd * 1.2], [0, top + 2, cz], { color: green(0.5) }));
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand();
      const len = foliageH * (0.6 + rand() * 0.6);
      parts.push(ell(`vine-${i}`, ['leaves'], [6, len, 6], [Math.cos(a) * (pd / 2 + 2), top - len / 2 + 4, cz + Math.sin(a) * (pd / 2 + 2)], { color: green(rand()) }));
    }
  } else {
    // bushy: leaves on stems fanning out of the pot
    const n = 26;
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const t = rand();
      const r = (S / 2) * (0.25 + t * 0.6);
      const lw = Math.max(5, S * 0.22);
      const leaf = ell(`leaf-${i}`, ['leaves'], [lw, 0.8, lw * 1.3], [Math.cos(a) * r, top + foliageH * (0.25 + (1 - t) * 0.6), cz + Math.sin(a) * r], { color: green(rand()) });
      leaf.rotation = [25 + rand() * 40, (-a * 180) / Math.PI + 90, (rand() - 0.5) * 30];
      parts.push(leaf);
    }
  }
  return parts;
}

/** Curtain panels on a rail. Origin back-centre at the floor; params: width (rail), height (top of the rail above the floor), panels, color, open (0..1, how far pushed to the sides). */
export function curtain(p: Record<string, unknown>): Part[] {
  const W = num(p.width, 300);
  const H = num(p.height, 260);
  const panels = num(p.panels, 2);
  const open = num(p.open, 0.7);
  const color = str(p.color, '#f2eee6');
  const fab: Extra = { material: str(p.material, 'linen-white'), color };
  const parts: Part[] = [{ ...box('rail', ['rail'], [W + 10, 2.5, 2.5], [0, H - 1, 6], { color: str(p.railColor, '#2a2a2a') }), castShadow: false }];
  const pw = (W / panels) * (1 - open) + 25;
  for (let i = 0; i < panels; i++) {
    const side = panels === 1 ? -1 : i < panels / 2 ? -1 : 1;
    const x = side * (W / 2 - pw / 2 + 5);
    const folds = Math.max(3, Math.round(pw / 9));
    for (let f = 0; f < folds; f++) {
      parts.push({ ...cyl(`panel-${i}-${f}`, ['curtain'], pw / folds / 1.6, H - 4, [x - pw / 2 + ((f + 0.5) * pw) / folds, (H - 4) / 2 + 1, 6 + (f % 2) * 1.5], fab), castShadow: false });
    }
  }
  return parts;
}

/** Framed art / mirror on (or leaning against) the wall. params: width, height, frameColor, art (hex colours, comma separated: blocks of colour), mirror, arch. */
export function wallArt(p: Record<string, unknown>): Part[] {
  const W = num(p.width, 60);
  const H = num(p.height, 80);
  const fc = str(p.frameColor, '#2a2a2a');
  const parts: Part[] = [];
  const t = 2.5;
  if (p.arch) {
    // arched mirror: an outline with a half-circle top, mirror inside
    const pts = (w: number, h: number): [number, number][] => {
      const out: [number, number][] = [[-w / 2, -h / 2], [w / 2, -h / 2]];
      const r = w / 2;
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * Math.PI;
        out.push([Math.cos(a) * r, h / 2 - r + Math.sin(a) * r]);
      }
      return out;
    };
    parts.push({ id: 'frame', tags: ['frame'], geometry: { type: 'prism', points: pts(W, H), depth: t, bevel: 0.4 }, position: [0, H / 2, t / 2], rotation: [0, 0, 0], color: fc, castShadow: true, glass: false });
    parts.push({ id: 'mirror', tags: ['mirror'], geometry: { type: 'prism', points: pts(W - 5, H - 5), depth: 0.6, bevel: 0 }, position: [0, H / 2, t + 0.3], rotation: [0, 0, 0], material: 'mirror', castShadow: false, glass: false });
    return parts;
  }
  if (p.photos) {
    // magnet board (steel sheet / magnetic paint) with photos held by small round magnets, a bit crooked like real life
    parts.push(box('board', ['board', 'magnet board'], [W, H, 0.8], [0, H / 2, 0.4], { material: str(p.boardMaterial, 'metal-black'), color: fc, radius: 0.3 }));
    const rand = rng(String(p.seed ?? 'photos'));
    const tones = ['#d8c3a5', '#8fa3b8', '#c98b6b', '#a9b89a', '#e8dccb', '#6f7f95', '#b39a7a', '#d9a7a0'];
    const n = Math.round(num(p.photos, 12));
    const cols = Math.max(1, Math.round(Math.sqrt((n * W) / H)));
    const rows = Math.ceil(n / cols);
    for (let i = 0; i < n; i++) {
      const pw = rand() < 0.5 ? 10 : 15;
      const ph = pw === 10 ? 15 : 10;
      const cx = -W / 2 + ((i % cols) + 0.5) * (W / cols) + (rand() - 0.5) * 4;
      const cy = H - (Math.floor(i / cols) + 0.5) * (H / rows) + (rand() - 0.5) * 4;
      const tilt = (rand() - 0.5) * 10;
      parts.push({ ...box(`photo-${i}`, ['photo'], [pw, ph, 0.2], [cx, cy, 0.95], { color: '#f4f1ea', radius: 0 }), rotation: [0, 0, tilt], castShadow: false });
      parts.push({ ...box(`photo-${i}-print`, ['photo'], [pw - 1.2, ph - 1.2 - (pw === 10 ? 2 : 0), 0.1], [cx, cy + (pw === 10 ? 1 : 0), 1.1], { color: tones[Math.floor(rand() * tones.length)], radius: 0 }), rotation: [0, 0, tilt], castShadow: false });
      parts.push({ ...cyl(`magnet-${i}`, ['magnet'], 1.1, 0.8, [cx + (rand() - 0.5) * 3, cy + ph / 2 - 1.5, 1.4], { color: ['#c8452c', '#2e5a8a', '#d9a43a', '#3d6b4a', '#f4f1ea'][Math.floor(rand() * 5)] }), rotation: [90, 0, 0] });
    }
    return parts;
  }
  if (p.round) {
    // round mirror: a thin metal ring with the glass inside, hung on a leather strap or straight on the wall
    parts.push({ ...cyl('frame', ['frame'], W / 2, t, [0, W / 2, t / 2], { color: fc, material: str(p.frameMaterial, 'metal-black') }), rotation: [90, 0, 0] });
    parts.push({ ...cyl('mirror', ['mirror'], W / 2 - 2, 0.5, [0, W / 2, t + 0.25], { material: 'mirror' }), rotation: [90, 0, 0], castShadow: false });
    if (p.strap) {
      parts.push({ ...box('strap', ['strap'], [3.5, 26, 0.5], [0, W + 10, 0.4], { material: 'leather-cognac', radius: 0.2 }) });
      parts.push(cyl('hook', ['hook'], 1, 2.5, [0, W + 22, 1.2], { color: fc }));
    }
    return parts;
  }
  parts.push(box('frame', ['frame'], [W, H, t], [0, H / 2, t / 2], { color: fc }));
  if (p.mirror) {
    parts.push({ ...box('mirror', ['mirror'], [W - 5, H - 5, 0.5], [0, H / 2, t + 0.25], { material: 'mirror' }), castShadow: false });
    return parts;
  }
  const cols = str(p.art, '#efe9df,#c9b79c,#7f8f63').split(',').map((c) => c.trim());
  parts.push({ ...box('mat', ['art'], [W - 4, H - 4, 0.4], [0, H / 2, t + 0.2], { color: str(p.matColor, '#f6f3ee') }), castShadow: false });
  // simple abstract: a few colour blocks / circles on the mat
  const rand = rng(String(p.seed ?? cols.join()));
  cols.forEach((c, i) => {
    const bw = (W - 14) * (0.35 + rand() * 0.4);
    const bh = (H - 14) * (0.25 + rand() * 0.35);
    const x = (rand() - 0.5) * (W - 14 - bw);
    const y = H / 2 + (rand() - 0.5) * (H - 14 - bh);
    if (i % 2) parts.push({ ...cyl(`shape-${i}`, ['art'], Math.min(bw, bh) / 2, 0.3, [x, y, t + 0.5], { color: c }), rotation: [90, 0, 0], castShadow: false });
    else parts.push({ ...box(`shape-${i}`, ['art'], [bw, bh, 0.3], [x, y, t + 0.5], { color: c }), castShadow: false });
  });
  return parts;
}

/** Throw cushions in a row (put on a sofa with elevation = seat height), or at `positions`. params: colors (comma separated), size, spacing, positions, throwColor (adds a folded throw at the end). */
export function cushions(p: Record<string, unknown>): Part[] {
  const cols = str(p.colors, '#e8e0d0,#c9b79c').split(',').map((c) => c.trim());
  const s = num(p.size, 45);
  const sp = num(p.spacing, 55);
  // `positions` ([[x, y, z], ...] in the item's space) puts the covers exactly over a sofa's own cushions
  const at = Array.isArray(p.positions) ? (p.positions as Vec3[]) : null;
  const r = s / 2 - 5;
  const square: [number, number][] = [[-r, -r], [r, -r], [r, r], [-r, r]];
  const parts: Part[] = cols.map((c, i) => {
    const pos: Vec3 = at?.[i] ?? [-((cols.length - 1) * sp) / 2 + i * sp, s / 2 - 2, 10];
    const look = { material: str(p.material, 'linen-white'), color: c };
    // a plump square cushion: rounded slab, leaning back a little
    return { id: `cushion-${i + 1}`, tags: ['cushion'], geometry: { type: 'prism', points: square, depth: 13, bevel: 5 }, position: pos, rotation: [-10, 0, at ? 0 : (i % 2 ? 1 : -1) * 4], castShadow: true, glass: false, ...look } as Part;
  });
  if (p.throwColor) parts.push(box('throw', ['throw'], [40, 4, 55], [((cols.length - 1) * sp) / 2 + sp, 2, 30], { material: 'linen-white', color: String(p.throwColor) }));
  return parts;
}

/** Table-top decor: a vase with flowers/branches, a tray, a bowl or candles. params: kind (vase | branches | bowl | candles | books), color. */
export function tableDecor(p: Record<string, unknown>): Part[] {
  const kind = str(p.kind, 'vase');
  const color = str(p.color, '#efe9df');
  const rand = rng(String(p.seed ?? kind));
  const parts: Part[] = [];
  if (typeof p.model === 'string' && MODELS[p.model]) {
    parts.push(modelPart('vase', p.model, num(p.height, 30), 0, ['vase']));
    if (kind === 'branches') {
      const vh = num(p.height, 30);
      for (let i = 0; i < 5; i++) parts.push({ ...cyl(`branch-${i}`, ['branch'], 0.4, 45, [(rand() - 0.5) * 8, vh + 18, 8 + (rand() - 0.5) * 6], { color: '#6e5a44' }), rotation: [(rand() - 0.5) * 30, 0, (rand() - 0.5) * 30] });
      for (let i = 0; i < 9; i++) parts.push(ell(`leaf-${i}`, ['leaves'], [7, 3, 4], [(rand() - 0.5) * 26, vh + 20 + rand() * 25, 8 + (rand() - 0.5) * 16], { color: str(p.leafColor, '#7f8f63') }));
    }
    return parts;
  }
  if (kind === 'bowl') {
    const dia = num(p.diameter, 30);
    parts.push(ell('bowl', ['bowl'], [dia, dia / 3, dia], [0, dia / 7.5, dia / 2], { color }));
  }
  else if (kind === 'candles') {
    parts.push(box('tray', ['tray'], [34, 2, 20], [0, 1, 10], { material: str(p.trayMaterial, 'wood-oak-light') }));
    [[-9, 10, 3.5], [0, 14, 3], [9, 8, 3.5]].forEach(([x, h, r], i) => parts.push(cyl(`candle-${i}`, ['candle'], r, h, [x, 2 + h / 2, 10], { color: '#f4efe4' })));
  } else if (kind === 'books') {
    [[30, 3, 22, '#d9cfbf'], [28, 2.5, 20, '#3d3a36'], [26, 2.5, 19, '#a8b59a']].forEach(([w, h, d, c], i) => parts.push(box(`book-${i}`, ['book'], [Number(w), Number(h), Number(d)], [0, 1.5 + i * 2.8, 12], { color: String(c) })));
  } else {
    const vh = num(p.height, 25);
    parts.push(cyl('vase', ['vase'], num(p.diameter, 12) / 2, vh, [0, vh / 2, 8], { color }));
    if (kind === 'branches') for (let i = 0; i < 5; i++) parts.push({ ...cyl(`branch-${i}`, ['branch'], 0.4, 45, [(rand() - 0.5) * 8, vh + 18, 8 + (rand() - 0.5) * 6], { color: '#6e5a44' }), rotation: [(rand() - 0.5) * 30, 0, (rand() - 0.5) * 30] });
    if (kind === 'branches') for (let i = 0; i < 7; i++) parts.push(ell(`leaf-${i}`, ['leaves'], [9, 6, 9], [(rand() - 0.5) * 26, vh + 20 + rand() * 25, 8 + (rand() - 0.5) * 16], { color: str(p.leafColor, '#7f8f63') }));
    if (kind === 'vase' && p.flowers) parts.push(ell('flowers', ['flowers'], [26, 20, 26], [0, vh + 8, 8], { color: String(p.flowers) }));
  }
  return parts;
}

/**
 * Triangular corner cabinet (fills a corner, door on the diagonal). Origin = the right-angle corner on the floor;
 * the triangle runs `legX` along -x and `legZ` along -z. params: legX, legZ, height, material/color, doorMaterial/doorColor.
 */
/** Parts built in a row frame turned by `yaw` degrees about y and moved to (x, z). */
function turned(parts: Part[], yaw: number, x: number, z: number): Part[] {
  const r = (yaw * Math.PI) / 180;
  const [c, s] = [Math.cos(r), Math.sin(r)];
  return parts.map((pt) => {
    const [px, py, pz] = pt.position;
    return { ...pt, position: [x + px * c + pz * s, py, z - px * s + pz * c], rotation: [pt.rotation[0], pt.rotation[1] + yaw, pt.rotation[2]] };
  });
}

/**
 * Open corner shelves (no door): back panels on both walls (or `backs: false` = free-standing on slim posts, seen from
 * both sides, best with `round`), triangular shelves, and on each shelf (bottom → top, `contents` space separated)
 * whisky | games | books | stuff | ... in a row along the open front.
 */
function openCorner(p: Record<string, unknown>, a: number, b: number, H: number, body: Extra): Part[] {
  const shelfLook = lookOf(p, 'shelf', typeof p.material === 'string' ? p.material : 'white-laminate');
  const n = Math.max(2, Math.round(num(p.shelves, 5)));
  const T = 2.5;
  // `round` = radius of the corner at the back (no backs: it is open both ways and nobody bumps into a point)
  const R = Math.min(num(p.round, 0), a - 5, b - 5);
  // outline space: x → item x, y → item z (+a/2, +b/2 = the corner); the arc replaces the corner
  const outline: [number, number][] = [[-a / 2, b / 2]];
  if (R > 0) {
    for (let i = 0; i <= 12; i++) {
      const t = (Math.PI / 2) * (1 - i / 12);
      outline.push([a / 2 - R + Math.cos(t) * R, b / 2 - R + Math.sin(t) * R]);
    }
  } else outline.push([a / 2, b / 2]);
  outline.push([a / 2, -b / 2]);
  const tri = (id: string, y: number): Part => ({
    id, tags: ['shelf'], geometry: { type: 'prism', points: outline, depth: T, bevel: 0.6 },
    position: [-a / 2, y, -b / 2], rotation: [90, 0, 0], castShadow: true, glass: false, ...shelfLook,
  });
  const parts: Part[] = [];
  if (p.backs !== false) {
    parts.push(box('back-x', ['body', 'back'], [a, H, 1.6], [-a / 2, H / 2, -0.8], body), box('back-z', ['body', 'back'], [1.6, H, b], [-0.8, H / 2, -b / 2], body));
  } else {
    // free-standing: slim posts at the two front ends and on the rounded back, floor to top shelf
    const postLook = { color: str(p.postColor, '#1d1d1f') };
    const back: [number, number] = R > 0 ? [-R + R * Math.SQRT1_2 - 2, -R + R * Math.SQRT1_2 - 2] : [-3, -3];
    for (const [i, [px, pz]] of ([[-a + 5, -2.5], [-2.5, -b + 5], back] as [number, number][]).entries()) parts.push(cyl(`post-${i + 1}`, ['post'], 1.3, H, [px, H / 2, pz], postLook));
  }
  const len = Math.hypot(a, b);
  const h = (a * b) / len; // corner → front edge
  const yaw = (Math.atan2(-b, -a) * 180) / Math.PI; // the row's +z (its front) points out of the corner
  const contents = str(p.contents, '').split(/\s+/);
  const ys = Array.from({ length: n }, (_, i) => 4 + (i * (H - 8)) / (n - 1));
  ys.forEach((y, i) => {
    parts.push(tri(`shelf-${i + 1}`, y));
    const kind = stuffKind(contents[i]);
    if (!kind || i === n - 1) return;
    const room = Math.min(ys[i + 1] - y - T, 34);
    const depth = 22;
    const inset = 3 + depth;
    const width = len * (1 - inset / h) - 6;
    if (width < 15) return;
    // row back-centre: from the middle of the open front, `inset` back towards the corner
    const ox = -a / 2 + (b / len) * inset;
    const oz = -b / 2 + (a / len) * inset;
    const row = stuffParts(kind, `shelf-${i + 1}-${kind}`, width, depth, room).map((pt) => ({ ...pt, position: [pt.position[0], pt.position[1] + y + T / 2, pt.position[2]] as Vec3 }));
    parts.push(...turned(row, yaw, ox, oz));
  });
  return parts;
}

export function cornerCabinet(p: Record<string, unknown>): Part[] {
  const a = num(p.legX, 75);
  const b = num(p.legZ, 75);
  const H = num(p.height, 200);
  const body = look(p, '', 'white-laminate');
  if (p.open) return openCorner(p, a, b, H, body);
  const door = lookOf(p, 'door', typeof p.material === 'string' ? p.material : 'white-laminate', typeof p.color === 'string' ? p.color : undefined);
  // outline in x/y, turned so y becomes z (rotation 90 about x) and extruded upwards
  const parts: Part[] = [
    // outline centred on its bounding box (bounds treat prism outlines as centred on 0)
    { id: 'body', tags: ['cabinet', 'body'], geometry: { type: 'prism', points: [[a / 2, b / 2], [-a / 2, b / 2], [a / 2, -b / 2]], depth: H, bevel: 0.3 }, position: [-a / 2, H / 2, -b / 2], rotation: [90, 0, 0], castShadow: true, glass: false, ...body },
  ];
  const len = Math.hypot(a, b);
  const yaw = (Math.atan2(b, a) * 180) / Math.PI; // turns local x onto the diagonal (-a, 0) -> (0, -b)
  const nx = -b / len;
  const nz = -a / len;
  const cx = -a / 2 + nx * 1;
  const cz = -b / 2 + nz * 1;
  parts.push({ ...box('door', ['door', 'front'], [len - 4, H - 4, 1.8], [cx, H / 2, cz], door), rotation: [0, yaw, 0], section: 'door' });
  parts.push({ ...box('handle', ['handle'], [1.5, 20, 1.5], [cx + nx * 1.6 + (a / len) * (len / 2 - 8), H / 2, cz + nz * 1.6 - (b / len) * (len / 2 - 8)], { color: str(p.handleColor, '#2a2a2a') }), rotation: [0, yaw, 0], section: 'door' });
  return parts;
}

/**
 * Small closet in a corner closed off by a board (e.g. the triangle between a pillar end and a wall behind a TV board):
 * origin = the right-angle corner on the floor, the triangle runs `legX` along -x and `legZ` along -z (its diagonal is
 * the board, not part of this item). A door on the x leg (facing +z, hinge at the corner end), a fixed panel on the z
 * leg (facing +x), a lid. Inside: a broom closet (stick vacuum, mop, ironing board, sprays on a small shelf).
 * params: legX, legZ, height, doorHeight, material/color (white), handleColor.
 */
export function cornerCloset(p: Record<string, unknown>): WithStates {
  const a = num(p.legX, 75);
  const b = num(p.legZ, 52);
  const H = num(p.height, 238);
  const dh = Math.min(H - 2, num(p.doorHeight, 210));
  const T = 1.8;
  const body = look(p, '', 'white-laminate');
  const hc = { color: str(p.handleColor, '#2a2a2a') };
  const parts: Part[] = [
    { id: 'lid', tags: ['body', 'lid'], geometry: { type: 'prism', points: [[a / 2, b / 2], [-a / 2, b / 2], [a / 2, -b / 2]], depth: T, bevel: 0 }, position: [-a / 2, H - T / 2, -b / 2], rotation: [90, 0, 0], castShadow: true, glass: false, ...body },
    box('panel', ['body', 'panel'], [T, H, b], [-T / 2, H / 2, -b / 2], body),
    box('lintel', ['body', 'frame'], [a - T, H - dh, T], [-(a + T) / 2, (H + dh) / 2, -T / 2], body),
  ];
  const dw = a - T - 0.6;
  const dx = -T - 0.3 - dw / 2;
  const pivot: Vec3 = [-T - 0.3, dh / 2, 0];
  const door: Part[] = [
    box('door', ['door', 'front'], [dw, dh - 0.6, T], [dx, dh / 2, -T / 2], body),
    box('handle', ['handle'], [1.2, 24, 1.6], [-a + 5, 105, 1], hc),
  ].map((pt) => ({ ...pt, section: 'door', pivot }));
  parts.push(...door);
  // inside, kept clear of the diagonal (x/a + z/b > -1): ironing board flat on the panel, the vacuum behind the door
  // (head along the panel), the mop further along, sprays + kitchen paper on a little corner shelf
  parts.push(...ironingBoard('iron', -T - 2.5, 0, -b * 0.47, Math.min(120, H - 10), Math.min(34, b * 0.62), true));
  parts.push(...stickVacuum('vac', -T - 14, 0, -b * 0.27, 112, true));
  parts.push(...flatMop('mop', -a * 0.48, 0, -T - 7, 130));
  const sa = Math.min(32, a * 0.45);
  const sb = Math.min(24, b * 0.45);
  parts.push({ id: 'shelf', tags: ['shelf'], geometry: { type: 'prism', points: [[sa / 2, sb / 2], [-sa / 2, sb / 2], [sa / 2, -sb / 2]], depth: 1.6, bevel: 0.3 }, position: [-T - sa / 2, 160, -T - sb / 2], rotation: [90, 0, 0], castShadow: true, glass: false, ...body });
  parts.push(...cleaningSprays('sprays', -T - 10, 160.8, -T - 6).slice(0, 4));
  const opened: Record<string, { rotation: Vec3 }> = {};
  for (const pt of door) opened[pt.id] = { rotation: [pt.rotation[0], pt.rotation[1] + 95, pt.rotation[2]] }; // swings out (+z)
  return { parts, states: [{ id: 'closed', name: 'Closed', parts: {} }, { id: 'open', name: 'Open', parts: opened }], interactions: [{ part: 'door', action: 'cycleStates' }, { part: 'handle', action: 'cycleStates' }] };
}

type Front = { kind?: string; h?: number; fill?: string; content?: string; mirror?: boolean; material?: string; color?: string };

/**
 * Tall cabinet: wardrobe, entry closet, shoe cabinet, locker. Columns side by side (left → right seen from the front),
 * each a stack of fronts from the bottom up: door | drawer | tilt (shoe flap, pull on top) | open (niche; fill =
 * baskets | tray | shoes | whisky | games | books ...) — fronts without `h` share what is left; behind a door / tilt `content` =
 * coats (on a rail) | shoes (shelves of pairs) | any shelf contents kind, seen when it is opened (state "open"). params: width, depth, height, plinth (recessed base, 0 =
 * none) or legHeight (tapered legs instead), columns [{w, stack}], handles (bar | knob | none = push-to-open),
 * materials, light (LED strip under the top of each niche).
 */
export function tallCabinet(p: Record<string, unknown>): WithStates {
  const W = num(p.width, 100);
  const D = num(p.depth, 58);
  const H = num(p.height, 200);
  const legH = num(p.legHeight, 0);
  const base = legH > 0 ? legH : num(p.plinth, 8);
  const T = 1.8;
  const body = look(p, '', 'white-laminate');
  const front = lookOf(p, 'front', typeof p.material === 'string' ? p.material : 'white-laminate', typeof p.color === 'string' ? p.color : undefined);
  const handles = str(p.handles, 'bar');
  const hc = { color: str(p.handleColor, '#2a2a2a') };
  const cols = (Array.isArray(p.columns) && p.columns.length ? p.columns : [{}, {}]) as { w?: number; stack?: Front[] }[];
  const fixedW = cols.reduce((s, c) => s + (c.w ?? 0), 0);
  const widths = cols.map((c) => c.w ?? (W - fixedW) / Math.max(cols.filter((k) => !k.w).length, 1));
  const bodyH = H - base;
  const parts: Part[] = [
    box('back', ['body'], [W, bodyH, T], [0, base + bodyH / 2, T / 2], body),
    box('side-l', ['body'], [T, bodyH, D], [-W / 2 + T / 2, base + bodyH / 2, D / 2], body),
    box('side-r', ['body'], [T, bodyH, D], [W / 2 - T / 2, base + bodyH / 2, D / 2], body),
    box('top', ['body'], [W, T, D], [0, H - T / 2, D / 2], body),
    box('bottom', ['body'], [W, T, D], [0, base + T / 2, D / 2], body),
  ];
  if (legH > 0) {
    const legLook = lookOf(p, 'leg', typeof p.material === 'string' ? p.material : 'wood-oak-light');
    for (const [x, z] of [[-W / 2 + 5, 5], [W / 2 - 5, 5], [-W / 2 + 5, D - 5], [W / 2 - 5, D - 5]]) parts.push(cyl(`leg-${x}-${z}`, ['leg'], 1.8, legH, [x, legH / 2, z], legLook));
  } else if (base > 0) parts.push(box('plinth', ['plinth'], [W - 2, base, D - 6], [0, base / 2, (D - 6) / 2], body));
  const opened: Record<string, { rotation?: Vec3; position?: Vec3 }> = {};
  const fronts: string[] = [];
  /** What sits inside a compartment (x centre, width, floor y, height). */
  const inside = (id: string, kind: string, cx: number, cw: number, y: number, h: number) => {
    if (kind === 'coats') {
      parts.push(cyl(`${id}-rail`, ['rail'], 1.25, cw - 2, [cx, y + h - 8, D / 2], { material: 'aluminium-grey', rotation: [0, 0, 90] }));
      const n = Math.max(1, Math.floor((cw - 6) / 11));
      for (let k = 0; k < n; k++) parts.push(...coat(`${id}-coat-${k + 1}`, cx - cw / 2 + 6 + ((k + 0.5) * (cw - 12)) / n, y + h - 8, D / 2, COAT_COLORS[(k + ci0) % COAT_COLORS.length], true, Math.min(85, h - 20)));
    } else if (kind === 'shoes') {
      const levels = Math.max(1, Math.floor(h / 22));
      for (let l = 0; l < levels; l++) {
        const ly = y + (l * h) / levels;
        if (l > 0) parts.push(box(`${id}-shelf-${l}`, ['shelf'], [cw - T, T, D - 4], [cx, ly - T / 2, D / 2], body));
        parts.push(...shoeRow(`${id}-shoes-${l}`, cx, ly, D - 2, cw, `${id}-${l}`));
      }
    } else {
      const k = stuffKind(kind);
      if (k) parts.push(...placeStuff(stuffParts(k, id, cw - 3, D - 3, h - 3), 0, [cx, y, 1]));
    }
  };
  let ci0 = 0;
  let x0 = -W / 2;
  widths.forEach((cw, ci) => {
    ci0 = ci;
    const cx = x0 + cw / 2;
    if (ci > 0) parts.push(box(`divider-${ci}`, ['body'], [T, bodyH, D - 1], [x0, base + bodyH / 2, D / 2], body));
    const stack: Front[] = cols[ci].stack?.length ? cols[ci].stack! : [{ kind: 'door' }];
    const fixedH = stack.reduce((s, f) => s + (f.h ?? 0), 0);
    const restH = (bodyH - fixedH) / Math.max(stack.filter((f) => !f.h).length, 1);
    // door handles sit on the edge away from the hinge: towards the middle of the cabinet
    const hx = cols.length === 1 ? cw / 2 - 4 : ci < cols.length / 2 ? cw / 2 - 4 : -cw / 2 + 4;
    let y = base;
    stack.forEach((f, k) => {
      const fh = f.h ?? restH;
      const id = `c${ci + 1}-${k + 1}`;
      const kind = f.kind ?? 'door';
      if (kind === 'open') {
        parts.push(box(`${id}-floor`, ['shelf', 'niche'], [cw - T, T, D - 2], [cx, y + T / 2, D / 2], body));
        parts.push(box(`${id}-ceil`, ['shelf', 'niche'], [cw - T, T, D - 2], [cx, y + fh - T / 2, D / 2], body));
        if (p.light) parts.push({ ...box(`${id}-led`, ['light', 'led'], [cw - 8, 0.5, 1.2], [cx, y + fh - T - 0.3, D - 5], { color: '#fff4e0' }), castShadow: false, emit: { color: '#ffd9a8', intensity: 4, kind: 'area' } });
        const bh = Math.min(fh - 10, 16);
        if (f.fill && !['baskets', 'tray'].includes(f.fill)) inside(id, f.fill, cx, cw, y + T, fh - 2 * T);
        if (f.fill === 'baskets') {
          for (const sx of [-1, 1]) parts.push(box(`${id}-basket-${sx > 0 ? 'r' : 'l'}`, ['basket'], [cw / 2 - 5, bh, D - 14], [cx + (sx * cw) / 4, y + T + bh / 2, D / 2], { material: 'rattan-weave', color: '#e9dcc4' }));
        } else if (f.fill === 'tray') {
          parts.push(box(`${id}-tray`, ['tray'], [Math.min(cw - 12, 30), 2, 18], [cx - cw / 6, y + T + 1, D - 14], { material: 'wood-oak-light' }));
          parts.push(cyl(`${id}-bowl`, ['bowl'], 7, 5, [cx + cw / 4, y + T + 2.5, D - 14], { color: '#d9cfbf' }));
        }
      } else {
        const fl = { ...front, ...(f.material ? { material: f.material } : {}), ...(f.color ? { color: f.color } : {}) };
        const fz = D + T / 2;
        if (f.content) inside(id, f.content, cx, cw, y + T, fh - T);
        const before = parts.length;
        parts.push({ ...box(`${id}-front`, ['front', kind], [cw - 0.6, fh - 0.6, T], [cx, y + fh / 2, fz], fl), section: id });
        if (f.mirror) parts.push({ ...box(`${id}-mirror`, ['mirror'], [cw - 10, fh - 14, 0.4], [cx, y + fh / 2, fz + T / 2 + 0.2], { material: 'mirror' }), section: id });
        if (handles !== 'none') {
          const z = fz + T / 2 + 1;
          if (kind === 'door') {
            const len = Math.min(fh * 0.3, 30);
            const hy = Math.min(Math.max(105, y + 6 + len / 2), y + fh - 6 - len / 2);
            parts.push({ ...(handles === 'knob' ? { ...cyl(`${id}-handle`, ['handle'], 1.4, 2.2, [cx + hx, hy, z], hc), rotation: [90, 0, 0] as Vec3 } : box(`${id}-handle`, ['handle'], [1.2, len, 1.6], [cx + hx, hy, z], hc)), section: id });
          } else {
            const hy = kind === 'tilt' ? y + fh - 5 : y + fh / 2;
            parts.push({ ...(handles === 'knob' ? { ...cyl(`${id}-handle`, ['handle'], 1.4, 2.2, [cx, hy, z], hc), rotation: [90, 0, 0] as Vec3 } : box(`${id}-handle`, ['handle'], [Math.min(cw * 0.4, 20), 1.2, 1.6], [cx, hy, z], hc)), section: id });
          }
        }
        // opening: doors swing on the hinge (the edge away from the handle), tilt flaps fold out, drawers slide out
        fronts.push(`${id}-front`);
        for (let q = before; q < parts.length; q++) {
          const pt = parts[q];
          if (kind === 'door') {
            const left = hx > 0; // handle right → hinge left
            parts[q] = { ...pt, pivot: [cx + (left ? -cw / 2 : cw / 2), y + fh / 2, fz + T / 2] };
            opened[pt.id] = { rotation: [pt.rotation[0], pt.rotation[1] + (left ? -100 : 100), pt.rotation[2]] };
          } else if (kind === 'tilt') {
            parts[q] = { ...pt, pivot: [cx, y, fz + T / 2] };
            opened[pt.id] = { rotation: [pt.rotation[0] + 40, pt.rotation[1], pt.rotation[2]] };
          } else opened[pt.id] = { position: [pt.position[0], pt.position[1], pt.position[2] + Math.min(D - 10, 40)] };
        }
      }
      y += fh;
    });
    x0 += cw;
  });
  return {
    parts,
    states: [{ id: 'closed', name: 'Closed', parts: {} }, { id: 'open', name: 'Open', parts: opened }],
    interactions: fronts.map((part) => ({ part, action: 'cycleStates' as const })),
  };
}

/**
 * Wood slat wall cladding (acoustic-panel style): vertical slats with shadow gaps on a dark felt backing.
 * params: width, height, depth (total, ~2), slat (slat width, 2.7), gap (1.3), material/color, backColor.
 */
export function slatPanel(p: Record<string, unknown>): Part[] {
  const W = num(p.width, 60);
  const H = num(p.height, 240);
  const D = Math.max(1.2, num(p.depth, 2));
  const sw = num(p.slat, 2.7);
  const gap = num(p.gap, 1.3);
  const wood = look(p, '', 'wood-oak-light');
  const back = 0.8;
  const parts: Part[] = [box('backing', ['backing', 'felt'], [W, H, back], [0, H / 2, back / 2], { color: str(p.backColor, '#1d1d1f'), radius: 0.2 })];
  const n = Math.max(1, Math.floor((W + gap) / (sw + gap)));
  const x0 = -((n * sw + (n - 1) * gap) / 2) + sw / 2;
  for (let i = 0; i < n; i++) parts.push(box(`slat-${i + 1}`, ['slat'], [sw, H, D - back], [x0 + i * (sw + gap), H / 2, back + (D - back) / 2], { ...wood, radius: 0.4 }));
  return parts;
}

/**
 * Full-motion TV wall arm: wall plate, two arm links with joints, tilt head + VESA plate. Origin = the wall plate
 * (back-centre, bottom at y 0); the TV's back sits `reach` cm out, its centre `shift` cm to the side (+x).
 * params: reach (25), shift (0), color.
 */
export function tvArm(p: Record<string, unknown>): Part[] {
  const reach = Math.max(8, num(p.reach, 25));
  const shift = num(p.shift, 0);
  const c = { color: str(p.color, '#1d1d1f') };
  const y = 15; // arm height over the bottom of the wall plate
  const head: [number, number] = [shift, reach - 4];
  const elbow: [number, number] = [shift / 2 - 9, (reach - 4) / 2];
  const link = (id: string, [ax, az]: [number, number], [bx, bz]: [number, number], yy: number): Part => {
    const len = Math.hypot(bx - ax, bz - az);
    const yaw = (Math.atan2(-(bz - az), bx - ax) * 180) / Math.PI;
    return { ...box(id, ['arm'], [len, 3, 3.5], [(ax + bx) / 2, yy, (az + bz) / 2], { ...c, radius: 1 }), rotation: [0, yaw, 0] };
  };
  return [
    box('wall-plate', ['plate'], [8, 30, 1.4], [0, 15, 0.7], { ...c, radius: 0.5 }),
    box('wall-mount', ['plate'], [5, 10, 3], [0, y, 2.5], { ...c, radius: 0.8 }),
    link('arm-1', [0, 3], elbow, y),
    cyl('joint-1', ['joint'], 2.3, 5, [elbow[0], y, elbow[1]], c),
    link('arm-2', elbow, head, y + 0.5),
    cyl('joint-2', ['joint'], 2.3, 5, [head[0], y, head[1]], c),
    box('tilt-head', ['head'], [5, 12, 3], [head[0], y, reach - 2.2], { ...c, radius: 0.8 }),
    box('vesa-plate', ['head', 'vesa'], [22, 22, 0.8], [head[0], y, reach - 0.4], { ...c, radius: 0.3 }),
  ];
}

/** Swivel TV floor stand (e.g. 89 x 52 base, column up to the bracket, small shelf). Put the TV on it with state "wall". params: width, depth, height (bracket top), shelf (height, 0 = none), color. */
export function tvStand(p: Record<string, unknown>): Part[] {
  const W = num(p.width, 89);
  const D = num(p.depth, 52);
  const H = num(p.height, 135);
  const c = { color: str(p.color, '#1d1d1f') };
  const parts: Part[] = [
    box('base', ['base'], [W, 3, D], [0, 1.5, D / 2], c),
    box('column', ['column'], [10, H - 3, 6], [0, (H - 3) / 2 + 3, 8], c),
    box('bracket', ['bracket'], [40, 30, 3], [0, H - 25, 12], c),
  ];
  const shelf = num(p.shelf, 40);
  if (shelf > 0) parts.push(box('shelf', ['shelf'], [W - 10, 1.2, D - 14], [0, shelf, D / 2 + 3], { color: str(p.shelfColor, '#2b2b2b'), glass: true }));
  return parts;
}
