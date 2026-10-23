import { describe, expect, it } from 'vitest';
import { assetSize, openingParams } from '../src/model/assets';
import { FurnitureAssetSchema } from '../src/model/schema';
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
