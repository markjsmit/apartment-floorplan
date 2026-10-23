import { describe, expect, it } from 'vitest';
import { generators } from '../src/model/generators';
import { assetSize, openingParams } from '../src/model/assets';
import { FurnitureAssetSchema, type Part } from '../src/model/schema';
import { door, windowParts } from '../src/model/generators/openings';

describe('door generator', () => {
  const parts = door({ width: 83, height: 211, wallThickness: 10 });
  it('fills the opening exactly and sits inside the wall', () => {
    const s = assetSize(parts.filter((p) => !p.tags.includes('casing')), undefined);
    expect(s.w).toBeCloseTo(83);
    expect(s.h).toBeCloseTo(211);
    expect(s.min[2]).toBeCloseTo(-10);
    expect(s.max[2]).toBeLessThanOrEqual(3);
  });
  it('has casings that overlap the wall by a few cm on both faces', () => {
    const s = assetSize(parts, undefined);
    expect(s.w).toBeGreaterThan(83);
    expect(s.w).toBeLessThanOrEqual(83 + 8);
    expect(s.min[2]).toBeLessThan(-10);
    expect(s.max[2]).toBeLessThanOrEqual(3);
  });
  it('has a hinged leaf that swings into the room', () => {
    const leaf = parts.find((p) => p.id === 'leaf')!;
    expect(leaf.pivot).toBeDefined();
    const open = assetSize(parts, { id: 'open', name: 'Open', parts: { leaf: { rotation: [0, -90, 0] }, 'handle-in': { rotation: [0, -90, 0] }, 'handle-out': { rotation: [0, -90, 0] } } });
    expect(open.max[2]).toBeGreaterThan(70);
  });
});

describe('window generator', () => {
  const parts = windowParts({ width: 130, height: 140, wallThickness: 10 });
  it('has a glass pane and fits the opening', () => {
    expect(parts.some((p) => p.glass)).toBe(true);
    const s = assetSize(parts, undefined);
    expect(s.w).toBeCloseTo(130, 0);
    expect(s.h).toBeLessThanOrEqual(140 + 3);
  });
});

describe('window params', () => {
  it('takes a frame material and can leave out the sill board', () => {
    const parts = windowParts({ width: 100, height: 125, wallThickness: 10, frameMaterial: 'aluminium-grey', sillBoard: false });
    expect(parts.find((p) => p.id === 'frame-left')!.material).toBe('aluminium-grey');
    expect(parts.some((p) => p.id === 'sill')).toBe(false);
  });
  it('openingParams merges asset defaults, opening params and the opening size', () => {
    const asset = FurnitureAssetSchema.parse({
      id: 'w', name: 'W', source: { kind: 'procedural', generator: 'window' },
      params: { frameMaterial: { default: 'white-laminate' }, sillBoard: { default: true } },
    });
    const p = openingParams(asset, { width: 100, height: 125, params: { sillBoard: false } }, 12);
    expect(p).toEqual({ frameMaterial: 'white-laminate', sillBoard: false, width: 100, height: 125, wallThickness: 12 });
  });
});

describe('besta generator', () => {
  it('builds a 4 x 3 grid of 60x22x64 cabinets with doors that open', () => {
    const out = generators.besta({ cols: 4, rows: [64, 64, 64] });
    const g = Array.isArray(out) ? { parts: out, states: [] } : out;
    const closed = assetSize(g.parts, undefined);
    expect(closed.w).toBeCloseTo(240);
    expect(closed.h).toBeCloseTo(192);
    expect(closed.d).toBeCloseTo(22);
    expect(g.parts.filter((p) => p.id.endsWith('-door'))).toHaveLength(12);
    const open = g.states!.find((s) => s.id === 'open')!;
    expect(assetSize(g.parts, open).d).toBeGreaterThan(70);
  });
  it('can be open frames', () => {
    expect(Array.isArray(generators.besta({ doors: false }))).toBe(true);
  });
});

describe('stuff on shelves', () => {
  it('puts stuff inside both bridge-shelf cubes, within the tongue footprint', () => {
    const parts = generators['bridge-shelf']({ aisle: 80, depth: 38, contents: 'books', seed: 't' }) as Part[];
    const right = parts.filter((p) => p.id.startsWith('right-'));
    const left = parts.filter((p) => p.id.startsWith('left-'));
    expect(right.length).toBeGreaterThan(3);
    expect(left.length).toBeGreaterThan(3);
    for (const p of right) expect(p.position[0]).toBeGreaterThan(40);
    for (const p of left) expect(p.position[0]).toBeLessThan(-40);
  });
  it('fills every compartment of the plywood shelving', () => {
    const parts = generators['plywood-shelving']({ width: 130, height: 100, depth: 20, sections: 2, shelves: 1, contents: 'boxes' }) as Part[];
    const bays = new Set(parts.filter((p) => p.tags.includes('contents')).map((p) => p.id.split('-').slice(0, 3).join('-')));
    expect(bays.size).toBe(4);
  });
});

describe('wall bed + desk', () => {
  const out = generators['wall-bed-desk']({}) as { parts: Part[]; states: { id: string; name: string; parts: Record<string, unknown> }[] };
  const size = (state: string) => assetSize(out.parts, out.states.find((s) => s.id === state) as never);
  it('stands up against the wall with the desk out by default', () => {
    expect(out.states[0].id).toBe('desk');
    const s = size('desk');
    expect(s.max[1]).toBeGreaterThan(35 + 190 - 1); // bed standing
    expect(s.max[2]).toBeCloseTo(50 + 60, 0); // desk sticks out 60 past the base
  });
  it('lies down at base height with the mattress on top', () => {
    const s = size('bed');
    expect(s.max[2]).toBeCloseTo(50 + 190, 0);
    expect(s.max[1]).toBeLessThan(35 + 12 + 18 + 1);
    expect(s.min[1]).toBeGreaterThanOrEqual(-0.01);
  });
  it('folds the desk flat against the bed', () => {
    expect(size('folded').max[2]).toBeLessThan(50 + 10);
  });
});
