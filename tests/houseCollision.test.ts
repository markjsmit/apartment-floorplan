import { describe, expect, it } from 'vitest';
import { FurnitureAssetSchema, HouseSchema } from '../src/model/schema';
import { computeLayout } from '../src/model/layout';
import { buildHouseColliders, resolveHousePosition, roomAt } from '../src/model/houseCollision';
import { moveWithCollision } from '../src/model/collision';

const room = (id: string, w: number, d: number, extra: object = {}) => ({
  id, name: id, footprint: [[0, 0], [w, 0], [w, d], [0, d]], ceilingHeight: 260,
  floor: { material: 'f' }, ceiling: { material: 'c' }, ...extra,
});
const doorAsset = FurnitureAssetSchema.parse({
  id: 'door-basic', name: 'Door', source: { kind: 'procedural', generator: 'door' },
  states: [{ id: 'closed', name: 'Closed' }, { id: 'open', name: 'Open', parts: { leaf: { rotation: [0, -90, 0] } } }],
});
const house = (asset?: string, type = 'door') => HouseSchema.parse({
  meta: { name: 'Current', kind: 'current' },
  rooms: [
    room('a', 300, 300, { openings: [{ id: 'a.d', type, wall: 'a.wall-0', offset: 100, width: 80, height: 210, ...(asset ? { asset } : {}), leadsTo: { room: 'b' } }] }),
    room('b', 200, 200, { openings: [{ id: 'b.d', type, wall: 'b.wall-2', offset: 60, width: 80, height: 210, leadsTo: { room: 'a' } }] }),
  ],
});

// walk north from inside a, through the doorway at x = 140, for 2 m
function walkNorth(h: ReturnType<typeof house>, states: Record<string, string>) {
  const layout = computeLayout(h);
  const colliders = buildHouseColliders(h, layout, { 'door-basic': doorAsset }, states);
  let p: [number, number] = [140, 100];
  for (let i = 0; i < 100; i++) p = moveWithCollision(p, [0, -2], 20, colliders);
  return { p, room: roomAt(p, h, layout) };
}

describe('walking between rooms', () => {
  it('walks straight through a plain opening into the next room', () => {
    const { p, room: r } = walkNorth(house(undefined, 'opening'), {});
    expect(p[1]).toBeLessThan(-30);
    expect(r).toBe('b');
  });

  it('is stopped by a closed door', () => {
    const { p, room: r } = walkNorth(house('door-basic'), {});
    expect(p[1]).toBeGreaterThan(0);
    expect(r).toBe('a');
  });

  it('walks through once the door is open', () => {
    const { room: r } = walkNorth(house('door-basic'), { 'a.d': 'open' });
    expect(r).toBe('b');
  });

  it('still can not walk through the wall next to the door', () => {
    const h = house(undefined, 'opening');
    const layout = computeLayout(h);
    const colliders = buildHouseColliders(h, layout, {}, {});
    let p: [number, number] = [40, 100];
    for (let i = 0; i < 100; i++) p = moveWithCollision(p, [0, -2], 20, colliders);
    expect(p[1]).toBeGreaterThan(0);
  });
});

describe('resolveHousePosition', () => {
  const h = house(undefined, 'opening');
  const layout = computeLayout(h);
  const colliders = buildHouseColliders(h, layout, {}, {});

  it('leaves you alone in a doorway between rooms', () => {
    expect(resolveHousePosition([140, -5], h, layout, colliders, 20, 'a')).toEqual([140, -5]);
  });

  it('brings you back into your room when you end up outside the house', () => {
    const p = resolveHousePosition([900, 900], h, layout, colliders, 20, 'a');
    expect(roomAt(p, h, layout)).toBe('a');
  });

  it('steps you out of furniture or a closed door', () => {
    // standing on the wall line next to the doorway
    const p = resolveHousePosition([40, 0], h, layout, colliders, 20, 'a');
    expect(roomAt(p, h, layout)).not.toBeNull();
  });
});
