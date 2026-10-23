import type { House, Opening, Placement, Room, Vec2 } from './schema';
import { polygonCentroid, resolveWalls, roomBounds } from './geometry';

// One house out of separately modelled rooms. Each room keeps its own coordinates; a placement maps them into
// house space. Rooms are placed by their connected doors: the door in room B lands on the door in room A,
// on the other side of A's wall, facing the other way.

export type { Placement };
export type Doorway = { a: string; b: string; /** the opening whose door leaf is drawn (or null: plain opening) */ door: string | null };
export type Layout = {
  placements: Record<string, Placement>;
  doorways: Doorway[];
  /** openings whose door asset is not drawn, because the other side of the doorway draws it */
  hiddenAssets: Set<string>;
  /** north in house space, as a northAngle (degrees clockwise from -z) */
  northAngle: number;
  issues: string[];
};

const DEG = Math.PI / 180;
const IDENTITY: Placement = { x: 0, z: 0, rotationDeg: 0 };

// same rotation as three.js about +Y, and as item placement: local x -> (cos, -sin), local z -> (sin, cos)
function rotate([x, z]: Vec2, deg: number): Vec2 {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return [x * c + z * s, -x * s + z * c];
}

export function toWorld(p: Vec2, pl: Placement): Vec2 {
  const [x, z] = rotate(p, pl.rotationDeg);
  return [x + pl.x, z + pl.z];
}

export function toLocal(p: Vec2, pl: Placement): Vec2 {
  return rotate([p[0] - pl.x, p[1] - pl.z], -pl.rotationDeg);
}

function normalizeDeg(d: number): number {
  const r = ((d % 360) + 540) % 360 - 180;
  return Math.abs(r) < 1e-9 ? 0 : r;
}

function doorFrame(room: Room, o: Opening) {
  const w = resolveWalls(room).find((x) => x.id === o.wall);
  if (!w) return null;
  const u = o.offset + o.width / 2;
  return { center: [w.start[0] + w.dir[0] * u, w.start[1] + w.dir[1] * u] as Vec2, inward: w.inward, thickness: w.thickness };
}

/** Where room B must go so its door `ob` sits in A's door `oa`, through A's wall. */
function placeThrough(a: Room, pa: Placement, oa: Opening, b: Room, ob: Opening): Placement | null {
  const fa = doorFrame(a, oa);
  const fb = doorFrame(b, ob);
  if (!fa || !fb) return null;
  const outward = rotate([-fa.inward[0], -fa.inward[1]], pa.rotationDeg);
  const doorWorld = toWorld(fa.center, pa);
  const target: Vec2 = [doorWorld[0] + outward[0] * fa.thickness, doorWorld[1] + outward[1] * fa.thickness];
  // B's inside must point the way A's outside points
  const phi = (v: Vec2) => Math.atan2(v[1], v[0]) / DEG;
  const rotationDeg = normalizeDeg(phi(fb.inward) - phi(outward));
  const c = rotate(fb.center, rotationDeg);
  return { x: target[0] - c[0], z: target[1] - c[1], rotationDeg };
}

function northWorld(room: Room, pl: Placement): Vec2 {
  const a = room.northAngle * DEG;
  return rotate([Math.sin(a), -Math.cos(a)], pl.rotationDeg);
}

