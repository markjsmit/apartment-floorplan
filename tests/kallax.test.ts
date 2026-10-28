import { describe, expect, it } from 'vitest';
import { FurnitureAssetSchema, ItemSchema, type AssetState, type FurnitureAsset } from '../src/model/schema';
import {
  assetSize, findState, generatorError, initialState, interactivePart, nextState, resolveAsset, resolveParams,
} from '../src/model/assets';
import { insertGrid, kallax } from '../src/model/generators/kallax';
import { placeItem } from '../src/model/placement';
import { resolveWalls } from '../src/model/geometry';
import { sanityCheck } from '../src/model/sanity';
import { buildBundle } from '../src/model/bundle';
import { loadBundleFromDisk } from '../tools/load-files';

const asset = (generator: string, params: Record<string, unknown> = {}) =>
  FurnitureAssetSchema.parse({
    id: `t-${generator}`, name: generator, source: { kind: 'procedural', generator },
    params: Object.fromEntries(Object.entries(params).map(([k, v]) => [k, { default: v }])),
  });
const resolved = (a: FurnitureAsset, params: Record<string, unknown> = {}) => resolveAsset(a, resolveParams(a, { params }));
const size = (a: FurnitureAsset, stateId?: string) => assetSize(a.parts, stateId ? findState(a, stateId) : undefined);

describe('kallax inserts', () => {
  const k = asset('kallax', { cols: 2, rows: 2 });

  it('a plain kallax has no generated states (falls back to the single default state)', () => {
    const a = resolved(k);
    expect(a.states.map((s) => s.id)).toEqual(['default']);
    expect(a.interactions).toEqual([]);
  });

  it('doors and drawers give closed/open states and are double-clickable', () => {
    const a = resolved(k, { inserts: [['door-left', 'door-right'], ['drawers', '']] });
    expect(a.states.map((s) => s.id)).toEqual(['closed', 'open']);
    expect(initialState(a, { state: undefined })).toBe('closed');
    expect(nextState(a, 'closed')).toBe('open');
    for (const id of ['cell-1-1-door', 'cell-1-2-door', 'cell-2-1-drawer-1-front', 'cell-2-1-drawer-2-front']) {
      expect(a.parts.some((p) => p.id === id)).toBe(true);
      expect(interactivePart(a, id)).toBe(true);
    }
    expect(interactivePart(a, 'side-left')).toBe(false);
    // every state override and interaction points at a real part
    const ids = new Set(a.parts.map((p) => p.id));
    for (const s of a.states) for (const pid of Object.keys(s.parts)) expect(ids.has(pid)).toBe(true);
    for (const x of a.interactions) expect(ids.has(x.part)).toBe(true);
  });

  it('closed fronts are flush with the frame; open doors swing out and drawers slide out', () => {
    const doors = resolved(k, { inserts: 'door-left' });
    const closed = size(doors, 'closed');
    expect(closed.w).toBeCloseTo(77, 0);
    expect(closed.max[2]).toBeLessThanOrEqual(39 + 2); // knob sticks out a little
    expect(size(doors, 'open').max[2]).toBeGreaterThan(39 + 25);

    const drawers = resolved(k, { inserts: [['drawers', ''], ['', '']] });
    const open = findState(drawers, 'open') as AssetState;
    const front = drawers.parts.find((p) => p.id === 'cell-1-1-drawer-1-front')!;
    expect(open.parts[front.id].position![2] - front.position[2]).toBeCloseTo(26);
    // top row, left column: drawer sits in the upper-left cell
    expect(front.position[0]).toBeLessThan(0);
    expect(front.position[1]).toBeGreaterThan(77 / 2);
  });

  it('door hinge side decides where the door swings', () => {
    const left = resolved(k, { inserts: [['door-left', ''], ['', '']] });
    const right = resolved(k, { inserts: [['', 'door-right'], ['', '']] });
    const l = assetSize(left.parts.filter((p) => p.id === 'cell-1-1-door'), findState(left, 'open'));
    const r = assetSize(right.parts.filter((p) => p.id === 'cell-1-2-door'), findState(right, 'open'));
    expect(l.max[0]).toBeLessThan(-30); // hangs off the left side wall
    expect(r.min[0]).toBeGreaterThan(30);
  });

  it('parses the inserts param in all its forms', () => {
    expect(insertGrid('drawers', 2, 1)).toEqual([['drawers', 'drawers']]);
    expect(insertGrid(['door-l door-r', 'box -'], 2, 2)).toEqual([['door-left', 'door-right'], ['box', null]]);
    expect(insertGrid([['shelf']], 2, 2)).toEqual([['shelf', null], [null, null]]);
    expect(() => insertGrid([['drawer']], 1, 1)).toThrow(/unknown insert/);
  });

  it('a typo in inserts does not crash rendering, and check reports it', () => {
    const a = resolved(k, { inserts: [['doors']] });
    expect(a.parts).toEqual([]);
    expect(generatorError(k, { cols: 2, rows: 2, inserts: [['doors']] })).toMatch(/unknown insert "doors"/);
    const bundle = buildBundle([
      { path: 'assets/furniture/ikea-kallax/asset.json', json: { id: 'ikea-kallax', name: 'K', source: { kind: 'procedural', generator: 'kallax' } } },
      { path: 'house/current.json', json: { meta: { name: 'C', kind: 'current' }, rooms: [{
        id: 'r', name: 'r', footprint: [[0, 0], [300, 0], [300, 300], [0, 300]], ceilingHeight: 260,
        floor: { material: 'white-paint' }, ceiling: { material: 'white-paint' }, wallMaterial: 'white-paint',
        items: [{ id: 'r.k', asset: 'ikea-kallax', params: { inserts: [['doors']] }, position: [100, 0, 100] }],
      }] } },
    ], { publicUrl: '' });
    expect(sanityCheck(bundle).some((i) => i.level === 'error' && i.message.includes('unknown insert'))).toBe(true);
  });

  it('underframe adds 17.5 cm and the TV bench top row makes it 59.6 high', () => {
    expect(size(resolved(k, { underframe: true })).h).toBeCloseTo(94.5, 1);
    expect(size(resolved(k, { cols: 4, rows: 2, topRow: 16.1 })).h).toBeCloseTo(59.6, 1);
    // TV bench: inserts only go in the full-height bottom row
    const tv = resolved(k, { cols: 4, rows: 2, topRow: 16.1, inserts: 'drawers' });
    expect(tv.parts.some((p) => p.id.startsWith('cell-1-'))).toBe(false);
    expect(tv.parts.some((p) => p.id.startsWith('cell-2-4-'))).toBe(true);
  });

  it('desk combos: tabletop sticks out of the front at desk height', () => {
    const s = size(resolved(k, { cols: 2, rows: 4, table: { length: 140, width: 60, thickness: 4, height: 75 } }));
    expect(s.d).toBeCloseTo(179, 0);
    expect(s.h).toBeCloseTo(147, 0);
  });

  it('resolving twice is a no-op', () => {
    const a = resolved(k, { inserts: 'door-right' });
    expect(resolveAsset(a, {}).parts.length).toBe(a.parts.length);
  });

  it('placement: open state is the ui override, against-the-wall position uses the closed size', () => {
    const a = asset('kallax', { cols: 2, rows: 2, inserts: 'door-left' });
    const room = {
      id: 'r', name: 'r', tags: [], footprint: [[0, 0], [300, 0], [300, 300], [0, 300]] as [number, number][], ceilingHeight: 260,
      northAngle: 0, floor: { material: 'x' }, ceiling: { material: 'x', lowered: [] }, wallMaterial: 'x', walls: [], openings: [], items: [], assumptions: [],
    };
    const item = ItemSchema.parse({ id: 'r.k', asset: a.id, against: { wall: 'r.wall-0', offset: 10 } });
    const walls = resolveWalls(room);
    const closed = placeItem(item, a, walls);
    const open = placeItem(item, a, walls, 'open');
    expect(closed.stateId).toBe('closed');
    expect(open.stateId).toBe('open');
    expect(open.position).toEqual(closed.position);
    expect(open.size.d).toBeGreaterThan(closed.size.d + 20);
  });
});

