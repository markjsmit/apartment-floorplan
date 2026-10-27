import type { Bundle } from './bundle';
import type { House } from './schema';
import { roomHash } from './versions';

// Versions are whole-house files on disk, but Mark compares them per room: every room shows its own chosen version,
// everything else comes from Current. This is the view over the files.

type BundleLike = Pick<Bundle, 'versions' | 'versionOrder'>;

/** The version rooms show unless a room picked another one: Current, or the first version if Current is missing. */
export function baseVersionId(bundle: BundleLike): string {
  return bundle.versions.current ? 'current' : (bundle.versionOrder[0] ?? 'current');
}

/**
 * Current with each room in `roomVersions` ({roomId: versionId}) taken from that version instead (skipped when that
 * version doesn't have the room). Rooms only a chosen version has are appended. meta/layout/assumptions are Current's.
 * Returns Current itself when nothing is replaced (so per-house caches keep working).
 */
export function composeHouse(bundle: BundleLike, roomVersions: Record<string, string>): House | null {
  const base = bundle.versions[baseVersionId(bundle)];
  if (!base) return null;
  const pick = new Map<string, House['rooms'][number]>();
  for (const [roomId, vid] of Object.entries(roomVersions)) {
    const room = bundle.versions[vid]?.rooms.find((r) => r.id === roomId);
    if (room && vid !== baseVersionId(bundle)) pick.set(roomId, room);
  }
  if (pick.size === 0) return base;
  const rooms = base.rooms.map((r) => pick.get(r.id) ?? r);
  for (const [id, r] of pick) if (!base.rooms.some((b) => b.id === id)) rooms.push(r);
  return { ...base, rooms };
}

const hashCache = new WeakMap<object, string>();
function hashOf(room: object): string {
  let h = hashCache.get(room);
  if (h === undefined) {
    h = roomHash(room);
    hashCache.set(room, h);
  }
  return h;
}

const offerCache = new WeakMap<object, Map<string, string[]>>();

/**
 * Version ids to offer as tabs for one room: always Current (the base) first; another version only if it has the room
 * and either says it's about it (`meta.rooms`) or, without `meta.rooms`, its room differs from Current's.
 */
export function versionsForRoom(bundle: BundleLike, roomId: string): string[] {
  let perRoom = offerCache.get(bundle);
  if (!perRoom) {
    perRoom = new Map();
    offerCache.set(bundle, perRoom);
  }
  const cached = perRoom.get(roomId);
  if (cached) return cached;

  const baseId = baseVersionId(bundle);
  const baseRoom = bundle.versions[baseId]?.rooms.find((r) => r.id === roomId);
  const out = [baseId];
  for (const id of bundle.versionOrder) {
    if (id === baseId) continue;
    const v = bundle.versions[id];
    const room = v?.rooms.find((r) => r.id === roomId);
    if (!room) continue;
    const about = v.meta.rooms;
    if (about ? about.includes(roomId) : !baseRoom || hashOf(room) !== hashOf(baseRoom)) out.push(id);
  }
  perRoom.set(roomId, out);
  return out;
}