export function computeLayout(house: House): Layout {
  const rooms = new Map(house.rooms.map((r) => [r.id, r]));
  const manual = house.layout?.placements ?? {};
  const placements: Record<string, Placement> = {};
  const issues: string[] = [];
  const doorways: Doorway[] = [];
  const hiddenAssets = new Set<string>();
  const seenPairs = new Set<string>();

  const anchorId = house.layout?.anchor && rooms.has(house.layout.anchor) ? house.layout.anchor : house.rooms[0]?.id;
  for (const [id, p] of Object.entries(manual)) if (rooms.has(id)) placements[id] = { ...p };
  if (anchorId && !placements[anchorId]) placements[anchorId] = { ...IDENTITY };

  const queue = Object.keys(placements);
  while (queue.length) {
    const a = rooms.get(queue.shift()!)!;
    for (const oa of a.openings) {
      if (!oa.leadsTo) continue;
      const b = rooms.get(oa.leadsTo.room);
      if (!b) continue; // sanity check reports unknown rooms
      const ob = oa.leadsTo.opening
        ? b.openings.find((o) => o.id === oa.leadsTo!.opening)
        : b.openings.find((o) => o.leadsTo?.room === a.id);
      if (!ob) {
        issues.push(`${oa.id}: leads to ${b.id}, but ${b.id} has no door leading back`);
        continue;
      }
      const key = [oa.id, ob.id].sort().join('|');
      if (!seenPairs.has(key)) {
        seenPairs.add(key);
        const door = oa.asset ? oa.id : ob.asset ? ob.id : null;
        doorways.push({ a: oa.id, b: ob.id, door });
        if (oa.asset && ob.asset) hiddenAssets.add(ob.id);
        if (Math.abs(oa.width - ob.width) > 1 || Math.abs(oa.height - ob.height) > 1) {
          issues.push(`${oa.id} and ${ob.id} are one doorway but differ in size: width ${oa.width} vs ${ob.width}, height ${oa.height} vs ${ob.height}`);
        }
      }
      const expected = placeThrough(a, placements[a.id], oa, b, ob);
      if (!expected) continue;
      const existing = placements[b.id];
      if (!existing) {
        placements[b.id] = expected;
        queue.push(b.id);
      } else if (!seenPairs.has(`checked:${key}`)) {
        seenPairs.add(`checked:${key}`);
        const off = Math.hypot(existing.x - expected.x, existing.z - expected.z);
        const turn = Math.abs(normalizeDeg(existing.rotationDeg - expected.rotationDeg));
        if (off > 2 || turn > 1) {
          issues.push(`${oa.id} ↔ ${ob.id}: rooms don't line up at this door (off by ${Math.round(off)} cm, ${Math.round(turn)}°) — a measurement is off somewhere`);
        }
      }
    }
  }

  // rooms with no connection: in a row next to the house, so they still exist in the space
  let edge = -Infinity;
  let top = 0;
  for (const [id, p] of Object.entries(placements)) {
    for (const pt of rooms.get(id)!.footprint) {
      const [x, z] = toWorld(pt, p);
      edge = Math.max(edge, x);
      top = Math.min(top, z);
    }
  }
  if (!Number.isFinite(edge)) edge = 0;
  for (const r of house.rooms) {
    if (placements[r.id]) continue;
    const b = roomBounds(r);
    placements[r.id] = { x: edge + 200 - b.minX, z: top - b.minZ, rotationDeg: 0 };
    edge += 200 + (b.maxX - b.minX);
    issues.push(`${r.id}: not connected to the other rooms (no door with leadsTo) — shown off to the side`);
  }

  // every room should agree where north is
  const anchor = anchorId ? rooms.get(anchorId) : undefined;
  let northAngle = 0;
  if (anchor) {
    const n = northWorld(anchor, placements[anchor.id]);
    northAngle = normalizeDeg(Math.atan2(n[0], -n[1]) / DEG);
    for (const r of house.rooms) {
      if (r.id === anchor.id || !placements[r.id]) continue;
      const m = northWorld(r, placements[r.id]);
      const angle = Math.acos(Math.max(-1, Math.min(1, n[0] * m[0] + n[1] * m[1]))) / DEG;
      if (angle > 5) issues.push(`${r.id}: its northAngle disagrees with ${anchor.id} by ${Math.round(angle)}° once placed by its door — check northAngle or which wall the door is on`);
    }
  }

  issues.push(...crowdedWalls(house.rooms, placements));
  return { placements, doorways, hiddenAssets, northAngle, issues };
}

/** Back-to-back walls of two rooms closer together than the wall is thick (or overlapping). */
function crowdedWalls(rooms: Room[], placements: Record<string, Placement>): string[] {
  type W = { id: string; room: string; a: Vec2; b: Vec2; dir: Vec2; out: Vec2; len: number; t: number };
  const all: W[] = rooms.flatMap((r) => resolveWalls(r).map((w) => {
    const pl = placements[r.id];
    const a = toWorld(w.start, pl);
    const b = toWorld(w.end, pl);
    const dir = rotate(w.dir, pl.rotationDeg);
    const out = rotate([-w.inward[0], -w.inward[1]], pl.rotationDeg);
    return { id: w.id, room: r.id, a, b, dir, out, len: w.length, t: w.thickness };
  }));
  const found: string[] = [];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const p = all[i];
      const q = all[j];
      if (p.room === q.room || p.out[0] * q.out[0] + p.out[1] * q.out[1] > -0.99) continue;
      // gap between the two inner faces, measured outwards from p
      const gap = (q.a[0] - p.a[0]) * p.out[0] + (q.a[1] - p.a[1]) * p.out[1];
      if (gap >= Math.max(p.t, q.t) - 1 || gap < -Math.max(p.t, q.t)) continue;
      // do they actually face each other along their length?
      const u = (v: Vec2) => (v[0] - p.a[0]) * p.dir[0] + (v[1] - p.a[1]) * p.dir[1];
      const lo = Math.max(0, Math.min(u(q.a), u(q.b)));
      const hi = Math.min(p.len, Math.max(u(q.a), u(q.b)));
      if (hi - lo < 5) continue;
      found.push(`${p.id} and ${q.id} are back to back with only ${Math.max(0, Math.round(gap))} cm between them, but the wall is ${Math.max(p.t, q.t)} cm — a room is too big or the wall thickness is off`);
    }
  }
  return found;
}

export type HouseFrame = {
  /** bounding rectangle of all rooms in house space */
  footprint: Vec2[];
  ceilingHeight: number;
  northAngle: number;
  /** a ceiling lamp per room for the night: [x, y, z] in house space */
  lamps: [number, number, number][];
};

/** The whole house as one frame, for the sun, shadows and the plan view. */
export function houseFrame(house: House, layout: Layout): HouseFrame {
  const pts = house.rooms.flatMap((r) => r.footprint.map((p) => toWorld(p, layout.placements[r.id] ?? IDENTITY)));
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const [x0, x1, z0, z1] = pts.length ? [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)] : [0, 100, 0, 100];
  return {
    footprint: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]],
    ceilingHeight: Math.max(250, ...house.rooms.map((r) => r.ceilingHeight)),
    northAngle: layout.northAngle,
    lamps: house.rooms.map((r) => {
      const [x, z] = toWorld(polygonCentroid(r.footprint), layout.placements[r.id] ?? IDENTITY);
      return [x, r.ceilingHeight - 25, z];
    }),
  };
}
