import type { Part, Vec3 } from '../schema';
import { box, cyl, num, str, type Extra, type WithStates } from './builtins';
import { coat, shoeRow } from './wear';

// Bedroom furniture: an open IKEA PAX frame fitted with KOMPLEMENT pull-outs, an ENHET-style mirror cabinet with an
// open shelf column, and a wall shelf over the bed with two reading lights split by a divider.
// Item convention: origin back-centre on the floor, +z out of the front.

const WHITE: Extra = { material: 'white-laminate' };
const FOLDED = ['#e9e6df', '#2c2e33', '#7d8794', '#b9a58c', '#9aa6b5', '#5b4f47'];
const CLOTHES = ['#f1efe9', '#2e3a52', '#b9a58c', '#1f1f22', '#9aa6b5', '#7a3b3b', '#d8d2c8'];

/** Every part of a pull-out: its own section that slides `out` cm when double-clicked (each one on its own). */
function pullOut(section: string, parts: Part[], out: number): Part[] {
  return parts.map((pt) => ({ ...pt, section, open: { position: [pt.position[0], pt.position[1], pt.position[2] + out] as Vec3 } }));
}

/**
 * Open IKEA PAX frame (no doors) fitted like the IKEA showroom one, bottom → top: KOMPLEMENT pull-out shoe shelf,
 * wire basket, white drawer, drawer with a framed glass front, pull-out tray with a glass top and a felt jewellery
 * insert, a shelf, then a clothes rail with clothes on hangers. params: width (75 | 100 | 50), depth (58 | 35),
 * height (236 | 201), shelfY (122), railY (224). Double-click a pull-out to slide it out.
 */
