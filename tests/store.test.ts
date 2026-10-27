import { describe, expect, it } from 'vitest';
import { buildBundle } from '../src/model/bundle';
import { useStore } from '../src/app/store';

const room = (id: string) => ({
  id, name: id, footprint: [[0, 0], [300, 0], [300, 300], [0, 300]], ceilingHeight: 260,
  floor: { material: 'p' }, ceiling: { material: 'p' },
});
const bundle = buildBundle([
  { path: 'house/current.json', json: { meta: { name: 'Current', kind: 'current' }, rooms: [room('bedroom'), room('storage')] } },
], { publicUrl: '' });

describe('store navigation', () => {
  it('refuses to switch to a room that does not exist', () => {
    useStore.getState().setBundle(bundle);
    useStore.getState().setRoom('bedroom');
    expect(useStore.getState().setRoom('bed-room')).toBe(false);
    expect(useStore.getState().roomId).toBe('bedroom');
    expect(useStore.getState().setRoom('storage')).toBe(true);
    expect(useStore.getState().roomId).toBe('storage');
  });

  it('refuses an unknown version', () => {
    expect(useStore.getState().setVersion('suggestion')).toBe(false);
    expect(useStore.getState().versionId).toBe('current');
  });
});

describe('per-room versions', () => {
  const r = (id: string, ceilingHeight = 260) => ({ ...room(id), ceilingHeight });
  const two = buildBundle([
    { path: 'house/current.json', json: { meta: { name: 'Current', kind: 'current' }, rooms: [r('bedroom'), r('storage')] } },
    { path: 'house/suggestion.json', json: { meta: { name: 'AI suggestion', kind: 'suggestion' }, rooms: [r('bedroom', 240), r('storage', 230)] } },
    { path: 'house/saved/bed.json', json: { meta: { name: 'Bed', kind: 'saved', rooms: ['bedroom'] }, rooms: [r('bedroom', 250)] } },
  ], { publicUrl: '' });
  const ceiling = (id: string) => useStore.getState().house!.rooms.find((x) => x.id === id)!.ceilingHeight;

  it('switches only the active room', () => {
    useStore.setState({ roomVersions: {} });
    useStore.getState().setBundle(two);
    useStore.getState().setRoom('bedroom');
    expect(useStore.getState().setVersion('suggestion')).toBe(true);
    expect(useStore.getState().versionId).toBe('suggestion');
    expect(ceiling('bedroom')).toBe(240);
    expect(ceiling('storage')).toBe(260);

    // another room keeps Current; walking back shows the bedroom's own choice again
    useStore.getState().setRoom('storage');
    expect(useStore.getState().versionId).toBe('current');
    useStore.getState().enterRoom('bedroom');
    expect(useStore.getState().versionId).toBe('suggestion');
  });

  it('refuses a version without the active room, and current clears the choice', () => {
    useStore.getState().setRoom('storage');
    expect(useStore.getState().setVersion('saved/bed')).toBe(false);
    expect(useStore.getState().setVersion('saved/bed', 'bedroom')).toBe(true);
    expect(ceiling('bedroom')).toBe(250);
    expect(useStore.getState().setVersion('current', 'bedroom')).toBe(true);
    expect(useStore.getState().roomVersions).toEqual({});
    expect(useStore.getState().house).toBe(two.versions.current);
  });

  it('drops choices whose version is gone on reload', () => {
    useStore.getState().setRoom('bedroom');
    useStore.getState().setVersion('suggestion');
    const without = { ...two, versions: { current: two.versions.current }, versionOrder: ['current'] };
    useStore.getState().setBundle(without);
    expect(useStore.getState().roomVersions).toEqual({});
    expect(useStore.getState().versionId).toBe('current');
    expect(ceiling('bedroom')).toBe(260);
  });
});
