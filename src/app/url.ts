// URL query <-> view state, so links (and Claude's screenshots) open a specific room/version/spot.

export type CameraPose = { x: number; z: number; yaw: number; pitch: number };
export type View = 'first-person' | 'top-down';
export type Person = 'mark' | 'heli';

export type UrlState = {
  roomId: string | null;
  versionId: string;
  camera?: CameraPose;
  view?: View;
  person?: Person;
  time?: number;
  noreport: boolean;
};

type BundleLike = { versionOrder: string[]; versions: Record<string, { rooms: { id: string }[] }> };

export function parseUrlState(search: string, bundle: BundleLike): UrlState {
  const q = new URLSearchParams(search);
  const v = q.get('version');
  const versionId = v && bundle.versions[v] ? v : 'current';
  const rooms = bundle.versions[versionId]?.rooms ?? [];
  const r = q.get('room');
  const roomId = r && rooms.some((x) => x.id === r) ? r : (rooms[0]?.id ?? null);

  const camParts = (q.get('cam') ?? '').split(',').map(Number);
  const camera = camParts.length === 4 && camParts.every(Number.isFinite)
    ? { x: camParts[0], z: camParts[1], yaw: camParts[2], pitch: camParts[3] }
    : undefined;
  const view = q.get('view') === 'top' ? 'top-down' : q.get('view') === 'fp' ? 'first-person' : undefined;
  const p = q.get('person');
  const person = p === 'mark' || p === 'heli' ? p : undefined;
  const t = Number(q.get('time'));
  const time = q.has('time') && Number.isFinite(t) ? t : undefined;
  return { roomId, versionId, camera, view, person, time, noreport: q.get('noreport') === '1' };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function serializeUrlState(s: { roomId: string | null; versionId: string; camera?: CameraPose }): string {
  const q = new URLSearchParams();
  if (s.roomId) q.set('room', s.roomId);
  q.set('version', s.versionId);
  if (s.camera) q.set('cam', [s.camera.x, s.camera.z, s.camera.yaw, s.camera.pitch].map(round1).join(','));
  return `?${q.toString()}`;
}

export function shouldReport(s: Pick<UrlState, 'noreport'>): boolean {
  return !s.noreport;
}

/** Link to the public site (or this page's own address when no public URL is configured). */
export function shareUrl(s: { roomId: string | null; versionId: string }, publicUrl: string, currentBase: string): string {
  const base = publicUrl || currentBase;
  return `${base}${serializeUrlState(s)}`;
}
