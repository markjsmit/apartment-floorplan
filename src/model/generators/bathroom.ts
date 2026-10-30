import type { AssetState, Part, PartOverride, Vec3 } from '../schema';
import { box, cyl, FRONT_T, GAP, HANDLE, num, PLINTH, str, type WithStates } from './builtins';
import { placeStuff, stuffKind, stuffParts } from './stuff';
import { cleaningRow, COAT_COLORS, coat, shoeRow } from './wear';

// Bathroom + walk-in closet fixtures that come with the apartment: vanity with basin, wall-hung toilet, built-in bath,
// walk-in shower, washer/dryer column, BOAXEL/ELVARLI-style closet system.
// Item convention: origin back-centre on the floor, +z out of the front. Ceramic + acrylic = white-gloss, chrome = stainless.

const CERAMIC = 'white-gloss';
const CHROME = 'stainless';
const OPEN = 100; // degrees a cabinet door swings open

const bool = (v: unknown, d: boolean) => (v === undefined || v === null || v === '' ? d : v !== false && v !== 'false');
const closedOpen = (open: Record<string, PartOverride>): AssetState[] => [
  { id: 'closed', name: 'Closed', parts: {} },
  { id: 'open', name: 'Open', parts: open },
];

type Door = { parts: Part[]; open: Record<string, PartOverride> };

/**
 * White gloss door between x0..x1 / y0..y1, front face at z, hinged on its left or right edge, swinging out (+z).
 * handle: knob | bar (vertical) | none, at height y on the edge opposite the hinge. Every part turns about the hinge.
 */
function hingedDoor(id: string, x0: number, x1: number, y0: number, y1: number, z: number, hinge: 'left' | 'right', handle: { kind: string; y: number; len?: number }, openDeg = OPEN): Door {
  const left = hinge === 'left';
  const pivot: Vec3 = [left ? x0 : x1, (y0 + y1) / 2, z];
  const parts: Part[] = [box(id, ['door', 'front'], [x1 - x0, y1 - y0, FRONT_T], [(x0 + x1) / 2, (y0 + y1) / 2, z - FRONT_T / 2], { material: 'white-gloss', pivot })];
  const hx = left ? x1 - 4 : x0 + 4;
  if (handle.kind === 'knob') parts.push(box(`${id}-knob`, ['handle', 'knob'], [2.2, 2.2, 2.2], [hx, handle.y, z + 1.1], { material: HANDLE, pivot }));
  else if (handle.kind === 'bar') parts.push(box(`${id}-handle`, ['handle'], [1.2, handle.len ?? 20, 1.6], [hx, handle.y, z + 0.8], { material: HANDLE, pivot }));
  const rotation: Vec3 = [0, left ? -openDeg : openDeg, 0];
  return { parts, open: Object.fromEntries(parts.map((p) => [p.id, { rotation }])) };
}

/** Open-front carcass between x0..x1 and y0..y1, back at z = 0, d deep: sides, back, optional top + bottom (1.8 cm). */
function shell(prefix: string, x0: number, x1: number, y0: number, y1: number, d: number, top = true, bottom = true): Part[] {
  const t = 1.8;
  const w = x1 - x0;
  const xc = (x0 + x1) / 2;
  const out: Part[] = [
    box(`${prefix}-side-l`, ['cabinet'], [t, y1 - y0, d], [x0 + t / 2, (y0 + y1) / 2, d / 2], { material: 'white-laminate' }),
    box(`${prefix}-side-r`, ['cabinet'], [t, y1 - y0, d], [x1 - t / 2, (y0 + y1) / 2, d / 2], { material: 'white-laminate' }),
    box(`${prefix}-back`, ['cabinet'], [w - 2 * t, y1 - y0, 0.8], [xc, (y0 + y1) / 2, 0.4], { material: 'white-laminate' }),
  ];
  if (top) out.push(box(`${prefix}-top`, ['cabinet'], [w - 2 * t, t, d], [xc, y1 - t / 2, d / 2], { material: 'white-laminate' }));
  if (bottom) out.push(box(`${prefix}-bottom`, ['cabinet'], [w - 2 * t, t, d], [xc, y0 + t / 2, d / 2], { material: 'white-laminate' }));
  return out;
}

/** Thermostatic bar mixer on the wall (z = 0) centred at (x, y), with a spout when `spout` is set (bath filler). */
function barMixer(prefix: string, x: number, y: number, spout: boolean): Part[] {
  const out: Part[] = [
    cyl(`${prefix}-body`, ['mixer', 'tap'], 2.6, 24, [x, y, 6], { material: CHROME, rotation: [0, 0, 90] }),
    cyl(`${prefix}-knob-l`, ['mixer', 'tap', 'knob'], 3, 4, [x - 14, y, 6], { material: CHROME, rotation: [0, 0, 90] }),
    cyl(`${prefix}-knob-r`, ['mixer', 'tap', 'knob'], 3, 4, [x + 14, y, 6], { material: CHROME, rotation: [0, 0, 90] }),
    cyl(`${prefix}-wall-l`, ['mixer'], 1.2, 4, [x - 8, y, 2], { material: CHROME, rotation: [90, 0, 0] }),
    cyl(`${prefix}-wall-r`, ['mixer'], 1.2, 4, [x + 8, y, 2], { material: CHROME, rotation: [90, 0, 0] }),
  ];
  if (spout) out.push(box(`${prefix}-spout`, ['mixer', 'tap', 'spout'], [4, 1.6, 12], [x, y - 3.4, 12], { material: CHROME }));
  return out;
}

