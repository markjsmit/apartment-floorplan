import { describe, expect, it } from 'vitest';
import { FurnitureAssetSchema, ItemSchema, RoomSchema, type Part } from '../src/model/schema';
import { placeItem } from '../src/model/placement';
import { assignLampSlots, DEFAULT_LAMP, lampOn, LIGHT_MODES, roomLamps, type Lamp } from '../src/model/lights';
import type { PlacedItem } from '../src/model/placement';
import { useStore } from '../src/app/store';

const room = (id: string) => RoomSchema.parse({
  id, name: id, footprint: [[0, 0], [400, 0], [400, 300], [0, 300]], ceilingHeight: 260,
  floor: { material: 'p' }, ceiling: { material: 'p' },
});

const lampPart: Part = {
  id: 'diffuser', tags: [], geometry: { type: 'cylinder', radius: 14, height: 1, segments: 16 }, position: [0, -5.5, 0], rotation: [0, 0, 0],
  castShadow: false, glass: false, emit: { color: '#fff', intensity: 14000, kind: 'point' },
};
const placed = (position: [number, number, number], rotationDeg = 0, parts: Part[] = [lampPart]) => ({ position, rotationDeg, parts }) as unknown as PlacedItem;

describe('roomLamps', () => {
  it('gives a room without lamp items one ceiling light in its middle', () => {
    const lamps = roomLamps(room('a'), [], { x: 1000, z: 0, rotationDeg: 0 });
    expect(lamps).toEqual([{ room: 'a', position: [1200, 235, 150], role: 'functional', ...DEFAULT_LAMP }]);
  });

  it('uses the lamp items instead, just under their glowing part', () => {
    const lamps = roomLamps(room('a'), [placed([100, 260, 50]), placed([300, 260, 50], 90, [{ ...lampPart, position: [10, -5.5, 0] }])], { x: 0, z: 0, rotationDeg: 0 });
    expect(lamps).toHaveLength(2);
    expect(lamps[0].position).toEqual([100, 260 - 5.5 - 0.5 - 2, 50]);
    expect(lamps[0].intensity).toBe(14000);
    expect(lamps[0].role).toBe('functional');
    // turned 90°: the part's local +x points to -z
    expect(lamps[1].position[0]).toBeCloseTo(300);
    expect(lamps[1].position[2]).toBeCloseTo(40);
  });
});

describe('assignLampSlots', () => {
  const lamp = (r: string, x: number, role: Lamp['role'] = 'functional'): Lamp => ({ room: r, position: [x, 250, 0], intensity: 1, color: '#fff', role });
  const lamps = [lamp('far', 2000), lamp('near', 500), lamp('here', 100), lamp('here', 50, 'decorative')];
  it('lights the lit lamps nearest to where you stand, whatever room, up to the number of slots', () => {
    const got = assignLampSlots(lamps, (l) => l.role === 'functional', [0, 0], 2);
    expect(got.map((l) => [l?.room, l?.role])).toEqual([['here', 'functional'], ['near', 'functional']]);
    expect(assignLampSlots(lamps, () => true, [0, 0], 6)).toHaveLength(6);
  });
  it('keeps a lamp in its slot when you move', () => {
    const first = assignLampSlots(lamps, () => true, [0, 0], 2); // here (50), here (100)
    const moved = assignLampSlots(lamps, () => true, [450, 0], 2, first); // near (500) + here (100)
    expect(moved[1]).toBe(first[1]);
    expect(moved[0]?.room).toBe('near');
  });
});

describe('light modes (whole house)', () => {
  it('off: nothing; cozy: decorative lamps only; work: everything', () => {
    expect(LIGHT_MODES.map((m) => m.id)).toEqual(['off', 'cozy', 'work']);
    expect(lampOn('functional', 'off')).toBe(false);
    expect(lampOn('decorative', 'off')).toBe(false);
    expect(lampOn('functional', 'cozy')).toBe(false);
    expect(lampOn('decorative', 'cozy')).toBe(true);
    expect(lampOn('functional', 'work')).toBe(true);
    expect(lampOn('decorative', 'work')).toBe(true);
  });

  it('the app opens in work mode', () => {
    expect(useStore.getInitialState().lightMode).toBe('work');
  });
});

describe('item light role', () => {
  it('an item can make its lamps decorative (a floor lamp as cozy light)', () => {
    const asset = FurnitureAssetSchema.parse({ id: 'lamp', name: 'lamp', source: { kind: 'parts' }, parts: [{ ...lampPart, emit: { color: '#fff', intensity: 1, kind: 'point' } }] });
    const item = ItemSchema.parse({ id: 'a.lamp', asset: 'lamp', position: [0, 0, 0], light: 'decorative' });
    expect(placeItem(item, asset, []).parts[0].emit?.role).toBe('decorative');
    const plain = ItemSchema.parse({ id: 'a.lamp', asset: 'lamp', position: [0, 0, 0] });
    expect(placeItem(plain, asset, []).parts[0].emit?.role).toBeUndefined();
    expect(lampOn(undefined, 'cozy')).toBe(false);
  });
});
