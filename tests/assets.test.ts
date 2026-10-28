import { describe, expect, it } from 'vitest';
import { FurnitureAssetSchema, ItemSchema, type Part } from '../src/model/schema';
import { generators } from '../src/model/generators';
import { withSections, resolveAsset,
  assetSize, initialState, interactivePart, nextState, partTransform, resolveParams, resolveParts,
} from '../src/model/assets';

const kallax = FurnitureAssetSchema.parse({
  id: 'ikea-kallax', name: 'Kallax', tags: ['kallax'],
  source: { kind: 'procedural', generator: 'kallax' },
  params: { cols: { default: 2 }, rows: { default: 2 }, color: { default: 'white' } },
});

const wallBed = FurnitureAssetSchema.parse({
  id: 'wall-bed', name: 'Wall bed', tags: [], source: { kind: 'parts' },
  parts: [
    { id: 'frame', geometry: { type: 'box', size: [150, 210, 20] }, position: [0, 105, 10] },
    { id: 'bed', geometry: { type: 'box', size: [140, 20, 200] }, position: [0, 20, 110], pivot: [0, 10, 10] },
  ],
  states: [
    { id: 'up', name: 'Folded up', parts: { bed: { rotation: [-90, 0, 0] } } },
    { id: 'down', name: 'Down', parts: {} },
  ],
  defaultState: 'up',
  interactions: [{ part: 'bed', action: 'cycleStates' }],
});

const item = (extra: object = {}) => ItemSchema.parse({ id: 'r.i', asset: 'x', position: [0, 0, 0], ...extra });

describe('kallax generator', () => {
  it('builds a 2x2 Kallax at real size (77 x 77 x 39)', () => {
    const parts = resolveParts(kallax, resolveParams(kallax, item()));
    const s = assetSize(parts, undefined);
    expect(s.w).toBeCloseTo(77, 0);
    expect(s.h).toBeCloseTo(77, 0);
    expect(s.d).toBeCloseTo(39, 0);
    // origin is back-centre on the floor
    expect(s.min[0]).toBeCloseTo(-38.5, 0);
    expect(s.min[1]).toBeCloseTo(0);
    expect(s.min[2]).toBeCloseTo(0);
  });

  it('builds a 4x4 Kallax at 147 x 147', () => {
    const parts = resolveParts(kallax, resolveParams(kallax, item({ params: { cols: 4, rows: 4 } })));
    const s = assetSize(parts, undefined);
    expect(s.w).toBeCloseTo(147, 0);
    expect(s.h).toBeCloseTo(147, 0);
  });
});

describe('states', () => {
  it('rotates a part about its pivot', () => {
    const bed = wallBed.parts[1];
    const t = partTransform(bed, { rotation: [-90, 0, 0] });
    expect(t.position[0]).toBeCloseTo(0);
    expect(t.position[1]).toBeCloseTo(110);
    expect(t.position[2]).toBeCloseTo(0);
    expect(t.rotationDeg).toEqual([-90, 0, 0]);
    expect(t.visible).toBe(true);
  });

  it('shrinks the wall bed footprint when folded up', () => {
    const parts = resolveParts(wallBed, {});
    const down = assetSize(parts, wallBed.states.find((s) => s.id === 'down'));
    const up = assetSize(parts, wallBed.states.find((s) => s.id === 'up'));
    expect(down.d).toBeCloseTo(210);
    expect(up.d).toBeLessThan(35);
  });

  it('cycles states and wraps around', () => {
    expect(nextState(wallBed, 'up')).toBe('down');
    expect(nextState(wallBed, 'down')).toBe('up');
  });

  it('picks the initial state: ui override, then item, then asset default', () => {
    expect(initialState(wallBed, item())).toBe('up');
    expect(initialState(wallBed, item({ state: 'down' }))).toBe('down');
    expect(initialState(wallBed, item({ state: 'down' }), 'up')).toBe('up');
    expect(initialState(wallBed, item({ state: 'nonsense' }))).toBe('up');
  });

  it('knows which parts are interactive', () => {
    expect(interactivePart(wallBed, 'bed')).toBe(true);
    expect(interactivePart(wallBed, 'frame')).toBe(false);
  });
});

