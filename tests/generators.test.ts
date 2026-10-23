import { describe, expect, it } from 'vitest';
import { assetSize } from '../src/model/assets';
import { generators } from '../src/model/generators';

describe('door generator', () => {
  const parts = generators.door({ width: 83, height: 211, wallThickness: 10 });
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
  const parts = generators.window({ width: 130, height: 140, wallThickness: 10 });
  it('has a glass pane and fits the opening', () => {
    expect(parts.some((p) => p.glass)).toBe(true);
    const s = assetSize(parts, undefined);
    expect(s.w).toBeCloseTo(130, 0);
    expect(s.h).toBeLessThanOrEqual(140 + 3);
  });
});