/** Hand shower parked in a holder/slider at (x, y) on the wall: handle hanging down, head tilted forward. */
function handShower(prefix: string, x: number, y: number, z: number): Part[] {
  return [
    box(`${prefix}-holder`, ['hand shower', 'shower'], [3.5, 4, z], [x, y, z / 2], { material: CHROME }),
    cyl(`${prefix}-handle`, ['hand shower', 'shower'], 1.5, 20, [x, y - 8, z + 2], { material: CHROME }),
    cyl(`${prefix}-head`, ['hand shower', 'shower', 'shower head'], 5, 2, [x, y + 4, z + 3], { material: CHROME, rotation: [-60, 0, 0] }),
  ];
}

/**
 * Floor-standing vanity: plinth, 2-door white cabinet, white ceramic basin top (integrated bowl read as a recess),
 * single-lever tap on the back deck, optional mirror above. params: width (80), depth (46), height (85, top surface),
 * mirror (true), mirrorWidth (null = width), mirrorHeight (80), mirrorBottom (110 above the floor), mirrorFrame
 * (texture id, '' = frameless), handles (knob | bar | none). Double-click a door to open.
 */
export function bathroomVanity(params: Record<string, unknown>): WithStates {
  const W = num(params.width, 80);
  const D = num(params.depth, 46);
  const H = num(params.height, 85);
  const T = 4; // ceramic top thickness at the edges
  const BOWL = 13; // basin depth below the top surface
  const frontZ = D - 1; // the top overhangs the doors by 1 cm
  const carcD = frontZ - FRONT_T - 0.2;
  const x0 = -W / 2 + 0.5;
  const x1 = W / 2 - 0.5;
  const bw = Math.min(70, Math.max(25, W - 20));
  const deck = 10; // back deck for the tap
  const lip = 5;
  const bd = Math.max(20, D - deck - lip);
  const rim = (W - bw) / 2;
  const parts: Part[] = [
    box('plinth', ['plinth'], [W - 2, PLINTH, 1.6], [0, PLINTH / 2, carcD - 4], { material: 'white-gloss' }),
    ...shell('carcass', x0, x1, PLINTH, H - T, carcD, false),
    box('shelf', ['shelf'], [W - 4.6, 1.8, carcD - 2], [0, PLINTH + (H - BOWL - PLINTH) / 2, carcD / 2], { material: 'white-laminate' }),
    box('under-basin', ['cabinet'], [W - 4.6, 1.8, carcD - 1], [0, H - BOWL - 2.5, carcD / 2], { material: 'white-laminate' }),
    // ceramic top: back deck, front lip and side rims around the bowl
    box('top-back', ['basin', 'top', 'ceramic'], [W, T, deck], [0, H - T / 2, deck / 2], { material: CERAMIC }),
    box('top-front', ['basin', 'top', 'ceramic'], [W, T, lip], [0, H - T / 2, D - lip / 2], { material: CERAMIC }),
    box('top-left', ['basin', 'top', 'ceramic'], [rim, T, bd], [-W / 2 + rim / 2, H - T / 2, deck + bd / 2], { material: CERAMIC }),
    box('top-right', ['basin', 'top', 'ceramic'], [rim, T, bd], [W / 2 - rim / 2, H - T / 2, deck + bd / 2], { material: CERAMIC }),
    box('bowl-bottom', ['basin', 'bowl', 'sink'], [bw, 1, bd], [0, H - BOWL + 0.5, deck + bd / 2], { material: CERAMIC, castShadow: false }),
    box('bowl-left', ['basin', 'bowl', 'sink'], [1, BOWL - T, bd], [-bw / 2 + 0.5, H - BOWL + (BOWL - T) / 2, deck + bd / 2], { material: CERAMIC }),
    box('bowl-right', ['basin', 'bowl', 'sink'], [1, BOWL - T, bd], [bw / 2 - 0.5, H - BOWL + (BOWL - T) / 2, deck + bd / 2], { material: CERAMIC }),
    box('bowl-back', ['basin', 'bowl', 'sink'], [bw, BOWL - T, 1], [0, H - BOWL + (BOWL - T) / 2, deck + 0.5], { material: CERAMIC }),
    box('bowl-front', ['basin', 'bowl', 'sink'], [bw, BOWL - T, 1], [0, H - BOWL + (BOWL - T) / 2, deck + bd - 0.5], { material: CERAMIC }),
    cyl('drain', ['basin', 'drain'], 2, 0.3, [0, H - BOWL + 1.15, deck + bd / 2], { material: CHROME, castShadow: false }),
    // single-lever tap
    cyl('tap-body', ['tap', 'faucet'], 2.2, 14, [0, H + 7, 5], { material: CHROME }),
    box('tap-spout', ['tap', 'faucet'], [2.4, 2, 11], [0, H + 12, 11.5], { material: CHROME }),
    box('tap-lever', ['tap', 'faucet', 'lever'], [1.6, 1.2, 7], [0, H + 14.6, 3.5], { material: CHROME }),
  ];
  const handles = str(params.handles, 'knob');
  const y0 = PLINTH + GAP;
  const y1 = H - T - GAP;
  const handle = { kind: handles, y: handles === 'bar' ? y1 - 12 : y1 - 6, len: 16 };
  const doorL = hingedDoor('door-l', x0 + GAP, -GAP / 2, y0, y1, frontZ, 'left', handle);
  const doorR = hingedDoor('door-r', GAP / 2, x1 - GAP, y0, y1, frontZ, 'right', handle);
  parts.push(...doorL.parts, ...doorR.parts);
  if (bool(params.mirror, true)) {
    const mw = num(params.mirrorWidth, W);
    const mh = num(params.mirrorHeight, 80);
    const mb = num(params.mirrorBottom, 110);
    const frame = typeof params.mirrorFrame === 'string' ? params.mirrorFrame : 'wood-oak-light';
    if (frame) {
      parts.push(
        box('mirror-frame', ['mirror', 'frame'], [mw, mh, 2], [0, mb + mh / 2, 1], { material: frame }),
        box('mirror', ['mirror'], [mw - 5, mh - 5, 0.4], [0, mb + mh / 2, 2.2], { material: 'mirror', castShadow: false }),
      );
    } else {
      parts.push(box('mirror', ['mirror'], [mw, mh, 0.6], [0, mb + mh / 2, 0.3], { material: 'mirror', castShadow: false }));
    }
  }
  const doorParts = [...doorL.parts, ...doorR.parts];
  return {
    parts,
    states: closedOpen({ ...doorL.open, ...doorR.open }),
    interactions: doorParts.map((p) => ({ part: p.id, action: 'cycleStates' as const })),
  };
}

