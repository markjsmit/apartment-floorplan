import { describe, expect, it } from 'vitest';
import { buildBundle } from '../src/model/bundle';
import { describeSelection, findById } from '../src/model/lookup';

const bundle = buildBundle([
  { path: 'assets/textures/paint/texture.json', json: { id: 'paint', name: 'Paint', fallbackColor: '#fff' } },
  {
    path: 'assets/furniture/bed/asset.json',
    json: {
      id: 'bed', name: 'Wall bed', tags: ['bed'], source: { kind: 'parts' },
      parts: [{ id: 'platform', geometry: { type: 'box', size: [160, 20, 200] }, position: [0, 30, 100] }],
      states: [{ id: 'up', name: 'Folded up' }, { id: 'down', name: 'Down' }],
      interactions: [{ part: 'platform', action: 'cycleStates' }],
    },
  },
  {
    path: 'house/current.json',
    json: {
      meta: { name: 'Current', kind: 'current' },
      rooms: [{
        id: 'r', name: 'Room', footprint: [[0, 0], [300, 0], [300, 300], [0, 300]], ceilingHeight: 260,
        floor: { material: 'paint' }, ceiling: { material: 'paint' }, wallMaterial: 'paint',
        walls: [{ id: 'r.back', edge: 0, tags: ['back wall'] }],
        openings: [{ id: 'r.door', type: 'door', wall: 'r.back', offset: 10, width: 80, height: 210, tags: ['the door'] }],
        items: [{ id: 'r.bed', asset: 'bed', name: 'The bed', tags: ['my bed'], position: [150, 0, 0],
          assumptions: [{ path: 'position', note: 'guessed' }] }],
      }],
    },
  },
], { publicUrl: '' });
const house = bundle.versions.current;

describe('findById', () => {
  it('finds items, openings, walls, floor and ceiling', () => {
    expect(findById(house, 'r.bed')).toMatchObject({ kind: 'item', roomId: 'r' });
    expect(findById(house, 'r.door')).toMatchObject({ kind: 'opening', roomId: 'r' });
    expect(findById(house, 'r.back')).toMatchObject({ kind: 'wall', roomId: 'r' });
    expect(findById(house, 'r.wall-1')).toMatchObject({ kind: 'wall', roomId: 'r' });
    expect(findById(house, 'r.floor')).toMatchObject({ kind: 'floor', roomId: 'r' });
    expect(findById(house, 'r.ceiling')).toMatchObject({ kind: 'ceiling', roomId: 'r' });
    expect(findById(house, 'nope')).toBeNull();
  });
});

describe('describeSelection', () => {
  it('describes an item with size, state, tags and assumptions', () => {
    const d = describeSelection(bundle, house, { kind: 'item', id: 'r.bed', part: 'platform' }, { 'r.bed': 'down' })!;
    expect(d.title).toBe('The bed');
    expect(d.tags).toEqual(expect.arrayContaining(['my bed']));
    expect(d.rows).toEqual(expect.arrayContaining([
      ['Asset', 'Wall bed'],
      ['Size (W×D×H)', '160 × 200 × 20 cm'],
      ['State', 'Down'],
      ['Part', 'platform (double-click to change state)'],
    ]));
    expect(d.assumptions).toEqual(['position: guessed']);
  });

  it('describes a wall with its compass and length', () => {
    const d = describeSelection(bundle, house, { kind: 'wall', id: 'r.back', part: null }, {})!;
    expect(d.tags).toEqual(expect.arrayContaining(['back wall', 'north wall']));
    expect(d.rows).toEqual(expect.arrayContaining([['Length', '300 cm']]));
  });

  it('describes an opening', () => {
    const d = describeSelection(bundle, house, { kind: 'opening', id: 'r.door', part: null }, {})!;
    expect(d.rows).toEqual(expect.arrayContaining([['Size (W×H)', '80 × 210 cm']]));
  });
});
