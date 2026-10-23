import type { Bundle } from './bundle';
import type { Assumption, House, Item, Opening, Room } from './schema';
import { findState } from './assets';
import { resolveWalls, type WallInfo } from './geometry';
import { placeItem } from './placement';

export type SelectionKind = 'item' | 'wall' | 'opening' | 'floor' | 'ceiling';
export type Selection = { kind: SelectionKind; id: string; part: string | null };

export type Found =
  | { kind: 'item'; roomId: string; room: Room; item: Item }
  | { kind: 'opening'; roomId: string; room: Room; opening: Opening }
  | { kind: 'wall'; roomId: string; room: Room; wall: WallInfo }
  | { kind: 'floor' | 'ceiling'; roomId: string; room: Room };

/** Resolve any selectable id (item, opening, wall, `<room>.floor`, `<room>.ceiling`) in a house version. */
export function findById(house: House, id: string): Found | null {
  for (const room of house.rooms) {
    const base = { roomId: room.id, room };
    if (id === `${room.id}.floor`) return { kind: 'floor', ...base };
    if (id === `${room.id}.ceiling`) return { kind: 'ceiling', ...base };
    const item = room.items.find((i) => i.id === id);
    if (item) return { kind: 'item', ...base, item };
    const opening = room.openings.find((o) => o.id === id);
    if (opening) return { kind: 'opening', ...base, opening };
    const wall = resolveWalls(room).find((w) => w.id === id);
    if (wall) return { kind: 'wall', ...base, wall };
  }
  return null;
}

export type Description = { title: string; kind: SelectionKind; tags: string[]; rows: [string, string][]; assumptions: string[] };

const cm = (n: number) => `${Math.round(n)}`;

function assumptionsFor(list: Assumption[], prefix?: string): string[] {
  return list
    .filter((a) => !prefix || a.path.includes(prefix))
    .map((a) => (a.note ? `${a.path}: ${a.note}` : a.path));
}

export function describeSelection(
  bundle: Bundle, house: House, sel: Selection, itemStates: Record<string, string>,
): Description | null {
  const found = findById(house, sel.id);
  if (!found) return null;
  const { room } = found;
  if (found.kind === 'item') {
    const { item } = found;
    const asset = bundle.furniture[item.asset];
    const rows: [string, string][] = [['Id', item.id], ['Room', room.name]];
    if (!asset) return { title: item.name ?? item.id, kind: 'item', tags: item.tags, rows: [...rows, ['Asset', `missing: ${item.asset}`]], assumptions: [] };
    const placed = placeItem(item, asset, resolveWalls(room), itemStates[item.id]);
    rows.push(['Asset', asset.name]);
    rows.push(['Size (W×D×H)', `${cm(placed.size.w)} × ${cm(placed.size.d)} × ${cm(placed.size.h)} cm`]);
    if (asset.states.length > 1) rows.push(['State', findState(asset, placed.stateId)?.name ?? placed.stateId]);
    if (sel.part) {
      const interactive = asset.interactions.some((x) => x.part === sel.part);
      rows.push(['Part', interactive ? `${sel.part} (double-click to change state)` : sel.part]);
    }
    const params = Object.entries(item.params);
    if (params.length) rows.push(['Options', params.map(([k, v]) => `${k}: ${String(v)}`).join(', ')]);
    return {
      title: item.name ?? asset.name, kind: 'item', tags: [...item.tags, ...asset.tags], rows,
      assumptions: [...assumptionsFor(item.assumptions), ...assumptionsFor(room.assumptions, item.id)],
    };
  }
  if (found.kind === 'opening') {
    const o = found.opening;
    const rows: [string, string][] = [
      ['Id', o.id], ['Room', room.name], ['Type', o.type],
      ['Size (W×H)', `${cm(o.width)} × ${cm(o.height)} cm`],
      ['Position', `${cm(o.offset)} cm from wall start${o.sill ? `, sill ${cm(o.sill)} cm` : ''}`],
      ['Wall', o.wall],
    ];
    return { title: o.name ?? `${o.type[0].toUpperCase()}${o.type.slice(1)}`, kind: 'opening', tags: o.tags, rows, assumptions: assumptionsFor(room.assumptions, o.id) };
  }
  if (found.kind === 'wall') {
    const w = found.wall;
    const material = w.material ? (bundle.textures[w.material]?.name ?? w.material) : '';
    const rows: [string, string][] = [
      ['Id', w.id], ['Room', room.name], ['Length', `${cm(w.length)} cm`], ['Height', `${cm(room.ceilingHeight)} cm`], ['Finish', material],
    ];
    const openings = room.openings.filter((o) => o.wall === w.id).map((o) => o.id);
    if (openings.length) rows.push(['Openings', openings.join(', ')]);
    return { title: w.tags[0] ? w.tags[0][0].toUpperCase() + w.tags[0].slice(1) : 'Wall', kind: 'wall', tags: w.tags, rows, assumptions: assumptionsFor(room.assumptions, w.id) };
  }
  const surface = found.kind === 'floor' ? room.floor : room.ceiling;
  const rows: [string, string][] = [
    ['Id', sel.id], ['Room', room.name], ['Finish', bundle.textures[surface.material]?.name ?? surface.material],
  ];
  if (found.kind === 'ceiling') rows.push(['Height', `${cm(room.ceilingHeight)} cm`]);
  return { title: found.kind === 'floor' ? 'Floor' : 'Ceiling', kind: found.kind, tags: [], rows, assumptions: assumptionsFor(room.assumptions, sel.id) };
}