/**
 * Wall-hung toilet in front of a tiled concealed-cistern box ("ledge") with a chrome dual flush plate.
 * params: ledgeWidth (60), ledgeHeight (110), ledgeDepth (20; the bowl hangs in front of it), ledgeMaterial (texture id),
 * bowlOffset (cm from the ledge's centre, + = right). Bowl ~36 wide, 54 deep, seat at ~42.
 */
export function toiletWallHung(params: Record<string, unknown>): Part[] {
  const lw = num(params.ledgeWidth, 60);
  const lh = num(params.ledgeHeight, 110);
  const ld = num(params.ledgeDepth, 20);
  const bx = num(params.bowlOffset, 0);
  const plateY = Math.max(50, Math.min(lh - 14, 100));
  const z0 = ld; // the bowl's back
  const parts: Part[] = [
    box('ledge', ['ledge', 'cistern box', 'boxing'], [lw, lh, ld], [0, lh / 2, ld / 2], { material: str(params.ledgeMaterial, 'tiles-dark-grey') }),
    box('flush-plate', ['flush plate', 'flush button'], [24, 16, 0.6], [bx, plateY, ld + 0.3], { material: CHROME }),
    box('flush-button-big', ['flush plate', 'flush button'], [13, 11, 0.5], [bx - 4.5, plateY, ld + 0.85], { material: CHROME }),
    box('flush-button-small', ['flush plate', 'flush button'], [6, 11, 0.5], [bx + 6.5, plateY, ld + 0.85], { material: CHROME }),
    // bowl: block against the ledge + round front, narrower foot underneath, seat + closed lid on top
    box('bowl-back', ['toilet', 'bowl', 'ceramic'], [36, 26, 20], [bx, 27, z0 + 10], { material: CERAMIC }),
    cyl('bowl', ['toilet', 'bowl', 'ceramic'], 18, 18, [bx, 31, z0 + 36], { material: CERAMIC }),
    box('bowl-mid', ['toilet', 'bowl', 'ceramic'], [36, 18, 18], [bx, 31, z0 + 26], { material: CERAMIC }),
    cyl('bowl-foot', ['toilet', 'bowl', 'ceramic'], 12, 8, [bx, 18, z0 + 26], { material: CERAMIC }),
    box('seat-back', ['toilet', 'seat'], [36, 2, 18], [bx, 41, z0 + 26], { material: CERAMIC }),
    cyl('seat', ['toilet', 'seat'], 18, 2, [bx, 41, z0 + 36], { material: CERAMIC }),
    cyl('lid', ['toilet', 'lid'], 17.5, 1.6, [bx, 42.8, z0 + 36], { material: CERAMIC }),
    box('lid-back', ['toilet', 'lid'], [35, 1.6, 14], [bx, 42.8, z0 + 26], { material: CERAMIC }),
    cyl('hinge-l', ['toilet', 'seat', 'hinge'], 1.2, 3, [bx - 10, 42, z0 + 5], { material: CHROME, rotation: [0, 0, 90] }),
    cyl('hinge-r', ['toilet', 'seat', 'hinge'], 1.2, 3, [bx + 10, 42, z0 + 5], { material: CHROME, rotation: [0, 0, 90] }),
  ];
  return parts;
}

/**
 * Built-in bath: white acrylic rim around an inner basin (read as a recess), tiled front + end panels, bar mixer with a
 * spout and a hand shower on the back wall at the mixer end, optional fixed glass screen on the front edge at that end
 * (fixed to the end wall). params: length (170, along x), width (70, out from the wall), height (55, rim),
 * panelMaterial (texture id), mixerSide (left | right), screen (false), screenWidth (80).
 */