export function paxOpen(p: Record<string, unknown>): Part[] {
  const W = num(p.width, 75);
  const D = num(p.depth, 58);
  const H = num(p.height, 236);
  const T = 1.8;
  const iw = W - 2 * T;
  const base = 6.8; // top of the bottom board (PAX stands on a 5 cm recessed base)
  const out = Math.min(D - 15, 40);
  const fz = D - 1; // pull-out fronts sit 1 cm back from the frame edge
  const parts: Part[] = [
    box('side-l', ['frame', 'pax'], [T, H, D], [-W / 2 + T / 2, H / 2, D / 2], WHITE),
    box('side-r', ['frame', 'pax'], [T, H, D], [W / 2 - T / 2, H / 2, D / 2], WHITE),
    box('top', ['frame', 'pax'], [iw, T, D], [0, H - T / 2, D / 2], WHITE),
    box('bottom', ['frame', 'pax'], [iw, T, D - 2], [0, base - T / 2, (D - 2) / 2], WHITE),
    box('base-rail', ['frame', 'plinth'], [iw, base - T, T], [0, (base - T) / 2, D - 4], WHITE),
    box('back', ['frame', 'back'], [iw, H - base - T, 0.4], [0, base + (H - base - T) / 2, 0.2], { color: '#f3f2ee' }),
  ];
  // hole rows up the inside of both sides (the PAX shelf-pin holes)
  for (const sx of [-1, 1]) for (const hz of [4, D - 4]) parts.push(box(`holes-${sx > 0 ? 'r' : 'l'}-${hz}`, ['frame'], [0.1, H - 20, 0.5], [sx * (iw / 2 - 0.05), H / 2, hz], { color: '#cfcfca', castShadow: false }));

  // KOMPLEMENT pull-out shoe shelf: two rails on runners, a stop bar at the front, shoes on it
  let y = base + 3;
  parts.push(...pullOut('shoe-shelf', [
    box('shoe-runner-l', ['shoe shelf', 'runner'], [1.2, 3, D - 6], [-iw / 2 + 0.6, y + 1.5, D / 2], { color: '#d9d9d6' }),
    box('shoe-runner-r', ['shoe shelf', 'runner'], [1.2, 3, D - 6], [iw / 2 - 0.6, y + 1.5, D / 2], { color: '#d9d9d6' }),
    box('shoe-tray', ['shoe shelf'], [iw - 3, 1, D - 8], [0, y + 0.5, D / 2], { color: '#f4f4f1' }),
    cyl('shoe-stop', ['shoe shelf', 'bar'], 0.8, iw - 3, [0, y + 6, fz - 1], { color: '#f4f4f1', rotation: [0, 0, 90] }),
    ...shoeRow('shoe-shoes', 0, y + 1, fz - 3, iw - 2, 'pax-shoes', 3),
  ], out));

  // KOMPLEMENT wire basket 16 high: white steel wire, a couple of folded sweaters in it
  y = base + 22;
  const bh = 15;
  const wire = { color: '#ecece9' };
  const basket: Part[] = [
    box('basket-floor', ['wire basket'], [iw - 3, 0.6, D - 8], [0, y + 0.3, D / 2], wire),
    box('basket-front', ['wire basket', 'front'], [iw - 3, 1.6, 1.2], [0, y + bh - 0.8, fz - 0.6], wire),
    box('basket-back', ['wire basket'], [iw - 3, bh, 0.4], [0, y + bh / 2, 4.2], { ...wire, glass: true }),
  ];
  for (const sx of [-1, 1]) basket.push(box(`basket-side-${sx > 0 ? 'r' : 'l'}`, ['wire basket'], [0.6, bh, D - 8], [sx * (iw / 2 - 1.8), y + bh / 2, D / 2], wire));
  for (let k = 1; k <= 3; k++) basket.push(cyl(`basket-wire-${k}`, ['wire basket'], 0.25, iw - 3, [0, y + (k * bh) / 4, fz - 0.6], { ...wire, rotation: [0, 0, 90] }));
  for (let k = 0; k < 2; k++) basket.push(box(`basket-sweater-${k + 1}`, ['clothes', 'folded'], [iw / 2 - 6, 9, D - 16], [(k - 0.5) * (iw / 2), y + 5.1, D / 2], { material: 'fabric-grey', color: FOLDED[k + 2] }));
  parts.push(...pullOut('wire-basket', basket, out));

  /** A KOMPLEMENT drawer 16 high (body + front); glass = framed glass front. */
  const drawer = (id: string, y0: number, glass: boolean, contents: Part[]) => {
    const h = 15.5;
    const body: Part[] = [
      box(`${id}-floor`, ['drawer'], [iw - 4, 0.8, D - 8], [0, y0 + 1, D / 2], WHITE),
      box(`${id}-side-l`, ['drawer'], [1.2, h - 3, D - 8], [-iw / 2 + 2.6, y0 + h / 2, D / 2], WHITE),
      box(`${id}-side-r`, ['drawer'], [1.2, h - 3, D - 8], [iw / 2 - 2.6, y0 + h / 2, D / 2], WHITE),
      box(`${id}-back`, ['drawer'], [iw - 4, h - 3, 1.2], [0, y0 + h / 2, 4.6], WHITE),
    ];
    if (glass) {
      const b = 2.2;
      body.push(
        box(`${id}-front`, ['drawer', 'front', 'frame'], [iw - 0.6, b, T], [0, y0 + h - b / 2, fz], WHITE),
        box(`${id}-front-b`, ['drawer', 'front', 'frame'], [iw - 0.6, b, T], [0, y0 + b / 2, fz], WHITE),
        box(`${id}-front-l`, ['drawer', 'front', 'frame'], [b, h - 2 * b, T], [-iw / 2 + 0.3 + b / 2, y0 + h / 2, fz], WHITE),
        box(`${id}-front-r`, ['drawer', 'front', 'frame'], [b, h - 2 * b, T], [iw / 2 - 0.3 - b / 2, y0 + h / 2, fz], WHITE),
        { ...box(`${id}-glass`, ['drawer', 'front', 'glass'], [iw - 2 * b - 0.6, h - 2 * b, 0.4], [0, y0 + h / 2, fz], { material: 'glass', glass: true }), castShadow: false },
      );
    } else body.push(box(`${id}-front`, ['drawer', 'front'], [iw - 0.6, h, T], [0, y0 + h / 2, fz], { material: 'white-gloss' }));
    parts.push(...pullOut(id, [...body, ...contents], out));
  };
  const folded = (id: string, y0: number, n: number, seed: number): Part[] =>
    Array.from({ length: n }, (_, k) => box(`${id}-folded-${k + 1}`, ['clothes', 'folded'], [(iw - 8) / n - 3, 7 + ((k + seed) % 3) * 1.5, D - 16], [-(iw - 8) / 2 + ((k + 0.5) * (iw - 8)) / n, y0 + 1.4 + (7 + ((k + seed) % 3) * 1.5) / 2, D / 2], { material: 'fabric-grey', color: FOLDED[(k + seed) % FOLDED.length] }));
  drawer('drawer', base + 40, false, folded('drawer', base + 40, 3, 0));
  drawer('glass-drawer', base + 57, true, folded('glass-drawer', base + 57, 3, 2));

  // KOMPLEMENT pull-out tray with a glass top over a light-grey felt jewellery insert (compartments + ring rows)
  y = base + 75;
  const th = 6;
  const tray: Part[] = [
    box('tray-floor', ['jewellery tray'], [iw - 3, 1, D - 6], [0, y + 0.5, D / 2], WHITE),
    box('tray-front', ['jewellery tray', 'front'], [iw - 1, th, T], [0, y + th / 2, fz], WHITE),
    box('tray-back', ['jewellery tray'], [iw - 3, th, 1.2], [0, y + th / 2, 3.6], WHITE),
    box('tray-side-l', ['jewellery tray'], [1.2, th, D - 6], [-iw / 2 + 2.1, y + th / 2, D / 2], WHITE),
    box('tray-side-r', ['jewellery tray'], [1.2, th, D - 6], [iw / 2 - 2.1, y + th / 2, D / 2], WHITE),
    box('tray-felt', ['jewellery tray', 'felt'], [iw - 6, 0.8, D - 10], [0, y + 1.4, D / 2], { material: 'fabric-grey', color: '#c9c5bd' }),
    { ...box('tray-glass', ['jewellery tray', 'glass'], [iw - 4, 0.5, D - 8], [0, y + th + 0.25, D / 2], { material: 'glass', glass: true }), castShadow: false },
  ];
  // dividers: two compartments on the left, ring rows on the right (like the photo)
  const split = -iw / 2 + (iw - 6) * 0.58;
  tray.push(box('tray-div-1', ['jewellery tray', 'divider'], [0.8, th - 2, D - 10], [split, y + 1.8 + (th - 2) / 2, D / 2], { color: '#bdb8b0' }));
  tray.push(box('tray-div-2', ['jewellery tray', 'divider'], [split + iw / 2 - 3, th - 2, 0.8], [(-iw / 2 + 3 + split) / 2, y + 1.8 + (th - 2) / 2, D / 2], { color: '#bdb8b0' }));
  for (let k = 0; k < 5; k++) tray.push(box(`tray-ring-row-${k + 1}`, ['jewellery tray', 'felt'], [iw / 2 - 3 - split - 2, 1.6, 2], [(split + iw / 2 - 3) / 2, y + 2.6, 10 + k * ((D - 20) / 4)], { material: 'fabric-grey', color: '#bdb8b0' }));
  tray.push(cyl('tray-watch', ['jewellery', 'watch'], 2, 0.9, [(-iw / 2 + split) / 2, y + 2.3, D / 3], { color: '#c9ccd1' }));
  tray.push(cyl('tray-bangle', ['jewellery'], 3, 0.6, [(-iw / 2 + split) / 2 + 6, y + 2.1, (2 * D) / 3], { color: '#c8a45a' }));
  parts.push(...pullOut('jewellery-tray', tray, out));

  // KOMPLEMENT shelf with a few folded things and a box
  const sy = num(p.shelfY, 122);
  parts.push(box('shelf', ['shelf'], [iw, T, D - 2], [0, sy - T / 2, (D - 2) / 2], WHITE));
  for (let k = 0; k < 2; k++) parts.push(box(`shelf-folded-${k + 1}`, ['clothes', 'folded'], [26, 12 + k * 4, D - 18], [-iw / 2 + 16 + k * 28, sy + (12 + k * 4) / 2, D / 2], { material: 'fabric-grey', color: FOLDED[(k * 3 + 1) % FOLDED.length] }));
  parts.push(box('shelf-box', ['box', 'storage box'], [14, 14, 30], [iw / 2 - 9, sy + 7, D / 2], { color: '#d9cdb8' }));

  // KOMPLEMENT clothes rail under the top, clothes on wooden hangers
  const ry = num(p.railY, 224);
  parts.push(cyl('rail', ['rail', 'clothes rail'], 1.25, iw, [0, ry, D / 2], { color: '#f4f4f1', rotation: [0, 0, 90] }));
  const n = Math.max(3, Math.floor((iw - 8) / 9));
  const lengths = [78, 92, 72, 100, 80, 70, 88];
  for (let k = 0; k < n; k++) {
    const len = Math.min(lengths[k % lengths.length], ry - sy - 26); // clear of the folded stacks on the shelf
    parts.push(...coat(`hang-${k + 1}`, -iw / 2 + 6 + ((k + 0.5) * (iw - 12)) / n, ry, D / 2, CLOTHES[k % CLOTHES.length], true, len));
  }
  return parts;
}

