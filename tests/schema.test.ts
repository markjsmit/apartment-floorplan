import { describe, expect, it } from 'vitest';
import { FurnitureAssetSchema, HouseSchema, ItemSchema, RoomSchema } from '../src/model/schema';

const minimalRoom = {
  id: 'storage',
  name: 'Storage room',
  footprint: [[0, 0], [300, 0], [300, 300], [0, 300]],
  ceilingHeight: 260,
  floor: { material: 'oak-planks' },
  ceiling: { material: 'white-paint' },
  items: [{ id: 'storage.kallax-1', asset: 'ikea-kallax', position: [0, 0, 0] }],
};

describe('schema', () => {
  it('parses a minimal room and fills defaults', () => {
    const room = RoomSchema.parse(minimalRoom);
    expect(room.walls).toEqual([]);
    expect(room.openings).toEqual([]);
    expect(room.northAngle).toBe(0);
    expect(room.items[0].rotation).toBe(0);
    expect(room.items[0].selectWhole).toBe(true);
  });

  it('rejects an item with both position and against', () => {
    const r = ItemSchema.safeParse({
      id: 'a.b', asset: 'x', position: [0, 0, 0], against: { wall: 'a.wall-0', offset: 10 },
    });
    expect(r.success).toBe(false);
  });

  it('rejects an item with neither position nor against', () => {
    expect(ItemSchema.safeParse({ id: 'a.b', asset: 'x' }).success).toBe(false);
  });

  it('rejects a footprint with only 2 points', () => {
    const r = RoomSchema.safeParse({ ...minimalRoom, footprint: [[0, 0], [1, 1]] });
    expect(r.success).toBe(false);
  });

  it('parses a house with meta and rooms', () => {
    const h = HouseSchema.parse({ meta: { name: 'Current', kind: 'current' }, rooms: [minimalRoom] });
    expect(h.layout).toBeNull();
    expect(h.rooms).toHaveLength(1);
  });

  it('gives a furniture asset a default state', () => {
    const a = FurnitureAssetSchema.parse({
      id: 'box', name: 'Box', tags: [], source: { kind: 'parts' },
      parts: [{ id: 'body', geometry: { type: 'box', size: [10, 10, 10] } }],
    });
    expect(a.states.map((s) => s.id)).toEqual(['default']);
    expect(a.parts[0].position).toEqual([0, 0, 0]);
  });
});