export function bathtub(params: Record<string, unknown>): Part[] {
  const L = num(params.length, 170);
  const W = num(params.width, 70);
  const H = num(params.height, 55);
  const s = str(params.mixerSide, 'left') === 'right' ? 1 : -1;
  const panel = str(params.panelMaterial, 'tiles-dark-grey');
  const RT = 3; // rim thickness
  const back = 6, front = 6, end = 8; // rim widths
  const ox = L - 2 * end;
  const oz = W - back - front;
  const bottom = Math.max(8, H - 42); // inner basin floor
  const wallH = H - RT - bottom;
  const oc = back + oz / 2;
  const parts: Part[] = [
    box('panel-front', ['panel', 'bath panel', 'tiles'], [L, H - RT, 2], [0, (H - RT) / 2, W - 1], { material: panel }),
    box('panel-left', ['panel', 'bath panel', 'tiles'], [2, H - RT, W - 2], [-L / 2 + 1, (H - RT) / 2, (W - 2) / 2], { material: panel }),
    box('panel-right', ['panel', 'bath panel', 'tiles'], [2, H - RT, W - 2], [L / 2 - 1, (H - RT) / 2, (W - 2) / 2], { material: panel }),
    box('rim-back', ['bath', 'rim'], [L, RT, back], [0, H - RT / 2, back / 2], { material: CERAMIC }),
    box('rim-front', ['bath', 'rim'], [L, RT, front], [0, H - RT / 2, W - front / 2], { material: CERAMIC }),
    box('rim-left', ['bath', 'rim'], [end, RT, oz], [-L / 2 + end / 2, H - RT / 2, oc], { material: CERAMIC }),
    box('rim-right', ['bath', 'rim'], [end, RT, oz], [L / 2 - end / 2, H - RT / 2, oc], { material: CERAMIC }),
    box('basin-bottom', ['bath', 'basin'], [ox, 1, oz], [0, bottom + 0.5, oc], { material: CERAMIC, castShadow: false }),
    box('basin-back', ['bath', 'basin'], [ox, wallH, 1], [0, bottom + wallH / 2, back + 0.5], { material: CERAMIC }),
    box('basin-front', ['bath', 'basin'], [ox, wallH, 1], [0, bottom + wallH / 2, W - front - 0.5], { material: CERAMIC }),
    box('basin-left', ['bath', 'basin'], [1, wallH, oz], [-ox / 2 + 0.5, bottom + wallH / 2, oc], { material: CERAMIC }),
    box('basin-right', ['bath', 'basin'], [1, wallH, oz], [ox / 2 - 0.5, bottom + wallH / 2, oc], { material: CERAMIC }),
    cyl('drain', ['bath', 'drain'], 3, 0.3, [s * (ox / 2 - 12), bottom + 1.15, oc], { material: CHROME, castShadow: false }),
    ...barMixer('mixer', s * (L / 2 - 24), H + 18, true),
    ...handShower('hand-shower', s * (L / 2 - 8), H + 70, 4),
  ];
  if (bool(params.screen, false)) {
    const sw = Math.max(30, Math.min(num(params.screenWidth, 80), L));
    const sh = 140;
    parts.push(
      box('screen-profile', ['screen', 'profile'], [2, sh, 2.5], [s * (L / 2 - 1), H + sh / 2, W - 4], { material: CHROME }),
      box('screen', ['screen', 'glass', 'bath screen'], [sw - 2, sh, 0.8], [s * (L / 2 - 1 - sw / 2), H + sh / 2, W - 4], { material: 'glass', glass: true, castShadow: false }),
    );
  }
  return parts;
}

/** Glass pane in a thin chrome frame; the pane lies in the x-y plane (axis 'x') or the z-y plane (axis 'z'). */
function framedPane(prefix: string, tags: string[], c: Vec3, len: number, h: number, axis: 'x' | 'z', glass: string, P: number, extra: { pivot?: Vec3 } = {}): Part[] {
  const along = (l: number, t: number, hh: number): Vec3 => (axis === 'x' ? [l, hh, t] : [t, hh, l]);
  const at = (d: number, y: number): Vec3 => (axis === 'x' ? [c[0] + d, y, c[2]] : [c[0], y, c[2] + d]);
  const y0 = c[1] - h / 2;
  const y1 = c[1] + h / 2;
  return [
    box(`${prefix}-glass`, [...tags, 'glass'], along(len - 2 * P, 0.8, h - 2 * P), c, { material: glass, glass: true, castShadow: false, ...extra }),
    box(`${prefix}-frame-top`, [...tags, 'frame'], along(len, P, P), at(0, y1 - P / 2), { material: CHROME, ...extra }),
    box(`${prefix}-frame-bottom`, [...tags, 'frame'], along(len, P, P), at(0, y0 + P / 2), { material: CHROME, ...extra }),
    box(`${prefix}-frame-a`, [...tags, 'frame'], along(P, P, h - 2 * P), at(-len / 2 + P / 2, c[1]), { material: CHROME, ...extra }),
    box(`${prefix}-frame-b`, [...tags, 'frame'], along(P, P, h - 2 * P), at(len / 2 - P / 2, c[1]), { material: CHROME, ...extra }),
  ];
}

/**
 * Walk-in shower corner (origin back-centre of the shower area, back wall at z = 0): glass door on the front, hinged at
 * the doorSide end, a fixed front panel filling the rest (fronts wider than ~85), optional side panel closing the
 * doorSide end (the other end is the room wall), thin chrome frames, rain head on an arm from the back wall, bar mixer,
 * hand shower on a rail, square floor drain. params: width (90), depth (90), height (200, glass), glass (frosted | clear),
 * doorSide (left | right), sidePanel (true). Double-click the door to open.
 */
