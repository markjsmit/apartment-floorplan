import type { AssetState, FurnitureAsset, Part, PartOverride, Vec3 } from '../schema';

// Built-in fixtures that come with an apartment: kitchen runs, island, tall units, wall cabinets, soffits,
// pillars, sliding balcony doors, track lights. Item convention: origin back-centre on the floor, +z out of the front.

export type WithStates = { parts: Part[]; states: AssetState[]; interactions: FurnitureAsset['interactions'] };

export type Extra = Partial<Pick<Part, 'material' | 'color' | 'pivot' | 'castShadow' | 'glass' | 'rotation'>>;

export function box(id: string, tags: string[], size: Vec3, position: Vec3, extra: Extra = {}): Part {
  return { id, tags, geometry: { type: 'box', size }, position, rotation: [0, 0, 0], castShadow: true, glass: false, ...extra };
}

export function cyl(id: string, tags: string[], radius: number, height: number, position: Vec3, extra: Extra = {}): Part {
  return {
    id, tags, geometry: { type: 'cylinder', radius, height, segments: 24 }, position, rotation: [0, 0, 0], castShadow: true, glass: false, ...extra,
  };
}

export const num = (v: unknown, d: number) => (v === undefined || v === null || v === '' ? d : Number(v));
export const str = (v: unknown, d: string) => (typeof v === 'string' && v ? v : d);

export const FRONT_T = 1.8; // door / drawer front thickness
export const GAP = 0.3; // gap between fronts
export const PLINTH = 10;
export const HANDLE = 'stainless';

/** Plain box (pillar, soffit, wall finish band, AC grille, ...). */
export function plainBox(params: Record<string, unknown>): Part[] {
  const w = num(params.width, 100);
  const h = num(params.height, 100);
  const d = num(params.depth, 100);
  const extra: Extra = params.color ? { color: String(params.color) } : { material: str(params.material, 'white-paint') };
  return [box('box', [], [w, h, d], [0, h / 2, d / 2], extra)];
}

type Module = { w: number; kind: string; handle?: string };

function modules(raw: unknown, total: number): Module[] {
  const list = Array.isArray(raw) ? (raw as Record<string, unknown>[]).map((m) => ({ w: num(m.w, 60), kind: str(m.kind, 'door'), handle: m.handle as string | undefined })) : [];
  if (list.length) return list;
  const n = Math.max(1, Math.round(total / 60));
  return Array.from({ length: n }, () => ({ w: total / n, kind: 'door' }));
}

/** Fronts (doors / drawers / appliance panels) for one module, x0 = left edge, between y0 and y1, front face at z. */
function fronts(prefix: string, m: Module, x0: number, y0: number, y1: number, z: number, horizontalHandles: boolean): Part[] {
  const out: Part[] = [];
  const w = m.w - 2 * GAP;
  const xc = x0 + m.w / 2;
  const zc = z - FRONT_T / 2;
  const bar = (id: string, cx: number, cy: number, len: number, vertical = false) =>
    box(id, ['handle'], vertical ? [1.2, len, 1.6] : [len, 1.2, 1.6], [cx, cy, z + 0.8], { material: HANDLE });
  const h = y1 - y0;
  if (m.kind === 'drawers' || m.kind === 'drawers2' || m.kind === 'drawers3' || m.kind === 'drawers4') {
    const n = m.kind === 'drawers' ? 3 : Number(m.kind.slice(-1));
    const fh = (h - (n + 1) * GAP) / n;
    for (let i = 0; i < n; i++) {
      const top = y1 - GAP - i * (fh + GAP);
      out.push(box(`${prefix}-drawer-${i + 1}`, ['drawer', 'front'], [w, fh, FRONT_T], [xc, top - fh / 2, zc], { material: 'white-gloss' }));
      out.push(bar(`${prefix}-drawer-${i + 1}-handle`, xc, top - 4, w - 12));
    }
  } else if (m.kind === 'doors' || m.kind === 'sink') {
    const dw = (m.w - 3 * GAP) / 2;
    for (const [i, side] of [[0, 'l'], [1, 'r']] as const) {
      const cx = x0 + GAP + dw / 2 + i * (dw + GAP);
      out.push(box(`${prefix}-door-${side}`, ['door', 'front'], [dw, h - 2 * GAP, FRONT_T], [cx, y0 + h / 2, zc], { material: 'white-gloss' }));
      out.push(horizontalHandles ? bar(`${prefix}-door-${side}-handle`, cx, y1 - 5, dw - 10) : bar(`${prefix}-door-${side}-handle`, i === 0 ? cx + dw / 2 - 4 : cx - dw / 2 + 4, y1 - 25, 30, true));
    }
  } else if (m.kind === 'dishwasher') {
    out.push(box(`${prefix}-dishwasher`, ['dishwasher', 'appliance', 'front'], [w, h - 2 * GAP, FRONT_T], [xc, y0 + h / 2, zc], { material: 'white-gloss' }));
    out.push(bar(`${prefix}-dishwasher-handle`, xc, y1 - 5, w - 12));
  } else if (m.kind === 'panel' || m.kind === 'open') {
    if (m.kind === 'panel') out.push(box(`${prefix}-panel`, ['front'], [w, h - 2 * GAP, FRONT_T], [xc, y0 + h / 2, zc], { material: 'white-gloss' }));
  } else {
    // single door, hinge on the side opposite the handle
    out.push(box(`${prefix}-door`, ['door', 'front'], [w, h - 2 * GAP, FRONT_T], [xc, y0 + h / 2, zc], { material: 'white-gloss' }));
    const right = (m.handle ?? 'right') === 'right';
    out.push(horizontalHandles ? bar(`${prefix}-door-handle`, xc, y1 - 5, w - 12) : bar(`${prefix}-door-handle`, right ? x0 + m.w - 4 : x0 + 4, y0 + Math.min(h / 2, 110), Math.min(h * 0.6, 90), true));
  }
  return out;
}

