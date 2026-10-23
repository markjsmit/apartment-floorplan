import type { Part, Vec3 } from '../schema';

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

export function door(params: Record<string, unknown>): Part[] {
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
    box({ id: 'leaf', tags: ['door leaf', 'door'], size: [leafW, leafH, 4], position: [-W / 2 + F + 0.3 + leafW / 2, 0.5 + leafH / 2, -2], material: 'white-laminate', pivot: hinge }),
    box({ id: 'handle-in', tags: ['handle'], size: [12, 2, 2], position: [handleX, 105, 2], material: 'metal-black', pivot: hinge }),
    box({ id: 'handle-out', tags: ['handle'], size: [12, 2, 2], position: [handleX, 105, -6], material: 'metal-black', pivot: hinge }),
  ];
}

export function windowParts(params: Record<string, unknown>): Part[] {
  const { W, H, t } = dims(params);
  const F = 6;
  const depth = 7;
  const zc = -t / 2;
  return [
    box({ id: 'frame-left', tags: ['frame'], size: [F, H, depth], position: [-W / 2 + F / 2, H / 2, zc], material: 'white-laminate' }),
    box({ id: 'frame-right', tags: ['frame'], size: [F, H, depth], position: [W / 2 - F / 2, H / 2, zc], material: 'white-laminate' }),
    box({ id: 'frame-top', tags: ['frame'], size: [W - 2 * F, F, depth], position: [0, H - F / 2, zc], material: 'white-laminate' }),
    box({ id: 'frame-bottom', tags: ['frame'], size: [W - 2 * F, F, depth], position: [0, F / 2, zc], material: 'white-laminate' }),
    box({ id: 'glass', tags: ['glass', 'pane'], size: [W - 2 * F, H - 2 * F, 0.6], position: [0, H / 2, zc], material: 'glass', glass: true }),
    box({ id: 'sill', tags: ['window sill', 'sill'], size: [W, 2, t / 2 + 6], position: [0, -1, (-t / 2 + 6) / 2], material: 'white-laminate' }),
  ];
}