export function showerEnclosure(params: Record<string, unknown>): WithStates {
  const W = num(params.width, 90);
  const D = num(params.depth, 90);
  const H = num(params.height, 200);
  const glass = str(params.glass, 'frosted') === 'clear' ? 'glass' : 'glass-frosted';
  const s = str(params.doorSide, 'right') === 'left' ? -1 : 1;
  const side = bool(params.sidePanel, true);
  const P = 1.5; // chrome profile
  const fz = D - P / 2; // front glass plane
  const span = W - 2 * P; // between the two front posts
  let doorW = Math.min(span, 80);
  if (span - doorW < 10) doorW = span;
  const fixedW = span - doorW;
  const hingeX = s * (W / 2 - P);
  const pivot: Vec3 = [hingeX, H / 2, fz];
  const parts: Part[] = [
    box('post-door', ['frame', 'profile'], [P, H, P], [s * (W / 2 - P / 2), H / 2, fz], { material: CHROME }),
    box('post-wall', ['frame', 'profile'], [P, H, P], [-s * (W / 2 - P / 2), H / 2, fz], { material: CHROME }),
  ];
  const door = [
    ...framedPane('door', ['door'], [hingeX - s * (doorW / 2), 0.5 + (H - 0.5) / 2, fz], doorW, H - 0.5, 'x', glass, P, { pivot }),
    box('door-handle', ['door', 'handle'], [1.5, 30, 1.5], [hingeX - s * (doorW - 5), 105, D + 0.4], { material: CHROME, pivot }),
  ];
  parts.push(...door);
  if (fixedW > 0) parts.push(...framedPane('fixed', ['fixed panel'], [-s * (W / 2 - P - fixedW / 2), H / 2, fz], fixedW, H, 'x', glass, P));
  if (side) {
    parts.push(
      box('side-profile', ['frame', 'profile'], [P, H, P], [s * (W / 2 - P / 2), H / 2, P / 2], { material: CHROME }),
      ...framedPane('side', ['side panel'], [s * (W / 2 - P / 2), H / 2, D / 2], D - 2 * P, H, 'z', glass, P),
    );
  }
  // fittings on the back wall: rain head on an arm, mixer, hand shower on a rail (on the wall side, away from the door)
  const rainY = H + 10;
  const arm = Math.min(D / 2, 40);
  const rx = -s * Math.max(10, W / 2 - 22);
  parts.push(
    box('rain-arm', ['shower', 'rain shower', 'arm'], [2, 2, arm], [0, rainY, arm / 2], { material: CHROME }),
    cyl('rain-head', ['shower', 'rain shower', 'shower head'], 12.5, 1.2, [0, rainY - 1.6, arm], { material: CHROME }),
    ...barMixer('mixer', 0, 105, false),
    cyl('rail', ['shower', 'rail'], 1, 80, [rx, 160, 3.5], { material: CHROME }),
    box('rail-bracket-bottom', ['shower', 'rail'], [2.5, 2.5, 3.5], [rx, 121, 1.75], { material: CHROME }),
    box('rail-bracket-top', ['shower', 'rail'], [2.5, 2.5, 3.5], [rx, 199, 1.75], { material: CHROME }),
    ...handShower('hand-shower', rx, 170, 5.5),
    box('drain', ['drain', 'floor drain'], [12, 0.3, 12], [0, 0.15, D / 2], { material: CHROME, castShadow: false }),
  );
  const rotation: Vec3 = [0, s * 90, 0];
  return {
    parts,
    states: closedOpen(Object.fromEntries(door.map((p) => [p.id, { rotation }]))),
    interactions: door.map((p) => ({ part: p.id, action: 'cycleStates' as const })),
  };
}

/** Front-loading machine (washer or dryer) standing at y0, back at z0, front facing +z, centred on x. */
function machine(prefix: string, w: number, d: number, y0: number, z0: number, dryer: boolean, x = 0): Part[] {
  const h = 85;
  const zf = z0 + d;
  const tags = dryer ? ['dryer', 'tumble dryer', 'appliance'] : ['washing machine', 'washer', 'appliance'];
  const out: Part[] = [
    box(`${prefix}`, tags, [w, h, d], [x, y0 + h / 2, z0 + d / 2], { color: '#f2f2f0' }),
    box(`${prefix}-panel`, [...tags, 'control panel'], [w - 1, 11, 0.6], [x, y0 + h - 7, zf + 0.3], { color: '#e4e5e6', castShadow: false }),
    box(`${prefix}-display`, [...tags, 'display'], [10, 4, 0.4], [x + w / 2 - 22, y0 + h - 7, zf + 0.8], { material: 'glass-black', castShadow: false }),
    cyl(`${prefix}-knob`, [...tags, 'knob'], 3, 1.6, [x + w / 2 - 8, y0 + h - 7, zf + 1.4], { material: CHROME, rotation: [90, 0, 0] }),
    cyl(`${prefix}-door-ring`, [...tags, 'door'], 16, 3, [x, y0 + 40, zf + 1.5], { color: dryer ? '#f4f4f2' : '#b9bcbf', rotation: [90, 0, 0] }),
    cyl(`${prefix}-door-glass`, [...tags, 'door', 'porthole'], 12, 0.6, [x, y0 + 40, zf + 3.2], { material: 'glass-black', rotation: [90, 0, 0], castShadow: false }),
  ];
  if (!dryer) out.push(box(`${prefix}-drawer`, [...tags, 'detergent drawer'], [18, 8, 0.6], [x - w / 2 + 12, y0 + h - 7, zf + 0.8], { color: '#e9eaeb' }));
  return out;
}

/**
 * Tall built-in white cabinet with a stacked washing machine (floor) and tumble dryer (on a shelf on top of it), two
 * tall doors in front of them and a storage door above. params: width (65), depth (62), height (220),
 * doors: pair (default) | stacked (one full-width door over the washer and one from the dryer up to the top, both
 * hinged on the `hinge` side: left | right, seen from the front; lowOpen = how far the lower door opens, degrees),
 * machines: center (default) | left | right, seen from the front: in a wider column the machines stand at that side with
 * a divider and shelves beside them. Double-click a door to open all doors (the round machine doors show behind them).
 */
