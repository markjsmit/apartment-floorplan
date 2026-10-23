import type { Object3D } from 'three';
import type { Selection } from '../model/lookup';

// Meshes (or their groups) carry `userData.selectable` so a ray hit can be traced back to an item/part,
// opening, wall, floor or ceiling. Used for "what am I looking at" (the crosshair).

export function selectableFromHit(obj: Object3D | null): Selection | null {
  for (let o = obj; o; o = o.parent) {
    const s = o.userData?.selectable as Selection | undefined;
    if (s && typeof s === 'object') return s;
  }
  return null;
}
