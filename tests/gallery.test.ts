import { describe, expect, it } from 'vitest';
import { buildBundle, mergeBundle, type RawFile } from '../src/model/bundle';
import { galleryKeys, galleryLink, groupPictures, parentKey, parseGalleryParam, thumbFile } from '../src/model/gallery';
import { sanityCheck } from '../src/model/sanity';

const room = (id: string) => ({
  id, name: id.toUpperCase(), footprint: [[0, 0], [300, 0], [300, 300], [0, 300]], ceilingHeight: 260,
  floor: { material: 'wood' }, ceiling: { material: 'wood' }, wallMaterial: 'wood',
});
const files = (gallery: unknown): RawFile[] => [
  { path: 'assets/textures/wood/texture.json', json: { id: 'wood', name: 'wood', fallbackColor: '#fff' } },
  { path: 'house/current.json', json: { meta: { name: 'Current', kind: 'current' }, rooms: [room('living')] } },
  { path: 'assets/renders/gallery.json', json: gallery },
];

describe('gallery', () => {
  it('puts thumbs next to the picture', () => {
    expect(thumbFile('living/entrance.jpg')).toBe('living/thumbs/entrance.jpg');
  });

  it('reads gallery=1 as the overview and gallery=<room> as that room', () => {
    expect(parseGalleryParam('?room=x', ['living'])).toBeNull();
    expect(parseGalleryParam('?gallery=1', ['living'])).toEqual({ room: null });
    expect(parseGalleryParam('?gallery=living', ['living'])).toEqual({ room: 'living' });
    expect(parseGalleryParam('?gallery=nope', ['living'])).toEqual({ room: null });
    expect(galleryLink('https://x.io/a/', null)).toBe('https://x.io/a/?gallery=1');
    expect(galleryLink('https://x.io/a/', 'living')).toBe('https://x.io/a/?gallery=living');
  });

  it('loads into the bundle', () => {
    const b = buildBundle(files({ rooms: [{ room: 'living', pictures: [{ file: 'living/entrance.jpg', caption: 'From the door' }] }] }), { publicUrl: '' });
    expect(b.errors).toEqual([]);
    expect(b.gallery?.rooms[0].pictures[0].caption).toBe('From the door');
    expect(sanityCheck(b).filter((i) => i.message.startsWith('gallery'))).toEqual([]);
  });

  it('reports bad file names and unknown rooms', () => {
    const bad = buildBundle(files({ rooms: [{ room: 'living', pictures: [{ file: 'Living/A B.png', caption: '' }] }] }), { publicUrl: '' });
    expect(bad.errors[0].kind).toBe('gallery');
    const unknown = buildBundle(files({ rooms: [{ room: 'attic', pictures: [{ file: 'attic/a.jpg', caption: '' }] }] }), { publicUrl: '' });
    expect(sanityCheck(unknown).some((i) => i.level === 'error' && /unknown room "attic"/.test(i.message))).toBe(true);
  });

  it('keeps the last good gallery while the file is broken', () => {
    const good = buildBundle(files({ rooms: [{ room: 'living', pictures: [{ file: 'living/a.jpg', caption: 'A' }] }] }), { publicUrl: '' });
    const broken = buildBundle(files({ rooms: 'oops' }), { publicUrl: '' });
    expect(mergeBundle(good, broken).gallery?.rooms).toHaveLength(1);
  });

  it('has experiments above the rooms: links, back steps, groups', () => {
    const exp = { id: 'dining-tables', title: 'Tables', pictures: [
      { file: 'experiments/dining-tables/a-1.jpg', caption: '1', group: 'A' },
      { file: 'experiments/dining-tables/a-2.jpg', caption: '2', group: 'A' },
      { file: 'experiments/dining-tables/b-1.jpg', caption: '3', group: 'B' },
    ] };
    const b = buildBundle(files({ experiments: [exp], rooms: [{ room: 'living', pictures: [{ file: 'living/a.jpg', caption: 'A' }] }] }), { publicUrl: '' });
    expect(b.errors).toEqual([]);
    expect(sanityCheck(b).filter((i) => i.message.startsWith('gallery'))).toEqual([]);
    expect(thumbFile(exp.pictures[0].file)).toBe('experiments/dining-tables/thumbs/a-1.jpg');
    const keys = galleryKeys(b.gallery);
    expect(keys).toEqual(['living', 'experiments', 'experiments/dining-tables']);
    expect(parseGalleryParam('?gallery=experiments%2Fdining-tables', keys)).toEqual({ room: 'experiments/dining-tables' });
    expect(parentKey('experiments/dining-tables')).toBe('experiments');
    expect(parentKey('experiments')).toBeNull();
    expect(parentKey('living')).toBeNull();
    expect(groupPictures(b.gallery!.experiments![0].pictures).map((g) => [g.group, g.pictures.map((p) => p.i)])).toEqual([['A', [0, 1]], ['B', [2]]]);
    const wrong = buildBundle(files({ experiments: [{ ...exp, id: 'other' }], rooms: [] }), { publicUrl: '' });
    expect(sanityCheck(wrong).some((i) => /listed under experiment "other"/.test(i.message))).toBe(true);
  });
});
