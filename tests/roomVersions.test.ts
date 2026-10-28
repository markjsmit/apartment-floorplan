import { describe, expect, it } from 'vitest';
import { buildBundle } from '../src/model/bundle';
import { composeHouse, versionsForRoom } from '../src/model/roomVersions';

const room = (id: string, ceilingHeight = 260) => ({
  id, name: id, footprint: [[0, 0], [300, 0], [300, 300], [0, 300]], ceilingHeight,
  floor: { material: 'p' }, ceiling: { material: 'p' },
});
const file = (path: string, meta: Record<string, unknown>, rooms: unknown[], extra: Record<string, unknown> = {}) => ({ path, json: { meta, rooms, ...extra } });

const bundle = buildBundle([
  file('house/current.json', { name: 'Current', kind: 'current' }, [room('bedroom'), room('storage'), room('hall')], { layout: { anchor: 'hall' } }),
  // changed the bedroom only, no meta.rooms
  file('house/suggestion.json', { name: 'AI suggestion', kind: 'suggestion' }, [room('bedroom', 240), room('storage'), room('hall'), room('attic')]),
  // says it's about storage, even though storage equals Current
  file('house/saved/storage-a.json', { name: 'Storage A', kind: 'saved', rooms: ['storage'] }, [room('bedroom', 200), room('storage')]),
  file('house/saved/same.json', { name: 'Same', kind: 'saved' }, [room('bedroom'), room('storage')]),
], { publicUrl: '' });

describe('composeHouse', () => {
  it('is Current itself when nothing is chosen', () => {
    expect(composeHouse(bundle, {})).toBe(bundle.versions.current);
    expect(composeHouse(bundle, { bedroom: 'current' })).toBe(bundle.versions.current);
  });

  it('replaces chosen rooms, keeps order, meta and layout from Current', () => {
    const h = composeHouse(bundle, { bedroom: 'suggestion' })!;
    expect(h.rooms.map((r) => r.id)).toEqual(['bedroom', 'storage', 'hall']);
    expect(h.rooms[0].ceilingHeight).toBe(240);
    expect(h.rooms[1]).toBe(bundle.versions.current.rooms[1]);
    expect(h.meta.kind).toBe('current');
    expect(h.layout?.anchor).toBe('hall');
  });

  it('skips a version that lacks the room and appends rooms only the chosen version has', () => {
    const h = composeHouse(bundle, { hall: 'saved/storage-a', attic: 'suggestion', nope: 'gone' })!;
    expect(h.rooms.map((r) => r.id)).toEqual(['bedroom', 'storage', 'hall', 'attic']);
    expect(h.rooms[2]).toBe(bundle.versions.current.rooms[2]);
  });

  it('uses the first version when Current is missing', () => {
    const b = { ...bundle, versions: { suggestion: bundle.versions.suggestion }, versionOrder: ['suggestion'] };
    expect(composeHouse(b, {})).toBe(bundle.versions.suggestion);
    expect(composeHouse({ versions: {}, versionOrder: [] }, {})).toBeNull();
  });
});

describe('versionsForRoom', () => {
  it('offers Current plus versions about the room or that changed it', () => {
    // Empty is always there, right after Current
    expect(versionsForRoom(bundle, 'bedroom')).toEqual(['current', 'empty', 'suggestion']);
    expect(versionsForRoom(bundle, 'storage')).toEqual(['current', 'empty', 'saved/storage-a']);
    expect(versionsForRoom(bundle, 'hall')).toEqual(['current', 'empty']);
  });

  it('meta.rooms wins over a changed room', () => {
    // storage-a changed the bedroom but is only about storage
    expect(versionsForRoom(bundle, 'bedroom')).not.toContain('saved/storage-a');
  });

  it('offers a version for a room Current does not have', () => {
    expect(versionsForRoom(bundle, 'attic')).toEqual(['current', 'suggestion']);
  });

  it('is memoized per bundle', () => {
    expect(versionsForRoom(bundle, 'bedroom')).toBe(versionsForRoom(bundle, 'bedroom'));
  });
});
