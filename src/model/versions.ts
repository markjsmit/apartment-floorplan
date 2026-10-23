import { RoomSchema } from './schema';

// Version files are handled raw (as written on disk) so promoting/saving doesn't expand schema defaults.
export type RawRoom = { id: string } & Record<string, unknown>;
export type RawHouse = { meta: Record<string, unknown>; rooms: RawRoom[] } & Record<string, unknown>;

export function versionIdFromPath(rel: string): string {
  const p = rel.replace(/\\/g, '/').replace(/^house\//, '').replace(/\.json$/, '');
  return p;
}

export function versionPath(id: string): string {
  return `house/${id}.json`;
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, x]) => `${JSON.stringify(k)}:${stableStringify(x)}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

/** Content hash of a room after schema normalisation (so key order and explicit defaults don't matter). */
export function roomHash(room: unknown): string {
  const parsed = RoomSchema.safeParse(room);
  const s = stableStringify(parsed.success ? parsed.data : room);
  // FNV-1a, 2 x 32 bit
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

export function makeSuggestion(base: RawHouse, note?: string): RawHouse {
  const copy = structuredClone(base);
  copy.meta = {
    ...copy.meta,
    name: 'AI suggestion',
    kind: 'suggestion',
    createdAt: new Date().toISOString(),
    ...(note ? { note } : {}),
    baseRoomHashes: Object.fromEntries(base.rooms.map((r) => [r.id, roomHash(r)])),
  };
  return copy;
}

export type PromoteResult = { house: RawHouse; changed: string[]; conflicts: string[] };

/**
 * Copy the rooms the suggestion changed (vs. the version it was made from) into Current.
 * A room Current also changed meanwhile is a conflict: Current's room is kept unless `force`.
 */
export function promote(current: RawHouse, suggestion: RawHouse, opts: { force?: boolean } = {}): PromoteResult {
  const base = (suggestion.meta.baseRoomHashes ?? {}) as Record<string, string>;
  const sugById = new Map(suggestion.rooms.map((r) => [r.id, r]));
  const curById = new Map(current.rooms.map((r) => [r.id, r]));
  const ids = new Set([...Object.keys(base), ...sugById.keys()]);

  const changed: string[] = [];
  const conflicts: string[] = [];
  for (const id of ids) {
    const sug = sugById.get(id);
    const sugHash = sug ? roomHash(sug) : null;
    if (sugHash === (base[id] ?? null)) continue;
    changed.push(id);
    const cur = curById.get(id);
    const curHash = cur ? roomHash(cur) : null;
    const curChanged = curHash !== (base[id] ?? null) && curHash !== sugHash;
    if (curChanged) conflicts.push(id);
  }

  const apply = new Set(changed.filter((id) => opts.force || !conflicts.includes(id)));
  const rooms: RawRoom[] = [];
  for (const r of current.rooms) {
    if (!apply.has(r.id)) rooms.push(r);
    else if (sugById.has(r.id)) rooms.push(structuredClone(sugById.get(r.id)!));
  }
  for (const r of suggestion.rooms) {
    if (apply.has(r.id) && !curById.has(r.id)) rooms.push(structuredClone(r));
  }
  return { house: { ...current, rooms }, changed, conflicts };
}
