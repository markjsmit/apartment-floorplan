import type { Part, Vec3 } from '../schema';
import { placeStuff, stuffKind, stuffParts } from './stuff';

// Self-built plywood shelving: side panels + inner uprights, evenly spaced shelves, thin back panel.
// Item convention: origin back-centre on the floor, +z out of the front.

const num = (v: unknown, d: number) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

/**
 * Params: width (x), height, depth, sections (bays side by side), shelves (inner shelves per bay, evenly spaced),
 * board (thickness, 1.8 = 18 mm plywood), back (hardboard back panel, default true), material,
 * contents: random stuff on every level (books | boxes | bins | stuff | random | ""), seed.
 */
export function plywoodShelving(params: Record<string, unknown>): Part[] {
  const W = num(params.width, 120);
  const H = num(params.height, 200);
  const D = num(params.depth, 20);
  const sections = Math.max(1, Math.round(num(params.sections, 2)));
  const shelves = Math.max(0, Math.round(num(params.shelves, 4)));
  const t = num(params.board, 1.8);
  const back = params.back !== false;
  const backT = back ? 0.4 : 0;
  const material = String(params.material ?? 'birch-ply');
  const box = (id: string, tags: string[], size: Vec3, position: Vec3): Part => ({
    id, tags, geometry: { type: 'box', size }, position, rotation: [0, 0, 0], material, castShadow: true, glass: false,
  });

  const d = D - backT; // boards sit in front of the back panel
  const zc = backT + d / 2;
  const bay = (W - (sections + 1) * t) / sections;
  const parts: Part[] = [];
  for (let i = 0; i <= sections; i++) {
    const x = -W / 2 + t / 2 + i * (bay + t);
    parts.push(box(i === 0 || i === sections ? `side-${i}` : `upright-${i}`, ['upright'], [t, H, d], [x, H / 2, zc]));
  }
  const inner = H - 2 * t;
  const step = (inner - shelves * t) / (shelves + 1);
  for (let s = 0; s < sections; s++) {
    const x = -W / 2 + t + s * (bay + t) + bay / 2;
    parts.push(box(`bottom-${s + 1}`, ['shelf', 'bottom'], [bay, t, d], [x, t / 2, zc]));
    parts.push(box(`top-${s + 1}`, ['shelf', 'top'], [bay, t, d], [x, H - t / 2, zc]));
    for (let k = 1; k <= shelves; k++) {
      const y = t + k * step + (k - 1) * t + t / 2;
      parts.push(box(`shelf-${s + 1}-${k}`, ['shelf'], [bay, t, d], [x, y, zc]));
    }
    const kind = stuffKind(params.contents);
    if (kind) {
      for (let k = 0; k <= shelves; k++) {
        const y = t + k * (step + t);
        const inside = stuffParts(kind, `bay-${s + 1}-${k}-${String(params.seed ?? '')}`, bay - 0.4, d, step);
        parts.push(...placeStuff(inside, 0, [x, y, backT]));
      }
    }
  }
  if (back) parts.push({ ...box('back', ['back panel'], [W, H, backT], [0, H / 2, backT / 2]), material: 'white-laminate' });
  return parts;
}

/**
 * T-shaped bridge shelf across an aisle between two KALLAX units: a board over the aisle plus a tongue on each side
 * that slides all the way into a cube (lying flat on the cube floor). Origin: back-centre of the aisle board
 * (back = against the wall). Params: aisle (width), depth, tongueLength (39 = KALLAX depth), tongueWidth (33.2,
 * fits the 33.5 cube), tongueOffset (from the back to the tongue's edge; 4.4 = KALLAX outer board + play), board, material,
 * contents (random stuff on the board and in both cubes: books | boxes | bins | stuff | random), clearance (free height
 * above the board), cubeHeight (inside height of the cubes, 33.5), seed.
 */
export function bridgeShelf(params: Record<string, unknown>): Part[] {
  const W = num(params.aisle, 80);
  const D = num(params.depth, 38);
  const L = num(params.tongueLength, 39);
  const T = num(params.tongueWidth, 33.2);
  const off = num(params.tongueOffset, 4.4);
  const t = num(params.board, 1.8);
  const material = String(params.material ?? 'birch-ply');
  const box = (id: string, size: Vec3, position: Vec3): Part => ({
    id, tags: ['shelf'], geometry: { type: 'box', size }, position, rotation: [0, 0, 0], material, castShadow: true, glass: false,
  });
  const parts = [
    box('aisle', [W, t, D], [0, t / 2, D / 2]),
    box('tongue-left', [L, t, T], [-W / 2 - L / 2, t / 2, off + T / 2]),
    box('tongue-right', [L, t, T], [W / 2 + L / 2, t / 2, off + T / 2]),
  ];
  const kind = stuffKind(params.contents);
  if (kind) {
    const seed = String(params.seed ?? '');
    // on the aisle board, fronts facing out of the wall (+z)
    parts.push(...placeStuff(stuffParts(kind, `aisle-${seed}`, W - 1, D - 1, num(params.clearance, 33)), 0, [0, t, 0]));
    // inside each cube on the tongues, facing the aisle: the cube's back is the tongue's far end
    const cubeH = num(params.cubeHeight, 33.5) - t;
    parts.push(...placeStuff(stuffParts(kind, `right-${seed}`, T - 0.6, L - 1.5, cubeH), 3, [W / 2 + L, t, off + T / 2]));
    parts.push(...placeStuff(stuffParts(kind, `left-${seed}`, T - 0.6, L - 1.5, cubeH), 1, [-W / 2 - L, t, off + T / 2]));
  }
  return parts;
}
