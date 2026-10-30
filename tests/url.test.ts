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

  it('keeps the room and drops a version that does not have it', () => {
    const s = parseUrlState('?room=storage&version=suggestion', bundle);
    expect(s.roomId).toBe('storage');
    expect(s.versionId).toBe('current');
    expect(s.roomVersions).toEqual({});
  });

  it('applies version= to the linked room only', () => {
    const s = parseUrlState('?room=bedroom&version=suggestion', bundle);
    expect(s.versionId).toBe('suggestion');
    expect(s.roomVersions).toEqual({ bedroom: 'suggestion' });
  });

  it('version=empty empties only the linked room, the others show Current (Mark: rooms default to Current)', () => {
    const b = { ...bundle, versions: { ...bundle.versions, empty: { rooms: [{ id: 'bedroom' }, { id: 'storage' }] } } };
    const s = parseUrlState('?room=storage&version=empty', b);
    expect(s.roomVersions).toEqual({ storage: 'empty' });
  });

  it('accepts a room only the linked version has', () => {
    const b = { ...bundle, versions: { ...bundle.versions, suggestion: { rooms: [{ id: 'bedroom' }, { id: 'attic' }] } } };
    const s = parseUrlState('?room=attic&version=suggestion', b);
    expect(s.roomId).toBe('attic');
    expect(s.roomVersions).toEqual({ attic: 'suggestion' });
  });

  it('reads other rooms\' versions from rv=, ignoring unknown ones', () => {
    const s = parseUrlState('?room=storage&version=current&rv=bedroom:saved/bed-left,storage:suggestion,x:current,junk', bundle);
    expect(s.roomVersions).toEqual({ bedroom: 'saved/bed-left' });
    expect(s.versionId).toBe('current');
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

  it('round-trips other rooms\' versions', () => {
    const q = serializeUrlState({ roomId: 'storage', versionId: 'current', roomVersions: { bedroom: 'saved/bed-left' } });
    const s = parseUrlState(q, bundle);
    expect(s.roomId).toBe('storage');
    expect(s.roomVersions).toEqual({ bedroom: 'saved/bed-left' });
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
