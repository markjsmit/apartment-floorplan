import type { FurnitureAsset, House, Opening } from './schema';
import { signedArea } from './geometry';
import type { Layout } from './layout';
import { findState, initialState, openingParams, resolveAsset } from './assets';

// How easily daylight gets into each room (0..1), a rough estimate instead of real light bouncing (Mark): its own
// windows count most, then light from the rooms next to it through open doorways - less with every room further
// away, nothing through a closed door or a wall. The renderer turns it into the room's base light per mood.

const area = (o: Pick<Opening, 'width' | 'height'>) => (o.width * o.height) / 10000;

/** A glazed door (balcony slider) lets light through even when it's shut. An interior glass panel isn't daylight. */
const glazed = (o: Opening) => (o.type === 'window' && !o.tags.includes('glass panel')) || o.asset === 'sliding-door';

/** Light passes it shut or open: glazing, or a door with a glass leaf (the frosted en-suite door - Mark). */
const seeThrough = (o: Opening) => glazed(o) || String(o.params?.leaf ?? '').includes('glass') || o.tags.includes('glass door');

/** Is the door in this opening open right now (the generated door's states, not the bare asset.json's). */
function doorOpen(o: Opening, furniture: Record<string, FurnitureAsset>, itemStates: Record<string, string>): boolean {
  const raw = o.asset ? furniture[o.asset] : undefined;
  if (!raw) return true;
  const asset = resolveAsset(raw, openingParams(raw, o));
  if (asset.states.length < 2) return true;
  const state = initialState(asset, o, itemStates[o.id]);
  return state.includes('open') && !!findState(asset, state);
}

/** Daylight from the room's own glazing: ~1 m² of window per 4 m² of floor is a fully lit room. Outdoors is 1. */
export function ownLight(room: House['rooms'][number]): number {
  if (room.tags.includes('outside')) return 1;
  // a glass door to the balcony is as much a window as one in the wall
  const glass = room.openings.filter(glazed).reduce((s, o) => s + area(o), 0);
  const floor = Math.abs(signedArea(room.footprint)) / 10000;
  return Math.min(1, (4 * glass) / Math.max(1, floor));
}

export function roomLightAccess(
  house: House, layout: Layout, furniture: Record<string, FurnitureAsset>, itemStates: Record<string, string>,
): Record<string, number> {
  const rooms = new Map(house.rooms.map((r) => [r.id, r]));
  const openings = new Map(house.rooms.flatMap((r) => r.openings.map((o) => [o.id, o] as const)));
  const roomOf = (openingId: string) => openingId.slice(0, openingId.indexOf('.'));
  const floor = (id: string) => Math.max(1, Math.abs(signedArea(rooms.get(id)!.footprint)) / 10000);

  // how much of a neighbour's light passes each doorway, per side: a big opening into a small room passes more
  const links: { from: string; to: string; t: number }[] = [];
  for (const d of layout.doorways) {
    const [oa, ob] = [openings.get(d.a), openings.get(d.b)];
    if (!oa || !ob) continue;
    const door = d.door ? openings.get(d.door) : undefined;
    const pass = !door || doorOpen(door, furniture, itemStates) || seeThrough(oa) || seeThrough(ob) ? 1 : 0;
    if (!pass) continue;
    const a = Math.min(area(oa), area(ob));
    const [ra, rb] = [roomOf(oa.id), roomOf(ob.id)];
    if (!rooms.has(ra) || !rooms.has(rb)) continue;
    links.push({ from: rb, to: ra, t: Math.min(0.5, (1.5 * a) / floor(ra)) });
    links.push({ from: ra, to: rb, t: Math.min(0.5, (1.5 * a) / floor(rb)) });
  }

  const own = Object.fromEntries(house.rooms.map((r) => [r.id, ownLight(r)]));
  // the brightest neighbour fills what the room's own windows leave dark (the best way in counts, so light doesn't
  // bounce back and forth adding up); a few rounds is enough for light to reach 3-4 rooms deep
  let level = { ...own };
  for (let i = 0; i < 6; i++) {
    const best: Record<string, number> = {};
    for (const l of links) best[l.to] = Math.max(best[l.to] ?? 0, level[l.from] * l.t);
    level = Object.fromEntries(Object.entries(own).map(([id, o]) => [id, o + (1 - o) * (best[id] ?? 0)]));
  }
  return Object.fromEntries(Object.entries(level).map(([k, v]) => [k, Math.round(v * 100) / 100]));
}