/** Double-bowl inset sink + pull-down faucet, centred at x, back of the worktop at z = 0, worktop surface at y. */
function sink(x: number, y: number, depth: number, width: number): Part[] {
  const sz = depth / 2 + 1;
  const bw = (width - 8) / 2;
  return [
    box('sink-rim', ['sink'], [width, 0.4, 46], [x, y + 0.2, sz], { material: 'stainless' }),
    box('sink-bowl-l', ['sink'], [bw, 0.2, 38], [x - bw / 2 - 2, y + 0.5, sz + 1], { color: '#7d8084', castShadow: false }),
    box('sink-bowl-r', ['sink'], [bw, 0.2, 38], [x + bw / 2 + 2, y + 0.5, sz + 1], { color: '#7d8084', castShadow: false }),
    cyl('faucet-base', ['faucet', 'tap'], 2.2, 30, [x + width / 4, y + 15, 6], { material: 'stainless' }),
    box('faucet-spout', ['faucet', 'tap'], [2.4, 2.4, 20], [x + width / 4, y + 29, 15], { material: 'stainless' }),
    cyl('faucet-head', ['faucet', 'tap'], 1.8, 8, [x + width / 4, y + 25, 24], { material: 'stainless' }),
  ];
}

/**
 * Kitchen base run along a wall: plinth, cabinets, white gloss fronts, worktop, optional inset sink.
 * params: length, depth (worktop, default 62), height (worktop surface, default 90), modules [{w, kind}] left→right
 * (kind: door | doors | sink | drawers | drawers2..4 | dishwasher | panel | open), sinkCenter (cm from the left end, omit = no sink),
 * sinkWidth, worktop (texture id).
 */
export function kitchenCounter(params: Record<string, unknown>): Part[] {
  const L = num(params.length, 240);
  const D = num(params.depth, 62);
  const H = num(params.height, 90);
  const T = 2; // worktop thickness
  const carcD = D - 2 - FRONT_T - 0.5;
  const x0 = -L / 2;
  const parts: Part[] = [
    box('plinth', ['plinth'], [L, PLINTH, 1.6], [0, PLINTH / 2, carcD - 4], { material: 'white-gloss' }),
    box('carcass', ['cabinet'], [L, H - T - PLINTH, carcD], [0, PLINTH + (H - T - PLINTH) / 2, carcD / 2], { material: 'white-laminate' }),
    box('worktop', ['worktop', 'countertop', 'counter'], [L, T, D], [0, H - T / 2, D / 2], { material: str(params.worktop, 'quartz-cream') }),
  ];
  let x = x0;
  for (const [i, m] of modules(params.modules, L).entries()) {
    parts.push(...fronts(`m${i + 1}`, m, x, PLINTH, H - T - 0.5, carcD + FRONT_T + 0.5, true));
    x += m.w;
  }
  if (params.sinkCenter != null) parts.push(...sink(x0 + num(params.sinkCenter, L / 2), H, D, num(params.sinkWidth, 80)));
  return parts;
}