export function washerDryerColumn(params: Record<string, unknown>): WithStates {
  const W = num(params.width, 65);
  const D = num(params.depth, 62);
  const H = num(params.height, 220);
  const carcD = D - FRONT_T - 0.2;
  const x0 = -W / 2;
  const x1 = W / 2;
  const mw = Math.min(60, W - 4.6);
  const md = Math.min(57, carcD - 5); // room for the round doors behind the cabinet doors
  const mSide = params.machines === 'left' || params.machines === 'right' ? params.machines : 'center';
  const mx = mSide === 'left' ? x0 + 2.3 + mw / 2 : mSide === 'right' ? x1 - 2.3 - mw / 2 : 0;
  const spare = mSide === 'center' ? 0 : W - 3.6 - mw - 3.2; // shelf space beside the machines
  const topY = 176; // storage section starts here (machines 0-85, shelf, 88-173)
  const storage = H - topY >= 15;
  const parts: Part[] = [
    ...shell('carcass', x0, x1, 0, H, carcD, true, false),
    box('dryer-shelf', ['shelf'], [W - 3.6, 3, carcD - 1], [0, 86.5, (carcD - 1) / 2 + 0.8], { material: 'white-laminate' }),
    ...machine('washer', mw, md, 0, 1, false, mx),
    ...machine('dryer', mw, md, 88, 1, true, mx),
  ];
  if (spare >= 15) {
    // divider next to the machines + shelves for detergent, cleaning things, towels in the rest of the width
    const dx = mSide === 'left' ? mx + mw / 2 + 1.4 : mx - mw / 2 - 1.4;
    const s0 = mSide === 'left' ? dx + 0.9 : x0 + 1.8;
    const s1 = mSide === 'left' ? x1 - 1.8 : dx - 0.9;
    parts.push(box('divider', ['divider'], [1.8, topY - 1, carcD - 1], [dx, (topY - 1) / 2, (carcD - 1) / 2 + 0.8], { material: 'white-laminate' }));
    for (const y of [30, 58, 116, 146]) parts.push(box(`side-shelf-${y}`, ['shelf'], [s1 - s0, 1.8, carcD - 1], [(s0 + s1) / 2, y, (carcD - 1) / 2 + 0.8], { material: 'white-laminate' }));
  }
  if (storage) parts.push(box('storage-shelf', ['shelf'], [W - 3.6, 1.8, carcD - 1], [0, topY + 0.9, (carcD - 1) / 2 + 0.8], { material: 'white-laminate' }));
  const tallTop = storage ? topY + 1.8 - GAP / 2 : H - GAP;
  const side = params.hinge === 'right' ? 'right' : 'left';
  const doors = params.doors === 'stacked' ? [
    // the lower door can be stopped short (lowOpen degrees) where something stands in its way (a toilet)
    hingedDoor('door-low', x0 + GAP, x1 - GAP, 1, 87.5 - GAP / 2, D, side, { kind: 'none', y: 0 }, num(params.lowOpen, OPEN)),
    hingedDoor('door-high', x0 + GAP, x1 - GAP, 87.5 + GAP / 2, H - GAP, D, side, { kind: 'none', y: 0 }),
  ] : [
    hingedDoor('door-l', x0 + GAP, -GAP / 2, 1, tallTop, D, 'left', { kind: 'bar', y: 115, len: 30 }),
    hingedDoor('door-r', GAP / 2, x1 - GAP, 1, tallTop, D, 'right', { kind: 'bar', y: 115, len: 30 }),
  ];
  if (storage && params.doors !== 'stacked') doors.push(hingedDoor('door-top', x0 + GAP, x1 - GAP, tallTop + GAP, H - GAP, D, 'left', { kind: 'knob', y: tallTop + 6 }));
  const doorParts = doors.flatMap((d) => d.parts);
  parts.push(...doorParts);
  return {
    parts,
    states: closedOpen(Object.assign({}, ...doors.map((d) => d.open))),
    interactions: doorParts.map((p) => ({ part: p.id, action: 'cycleStates' as const })),
  };
}

export const CLOSET_KINDS = ['hang', 'hang2', 'shelves', 'drawers', 'broom'];
type Section = { w: number; kind: string; drawers: number; coats: number; shoes: number; shelfContents: string };

function sections(raw: unknown): Section[] {
  const list = Array.isArray(raw) && raw.length ? (raw as Record<string, unknown>[]) : [{ w: 80, kind: 'hang' }, { w: 80, kind: 'drawers' }, { w: 80, kind: 'shelves' }];
  return list.map((s) => {
    const kind = str(s.kind, 'hang');
    if (!CLOSET_KINDS.includes(kind)) throw new Error(`unknown closet section kind "${kind}" (use ${CLOSET_KINDS.join(', ')})`);
    return { w: num(s.w, 80), kind, drawers: num(s.drawers, 3) === 2 ? 2 : 3, coats: num(s.coats, 0), shoes: num(s.shoes, 0), shelfContents: str(s.contents, '') };
  });
}

/**
 * Walk-in closet system like IKEA BOAXEL/ELVARLI: white floor-to-ceiling posts (clamped, no drilling) with sections
 * between them, left→right. params: height (270 = ceiling), depth (40), postMaterial (texture id),
 * sections [{w, kind, drawers?}] kind: hang (top shelf + rail) | hang2 (shelf + upper and lower rail) | shelves (5) |
 * drawers (white 80 cm drawer unit, `drawers` 2 or 3 (default), + rail above + top shelf) | broom (top shelf, vacuum,
 * mop + ironing board below). Width = sections + posts.
 */
