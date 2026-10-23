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
