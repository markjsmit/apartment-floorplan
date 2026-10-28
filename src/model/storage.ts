import type { FurnitureAsset, Room, Vec2, Vec3 } from './schema';
import { resolveParams } from './assets';
import { pointInPolygon, resolveWalls } from './geometry';
import { placeRoomItems, type PlacedItem } from './placement';

// Storage volume of a room in litres: only space that can reasonably be used.
// - Kallax: every cube (33.5 x 33.5 x 39) whose opening you can get to — a cube that faces a wall or another piece of
//   furniture within 15 cm doesn't count, nor one that opens onto a shelf (the shelf's contents are in front of it; the
//   shelf space is counted instead, so nothing counts twice).
// - Shelves (thin boards) and the tops of Kallax / the wall-bed cabinet: the free height above them up to whatever is
//   over them or the ceiling (at most MAX_SHELF_H), counted per 5 cm cell where you can reach it: within REACH of a spot
//   you can stand (floor with no furniture over it). The floor under the lowest board of a shelf stack counts too (big
//   things under the shelves).
// - The storage base of a wall bed and DIY shelving units by their inside volume.

const CUBE_L = (33.5 * 33.5 * 39) / 1000;
const CELL = 5;
const MAX_SHELF_H = 60;
const REACH = 60;
/** Anything whose bottom is above this doesn't stop you standing under it (top boards, the shelf over the door). */
const OVERHEAD = 150;
const DEG = Math.PI / 180;
/** Things that are themselves stored stuff or don't block (lights, demo contents, doors that open). */
const IGNORE = new Set(['stuff', 'suitcase', 'surface-light', 'led-strip', 'diy-aisle-doors', 'diy-drying-rack', 'ironing-board', 'diy-pegboard']);

export type StorageBreakdown = { kallax: number; kallaxLostCubes: number; shelves: number; tops: number; other: number; total: number };

type Solid = { p: PlacedItem; min: Vec3; max: Vec3 };

const toLocal = (p: PlacedItem, [x, z]: Vec2): Vec2 => {
  const dx = x - p.position[0];
  const dz = z - p.position[2];
  const c = Math.cos(p.rotationDeg * DEG);
  const s = Math.sin(p.rotationDeg * DEG);
  return [dx * c - dz * s, dx * s + dz * c];
};
const toWorld = (p: PlacedItem, [lx, lz]: Vec2): Vec2 => {
  const c = Math.cos(p.rotationDeg * DEG);
  const s = Math.sin(p.rotationDeg * DEG);
  return [p.position[0] + lx * c + lz * s, p.position[2] - lx * s + lz * c];
};
const footprintHas = (s: Solid, pt: Vec2) => {
  const [lx, lz] = toLocal(s.p, pt);
  return lx > s.min[0] && lx < s.max[0] && lz > s.min[2] && lz < s.max[2];
};
const inside = (s: Solid, pt: Vec2, y: number) => {
  const [lx, lz] = toLocal(s.p, pt);
  const yy = y - s.p.position[1];
  return lx > s.min[0] && lx < s.max[0] && lz > s.min[2] && lz < s.max[2] && yy > s.min[1] && yy < s.max[1];
};

