import type { Bundle } from './bundle';
import { resolveParams, resolveParts } from './assets';
import { pointInPolygon, resolveWalls } from './geometry';
import { footprintCorners, placeRoomItems, quadsOverlap } from './placement';

// Overlap/outside checks ignore this much (cm), so things touching each other or a wall are fine.
const TOLERANCE = 1;

/** Human-readable problems in the house and assets that the schema alone can't catch. */
export function sanityCheck(bundle: Bundle): string[] {
  const issues: string[] = [];
  const hasTexture = (id: string | undefined) => !id || id in bundle.textures;

  for (const asset of Object.values(bundle.furniture)) {
    const parts = resolveParts(asset, resolveParams(asset, { params: {} }));
    const partIds = new Set(parts.map((p) => p.id));
    for (const p of parts) if (!hasTexture(p.material)) issues.push(`asset ${asset.id}: part "${p.id}" uses unknown material "${p.material}"`);
    for (const x of asset.interactions) if (!partIds.has(x.part)) issues.push(`asset ${asset.id}: interaction part "${x.part}" does not exist`);
    for (const s of asset.states) {
      for (const pid of Object.keys(s.parts)) if (!partIds.has(pid)) issues.push(`asset ${asset.id}: state "${s.id}" changes unknown part "${pid}"`);
    }
    if (asset.defaultState && !asset.states.some((s) => s.id === asset.defaultState)) {
      issues.push(`asset ${asset.id}: defaultState "${asset.defaultState}" is not one of its states`);
    }
  }

  for (const vid of bundle.versionOrder) {
    const house = bundle.versions[vid];
    const where = (id: string) => `[${vid}] ${id}`;
    const seen = new Set<string>();
    const unique = (id: string) => {
      if (seen.has(id)) issues.push(`[${vid}] duplicate id "${id}"`);
      seen.add(id);
    };

    for (const room of house.rooms) {
      unique(room.id);
      const walls = resolveWalls(room);
      walls.forEach((w) => unique(w.id));
      for (const m of [room.floor.material, room.ceiling.material, ...walls.map((w) => w.material)]) {
        if (!hasTexture(m)) issues.push(`${where(room.id)}: unknown material "${m}"`);
      }

      for (const o of room.openings) {
        unique(o.id);
        const wall = walls.find((w) => w.id === o.wall);
        if (!wall) {
          issues.push(`${where(o.id)}: unknown wall "${o.wall}"`);
          continue;
        }
        if (o.offset + o.width > wall.length + TOLERANCE) {
          issues.push(`${where(o.id)}: is wider than / outside its wall (offset ${o.offset} + width ${o.width} > wall length ${wall.length.toFixed(0)})`);
        }
        if (o.sill + o.height > room.ceilingHeight + TOLERANCE) {
          issues.push(`${where(o.id)}: top (${o.sill + o.height}) is above the ceiling (${room.ceilingHeight})`);
        }
        if (o.asset && !bundle.furniture[o.asset]) issues.push(`${where(o.id)}: unknown asset "${o.asset}"`);
      }

      for (const item of room.items) {
        unique(item.id);
        if (!bundle.furniture[item.asset]) issues.push(`${where(item.id)}: unknown asset "${item.asset}"`);
        if (item.against && !walls.some((w) => w.id === item.against!.wall)) {
          issues.push(`${where(item.id)}: unknown wall "${item.against.wall}"`);
        }
      }

      const placed = placeRoomItems(room, bundle.furniture, walls);
      for (const p of placed) {
        const corners = footprintCorners(p, TOLERANCE);
        if (!corners.every((c) => pointInPolygon(c, room.footprint))) issues.push(`${where(p.item.id)}: sticks outside the room`);
        const top = p.position[1] + p.size.max[1];
        if (top > room.ceilingHeight + TOLERANCE) issues.push(`${where(p.item.id)}: is taller than the ceiling (${top.toFixed(0)} > ${room.ceilingHeight})`);
      }
      for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          const a = placed[i];
          const b = placed[j];
          const ay = [a.position[1] + a.size.min[1], a.position[1] + a.size.max[1]];
          const by = [b.position[1] + b.size.min[1], b.position[1] + b.size.max[1]];
          if (ay[1] <= by[0] + TOLERANCE || by[1] <= ay[0] + TOLERANCE) continue;
          if (quadsOverlap(footprintCorners(a, TOLERANCE), footprintCorners(b, TOLERANCE))) {
            issues.push(`${where(a.item.id)}: overlaps ${b.item.id}`);
          }
        }
      }
    }
  }
  return issues;
}
