import { describe, expect, it } from 'vitest';
import { assetSize } from '../src/model/assets';
import { kitchenCounter, kitchenIsland, kitchenTall, kitchenWallCabinet, plainBox, slidingDoor, trackLight } from '../src/model/generators/builtins';
import type { Part } from '../src/model/schema';

const parts = (g: Part[] | { parts: Part[] }) => (Array.isArray(g) ? g : g.parts);

describe('built-in generators', () => {
  it('box is exactly its params, back on z = 0', () => {
    const s = assetSize(plainBox({ width: 110, height: 235, depth: 45 }), undefined);
    expect([s.w, s.h, s.d]).toEqual([110, 235, 45]);
    expect(s.min[2]).toBeCloseTo(0);
  });

  it('kitchen counter is length x 90 x 62 and only has a sink when asked', () => {
    const plain = kitchenCounter({ length: 243 });
    const s = assetSize(plain, undefined);
    expect(s.w).toBeCloseTo(243);
    expect(s.h).toBeCloseTo(90);
    expect(s.max[2]).toBeLessThanOrEqual(62 + 2.5); // handles stick out a little
    expect(plain.some((p) => p.tags.includes('sink'))).toBe(false);
    expect(kitchenCounter({ length: 243, sinkCenter: null }).some((p) => p.tags.includes('sink'))).toBe(false);
    expect(kitchenCounter({ length: 243, sinkCenter: 130 }).some((p) => p.tags.includes('sink'))).toBe(true);
  });

  it('island keeps its footprint and puts the hob on top', () => {
    const p = kitchenIsland({ length: 170, depth: 100, hobCenter: 125 });
    const s = assetSize(p, undefined);
    expect(s.w).toBeCloseTo(170);
    expect(s.d).toBeLessThanOrEqual(100 + 2.5);
    const hob = p.find((x) => x.id === 'hob')!;
    expect(hob.position[0]).toBeCloseTo(-85 + 125);
    expect(hob.position[1]).toBeGreaterThan(90);
  });

  it('tall units are as wide as their columns and leave the fridge niche empty', () => {
    const p = kitchenTall({ height: 235, columns: [{ w: 60, kind: 'pantry' }, { w: 100, kind: 'fridge' }, { w: 60, kind: 'oven' }] });
    const s = assetSize(p, undefined);
    expect(s.w).toBeCloseTo(220);
    expect(s.h).toBeCloseTo(235);
    // nothing but the two side panels below the bridge cabinet inside the niche (x -50..50)
    const inNiche = p.filter((x) => x.position[0] > -49 && x.position[0] < 49 && x.position[1] < 190 && x.position[1] > 10);
    expect(inNiche).toEqual([]);
  });

  it('wall cabinet flap swings up and out', () => {
    const g = kitchenWallCabinet({ width: 60, height: 75 });
    const open = assetSize(g.parts, g.states.find((s) => s.id === 'open'));
    expect(open.max[2]).toBeGreaterThan(35 + 40);
    expect(g.interactions.some((i) => i.part === 'flap')).toBe(true);
  });

  it('sliding door fills its opening and the sliding panel moves left when open', () => {
    const g = slidingDoor({ width: 300, height: 240, wallThickness: 10 });
    const s = assetSize(g.parts, undefined);
    expect(s.w).toBeCloseTo(300);
    expect(s.h).toBeCloseTo(240);
    const glass = g.parts.find((p) => p.id === 'slide-glass')!;
    const open = g.states.find((x) => x.id === 'open')!.parts['slide-glass'];
    expect(open.position![0]).toBeLessThan(glass.position[0] - 100);
  });

  it('track light hangs within its 22 cm', () => {
    const s = assetSize(parts(trackLight({ length: 220, spots: 3 })), undefined);
    expect(s.w).toBeCloseTo(220);
    expect(s.min[1]).toBeGreaterThanOrEqual(0);
    expect(s.max[1]).toBeLessThanOrEqual(22);
  });
});