/**
 * IKEA ENHET-style mirror cabinet: white body, 2 frameless mirror doors over the whole front (hinged on the outer
 * edges), 2 shelves inside with toiletries; optional open shelf column beside it (`column` cm wide, `columnSide`
 * left | right, seen from the front). params: width (60), depth (17), height (75), column (0), columnSide (left),
 * shelves (2). Origin: back-centre at the bottom of the cabinet (hang it with `elevation`).
 */
export function mirrorCabinet(p: Record<string, unknown>): WithStates {
  const W = num(p.width, 60);
  const D = num(p.depth, 17);
  const H = num(p.height, 75);
  const C = num(p.column, 0);
  const side = str(p.columnSide, 'left') === 'right' ? 1 : -1;
  const T = 1.6;
  const total = W + C;
  // cabinet x range (the column takes the rest of the total width)
  const cx0 = side < 0 ? -total / 2 + C : -total / 2;
  const cx1 = cx0 + W;
  const cx = (cx0 + cx1) / 2;
  const shelves = Math.max(1, Math.round(num(p.shelves, 2)));
  const parts: Part[] = [
    box('back', ['cabinet'], [W, H, 0.8], [cx, H / 2, 0.4], WHITE),
    box('side-l', ['cabinet'], [T, H, D - 2], [cx0 + T / 2, H / 2, (D - 2) / 2], WHITE),
    box('side-r', ['cabinet'], [T, H, D - 2], [cx1 - T / 2, H / 2, (D - 2) / 2], WHITE),
    box('top', ['cabinet'], [W - 2 * T, T, D - 2], [cx, H - T / 2, (D - 2) / 2], WHITE),
    box('bottom', ['cabinet'], [W - 2 * T, T, D - 2], [cx, T / 2, (D - 2) / 2], WHITE),
  ];
  const toiletries: [number, number, string][] = [[2.2, 14, '#f4f4f2'], [1.6, 17, '#6f8fa8'], [2.6, 9, '#e0c9b4'], [1.4, 12, '#2b2b2b'], [3, 7, '#f4f4f2'], [1.8, 15, '#c46a5a']];
  for (let s = 0; s <= shelves; s++) {
    const sy = T + (s * (H - 2 * T)) / (shelves + 1);
    if (s > 0) parts.push({ ...box(`shelf-${s}`, ['shelf'], [W - 2 * T - 0.4, 0.6, D - 5], [cx, sy - 0.3, (D - 5) / 2 + 0.8], { material: 'glass', glass: true }), castShadow: false });
    // a few bottles and jars on each level
    let x = cx0 + T + 4;
    for (let k = 0; x < cx1 - T - 4 && k < 5; k++) {
      const [r, h, color] = toiletries[(k + s * 2) % toiletries.length];
      parts.push(cyl(`bottle-${s}-${k + 1}`, ['toiletries', 'contents'], r, h, [x + r, sy + h / 2, D / 2 - 1], { color }));
      x += 2 * r + 4;
    }
  }
  // doors: mirror over the whole front, the white door edge just shows
  const fz = D - 0.9;
  const open: Record<string, { rotation: Vec3 }> = {};
  const fronts: string[] = [];
  for (const [k, l] of [[0, true], [1, false]] as const) {
    const x0 = l ? cx0 : cx;
    const x1 = l ? cx : cx1;
    const pivot: Vec3 = [l ? cx0 : cx1, H / 2, D];
    const id = `door-${l ? 'l' : 'r'}`;
    const xc = (x0 + x1) / 2;
    parts.push(box(id, ['door', 'front'], [x1 - x0 - 0.4, H - 0.4, 1.4], [xc, H / 2, fz - 0.2], { ...WHITE, pivot }));
    parts.push({ ...box(`${id}-mirror`, ['door', 'mirror'], [x1 - x0 - 1, H - 1, 0.4], [xc, H / 2, fz + 0.7], { material: 'mirror', pivot }), castShadow: false });
    for (const pid of [id, `${id}-mirror`]) open[pid] = { rotation: [0, l ? -100 : 100, 0] };
    fronts.push(id, `${id}-mirror`);
    void k;
  }
  if (C > 0) {
    // open column: white frame, 2 shelves, a plant + a jar
    const ox0 = side < 0 ? -total / 2 : cx1;
    const ox = ox0 + C / 2;
    parts.push(
      box('column-back', ['open shelf'], [C, H, 0.8], [ox, H / 2, 0.4], WHITE),
      box('column-side', ['open shelf'], [T, H, D], [side < 0 ? ox0 + T / 2 : ox0 + C - T / 2, H / 2, D / 2], WHITE),
      box('column-top', ['open shelf'], [C - T, T, D], [ox + (side < 0 ? T / 2 : -T / 2), H - T / 2, D / 2], WHITE),
      box('column-bottom', ['open shelf'], [C - T, T, D], [ox + (side < 0 ? T / 2 : -T / 2), T / 2, D / 2], WHITE),
    );
    for (let s = 1; s <= 2; s++) parts.push(box(`column-shelf-${s}`, ['open shelf', 'shelf'], [C - T, T, D - 1], [ox + (side < 0 ? T / 2 : -T / 2), (s * H) / 3, (D - 1) / 2], WHITE));
    const iw = C - T - 2;
    parts.push(cyl('column-jar', ['jar', 'decor'], Math.min(iw / 2, 4), 11, [ox, T + 5.5, D / 2], { material: 'glass', glass: true }));
    parts.push(cyl('column-cotton', ['jar', 'decor'], Math.min(iw / 2, 4) - 0.6, 5, [ox, T + 3, D / 2], { color: '#f6f3ee' }));
    parts.push(cyl('column-pot', ['plant', 'pot'], Math.min(iw / 2, 4.5), 9, [ox, (2 * H) / 3 + T + 4.5, D / 2], { color: '#f4f4f2' }));
    parts.push({ id: 'column-plant', tags: ['plant'], geometry: { type: 'ellipsoid', size: [Math.min(iw, 12), 14, 12], segments: 16 }, position: [ox, (2 * H) / 3 + T + 15, D / 2], rotation: [0, 0, 0], color: '#5e7d4a', castShadow: true, glass: false });
    parts.push(box('column-towel', ['towel'], [iw - 1, 6, D - 5], [ox, H / 3 + T + 3, D / 2], { material: 'fabric-grey', color: '#e9e6df' }));
  }
  return {
    parts,
    states: [{ id: 'closed', name: 'Closed', parts: {} }, { id: 'open', name: 'Open', parts: open }],
    interactions: fronts.map((part) => ({ part, action: 'cycleStates' as const })),
  };
}

