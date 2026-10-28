import { describe, expect, it } from 'vitest';
import { loadBundleFromDisk } from '../tools/load-files';
import { RoomSchema } from '../src/model/schema';
import { roomStorage } from '../src/model/storage';

const { furniture } = loadBundleFromDisk();
const room = (items: object[]) => RoomSchema.parse({
  id: 'r', name: 'R', footprint: [[0, 0], [300, 0], [300, 300], [0, 300]], ceilingHeight: 277,
  floor: { material: 'wood' }, ceiling: { material: 'paint' }, wallMaterial: 'paint', items,
});
const kallax = (id: string, against: object) => ({ id, asset: 'ikea-kallax-112x147', params: { cols: 2, rows: 2 }, against });

describe('roomStorage', () => {
  it('counts Kallax cubes and the free space on top', () => {
    const s = roomStorage(room([kallax('k', { wall: 'r.wall-0', offset: 100 })]), furniture);
    expect(s.kallax).toBeCloseTo(4 * 43.77, 0);
    // 77 x 39 top, 60 cm counted (of 200 to the ceiling)
    expect(s.tops).toBeGreaterThan(150);
    expect(s.tops).toBeLessThan(190);
  });

  it('does not count a cube that opens onto a shelf stack (no double counting)', () => {
    const k = kallax('k', { wall: 'r.wall-0', offset: 100 });
    const shelf = { id: 's', asset: 'box', params: { width: 77, depth: 40, height: 1.8 }, position: [138.5, 70, 39], rotation: 0 };
    const s = roomStorage(room([k, shelf]), furniture);
    expect(s.kallaxLostCubes).toBe(4);
  });

  it('does not count cubes that face another piece of furniture', () => {
    // two 2x2 face to face, 5 cm apart
    const a = { id: 'a', asset: 'ikea-kallax-112x147', params: { cols: 2, rows: 2 }, position: [150, 0, 100], rotation: 0 };
    const b = { id: 'b', asset: 'ikea-kallax-112x147', params: { cols: 2, rows: 2 }, position: [150, 0, 183], rotation: 180 };
    const s = roomStorage(room([a, b]), furniture);
    expect(s.kallaxLostCubes).toBe(8);
    expect(s.kallax).toBe(0);
  });

  it('counts shelf boards with the floor under the lowest one, but not a board you cannot reach', () => {
    const shelf = (id: string, y: number) => ({ id, asset: 'box', params: { width: 80, depth: 40, height: 1.8 }, against: { wall: 'r.wall-0', offset: 10, elevation: y } });
    const open = roomStorage(room([shelf('s1', 70), shelf('s2', 110)]), furniture);
    // floor→70 + 40 (70→110) + 60 (capped) over 80 x 40
    expect(open.shelves).toBeCloseTo((80 * 40 * (70 + 38.2 + 60)) / 1000, -1);
    // a wall-to-wall shelf with a wall-to-wall cabinet 80 deep in front: more than an arm's length from anywhere you can stand
    const long = { id: 'l', asset: 'box', params: { width: 300, depth: 40, height: 1.8 }, against: { wall: 'r.wall-0', offset: 0, elevation: 70 } };
    const cabinet = { id: 'c', asset: 'box', params: { width: 300, depth: 80, height: 224 }, position: [150, 0, 40], rotation: 0 };
    expect(roomStorage(room([long, cabinet]), furniture).shelves).toBe(0);
  });
});