export function closetSystem(params: Record<string, unknown>): Part[] {
  if (params.style === 'stolmen') return stolmen(params);
  const H = num(params.height, 270);
  const D = num(params.depth, 40);
  const postMat = str(params.postMaterial, 'white-laminate');
  const list = sections(params.sections);
  const POST = 3;
  const total = list.reduce((s, x) => s + x.w, 0) + (list.length + 1) * POST;
  const TOP = Math.min(H - 35, 200); // top shelf
  const parts: Part[] = [];
  const post = (i: number, x: number) => parts.push(
    box(`post-${i}`, ['post', 'upright'], [POST, H - 3, POST], [x, H / 2, 2], { material: postMat }),
    box(`post-${i}-foot`, ['post', 'clamp'], [POST, 1.5, 4], [x, 0.75, 2], { color: '#9a9c9e' }),
    box(`post-${i}-clamp`, ['post', 'clamp'], [POST, 1.5, 4], [x, H - 0.75, 2], { color: '#9a9c9e' }),
  );
  let x = -total / 2;
  post(0, x + POST / 2);
  list.forEach((sec, i) => {
    const p = `s${i + 1}`;
    const x0 = x + POST;
    const xc = x0 + sec.w / 2;
    const shelf = (id: string, y: number) => parts.push(
      box(id, ['shelf'], [sec.w - 0.4, 1.8, D - 2], [xc, y - 0.9, 1 + D / 2], { material: str(params.shelfMaterial, 'white-laminate') }),
      box(`${id}-bracket-l`, ['shelf', 'bracket'], [1, 3, D - 6], [x0 + 0.5, y - 3.3, 3.5 + (D - 6) / 2], { material: postMat }),
      box(`${id}-bracket-r`, ['shelf', 'bracket'], [1, 3, D - 6], [x0 + sec.w - 0.5, y - 3.3, 3.5 + (D - 6) / 2], { material: postMat }),
    );
    const rail = (id: string, y: number) => parts.push(cyl(id, ['rail', 'clothes rail'], 1.25, sec.w - 1, [xc, y, D * 0.55], { material: 'aluminium-grey', rotation: [0, 0, 90] }));
    if (sec.kind === 'shelves') {
      const ys = Array.from({ length: 5 }, (_, k) => 30 + (k * (TOP - 30)) / 4);
      ys.forEach((y, k) => shelf(`${p}-shelf-${k + 1}`, y));
      // contents per shelf, bottom → top, space separated (shoes | whisky | games | books | boxes | bins | stuff)
      sec.shelfContents.split(/\s+/).forEach((c, k) => {
        const kind = stuffKind(c);
        if (!kind || k >= ys.length) return;
        const room = (k + 1 < ys.length ? ys[k + 1] - 1.8 : H - 3) - ys[k];
        parts.push(...placeStuff(stuffParts(kind, `${p}-c${k}`, sec.w - 2, D - 3, Math.min(room, 35)), 0, [xc, ys[k], 1]));
      });
      if (sec.shoes) parts.push(...shoeRow(`${p}-shoes`, xc, 0, D, sec.w, `${p}-shoes`, sec.shoes));
    } else if (sec.kind === 'broom') {
      // broom section: a top shelf, below it the vacuum, mop, ironing board ... standing on the floor
      shelf(`${p}-shelf`, TOP);
      parts.push(...placeStuff(cleaningRow(`${p}-clean`, 0, 0, 0, sec.w - 2, D - 3, TOP - 2), 0, [xc, 0, 1]));
    } else {
      shelf(`${p}-shelf`, TOP);
      rail(`${p}-rail`, TOP - 8);
      if (sec.kind === 'hang2') rail(`${p}-rail-low`, Math.round(TOP / 2) - 4);
      // jackets on hangers (side on, like in any closet) and shoe pairs on the floor below them
      for (let k = 0; k < sec.coats; k++) parts.push(...coat(`${p}-coat-${k + 1}`, x0 + 8 + ((k + 0.5) * (sec.w - 16)) / sec.coats, TOP - 8, D * 0.55, COAT_COLORS[(k * 2 + i) % COAT_COLORS.length], true, 80));
      if (sec.shoes && sec.kind !== 'drawers') parts.push(...shoeRow(`${p}-shoes`, xc, 0, D, sec.w, `${p}-shoes`, sec.shoes));
      if (sec.kind === 'drawers') {
        const uh = 80;
        const ud = D - 4;
        const n = sec.drawers;
        parts.push(box(`${p}-unit`, ['drawer unit', 'cabinet'], [sec.w - 1, uh, ud - FRONT_T], [xc, uh / 2, 2 + (ud - FRONT_T) / 2], { material: 'white-laminate' }));
        const fh = (uh - (n + 1) * GAP) / n;
        for (let k = 0; k < n; k++) {
          const top = uh - GAP - k * (fh + GAP);
          parts.push(
            box(`${p}-drawer-${k + 1}`, ['drawer', 'front'], [sec.w - 1 - 2 * GAP, fh, FRONT_T], [xc, top - fh / 2, 2 + ud - FRONT_T / 2], { material: 'white-gloss' }),
            box(`${p}-drawer-${k + 1}-handle`, ['drawer', 'handle'], [Math.min(30, sec.w * 0.4), 1.2, 1.6], [xc, top - 5, 2 + ud + 0.8], { material: HANDLE }),
          );
        }
      }
    }
    x = x0 + sec.w;
    post(i + 1, x + POST / 2);
  });
  return parts;
}

/**
 * IKEA STOLMEN-style closet (what the walk-in closet has, photos 160841-50): round white posts clamped floor to ceiling
 * near the FRONT (feet + ceiling pads, the telescopic joint near the top), everything hung on them: top shelves that run
 * back to the wall, clothes rails between the posts (clothes hang across, centred on the rail), 2-drawer units on
 * little feet standing between the posts. `depth` = wall to the front of the shelves (clothes on hangers need ~50).
 * Same sections as closetSystem: hang | hang2 | drawers (rail + shelf above the unit) | shelves | broom.
 */