/**
 * Wall shelf over the bed: decorations on top, two reading lights underneath in the middle. A divider fin hangs
 * under the centre with one light on each face, each light tilted out towards its own side of the bed (and a bit into
 * the room), so the divider keeps it from spilling over to the other side. params: width (200), depth (22),
 * thickness (3.5), divider (14, how far the fin hangs below the shelf), tilt (25°, out to the side), lean (15°, into
 * the room), intensity (12), material (wood-oak-light), cableDrop (50, the cable cover down the wall). Origin:
 * back-centre at the bottom of the shelf board.
 */
export function bedShelf(p: Record<string, unknown>): Part[] {
  const W = num(p.width, 200);
  const D = num(p.depth, 22);
  const t = num(p.thickness, 3.5);
  const fin = num(p.divider, 14);
  const tilt = num(p.tilt, 25);
  const lean = num(p.lean, 15);
  const wood = { material: str(p.material, 'wood-oak-light') };
  const parts: Part[] = [
    { ...box('shelf', ['shelf', 'top'], [W, t, D], [0, t / 2, D / 2], wood), geometry: { type: 'box', size: [W, t, D], radius: 0.6 } },
    // hidden steel brackets (floating shelf): a slim batten on the wall under the back edge
    box('batten', ['bracket'], [W - 20, 3, 2], [0, -1.5, 1], { color: '#e9e6df' }),
    // the divider fin in the middle, the lights mounted on its two faces
    { ...box('divider', ['divider', 'light'], [2, fin, D - 2], [0, -fin / 2, (D - 2) / 2], wood), geometry: { type: 'box', size: [2, fin, D - 2], radius: 0.4 } },
    // cable from the lights through the fin to the wall, then in a white cover down to behind the headboard
    box('cable-cover', ['cable', 'cable cover'], [3, num(p.cableDrop, 50), 1.4], [0, -num(p.cableDrop, 50) / 2, 0.7], { color: '#f2f1ed' }),
  ];
  for (const s of [-1, 1]) {
    const n = s < 0 ? 'left' : 'right';
    const rot: Vec3 = [-lean, 0, s * tilt];
    // a small dark spot body on the fin face, the warm LED under it shining down-and-out on its own side
    parts.push({ ...box(`light-${n}-body`, ['light', 'reading light'], [7, 3.5, 9], [s * 5.5, -fin + 5.5, D / 2], { color: '#2a2a2a', rotation: rot }), geometry: { type: 'box', size: [7, 3.5, 9], radius: 0.6 } });
    parts.push({
      ...box(`light-${n}`, ['light', 'reading light', `${n} side`], [6, 0.8, 8], [s * 5.5, -fin + 3.4, D / 2], { color: '#fff4e0', rotation: rot }),
      castShadow: false,
      emit: { color: '#ffd9a8', intensity: num(p.intensity, 12), kind: 'area' },
    });
  }
  return parts;
}
