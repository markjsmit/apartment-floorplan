import type { Part, Placement, Room, Vec3 } from './schema';
import type { PlacedItem } from './placement';
import { polygonCentroid, signedArea } from './geometry';
import { toWorld } from './layout';

// Room lights: every room has its ceiling light(s). Lamp items (parts with `emit: point`) are the room's lights;
// a room without any gets one plain ceiling light in its middle. Positions are in house space.

export type Lamp = { room: string; position: Vec3; intensity: number; color: string };

/** Light of a room with no lamp item: one ceiling light, 25 cm under the ceiling in the middle of the room. */
export const DEFAULT_LAMP = { intensity: 30000, color: '#ffe2bd' };

const DEG = Math.PI / 180;

function partHeight(p: Part): number {
  const g = p.geometry;
  return g?.type === 'box' ? g.size[1] : g?.type === 'cylinder' ? g.height : 0;
}

export function roomLamps(room: Room, placed: PlacedItem[], placement: Placement): Lamp[] {
  const out: Lamp[] = [];
  const world = (x: number, y: number, z: number): Vec3 => {
    const [wx, wz] = toWorld([x, z], placement);
    return [wx, y, wz];
  };
  for (const p of placed) {
    const r = p.rotationDeg * DEG;
    for (const part of p.parts) {
      if (part.emit?.kind !== 'point') continue;
      // the light sits just under the part's bottom face (like the one PartsView used to hang off the diffuser)
      const [lx, ly, lz] = [part.position[0], part.position[1] - partHeight(part) / 2 - 2, part.position[2]];
      const x = p.position[0] + lx * Math.cos(r) + lz * Math.sin(r);
      const z = p.position[2] - lx * Math.sin(r) + lz * Math.cos(r);
      out.push({ room: room.id, position: world(x, p.position[1] + ly, z), intensity: part.emit.intensity, color: part.emit.color });
    }
  }
  if (!out.length) {
    const [cx, cz] = polygonCentroid(room.footprint);
    out.push({ room: room.id, position: world(cx, room.ceilingHeight - 25, cz), ...DEFAULT_LAMP });
  }
  return out;
}

/**
 * Which lit lamps get one of the `slots` real lights: the active room's first, then the nearest to `from`.
 * A fixed number of lights (unused ones dark) means three.js never recompiles shaders when a light goes on or off.
 */
export function assignLampSlots(lamps: Lamp[], isOn: (room: string) => boolean, activeRoom: string | null, from: [number, number], slots: number): Lamp[] {
  const d = (l: Lamp) => Math.hypot(l.position[0] - from[0], l.position[2] - from[1]);
  return lamps
    .filter((l) => isOn(l.room))
    .sort((a, b) => (a.room === activeRoom ? 0 : 1) - (b.room === activeRoom ? 0 : 1) || d(a) - d(b))
    .slice(0, slots);
}

/** Room lights follow the sun (on after dark) unless switched by hand (💡 / double-clicking a lamp). */
export function roomLightOn(overrides: Record<string, boolean>, roomId: string, sunDown: boolean): boolean {
  return overrides[roomId] ?? sunDown;
}

/**
 * How much daylight reaches a room's walls indirectly (0.2..1, in steps of 0.1): from its glazing (windows, glass
 * sliding doors) and, weaker, open doorways into other rooms, per m² of floor. A windowless bathroom is dim in the
 * day unless its light is on; the living room with its balcony doors is fully lit. Scales the sky/bounce fill only.
 */
export function roomDaylight(room: Room): number {
  const area = (o: { width: number; height: number }) => (o.width * o.height) / 10000;
  let glazed = 0;
  let open = 0;
  for (const o of room.openings) {
    if (o.type === 'window' || o.asset === 'sliding-door') glazed += area(o);
    else if (o.type === 'opening') open += area(o);
  }
  const floor = Math.abs(signedArea(room.footprint)) / 10000;
  const k = 0.2 + (4 * (glazed + 0.15 * open)) / Math.max(1, floor);
  return Math.round(Math.min(1, Math.max(0.2, k)) * 10) / 10;
}
