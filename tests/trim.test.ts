import { describe, expect, it } from 'vitest';
import { RoomSchema } from '../src/model/schema';
import { resolveWalls } from '../src/model/geometry';
import { cornerShade, skirtingRuns, skirtingStyle } from '../src/model/trim';

const room = (extra: Record<string, unknown> = {}) =>
  RoomSchema.parse({
    id: 'r', name: 'R',
    footprint: [[0, 0], [300, 0], [300, 200], [0, 200]],
    ceilingHeight: 260, floor: { material: 'laminate-oak' }, ceiling: { material: 'white-paint' },
    ...extra,
  });

describe('skirtingRuns', () => {
  it('runs the full length of every plain wall', () => {
    const r = room();
    const runs = skirtingRuns(r, resolveWalls(r));
    expect(runs.map((x) => [x.wall, x.u0, x.u1])).toEqual([['r.wall-0', 0, 300], ['r.wall-1', 0, 200], ['r.wall-2', 0, 300], ['r.wall-3', 0, 200]]);
    expect(runs[0]).toMatchObject({ material: 'white-laminate', height: 7 });
  });

  it('stops at doors but runs under windows', () => {
    const r = room({
      openings: [
        { id: 'r.door', type: 'door', wall: 'r.wall-0', offset: 100, width: 80, height: 210 },
        { id: 'r.win', type: 'window', wall: 'r.wall-2', offset: 50, width: 100, height: 120, sill: 90 },
      ],
    });
    const runs = skirtingRuns(r, resolveWalls(r));
    expect(runs.filter((x) => x.wall === 'r.wall-0').map((x) => [x.u0, x.u1])).toEqual([[0, 100], [180, 300]]);
    expect(runs.filter((x) => x.wall === 'r.wall-2').map((x) => [x.u0, x.u1])).toEqual([[0, 300]]);
  });

  it('skips tiled walls and uses the floor tile on tiled floors', () => {
    const r = room({ floor: { material: 'tiles-dark-grey' }, walls: [{ id: 'r.wall-1', edge: 1, material: 'tiles-dark-grey' }] });
    const runs = skirtingRuns(r, resolveWalls(r));
    expect(runs.some((x) => x.wall === 'r.wall-1')).toBe(false);
    expect(skirtingStyle(r)).toMatchObject({ material: 'tiles-dark-grey', height: 8 });
  });

  it('lengthens runs round an outside corner so the ends meet', () => {
    // L-shape: the corner at (200, 100) sticks into the room
    const r = room({ footprint: [[0, 0], [300, 0], [300, 100], [200, 100], [200, 200], [0, 200]] });
    const walls = resolveWalls(r);
    const runs = skirtingRuns(r, walls);
    const w2 = runs.find((x) => x.wall === 'r.wall-2')!;
    const w3 = runs.find((x) => x.wall === 'r.wall-3')!;
    expect(w2.u1).toBeCloseTo(100 + w2.thickness);
    expect(w3.u0).toBeCloseTo(-w3.thickness);
    // inside corners are not lengthened
    expect(runs.find((x) => x.wall === 'r.wall-0')).toMatchObject({ u0: 0, u1: 300 });
  });
});

describe('cornerShade', () => {
  it('darkens floor joints on both surfaces, ceiling joints and the four inside corners', () => {
    const r = room();
    const { floor, ceiling } = cornerShade(r, resolveWalls(r), 0.3);
    // per wall: 2 bands (floor + wall above the skirting) of 2 quads, plus 2 corner bands of 2 quads
    expect(floor).toHaveLength(4 * (4 + 4));
    expect(ceiling).toHaveLength(4 * 4);
    // darkest at the joint, nothing at the far edge
    expect(Math.max(...floor.flatMap((q) => q.a))).toBeCloseTo(0.3);
    expect(floor[1].a.slice(2)).toEqual([0, 0]);
    // floor quads lie just above the floor, inside the room
    for (const p of floor[0].p) {
      expect(p[1]).toBeGreaterThan(0);
      expect(p[2]).toBeGreaterThanOrEqual(0);
    }
  });

  it('leaves doorways clear and skips corners with a window in them', () => {
    const r = room({
      openings: [
        { id: 'r.door', type: 'door', wall: 'r.wall-0', offset: 100, width: 80, height: 210 },
        { id: 'r.win', type: 'window', wall: 'r.wall-1', offset: 0, width: 100, height: 120, sill: 90 },
      ],
    });
    const { floor } = cornerShade(r, resolveWalls(r), 0.3);
    const onFloorInDoor = floor.some((q) => q.p.every((p) => p[1] < 1 && p[0] > 100 && p[0] < 180));
    expect(onFloorInDoor).toBe(false);
    // the corner between wall 0 and wall 1 (x = 300, z = 0) has the window next to it: no vertical band there
    const vertical = floor.filter((q) => Math.abs(q.p[0][1] - q.p[1][1]) > 100);
    expect(vertical.some((q) => q.p.every((p) => p[0] > 280 && p[2] < 20))).toBe(false);
    expect(vertical).toHaveLength(3 * 4);
  });
});
