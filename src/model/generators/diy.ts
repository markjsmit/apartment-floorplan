import type { Part, PartOverride, Vec3 } from '../schema';
import type { Generated } from './index';
import { placeStuff, stuffKind, stuffParts } from './stuff';

// Self-built plywood shelving: side panels + inner uprights, evenly spaced shelves, thin back panel.
// Item convention: origin back-centre on the floor, +z out of the front.

const num = (v: unknown, d: number) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

/**
 * Params: width (x), height, depth, sections (bays side by side), shelves (inner shelves per bay, evenly spaced),
 * board (thickness, 1.8 = 18 mm plywood), back (hardboard back panel, default true), material,
 * contents: random stuff on every level (books | boxes | bins | stuff | random | ""), seed,
 * stiles (true → a square batten up the back of each upright on both sides, set `stileInset` in from the back edge; the
 * shelves are notched around them and screwed into them, which keeps the box square without a back panel), stileSize (2.5).
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
  if (params.stiles === true) {
    const sz = num(params.stileSize, 2.5);
    const z = backT + num(params.stileInset, 1) + sz / 2;
    for (let i = 0; i <= sections; i++) {
      const xu = -W / 2 + t / 2 + i * (bay + t);
      for (const side of [-1, 1]) {
        if ((i === 0 && side < 0) || (i === sections && side > 0)) continue; // outer sides: inside face only
        parts.push(box(`stile-${i}${side < 0 ? 'l' : 'r'}`, ['stile', 'batten', 'bracing'], [sz, H - 2 * t, sz], [xu + side * (t / 2 + sz / 2), H / 2, z]));
      }
    }
  }
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
 * housing (true → closet around the bed: full-height back + sides and a top board), housingHeight (224), topDepth (top board depth,
 * default = baseDepth; deeper = shelf over the desk), topExtend (extra top board on the +x side, e.g. to butt against a neighbouring
 * shelf; joined on top with two metal mending plates),
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
  const housing = params.housing === true;
  const hh = num(params.housingHeight, 224);
  const topD = num(params.topDepth, bd);
  const ext = num(params.topExtend, 0);
  const dw = num(params.deskWidth, 120);
  const dd = num(params.deskDepth, 60);
  const dh = num(params.deskHeight, 75);
  const dx = num(params.deskOffset, 0);
  const dt = 2.5;
  const t = 1.8;
  const material = String(params.material ?? 'wood-oak-light');
  const mattressColor = String(params.mattressColor ?? '#e8e6e1');
  // three sections (first click selects one): the storage base, the bed (housing + bed), the desk
  const sectionOf = (tags: string[]) => (tags[0] === 'desk' ? 'desk' : tags[0] === 'base' || tags[0] === 'pillow' ? 'base' : 'bed');
  const part = (id: string, tags: string[], size: Vec3, position: Vec3, extra: Partial<Part> = {}): Part => ({
    id, tags, geometry: { type: 'box', size }, position, rotation: [0, 0, 0], material, castShadow: true, glass: false, section: sectionOf(tags), ...extra,
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
  );
  if (housing) {
    // closet around the bed: the bed folds up between full-height sides, in front of a back panel, under a top board
    parts.push(
      part('side-left', ['housing', 'side'], [t, hh, bd], [-BW / 2 + t / 2, hh / 2, bd / 2]),
      part('side-right', ['housing', 'side'], [t, hh, bd], [BW / 2 - t / 2, hh / 2, bd / 2]),
      part('back', ['housing', 'back'], [BW - 2 * t, hh, t], [0, hh / 2, t / 2]),
      part('top', ['housing', 'top', 'shelf'], [BW + ext, t, topD], [ext / 2, hh + t / 2, topD / 2]),
    );
    if (ext > 0) {
      // flat steel mending plates screwed on top across the joint with the neighbouring shelf
      for (const [i, z] of [topD * 0.25, topD * 0.75].entries()) {
        parts.push(part(`join-plate-${i + 1}`, ['housing', 'metal', 'plate'], [12, 0.3, 4], [BW / 2 + ext, hh + t + 0.15, z], { material: 'metal-black' }));
      }
    }
  } else {
    parts.push(
      part('base-left', ['base'], [t, bh - 2 * t, bd], [-BW / 2 + t / 2, bh / 2, bd / 2]),
      part('base-right', ['base'], [t, bh - 2 * t, bd], [BW / 2 - t / 2, bh / 2, bd / 2]),
      part('base-back', ['base'], [BW - 2 * t, bh - 2 * t, 0.4], [0, bh / 2, 0.2], { material: 'white-laminate' }),
    );
  }
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

  // double-click the bed: down <-> up; double-click the desk: out <-> folded
  const interactions = [
    ...['bed-board', 'mattress'].map((p) => ({ part: p, action: 'cycleStates' as const, states: ['bed', 'folded'] })),
    { part: 'desk-top', action: 'cycleStates' as const, states: ['desk', 'folded'] },
  ];
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

/**
 * A pair of doors closing off an aisle between two Kallax rows, hinged on the outer edges, both opening inwards (-z, into
 * the aisle) so they lie along the Kallax fronts. Origin: centre of the doorway at floor level, front (+z) = room side.
 * Params: width (80, the gap), height (222, floor gap 1 cm), board (1.8), material. Double-clicking either leaf opens both.
 */
