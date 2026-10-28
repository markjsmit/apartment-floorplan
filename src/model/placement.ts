import type { FurnitureAsset, Item, Part, Room, Vec2, Vec3 } from './schema';
import { assetSize, findState, initialState, resolveAsset, resolveParams, type AssetSize } from './assets';
import { resolveItemTransform, type WallInfo } from './geometry';

export type PlacedItem = {
  item: Item;
  /** Resolved for the item's params (generated parts, states and interactions included). */
  asset: FurnitureAsset;
  parts: Part[];
  stateId: string;
  /** Bounds in the current state (item-local). */
  size: AssetSize;
  position: Vec3;
  rotationDeg: number;
};

const DEG = Math.PI / 180;

export function placeItem(item: Item, rawAsset: FurnitureAsset, walls: WallInfo[], uiState?: string): PlacedItem {
  const asset = resolveAsset(rawAsset, resolveParams(rawAsset, item));
  const parts = asset.parts;
  const stateId = initialState(asset, item, uiState);
  const size = assetSize(parts, findState(asset, stateId));
  // `against` placement uses the item's default-state width so toggling states doesn't slide it along the wall
  const baseSize = assetSize(parts, findState(asset, initialState(asset, item)));
  const { position, rotationDeg } = resolveItemTransform(item, { w: baseSize.w, d: baseSize.d }, walls);
  if (item.against) {
    // the back of the item (local min z) sits on the wall
    const back = -baseSize.min[2];
    const r = rotationDeg * DEG;
    position[0] += Math.sin(r) * back;
    position[2] += Math.cos(r) * back;
    // and its left edge (local min x) is where `offset` says
    const shift = -(baseSize.min[0] + baseSize.max[0]) / 2;
    position[0] += Math.cos(r) * shift;
    position[2] += -Math.sin(r) * shift;
  }
  return { item, asset, parts, stateId, size, position, rotationDeg };
}

export function placeRoomItems(
  room: Room, furniture: Record<string, FurnitureAsset>, walls: WallInfo[], uiStates: Record<string, string> = {},
): PlacedItem[] {
  return room.items.flatMap((item) => {
    const asset = furniture[item.asset];
    return asset ? [placeItem(item, asset, walls, uiStates[item.id])] : [];
  });
}

/** Footprint corners (room-local x,z) of a placed item's bounds. */
export function footprintCorners(p: Pick<PlacedItem, 'size' | 'position' | 'rotationDeg'>, inset = 0): Vec2[] {
  const { min, max } = p.size;
  const c = Math.cos(p.rotationDeg * DEG);
  const s = Math.sin(p.rotationDeg * DEG);
  const xs = [min[0] + inset, max[0] - inset];
  const zs = [min[2] + inset, max[2] - inset];
  return [[xs[0], zs[0]], [xs[1], zs[0]], [xs[1], zs[1]], [xs[0], zs[1]]].map(([x, z]) => [
    p.position[0] + x * c + z * s,
    p.position[2] - x * s + z * c,
  ]);
}

/** Separating-axis test for two convex quads. */
export function quadsOverlap(a: Vec2[], b: Vec2[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, z1] = poly[i];
      const [x2, z2] = poly[(i + 1) % poly.length];
      const axis: Vec2 = [-(z2 - z1), x2 - x1];
      const proj = (q: Vec2[]) => q.map(([x, z]) => x * axis[0] + z * axis[1]);
      const pa = proj(a);
      const pb = proj(b);
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
    }
  }
  return true;
}

/** Things up at the ceiling (lamps, vents): hidden in the plan view, where they'd cover the room below. */
export function upAtCeiling(p: Pick<PlacedItem, 'size' | 'position'>, ceilingHeight: number): boolean {
  const bottom = p.position[1] + p.size.min[1];
  const top = p.position[1] + p.size.max[1];
  return bottom >= 200 && top >= ceilingHeight - 2;
}
