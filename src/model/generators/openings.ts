import { Euler, Matrix4 } from 'three';
import type { AssetState, Part, Vec3 } from '../schema';

// Opening-local space: origin at the bottom-centre of the opening on the wall's room-side surface,
// +z into the room, the wall occupies z in [-wallThickness, 0].

type Box = { id: string; tags: string[]; size: Vec3; position: Vec3; material: string; pivot?: Vec3; glass?: boolean };

function box(b: Box): Part {
  return {
    id: b.id, tags: b.tags, geometry: { type: 'box', size: b.size }, position: b.position, rotation: [0, 0, 0],
    pivot: b.pivot, material: b.material, castShadow: !b.glass, glass: b.glass ?? false,
  };
}

function dims(params: Record<string, unknown>) {
  return {
    W: Number(params.width ?? 80),
    H: Number(params.height ?? 210),
    t: Number(params.wallThickness ?? 10),
  };
}

/**
 * Door frame + leaf. `hinge`: left | right, seen from the room the door belongs to; `swing`: in (into that room) | out;
 * `leaf`: white (default) | frosted-glass.
 * Built hinged left, swinging in, then mirrored.
 */
export function door(params: Record<string, unknown>): Part[] {
  const parts = doorLeftIn(params);
  const { t } = dims(params);
  const mx = params.hinge === 'right' ? -1 : 1;
  const mz = params.swing === 'out' ? -1 : 1;
  if (mx === 1 && mz === 1) return parts;
  // mirror x about the opening's centre and/or z about the middle of the wall (z = -t/2)
  const flip = (v: Vec3): Vec3 => [v[0] * mx, v[1], mz === 1 ? v[2] : -t - v[2]];
  return parts.map((p) => ({ ...p, position: flip(p.position), pivot: p.pivot && flip(p.pivot) }));
}

/** Which way the leaf turns to open (degrees about y), for a door generated with these params. */
export function doorOpenAngle(params: Record<string, unknown>): number {
  return -90 * (params.hinge === 'right' ? -1 : 1) * (params.swing === 'out' ? -1 : 1);
}

function doorLeftIn(params: Record<string, unknown>): Part[] {
  const { W, H, t } = dims(params);
  const F = 4; // frame (jamb) width
  const leafW = W - 2 * F - 0.6;
  const leafH = H - F - 1;
  const hinge: Vec3 = [-W / 2 + F, 0, 0];
  const handleX = -W / 2 + F + leafW - 8;
  return [
    box({ id: 'jamb-left', tags: ['frame'], size: [F, H, t], position: [-W / 2 + F / 2, H / 2, -t / 2], material: 'white-paint' }),
    box({ id: 'jamb-right', tags: ['frame'], size: [F, H, t], position: [W / 2 - F / 2, H / 2, -t / 2], material: 'white-paint' }),
    box({ id: 'head', tags: ['frame'], size: [W - 2 * F, F, t], position: [0, H - F / 2, -t / 2], material: 'white-paint' }),
    // casings (architraves) on both faces cover the joint between frame and wall
    box({ id: 'casing-left', tags: ['frame', 'casing'], size: [7, H + 6, 1.5], position: [-W / 2 + F - 3.5, (H + 6) / 2, 0.75], material: 'white-paint' }),
    box({ id: 'casing-right', tags: ['frame', 'casing'], size: [7, H + 6, 1.5], position: [W / 2 - F + 3.5, (H + 6) / 2, 0.75], material: 'white-paint' }),
    box({ id: 'casing-top', tags: ['frame', 'casing'], size: [W - 2 * F + 14, 7, 1.5], position: [0, H + 6 - 3.5, 0.75], material: 'white-paint' }),
    box({ id: 'casing-left-out', tags: ['frame', 'casing'], size: [7, H + 6, 1.5], position: [-W / 2 + F - 3.5, (H + 6) / 2, -t - 0.75], material: 'white-paint' }),
    box({ id: 'casing-right-out', tags: ['frame', 'casing'], size: [7, H + 6, 1.5], position: [W / 2 - F + 3.5, (H + 6) / 2, -t - 0.75], material: 'white-paint' }),
    box({ id: 'casing-top-out', tags: ['frame', 'casing'], size: [W - 2 * F + 14, 7, 1.5], position: [0, H + 6 - 3.5, -t - 0.75], material: 'white-paint' }),
    box({
      id: 'leaf', tags: ['door leaf', 'door'], size: [leafW, leafH, 4], position: [-W / 2 + F + 0.3 + leafW / 2, 0.5 + leafH / 2, -2], pivot: hinge,
      ...(params.leaf === 'frosted-glass' ? { material: 'glass-frosted', glass: true } : { material: 'white-laminate' }),
    }),
    // stainless lever handles on round roses, and a key rose below (as on the doors in the survey photos)
    ...lever('handle-in', handleX, 1, hinge),
    ...lever('handle-out', handleX, -1, hinge),
  ];
}

