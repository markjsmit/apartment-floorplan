import type { Part, PartOverride, Vec3 } from '../schema';
import type { Generated } from './index';
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

/**
 * Wall bed (Murphy style) on a low storage base, with a fold-down desk hinged on the bed's underside.
 * Origin: back-centre on the floor at the wall; local x along the wall, +z into the room.
 * States: desk (bed up, desk out — default), folded (bed up, desk locked up against the bed), bed (bed down, desk underneath).
 * Params: bedWidth (140), bedLength (190), body (board + frame thickness, 12), mattress (18), baseHeight (35), baseDepth (50),
 * hinge (z of the bed hinge, default = baseDepth; body + mattress = everything folds within the base depth),
 * deskWidth (120), deskDepth (60), deskHeight (75), deskOffset (x of the desk centre along the wall, 0 = middle),
 * material (wood), mattressColor.
 */
export function wallBedDesk(params: Record<string, unknown>): Generated {
  const W = num(params.bedWidth, 140);
  const L = num(params.bedLength, 190);
  const Tb = num(params.body, 12);
  const M = num(params.mattress, 18);
  const bh = num(params.baseHeight, 35);
  const bd = num(params.baseDepth, 50);
  // hinge line (z) of the bed: at the base front by default; further back lets the folded-up stack stay within the base depth
  const h = num(params.hinge, bd);
  const dw = num(params.deskWidth, 120);
  const dd = num(params.deskDepth, 60);
  const dh = num(params.deskHeight, 75);
  const dx = num(params.deskOffset, 0);
  const dt = 2.5;
  const t = 1.8;
  const material = String(params.material ?? 'wood-oak-light');
  const mattressColor = String(params.mattressColor ?? '#e8e6e1');
  const part = (id: string, tags: string[], size: Vec3, position: Vec3, extra: Partial<Part> = {}): Part => ({
    id, tags, geometry: { type: 'box', size }, position, rotation: [0, 0, 0], material, castShadow: true, glass: false, ...extra,
  });
  const BW = W + 2 * t; // base outer width
  const parts: Part[] = [];
  const desk: Record<string, PartOverride> = {};
  const folded: Record<string, PartOverride> = {};
  const bed: Record<string, PartOverride> = {};

  // base: open cubbies for pillows and bedding, facing the room
  parts.push(
    part('base-top', ['base'], [BW, t, bd], [0, bh - t / 2, bd / 2]),
    part('base-bottom', ['base'], [BW, t, bd], [0, t / 2, bd / 2]),
    part('base-left', ['base'], [t, bh - 2 * t, bd], [-BW / 2 + t / 2, bh / 2, bd / 2]),
    part('base-right', ['base'], [t, bh - 2 * t, bd], [BW / 2 - t / 2, bh / 2, bd / 2]),
    part('base-back', ['base'], [BW - 2 * t, bh - 2 * t, 0.4], [0, bh / 2, 0.2], { material: 'white-laminate' }),
  );
  const cub = (BW - 4 * t) / 3;
  for (let i = 1; i <= 2; i++) parts.push(part(`base-divider-${i}`, ['base'], [t, bh - 2 * t, bd - 1], [-BW / 2 + t + i * (cub + t) - t / 2, bh / 2, (bd - 1) / 2]));
  for (let i = 0; i < 3; i++) {
    const x = -BW / 2 + t + cub / 2 + i * (cub + t);
    parts.push(part(`pillow-${i + 1}`, ['pillow', 'bedding'], [cub - 4, bh - 2 * t - 6, bd - 8], [x, t + (bh - 2 * t - 6) / 2, (bd - 8) / 2 + 2], {
      material: undefined, color: ['#f4f2ec', '#dfe6ee', '#ece4d6'][i],
    }));
  }

  // bed (up pose = part pose): hinge along the base's front top edge; "bed" turns it +90° about x into the room
  const pivot: Vec3 = [0, bh, h];
  parts.push(
    part('bed-board', ['bed', 'board'], [W, Tb, L], [0, bh + L / 2, h - Tb / 2], { pivot, rotation: [-90, 0, 0] }),
    part('mattress', ['bed', 'mattress'], [W - 2, M, L - 2], [0, bh + L / 2, h - Tb - M / 2], { pivot, rotation: [-90, 0, 0], material: undefined, color: mattressColor }),
    part('bed-lock', ['bed', 'lock'], [6, 6, 3], [W / 2 - 6, bh + L - 8, h + 1.5], { pivot, rotation: [-90, 0, 0], material: undefined, color: '#3a3a3a' }),
  );
  // boxes are sized lying down (width, thickness, length); -90° about x stands them up, "bed" turns them back flat
  for (const id of ['bed-board', 'mattress', 'bed-lock']) bed[id] = { rotation: [0, 0, 0] };
  // bed legs (fold down by gravity): down = vertical on the floor; up = folded flat against the board
  const legAt = [L - 6, L / 2];
  legAt.forEach((zl, i) => {
    for (const side of [-1, 1]) {
      const id = `bed-leg-${i + 1}${side < 0 ? 'l' : 'r'}`;
      const x = side * (W / 2 - 2);
      parts.push(part(id, ['bed', 'leg'], [4, bh, 4], [x, bh + zl - bh / 2, h + 2]));
      bed[id] = { position: [x, bh / 2, h + zl] };
    }
  });

  // desk (out = part pose), hinged on the bed's underside at desk height
  parts.push(part('desk-top', ['desk', 'desktop'], [dw, dt, dd], [dx, dh - dt / 2, h + dd / 2]));
  const deskFoldedCentre: Vec3 = [dx, dh + dd / 2, h + dt / 2];
  folded['desk-top'] = { position: deskFoldedCentre, rotation: [-90, 0, 0] };
  // bed: folded desk turned with the bed about the bed hinge
  const turn = ([x, y, z]: Vec3): Vec3 => [x, bh - (z - h), h + (y - bh)];
  bed['desk-top'] = { position: turn(deskFoldedCentre), rotation: [0, 0, 0] };
  const legH = dh - dt;
  for (const side of [-1, 1]) {
    const id = `desk-leg-${side < 0 ? 'l' : 'r'}`;
    const x = dx + side * (dw / 2 - 4);
    parts.push(part(id, ['desk', 'leg'], [4, legH, 4], [x, legH / 2, h + dd - 4]));
    const foldedLeg: Vec3 = [x, dh + dd - 4 - legH / 2, h + dt + 2.5];
    folded[id] = { position: foldedLeg };
    bed[id] = { position: turn(foldedLeg), rotation: [90, 0, 0] };
  }

  const interactions = ['bed-board', 'mattress', 'desk-top'].map((p) => ({ part: p, action: 'cycleStates' as const }));
  return {
    parts,
    states: [
      { id: 'desk', name: 'Desk out (bed up)', parts: desk },
      { id: 'folded', name: 'Desk folded (bed up)', parts: folded },
      { id: 'bed', name: 'Guest bed (down)', parts: bed },
    ],
    interactions,
  };
}
