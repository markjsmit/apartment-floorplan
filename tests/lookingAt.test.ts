import { describe, expect, it } from 'vitest';
import { Group, Mesh, Object3D } from 'three';
import { selectableFromHit } from '../src/scene/selectable';

describe('selectableFromHit', () => {
  it('finds the owning item and part from a part mesh', () => {
    const item = new Group();
    const part = new Mesh();
    part.userData = { selectable: { kind: 'item', id: 'r.bed', part: 'mattress' } };
    item.add(part);
    expect(selectableFromHit(part)).toEqual({ kind: 'item', id: 'r.bed', part: 'mattress' });
  });

  it('walks up to a selectable parent (wall group around its pieces)', () => {
    const wall = new Group();
    wall.userData = { selectable: { kind: 'wall', id: 'r.wall-0', part: null } };
    const piece = new Mesh();
    wall.add(piece);
    expect(selectableFromHit(piece)).toEqual({ kind: 'wall', id: 'r.wall-0', part: null });
  });

  it('returns null for things that are not part of the house (sky, ground)', () => {
    expect(selectableFromHit(new Object3D())).toBeNull();
  });
});