/** Lever handle on one face of the leaf (side 1 = room side, z = 0; -1 = the other face, z = -4). */
function lever(id: string, x: number, side: 1 | -1, pivot: Vec3): Part[] {
  const face = side === 1 ? 0 : -4;
  const cyl = (pid: string, r: number, h: number, y: number, out: number): Part => ({
    id: pid, tags: ['handle'], geometry: { type: 'cylinder', radius: r, height: h, segments: 20 }, position: [x, y, face + side * out],
    rotation: [90, 0, 0], pivot, material: 'stainless', castShadow: false, glass: false,
  });
  return [
    cyl(`${id}-rose`, 2.6, 0.9, 105, 0.45),
    cyl(`${id}-neck`, 0.9, 4, 105, 2.5),
    { id, tags: ['handle'], geometry: { type: 'box', size: [13, 1.8, 2] }, position: [x - 5, 105, face + side * 4.9], rotation: [0, 0, 0], pivot, material: 'stainless', castShadow: false, glass: false },
    cyl(`${id}-key-rose`, 1.9, 0.8, 92, 0.4),
  ];
}

export function windowParts(params: Record<string, unknown>): Part[] {
  const { W, H, t } = dims(params);
  const F = 6;
  const depth = 7;
  const zc = -t / 2;
  const frame = String(params.frameMaterial ?? 'white-laminate');
  const parts: Part[] = [
    box({ id: 'frame-left', tags: ['frame'], size: [F, H, depth], position: [-W / 2 + F / 2, H / 2, zc], material: frame }),
    box({ id: 'frame-right', tags: ['frame'], size: [F, H, depth], position: [W / 2 - F / 2, H / 2, zc], material: frame }),
    box({ id: 'frame-top', tags: ['frame'], size: [W - 2 * F, F, depth], position: [0, H - F / 2, zc], material: frame }),
    box({ id: 'frame-bottom', tags: ['frame'], size: [W - 2 * F, F, depth], position: [0, F / 2, zc], material: frame }),
    box({ id: 'glass', tags: ['glass', 'pane'], size: [W - 2 * F, H - 2 * F, 0.6], position: [0, H / 2, zc], material: params.glass === 'frosted' ? 'glass-frosted' : 'glass', glass: true }),
  ];
  if (params.sillBoard !== false) {
    parts.push(box({ id: 'sill', tags: ['window sill', 'sill'], size: [W, 2, t / 2 + 6], position: [0, -1, (-t / 2 + 6) / 2], material: 'white-laminate' }));
  }
  return parts;
}

const DEG = Math.PI / 180;

/** `angle` about the vertical (the hinge) on top of the part's own tilt (the roses are cylinders turned 90° about x). */
function swungRotation(own: Vec3, angle: number): Vec3 {
  const m = new Matrix4().makeRotationY(angle * DEG).multiply(new Matrix4().makeRotationFromEuler(new Euler(own[0] * DEG, own[1] * DEG, own[2] * DEG)));
  const e = new Euler().setFromRotationMatrix(m);
  return [e.x / DEG, e.y / DEG, e.z / DEG];
}

/** Closed / open (90° the way the door swings) for a door: everything hung on the hinge (leaf, handles, roses) swings. */
export function doorStates(parts: Part[], angle = -90): AssetState[] {
  const swing = Object.fromEntries(parts.filter((p) => p.pivot).map((p) => [p.id, { rotation: swungRotation(p.rotation, angle) }]));
  return [{ id: 'closed', name: 'Closed', parts: {} }, { id: 'open', name: 'Open', parts: swing }];
}
