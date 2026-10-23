import type { Object3D } from 'three';

// Selectable id -> scene object, so the outline effect can find what's selected.
// Items register their whole group; parts register as `<id>#<part>` for selectWhole: false items.
export const sceneObjects = new Map<string, Object3D>();

export function registerObject(id: string) {
  return (obj: Object3D | null) => {
    if (obj) sceneObjects.set(id, obj);
    else sceneObjects.delete(id);
  };
}
