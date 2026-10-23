import { describe, expect, it } from 'vitest';
import { parseUrlState, serializeUrlState, shareUrl, shouldReport } from '../src/app/url';

const bundle = {
  versionOrder: ['current', 'suggestion', 'saved/bed-left'],
  versions: {
    current: { rooms: [{ id: 'bedroom' }, { id: 'storage' }] },
    suggestion: { rooms: [{ id: 'bedroom' }] },
    'saved/bed-left': { rooms: [{ id: 'bedroom' }] },
  },
};

describe('parseUrlState', () => {
  it('reads room, version, camera, view and person', () => {
    const s = parseUrlState('?room=storage&version=current&cam=10,20,90,-5&view=top&person=heli', bundle);
    expect(s.roomId).toBe('storage');
    expect(s.versionId).toBe('current');
    expect(s.camera).toEqual({ x: 10, z: 20, yaw: 90, pitch: -5 });
    expect(s.view).toBe('top-down');
    expect(s.person).toBe('heli');
    expect(s.noreport).toBe(false);
  });

  it('falls back to current and the first room for unknown ids', () => {
    const s = parseUrlState('?room=attic&version=saved/gone', bundle);
    expect(s.versionId).toBe('current');
    expect(s.roomId).toBe('bedroom');
    expect(s.camera).toBeUndefined();
  });

  it('falls back to the first room of the chosen version', () => {
    const s = parseUrlState('?room=storage&version=suggestion', bundle);
    expect(s.versionId).toBe('suggestion');
    expect(s.roomId).toBe('bedroom');
  });

  it('copes with a bundle with no rooms', () => {
    const s = parseUrlState('', { versionOrder: [], versions: {} });
    expect(s.versionId).toBe('current');
    expect(s.roomId).toBeNull();
  });
});

describe('serializeUrlState', () => {
  it('round-trips room, version and camera', () => {
    const q = serializeUrlState({ roomId: 'storage', versionId: 'current', camera: { x: 1.4, z: 2, yaw: 3, pitch: 4 } });
    const s = parseUrlState(q, bundle);
    expect(s.roomId).toBe('storage');
    expect(s.versionId).toBe('current');
    expect(s.camera).toEqual({ x: 1.4, z: 2, yaw: 3, pitch: 4 });
  });

  it('round-trips a saved version', () => {
    const q = serializeUrlState({ roomId: 'bedroom', versionId: 'saved/bed-left' });
    expect(parseUrlState(q, bundle).versionId).toBe('saved/bed-left');
  });
});

describe('shouldReport', () => {
  it('is false with noreport', () => {
    expect(shouldReport(parseUrlState('?noreport=1', bundle))).toBe(false);
    expect(shouldReport(parseUrlState('', bundle))).toBe(true);
  });
});

describe('shareUrl', () => {
  it('points at the public site with room and version', () => {
    const u = shareUrl({ roomId: 'bedroom', versionId: 'saved/bed-left' }, 'https://markjsmit.github.io/apartment-floorplan/', 'http://localhost:5180/');
    expect(u).toBe('https://markjsmit.github.io/apartment-floorplan/?room=bedroom&version=saved%2Fbed-left');
  });
  it('falls back to the current origin without a public url', () => {
    expect(shareUrl({ roomId: 'a', versionId: 'current' }, '', 'http://localhost:5180/')).toBe('http://localhost:5180/?room=a&version=current');
  });
});

describe('entry point', () => {
  const withEntry = {
    versionOrder: ['current'],
    versions: {
      current: {
        rooms: [{ id: 'storage', openings: [] }, { id: 'living', openings: [{ id: 'living.front-door' }] }],
        layout: { entry: 'living.front-door' },
      },
    },
  };

  it('starts at the entry door when the link names no room', () => {
    const s = parseUrlState('', withEntry);
    expect(s.roomId).toBe('living');
    expect(s.spawnAt).toBe('living.front-door');
  });

  it('also accepts a room id as the entry', () => {
    const s = parseUrlState('', { ...withEntry, versions: { current: { ...withEntry.versions.current, layout: { entry: 'living' } } } });
    expect(s.roomId).toBe('living');
    expect(s.spawnAt).toBeUndefined();
  });

  it('a room in the link still wins', () => {
    expect(parseUrlState('?room=storage', withEntry).roomId).toBe('storage');
  });
});
