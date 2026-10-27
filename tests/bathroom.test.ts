import { describe, expect, it } from 'vitest';
import { assetSize } from '../src/model/assets';
import { generators } from '../src/model/generators';
import { bathroomVanity, bathtub, closetSystem, showerEnclosure, toiletWallHung, washerDryerColumn } from '../src/model/generators/bathroom';
import type { AssetState, Part } from '../src/model/schema';

const open = (g: { states: AssetState[] }) => g.states.find((s) => s.id === 'open');
const ids = (p: Part[]) => p.map((x) => x.id);

describe('bathroom generators', () => {
  it('are registered under their asset ids', () => {
    for (const id of ['bathroom-vanity', 'toilet-wall-hung', 'bathtub', 'shower-enclosure', 'washer-dryer-column', 'closet-system']) {
      expect(generators[id]).toBeTypeOf('function');
    }
  });

  it('vanity is width x height x depth without the mirror, back on z = 0, doors swing open', () => {
    const g = bathroomVanity({ width: 80, depth: 46, height: 85, mirror: false });
    const s = assetSize(g.parts.filter((p) => !p.tags.includes('tap')), undefined);
    expect(s.w).toBeCloseTo(80);
    expect(s.h).toBeCloseTo(85);
    expect(s.min[2]).toBeCloseTo(0);
    expect(s.max[2]).toBeLessThanOrEqual(46 + 2.5); // knobs stick out a little
    expect(ids(g.parts)).not.toContain('mirror');
    expect(open(g)!.parts['door-l'].rotation![1]).toBeLessThan(0);
    expect(open(g)!.parts['door-r'].rotation![1]).toBeGreaterThan(0);
    expect(assetSize(g.parts, open(g)).max[2]).toBeGreaterThan(46 + 30);
    expect(g.interactions.some((i) => i.part === 'door-l')).toBe(true);
  });

  it('vanity mirror follows its params (width defaults to the vanity)', () => {
    const g = bathroomVanity({ width: 100 });
    const m = g.parts.filter((p) => p.tags.includes('mirror'));
    const s = assetSize(m, undefined);
    expect(s.w).toBeCloseTo(100);
    expect(s.min[1]).toBeCloseTo(110);
    expect(s.max[1]).toBeCloseTo(190);
    expect(assetSize(bathroomVanity({ mirrorWidth: 60, mirrorFrame: '' }).parts.filter((p) => p.tags.includes('mirror')), undefined).w).toBeCloseTo(60);
  });

  it('toilet ledge is its params, bowl 54 deep in front of it with the seat at ~42', () => {
    const p = toiletWallHung({ ledgeWidth: 80, ledgeHeight: 110, ledgeDepth: 20, bowlOffset: 10 });
    const s = assetSize(p, undefined);
    expect(s.w).toBeCloseTo(80);
    expect(s.h).toBeCloseTo(110);
    expect(s.min[2]).toBeCloseTo(0);
    expect(s.max[2]).toBeCloseTo(20 + 54);
    const bowl = assetSize(p.filter((x) => x.tags.includes('bowl')), undefined);
    expect(bowl.w).toBeCloseTo(36);
    expect((bowl.min[0] + bowl.max[0]) / 2).toBeCloseTo(10);
    expect(assetSize(p.filter((x) => x.id.startsWith('seat')), undefined).max[1]).toBeCloseTo(42);
    expect(p.find((x) => x.id === 'ledge')!.material).toBe('tiles-dark-grey');
  });

  it('bathtub is length x height x width, mixer at the chosen end, screen only when asked', () => {
    const p = bathtub({ length: 170, width: 70, height: 55 });
    const tub = assetSize(p.filter((x) => !x.tags.includes('mixer') && !x.tags.includes('hand shower')), undefined);
    expect([tub.w, tub.h, tub.d].map(Math.round)).toEqual([170, 55, 70]);
    expect(tub.min[2]).toBeCloseTo(0);
    expect(p.find((x) => x.id === 'mixer-body')!.position[0]).toBeLessThan(0);
    expect(bathtub({ mixerSide: 'right' }).find((x) => x.id === 'mixer-body')!.position[0]).toBeGreaterThan(0);
    expect(p.some((x) => x.tags.includes('screen'))).toBe(false);
    const screen = bathtub({ screen: true, screenWidth: 80 }).filter((x) => x.tags.includes('screen'));
    expect(assetSize(screen, undefined).w).toBeCloseTo(80);
    expect(screen.find((x) => x.id === 'screen')!.glass).toBe(true);
  });

  it('shower is width x depth, glass is frosted by default, the door opens outwards', () => {
    const g = showerEnclosure({ width: 90, depth: 90, height: 200 });
    const glass = g.parts.filter((p) => p.glass);
    const s = assetSize(glass.concat(g.parts.filter((p) => p.tags.includes('frame'))), undefined);
    expect(s.w).toBeCloseTo(90);
    expect(s.h).toBeCloseTo(200);
    expect(s.min[2]).toBeCloseTo(0);
    expect(s.max[2]).toBeCloseTo(90);
    expect(glass.every((p) => p.material === 'glass-frosted')).toBe(true);
    expect(showerEnclosure({ glass: 'clear' }).parts.filter((p) => p.glass).every((p) => p.material === 'glass')).toBe(true);
    expect(assetSize(g.parts.filter((p) => p.tags.includes('door')), open(g)).max[2]).toBeGreaterThan(90 + 60);
    expect(g.interactions.some((i) => i.part === 'door-glass')).toBe(true);
    expect(showerEnclosure({ sidePanel: false }).parts.some((p) => p.id === 'side-glass')).toBe(false);
    // wide fronts get a fixed panel next to the door
    expect(showerEnclosure({ width: 120 }).parts.some((p) => p.id === 'fixed-glass')).toBe(true);
    expect(g.parts.some((p) => p.id === 'fixed-glass')).toBe(false);
  });

  it('washer/dryer column is its params and shows the machines behind the open doors', () => {
    const g = washerDryerColumn({ width: 65, depth: 62, height: 220 });
    const s = assetSize(g.parts, undefined);
    expect(s.w).toBeCloseTo(65);
    expect(s.h).toBeCloseTo(220);
    expect(s.min[2]).toBeCloseTo(0);
    expect(s.max[2]).toBeLessThanOrEqual(62 + 2.5);
    const washer = g.parts.find((p) => p.id === 'washer')!;
    const dryer = g.parts.find((p) => p.id === 'dryer')!;
    expect(dryer.position[1]).toBeGreaterThan(washer.position[1] + 80);
    // the round machine doors stay behind the closed cabinet doors
    expect(assetSize(g.parts.filter((p) => p.tags.includes('porthole')), undefined).max[2]).toBeLessThan(62 - 1.8);
    for (const d of ['door-l', 'door-r', 'door-top']) expect(open(g)!.parts[d].rotation).toBeDefined();
    expect(g.interactions.some((i) => i.part === 'door-r')).toBe(true);
  });

  it('closet system is sections + posts wide, as tall as the ceiling, and has what each kind promises', () => {
    const p = closetSystem({ height: 270, depth: 40, sections: [{ w: 80, kind: 'hang' }, { w: 80, kind: 'hang2' }, { w: 80, kind: 'drawers', drawers: 2 }, { w: 40, kind: 'shelves' }] });
    const s = assetSize(p, undefined);
    expect(s.w).toBeCloseTo(280 + 5 * 3);
    expect(s.h).toBeCloseTo(270);
    expect(s.min[2]).toBeCloseTo(0);
    expect(s.max[2]).toBeLessThanOrEqual(40);
    expect(p.filter((x) => x.id.startsWith('s1-rail'))).toHaveLength(1);
    expect(p.filter((x) => x.id.startsWith('s2-rail') && x.tags.includes('rail'))).toHaveLength(2);
    expect(p.filter((x) => /^s3-drawer-\d$/.test(x.id))).toHaveLength(2);
    expect(p.filter((x) => /^s4-shelf-\d$/.test(x.id))).toHaveLength(5);
    expect(closetSystem({}).filter((x) => /^s2-drawer-\d$/.test(x.id))).toHaveLength(3);
    expect(() => closetSystem({ sections: [{ w: 80, kind: 'hanger' }] })).toThrow(/unknown closet section/);
  });
});