function stolmen(params: Record<string, unknown>): Part[] {
  const H = num(params.height, 270);
  const D = num(params.depth, 52);
  const list = sections(params.sections);
  const R = 2.2; // post radius
  const POST = 2 * R;
  const PZ = D - 22; // the post line (and the rails): clothes hang centred on it
  const TOP = Math.min(H - 60, 200);
  const white = { material: 'white-laminate' };
  const steel = { color: '#f2f2f0' };
  const total = list.reduce((sum, x) => sum + x.w, 0) + (list.length + 1) * POST;
  const parts: Part[] = [];
  const post = (i: number, x: number) => parts.push(
    cyl(`post-${i}`, ['post', 'upright'], R, H - 2.4, [x, H / 2, PZ], steel),
    cyl(`post-${i}-foot`, ['post', 'foot'], 4, 1.2, [x, 0.6, PZ], steel),
    cyl(`post-${i}-pad`, ['post', 'pad'], 4, 1.2, [x, H - 0.6, PZ], steel),
    cyl(`post-${i}-joint`, ['post', 'joint'], R + 0.4, 6, [x, H - 40, PZ], steel),
  );
  let x = -total / 2;
  post(0, x + R);
  list.forEach((sec, i) => {
    const p = `s${i + 1}`;
    const x0 = x + POST;
    const xc = x0 + sec.w / 2;
    const clamps = (id: string, y: number) => {
      for (const [k, px] of [['l', x0 - R], ['r', x0 + sec.w + R]] as [string, number][]) parts.push(cyl(`${id}-clamp-${k}`, ['clamp'], R + 0.8, 3.5, [px, y, PZ], steel));
    };
    // a shelf rests on the brackets round the two posts and runs back to the wall
    const shelf = (id: string, y: number) => {
      parts.push(box(id, ['shelf'], [sec.w + POST - 0.4, 1.8, D - 1], [xc, y - 0.9, (D - 1) / 2 + 0.5], white));
      clamps(id, y - 3.5);
    };
    const rail = (id: string, y: number) => {
      parts.push({ ...cyl(id, ['rail', 'clothes rail'], 1.3, sec.w + POST, [xc, y, PZ], steel), rotation: [0, 0, 90] as Vec3 });
      clamps(id, y);
    };
    const coats = (y: number, n: number, len: number) => {
      for (let k = 0; k < n; k++) parts.push(...coat(`${p}-coat-${k + 1}-${Math.round(y)}`, x0 + 6 + ((k + 0.5) * (sec.w - 12)) / n, y, PZ, COAT_COLORS[(k * 2 + i) % COAT_COLORS.length], true, len));
    };
    if (sec.kind === 'shelves') {
      const ys = Array.from({ length: 5 }, (_, k) => 30 + (k * (TOP - 30)) / 4);
      ys.forEach((y, k) => shelf(`${p}-shelf-${k + 1}`, y));
      sec.shelfContents.split(/\s+/).forEach((c, k) => {
        const kind = stuffKind(c);
        if (!kind || k >= ys.length) return;
        const room = (k + 1 < ys.length ? ys[k + 1] - 1.8 : H - 3) - ys[k];
        parts.push(...placeStuff(stuffParts(kind, `${p}-c${k}`, sec.w - 2, D - 3, Math.min(room, 35)), 0, [xc, ys[k], 1]));
      });
    } else if (sec.kind === 'broom') {
      shelf(`${p}-shelf`, TOP);
      parts.push(...placeStuff(cleaningRow(`${p}-clean`, 0, 0, 0, sec.w - 2, D - 3, TOP - 2), 0, [xc, 0, 1]));
    } else {
      shelf(`${p}-shelf`, TOP);
      rail(`${p}-rail`, TOP - 10);
      if (sec.kind === 'hang2') rail(`${p}-rail-low`, Math.round(TOP / 2));
      if (sec.kind === 'drawers') {
        // STOLMEN-style 2 / 3-drawer unit on little feet, against the wall between the posts; shorter clothes above it
        const n = sec.drawers;
        const uw = Math.min(sec.w - 2, 56);
        const ud = Math.min(D - 4, 50);
        const fh = 19;
        const feet = 9;
        const uh = n * fh + 2;
        parts.push(box(`${p}-unit`, ['drawer unit', 'cabinet'], [uw, uh, ud - 1.6], [xc, feet + uh / 2, 1 + (ud - 1.6) / 2], white));
        for (const [fx, fz] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) parts.push(cyl(`${p}-foot-${fx}-${fz}`, ['foot'], 1.4, feet, [xc + fx * (uw / 2 - 4), feet / 2, 4 + fz * (ud - 8)], steel));
        for (let k = 0; k < n; k++) {
          const top = feet + uh - 1 - k * fh;
          parts.push(
            box(`${p}-drawer-${k + 1}`, ['drawer', 'front'], [uw - 0.6, fh - 0.8, 1.6], [xc, top - fh / 2, 1 + ud - 0.8], { material: 'white-gloss' }),
            // the cut-out grip in the top edge of the front
            box(`${p}-drawer-${k + 1}-grip`, ['drawer', 'handle'], [14, 2.2, 0.4], [xc, top - 2.4, 1 + ud + 0.05], { color: '#3a3a3a' }),
          );
        }
        if (sec.coats) coats(TOP - 10, sec.coats, Math.min(70, TOP - 10 - (feet + uh) - 10));
      } else if (sec.coats) {
        coats(TOP - 10, sec.coats, 90);
        if (sec.kind === 'hang2') coats(Math.round(TOP / 2), Math.max(2, Math.floor(sec.w / 12)), 60);
      }
      if (sec.shoes) parts.push(...shoeRow(`${p}-shoes`, xc, 0, D, sec.w, `${p}-shoes`, sec.shoes));
    }
    x = x0 + sec.w;
    post(i + 1, x + R);
  });
  return parts;
}

