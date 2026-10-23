import type { Item, Opening, Room, Vec2, Vec3 } from './schema';

// Room-local space: footprint points are [x, z] in cm. Seen from above with -z pointing up,
// `northAngle` is the direction of north in degrees clockwise from -z.

export type WallInfo = {
  id: string;
  edge: number;
  start: Vec2;
  end: Vec2;
  dir: Vec2;
  length: number;
  inward: Vec2;
  thickness: number;
  tags: string[];
  material?: string;
};

export type Compass = 'north' | 'east' | 'south' | 'west';

const DEG = Math.PI / 180;

export function signedArea(poly: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
}

export function compassOf(outward: Vec2, northAngle: number): Compass | null {
  const a = northAngle * DEG;
  const north: Vec2 = [Math.sin(a), -Math.cos(a)];
  const east: Vec2 = [Math.cos(a), Math.sin(a)];
  const dn = outward[0] * north[0] + outward[1] * north[1];
  const de = outward[0] * east[0] + outward[1] * east[1];
  const tolerance = Math.cos(10 * DEG);
  if (dn >= tolerance) return 'north';
  if (dn <= -tolerance) return 'south';
  if (de >= tolerance) return 'east';
  if (de <= -tolerance) return 'west';
  return null;
}

export function resolveWalls(room: Room): WallInfo[] {
  const poly = room.footprint;
  const ccw = signedArea(poly) > 0;
  return poly.map((start, edge) => {
    const end = poly[(edge + 1) % poly.length];
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const length = Math.hypot(dx, dz);
    const dir: Vec2 = [dx / length, dz / length];
    const inward: Vec2 = ccw ? [-dir[1], dir[0]] : [dir[1], -dir[0]];
    const stored = room.walls.find((w) => w.edge === edge);
    const compass = compassOf([-inward[0], -inward[1]], room.northAngle);
    const tags = [...(stored?.tags ?? [])];
    if (compass && !tags.includes(`${compass} wall`)) tags.push(`${compass} wall`);
    return {
      id: stored?.id ?? `${room.id}.wall-${edge}`,
      edge,
      start,
      end,
      dir,
      length,
      inward,
      thickness: stored?.thickness ?? 10,
      tags,
      material: stored?.material ?? room.wallMaterial,
    };
  });
}

export type WallRect = { u0: number; u1: number; y0: number; y1: number };

/** Rectangles (u along the wall from its start, y up) that make up the wall minus its openings. */
export function wallSegments(wall: WallInfo, openings: Opening[], ceilingHeight: number): WallRect[] {
  const holes = openings
    .filter((o) => o.wall === wall.id)
    .map((o) => ({
      u0: Math.max(0, o.offset),
      u1: Math.min(wall.length, o.offset + o.width),
      y0: Math.max(0, o.sill),
      y1: Math.min(ceilingHeight, o.sill + o.height),
    }))
    .filter((h) => h.u1 > h.u0)
    .sort((a, b) => a.u0 - b.u0);

  const rects: WallRect[] = [];
  let u = 0;
  for (const h of holes) {
    if (h.u0 > u) rects.push({ u0: u, u1: h.u0, y0: 0, y1: ceilingHeight });
    if (h.y0 > 0) rects.push({ u0: h.u0, u1: h.u1, y0: 0, y1: h.y0 });
    if (h.y1 < ceilingHeight) rects.push({ u0: h.u0, u1: h.u1, y0: h.y1, y1: ceilingHeight });
    u = Math.max(u, h.u1);
  }
  if (u < wall.length) rects.push({ u0: u, u1: wall.length, y0: 0, y1: ceilingHeight });
  return rects;
}

/**
 * Item origin is the back-centre of the item on the floor; item-local +z points out of its front.
 * `against` puts the back on the wall, the front facing into the room, `offset` cm from the wall's
 * start corner to the item's nearest edge.
 */
export function resolveItemTransform(
  item: Item,
  size: { w: number; d: number },
  walls: WallInfo[],
): { position: Vec3; rotationDeg: number } {
  if (!item.against) return { position: item.position ?? [0, 0, 0], rotationDeg: item.rotation };
  const wall = walls.find((w) => w.id === item.against!.wall);
  if (!wall) return { position: [0, 0, 0], rotationDeg: item.rotation };
  const { offset, gap, elevation } = item.against;
  const along = offset + size.w / 2;
  const x = wall.start[0] + wall.dir[0] * along + wall.inward[0] * gap;
  const z = wall.start[1] + wall.dir[1] * along + wall.inward[1] * gap;
  const rotationDeg = Math.atan2(wall.inward[0], wall.inward[1]) / DEG;
  return { position: [x, elevation, z], rotationDeg };
}

export function roomBounds(room: Room) {
  const xs = room.footprint.map((p) => p[0]);
  const zs = room.footprint.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > p[1] !== zj > p[1] && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function polygonCentroid(poly: Vec2[]): Vec2 {
  const a = signedArea(poly);
  if (Math.abs(a) < 1e-9) return [poly[0][0], poly[0][1]];
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    const f = x1 * z2 - x2 * z1;
    cx += (x1 + x2) * f;
    cz += (z1 + z2) * f;
  }
  return [cx / (6 * a), cz / (6 * a)];
}

const WINDS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

/** Compass bearing (0 = north, clockwise) and 8-wind name for a camera yaw (0 looks towards -z, positive turns left). */
export function facing(yawDeg: number, northAngle: number): { bearing: number; compass: string } {
  const f: Vec2 = [-Math.sin(yawDeg * DEG), -Math.cos(yawDeg * DEG)];
  const a = northAngle * DEG;
  const n = f[0] * Math.sin(a) + f[1] * -Math.cos(a);
  const e = f[0] * Math.cos(a) + f[1] * Math.sin(a);
  const bearing = (Math.round(Math.atan2(e, n) / DEG) + 360) % 360;
  return { bearing, compass: WINDS[Math.round(bearing / 45) % 8] };
}