/** Gas hob (black glass, cast-iron grates, 5 burners) centred at (x, z) on a worktop at height y. */
function hob(x: number, y: number, z: number): Part[] {
  const parts: Part[] = [box('hob', ['hob', 'cooktop', 'stove'], [75, 0.6, 51], [x, y + 0.3, z], { material: 'glass-black' })];
  for (const [i, gx] of [-25, 0, 25].entries()) parts.push(box(`hob-grate-${i + 1}`, ['hob', 'grate'], [23, 1.6, 45], [x + gx, y + 1.4, z], { material: 'metal-black' }));
  const burners: [number, number, number][] = [[-26, -11, 4], [-26, 11, 3.2], [0, 0, 6], [26, -11, 3.2], [26, 11, 4]];
  burners.forEach(([bx, bz, r], i) => parts.push(cyl(`hob-burner-${i + 1}`, ['hob', 'burner'], r, 1.4, [x + bx, y + 1.2, z + bz], { color: '#2a2a2c' })));
  for (let i = 0; i < 5; i++) parts.push(cyl(`hob-knob-${i + 1}`, ['hob', 'knob'], 1.8, 2, [x - 24 + i * 12, y + 1.6, z + 22], { material: 'stainless' }));
  return parts;
}

/**
 * Kitchen island with waterfall ends: drawers on the front (+z), closed panel on the back, optional hob.
 * params: length, depth, height, modules [{w, kind}] for the front between the end panels, hobCenter (cm from the left end).
 */
export function kitchenIsland(params: Record<string, unknown>): Part[] {
  const L = num(params.length, 170);
  const D = num(params.depth, 100);
  const H = num(params.height, 90);
  const T = 4; // slab thickness
  const top = str(params.worktop, 'quartz-cream');
  const inner = L - 2 * T;
  const frontZ = D - 2;
  const parts: Part[] = [
    box('top', ['worktop', 'countertop', 'island top'], [L, T, D], [0, H - T / 2, D / 2], { material: top }),
    box('end-left', ['waterfall', 'end panel'], [T, H - T, D], [-L / 2 + T / 2, (H - T) / 2, D / 2], { material: top }),
    box('end-right', ['waterfall', 'end panel'], [T, H - T, D], [L / 2 - T / 2, (H - T) / 2, D / 2], { material: top }),
    box('back', ['back panel'], [inner, H - T - PLINTH, 2], [0, PLINTH + (H - T - PLINTH) / 2, 3], { material: 'white-gloss' }),
    box('carcass', ['cabinet'], [inner, H - T - PLINTH, frontZ - FRONT_T - 4], [0, PLINTH + (H - T - PLINTH) / 2, 4 + (frontZ - FRONT_T - 4) / 2], { material: 'white-laminate' }),
    box('plinth', ['plinth'], [inner, PLINTH, D - 14], [0, PLINTH / 2, D / 2], { color: '#3a3836', castShadow: false }),
  ];
  let x = -inner / 2;
  for (const [i, m] of modules(params.modules, inner).entries()) {
    parts.push(...fronts(`m${i + 1}`, m, x, PLINTH, H - T - 0.5, frontZ, true));
    x += m.w;
  }
  if (params.hobCenter != null) parts.push(...hob(-L / 2 + num(params.hobCenter, L / 2), H, D - 30));
  return parts;
}

/**
 * Floor-to-soffit tall units, columns left→right. params: height (235), depth (62), columns [{w, kind, handle}]
 * kind: pantry (tall door + top door) | oven (2 drawers, oven, microwave, open shelf, top door) | fridge (empty niche + bridge cabinet).
 * handle: left | right (side the tall door's handle is on). fridgeNiche: niche height (default 190).
 */
