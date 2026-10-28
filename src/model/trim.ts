import type { Room, Vec3 } from './schema';
import { wallSegments, type WallInfo } from './geometry';

// Finishing touches along the walls, in room-local cm: skirting boards and the soft darkening where walls meet the
// floor, the ceiling and each other (a cheap stand-in for ambient occlusion, light enough for phones).

export type SkirtingRun = { wall: string; u0: number; u1: number; height: number; thickness: number; material: string };

/** Skirting material/size for a room: tiled floors get a strip of the same tile, others a white MDF board. */
export function skirtingStyle(room: Room): { material: string; height: number; thickness: number } {
  const floor = room.floor.material;
  return floor.startsWith('tiles') ? { material: floor, height: 8, thickness: 1 } : { material: 'white-laminate', height: 7, thickness: 1.5 };
}

const tiled = (w: WallInfo) => (w.material ?? '').startsWith('tiles');

/** Is the corner at the end of wall i (start of wall i+1) an outside corner (sticking into the room)? */
function convexAfter(walls: WallInfo[], i: number): boolean {
  const w = walls[i];
  const next = walls[(i + 1) % walls.length];
  return next.dir[0] * w.inward[0] + next.dir[1] * w.inward[1] < -1e-6;
}

/** The pieces of wall face that reach the floor (openings that come down to the floor cut them), per wall. */
function floorRuns(room: Room, w: WallInfo): { u0: number; u1: number }[] {
  const runs = wallSegments(w, room.openings, room.ceilingHeight).filter((r) => r.y0 <= 0).map((r) => ({ u0: r.u0, u1: r.u1 })).sort((a, b) => a.u0 - b.u0);
  const merged: { u0: number; u1: number }[] = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last && r.u0 <= last.u1 + 0.01) last.u1 = Math.max(last.u1, r.u1);
    else merged.push({ ...r });
  }
  return merged;
}

/**
 * Skirting boards along every wall face that reaches the floor, except tiled walls (bathrooms). Runs stop at doors and
 * floor-level openings and are lengthened by their thickness round outside corners so the ends meet.
 */
export function skirtingRuns(room: Room, walls: WallInfo[]): SkirtingRun[] {
  const style = skirtingStyle(room);
  const out: SkirtingRun[] = [];
  walls.forEach((w, i) => {
    if (tiled(w)) return;
    const prevConvex = convexAfter(walls, (i + walls.length - 1) % walls.length);
    const nextConvex = convexAfter(walls, i);
    for (const r of floorRuns(room, w)) {
      const u0 = r.u0 <= 0.01 && prevConvex ? -style.thickness : r.u0;
      const u1 = r.u1 >= w.length - 0.01 && nextConvex ? w.length + style.thickness : r.u1;
      if (u1 - u0 >= 2) out.push({ wall: w.id, u0, u1, ...style });
    }
  });
  return out;
}

/** A shading quad: four corners (room-local cm) with the darkness (0..1) at each; drawn as two triangles 0-1-2, 0-2-3. */
export type ShadeQuad = { p: [Vec3, Vec3, Vec3, Vec3]; a: [number, number, number, number] };

type Band = { along: [number, number]; at: (u: number, s: number) => Vec3 };

/** A soft band: darkness `a` at s = 0 falling to 0 at s = width (two quads, fast falloff near the edge). */
function band(b: Band, width: number, a: number): ShadeQuad[] {
  const [u0, u1] = b.along;
  const mid = width * 0.3;
  const am = a * 0.38;
  return [
    { p: [b.at(u0, 0), b.at(u1, 0), b.at(u1, mid), b.at(u0, mid)], a: [a, a, am, am] },
    { p: [b.at(u0, mid), b.at(u1, mid), b.at(u1, width), b.at(u0, width)], a: [am, am, 0, 0] },
  ];
}

export type CornerShade = { floor: ShadeQuad[]; ceiling: ShadeQuad[] };

/**
 * Darkening along the wall/floor joints (on both surfaces), the wall/ceiling joints and the inside vertical corners.
 * `floor` belongs with the floor and walls, `ceiling` with the ceiling (hidden in the plan view). Surfaces are lifted
 * `lift` cm so the quads never fight with what they cover.
 */
export function cornerShade(room: Room, walls: WallInfo[], strength = 0.32, lift = 0.25): CornerShade {
  const floor: ShadeQuad[] = [];
  const ceiling: ShadeQuad[] = [];
  const H = room.ceilingHeight;
  const point = (w: WallInfo, u: number, y: number, inset: number): Vec3 => [
    w.start[0] + w.dir[0] * u + w.inward[0] * inset, y, w.start[1] + w.dir[1] * u + w.inward[1] * inset,
  ];
  walls.forEach((w, i) => {
    // skirting covers the bottom few cm, so the floor-joint darkening sits on the floor and on the wall above it
    const skirt = tiled(w) ? 0 : skirtingStyle(room).height;
    for (const r of floorRuns(room, w)) {
      floor.push(...band({ along: [r.u0, r.u1], at: (u, s) => point(w, u, lift, s) }, 22, strength));
      floor.push(...band({ along: [r.u0, r.u1], at: (u, s) => point(w, u, skirt + s, lift) }, 26, strength * 0.7));
    }
    const top = wallSegments(w, room.openings, H).filter((r) => r.y1 >= H - 0.01);
    for (const r of top) {
      ceiling.push(...band({ along: [r.u0, r.u1], at: (u, s) => point(w, u, H - lift, s) }, 24, strength * 0.8));
      ceiling.push(...band({ along: [r.u0, r.u1], at: (u, s) => point(w, u, H - s, lift) }, 24, strength * 0.8));
    }
    // inside vertical corner at the end of this wall: a band on each of the two walls, where both are solid full height
    const next = walls[(i + 1) % walls.length];
    if (convexAfter(walls, i)) return;
    const full = (x: WallInfo, atEnd: boolean) => wallSegments(x, room.openings, H).some((r) => r.y0 <= 0 && r.y1 >= H - 0.01 && (atEnd ? r.u1 >= x.length - 0.01 : r.u0 <= 0.01));
    if (!full(w, true) || !full(next, false)) return;
    const vert = (x: WallInfo, u: number, dir: 1 | -1): Band => ({ along: [0, H], at: (y, s) => point(x, u + dir * s, y, lift) });
    // here `along` runs up the corner (u = height) and s away from it along the wall
    floor.push(...band(vert(w, w.length, -1), 18, strength * 0.6));
    floor.push(...band(vert(next, 0, 1), 18, strength * 0.6));
  });
  return { floor, ceiling };
}
