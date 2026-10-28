import { describe, expect, it } from 'vitest';
import { generators } from '../src/model/generators';
import { assetSize, openingParams, partTransform } from '../src/model/assets';
import { FurnitureAssetSchema, type Part } from '../src/model/schema';
import { door, doorOpenAngle, doorStates, windowParts } from '../src/model/generators/openings';

describe('door generator', () => {
  const parts = door({ width: 83, height: 211, wallThickness: 10 });
  it('fills the opening exactly and sits inside the wall', () => {
    const s = assetSize(parts.filter((p) => !p.tags.includes('casing')), undefined);
    expect(s.w).toBeCloseTo(83);
    expect(s.h).toBeCloseTo(211);
    expect(s.min[2]).toBeCloseTo(-10);
    // only the lever handle sticks out into the room (~6 cm)
    expect(s.max[2]).toBeLessThanOrEqual(8);
  });
  it('has casings that overlap the wall by a few cm on both faces', () => {
    const s = assetSize(parts, undefined);
    expect(s.w).toBeGreaterThan(83);
    expect(s.w).toBeLessThanOrEqual(83 + 8);
    expect(s.min[2]).toBeLessThan(-10);
    expect(s.max[2]).toBeLessThanOrEqual(8);
  });
  it('has a hinged leaf that swings into the room', () => {
    const leaf = parts.find((p) => p.id === 'leaf')!;
    expect(leaf.pivot).toBeDefined();
    const open = assetSize(parts, doorStates(parts)[1]);
    expect(open.max[2]).toBeGreaterThan(70);
  });
  it('swings the handles and roses with the leaf', () => {
    const open = doorStates(parts)[1];
    for (const id of ['leaf', 'handle-in']) expect(open.parts[id]?.rotation?.map((v) => Math.round(v))).toEqual([0, -90, 0]);
    // the roses (cylinders tilted 90° about x) keep their tilt and stay on the leaf: none of them drops to the floor
    const leaf = partTransform(parts.find((p) => p.id === 'leaf')!, open.parts.leaf);
    for (const id of ['handle-in-rose', 'handle-out-key-rose', 'handle-in-neck']) {
      const p = parts.find((x) => x.id === id)!;
      const pose = partTransform(p, open.parts[id]);
      expect(Math.abs(pose.position[1] - p.position[1])).toBeLessThan(0.01);
      expect(Math.hypot(pose.position[0] - leaf.position[0], pose.position[2] - leaf.position[2])).toBeLessThan(45);
    }
    expect(open.parts['jamb-left']).toBeUndefined();
  });

  it('can hinge on the right and/or swing out of the room', () => {
    const leaf = (params: Record<string, unknown>) => door({ width: 83, height: 211, wallThickness: 10, ...params }).find((p) => p.id === 'leaf')!;
    expect(leaf({}).pivot![0]).toBeLessThan(0);
    expect(leaf({ hinge: 'right' }).pivot![0]).toBeGreaterThan(0);
    expect(leaf({ swing: 'out' }).pivot![2]).toBeCloseTo(-10);
    const opened = (params: Record<string, unknown>) => {
      const ps = door({ width: 83, height: 211, wallThickness: 10, ...params });
      return assetSize(ps, doorStates(ps, doorOpenAngle(params))[1]);
    };
    expect(opened({ hinge: 'right' }).max[2]).toBeGreaterThan(70); // still into the room
    expect(opened({ swing: 'out' }).min[2]).toBeLessThan(-70); // out into the room next door
    expect(opened({ hinge: 'right', swing: 'out' }).min[2]).toBeLessThan(-70);
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

describe('wall bed + desk, Kallax-deep', () => {
  const out = generators['wall-bed-desk']({ baseDepth: 39, hinge: 30, deskWidth: 90, deskOffset: -20 }) as {
    parts: Part[]; states: { id: string; name: string; parts: Record<string, unknown> }[];
  };
  const size = (state: string) => assetSize(out.parts, out.states.find((s) => s.id === state) as never);
  it('folds up within the 39 cm KALLAX depth', () => {
    expect(size('folded').max[2]).toBeLessThanOrEqual(39);
  });
  it('lies down from the hinge at 30 cm', () => {
    expect(size('bed').max[2]).toBeCloseTo(30 + 190, 0);
  });
});

describe('wall bed in its closet', () => {
  const p = { baseDepth: 39, baseHeight: 30, hinge: 31.8, housing: true, housingHeight: 224, topDepth: 60, deskWidth: 90, deskOffset: -20 };
  const out = generators['wall-bed-desk'](p) as { parts: Part[]; states: { id: string; name: string; parts: Record<string, unknown> }[] };
  const size = (state: string) => assetSize(out.parts, out.states.find((s) => s.id === state) as never);
  it('swings under the top board (farthest mattress corner stays below 224)', () => {
    const back = 1.8; // mattress back face sits on the back panel
    const radius = Math.hypot(p.hinge - back, 190);
    expect(p.baseHeight + radius).toBeLessThan(p.housingHeight);
  });
  it('keeps everything folded within the 39 cm sides, except the top shelf', () => {
    const folded = assetSize(out.parts.filter((x) => x.id !== 'top'), out.states.find((s) => s.id === 'folded') as never);
    expect(folded.max[2]).toBeLessThanOrEqual(39);
    expect(size('folded').max[2]).toBeCloseTo(60, 0);
  });
});

describe('led strip', () => {
  it('has a glowing diffuser hanging under its origin, along the chosen axis', () => {
    const parts = generators['led-strip']({ length: 56, axis: 'z' }) as Part[];
    const diffuser = parts.find((p) => p.id === 'diffuser')!;
    expect(diffuser.emit).toBeDefined();
    const s = assetSize(parts, undefined);
    expect(s.d).toBeCloseTo(56, 0);
    expect(s.max[1]).toBeCloseTo(0, 5);
    expect(s.min[1]).toBeLessThan(0);
  });
});

describe('plywood shelving stiles', () => {
  it('puts a batten on both sides of each inner upright and inside each outer side', () => {
    const parts = generators['plywood-shelving']({ width: 130, height: 100, depth: 20, sections: 2, shelves: 1, back: false, stiles: true }) as Part[];
    expect(parts.filter((p) => p.tags.includes('stile'))).toHaveLength(4);
  });
  it('keeps every pegboard tool on a low strip of board', () => {
    const parts = generators.pegboard({ width: 120, height: 40, elevation: 125 }) as Part[];
    for (const p of parts.filter((q) => q.tags.includes('tools'))) {
      const g = p.geometry as { type: string; size?: number[]; height?: number };
      const half = g.type === 'box' ? g.size![1] / 2 : (g.height ?? 0) / 2;
      expect(p.position[1] - half).toBeGreaterThanOrEqual(125 - 3);
    }
  });
  it('hangs several pegboard sheets on the same posts', () => {
    const parts = generators.pegboard({ width: 120, boards: [{ elevation: 40, height: 50 }, { elevation: 95, height: 50 }, { elevation: 150, height: 50, tools: false }] }) as Part[];
    expect(parts.filter((p) => p.tags.includes('pegboard')).map((p) => p.id)).toEqual(['board-1', 'board-2', 'board-3']);
    expect(parts.filter((p) => p.id.startsWith('post-'))).toHaveLength(2);
    expect(parts.some((p) => p.id.startsWith('b3-'))).toBe(false);
    expect(new Set(parts.map((p) => p.id)).size).toBe(parts.length);
  });
  it('stands the pegboard on floor-to-ceiling posts and keeps its tools within the board and ~16 cm deep', () => {
    const parts = generators.pegboard({ width: 137, height: 140, elevation: 60, ceiling: 270 }) as Part[];
    const posts = parts.filter((p) => p.id.startsWith('post-'));
    expect(posts).toHaveLength(2);
    for (const p of posts) expect(p.position[1] + (p.geometry as { size: number[] }).size[1] / 2).toBeCloseTo(269);
    for (const p of parts.filter((q) => q.tags.includes('tools') && q.geometry?.type === 'box')) {
      const [sx, , sz] = (p.geometry as { size: number[] }).size;
      expect(Math.abs(p.position[0]) + sx / 2).toBeLessThanOrEqual(137 / 2);
      expect(p.position[2] + sz / 2).toBeLessThanOrEqual(16.5);
    }
  });
});
