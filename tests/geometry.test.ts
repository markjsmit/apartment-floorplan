import { describe, expect, it } from 'vitest';
import { RoomSchema, ItemSchema, OpeningSchema } from '../src/model/schema';
import {
  compassOf, facing, pointInPolygon, resolveItemTransform, resolveWalls, roomBounds, wallOverrun, wallSegments,
} from '../src/model/geometry';

const square = (northAngle = 0) =>
  RoomSchema.parse({
    id: 'r', name: 'R', northAngle,
    footprint: [[0, 0], [300, 0], [300, 300], [0, 300]],
    ceilingHeight: 260, floor: { material: 'f' }, ceiling: { material: 'c' },
  });

describe('resolveWalls', () => {
  it('makes one wall per edge with inward normals pointing to the centre', () => {
    const walls = resolveWalls(square());
    expect(walls).toHaveLength(4);
    for (const w of walls) {
      expect(w.length).toBeCloseTo(300);
      const mid = [(w.start[0] + w.end[0]) / 2, (w.start[1] + w.end[1]) / 2];
      const toCentre = [150 - mid[0], 150 - mid[1]];
      expect(toCentre[0] * w.inward[0] + toCentre[1] * w.inward[1]).toBeGreaterThan(0);
    }
    expect(walls.map((w) => w.id)).toEqual(['r.wall-0', 'r.wall-1', 'r.wall-2', 'r.wall-3']);
  });

  it('works for clockwise footprints too', () => {
    const room = square();
    room.footprint = [...room.footprint].reverse();
    for (const w of resolveWalls(room)) {
      const mid = [(w.start[0] + w.end[0]) / 2, (w.start[1] + w.end[1]) / 2];
      expect((150 - mid[0]) * w.inward[0] + (150 - mid[1]) * w.inward[1]).toBeGreaterThan(0);
    }
  });

  it('adds compass tags from northAngle', () => {
    // edge 0 runs along z = 0, so its outward normal is -z
    expect(resolveWalls(square(0))[0].tags).toContain('north wall');
    expect(resolveWalls(square(90))[0].tags).toContain('west wall');
  });

  it('merges stored wall tags and material by edge', () => {
    const room = square();
    room.walls = [{ id: 'r.back', edge: 2, tags: ['back wall'], material: 'tiles', thickness: 12 }];
    const w = resolveWalls(room)[2];
    expect(w.id).toBe('r.back');
    expect(w.tags).toEqual(expect.arrayContaining(['back wall', 'south wall']));
    expect(w.material).toBe('tiles');
    expect(w.thickness).toBe(12);
  });
});

describe('compassOf', () => {
  it('returns null for diagonal walls', () => {
    expect(compassOf([Math.SQRT1_2, Math.SQRT1_2], 0)).toBeNull();
  });
});

describe('wallSegments', () => {
  const wall = resolveWalls(square())[0];
  it('cuts a door out of a wall', () => {
    const door = OpeningSchema.parse({ id: 'r.door', type: 'door', wall: wall.id, offset: 40, width: 80, height: 210 });
    const segs = wallSegments(wall, [door], 260);
    expect(segs).toEqual(expect.arrayContaining([
      { u0: 0, u1: 40, y0: 0, y1: 260 },
      { u0: 120, u1: 300, y0: 0, y1: 260 },
      { u0: 40, u1: 120, y0: 210, y1: 260 },
    ]));
    expect(segs).toHaveLength(3);
  });

  it('keeps wall below a window sill', () => {
    const win = OpeningSchema.parse({ id: 'r.win', type: 'window', wall: wall.id, offset: 100, width: 100, height: 120, sill: 90 });
    const segs = wallSegments(wall, [win], 260);
    expect(segs).toEqual(expect.arrayContaining([{ u0: 100, u1: 200, y0: 0, y1: 90 }]));
    expect(segs).toHaveLength(4);
  });

  it('returns the full wall when it has no openings', () => {
    expect(wallSegments(wall, [], 260)).toEqual([{ u0: 0, u1: 300, y0: 0, y1: 260 }]);
  });
});

describe('resolveItemTransform', () => {
  it('places an item against a wall facing into the room', () => {
    const walls = resolveWalls(square());
    const item = ItemSchema.parse({ id: 'r.k', asset: 'a', against: { wall: 'r.wall-0', offset: 50 } });
    const t = resolveItemTransform(item, { w: 80, d: 40 }, walls);
    // wall-0 runs from (0,0) to (300,0): centre is 90 cm along it, back on the wall
    expect(t.position[0]).toBeCloseTo(90);
    expect(t.position[2]).toBeCloseTo(0);
    // local +z maps to (sin r, cos r) which must equal the inward normal (0, 1)
    const r = (t.rotationDeg * Math.PI) / 180;
    expect(Math.sin(r)).toBeCloseTo(walls[0].inward[0]);
    expect(Math.cos(r)).toBeCloseTo(walls[0].inward[1]);
  });

  it('uses position and rotation as given otherwise', () => {
    const item = ItemSchema.parse({ id: 'r.k', asset: 'a', position: [10, 0, 20], rotation: 45 });
    expect(resolveItemTransform(item, { w: 1, d: 1 }, [])).toEqual({ position: [10, 0, 20], rotationDeg: 45 });
  });
});

describe('room helpers', () => {
  it('computes bounds and point-in-polygon', () => {
    expect(roomBounds(square())).toEqual({ minX: 0, maxX: 300, minZ: 0, maxZ: 300 });
    expect(pointInPolygon([150, 150], square().footprint)).toBe(true);
    expect(pointInPolygon([350, 150], square().footprint)).toBe(false);
  });
});

describe('facing', () => {
  it('turns a yaw into a compass bearing using the room northAngle', () => {
    // yaw 0 looks towards -z, which is north when northAngle = 0
    expect(facing(0, 0)).toEqual({ bearing: 0, compass: 'north' });
    // positive yaw turns left: from north that is west
    expect(facing(90, 0)).toEqual({ bearing: 270, compass: 'west' });
    expect(facing(-45, 0)).toEqual({ bearing: 45, compass: 'north-east' });
    // north points to +x: looking down -z is then west
    expect(facing(0, 90).compass).toBe('west');
  });
});

describe('wallOverrun', () => {
  it('runs walls on into the neighbour at inside corners only', () => {
    // a room with an outside corner at (100,50): an L-shape
    const room = RoomSchema.parse({
      id: 'l', name: 'L', footprint: [[0, 0], [200, 0], [200, 100], [100, 100], [100, 50], [0, 50]], ceilingHeight: 250,
      floor: { material: 'x' }, ceiling: { material: 'x' },
    });
    const walls = resolveWalls(room);
    // wall 0 (top): both corners are inside corners
    expect(wallOverrun(walls, 0)).toEqual({ start: 9.5, end: 9.5 });
    // wall 3 runs from (100,100) up to (100,50): its end is the outside corner, so it stops there
    expect(wallOverrun(walls, 3)).toEqual({ start: 9.5, end: 0 });
    expect(wallOverrun(walls, 4).start).toBe(0);
  });
});
