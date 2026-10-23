import type { Room, Vec2, Vec3 } from './schema';
import { pointInPolygon, polygonCentroid, roomBounds, type WallInfo } from './geometry';

export type Collider =
  | { kind: 'segment'; a: Vec2; b: Vec2 }
  | { kind: 'obb'; center: Vec2; half: Vec2; angleDeg: number };

export type PlacedBounds = { position: Vec3; rotationDeg: number; min: Vec3; max: Vec3 };

// Anything whose bottom is above this (cm) is treated as wall-mounted and doesn't block walking.
const OVERHEAD = 150;
const DEG = Math.PI / 180;

/** Rooms are isolated for now, so every wall is solid (doors don't lead anywhere yet). */
export function buildColliders(walls: WallInfo[], items: PlacedBounds[]): Collider[] {
  const colliders: Collider[] = walls.map((w) => ({ kind: 'segment', a: w.start, b: w.end }));
  for (const it of items) {
    if (it.position[1] + it.min[1] > OVERHEAD) continue;
    const lx = (it.min[0] + it.max[0]) / 2;
    const lz = (it.min[2] + it.max[2]) / 2;
    const [rx, rz] = rotate([lx, lz], it.rotationDeg);
    colliders.push({
      kind: 'obb',
      center: [it.position[0] + rx, it.position[2] + rz],
      half: [(it.max[0] - it.min[0]) / 2, (it.max[2] - it.min[2]) / 2],
      angleDeg: it.rotationDeg,
    });
  }
  return colliders;
}

// Same convention as three.js rotation about +Y: local x -> (cos, -sin), local z -> (sin, cos).
function rotate([x, z]: Vec2, deg: number): Vec2 {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return [x * c + z * s, -x * s + z * c];
}

/** Vector from the collider's closest point to p, and whether p is inside (for boxes). */
function separation(p: Vec2, col: Collider): { dx: number; dz: number; inside: boolean } {
  if (col.kind === 'segment') {
    const [ax, az] = col.a;
    const ex = col.b[0] - ax;
    const ez = col.b[1] - az;
    const len2 = ex * ex + ez * ez || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * ex + (p[1] - az) * ez) / len2));
    return { dx: p[0] - (ax + ex * t), dz: p[1] - (az + ez * t), inside: false };
  }
  const local = rotate([p[0] - col.center[0], p[1] - col.center[1]], -col.angleDeg);
  const [hx, hz] = col.half;
  const inside = Math.abs(local[0]) < hx && Math.abs(local[1]) < hz;
  let d: Vec2;
  if (inside) {
    // push out through the nearest face
    const px = hx - Math.abs(local[0]);
    const pz = hz - Math.abs(local[1]);
    d = px < pz ? [-Math.sign(local[0] || 1) * px, 0] : [0, -Math.sign(local[1] || 1) * pz];
  } else {
    const cx = Math.max(-hx, Math.min(hx, local[0]));
    const cz = Math.max(-hz, Math.min(hz, local[1]));
    d = [local[0] - cx, local[1] - cz];
  }
  const [dx, dz] = rotate(d, col.angleDeg);
  return { dx, dz, inside };
}

function pushOut(p: Vec2, radius: number, colliders: Collider[]): Vec2 {
  let [x, z] = p;
  for (let iter = 0; iter < 4; iter++) {
    let moved = false;
    for (const col of colliders) {
      const { dx, dz, inside } = separation([x, z], col);
      const dist = Math.hypot(dx, dz);
      if (inside) {
        // dx,dz points from p to the nearest face; move past it by the radius
        const n = dist || 1;
        x += dx + (dx / n) * radius;
        z += dz + (dz / n) * radius;
        moved = true;
      } else if (dist < radius) {
        const n = dist || 1;
        x += (dx / n) * (radius - dist);
        z += (dz / n) * (radius - dist);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return [x, z];
}

/** Move a circle of `radius` by `delta`, sliding along anything it hits. */
export function moveWithCollision(pos: Vec2, delta: Vec2, radius: number, colliders: Collider[]): Vec2 {
  const steps = Math.max(1, Math.ceil(Math.hypot(delta[0], delta[1]) / (radius / 2)));
  let p: Vec2 = [...pos];
  for (let i = 0; i < steps; i++) {
    const next = pushOut([p[0] + delta[0] / steps, p[1] + delta[1] / steps], radius, colliders);
    // squeezed into a gap narrower than the player: stay where we were
    if (!isFree(next, radius, colliders)) break;
    p = next;
  }
  return p;
}

/** Closest free spot to p inside the footprint (rings of 5 cm out to 3 m), for getting unstuck after furniture changes. */
export function nearestFree(p: Vec2, radius: number, colliders: Collider[], footprint?: Vec2[]): Vec2 {
  const inside = (q: Vec2) => !footprint || pointInPolygon(q, footprint);
  if (isFree(p, radius, colliders) && inside(p)) return p;
  for (let r = 5; r <= 300; r += 5) {
    const n = Math.max(8, Math.round((2 * Math.PI * r) / 5));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 2 * Math.PI;
      const q: Vec2 = [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
      if (inside(q) && isFree(q, radius, colliders)) return q;
    }
  }
  return p;
}

export function isFree(p: Vec2, radius: number, colliders: Collider[]): boolean {
  return colliders.every((col) => {
    const { dx, dz, inside } = separation(p, col);
    return !inside && Math.hypot(dx, dz) >= radius - 1e-6;
  });
}

/** Room centre if free, otherwise the free grid point closest to it. */
export function findFreeSpawn(room: Room, colliders: Collider[], radius: number): Vec2 {
  const centre = polygonCentroid(room.footprint);
  const ok = (p: Vec2) => pointInPolygon(p, room.footprint) && isFree(p, radius, colliders);
  if (ok(centre)) return centre;
  const b = roomBounds(room);
  let best: Vec2 | null = null;
  let bestD = Infinity;
  for (let x = b.minX + radius; x <= b.maxX - radius; x += 10) {
    for (let z = b.minZ + radius; z <= b.maxZ - radius; z += 10) {
      const d = Math.hypot(x - centre[0], z - centre[1]);
      if (d < bestD && ok([x, z])) {
        best = [x, z];
        bestD = d;
      }
    }
  }
  return best ?? centre;
}
