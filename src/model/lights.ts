import type { Part, Placement, Room, Vec3 } from './schema';
import type { PlacedItem } from './placement';
import { polygonCentroid, signedArea } from './geometry';
import { toWorld } from './layout';

// Room lights: every room has its ceiling light(s). Lamp items (parts with `emit: point`) are the room's lights;
// a room without any gets one plain ceiling light in its middle. Positions are in house space.
// One switch for the whole house: ⚫ off, 🕯 cozy (decorative lamps only), 💡 work (everything).

export type LampRole = 'functional' | 'decorative';
export type Lamp = { room: string; position: Vec3; intensity: number; color: string; role: LampRole };

export type LightMode = 'off' | 'cozy' | 'work';

export const LIGHT_MODES: { id: LightMode; icon: string; name: string }[] = [
  { id: 'off', icon: '⚫', name: 'Lights off' },
  { id: 'cozy', icon: '🕯️', name: 'Cozy' },
  { id: 'work', icon: '💡', name: 'Work' },
];

export function isLightMode(v: unknown): v is LightMode {
  return LIGHT_MODES.some((m) => m.id === v);
}

export function lampOn(role: LampRole | undefined, mode: LightMode): boolean {
  return mode === 'work' || (mode === 'cozy' && role === 'decorative');
}

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
      out.push({ room: room.id, position: world(x, p.position[1] + ly, z), intensity: part.emit.intensity, color: part.emit.color, role: part.emit.role ?? 'functional' });
    }
  }
  if (!out.length) {
    const [cx, cz] = polygonCentroid(room.footprint);
    out.push({ room: room.id, position: world(cx, room.ceilingHeight - 25, cz), role: 'functional', ...DEFAULT_LAMP });
  }
  return out;
}

/**
 * Which lit lamps get one of the `slots` real lights: the nearest to `from` (where you stand), whatever room they're
 * in - lamps cast shadows, so one behind a wall adds nothing and one through a doorway lights it like it would
 * (walking from a lit room into the hallway doesn't switch the light off behind you).
 * A fixed number of lights (unused ones dark) means three.js never recompiles shaders when a light goes on or off.
 * `prev` keeps a lamp that stays chosen in the same slot, so walking around only moves the lights that change.
 */
export function assignLampSlots(lamps: Lamp[], isOn: (lamp: Lamp) => boolean, from: [number, number], slots: number, prev: (Lamp | undefined)[] = []): (Lamp | undefined)[] {
  const d = (l: Lamp) => Math.hypot(l.position[0] - from[0], l.position[2] - from[1]);
  const chosen = lamps.filter(isOn).sort((a, b) => d(a) - d(b)).slice(0, slots);
  const out: (Lamp | undefined)[] = Array.from({ length: slots }, (_, i) => (prev[i] && chosen.includes(prev[i]!) ? prev[i] : undefined));
  for (const l of chosen) if (!out.includes(l)) out[out.indexOf(undefined)] = l;
  return out;
}

/**
 * How much daylight reaches a room (0.2..1, in steps of 0.1): from its glazing (windows, glass sliding doors) and,
 * weaker, open doorways into other rooms, per m² of floor. A windowless bathroom is dim; the living room with its
 * balcony doors is full. Times the mood's daylight it's how bright the room you stand in is (see lampScale).
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

/**
 * How strong the lamps are, like eyes adapting (Mark): full at night, a quarter in a sunny room by day.
 * `dayLevel` = the mood's daylight (0..1) x the daylight of the room you stand in.
 */
export function lampScale(dayLevel: number): number {
  return 1 / (1 + 3 * dayLevel);
}
