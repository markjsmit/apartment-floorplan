import { describe, expect, it } from 'vitest';
import { assetSize } from '../src/model/assets';
import { RoomSchema } from '../src/model/schema';
import { resolveWalls } from '../src/model/geometry';
import { buildColliders, isFree } from '../src/model/collision';
import {
  coffeeTable, cornerCabinet, cornerCloset, cushions, floorLamp, kitchenRail, kitchenShelf, MODELS, pendant, plant, rug, slatPanel, stool, tallCabinet, tvArm, wallArt,
} from '../src/model/generators/decor';
import { closetSystem } from '../src/model/generators/bathroom';
import { stuffParts } from '../src/model/generators/stuff';

const size = (parts: ReturnType<typeof plant>) => assetSize(parts, undefined);

describe('design furniture', () => {
  it('coffee table drawers (remotes on top, a deep one below an open shelf) sit on the front (+z) and pull out towards it', () => {
    const parts = coffeeTable({ width: 120, depth: 60, height: 40, drawers: 2 });
    const drawers = parts.filter((p) => p.tags.includes('drawer'));
    expect(drawers).toHaveLength(3); // 2 slim remote drawers under the top + the deep one at the bottom
    for (const d of drawers) {
      expect(d.position[2]).toBeGreaterThan(55);
      expect(d.open?.position?.[2]).toBeGreaterThan(d.position[2]);
    }
    expect(size(parts).h).toBeCloseTo(40);
  });

  it('a counter stool seat is at its seat height, its legs start under the seat', () => {
    const parts = stool({ seatHeight: 65, seatSize: 36, base: 'four' });
    for (const leg of parts.filter((p) => p.id.startsWith('leg-'))) expect(Math.hypot(leg.position[0], leg.position[2] - 22)).toBeLessThan(18);
    expect(size(stool({ seatHeight: 65, seatSize: 36 })).h).toBeCloseTo(65, 0); // splayed legs: bounds treat them as boxes
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

  it('a magnet board is covered in photo magnets (real photos when asked), all on the board', () => {
    const parts = wallArt({ width: 147, height: 77, photos: 16 });
    expect(parts.filter((p) => p.tags.includes('magnet'))).toHaveLength(16);
    const full = wallArt({ width: 147, height: 77, photos: 500, photoTextures: 8 });
    const magnets = full.filter((p) => p.tags.includes('magnet')).length;
    expect(magnets).toBeGreaterThan(40); // packed edge to edge, capped by what fits
    expect(magnets).toBeLessThan(80);
    expect(full.some((p) => p.material === 'photo-magnet-1' || p.material === 'photo-magnet-2')).toBe(true);
    expect(size(full).w).toBeLessThan(147 + 6);
    const s = size(parts);
    expect(s.w).toBeLessThan(147 + 6);
    expect(s.max[1]).toBeLessThan(77 + 6);
  });

  it('a corner broom closet keeps the vacuum, mop + ironing board inside its triangle and its door swings out', () => {
    const { parts, states } = cornerCloset({ legX: 75, legZ: 52, height: 238 });
    const inside = parts.filter((p) => p.tags.includes('cleaning'));
    for (const tag of ['vacuum', 'mop', 'ironing board']) expect(inside.some((p) => p.tags.includes(tag))).toBe(true);
    for (const p of inside) {
      const [x, , z] = p.position;
      expect(x).toBeLessThan(0);
      expect(z).toBeLessThan(0);
      expect(x / 75 + z / 52).toBeGreaterThan(-1);
    }
    const s = size(parts);
    expect(s.min[0]).toBeGreaterThan(-77);
    expect(s.max[2]).toBeLessThan(3);
    expect(s.h).toBeCloseTo(238, 0);
    const door = parts.find((p) => p.id === 'door')!;
    expect(door.pivot).toBeDefined();
    expect(states.find((st) => st.id === 'open')!.parts.door.rotation![1]).toBeGreaterThan(0);
  });

  it('a tall cabinet and a closet section can be a broom closet', () => {
    const { parts } = tallCabinet({ width: 45, depth: 40, height: 190, columns: [{ stack: [{ kind: 'door', content: 'cleaning' }] }] });
    const vac = parts.filter((p) => p.tags.includes('vacuum'));
    expect(vac.length).toBeGreaterThan(0);
    for (const p of vac) expect(Math.abs(p.position[0])).toBeLessThan(22.5);
    const closet = closetSystem({ height: 215, depth: 40, sections: [{ w: 33, kind: 'broom' }] });
    expect(closet.some((p) => p.tags.includes('mop'))).toBe(true);
  });

  it('free-standing open corner shelves have posts, no backs, and a rounded back corner', () => {
    const parts = cornerCabinet({ open: true, backs: false, round: 35, legX: 75, legZ: 76, height: 200, contents: 'games whisky' });
    expect(parts.some((p) => p.tags.includes('back'))).toBe(false);
    expect(parts.filter((p) => p.tags.includes('post'))).toHaveLength(3);
    const shelf = parts.find((p) => p.id === 'shelf-1')!;
    const g = shelf.geometry;
    const pts: [number, number][] = g?.type === 'prism' ? g.points : [];
    // nothing left at the sharp corner (outline +a/2, +b/2)
    expect(pts.some(([x, y]) => Math.abs(x - 37.5) < 0.5 && Math.abs(y - 38) < 0.5)).toBe(false);
    expect(pts.length).toBeGreaterThan(10);
  });

  it('slat cladding is slats with gaps on a backing, within its width', () => {
    const parts = slatPanel({ width: 116, height: 277, depth: 2 });
    expect(parts.filter((p) => p.tags.includes('slat')).length).toBeGreaterThan(25);
    expect(size(parts).w).toBeLessThanOrEqual(116.01);
  });

  it('a TV arm holds the VESA plate `reach` out and `shift` to the side', () => {
    const vesa = tvArm({ reach: 25, shift: 10 }).find((p) => p.id === 'vesa-plate')!;
    expect(vesa.position[0]).toBeCloseTo(10, 5);
    expect(vesa.position[2]).toBeGreaterThan(23);
    expect(vesa.position[2]).toBeLessThan(25);
  });

  it('a round mirror is a ring with glass, as wide as asked', () => {
    const parts = wallArt({ round: true, width: 60, height: 60 });
    expect(parts.some((p) => p.material === 'mirror')).toBe(true);
    expect(size(parts).w).toBeCloseTo(60, 0);
  });

  it('a kitchen shelf carries its groups on the board, within its width', () => {
    const parts = kitchenShelf({ width: 100, depth: 20, contents: 'cups jars bottles', seed: 't' });
    for (const tag of ['mug', 'jar', 'bottle']) expect(parts.some((p) => p.tags.includes(tag))).toBe(true);
    const s = size(parts);
    expect(s.w).toBeLessThanOrEqual(101);
    expect(s.max[2]).toBeLessThanOrEqual(21);
    // pantry jars carry a label with what is inside
    expect(parts.some((p) => p.label && ['RICE', 'PASTA', 'LENTILS', 'COFFEE', 'OATS', 'SUGAR', 'BEANS', 'COUSCOUS'].includes(p.label.text))).toBe(true);
  });

  it('a kitchen rail hangs its things below the rail, close to the wall', () => {
    const parts = kitchenRail({ width: 70, hang: 'mug ladle herbs towel' });
    const hung = parts.filter((p) => ['mug', 'utensil', 'towel'].some((t) => p.tags.includes(t)));
    expect(hung.length).toBeGreaterThan(3);
    for (const p of hung) expect(p.position[1]).toBeLessThan(0);
    expect(size(parts).max[2]).toBeLessThan(12);
  });
});
