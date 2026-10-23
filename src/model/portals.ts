import type { Opening, Room, Vec2 } from './schema';
import type { WallInfo } from './geometry';

const EDGE = 5; // cm kept free at each side of the door, so brushing past the frame doesn't count
const REACH = 8; // cm beyond the player radius: collision stops you at `radius` from the wall

/**
 * The door with `leadsTo` the player is walking into: standing in front of it (within its width, against the
 * wall) and moving towards the wall. Rooms aren't placed on a floorplan yet, so this is how you go from room to room.
 */
export function portalAt(pos: Vec2, move: Vec2, room: Room, walls: WallInfo[], radius: number): Opening | null {
  for (const o of room.openings) {
    if (!o.leadsTo) continue;
    const w = walls.find((x) => x.id === o.wall);
    if (!w) continue;
    const rx = pos[0] - w.start[0];
    const rz = pos[1] - w.start[1];
    const u = rx * w.dir[0] + rz * w.dir[1];
    const v = rx * w.inward[0] + rz * w.inward[1];
    const towards = move[0] * w.inward[0] + move[1] * w.inward[1] < 0;
    if (towards && u >= o.offset + EDGE && u <= o.offset + o.width - EDGE && v < radius + REACH) return o;
  }
  return null;
}