describe('other kallax generators', () => {
  it('KALLAX desk is 111 x 39 x 77 with the shelf column on the chosen side', () => {
    const right = resolved(asset('kallax-desk', { side: 'right' }));
    const s = size(right);
    expect([s.w, s.d, s.h].map((n) => Math.round(n))).toEqual([111, 39, 77]);
    const shelf = (a: FurnitureAsset) => a.parts.find((p) => p.id === 'shelf')!.position[0];
    expect(shelf(right)).toBeGreaterThan(0);
    expect(shelf(resolved(asset('kallax-desk', { side: 'left' })))).toBeLessThan(0);
  });

  it('underframes are 76 / 146 wide, 17.5 high', () => {
    for (const w of [76, 146]) {
      const s = size(resolved(asset('kallax-underframe', { width: w })));
      expect(s.w).toBeCloseTo(w);
      expect(s.h).toBeCloseTo(17.5);
    }
  });

  it('a loose insert with door opens on its own', () => {
    const a = resolved(asset('kallax-insert', { insert: 'door-right' }));
    expect(size(a, 'closed').w).toBeCloseTo(33.5, 0);
    expect(a.states.map((s) => s.id)).toEqual(['closed', 'open']);
  });

  it('group: prefixes ids, offsets members and merges their states', () => {
    const a = resolved(asset('group', {
      members: [
        { prefix: 'a', generator: 'kallax', offset: [-50, 0, 0], params: { cols: 2, rows: 1, inserts: 'door-left' } },
        { prefix: 'b', generator: 'kallax', offset: [50, 0, 0], params: { cols: 2, rows: 1, inserts: 'drawers' } },
      ],
    }));
    expect(a.parts.some((p) => p.id === 'a.cell-1-1-door')).toBe(true);
    expect(a.states.map((s) => s.id)).toEqual(['closed', 'open']);
    const open = findState(a, 'open')!;
    expect(open.parts['a.cell-1-1-door']).toBeDefined();
    const front = a.parts.find((p) => p.id === 'b.cell-1-1-drawer-1-front')!;
    expect(open.parts[front.id].position![0]).toBeCloseTo(front.position[0]); // offset applied to the override too
    expect(open.parts[front.id].position![2]).toBeCloseTo(front.position[2] + 26);
    expect(interactivePart(a, 'b.cell-1-1-drawer-1-front')).toBe(true);
    expect(size(a).w).toBeCloseTo(177, 0);
  });
});