export function roomStorage(room: Room, furniture: Record<string, FurnitureAsset>): StorageBreakdown {
  const placed = placeRoomItems(room, furniture, resolveWalls(room));
  const solids: Solid[] = placed.filter((p) => !IGNORE.has(p.item.asset)).map((p) => ({ p, min: p.size.min, max: p.size.max }));
  const inRoom = (pt: Vec2) => pointInPolygon(pt, room.footprint);
  const blocked = (pt: Vec2, y: number, self: PlacedItem) => !inRoom(pt) || solids.some((s) => s.p !== self && inside(s, pt, y));
  const out: StorageBreakdown = { kallax: 0, kallaxLostCubes: 0, shelves: 0, tops: 0, other: 0, total: 0 };

  // where you can stand: 10 cm floor cells with nothing low over them
  const bounds = room.footprint.reduce((b, [x, z]) => [Math.min(b[0], x), Math.min(b[1], z), Math.max(b[2], x), Math.max(b[3], z)], [Infinity, Infinity, -Infinity, -Infinity]);
  const standing: Vec2[] = [];
  for (let x = bounds[0] + 5; x < bounds[2]; x += 10) {
    for (let z = bounds[1] + 5; z < bounds[3]; z += 10) {
      const pt: Vec2 = [x, z];
      if (inRoom(pt) && !solids.some((s) => s.p.position[1] + s.min[1] < OVERHEAD && footprintHas(s, pt))) standing.push(pt);
    }
  }
  const reachable = (pt: Vec2) => standing.some(([x, z]) => (x - pt[0]) ** 2 + (z - pt[1]) ** 2 <= (REACH + 5) ** 2);

  const isKallax = (p: PlacedItem) => p.item.asset.startsWith('ikea-kallax') && p.asset.source?.kind === 'procedural';
  const isBoard = (p: PlacedItem) => p.item.asset === 'box' && p.size.max[1] - p.size.min[1] <= 3;
  const isBed = (p: PlacedItem) => p.item.asset === 'diy-wall-bed-desk';

  for (const p of placed) {
    if (isKallax(p)) {
      const params = resolveParams(furniture[p.item.asset], p.item);
      const cols = Number(params.cols);
      const rows = Number(params.rows);
      if (!cols || !rows) continue;
      const w = 42 + 35 * (cols - 1);
      for (let c = 0; c < cols; c++) {
        const lx = -w / 2 + 4.25 + 33.5 / 2 + c * 35;
        for (let r = 0; r < rows; r++) {
          const y = p.position[1] + 4.25 + 33.5 / 2 + r * 35;
          const front = toWorld(p, [lx, p.size.max[2] + 15]);
          // right in front of it is a shelf stack (its shelves or the floor under them hold things in front of the cube)
          const ontoShelf = solids.some((s) => isBoard(s.p) && s.p.position[1] + s.min[1] < OVERHEAD && footprintHas(s, front));
          if (blocked(front, y, p) || ontoShelf) out.kallaxLostCubes++;
          else out.kallax += CUBE_L;
        }
      }
    } else if (isBed(p)) {
      const params = resolveParams(furniture[p.item.asset], p.item);
      const bw = Number(params.bedWidth);
      out.other += (bw * (Number(params.baseDepth) - 3.6) * (Number(params.baseHeight) - 3.6)) / 1000;
      // the cabinet's top board (its bounds also hold the folded-out desk, so not sampled like a board)
      if (params.housing === true) {
        const free = Math.min(room.ceilingHeight - Number(params.housingHeight) - 1.8, MAX_SHELF_H);
        if (free >= 15) out.tops += ((bw + 3.6 + Number(params.topExtend ?? 0)) * Number(params.topDepth) * free) / 1000;
      }
    } else if (p.item.asset === 'diy-plywood-shelving') {
      out.other += ((p.size.max[0] - p.size.min[0]) * (p.size.max[2] - p.size.min[2]) * (p.size.max[1] - p.size.min[1]) * 0.85) / 1000;
    }

    // surfaces: boards and Kallax tops
    if (!isBoard(p) && !isKallax(p)) continue;
    const top = p.position[1] + p.size.max[1];
    const bottom = p.position[1] + p.size.min[1];
    const { min, max } = p.size;
    for (let lx = min[0] + CELL / 2; lx < max[0]; lx += CELL) {
      for (let lz = min[2] + CELL / 2; lz < max[2]; lz += CELL) {
        const pt = toWorld(p, [lx, lz]);
        if (!inRoom(pt)) continue;
        // free height above: the lowest thing over this cell, or the ceiling
        let ceil = room.ceilingHeight;
        for (const s of solids) {
          if (s.p === p) continue;
          const b = s.p.position[1] + s.min[1];
          if (b >= top - 0.5 && b < ceil && inside(s, pt, b + 0.1)) ceil = b;
        }
        const free = Math.min(ceil - top, MAX_SHELF_H);
        if (free < 15) continue;
        const area = CELL * CELL;
        if (!reachable(pt)) continue;
        if (isBoard(p)) {
          const kind = top >= 200 ? 'tops' : 'shelves';
          out[kind] += (area * free) / 1000;
          // floor under the lowest board of a shelf stack
          if (bottom < 100 && !solids.some((s) => s.p !== p && inside(s, pt, bottom / 2))) out.shelves += (area * bottom) / 1000;
        } else {
          out.tops += (area * free) / 1000;
        }
      }
    }
  }
  out.total = out.kallax + out.shelves + out.tops + out.other;
  return out;
}