export function kitchenTall(params: Record<string, unknown>): Part[] {
  const H = num(params.height, 235);
  const D = num(params.depth, 62);
  const carcD = D - FRONT_T;
  const nicheH = num(params.fridgeNiche, 190);
  const topY = num(params.topDoors, 185); // where the row of top doors starts
  const cols = modules(params.columns, 240);
  const L = cols.reduce((s, c) => s + c.w, 0);
  const parts: Part[] = [];
  let x0 = -L / 2;
  const carcass = (id: string, x: number, w: number, y0: number, y1: number, d = carcD) =>
    box(id, ['cabinet'], [w, y1 - y0, d], [x + w / 2, (y0 + y1) / 2, d / 2], { material: 'white-laminate' });
  cols.forEach((c, i) => {
    const p = `c${i + 1}`;
    const xc = x0 + c.w / 2;
    parts.push(box(`${p}-plinth`, ['plinth'], [c.w, PLINTH, 1.6], [xc, PLINTH / 2, carcD - 4], { material: 'white-gloss' }));
    if (c.kind === 'fridge') {
      // empty niche for a freestanding fridge (the tenant brings it), side panels + bridge cabinet above
      parts.push(
        box(`${p}-side-l`, ['fridge niche', 'side panel'], [1.8, nicheH, D], [x0 + 0.9, nicheH / 2, D / 2], { material: 'white-gloss' }),
        box(`${p}-side-r`, ['fridge niche', 'side panel'], [1.8, nicheH, D], [x0 + c.w - 0.9, nicheH / 2, D / 2], { material: 'white-gloss' }),
        carcass(`${p}-bridge`, x0, c.w, nicheH, H),
        ...fronts(`${p}-top`, { w: c.w, kind: 'doors' }, x0, nicheH, H, D, true),
      );
    } else if (c.kind === 'oven') {
      const ovenY = 70, microY = 130, shelfY = 168, shelfTop = 182;
      parts.push(
        carcass(`${p}-carcass-low`, x0, c.w, PLINTH, shelfY),
        carcass(`${p}-carcass-back`, x0, c.w, shelfY, shelfTop, 30),
        box(`${p}-shelf-l`, ['cabinet'], [1.8, shelfTop - shelfY, carcD], [x0 + 0.9, (shelfY + shelfTop) / 2, carcD / 2], { material: 'white-laminate' }),
        box(`${p}-shelf-r`, ['cabinet'], [1.8, shelfTop - shelfY, carcD], [x0 + c.w - 0.9, (shelfY + shelfTop) / 2, carcD / 2], { material: 'white-laminate' }),
        carcass(`${p}-carcass-top`, x0, c.w, shelfTop, H),
        ...fronts(`${p}-low`, { w: c.w, kind: 'drawers2' }, x0, PLINTH, ovenY, D, true),
        box(`${p}-oven`, ['oven', 'appliance'], [c.w - 2, microY - ovenY - 1, FRONT_T], [xc, (ovenY + microY) / 2, D - FRONT_T / 2], { material: 'glass-black' }),
        box(`${p}-oven-handle`, ['oven', 'handle'], [c.w - 14, 1.6, 2.5], [xc, microY - 6, D + 1.2], { material: 'stainless' }),
        box(`${p}-oven-panel`, ['oven'], [c.w - 2, 7, 0.4], [xc, microY - 5, D + 0.2], { material: 'stainless', castShadow: false }),
        box(`${p}-microwave`, ['microwave', 'appliance'], [c.w - 2, shelfY - microY - 1, FRONT_T], [xc, (microY + shelfY) / 2, D - FRONT_T / 2], { material: 'glass-black' }),
        box(`${p}-microwave-trim`, ['microwave'], [12, shelfY - microY - 5, 0.4], [x0 + c.w - 9, (microY + shelfY) / 2, D + 0.2], { material: 'stainless', castShadow: false }),
        ...fronts(`${p}-top`, { w: c.w, kind: 'door', handle: c.handle }, x0, shelfTop, H, D, true),
      );
    } else {
      parts.push(
        carcass(`${p}-carcass`, x0, c.w, PLINTH, H),
        ...fronts(`${p}-tall`, { w: c.w, kind: 'door', handle: c.handle }, x0, PLINTH, topY, D, false),
        ...fronts(`${p}-top`, { w: c.w, kind: 'door', handle: c.handle }, x0, topY, H, D, true),
      );
    }
    x0 += c.w;
  });
  return parts;
}

/** Wall cabinet with a lift-up flap. params: width, height, depth (35). Double-click the flap to open. */
export function kitchenWallCabinet(params: Record<string, unknown>): WithStates {
  const w = num(params.width, 60);
  const h = num(params.height, 70);
  const d = num(params.depth, 35);
  const pivot: Vec3 = [0, h, d];
  const parts: Part[] = [
    box('carcass', ['cabinet'], [w, h, d - FRONT_T], [0, h / 2, (d - FRONT_T) / 2], { material: 'white-laminate' }),
    box('shelf', ['shelf'], [w - 3.6, 1.8, d - 6], [0, h / 2, (d - 6) / 2 + 1], { material: 'white-laminate' }),
    box('flap', ['flap', 'door', 'front'], [w - 0.4, h - 0.4, FRONT_T], [0, h / 2, d - FRONT_T / 2], { material: 'white-gloss', pivot }),
    box('flap-handle', ['flap', 'handle'], [w - 12, 1.2, 1.6], [0, 4, d + 0.8], { material: HANDLE, pivot }),
  ];
  const open: Record<string, PartOverride> = { flap: { rotation: [-105, 0, 0] }, 'flap-handle': { rotation: [-105, 0, 0] } };
  const states: AssetState[] = [
    { id: 'closed', name: 'Closed', parts: {} },
    { id: 'open', name: 'Open', parts: open },
  ];
  return { parts, states, interactions: [{ part: 'flap', action: 'cycleStates' }, { part: 'flap-handle', action: 'cycleStates' }] };
}

