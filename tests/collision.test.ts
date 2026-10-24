import { describe, expect, it } from 'vitest';
import { RoomSchema } from '../src/model/schema';
import { resolveWalls } from '../src/model/geometry';
import { buildColliders, findFreeSpawn, isFree, moveWithCollision, nearestFree, resolvePlayerPosition } from '../src/model/collision';

const room = RoomSchema.parse({
  id: 'r', name: 'R', footprint: [[0, 0], [300, 0], [300, 300], [0, 300]],
  ceilingHeight: 260, floor: { material: 'f' }, ceiling: { material: 'c' },
});
const walls = resolveWalls(room);
const box = (x: number, z: number, rotationDeg = 0) => ({
  position: [x, 0, z] as [number, number, number], rotationDeg,
  min: [-50, 0, -50] as [number, number, number], max: [50, 80, 50] as [number, number, number],
});

describe('moveWithCollision', () => {
  it('stops at a wall and slides along it', () => {
    const colliders = buildColliders(walls, []);
    const [x, z] = moveWithCollision([150, 30], [5, -20], 20, colliders);
    expect(x).toBeCloseTo(155);
    expect(z).toBeCloseTo(20);
  });

  it('cannot enter a furniture box', () => {
    const colliders = buildColliders(walls, [box(150, 150)]);
    let p: [number, number] = [150, 60];
    for (let i = 0; i < 50; i++) p = moveWithCollision(p, [0, 2], 20, colliders);
    expect(p[1]).toBeLessThanOrEqual(80.01);
  });

  it('respects item rotation', () => {
    // a 100 x 20 plank rotated 90 degrees runs along z
    const plank = { position: [150, 0, 150] as [number, number, number], rotationDeg: 90,
      min: [-50, 0, -10] as [number, number, number], max: [50, 80, 10] as [number, number, number] };
    const colliders = buildColliders(walls, [plank]);
    expect(isFree([150, 120], 5, colliders)).toBe(false);
    expect(isFree([120, 150], 5, colliders)).toBe(true);
  });

  it('ignores things mounted above head height', () => {
    const shelf = { ...box(150, 150), min: [-50, 160, -50] as [number, number, number], max: [50, 200, 50] as [number, number, number] };
    expect(isFree([150, 150], 20, buildColliders(walls, [shelf]))).toBe(true);
  });
});

describe('findFreeSpawn', () => {
  it('uses the room centre when free', () => {
    const p = findFreeSpawn(room, buildColliders(walls, []), 20);
    expect(p[0]).toBeCloseTo(150);
    expect(p[1]).toBeCloseTo(150);
  });

  it('avoids colliders when the centre is occupied', () => {
    const colliders = buildColliders(walls, [box(150, 150)]);
    const p = findFreeSpawn(room, colliders, 20);
    expect(isFree(p, 20, colliders)).toBe(true);
  });
});

describe('squeezed between furniture and a wall', () => {
  // a shelf ending 30 cm from the south wall: too narrow for a 40 cm wide player
  const shelf = { position: [40, 0, 230] as [number, number, number], rotationDeg: 0,
    min: [-40, 0, -40] as [number, number, number], max: [40, 80, 40] as [number, number, number] };
  const colliders = buildColliders(walls, [shelf]);

  it('a move into the gap is refused instead of ending up inside something', () => {
    const start: [number, number] = [100, 278];
    expect(isFree(start, 20, colliders)).toBe(true);
    const p = moveWithCollision(start, [-80, 0], 20, colliders);
    expect(isFree(p, 20, colliders)).toBe(true);
  });

  it('nearestFree gets out of a pinch', () => {
    const p = nearestFree([40, 285], 20, colliders, room.footprint);
    expect(isFree(p, 20, colliders)).toBe(true);
    expect(p[1]).toBeLessThanOrEqual(280);
  });
});

describe('resolvePlayerPosition', () => {
  it('pulls the player back in when the room shrinks around them', () => {
    // stood at (280, 250) in a 350 wide room; it is now 250 wide
    const small = RoomSchema.parse({ ...room, footprint: [[0, 0], [250, 0], [250, 300], [0, 300]] });
    const colliders = buildColliders(resolveWalls(small), []);
    expect(isFree([280, 250], 20, colliders)).toBe(true); // the old bug: "free", but outside
    const p = resolvePlayerPosition([280, 250], small, colliders, 20);
    expect(p[0]).toBeLessThanOrEqual(230);
    expect(isFree(p, 20, colliders)).toBe(true);
  });

  it('respawns when far outside', () => {
    const colliders = buildColliders(walls, []);
    const p = resolvePlayerPosition([2000, 2000], room, colliders, 20);
    expect(p[0]).toBeGreaterThan(0);
    expect(p[0]).toBeLessThan(300);
  });

  it('leaves a valid position alone', () => {
    expect(resolvePlayerPosition([100, 100], room, buildColliders(walls, []), 20)).toEqual([100, 100]);
  });
});

describe('buildColliders: items made of parts', () => {
  const v = (x: number, y: number, z: number) => [x, y, z] as [number, number, number];
  // a wall bed: a 144 x 39 housing with a 90 wide desk top folded out to 92 cm, at the left
  const wallBed = {
    position: v(150, 0, 0), rotationDeg: 0, min: v(-72, 0, 0), max: v(72, 226, 92),
    parts: [
      { min: v(-72, 0, 0), max: v(72, 30, 39) }, // base
      { min: v(-72, 0, 0), max: v(-70, 224, 39) }, // side
      { min: v(-70, 30, 20), max: v(70, 220, 32) }, // bed board
      { min: v(-65, 73, 32), max: v(25, 75, 92) }, // desk top
      { min: v(-72, 224, 0), max: v(81, 226, 60) }, // top board, overhead
    ],
  };

  it('blocks only where the parts are, not the whole bounding box', () => {
    const colliders = buildColliders(walls, [wallBed]);
    // in front of the housing, right of the desk: free
    expect(isFree([205, 70], 20, colliders)).toBe(true);
    // at the desk: blocked
    expect(isFree([130, 70], 20, colliders)).toBe(false);
    // at the housing: blocked
    expect(isFree([200, 20], 5, colliders)).toBe(false);
  });

  it('does not let an overhead part hide the parts under it', () => {
    expect(isFree([150, 20], 5, buildColliders(walls, [wallBed]))).toBe(false);
  });

  it('merges parts that sit inside another part into one collider', () => {
    expect(buildColliders([], [wallBed])).toHaveLength(2);
  });
});
