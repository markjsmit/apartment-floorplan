import type { Part, Vec3 } from '../schema';
import { box as sharpBox, cyl, num, str, type Extra, type WithStates } from './builtins';
import { placeStuff, stuffKind, stuffParts } from './stuff';
import { broom, COAT_COLORS, cleaningSprays, coat, flatMop, gameStack, ironingBoard, shoeRow, stickVacuum, whiskyRow } from './wear';
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
  // 3 tiers (Mark): slim drawers for the remotes right under the top, an open shelf for things on show, a deep drawer at
  // the bottom (blankets, games). Fronts on +z (towards the sofa), they pull out on double-click.
  const shape = str(p.shape, 'rect');
  const W = num(p.width, 110);
  const D = shape === 'round' ? W : num(p.depth, 60);
  const H = num(p.height, 40);
  const n = Math.max(1, num(p.drawers, 2));
  const base = str(p.base, 'legs');
  const wood = look(p, '', 'wood-oak-light');
  const legLook = lookOf(p, 'leg', typeof p.material === 'string' ? p.material : 'wood-oak-light');
  const frontLook = lookOf(p, 'front', typeof p.material === 'string' ? p.material : 'wood-oak-light');
  const pull = { color: str(p.pullColor, '#2a2a2a') };
  const cz = D / 2;
  const T = 3;
  const round = shape !== 'rect';
  // the cabinet under the top: a box (rect) or a drum (round / oval)
  const r = Math.min(W, D) / 2 - 3;
  const cw = round ? r * 2 : W - 4;
  const cd = round ? r * 2 : D - 4;
  const feet = 4;
  const bandH = 7; // remote drawers
  const bandY = H - T - bandH;
  const lowTop = Math.max(feet + 10, bandY - Math.max(10, (H - T - feet) * 0.36)); // top of the bottom drawer box
  const parts: Part[] = [top('top', shape, W, D, T, H - T / 2, cz, wood)];
  const slab = (id: string, tags: string[], h: number, y: number) => (round ? cyl(id, tags, r, h, [0, y + h / 2, cz], wood) : box(id, tags, [cw, h, cd], [0, y + h / 2, cz], wood));
  parts.push(slab('band', ['body'], bandH, bandY));
  parts.push(slab('low', ['body'], lowTop - feet, feet));
  // the open shelf between them, held by corner posts
  const posts: [number, number][] = round ? [[0, -r + 3], [r * 0.82, r * 0.5], [-r * 0.82, r * 0.5]] : [[-cw / 2 + 2, -cd / 2 + 2], [cw / 2 - 2, -cd / 2 + 2], [-cw / 2 + 2, cd / 2 - 2], [cw / 2 - 2, cd / 2 - 2]];
  posts.forEach(([x, z], i) => {
    const h = bandY - lowTop;
    if (base === 'tapered') parts.push(cyl(`post-${i + 1}`, ['leg', 'post'], 1.6, h, [x, lowTop + h / 2, cz + z], legLook));
    else parts.push(box(`post-${i + 1}`, ['leg', 'post'], base === 'metal-frame' ? [2.2, h, 2.2] : [3.5, h, 3.5], [x, lowTop + h / 2, cz + z], base === 'metal-frame' ? legLook : wood));
  });
  // feet: a recessed plinth (box) or short legs
  if (base === 'box') parts.push(round ? cyl('plinth', ['plinth'], r - 4, feet, [0, feet / 2, cz], wood) : box('plinth', ['plinth'], [cw - 8, feet, cd - 8], [0, feet / 2, cz], wood));
  else posts.forEach(([x, z], i) => parts.push(base === 'tapered' ? cyl(`leg-${i + 1}`, ['leg'], 1.8, feet, [x, feet / 2, cz + z], legLook) : box(`leg-${i + 1}`, ['leg'], [3, feet, 3], [x, feet / 2, cz + z], legLook)));
  // on the open shelf: a couple of books and a small tray
  const sy = lowTop;
  parts.push(box('shelf-book-1', ['decor', 'books'], [24, 2.2, 17], [-cw * 0.2, sy + 1.1, cz - 1], { color: '#3a4a5a', radius: 0.3 }));
  parts.push({ ...box('shelf-book-2', ['decor', 'books'], [21, 1.8, 15], [-cw * 0.2 + 1, sy + 3.1, cz - 1], { color: '#d9cdb8', radius: 0.3 }), rotation: [0, 6, 0] });
  if (cw > 60) parts.push(box('shelf-tray', ['decor', 'tray'], [16, 1.6, 12], [cw * 0.22, sy + 0.8, cz], { color: '#2b2b2b', radius: 0.6 }));
  // drawers: n slim remote drawers in the band, one deep drawer below
  const fz = (round ? cz + r : cz + cd / 2) + 0.9;
  const fw = (round ? r * 1.25 : cw - 6) / n;
  const drawer = (id: string, x: number, y: number, w: number, h: number, inside: Part[]) => {
    const out = 30;
    const sec = { section: id };
    parts.push({ ...box(id, ['drawer', 'front'], [w - 0.6, h, 1.8], [x, y, fz], frontLook), ...sec, open: { position: [x, y, fz + out] } });
    parts.push({ ...box(`${id}-pull`, ['handle'], [Math.min(10, w * 0.35), 1.2, 1.2], [x, y, fz + 1.4], pull), ...sec, open: { position: [x, y, fz + 1.4 + out] } });
    for (const pt of inside) parts.push({ ...pt, ...sec, open: { position: [pt.position[0], pt.position[1], pt.position[2] + out] } });
  };
  for (let i = 0; i < n; i++) {
    const x = -((n - 1) * fw) / 2 + i * fw;
    const y = bandY + bandH / 2;
    // the remotes inside (seen when it is open)
    drawer(`drawer-${i + 1}`, x, y, fw, bandH - 1.5, [
      box(`drawer-${i + 1}-remote-1`, ['remote'], [4.5, 1.6, 16], [x - fw * 0.18, bandY + 1.6, fz - 10], { color: '#1f1f22', radius: 0.6 }),
      box(`drawer-${i + 1}-remote-2`, ['remote'], [4, 1.6, 14], [x + fw * 0.12, bandY + 1.6, fz - 10], { color: i % 2 ? '#2b2b2b' : '#e9e4d8', radius: 0.6 }),
    ]);
  }
  const lowH = lowTop - feet;
  drawer('drawer-low', 0, feet + lowH / 2, round ? r * 1.3 : cw - 6, lowH - 2, []);
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
    // 4 splayed legs that start under the seat (joined by an apron ring) and a rung between each pair as the footrest
    const h = SH - st;
    const rTop = seatShape === 'square' ? (S / 2 - 4) * Math.SQRT2 : S / 2 - 4.5;
    const rBot = rTop + 4.5;
    const at = (a: number, y: number): [number, number] => {
      const r = rTop + (rBot - rTop) * (1 - y / h);
      return [Math.cos(a) * r, Math.sin(a) * r];
    };
    const angles = [0, 1, 2, 3].map((k) => Math.PI / 4 + (k * Math.PI) / 2);
    angles.forEach((a, i) => {
      const [xt, zt] = at(a, h);
      const [xb, zb] = at(a, 0);
      const rx = (Math.atan2(zt - zb, h) * 180) / Math.PI;
      const rz = (-Math.atan2(xt - xb, h) * 180) / Math.PI;
      // a tilted round leg reaches past its end points by radius x sin(tilt): shorten it so it stands exactly on the floor
      const tilt = Math.atan2(Math.hypot(xt - xb, zt - zb), h);
      const len = (h - 2 * 1.6 * Math.sin(tilt)) / Math.cos(tilt);
      parts.push({ ...cyl(`leg-${i + 1}`, ['leg'], 1.6, len, [(xt + xb) / 2, h / 2, cz + (zt + zb) / 2], legLook), rotation: [rx, 0, rz] });
    });
    parts.push(seatShape === 'square'
      ? box('apron', ['frame'], [S - 5, 3, S - 5], [0, h - 1.5, cz], legLook)
      : cyl('apron', ['frame'], rTop + 1.8, 3, [0, h - 1.5, cz], legLook));
    const fy = SH * 0.36;
    angles.forEach((a, i) => {
      const [x1, z1] = at(a, fy);
      const [x2, z2] = at(angles[(i + 1) % 4], fy);
      const yaw = (Math.atan2(-(z2 - z1), x2 - x1) * 180) / Math.PI;
      parts.push({ ...box(`footrest-${i + 1}`, ['footrest'], [Math.hypot(x2 - x1, z2 - z1), 1.8, 1.8], [(x1 + x2) / 2, fy, cz + (z1 + z2) / 2], legLook), rotation: [0, yaw, 0] });
    });
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
  if (style === 'shell') {
    // Eames-style moulded shell (DSW): one curved shell (seat + back) on splayed wooden dowel legs with black wire braces
    const shell = { ...seatLook, ...backLook };
    parts.push(ell('seat', ['seat', 'shell'], [W, 7, D - 6], [0, SH - 3, D / 2 + 1], seatLook));
    parts.push({ ...ell('back', ['back', 'shell'], [W - 1, BH - SH + 6, 9], [0, SH + (BH - SH) / 2 - 3, 7], shell), rotation: [-10, 0, 0] });
    const lh = SH - 6;
    const wire = { color: '#1d1d1f' };
    const legs: [number, number, number, number][] = [[-W / 2 + 7, D / 2 - 6, -W / 2 + 2, D - 4], [W / 2 - 7, D / 2 - 6, W / 2 - 2, D - 4], [-W / 2 + 7, D / 2 - 2, -W / 2 + 2, 4], [W / 2 - 7, D / 2 - 2, W / 2 - 2, 4]];
    legs.forEach(([xt, zt, xb, zb], i) => {
      const len = Math.hypot(xt - xb, lh, zt - zb);
      const rx = (Math.atan2(zt - zb, lh) * 180) / Math.PI;
      const rz = (-Math.atan2(xt - xb, lh) * 180) / Math.PI;
      parts.push({ ...cyl(`leg-${i + 1}`, ['leg'], 1.4, len, [(xt + xb) / 2, lh / 2, (zt + zb) / 2], legLook), rotation: [rx, 0, rz] });
    });
    // the wire base: side rods + a cross under the seat
    parts.push(box('wire-l', ['wire'], [0.5, 0.5, D - 12], [-W / 2 + 4.5, lh * 0.42, D / 2 - 1], { ...wire, radius: 0 }));
    parts.push(box('wire-r', ['wire'], [0.5, 0.5, D - 12], [W / 2 - 4.5, lh * 0.42, D / 2 - 1], { ...wire, radius: 0 }));
    parts.push({ ...box('wire-x1', ['wire'], [W - 9, 0.5, 0.5], [0, lh * 0.62, D / 2 - 1], { ...wire, radius: 0 }), rotation: [0, 35, 0] });
    parts.push({ ...box('wire-x2', ['wire'], [W - 9, 0.5, 0.5], [0, lh * 0.62, D / 2 - 1], { ...wire, radius: 0 }), rotation: [0, -35, 0] });
    return parts;
  }
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
    // vines = chains of small leaves on a thin stem. Without `drop` they hang straight down around the pot (a shelf
    // edge or a hook); with `drop` (cm from the pot centre to the edge in front, +z) they first run along the top
    // (pot at the back of a cabinet) and then fall over the front edge, like a real pothos on a wardrobe.
    const drop = num(p.drop, 0);
    for (let i = 0; i < 10; i++) {
      const a = rand() * Math.PI * 2;
      const r = pd * (0.15 + rand() * 0.3);
      const lf = ell(`crown-${i}`, ['leaves'], [5, 0.7, 4], [Math.cos(a) * r, top + 3 + rand() * 4, cz + Math.sin(a) * r], { color: green(rand()) });
      lf.rotation = [-30 - rand() * 30, (-a * 180) / Math.PI + 90, 0];
      parts.push(lf);
    }
    const n = 7;
    const stem = { color: '#4f6b3a' };
    for (let i = 0; i < n; i++) {
      const len = foliageH * (0.5 + rand() * 0.7);
      let x0: number, z0: number, ox: number, oz: number;
      if (drop > 0) {
        // along the top to the edge, fanning out a bit
        x0 = (i - (n - 1) / 2) * (pd * 0.24) + (rand() - 0.5) * 3;
        z0 = cz + drop + 0.5;
        ox = 0;
        oz = 1;
        const run = drop - pd / 2;
        const runX = (x0 * 0.5) / Math.max(run, 1);
        parts.push({ ...cyl(`vine-${i}-run`, ['stem'], 0.25, Math.hypot(run, x0 * 0.5), [x0 * 0.75, 0.4, cz + pd / 2 + run / 2], stem), rotation: [90, 0, (Math.atan(runX) * 180) / Math.PI] });
        for (let k = 1; k * 5 < run; k++) {
          const lf = ell(`vine-${i}-top-${k}`, ['leaves'], [4.5, 0.6, 3.6], [x0 * 0.5 + (x0 * 0.5 * k * 5) / run + (k % 2 ? 1.6 : -1.6), 0.8, cz + pd / 2 + k * 5], { color: green(rand()) });
          lf.rotation = [0, (k % 2 ? 30 : -30) + (rand() - 0.5) * 20, 0];
          parts.push(lf);
        }
      } else {
        const a = (i / n) * Math.PI * 2 + rand() * 0.6;
        ox = Math.cos(a);
        oz = Math.sin(a);
        x0 = ox * (pd / 2 + 1);
        z0 = cz + oz * (pd / 2 + 1);
      }
      const y0 = drop > 0 ? 0 : top;
      // the hanging part: swaying a little, a leaf every ~4.5 cm on alternate sides, smaller towards the tip
      parts.push(cyl(`vine-${i}-stem`, ['stem'], 0.22, len, [x0, y0 - len / 2, z0 + oz * 0.8], stem));
      for (let k = 0; k * 4.5 < len; k++) {
        const t = (k * 4.5) / len;
        const side = k % 2 ? 1 : -1;
        const sway = Math.sin(t * 3 + i) * 1.5;
        const sz = 1 - t * 0.45;
        const lf = ell(`vine-${i}-leaf-${k}`, ['leaves'], [5 * sz, 0.6, 4 * sz], [x0 + side * 1.6 * Math.abs(oz) + sway * Math.abs(oz) + (drop > 0 ? side * 1.6 : 0), y0 - k * 4.5 - 1, z0 + oz * 1.6 + side * 1.6 * Math.abs(ox)], { color: green(rand()) });
        lf.rotation = [70 + rand() * 15, (Math.atan2(ox, oz) * 180) / Math.PI + side * 35, (rand() - 0.5) * 30];
        parts.push(lf);
      }
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
    const side = panels === 1 ? (p.side === 'right' ? 1 : -1) : i < panels / 2 ? -1 : 1; // one panel: gathered left (default) or right
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
    // magnet board (steel sheet / a fridge door) covered in event photo magnets, the Israeli way: 10x15 photo-booth
    // prints from weddings / bar mitzvahs (white border, a strip with the couple's names), packed edge to edge in rows,
    // a bit crooked and overlapping. `photos` = how many (capped at what fits); `photoTextures` = n uses the real
    // photos photo-magnet-1..n (13.8 x 6.8 cm prints) instead of a drawn venue + crowd.
    parts.push(box('board', ['board', 'magnet board'], [W, H, 0.8], [0, H / 2, 0.4], { material: str(p.boardMaterial, 'metal-black'), color: fc, radius: 0.3 }));
    const rand = rng(String(p.seed ?? 'photos'));
    const venues = ['#2a2230', '#3a2a24', '#1f2a3a', '#4a3a2a', '#2e2a3e', '#5a4632'];
    const crowd = ['#c9a27a', '#8a6a5a', '#d8c3a5', '#6f5a7a', '#b0786a', '#e8dccb'];
    const strips = ['#c8452c', '#2e5a8a', '#d9a43a', '#6a4a8a', '#1f1f22', '#3d6b4a', '#b0466a'];
    const names = ['Noa & Itay', 'Shira & Tal', 'Bar Mitzvah Yoav', 'Maya & Omer', 'Lior 40', 'Dana & Roy', 'Bat Mitzvah Gali', 'Yael & Ben'];
    const max = Math.round(num(p.photos, 40));
    const real = num(p.photoTextures, 0);
    /** One magnet: a white-bordered print (+ a name strip), all its pieces turned together by `tilt` about its middle. */
    const magnet = (i: number, cx: number, cy: number, pw: number, ph: number, z: number, tilt: number) => {
      const rot: Vec3 = [0, 0, tilt];
      const a = (tilt * Math.PI) / 180;
      const at = (dx: number, dy: number, dz: number): Vec3 => [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a), z + dz];
      const strip = real > 0 || rand() < 0.65;
      const sh = strip ? 2.2 : 0;
      const id = `photo-${i}`;
      parts.push({ ...box(id, ['photo', 'magnet'], [pw, ph, 0.3], at(0, 0, 0), { color: '#f4f1ea', radius: 0 }), rotation: rot, castShadow: false });
      // the picture: one of our real photos, or a dark venue with a row of people across the lower half
      const iw = pw - 1.2;
      const ih = ph - 1.2 - sh;
      if (real > 0) parts.push({ ...box(`${id}-print`, ['photo'], [iw, ih, 0.1], at(0, sh / 2, 0.2), { material: `photo-magnet-${1 + Math.floor(rand() * real)}`, radius: 0 }), rotation: rot, castShadow: false });
      else {
        parts.push({ ...box(`${id}-print`, ['photo'], [iw, ih, 0.1], at(0, sh / 2, 0.2), { color: venues[Math.floor(rand() * venues.length)], radius: 0 }), rotation: rot, castShadow: false });
        parts.push({ ...box(`${id}-people`, ['photo'], [iw * (0.6 + rand() * 0.35), ih * 0.45, 0.1], at((rand() - 0.5) * 2, sh / 2 - ih * 0.2, 0.26), { color: crowd[Math.floor(rand() * crowd.length)], radius: 0 }), rotation: rot, castShadow: false });
      }
      if (strip) {
        const name = names[Math.floor(rand() * names.length)];
        parts.push({ ...box(`${id}-strip`, ['photo'], [pw - 1.2, sh - 0.4, 0.1], at(0, -ph / 2 + 0.6 + (sh - 0.4) / 2, 0.2), { color: strips[Math.floor(rand() * strips.length)], radius: 0 }), rotation: rot, castShadow: false, label: { text: name, size: 0.75, offset: [0, 0], color: '#f4f1ea', bg: 'none' } });
      }
    };
    if (p.scatter) {
      // scattered playfully: random spots, more crooked, a few overlapping (later ones on top), the board showing between
      const placed: [number, number][] = [];
      for (let i = 0, tries = 0; i < max && tries < max * 60; tries++) {
        const [pw, ph] = [15, 10];
        const tilt = (rand() - 0.5) * 24;
        const cx = -W / 2 + 10 + rand() * (W - 20);
        const cy = 9 + rand() * (H - 18);
        if (placed.some(([x, y]) => Math.abs(x - cx) < pw * 0.75 && Math.abs(y - cy) < ph * 0.75)) continue;
        placed.push([cx, cy]);
        magnet(i, cx, cy, pw, ph, 0.85 + i * 0.012, tilt);
        i++;
      }
      return parts;
    }
    const rowH = 10.4;
    let i = 0;
    for (let ry = H - 1 - rowH / 2; ry - rowH / 2 > 0.5 && i < max; ry -= rowH - 0.4) {
      let x = -W / 2 + 0.5 + rand() * 2;
      while (i < max) {
        const pw = real > 0 || rand() < 0.8 ? 15 : 10; // mostly landscape 15x10, sometimes a square-ish 10x10
        if (x + pw > W / 2 - 0.3) break;
        // neighbours overlap a little: keep them on slightly different layers
        magnet(i, x + pw / 2 + (rand() - 0.5) * 0.8, ry + (rand() - 0.5) * 0.8, pw, 10, 0.85 + (i % 3) * 0.06, (rand() - 0.5) * 4);
        x += pw - 0.3;
        i++;
      }
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
    // each shape on its own layer: overlapping shapes at the same depth flicker
    const z = t + 0.55 + i * 0.15;
    if (i % 2) parts.push({ ...cyl(`shape-${i}`, ['art'], Math.min(bw, bh) / 2, 0.1, [x, y, z], { color: c }), rotation: [90, 0, 0], castShadow: false });
    else parts.push({ ...box(`shape-${i}`, ['art'], [bw, bh, 0.1], [x, y, z], { color: c, radius: 0 }), castShadow: false });
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
 * `step`: the diagonal starts that far behind the door line (x = -legX, z = -step), e.g. to bring the door flush with
 * the far face of a pillar instead of leaving a corner. params: legX, legZ, step, height, doorHeight, material/color, handleColor.
 */
export function cornerCloset(p: Record<string, unknown>): WithStates {
  const a = num(p.legX, 75);
  const b = num(p.legZ, 52);
  const H = num(p.height, 238);
  const dh = Math.min(H - 2, num(p.doorHeight, 210));
  const step = Math.min(Math.max(0, num(p.step, 0)), b - 5);
  const T = 1.8;
  const body = look(p, '', 'white-laminate');
  const hc = { color: str(p.handleColor, '#2a2a2a') };
  const parts: Part[] = [
    { id: 'lid', tags: ['body', 'lid'], geometry: { type: 'prism', points: [[a / 2, b / 2], [-a / 2, b / 2], ...(step > 0 ? [[-a / 2, b / 2 - step]] as [number, number][] : []), [a / 2, -b / 2]], depth: T, bevel: 0 }, position: [-a / 2, H - T / 2, -b / 2], rotation: [90, 0, 0], castShadow: true, glass: false, ...body },
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

/**
 * Open cleaning corner on a wall (no door, so nothing to hit in a tight corner): the stick vacuum hanging in its
 * charging dock, a flat mop and a broom in wall clips, sprays + kitchen paper on a little shelf. Origin back-centre
 * on the wall. params: width (~62), color (dock, clips, shelf).
 */
export function cleaningCorner(p: Record<string, unknown>): Part[] {
  const W = Math.max(50, num(p.width, 62));
  const c = { color: str(p.color, '#f2f0ec') };
  const vx = -W / 2 + 14;
  const bx = W / 2 - 14.5;
  const parts: Part[] = [
    box('dock', ['dock'], [9, 28, 1.4], [vx, 100, 0.7], c),
    box('dock-arm', ['dock'], [6, 4, 9], [vx, 101, 5], c),
    box('clip-rail', ['clips'], [W * 0.55, 3, 1.6], [W / 2 - W * 0.3, 112, 0.8], c),
    cyl('clip-mop', ['clips'], 1.6, 3, [0, 112, 2.4], c),
    cyl('clip-broom', ['clips'], 1.6, 3, [bx, 112, 2.4], c),
    box('shelf', ['shelf'], [W - 24, 1.6, 15], [W / 2 - (W - 24) / 2 - 2, 150, 7.5], c),
    ...stickVacuum('vac', vx, 3, 9, 112),
    ...flatMop('mop', 0, 0, 22, 128, true),
    ...broom('broom', bx, 0, 3, 120),
    ...cleaningSprays('sprays', W / 2 - (W - 24) / 2 - 2, 150.8, 7),
  ];
  return parts;
}

type Front = { kind?: string; h?: number; fill?: string; content?: string; mirror?: boolean; material?: string; color?: string; leaves?: number; glass?: boolean };

/**
 * Tall cabinet: wardrobe, entry closet, shoe cabinet, locker. Columns side by side (left → right seen from the front),
 * each a stack of fronts from the bottom up: door | drawer | tilt (shoe flap, pull on top) | open (niche; fill =
 * baskets | tray | shoes | whisky | games | books ...) — fronts without `h` share what is left; behind a door / tilt `content` =
 * coats (on a rail) | shoes (shelves of pairs) | any shelf contents kind, seen when it is opened (state "open"). params: width, depth, height, plinth (recessed base, 0 =
 * none) or legHeight (tapered legs instead), columns [{w, stack}], handles (bar | knob | none = push-to-open),
 * materials, fluted (ribbed doors), light (LED strip under the top of each niche).
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
    } else if (kind === 'display') {
      // display shelves every ~30 cm (glass column): a few things on each, the odd bag
      const levels = Math.max(1, Math.floor(h / 30));
      const picks = ['stuff', 'bags', 'books', 'stuff'] as const;
      for (let l = 0; l < levels; l++) {
        const ly = y + (l * h) / levels;
        if (l > 0) parts.push(box(`${id}-shelf-${l}`, ['shelf'], [cw - T, 1.2, D - 4], [cx, ly - 0.6, D / 2], { material: 'glass', glass: true }));
        parts.push(...placeStuff(stuffParts(picks[l % picks.length], `${id}-d${l}`, cw - 4, D - 6, h / levels - 3), 0, [cx, ly, 2]));
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
      // two closed fronts on top of each other always have a fixed shelf behind the seam (doors follow the inside)
      if (k > 0 && kind !== 'open' && (stack[k - 1].kind ?? 'door') !== 'open') parts.push(box(`${id}-shelf`, ['shelf', 'body'], [cw - T, T, D - 1], [cx, y, D / 2], body));
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
        // a door can be a pair of leaves (double doors) and/or glass in a slim dark aluminium frame (lit display inside)
        const leaves = kind === 'door' && f.leaves === 2 ? 2 : 1;
        const lw = cw / leaves;
        for (let l = 0; l < leaves; l++) {
          const lx = cx - cw / 2 + lw * (l + 0.5);
          const lid = l === 0 ? `${id}-front` : `${id}-front-${l + 1}`;
          if (f.glass) {
            const frame = { color: str(p.glassFrameColor, '#2a2a2c') };
            const b = 2.2;
            parts.push({ ...box(lid, ['front', kind, 'frame'], [lw - 0.6, b, T], [lx, y + fh - 0.3 - b / 2, fz], frame), section: id });
            parts.push({ ...box(`${lid}-frame-b`, ['front', 'frame'], [lw - 0.6, b, T], [lx, y + 0.3 + b / 2, fz], frame), section: id });
            for (const sx of [-1, 1]) parts.push({ ...box(`${lid}-frame-${sx > 0 ? 'r' : 'l'}`, ['front', 'frame'], [b, fh - 0.6, T], [lx + sx * (lw / 2 - 0.3 - b / 2), y + fh / 2, fz], frame), section: id });
            parts.push({ ...box(`${lid}-glass`, ['front', 'glass'], [lw - 2 * b - 0.6, fh - 2 * b - 0.6, 0.5], [lx, y + fh / 2, fz], { material: 'glass', glass: true }), section: id, castShadow: false });
          } else parts.push({ ...box(lid, ['front', kind], [lw - 0.6, fh - 0.6, T], [lx, y + fh / 2, fz], fl), section: id });
        }
        if (f.glass && p.light) {
          // LED strips down the inside of the glass column
          for (const sx of [-1, 1]) parts.push({ ...box(`${id}-led-${sx > 0 ? 'r' : 'l'}`, ['light', 'led'], [0.6, fh - 6, 0.8], [cx + sx * (cw / 2 - T - 0.5), y + fh / 2, D - 3], { color: '#fff4e0' }), castShadow: false, emit: { color: '#ffd9a8', intensity: 3, kind: 'area' } });
        }
        if (p.fluted && kind !== 'drawer') {
          // vertical ribs over the front (fluted / reeded doors)
          const n = Math.max(3, Math.round((cw - 2) / 3.4));
          const r = (cw - 2) / n / 2;
          for (let q = 0; q < n; q++) parts.push({ ...cyl(`${id}-rib-${q}`, ['front', 'rib'], r, fh - 3, [cx - (cw - 2) / 2 + (q + 0.5) * 2 * r, y + fh / 2, fz + T / 2 - r * 0.4], fl), section: id });
        }
        if (f.mirror) parts.push({ ...box(`${id}-mirror`, ['mirror'], [cw - 10, fh - 14, 0.4], [cx, y + fh / 2, fz + T / 2 + 0.2], { material: 'mirror' }), section: id });
        if (handles !== 'none') {
          const z = fz + T / 2 + 1 + (p.fluted ? 1.5 : 0);
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
          if (pt.tags.includes('led')) continue;
          if (kind === 'door' && leaves === 2) {
            // double doors: each leaf on its outer edge
            const left = pt.position[0] < cx;
            parts[q] = { ...pt, pivot: [cx + (left ? -cw / 2 : cw / 2), y + fh / 2, fz + T / 2] };
            opened[pt.id] = { rotation: [pt.rotation[0], pt.rotation[1] + (left ? -100 : 100), pt.rotation[2]] };
          } else if (kind === 'door') {
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

/** A mug standing on y (handle to +x). */
function mug(id: string, x: number, y: number, z: number, color: string, h = 9.5, r = 4): Part[] {
  return [
    { ...cyl(id, ['mug', 'kitchen'], r, h, [x, y + h / 2, z], { color }), castShadow: true },
    box(`${id}-handle`, ['mug', 'kitchen'], [1.2, h * 0.55, 3.4], [x + r + 0.6, y + h * 0.5, z], { color, radius: 0.5 }),
  ];
}

const PANTRY = [
  { t: 'RICE', c: '#f2efe8' }, { t: 'PASTA', c: '#e9c46a' }, { t: 'LENTILS', c: '#c8642e' }, { t: 'COFFEE', c: '#3a2618' },
  { t: 'OATS', c: '#d9c4a0' }, { t: 'SUGAR', c: '#f7f5f0' }, { t: 'BEANS', c: '#7a2e2e' }, { t: 'COUSCOUS', c: '#e3c27a' },
];

/** Things on a kitchen shelf, in a row `w` wide centred on x, standing on y, back of the shelf at z 0, `d` deep. */
function shelfGroup(kind: string, id: string, x: number, y: number, w: number, d: number, rand: () => number, colors: string[]): Part[] {
  const out: Part[] = [];
  const zc = d / 2 + 0.5;
  if (kind === 'cups') {
    const n = Math.max(2, Math.floor(w / 11));
    for (let i = 0; i < n; i++) out.push(...mug(`${id}-mug-${i}`, x - w / 2 + 5 + (i * (w - 10)) / Math.max(n - 1, 1), y, zc + (i % 2 ? 2 : -1), colors[i % colors.length]));
  } else if (kind === 'jars') {
    const n = Math.max(2, Math.floor(w / 13));
    for (let i = 0; i < n; i++) {
      const jx = x - w / 2 + 6.5 + (i * (w - 13)) / Math.max(n - 1, 1);
      const p = PANTRY[Math.floor(rand() * PANTRY.length)];
      const h = 15 + (i % 3) * 3;
      const fill = h * (0.55 + rand() * 0.3);
      out.push(cyl(`${id}-jar-${i}`, ['jar', 'pantry', 'glass'], 5.6, h, [jx, y + h / 2, zc], { material: 'glass', glass: true }));
      out.push({ ...cyl(`${id}-jar-${i}-in`, ['jar', 'pantry'], 5.1, fill, [jx, y + 0.4 + fill / 2, zc], { color: p.c }), label: { text: p.t, size: 0.9, offset: [0, fill / 2 - 3], color: '#2b2b2b', bg: '#f4efe6' } });
      out.push(cyl(`${id}-jar-${i}-lid`, ['jar', 'pantry'], 5.8, 2.2, [jx, y + h + 1.1, zc], { material: 'wood-oak-light' }));
    }
  } else if (kind === 'bottles') {
    const n = Math.max(2, Math.floor(w / 9));
    for (let i = 0; i < n; i++) {
      const bx = x - w / 2 + 4.5 + (i * (w - 9)) / Math.max(n - 1, 1);
      const h = 18 + (i % 2) * 5;
      out.push(cyl(`${id}-bottle-${i}`, ['bottle', 'kitchen'], 3.4, h, [bx, y + h / 2, zc], { color: ['#6b7a2a', '#8a5a2a', '#3a4a2a'][i % 3], glass: true }));
      out.push(cyl(`${id}-bottle-${i}-neck`, ['bottle', 'kitchen'], 1.2, 6, [bx, y + h + 3, zc], { color: '#4a5a2a', glass: true }));
      out.push(cyl(`${id}-bottle-${i}-cap`, ['bottle', 'kitchen'], 1.4, 1.6, [bx, y + h + 6.8, zc], { color: '#1d1d1f' }));
    }
  } else if (kind === 'plates') {
    // plates standing on edge against the wall, behind a little rail
    for (let i = 0; i < 4; i++) out.push({ ...cyl(`${id}-plate-${i}`, ['plate', 'kitchen'], 12, 1.1, [x - 4.5 + i * 3, y + 12.2, 4 + i * 0.3], { color: colors[(i + 1) % colors.length] }), rotation: [80, 0, 0] });
    out.push(box(`${id}-plate-rail`, ['rail'], [Math.min(w, 34), 1, 1], [x, y + 4, 9], { color: '#1d1d1f', radius: 0.3 }));
  } else if (kind === 'bowls') {
    for (let i = 0; i < 3; i++) out.push(cyl(`${id}-bowl-${i}`, ['bowl', 'kitchen'], 8 - i * 1.2, 4, [x, y + 2 + i * 3.4, zc], { color: colors[i % colors.length] }));
  } else if (kind === 'teapot') {
    out.push(ell(`${id}-pot`, ['teapot', 'kitchen'], [15, 11, 13], [x, y + 5.5, zc], { color: colors[0] }));
    out.push({ ...box(`${id}-spout`, ['teapot', 'kitchen'], [7, 1.8, 1.8], [x + 9, y + 7, zc], { color: colors[0], radius: 0.8 }), rotation: [0, 0, 30] });
    out.push(cyl(`${id}-knob`, ['teapot', 'kitchen'], 1.4, 2, [x, y + 12, zc], { color: '#1d1d1f' }));
  } else if (kind === 'whisky' || kind === 'games') {
    // display shelf: bottles with tumblers, or a stack of board games
    out.push(...(kind === 'whisky' ? whiskyRow : gameStack)(id, x, y, 1, w, d - 1, 32));
  } else if (kind === 'plant' || kind === 'herbs') {
    const pd = kind === 'plant' ? 12 : 10;
    const pl = plant(kind === 'plant'
      ? { kind: 'trailing', height: 40, spread: pd, potDiameter: pd, potColor: colors[0], drop: d - pd / 2, seed: id }
      : { kind: 'bush', height: 20, spread: 14, potDiameter: pd, potColor: '#c8734a', seed: id });
    out.push(...pl.map((pt) => ({ ...pt, id: `${id}-${pt.id}`, position: [pt.position[0] + x, pt.position[1] + y, pt.position[2] + (kind === 'plant' ? 0.5 : zc - 7)] as Vec3 })));
  }
  return out;
}

/**
 * Small floating kitchen wall shelf (IKEA BERGSHULT / BURHULT style: a board on brackets, screwed up in 10 minutes).
 * Origin = back-centre of the shelf's underside on the wall. params: width, depth (20), thickness, material/color,
 * brackets (black | brass | white | hidden), contents (space separated groups left→right: cups | jars | bottles |
 * plates | bowls | teapot | plant | herbs | whisky | games | -), colors (comma separated, for cups / bowls / plates / pots).
 */
export function kitchenShelf(p: Record<string, unknown>): Part[] {
  const W = num(p.width, 80);
  const D = num(p.depth, 20);
  const T = num(p.thickness, 2.5);
  const wood = look(p, '', 'wood-oak-light');
  const br = str(p.brackets, 'black');
  const parts: Part[] = [box('board', ['shelf'], [W, T, D], [0, T / 2, D / 2], wood)];
  if (br !== 'hidden') {
    const c = { color: br === 'brass' ? '#b08d3c' : br === 'white' ? '#f2f0ec' : '#1d1d1f' };
    for (const sx of [-1, 1]) {
      const x = sx * (W / 2 - Math.min(12, W * 0.15));
      parts.push(box(`bracket-${sx > 0 ? 'r' : 'l'}-v`, ['bracket'], [2, 14, 0.6], [x, -7, 0.3], { ...c, radius: 0.2 }));
      parts.push(box(`bracket-${sx > 0 ? 'r' : 'l'}-h`, ['bracket'], [2, 0.6, D - 3], [x, -0.3, (D - 3) / 2], { ...c, radius: 0.2 }));
    }
  }
  const groups = str(p.contents, 'cups jars').split(/\s+/).filter(Boolean);
  const colors = str(p.colors, '#f2efe8,#c8c2b6,#3a3a3a').split(',').map((c) => c.trim());
  const rand = rng(String(p.seed ?? 'kshelf'));
  const gw = (W - 4) / Math.max(groups.length, 1);
  groups.forEach((g, i) => {
    if (g === '-') return;
    parts.push(...shelfGroup(g, `g${i + 1}`, -W / 2 + 2 + gw * (i + 0.5), T, gw - 2, D, rand, colors));
  });
  return parts;
}

/**
 * Kitchen wall rail (IKEA HULTARP / KUNGSFORS style) with S-hooks: mugs, utensils, little herb buckets or a tea towel.
 * Origin = back-centre at the rail height. params: width, color (rail: stainless | black | brass), hang (space
 * separated, left→right: mug | ladle | spatula | whisk | herbs | towel), colors.
 */
export function kitchenRail(p: Record<string, unknown>): Part[] {
  const W = num(p.width, 60);
  const rc = str(p.color, 'stainless');
  const rail: Extra = rc === 'stainless' ? { material: 'stainless' } : { color: rc === 'black' ? '#1d1d1f' : rc === 'brass' ? '#b08d3c' : rc };
  const parts: Part[] = [
    { ...cyl('rail', ['rail'], 0.8, W, [0, 0, 3], rail), rotation: [0, 0, 90] },
    cyl('end-l', ['rail'], 1.4, 3, [-W / 2 + 1, 0, 1.5], rail),
    cyl('end-r', ['rail'], 1.4, 3, [W / 2 - 1, 0, 1.5], rail),
  ];
  for (const sx of [-1, 1]) parts[parts.length - (sx < 0 ? 2 : 1)] = { ...parts[parts.length - (sx < 0 ? 2 : 1)], rotation: [90, 0, 0] };
  const hang = str(p.hang, 'mug mug ladle spatula').split(/\s+/).filter(Boolean);
  const colors = str(p.colors, '#f2efe8,#3a3a3a,#c8c2b6').split(',').map((c) => c.trim());
  const step = (W - 8) / Math.max(hang.length, 1);
  hang.forEach((h, i) => {
    const x = -W / 2 + 4 + step * (i + 0.5);
    const id = `h${i + 1}`;
    parts.push(box(`${id}-hook`, ['hook'], [0.4, 5, 0.4], [x, -2.2, 3.2], { ...rail, radius: 0 }));
    if (h === 'mug') {
      // hangs by its handle, upside down-ish
      parts.push({ ...cyl(`${id}-mug`, ['mug', 'kitchen'], 4, 9.5, [x, -10, 6], { color: colors[i % colors.length] }), rotation: [0, 0, 8] });
      parts.push(box(`${id}-mug-handle`, ['mug', 'kitchen'], [3.4, 1.2, 1.2], [x, -5, 3.6], { color: colors[i % colors.length], radius: 0.4 }));
    } else if (h === 'ladle' || h === 'spatula' || h === 'whisk') {
      const steel = { material: 'stainless' };
      parts.push(box(`${id}-handle`, ['utensil', 'kitchen'], [1.4, 22, 0.6], [x, -15, 3.4], { ...(h === 'spatula' ? { color: '#1d1d1f' } : steel), radius: 0.3 }));
      if (h === 'ladle') parts.push(ell(`${id}-head`, ['utensil', 'kitchen'], [8, 3.5, 8], [x, -27, 5], steel));
      else if (h === 'spatula') parts.push(box(`${id}-head`, ['utensil', 'kitchen'], [7, 9, 0.5], [x, -30, 3.4], { color: '#1d1d1f', radius: 0.5 }));
      else parts.push(ell(`${id}-head`, ['utensil', 'kitchen'], [5, 11, 5], [x, -31, 3.6], steel));
    } else if (h === 'herbs') {
      parts.push(cyl(`${id}-bucket`, ['herbs', 'kitchen'], 5, 9, [x, -10, 6], { ...rail }));
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        const lf = ell(`${id}-leaf-${k}`, ['leaves', 'herbs'], [3, 0.6, 4.5], [x + Math.cos(a) * 2.5, -3 + (k % 3), 6 + Math.sin(a) * 2.5], { color: k % 2 ? '#4f7a3a' : '#6b8f4a' });
        lf.rotation = [-50, (-a * 180) / Math.PI, 0];
        parts.push(lf);
      }
    } else if (h === 'towel') {
      parts.push(box(`${id}-towel`, ['towel', 'kitchen'], [16, 28, 0.6], [x, -14, 4.2], { color: colors[i % colors.length], material: 'linen-white', radius: 0.3 }));
    }
  });
  return parts;
}

/**
 * What stands with the TV, like our setup now: a pair of compact black speakers at the two ends of the TV unit (turned
 * in a little), a flat media box in front of the TV feet and a small smart display at one end. Origin = back-centre
 * of the unit's top. params: width (the unit), depth, speakers (true), box (true), display (left | right | none), gap
 * (where the TV's feet start, from the wall: the box stands in front of them).
 */
export function tvGear(p: Record<string, unknown>): Part[] {
  const W = num(p.width, 180);
  const D = num(p.depth, 40);
  const black = { color: '#1d1d1f' };
  const parts: Part[] = [];
  if (p.speakers !== false) {
    const [sw, sh, sd] = [16, 24, 20];
    for (const sx of [-1, 1]) {
      const x = sx * (W / 2 - sw / 2 - 1);
      const z = D - sd / 2 - 2;
      const yaw = -sx * 10; // turned in towards the middle of the room
      const k = sx > 0 ? 'r' : 'l';
      const turn = (pt: Part): Part => {
        const dx = pt.position[0] - x;
        const dz = pt.position[2] - z;
        const r = (yaw * Math.PI) / 180;
        return { ...pt, position: [x + dx * Math.cos(r) + dz * Math.sin(r), pt.position[1], z - dx * Math.sin(r) + dz * Math.cos(r)], rotation: [pt.rotation[0], pt.rotation[1] + yaw, pt.rotation[2]] };
      };
      [
        box(`speaker-${k}`, ['speaker'], [sw, sh, sd], [x, sh / 2, z], { ...black, radius: 0.6 }),
        { ...cyl(`speaker-${k}-woofer`, ['speaker'], 5.2, 0.8, [x, 8.5, z + sd / 2 + 0.2], { color: '#2e2e30' }), rotation: [90, 0, 0] as Vec3 },
        { ...cyl(`speaker-${k}-cone`, ['speaker'], 2, 0.9, [x, 8.5, z + sd / 2 + 0.4], { color: '#4a4a4c' }), rotation: [90, 0, 0] as Vec3 },
        { ...cyl(`speaker-${k}-tweeter`, ['speaker'], 1.7, 0.8, [x, 18.5, z + sd / 2 + 0.2], { color: '#3a3a3c' }), rotation: [90, 0, 0] as Vec3 },
      ].forEach((pt) => parts.push(turn(pt)));
    }
  }
  if (p.box !== false) {
    const bz = Math.min(D - 8, num(p.gap, 6) + 30);
    parts.push(box('media-box', ['electronics'], [24, 4.5, 15], [0, 2.25, bz], { ...black, radius: 0.8 }));
    parts.push({ ...box('media-box-led', ['electronics'], [0.8, 0.4, 0.2], [9, 2.5, bz + 7.6], { color: '#7fd1ff' }), castShadow: false });
  }
  const disp = str(p.display, 'right');
  if (disp !== 'none') {
    const sx = disp === 'left' ? -1 : 1;
    const x = sx * (W / 2 - 30);
    const z = D - 8;
    parts.push({ ...box('display', ['electronics', 'smart display'], [15, 9.5, 6], [x, 4.75, z], { ...black, radius: 1.5 }), rotation: [-12, -sx * 15, 0] });
    parts.push({ ...box('display-screen', ['electronics', 'smart display'], [12, 6.5, 0.2], [x - sx * 0.8, 5.6, z + 3.1], { color: '#16324a' }), rotation: [-12, -sx * 15, 0], castShadow: false, label: { text: '20:15', size: 1.6, offset: [0, 0], color: '#e8f1ff', bg: 'none' } });
  }
  return parts;
}

/** Tami4-style water bar on the counter (~21 x 39 x 45 estimate): white body, black glass panel, nozzle, drip tray. Origin back-centre. */
export function waterBar(p: Record<string, unknown>): Part[] {
  const W = num(p.width, 21);
  const D = num(p.depth, 39);
  const H = num(p.height, 45);
  const white = { color: str(p.color, '#f2f0ec') };
  return [
    box('base', ['body'], [W - 1, 2.5, D - 2], [0, 1.25, D / 2], { color: '#3a3a3c', radius: 0.8 }),
    box('body', ['body'], [W, H - 2.5, D - 12], [0, 2.5 + (H - 2.5) / 2, (D - 12) / 2], { ...white, radius: 3 }),
    box('head', ['body'], [W, 14, 12], [0, H - 7, D - 6], { ...white, radius: 3 }),
    { ...box('panel', ['panel'], [W - 3, 11, 0.6], [0, H - 7.5, D + 0.1], { color: '#141416', radius: 0.4 }), label: { text: '22°', size: 2.2, offset: [0, 1], color: '#6fc3ff', bg: 'none' } },
    cyl('nozzle', ['nozzle'], 1.1, 3, [0, H - 15.5, D - 4], { color: '#9a9c9e' }),
    box('tray', ['tray'], [W - 4, 1.6, 11], [0, 3.3, D - 6.5], { color: '#5a5c5e', radius: 0.4 }),
    cyl('glass', ['glass'], 3.4, 10, [0, 9.1, D - 5.5], { material: 'glass', glass: true }),
  ];
}

/**
 * Entry hall stand (AliExpress, "cream white, shoe bench on the right", 80 or 100 x 30 x 200): on the left a door, a drawer,
 * a lit open niche and a lit glass display box in a gold frame on top; on the right a bench box with a door and a grey
 * seat cushion, open white slats above it with hooks (bag, umbrella) under a top cap. Gold bar handles. Origin
 * back-centre. params: width, depth, height, color, accentColor, cushionColor, niche (stuff kind), display (stuff kind).
 */
export function hallStand(p: Record<string, unknown>): WithStates {
  const W = num(p.width, 80);
  const D = num(p.depth, 30);
  const H = num(p.height, 200);
  const T = 1.8;
  const body = { color: str(p.color, '#f3efe6'), material: 'white-laminate' };
  const gold = { color: str(p.accentColor, '#c9a55a') };
  // the left column keeps its ~38-40 cm in every size; the bench part takes the rest (80 wide: 1 door, 3 slats;
  // 100 wide: double doors, 4 slats)
  const lw = Math.min(num(p.leftWidth, 40), W / 2);
  const rw = W - lw;
  const lx = -W / 2 + lw / 2;
  const rx = -W / 2 + lw + rw / 2;
  const mid = -W / 2 + lw;
  const parts: Part[] = [];
  const opened: Record<string, { rotation?: Vec3; position?: Vec3 }> = {};
  const fronts: string[] = [];
  // left column carcass
  parts.push(
    box('l-back', ['body'], [lw, H - 6, T], [lx, 6 + (H - 6) / 2, T / 2], body),
    box('l-side-l', ['body'], [T, H - 6, D], [-W / 2 + T / 2, 6 + (H - 6) / 2, D / 2], body),
    box('l-side-r', ['body'], [T, H - 6, D], [mid - T / 2, 6 + (H - 6) / 2, D / 2], body),
    box('plinth', ['plinth'], [W - 4, 6, D - 4], [0, 3, (D - 4) / 2], body),
  );
  const door = (id: string, x: number, w: number, y0: number, h: number, hinge: 'l' | 'r') => {
    const pv: Vec3 = [x + (hinge === 'l' ? -w / 2 : w / 2), y0 + h / 2, D];
    const ps: Part[] = [
      box(`${id}`, ['door', 'front'], [w - 0.6, h - 0.6, T], [x, y0 + h / 2, D - T / 2 + T], body),
      box(`${id}-handle`, ['handle'], [1.2, Math.min(18, h * 0.3), 1.4], [x + (hinge === 'l' ? w / 2 - 4 : -w / 2 + 4), y0 + h * 0.62, D + T + 0.8], gold),
    ].map((pt) => ({ ...pt, section: id, pivot: pv }));
    for (const pt of ps) opened[pt.id] = { rotation: [0, hinge === 'l' ? -100 : 100, 0] };
    fronts.push(id);
    parts.push(...ps);
  };
  // lower door, drawer, open lit niche, glass display box
  door('l-door', lx, lw, 6, 64, 'l');
  parts.push(box('l-shelf-1', ['shelf'], [lw - 2 * T, T, D - 2], [lx, 70 + T / 2, D / 2], body));
  const dr = [box('l-drawer', ['drawer', 'front'], [lw - 0.6, 15, T], [lx, 78.5, D + T / 2], body), box('l-drawer-pull', ['handle'], [14, 1.2, 1.4], [lx, 83, D + T + 0.8], gold)].map((pt) => ({ ...pt, section: 'l-drawer' }));
  for (const pt of dr) opened[pt.id] = { position: [pt.position[0], pt.position[1], pt.position[2] + 22] };
  fronts.push('l-drawer');
  parts.push(...dr);
  const nicheY = 86;
  const nicheH = 32;
  parts.push(box('l-niche-floor', ['shelf'], [lw - 2 * T, T, D - 1], [lx, nicheY + T / 2, D / 2], body));
  parts.push({ ...box('l-niche-led', ['light', 'led'], [lw - 8, 0.5, 1.2], [lx, nicheY + nicheH - 0.5, D - 4], { color: '#fff4e0' }), castShadow: false, emit: { color: '#ffd9a8', intensity: 4, kind: 'area' } });
  const k1 = stuffKind(str(p.niche, 'keys'));
  if (k1) parts.push(...placeStuff(stuffParts(k1, 'niche', lw - 6, D - 4, nicheH - 4), 0, [lx, nicheY + T, 2]));
  const gy = nicheY + nicheH;
  const gh = H - gy - 4;
  parts.push(box('l-box-floor', ['shelf'], [lw - 2 * T, T, D - 1], [lx, gy + T / 2, D / 2], body));
  parts.push(box('l-top', ['body'], [lw, T, D], [lx, H - 4 - T / 2, D / 2], body));
  // the gold frame round the glass box front + glass sides, a glass shelf in the middle, LED under each level
  const fb = 1.6;
  parts.push(
    box('g-frame-t', ['frame'], [lw, fb, fb], [lx, H - 4 - fb / 2, D - fb / 2], gold),
    box('g-frame-b', ['frame'], [lw, fb, fb], [lx, gy + fb / 2, D - fb / 2], gold),
    box('g-frame-l', ['frame'], [fb, gh, fb], [-W / 2 + fb / 2, gy + gh / 2, D - fb / 2], gold),
    box('g-frame-r', ['frame'], [fb, gh, fb], [mid - fb / 2, gy + gh / 2, D - fb / 2], gold),
    { ...box('g-glass', ['glass'], [lw - 2 * fb, gh - 2 * fb, 0.4], [lx, gy + gh / 2, D - 0.4], { material: 'glass', glass: true }), castShadow: false },
    box('g-shelf', ['shelf', 'glass'], [lw - 2 * T, 1, D - 3], [lx, gy + gh / 2, D / 2], { material: 'glass', glass: true }),
  );
  for (const [i, yy] of [[1, gy + gh / 2 - 0.8], [2, H - 4 - T - 0.5]] as [number, number][]) parts.push({ ...box(`g-led-${i}`, ['light', 'led'], [lw - 8, 0.5, 1.2], [lx, yy, D - 4], { color: '#fff4e0' }), castShadow: false, emit: { color: '#ffd9a8', intensity: 4, kind: 'area' } });
  const k2 = stuffKind(str(p.display, 'books'));
  if (k2) {
    parts.push(...placeStuff(stuffParts(k2, 'disp-1', lw - 6, D - 5, gh / 2 - 3), 0, [lx, gy + T, 2]));
    parts.push(...placeStuff(stuffParts('stuff', 'disp-2', lw - 6, D - 5, gh / 2 - 4), 0, [lx, gy + gh / 2 + 0.5, 2]));
  }
  // right: bench box with a door + seat cushion, slats above, hooks, top cap
  const bh = 44;
  parts.push(
    box('r-bench', ['body', 'bench'], [rw, bh - 6, D], [rx, 6 + (bh - 6) / 2, D / 2], body),
    { ...box('r-cushion', ['cushion', 'seat'], [rw - 1, 5, D - 1], [rx, bh + 2.5, D / 2], { material: 'fabric-grey', color: str(p.cushionColor, '#8e9094'), radius: 2 }) },
  );
  if (rw > 50) {
    door('r-door', rx - rw / 4, rw / 2, 6, bh - 6, 'l');
    door('r-door-2', rx + rw / 4, rw / 2, 6, bh - 6, 'r');
  } else door('r-door', rx, rw, 6, bh - 6, 'r');
  const slatH = H - bh - 5 - 4;
  const ns = rw > 50 ? 4 : 3;
  for (let i = 0; i < ns; i++) {
    const sx = rx - rw / 2 + 5 + (i * (rw - 10)) / (ns - 1);
    parts.push(box(`r-slat-${i + 1}`, ['slat'], [5, slatH, 2.2], [sx, bh + 5 + slatH / 2, 1.1], body));
    parts.push({ ...cyl(`r-hook-${i + 1}`, ['hook'], 0.5, 5, [sx, H - 26, 4], { color: '#b8b8b8' }), rotation: [70, 0, 0] });
  }
  parts.push(box('r-cap', ['body'], [rw + 2, 3, D], [rx + 1, H - 1.5, D / 2], body));
  parts.push(box('r-side', ['body'], [T, H - bh - 5, 4], [W / 2 - T / 2, bh + 5 + (H - bh - 5) / 2, 2], body));
  // a bag and an umbrella on the hooks
  const bx = rx + rw / 2 - 10;
  parts.push({ ...box('bag', ['bag'], [16, 13, 6], [bx, H - 58, 7], { color: '#c98b6b', material: 'leather-cognac', radius: 1.5 }) });
  parts.push({ ...box('bag-strap', ['bag'], [0.6, 30, 0.4], [bx, H - 38, 5], { color: '#c9a55a' }) });
  const ux = rx - rw / 2 + 6;
  parts.push({ ...cyl('umbrella', ['umbrella'], 2.6, 50, [ux, H - 56, 5], { color: '#d9cdb0' }) });
  parts.push({ ...cyl('umbrella-tip', ['umbrella'], 0.4, 8, [ux, H - 85, 5], { color: '#2a2a2a' }) });
  return {
    parts,
    states: [{ id: 'closed', name: 'Closed', parts: {} }, { id: 'open', name: 'Open', parts: opened }],
    interactions: fronts.map((part) => ({ part, action: 'cycleStates' as const })),
  };
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