/**
 * Two-panel aluminium sliding door (balcony), sized to its opening (opening-local space, see openings.ts).
 * Left panel fixed on the outer track, right panel slides left on the inner track. params: frameMaterial.
 */
export function slidingDoor(params: Record<string, unknown>): WithStates {
  const W = num(params.width, 240);
  const H = num(params.height, 240);
  const t = num(params.wallThickness, 10);
  const frame = str(params.frameMaterial, 'aluminium-grey');
  const F = 5; // outer frame
  const S = 6; // panel stile / rail
  const fd = Math.min(t, 12);
  const zc = -t / 2;
  const parts: Part[] = [
    box('frame-left', ['frame'], [F, H, fd], [-W / 2 + F / 2, H / 2, zc], { material: frame }),
    box('frame-right', ['frame'], [F, H, fd], [W / 2 - F / 2, H / 2, zc], { material: frame }),
    box('frame-top', ['frame'], [W - 2 * F, F, fd], [0, H - F / 2, zc], { material: frame }),
    box('track', ['frame', 'track'], [W - 2 * F, 2, fd], [0, 1, zc], { material: frame }),
  ];
  const pw = (W - 2 * F) / 2 + S / 2; // panels overlap by one stile in the middle
  const ph = H - F - 2;
  const panel = (prefix: string, cx: number, z: number) => {
    const out: Part[] = [
      box(`${prefix}-stile-l`, ['panel', 'frame'], [S, ph, 4], [cx - pw / 2 + S / 2, 2 + ph / 2, z], { material: frame }),
      box(`${prefix}-stile-r`, ['panel', 'frame'], [S, ph, 4], [cx + pw / 2 - S / 2, 2 + ph / 2, z], { material: frame }),
      box(`${prefix}-rail-top`, ['panel', 'frame'], [pw - 2 * S, S, 4], [cx, 2 + ph - S / 2, z], { material: frame }),
      box(`${prefix}-rail-bottom`, ['panel', 'frame'], [pw - 2 * S, S + 2, 4], [cx, 2 + (S + 2) / 2, z], { material: frame }),
      box(`${prefix}-glass`, ['glass', 'pane'], [pw - 2 * S, ph - 2 * S - 2, 0.8], [cx, 2 + S + 2 + (ph - 2 * S - 2) / 2, z], { material: 'glass', glass: true, castShadow: false }),
    ];
    return out;
  };
  const fixed = panel('fixed', -W / 2 + F + pw / 2, zc - fd / 4);
  const slide = panel('slide', W / 2 - F - pw / 2, zc + fd / 4);
  slide.push(box('slide-handle', ['handle'], [2, 30, 2.5], [W / 2 - F - pw + S + 4, 105, zc + fd / 4 + 3.2], { material: frame }));
  parts.push(...fixed, ...slide);
  const shift = pw - S - 10;
  const open: Record<string, PartOverride> = {};
  for (const p of slide) open[p.id] = { position: [p.position[0] - shift, p.position[1], p.position[2]] };
  return {
    parts,
    states: [{ id: 'closed', name: 'Closed', parts: {} }, { id: 'open', name: 'Open', parts: open }],
    interactions: slide.map((p) => ({ part: p.id, action: 'cycleStates' as const })),
  };
}

/** Ceiling track with spots, hanging down from the item's top. params: length (along x), spots, color. */
export function trackLight(params: Record<string, unknown>): Part[] {
  const L = num(params.length, 200);
  const n = Math.max(1, Math.round(num(params.spots, 3)));
  const color = str(params.color, '#f4f4f2');
  const H = 22;
  const parts: Part[] = [box('rail', ['rail', 'track'], [L, 3, 3.5], [0, H - 1.5, 1.75], { color })];
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + (L / (n + 1)) * (i + 1);
    parts.push(
      cyl(`spot-${i + 1}-stem`, ['spot'], 0.8, 8, [x, H - 7, 1.75], { color }),
      cyl(`spot-${i + 1}`, ['spot', 'light'], 4, 11, [x, H - 14, 3], { color, rotation: [25, 0, 0] }),
    );
  }
  return parts;
}