export function aisleDoors(params: Record<string, unknown>): Generated {
  const W = num(params.width, 80);
  const H = num(params.height, 222);
  const t = num(params.board, 1.8);
  const material = String(params.material ?? 'white-paint');
  const lw = W / 2 - 0.2;
  const yc = 1 + H / 2;
  const parts: Part[] = [];
  const open: Record<string, PartOverride> = {};
  for (const side of [-1, 1]) {
    const s = side < 0 ? 'left' : 'right';
    const pivot: Vec3 = [(side * W) / 2, yc, 0];
    // one section for both leaves: double-clicking either opens / closes both (and walking follows the item's state)
    const common = { rotation: [0, 0, 0] as Vec3, pivot, castShadow: true, glass: false, section: 'doors' };
    parts.push({ id: `leaf-${s}`, tags: ['door', 'leaf'], geometry: { type: 'box', size: [lw, H, t] }, position: [(side * W) / 4, yc, t / 2], material, ...common });
    parts.push({ id: `handle-${s}`, tags: ['door', 'handle'], geometry: { type: 'box', size: [1.6, 14, 2.2] }, position: [side * 4, 105, t + 1.1], color: '#b9bbbd', ...common });
    // left turns +90 (free edge to -z), right -90
    open[`leaf-${s}`] = { rotation: [0, -side * 90, 0] };
    open[`handle-${s}`] = { rotation: [0, -side * 90, 0] };
  }
  return {
    parts,
    states: [{ id: 'closed', name: 'Closed', parts: {} }, { id: 'open', name: 'Open', parts: open }],
    interactions: parts.map((p) => ({ part: p.id, action: 'cycleStates' as const })),
  };
}

/**
 * Fold-down clothes drying rack screwed to a cabinet side: a frame of rods hinged along one edge at `elevation`. fold "up"
 * (default): stored standing up against the panel (elevation .. elevation + length), folded out it sticks out
 * horizontally; fold "down": stored hanging down. `standoff` (cm) holds it off the panel, so a lower rack can be stored
 * in front of an upper one. How it's held up when out is left open (no chains modelled).
 * Params: width (60), length (50, how far it sticks out), elevation (hinge height, 150), rods (6), fold (up | down),
 * standoff (0) — or `levels`: [{ elevation, length, standoff?, fold?, rods? }] for several racks on the same panel that
 * fold out and in together (one double-click).
 */
export function dryingRack(params: Record<string, unknown>): Generated {
  const W = num(params.width, 60);
  const levels = Array.isArray(params.levels) && params.levels.length ? (params.levels as Record<string, unknown>[]) : [params];
  const metal = { color: '#d8d9db', castShadow: true, glass: false };
  const parts: Part[] = [];
  const out: Record<string, PartOverride> = {};
  levels.forEach((lv, k) => {
    const L = num(lv.length, num(params.length, 50));
    const y0 = num(lv.elevation, 150);
    const n = Math.max(2, Math.round(num(lv.rods, num(params.rods, Math.round(L / 9)))));
    const dir = (lv.fold ?? params.fold) === 'down' ? -1 : 1;
    const z = 1.5 + num(lv.standoff, num(params.standoff, 0));
    const pivot: Vec3 = [0, y0, z];
    const pre = levels.length > 1 ? `l${k + 1}-` : '';
    const p = (id: string, size: Vec3, position: Vec3, extra: Partial<Part> = {}): Part => ({
      id: pre + id, tags: ['drying rack'], geometry: { type: 'box', size }, position, rotation: [0, 0, 0], section: 'rack', ...metal, ...extra,
    });
    const frame: Part[] = [
      p('side-left', [1.6, L, 1.6], [-W / 2 + 0.8, y0 + (dir * L) / 2, z], { pivot }),
      p('side-right', [1.6, L, 1.6], [W / 2 - 0.8, y0 + (dir * L) / 2, z], { pivot }),
      p('front-bar', [W, 1.6, 1.6], [0, y0 + dir * (L - 0.8), z], { pivot }),
      ...Array.from({ length: n }, (_, i) => p(`rod-${i + 1}`, [W - 3.2, 0.8, 0.8], [0, y0 + (dir * ((i + 1) * (L - 1.6))) / (n + 1), z], { pivot })),
    ];
    parts.push(p('mount-rail', [W, 3, z - 0.3], [0, y0 - dir * 1.5, (z - 0.3) / 2], { color: '#bfc1c4' }), ...frame);
    for (const f of frame) out[f.id] = { rotation: [dir * 90, 0, 0] };
  });
  return {
    parts,
    states: [{ id: 'folded', name: 'Folded', parts: {} }, { id: 'down', name: 'Out (horizontal)', parts: out }],
    interactions: parts.filter((x) => out[x.id]).map((x) => ({ part: x.id, action: 'cycleStates' as const })),
  };
}
