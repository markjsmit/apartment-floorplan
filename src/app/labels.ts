import { findById, type Selection } from '../model/lookup';
import { currentHouse, type useStore } from './store';

type StoreState = ReturnType<typeof useStore.getState>;

/** Name + tags for a selectable id, as Mark would call it. */
export function labelOf(s: StoreState, sel: Selection) {
  const house = currentHouse(s);
  const f = house ? findById(house, sel.id) : null;
  const tags = f?.kind === 'item' ? f.item.tags : f?.kind === 'opening' ? f.opening.tags : f?.kind === 'wall' ? f.wall.tags : [];
  const name = f?.kind === 'item' ? (f.item.name ?? f.item.asset)
    : f?.kind === 'opening' ? (f.opening.name ?? f.opening.type)
    : f?.kind === 'wall' ? (f.wall.tags[0] || 'wall')
    : sel.kind;
  return { name, tags, ...(f?.kind === 'item' ? { asset: f.item.asset } : {}) };
}
