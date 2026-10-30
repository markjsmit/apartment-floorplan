import type { Bundle } from './bundle';
import { generatorError, resolveAsset, resolveParams } from './assets';
import { pointInPolygon, resolveWalls } from './geometry';
import { footprintCorners, placeRoomItems, quadsOverlap } from './placement';
import { computeLayout } from './layout';
import { WALK_ON } from './collision';

// Overlap/outside checks ignore this much (cm), so things touching each other or a wall are fine.
const TOLERANCE = 1;

export type Issue = { level: 'error' | 'warning'; message: string };

/**
 * Problems the schema alone can't catch. Errors are broken references or geometry that can't be right;
 * warnings (overlapping items) are often intended, e.g. a chair tucked under a table.
 */
export function sanityCheck(bundle: Bundle): Issue[] {
  const issues: Issue[] = [];
  const error = (message: string) => issues.push({ level: 'error', message });
  const warn = (message: string) => issues.push({ level: 'warning', message });
  const hasTexture = (id: string | undefined) => !id || id in bundle.textures;

  for (const raw of Object.values(bundle.furniture)) {
    // checked with default params (generated states/interactions included)
    const genErr = generatorError(raw, resolveParams(raw, { params: {} }));
    if (genErr) error(`asset ${raw.id}: ${genErr}`);
    const asset = resolveAsset(raw, resolveParams(raw, { params: {} }));
    const parts = asset.parts;
    const partIds = new Set(parts.map((p) => p.id));
    for (const p of parts) if (!hasTexture(p.material)) error(`asset ${asset.id}: part "${p.id}" uses unknown material "${p.material}"`);
    for (const x of asset.interactions) if (!partIds.has(x.part)) error(`asset ${asset.id}: interaction part "${x.part}" does not exist`);
    for (const s of asset.states) {
      for (const pid of Object.keys(s.parts)) if (!partIds.has(pid)) error(`asset ${asset.id}: state "${s.id}" changes unknown part "${pid}"`);
    }
    if (asset.defaultState && !asset.states.some((s) => s.id === asset.defaultState)) {
      error(`asset ${asset.id}: defaultState "${asset.defaultState}" is not one of its states`);
    }
  }

  const currentRooms = new Set(bundle.versions.current?.rooms.map((r) => r.id) ?? []);
  for (const r of bundle.gallery?.rooms ?? []) {
    if (!currentRooms.has(r.room)) error(`gallery: unknown room "${r.room}" (not in Current)`);
    for (const p of r.pictures) if (!p.file.startsWith(`${r.room}/`)) warn(`gallery: ${p.file} is listed under room "${r.room}"`);
  }

  for (const vid of bundle.versionOrder) {
    const house = bundle.versions[vid];
    // how the rooms fit together as one house (doors lining up, north, walls between rooms)
    for (const issue of computeLayout(house).issues) warn(`[${vid}] ${issue}`);
    const where = (id: string) => `[${vid}] ${id}`;
    const seen = new Set<string>();
    const unique = (id: string) => {
      if (seen.has(id)) error(`[${vid}] duplicate id "${id}"`);
      seen.add(id);
    };

    for (const room of house.rooms) {
      unique(room.id);
      const walls = resolveWalls(room);
      walls.forEach((w) => unique(w.id));
      for (const m of [room.floor.material, room.ceiling.material, ...walls.map((w) => w.material)]) {
        if (!hasTexture(m)) error(`${where(room.id)}: unknown material "${m}"`);
      }

      for (const o of room.openings) {
        unique(o.id);
        const wall = walls.find((w) => w.id === o.wall);
        if (!wall) {
          error(`${where(o.id)}: unknown wall "${o.wall}"`);
          continue;
        }
        if (o.offset + o.width > wall.length + TOLERANCE) {
          error(`${where(o.id)}: is wider than / outside its wall (offset ${o.offset} + width ${o.width} > wall length ${wall.length.toFixed(0)})`);
        }
        if (o.sill + o.height > room.ceilingHeight + TOLERANCE) {
          error(`${where(o.id)}: top (${o.sill + o.height}) is above the ceiling (${room.ceilingHeight})`);
        }
        if (o.asset && !bundle.furniture[o.asset]) error(`${where(o.id)}: unknown asset "${o.asset}"`);
        if (o.leadsTo) {
          const to = house.rooms.find((r) => r.id === o.leadsTo!.room);
          if (!to) error(`${where(o.id)}: leads to unknown room "${o.leadsTo.room}"`);
          else if (o.leadsTo.opening && !to.openings.some((x) => x.id === o.leadsTo!.opening)) {
            error(`${where(o.id)}: leads to unknown opening "${o.leadsTo.opening}" in ${to.id}`);
          }
        }
      }

      for (const item of room.items) {
        unique(item.id);
        const raw = bundle.furniture[item.asset];
        if (!raw) error(`${where(item.id)}: unknown asset "${item.asset}"`);
        const genErr = raw && generatorError(raw, resolveParams(raw, item));
        if (genErr) error(`${where(item.id)}: ${genErr}`);
        if (item.against && !walls.some((w) => w.id === item.against!.wall)) {
          error(`${where(item.id)}: unknown wall "${item.against.wall}"`);
        }
      }

      const placed = placeRoomItems(room, bundle.furniture, walls);
      for (const p of placed) {
        const corners = footprintCorners(p, TOLERANCE);
        if (!corners.every((c) => pointInPolygon(c, room.footprint))) error(`${where(p.item.id)}: sticks outside the room`);
        const top = p.position[1] + p.size.max[1];
        if (top > room.ceilingHeight + TOLERANCE) error(`${where(p.item.id)}: is taller than the ceiling (${top.toFixed(0)} > ${room.ceilingHeight})`);
      }
      for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          const a = placed[i];
          const b = placed[j];
          const ay = [a.position[1] + a.size.min[1], a.position[1] + a.size.max[1]];
          const by = [b.position[1] + b.size.min[1], b.position[1] + b.size.max[1]];
          if (ay[1] <= by[0] + TOLERANCE || by[1] <= ay[0] + TOLERANCE) continue;
          // rugs and mats lie under things
          if (ay[1] <= WALK_ON || by[1] <= WALK_ON) continue;
          if (a.item.allowOverlap.includes(b.item.id) || b.item.allowOverlap.includes(a.item.id)) continue;
          if (quadsOverlap(footprintCorners(a, TOLERANCE), footprintCorners(b, TOLERANCE))) {
            warn(`${where(a.item.id)}: overlaps ${b.item.id}`);
          }
        }
      }
    }
  }
  return issues;
}