describe('part interactions with states', () => {
  it('cycle only through their own states', () => {
    const a = FurnitureAssetSchema.parse({
      id: 'wb', name: 'wb', source: { kind: 'parts', license: 'self-made' }, parts: [{ id: 'desk' }, { id: 'bed' }],
      states: [{ id: 'desk' }, { id: 'folded' }, { id: 'bed' }].map((x) => ({ ...x, name: x.id, parts: {} })),
      interactions: [{ part: 'desk', action: 'cycleStates', states: ['desk', 'folded'] }, { part: 'bed', action: 'cycleStates', states: ['bed', 'folded'] }],
    });
    expect(nextState(a, 'folded', 'desk')).toBe('desk');
    expect(nextState(a, 'desk', 'desk')).toBe('folded');
    expect(nextState(a, 'desk', 'bed')).toBe('bed'); // not in the bed's list: its first state
    expect(nextState(a, 'bed', 'bed')).toBe('folded');
    expect(nextState(a, 'desk')).toBe('folded'); // no part: all states
  });
});

describe('withSections', () => {
  it('makes each group of parts that moves together a section, the rest "body"', () => {
    const a = withSections(FurnitureAssetSchema.parse({
      id: 'sh', name: 'sh', source: { kind: 'parts', license: 'self-made' },
      parts: [{ id: 'frame' }, { id: 'door' }, { id: 'door-handle' }],
      states: [
        { id: 'closed', name: 'closed', parts: {} },
        { id: 'open', name: 'open', parts: { door: { rotation: [0, 90, 0] }, 'door-handle': { rotation: [0, 90, 0] } } },
      ],
    }));
    expect(a.parts.map((p) => p.section)).toEqual(['body', 'door', 'door']);
  });

  it('lets each of several moving groups open on its own', () => {
    const a = withSections(FurnitureAssetSchema.parse({
      id: 'cab', name: 'cab', source: { kind: 'parts', license: 'self-made' },
      parts: [{ id: 'body' }, { id: 'door-l' }, { id: 'door-r' }],
      states: [
        { id: 'closed', name: 'closed', parts: {} },
        { id: 'open', name: 'open', parts: { 'door-l': { rotation: [0, -90, 0] }, 'door-r': { rotation: [0, 90, 0] } } },
      ],
    }));
    expect(a.parts.find((p) => p.id === 'door-l')?.open).toEqual({ rotation: [0, -90, 0] });
    expect(a.parts.find((p) => p.id === 'body')?.open).toBeUndefined();
  });

  it('keeps parts that slide together (different positions, same shift) in one section', () => {
    const a = withSections(FurnitureAssetSchema.parse({
      id: 'sl', name: 'sl', source: { kind: 'parts', license: 'self-made' },
      parts: [{ id: 'frame' }, { id: 'glass', position: [50, 100, 0] }, { id: 'handle', position: [10, 105, 3] }],
      states: [
        { id: 'closed', name: 'closed', parts: {} },
        { id: 'open', name: 'open', parts: { glass: { position: [-50, 100, 0] }, handle: { position: [-90, 105, 3] } } },
      ],
    }));
    expect(a.parts.map((p) => p.section)).toEqual(['body', 'glass', 'glass']);
    expect(a.parts.find((p) => p.id === 'glass')?.open).toBeUndefined(); // one moving group: the whole item's state
  });

  it('keeps a door leaf and its tilted handle parts (same hinge) in one section', () => {
    const parts = (generators.door({ width: 80, height: 211, wallThickness: 10, hinge: 'right' }) as { parts: Part[] }).parts;
    const a = withSections(resolveAsset(FurnitureAssetSchema.parse({ id: 'door-basic', name: 'd', source: { kind: 'procedural', generator: 'door', license: 'self-made' } }), { width: 80, height: 211, wallThickness: 10, hinge: 'right' }));
    const moving = a.parts.filter((p) => p.pivot);
    expect(moving.length).toBe(parts.filter((p) => p.pivot).length);
    expect(new Set(moving.map((p) => p.section)).size).toBe(1);
    expect(moving.every((p) => !p.open)).toBe(true); // one moving group: the door's own state opens it
  });

  it('leaves pieces alone that name their own sections or never move', () => {
    const still = FurnitureAssetSchema.parse({ id: 's', name: 's', source: { kind: 'parts', license: 'self-made' }, parts: [{ id: 'a' }] });
    expect(withSections(still).parts[0].section).toBeUndefined();
  });
});
