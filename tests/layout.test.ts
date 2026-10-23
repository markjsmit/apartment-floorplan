import { describe, expect, it } from 'vitest';
import { HouseSchema } from '../src/model/schema';
import { computeLayout, toLocal, toWorld } from '../src/model/layout';

const room = (id: string, w: number, d: number, extra: object = {}) => ({
  id, name: id, footprint: [[0, 0], [w, 0], [w, d], [0, d]], ceilingHeight: 260,
  floor: { material: 'f' }, ceiling: { material: 'c' }, ...extra,
});
const door = (id: string, wall: string, offset: number, leadsTo?: object) => ({
  id, type: 'door', wall, offset, width: 80, height: 210, ...(leadsTo ? { leadsTo } : {}),
});
const house = (rooms: object[], layout: unknown = null) =>
  HouseSchema.parse({ meta: { name: 'Current', kind: 'current' }, rooms, layout });

describe('computeLayout', () => {
  it('keeps the first room where it is', () => {
    const l = computeLayout(house([room('a', 300, 300)]));
    expect(l.placements.a).toEqual({ x: 0, z: 0, rotationDeg: 0 });
  });

  it('places a room so the two doors line up through the wall', () => {
    // A's door on its north edge (z = 0), B's door on B's south edge (z = 200): B ends up north of A
    const l = computeLayout(house([
      room('a', 300, 300, { openings: [door('a.d', 'a.wall-0', 100, { room: 'b', opening: 'b.d' })] }),
      room('b', 200, 200, { openings: [door('b.d', 'b.wall-2', 60, { room: 'a', opening: 'a.d' })] }),
    ]));
    const b = l.placements.b;
    expect(b.rotationDeg).toBeCloseTo(0);
    // A's door centre (140, 0) moved out through A's 10 cm wall = B's door centre (100, 200) in B's own coords
    const [x, z] = toWorld([100, 200], b);
    expect(x).toBeCloseTo(140);
    expect(z).toBeCloseTo(-10);
    expect(l.issues).toEqual([]);
  });

  it('turns a room when its door is on a different side', () => {
    // B's door is on its east edge (x = 200)
    const l = computeLayout(house([
      room('a', 300, 300, { openings: [door('a.d', 'a.wall-0', 100, { room: 'b' })] }),
      room('b', 200, 200, { openings: [door('b.d', 'b.wall-1', 60, { room: 'a' })] }),
    ]));
    const b = l.placements.b;
    const [x, z] = toWorld([200, 100], b);
    expect(x).toBeCloseTo(140);
    expect(z).toBeCloseTo(-10);
    // B's inside (towards -x from its door) must point away from A (north, -z)
    const [ix, iz] = toWorld([150, 100], b);
    expect(iz).toBeLessThan(-10);
    expect(Math.abs(ix - 140)).toBeLessThan(1);
  });

  it('puts unconnected rooms off to the side without overlapping', () => {
    const l = computeLayout(house([room('a', 300, 300), room('lonely', 200, 200)]));
    const p = l.placements.lonely;
    expect(toWorld([0, 0], p)[0]).toBeGreaterThan(300);
    expect(l.issues.join()).toMatch(/lonely.*not connected/);
  });

  it('uses a manual placement from layout.placements', () => {
    // b is modelled turned a quarter, so its own north is +x
    const l = computeLayout(house([room('a', 300, 300), room('b', 200, 200, { northAngle: 90 })], { placements: { b: { x: 500, z: 0, rotationDeg: 90 } } }));
    expect(l.placements.b).toEqual({ x: 500, z: 0, rotationDeg: 90 });
    expect(l.issues).toEqual([]);
  });

  it('warns when connected rooms disagree about north', () => {
    const l = computeLayout(house([
      room('a', 300, 300, { northAngle: 0, openings: [door('a.d', 'a.wall-0', 100, { room: 'b' })] }),
      room('b', 200, 200, { northAngle: 90, openings: [door('b.d', 'b.wall-2', 60, { room: 'a' })] }),
    ]));
    expect(l.issues.join()).toMatch(/b.*north/);
  });

  it('warns when the two doors are not the same width', () => {
    const l = computeLayout(house([
      room('a', 300, 300, { openings: [door('a.d', 'a.wall-0', 100, { room: 'b' })] }),
      room('b', 200, 200, { openings: [{ ...door('b.d', 'b.wall-2', 60, { room: 'a' }), width: 90 }] }),
    ]));
    expect(l.issues.join()).toMatch(/a\.d.*b\.d.*width/);
  });

  it('round-trips world and local coordinates', () => {
    const p = { x: 240, z: -210, rotationDeg: 270 };
    const w = toWorld([37, 81], p);
    const [lx, lz] = toLocal(w, p);
    expect(lx).toBeCloseTo(37);
    expect(lz).toBeCloseTo(81);
  });

  it('lists connected doorways so walls can open there', () => {
    const l = computeLayout(house([
      room('a', 300, 300, { openings: [{ ...door('a.d', 'a.wall-0', 100, { room: 'b' }), asset: 'door-basic' }] }),
      room('b', 200, 200, { openings: [{ ...door('b.d', 'b.wall-2', 60, { room: 'a' }), asset: 'door-basic' }] }),
    ]));
    expect(l.doorways).toEqual([{ a: 'a.d', b: 'b.d', door: 'a.d' }]);
    // only one door leaf is drawn per doorway
    expect([...l.hiddenAssets]).toEqual(['b.d']);
  });
});

describe('computeLayout: rooms that crowd each other', () => {
  it('warns when two rooms leave no room for the wall between them', () => {
    // b is placed by hand right against a's east side: 0 cm between them, the walls are 10 cm
    const l = computeLayout(house([room('a', 300, 300), room('b', 200, 300)], { placements: { b: { x: 300, z: 0, rotationDeg: 0 } } }));
    expect(l.issues.join('\n')).toMatch(/a\.wall-1.*b\.wall-3.*0 cm/);
  });

  it('is quiet when the wall thickness fits', () => {
    const l = computeLayout(house([room('a', 300, 300), room('b', 200, 300)], { placements: { b: { x: 310, z: 0, rotationDeg: 0 } } }));
    expect(l.issues).toEqual([]);
  });
});

describe('layout.entry', () => {
  it('warns about an entry that does not exist', () => {
    const l = computeLayout(house([room('a', 300, 300)], { entry: 'a.front-dor' }));
    expect(l.issues.join()).toMatch(/entry "a\.front-dor"/);
  });
});
