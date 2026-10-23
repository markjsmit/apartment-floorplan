import { describe, expect, it } from 'vitest';
import { makeSuggestion, promote, roomHash, savedId, slugify, versionIdFromPath, versionPath, type RawHouse } from '../src/model/versions';

const room = (id: string, ceilingHeight = 260) => ({
  id, name: id, footprint: [[0, 0], [300, 0], [300, 300], [0, 300]], ceilingHeight,
  floor: { material: 'f' }, ceiling: { material: 'c' },
});
const current = (): RawHouse => ({ meta: { name: 'Current', kind: 'current' }, rooms: [room('a'), room('b')] });

describe('version ids', () => {
  it('maps file paths to ids and back', () => {
    expect(versionIdFromPath('house/current.json')).toBe('current');
    expect(versionIdFromPath('house/suggestion.json')).toBe('suggestion');
    expect(versionIdFromPath('house/saved/bed-left.json')).toBe('saved/bed-left');
    expect(versionPath('saved/bed-left')).toBe('house/saved/bed-left.json');
    expect(slugify('Bed on the LEFT wall!')).toBe('bed-on-the-left-wall');
  });
});

describe('roomHash', () => {
  it('ignores key order and explicit defaults', () => {
    const r = room('a');
    const { ceilingHeight, ...rest } = r;
    const reordered = { walls: [], ...rest, ceilingHeight };
    expect(roomHash(reordered)).toBe(roomHash(r));
    expect(roomHash(room('a', 250))).not.toBe(roomHash(r));
  });
});

describe('promote', () => {
  it('applies all changed rooms when Current is untouched', () => {
    const s = makeSuggestion(current());
    s.rooms[0] = room('a', 240);
    const res = promote(current(), s);
    expect(res.changed).toEqual(['a']);
    expect(res.conflicts).toEqual([]);
    expect(res.house.rooms[0].ceilingHeight).toBe(240);
    expect(res.house.meta.kind).toBe('current');
  });

  it('merges when Current changed a different room', () => {
    const base = current();
    const s = makeSuggestion(base);
    s.rooms[0] = room('a', 240);
    const cur = current();
    cur.rooms[1] = room('b', 230);
    const res = promote(cur, s);
    expect(res.conflicts).toEqual([]);
    expect(res.house.rooms[0].ceilingHeight).toBe(240);
    expect(res.house.rooms[1].ceilingHeight).toBe(230);
  });

  it('reports a conflict and keeps Current when both changed the same room', () => {
    const s = makeSuggestion(current());
    s.rooms[0] = room('a', 240);
    const cur = current();
    cur.rooms[0] = room('a', 220);
    const res = promote(cur, s);
    expect(res.conflicts).toEqual(['a']);
    expect(res.house.rooms[0].ceilingHeight).toBe(220);
    const forced = promote(cur, s, { force: true });
    expect(forced.house.rooms[0].ceilingHeight).toBe(240);
  });

  it('adds new rooms and removes deleted ones', () => {
    const s = makeSuggestion(current());
    s.rooms = [s.rooms[0], room('c')];
    const res = promote(current(), s);
    expect(res.changed.sort()).toEqual(['b', 'c']);
    expect(res.house.rooms.map((r) => r.id)).toEqual(['a', 'c']);
  });
});

describe('savedId', () => {
  it('slugifies and refuses to overwrite', () => {
    expect(savedId('Bed left', () => false)).toBe('saved/bed-left');
    expect(savedId('bed-left', (id) => id === 'saved/bed-left')).toBe('saved/bed-left-2');
  });
  it('falls back to a dated slug for names without latin letters', () => {
    expect(savedId('מיטה שמאל', () => false, new Date('2026-10-23T09:05:00Z'))).toMatch(/^saved\/v-20261023-\d{4}$/);
  });
});

describe('promote validation', () => {
  it('refuses a suggestion whose changed room is invalid', () => {
    const s = makeSuggestion(current());
    s.rooms[0] = { id: 'a', name: 'half edited' };
    expect(() => promote(current(), s)).toThrow(/a/);
  });
});
