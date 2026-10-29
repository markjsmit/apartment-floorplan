import { describe, expect, it } from 'vitest';
import { assetSize } from '../src/model/assets';
import { RoomSchema } from '../src/model/schema';
import { resolveWalls } from '../src/model/geometry';
import { buildColliders, isFree } from '../src/model/collision';
import {
  coffeeTable, cornerCabinet, cushions, floorLamp, MODELS, pendant, plant, rug, stool, tallCabinet,
} from '../src/model/generators/decor';
import { stuffParts } from '../src/model/generators/stuff';

const size = (parts: ReturnType<typeof plant>) => assetSize(parts, undefined);

describe('design furniture', () => {
  it('coffee table drawers sit on the front (+z) and pull out towards it', () => {
    const parts = coffeeTable({ width: 120, depth: 60, height: 40, drawers: 2 });
    const drawers = parts.filter((p) => p.tags.includes('drawer'));
    expect(drawers).toHaveLength(2);
    for (const d of drawers) {
      expect(d.position[2]).toBeGreaterThan(55);
      expect(d.open?.position?.[2]).toBeGreaterThan(d.position[2]);
    }
    expect(size(parts).h).toBeCloseTo(40);
  });

  it('a counter stool seat is at its seat height', () => {
    expect(size(stool({ seatHeight: 65, seatSize: 36 })).h).toBeCloseTo(65);
  });

  it('a pendant hangs from the ceiling down to its shade bottom', () => {
    const s = size(pendant({ ceiling: 277, bottom: 150, shape: 'globe', diameter: 40 }));
    expect(s.max[1]).toBeCloseTo(277);
    expect(s.min[1]).toBeCloseTo(150);
  });

  it('a black metal lamp glows from a bulb, not its shade', () => {
    const parts = floorLamp({ shade: 'dome', shadeColor: '#2a2a2a' });
    expect(parts.find((p) => p.id === 'shade')?.emit).toBeUndefined();
    expect(parts.find((p) => p.id === 'bulb')?.emit).toBeDefined();
    expect(floorLamp({ shade: 'paper' }).find((p) => p.id === 'shade')?.emit).toBeDefined();
  });

  it('a simple plant stays within its spread and height', () => {
    for (const kind of ['tree', 'fig', 'bush', 'snake', 'palm', 'monstera', 'strelitzia']) {
      const s = size(plant({ kind, height: 150, spread: 60, potDiameter: 30, seed: kind }));
      expect(s.min[1]).toBeGreaterThanOrEqual(-0.01);
      expect(s.max[1]).toBeLessThanOrEqual(150 * 1.15);
      expect(s.w).toBeLessThanOrEqual(60 * 1.35);
    }
  });

  it('a trailing plant hangs down from its pot (for shelves and hooks)', () => {
    const s = size(plant({ kind: 'trailing', height: 50, spread: 30, potDiameter: 16 }));
    expect(s.min[1]).toBeLessThan(0);
    expect(s.max[1]).toBeLessThan(40);
  });

  it('a plant can be a real model, sized to its height', () => {
    const parts = plant({ kind: 'tree', height: 165, model: 'leafy-tree' });
    const m = parts.find((p) => p.geometry?.type === 'model');
    expect(m?.geometry).toMatchObject({ type: 'model', file: MODELS['leafy-tree'].file });
    expect(size(parts).h).toBeCloseTo(165);
  });

  it('a corner cabinet fills the corner behind its origin', () => {
    const s = size(cornerCabinet({ legX: 75, legZ: 76, height: 238 }));
    expect(s.min[0]).toBeGreaterThan(-77);
    expect(s.max[0]).toBeLessThan(1);
    expect(s.min[2]).toBeGreaterThan(-78);
    expect(s.max[2]).toBeLessThan(1);
    expect(s.h).toBeCloseTo(238, 0);
  });

  it('cushions can sit exactly at given positions', () => {
    const parts = cushions({ colors: '#fff,#eee', positions: [[-60, 70, 40], [60, 70, 40]] });
    expect(parts.map((p) => p.position)).toEqual([[-60, 70, 40], [60, 70, 40]]);
  });
});

describe('rugs are walked on', () => {
  const room = RoomSchema.parse({
    id: 'r', name: 'R', footprint: [[0, 0], [300, 0], [300, 300], [0, 300]], ceilingHeight: 260, floor: { material: 'f' }, ceiling: { material: 'c' },
  });
  it("don't block walking", () => {
    const s = size(rug({ width: 200, depth: 200 }));
    const item = { position: [150, 0, 50] as [number, number, number], rotationDeg: 0, min: s.min, max: s.max };
    expect(isFree([150, 150], 20, buildColliders(resolveWalls(room), [item]))).toBe(true);
  });
});

describe('entry + display furniture', () => {
  it('a tall cabinet opens its doors on the hinge and keeps coats + shoes inside', () => {
    const { parts, states } = tallCabinet({ width: 80, depth: 58, height: 200, columns: [{ stack: [{ kind: 'door', h: 60, content: 'shoes' }, { kind: 'open', h: 30, fill: 'baskets' }, { kind: 'door', content: 'coats' }] }] });
    const s = size(parts);
    expect(s.max[2]).toBeLessThan(58 + 6);
    expect(s.min[2]).toBeGreaterThanOrEqual(-0.01);
    expect(parts.some((p) => p.tags.includes('coat'))).toBe(true);
    expect(parts.some((p) => p.tags.includes('shoes'))).toBe(true);
    const open = states.find((st) => st.id === 'open')!;
    const door = parts.find((p) => p.id === 'c1-1-front')!;
    expect(door.pivot).toBeDefined();
    expect(Math.abs(open.parts['c1-1-front'].rotation![1])).toBeCloseTo(100);
  });

  it('shoes fill a KALLAX-size cube on 2 levels (a shelf insert): 2 pairs per cube', () => {
    const parts = stuffParts('shoes', 'cube', 33, 37, 33);
    expect(new Set(parts.filter((p) => p.tags.includes('shoes')).map((p) => p.id.replace(/-[lr]-.*$/, ''))).size).toBe(2);
    expect(parts.some((p) => p.tags.includes('shelf'))).toBe(true);
  });

  it('open corner shelves show their contents inside the triangle', () => {
    const parts = cornerCabinet({ open: true, legX: 75, legZ: 76, height: 200, contents: 'games whisky' });
    const s = size(parts);
    expect(s.min[0]).toBeGreaterThan(-77);
    expect(s.max[0]).toBeLessThan(1);
    expect(s.min[2]).toBeGreaterThan(-78);
    expect(s.max[2]).toBeLessThan(1);
    expect(parts.some((p) => p.tags.includes('whisky'))).toBe(true);
    expect(parts.some((p) => p.tags.includes('game'))).toBe(true);
    expect(parts.some((p) => p.tags.includes('door'))).toBe(false);
  });

  it('design furniture has eased edges, not perfect 90° corners', () => {
    const top = coffeeTable({ width: 120, depth: 60 }).find((p) => p.id === 'top')!;
    expect(top.geometry).toMatchObject({ type: 'box' });
    expect((top.geometry as { radius?: number }).radius).toBeGreaterThan(0);
  });
});
