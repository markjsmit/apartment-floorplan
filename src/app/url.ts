// URL query <-> view state, so links (and Claude's screenshots) open a specific room/version/spot.

export type CameraPose = { x: number; z: number; yaw: number; pitch: number };
export type View = 'first-person' | 'top-down';
export type Person = 'mark' | 'heli';

export type UrlState = {
  roomId: string | null;
  /** the linked room's version (`version=`) */
  versionId: string;
  /** every room's non-Current version choice (`version=` for the linked room + `rv=room:ver,...` for others) */
  roomVersions: Record<string, string>;
  camera?: CameraPose;
  view?: View;
  person?: Person;
  time?: number;
  /** opening to start at (the house's entry door) */
  spawnAt?: string;
  noreport: boolean;
  /** furniture/door states to start with, e.g. `states=storage.door:open` (snapshots) */
  itemStates?: Record<string, string>;
};

type BundleLike = {
  versionOrder: string[];
  versions: Record<string, { rooms: { id: string; openings?: { id: string }[] }[]; layout?: { entry?: string } | null }>;
};

const hasRoom = (bundle: BundleLike, vid: string | null, room: string) => !!vid && !!bundle.versions[vid]?.rooms.some((x) => x.id === room);

// Versions are per room: `version=` applies to the linked room only, every other room shows Current (or its `rv=`).
export function parseUrlState(search: string, bundle: BundleLike): UrlState {
  const q = new URLSearchParams(search);
  const baseId = bundle.versions.current ? 'current' : (bundle.versionOrder[0] ?? 'current');
  const base = bundle.versions[baseId];
  const rooms = base?.rooms ?? [];
  const v = q.get('version');
  // no room in the link: the house's entry (a door or a room id), else the first room
  const entry = base?.layout?.entry;
  const entryRoom = entry ? rooms.find((x) => x.id === entry || x.openings?.some((o) => o.id === entry)) : undefined;
  const entryDoor = entryRoom && entryRoom.id !== entry ? entry : undefined;
  const r = q.get('room');
  // a room only the linked version has is fine too (it's added to the house)
  const linked = r && (rooms.some((x) => x.id === r) || hasRoom(bundle, v, r)) ? r : null;
  const roomId = linked ?? entryRoom?.id ?? rooms[0]?.id ?? null;
  const spawnAt = !linked ? entryDoor : undefined;

  const roomVersions: Record<string, string> = {};
  for (const pair of (q.get('rv') ?? '').split(',')) {
    const i = pair.indexOf(':');
    const [room, vid] = [pair.slice(0, i), pair.slice(i + 1)];
    if (i > 0 && vid !== baseId && hasRoom(bundle, vid, room)) roomVersions[room] = vid;
  }
  // version=empty (the house as it's handed over) applies to every room, not just the linked one
  if (v === 'empty' && bundle.versions.empty) for (const r of rooms) if (!(r.id in roomVersions)) roomVersions[r.id] = 'empty';
  if (roomId && v && v !== baseId && hasRoom(bundle, v, roomId)) roomVersions[roomId] = v;
  else if (roomId && v === baseId) delete roomVersions[roomId];
  const versionId = (roomId && roomVersions[roomId]) || baseId;

  const camParts = (q.get('cam') ?? '').split(',').map(Number);
  const camera = camParts.length === 4 && camParts.every(Number.isFinite)
    ? { x: camParts[0], z: camParts[1], yaw: camParts[2], pitch: camParts[3] }
    : undefined;
  const view = q.get('view') === 'top' ? 'top-down' : q.get('view') === 'fp' ? 'first-person' : undefined;
  const p = q.get('person');
  const person = p === 'mark' || p === 'heli' ? p : undefined;
  const t = Number(q.get('time'));
  const time = q.has('time') && Number.isFinite(t) ? t : undefined;
  const states = Object.fromEntries((q.get('states') ?? '').split(',').map((s) => s.split(':')).filter((p) => p.length === 2 && p[0] && p[1]));
  const itemStates = Object.keys(states).length ? states : undefined;
  return { roomId, versionId, roomVersions, camera, view, person, time, spawnAt, noreport: q.get('noreport') === '1', itemStates };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

type LinkState = { roomId: string | null; versionId: string; roomVersions?: Record<string, string>; camera?: CameraPose };

export function serializeUrlState(s: LinkState): string {
  const q = new URLSearchParams();
  if (s.roomId) q.set('room', s.roomId);
  q.set('version', s.versionId);
  const others = Object.entries(s.roomVersions ?? {}).filter(([room]) => room !== s.roomId);
  if (others.length) q.set('rv', others.map(([room, vid]) => `${room}:${vid}`).join(','));
  if (s.camera) q.set('cam', [s.camera.x, s.camera.z, s.camera.yaw, s.camera.pitch].map(round1).join(','));
  return `?${q.toString()}`;
}

export function shouldReport(s: Pick<UrlState, 'noreport'>): boolean {
  return !s.noreport;
}

/** Link to the public site (or this page's own address when no public URL is configured). */
export function shareUrl(s: Omit<LinkState, 'camera'>, publicUrl: string, currentBase: string): string {
  const base = publicUrl || currentBase;
  return `${base}${serializeUrlState(s)}`;
}
