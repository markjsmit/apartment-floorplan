import { describe, expect, it } from 'vitest';
import { RoomSchema } from '../src/model/schema';
import { resolveWalls } from '../src/model/geometry';
import { buildColliders, findFreeSpawn, isFree, moveWithCollision } from '../src/model/collision';

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