describe('IKEA Israel KALLAX presets on disk', () => {
  const bundle = loadBundleFromDisk();
  const presets = Object.values(bundle.furniture).filter((a) => a.id.startsWith('ikea-kallax-'));

  it('has all 52 white KALLAX products with item no, price and url', () => {
    expect(presets.length).toBe(52);
    for (const a of presets) {
      expect(a.product?.itemNo, a.id).toMatch(/^s?\d{3}\.\d{3}\.\d{2}$/);
      expect(a.product?.price, a.id).toBeGreaterThan(0);
      expect(a.product?.url, a.id).toMatch(/^https:\/\/www\.ikea\.com\/il\/he\/p\//);
      expect(generatorError(a, resolveParams(a, { params: {} })), a.id).toBeUndefined();
    }
  });

  it('every preset is the size in its description (W x D x H)', () => {
    for (const a of presets) {
      const m = a.description?.match(/^([\d.]+) x ([\d.]+) x ([\d.]+) cm/);
      if (!m) continue;
      const r = resolved(a);
      const s = size(r, findState(r, 'closed') ? 'closed' : undefined);
      // within 1 cm (loose inserts are modelled at the 33.5 cell size, IKEA says 33)
      expect(Math.abs(s.w - +m[1]), `${a.id} width`).toBeLessThanOrEqual(1);
      expect(Math.abs(s.h - +m[3]), `${a.id} height`).toBeLessThanOrEqual(1);
      expect(s.d - +m[2], `${a.id} depth (knobs may stick out 2 cm)`).toBeGreaterThanOrEqual(-0.5);
      expect(s.d - +m[2], `${a.id} depth (knobs may stick out 2 cm)`).toBeLessThanOrEqual(2);
    }
  });

  it('matches the sizes IKEA lists', () => {
    const wh = (id: string) => {
      const s = size(resolved(bundle.furniture[id]));
      return [Math.round(s.w), Math.round(s.h)];
    };
    expect(wh('ikea-kallax-42x147')).toEqual([42, 147]);
    expect(wh('ikea-kallax-77x77')).toEqual([77, 77]);
    expect(wh('ikea-kallax-112x147')).toEqual([112, 147]);
    expect(wh('ikea-kallax-147x147')).toEqual([147, 147]);
    expect(wh('ikea-kallax-147x94-underframe')[1]).toBeGreaterThanOrEqual(94);
    expect(wh('ikea-kallax-147x94-underframe')[1]).toBeLessThanOrEqual(95);
    expect(wh('ikea-kallax-tv-bench-147x60')).toEqual([147, 60]);
    expect(wh('ikea-kallax-desk-111x39')).toEqual([111, 77]);
    expect(wh('ikea-kallax-lack-tv-storage-224x147')).toEqual([224, 147]);
  });

  it('the old generic asset still works with just cols/rows', () => {
    const a = bundle.furniture['ikea-kallax'];
    const s = size(resolveAsset(a, resolveParams(a, { params: { cols: 2, rows: 4 } })));
    expect([Math.round(s.w), Math.round(s.h), Math.round(s.d)]).toEqual([77, 147, 39]);
  });
});

describe('kallax labels and contents', () => {
  const g = (p: Record<string, unknown>) => {
    const out = kallax({ cols: 2, rows: 2, ...p });
    return Array.isArray(out) ? out : out.parts;
  };
  it('puts labels on box fronts and on each drawer', () => {
    const parts = g({ inserts: [['drawers', 'box'], ['', '']], labels: [['Screws / Bits', 'Camping']] });
    expect(parts.find((p) => p.id === 'cell-1-1-drawer-1-front')?.label?.text).toBe('Screws');
    expect(parts.find((p) => p.id === 'cell-1-1-drawer-2-front')?.label?.text).toBe('Bits');
    expect(parts.find((p) => p.id === 'cell-1-2-box')?.label?.text).toBe('Camping');
  });
  it('fills only open cells with contents, the same way every time', () => {
    const parts = g({ inserts: [['drawers', ''], ['', '']], contents: 'books' });
    expect(parts.some((p) => p.id.startsWith('cell-1-1-') && p.tags.includes('contents'))).toBe(false);
    expect(parts.filter((p) => p.id.startsWith('cell-1-2-') && p.tags.includes('books')).length).toBeGreaterThan(5);
    expect(g({ contents: 'random' }).map((p) => p.id)).toEqual(g({ contents: 'random' }).map((p) => p.id));
  });
  it('rejects unknown contents', () => {
    expect(() => g({ contents: 'cats' })).toThrow(/unknown contents/);
  });
});
