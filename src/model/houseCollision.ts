import type { FurnitureAsset, House, Opening, Vec2 } from './schema';
import { assetSize, findState, initialState } from './assets';
import { pointInPolygon, polygonCentroid, resolveWalls } from './geometry';
import { buildColliders, isFree, nearestFree, type Collider } from './collision';
import { toLocal, toWorld, type Layout } from './layout';
import { placeRoomItems } from './placement';

// Collision for the whole house in house coordinates: every room's walls and furniture, with the walls open
// at connected doorways — unless the door there is closed.

function isOpen(o: Opening, furniture: Record<string, FurnitureAsset>, itemStates: Record<string, string>): boolean {
  const asset = o.asset ? furniture[o.asset] : undefined;
  if (!asset || asset.states.length < 2) return true;
  return initialState(asset, o, itemStates[o.id]).includes('open');
}

export function buildHouseColliders(
  house: House, layout: Layout, furniture: Record<string, FurnitureAsset>, itemStates: Record<string, string>,
): Collider[] {
  const openings = new Map(house.rooms.flatMap((r) => r.openings.map((o) => [o.id, o] as const)));
  // openings you can walk through right now
  const passable = new Set<string>();
  for (const d of layout.doorways) {
    const door = d.door ? openings.get(d.door) : undefined;
    if (!door || isOpen(door, furniture, itemStates)) {
      passable.add(d.a);
      passable.add(d.b);
    }
  }

  const colliders: Collider[] = [];
  for (const room of house.rooms) {
    const pl = layout.placements[room.id];
    if (!pl) continue;
    const walls = resolveWalls(room);
    for (const w of walls) {
      const gaps = room.openings
        .filter((o) => o.wall === w.id && passable.has(o.id))
        .map((o) => [o.offset, o.offset + o.width] as const)
        .sort((a, b) => a[0] - b[0]);
      let u = 0;
      const at = (t: number): Vec2 => toWorld([w.start[0] + w.dir[0] * t, w.start[1] + w.dir[1] * t], pl);
      for (const [g0, g1] of gaps) {
        if (g0 > u) colliders.push({ kind: 'segment', a: at(u), b: at(g0) });
        u = Math.max(u, g1);
      }
      if (u < w.length) colliders.push({ kind: 'segment', a: at(u), b: at(w.length) });
    }
    const items = placeRoomItems(room, furniture, walls, itemStates).map((p) => {
      const [x, z] = toWorld([p.position[0], p.position[2]], pl);
      const state = findState(p.asset, p.stateId);
      return {
        position: [x, p.position[1], z] as [number, number, number], rotationDeg: p.rotationDeg + pl.rotationDeg,
        min: p.size.min, max: p.size.max, parts: p.parts.map((part) => assetSize([part], state)),
      };
    });
    colliders.push(...buildColliders([], items));
  }
  return colliders;
}

/** Which room a house-space point is in (null: in a doorway / wall, or outside). */
export function roomAt(p: Vec2, house: House, layout: Layout): string | null {
  for (const r of house.rooms) {
    const pl = layout.placements[r.id];
    if (pl && pointInPolygon(toLocal(p, pl), r.footprint)) return r.id;
  }
  return null;
}

/** House-space centre of every connected doorway (taken from its first opening), with its width. */
function doorwayCentres(house: House, layout: Layout): { c: Vec2; width: number }[] {
  const out: { c: Vec2; width: number }[] = [];
  for (const d of layout.doorways) {
    const room = house.rooms.find((r) => r.openings.some((o) => o.id === d.a));
    const o = room?.openings.find((x) => x.id === d.a);
    const w = room && o && resolveWalls(room).find((x) => x.id === o.wall);
    if (!room || !o || !w) continue;
    const u = o.offset + o.width / 2;
    out.push({ c: toWorld([w.start[0] + w.dir[0] * u, w.start[1] + w.dir[1] * u], layout.placements[room.id]), width: o.width });
  }
  return out;
}

/**
 * Where the player should be after the house changed (door closed on them, furniture toggled, a room resized):
 * unchanged if free and inside a room or a doorway, else the nearest free spot in their current room.
 */
export function resolveHousePosition(
  p: Vec2, house: House, layout: Layout, colliders: Collider[], radius: number, roomId: string | null,
): Vec2 {
  const inDoorway = doorwayCentres(house, layout).some((d) => Math.hypot(p[0] - d.c[0], p[1] - d.c[1]) < d.width / 2 + 30);
  if (isFree(p, radius, colliders) && (roomAt(p, house, layout) || inDoorway)) return p;
  const room = house.rooms.find((r) => r.id === roomId) ?? house.rooms[0];
  if (!room) return p;
  const pl = layout.placements[room.id];
  const footprint = room.footprint.map((q) => toWorld(q, pl));
  const near = nearestFree(p, radius, colliders, footprint);
  if (isFree(near, radius, colliders) && pointInPolygon(near, footprint)) return near;
  // far away: start from the middle of the room
  return nearestFree(toWorld(polygonCentroid(room.footprint), pl), radius, colliders, footprint);
}
