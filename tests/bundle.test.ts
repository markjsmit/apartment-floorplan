import { describe, expect, it } from 'vitest';
import { buildBundle, mergeBundle, type RawFile } from '../src/model/bundle';
import { sanityCheck } from '../src/model/sanity';

const tex = (id: string): RawFile => ({ path: `assets/textures/${id}/texture.json`, json: { id, name: id, fallbackColor: '#fff' } });
const boxAsset: RawFile = {
  path: 'assets/furniture/box/asset.json',
  json: {
    id: 'box', name: 'Box', source: { kind: 'parts' },
    parts: [{ id: 'body', geometry: { type: 'box', size: [100, 80, 50] }, position: [0, 40, 25] }],
  },
};
const room = (extra: object = {}) => ({
  id: 'r', name: 'R', footprint: [[0, 0], [300, 0], [300, 300], [0, 300]], ceilingHeight: 260,
  floor: { material: 'wood' }, ceiling: { material: 'paint' }, wallMaterial: 'paint', ...extra,
});
const house = (rooms: object[]): RawFile => ({ path: 'house/current.json', json: { meta: { name: 'Current', kind: 'current' }, rooms } });
const files = (rooms: object[]) => [tex('wood'), tex('paint'), boxAsset, house(rooms)];

describe('buildBundle', () => {
  it('loads versions, furniture and textures', () => {
    const b = buildBundle(files([room()]), { publicUrl: '' });
    expect(b.errors).toEqual([]);
    expect(b.versionOrder).toEqual(['current']);
    expect(Object.keys(b.furniture)).toEqual(['box']);
    expect(b.textures.wood.baseUrl).toBe('lib/textures/wood/');
  });

  it('reports schema errors per file with the field path', () => {
    const b = buildBundle([house([{ id: 'r' }])], { publicUrl: '' });
    expect(b.errors).toHaveLength(1);
    expect(b.errors[0].file).toBe('house/current.json');
    expect(b.errors[0].message).toMatch(/rooms\.0\./);
  });

  it('reports invalid JSON text', () => {
    const b = buildBundle([{ path: 'house/current.json', parseError: 'Unexpected token' }], { publicUrl: '' });
    expect(b.errors[0].message).toMatch(/Unexpected token/);
  });
});

describe('mergeBundle', () => {
  it('keeps previous file on error', () => {
    const good = buildBundle(files([room()]), { publicUrl: '' });
    const broken = buildBundle([tex('wood'), tex('paint'), boxAsset, { path: 'house/current.json', parseError: 'oops' }], { publicUrl: '' });
    const merged = mergeBundle(good, broken);
    expect(merged.versions.current.rooms[0].id).toBe('r');
    expect(merged.versionOrder).toEqual(['current']);
    expect(merged.errors).toHaveLength(1);
  });
});

describe('sanityCheck', () => {
  const check = (rooms: object[]) => sanityCheck(buildBundle(files(rooms), { publicUrl: '' }));

  it('passes a clean room', () => {
    expect(check([room({ items: [{ id: 'r.box', asset: 'box', position: [150, 0, 150] }] })])).toEqual([]);
  });

  it('flags an opening outside its wall', () => {
    const issues = check([room({ openings: [{ id: 'r.door', type: 'door', wall: 'r.wall-0', offset: 250, width: 80, height: 210 }] })]);
    expect(issues.join('\n')).toMatch(/r\.door.*wider than|r\.door.*outside/);
  });

  it('flags duplicate ids', () => {
    const issues = check([room({ items: [
      { id: 'r.box', asset: 'box', position: [80, 0, 80] },
      { id: 'r.box', asset: 'box', position: [220, 0, 220] },
    ] })]);
    expect(issues.join('\n')).toMatch(/duplicate id "r\.box"/);
  });

  it('flags unknown assets and materials', () => {
    const issues = check([room({ floor: { material: 'marble' }, items: [{ id: 'r.x', asset: 'sofa', position: [150, 0, 150] }] })]);
    expect(issues.join('\n')).toMatch(/marble/);
    expect(issues.join('\n')).toMatch(/sofa/);
  });

  it('flags an item sticking out of the room', () => {
    const issues = check([room({ items: [{ id: 'r.box', asset: 'box', position: [10, 0, 150] }] })]);
    expect(issues.join('\n')).toMatch(/r\.box.*outside the room/);
  });

  it('flags overlapping items', () => {
    const issues = check([room({ items: [
      { id: 'r.a', asset: 'box', position: [150, 0, 100] },
      { id: 'r.b', asset: 'box', position: [170, 0, 110] },
    ] })]);
    expect(issues.join('\n')).toMatch(/r\.a.*overlaps.*r\.b/);
  });
});
