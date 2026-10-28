import { describe, expect, it } from 'vitest';
import { upAtCeiling } from '../src/model/placement';

const at = (y: number, h: number) => ({ position: [0, y, 0] as [number, number, number], size: { min: [-50, 0, 0], max: [50, h, 30], w: 100, h, d: 30 } as never });

describe('upAtCeiling', () => {
  it('hides vents and lamps at the ceiling in the plan view', () => {
    expect(upAtCeiling(at(238, 39), 277)).toBe(true); // AC unit box under the ceiling
    expect(upAtCeiling(at(255, 22), 277)).toBe(true); // track light
  });

  it('keeps floor-standing and wall-hung things', () => {
    expect(upAtCeiling(at(0, 238), 238)).toBe(false); // full-height cabinet
    expect(upAtCeiling(at(152, 86), 238)).toBe(false); // wall cabinet up to a lowered ceiling
    expect(upAtCeiling(at(224, 40), 277)).toBe(false); // suitcases on top of a wardrobe
  });
});
