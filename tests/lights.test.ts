import { describe, expect, it } from 'vitest';
import { RoomSchema, type Part } from '../src/model/schema';
import { assignLampSlots, DEFAULT_LAMP, roomLamps, roomLightOn, type Lamp } from '../src/model/lights';
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
    expect(lamps).toEqual([{ room: 'a', position: [1200, 235, 150], ...DEFAULT_LAMP }]);
  });

  it('uses the lamp items instead, just under their glowing part', () => {
    const lamps = roomLamps(room('a'), [placed([100, 260, 50]), placed([300, 260, 50], 90, [{ ...lampPart, position: [10, -5.5, 0] }])], { x: 0, z: 0, rotationDeg: 0 });
    expect(lamps).toHaveLength(2);
    expect(lamps[0].position).toEqual([100, 260 - 5.5 - 0.5 - 2, 50]);
    expect(lamps[0].intensity).toBe(14000);
    // turned 90°: the part's local +x points to -z
    expect(lamps[1].position[0]).toBeCloseTo(300);
    expect(lamps[1].position[2]).toBeCloseTo(40);
  });
});

describe('assignLampSlots', () => {
  const lamp = (r: string, x: number): Lamp => ({ room: r, position: [x, 250, 0], intensity: 1, color: '#fff' });
  const lamps = [lamp('far', 2000), lamp('near', 500), lamp('here', 100), lamp('off', 50)];
  it('lights the open room first, then the nearest lit rooms, up to the number of slots', () => {
    const got = assignLampSlots(lamps, (r) => r !== 'off', 'here', [0, 0], 2);
    expect(got.map((l) => l.room)).toEqual(['here', 'near']);
  });
});

describe('room lights', () => {
  it('follow the sun unless switched by hand', () => {
    expect(roomLightOn({}, 'a', true)).toBe(true);
    expect(roomLightOn({}, 'a', false)).toBe(false);
    expect(roomLightOn({ a: true }, 'a', false)).toBe(true);
    expect(roomLightOn({ a: false }, 'a', true)).toBe(false);
  });

  it('toggle per room in the store (view-only)', () => {
    useStore.setState({ roomId: 'living', roomLights: {} });
    useStore.getState().toggleRoomLights(false);
    expect(useStore.getState().roomLights).toEqual({ living: true });
    useStore.getState().toggleRoomLights(true, 'bedroom');
    expect(useStore.getState().roomLights).toEqual({ living: true, bedroom: false });
  });
});
