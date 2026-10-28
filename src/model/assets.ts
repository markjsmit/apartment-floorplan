import { Euler, Matrix4, Vector3 } from 'three';
import type { AssetState, FurnitureAsset, Item, Opening, Part, PartOverride, Vec3 } from './schema';
import { generators } from './generators';

const DEG = Math.PI / 180;

export function resolveParams(asset: FurnitureAsset, item: Pick<Item, 'params'>): Record<string, unknown> {
  const defaults = Object.fromEntries(Object.entries(asset.params).map(([k, v]) => [k, v.default]));
  return { ...defaults, ...item.params };
}

/** Generator params for a door/window: asset defaults + the opening's params, sized to the opening. */
export function openingParams(
  asset: FurnitureAsset,
  opening: Pick<Opening, 'params' | 'width' | 'height'>,
  wallThickness?: number,
): Record<string, unknown> {
  return { ...resolveParams(asset, opening), width: opening.width, height: opening.height, wallThickness };
}

/**
 * The asset as it is for these params: generated parts first, then the JSON parts. A generator may also return
 * states and interactions (their part ids depend on params, e.g. a Kallax with doors in some cells); generated
 * states replace the JSON ones, generated interactions are added. The result has no generator any more, so
 * resolving it again is a no-op. Use the resolved asset for everything state-related (findState, nextState...).
 */
export function resolveAsset(asset: FurnitureAsset, params: Record<string, unknown>): FurnitureAsset {
  const gen = asset.source.kind === 'procedural' && asset.source.generator ? generators[asset.source.generator] : undefined;
  if (!gen) return withSections(asset);
  let out: ReturnType<typeof gen>;
  try {
    out = gen(params);
  } catch {
    // bad params (e.g. a typo in kallax inserts): render nothing generated; `npm run check` reports it (generatorError)
    out = [];
  }
  const g = Array.isArray(out) ? { parts: out } : out;
  return withSections({
    ...asset,
    source: { ...asset.source, generator: undefined },
    parts: [...g.parts, ...asset.parts],
    states: g.states?.length ? g.states : asset.states,
    interactions: [...asset.interactions, ...(g.interactions ?? [])],
  });
}

/**
 * Sections for pieces that don't name their own: every group of parts that moves together between states (a door leaf
 * with its handle, a drawer with its front) is a section named after its first part, the rest is "body". So a click
 * selects a shower's door or its frame before the whole. Pieces where nothing moves stay one piece. When several groups
 * move (a cabinet's doors), each also opens on its own (`open`), so double-clicking one door opens just that door.
 */
export function withSections(asset: FurnitureAsset): FurnitureAsset {
  if (asset.parts.some((p) => p.section) || asset.states.length < 2) return asset;
  // how a part moves in each state: a shift (not the absolute position, which differs per part) + its turn/visibility
  const signature = (id: string) => {
    const part = asset.parts.find((p) => p.id === id)!;
    return JSON.stringify(asset.states.map((st) => {
      const o = st.parts[id];
      if (!o) return null;
      const shift = o.position?.map((v, k) => Math.round((v - part.position[k]) * 10) / 10);
      // parts turning about the same hinge move together, even when their own tilt makes their rotations differ (a
      // door leaf and its handle roses)
      return part.pivot && o.rotation
        ? { shift, hinge: part.pivot.map((v) => Math.round(v * 10) / 10), visible: o.visible, material: o.material }
        : { shift, rotation: o.rotation, visible: o.visible, material: o.material };
    }));
  };
  const still = JSON.stringify(asset.states.map(() => null));
  const names = new Map<string, string>();
  for (const p of asset.parts) {
    const sig = signature(p.id);
    if (sig !== still && !names.has(sig)) names.set(sig, p.id);
  }
  if (!names.size) return asset;
  // with several of them (a cabinet's doors, a Kallax's drawers) each also opens on its own: its pose in the other state
  const alone = names.size > 1 && asset.states.length === 2;
  const other = asset.states[1];
  return {
    ...asset,
    parts: asset.parts.map((p) => {
      const section = names.get(signature(p.id));
      return { ...p, section: section ?? 'body', ...(alone && section && other.parts[p.id] ? { open: other.parts[p.id] } : {}) };
    }),
  };
}

/** The generator's complaint about these params, if any. */
export function generatorError(asset: FurnitureAsset, params: Record<string, unknown>): string | undefined {
  const gen = asset.source.kind === 'procedural' && asset.source.generator ? generators[asset.source.generator] : undefined;
  if (asset.source.kind === 'procedural' && asset.source.generator && !gen) return `unknown generator "${asset.source.generator}"`;
  try {
    gen?.(params);
  } catch (e) {
    return (e as Error).message;
  }
  return undefined;
}

export function resolveParts(asset: FurnitureAsset, params: Record<string, unknown>): Part[] {
  return resolveAsset(asset, params).parts;
}

export type PartPose = { position: Vec3; rotationDeg: Vec3; visible: boolean; material?: string };

/** Where a part's geometry centre ends up, with state rotations applied about the part's pivot. */
export function partTransform(part: Part, override?: PartOverride): PartPose {
  const rotationDeg = override?.rotation ?? part.rotation;
  const base = override?.position ?? part.position;
  let position: Vec3 = [...base];
  if (part.pivot && override?.rotation) {
    const pivot = new Vector3(...part.pivot);
    const delta = new Matrix4().makeRotationFromEuler(eulerOf(override.rotation)).multiply(
      new Matrix4().makeRotationFromEuler(eulerOf(part.rotation)).invert(),
    );
    const p = new Vector3(...base).sub(pivot).applyMatrix4(delta).add(pivot);
    position = [p.x, p.y, p.z];
  }
  return { position, rotationDeg, visible: override?.visible ?? !part.hidden, material: override?.material ?? part.material };
}

function eulerOf(deg: Vec3): Euler {
  return new Euler(deg[0] * DEG, deg[1] * DEG, deg[2] * DEG);
}

function halfExtents(part: Part): Vec3 | null {
  const g = part.geometry;
  if (!g) return null;
  if (g.type === 'box' || g.type === 'ellipsoid' || g.type === 'model') return [g.size[0] / 2, g.size[1] / 2, g.size[2] / 2];
  if (g.type === 'cylinder') return [g.radius, g.height / 2, g.radius];
  if (g.type === 'prism') {
    const ext = (i: 0 | 1) => Math.max(...g.points.map((p) => Math.abs(p[i]))) + g.bevel;
    return [ext(0), ext(1), g.depth / 2];
  }
  return [g.size[0] / 2, g.size[1] / 2, 0.5];
}

export type AssetSize = { w: number; h: number; d: number; min: Vec3; max: Vec3 };

/** Axis-aligned bounds (item-local) of all visible parts in the given state. */
export function assetSize(parts: Part[], state: AssetState | undefined): AssetSize {
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const part of parts) {
    const he = halfExtents(part);
    if (!he) continue;
    const pose = partTransform(part, state?.parts[part.id]);
    if (!pose.visible) continue;
    const m = new Matrix4().makeRotationFromEuler(eulerOf(pose.rotationDeg)).setPosition(...pose.position);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const c = new Vector3(sx * he[0], sy * he[1], sz * he[2]).applyMatrix4(m);
      min.min(c);
      max.max(c);
    }
  }
  if (!Number.isFinite(min.x)) return { w: 0, h: 0, d: 0, min: [0, 0, 0], max: [0, 0, 0] };
  return { w: max.x - min.x, h: max.y - min.y, d: max.z - min.z, min: [min.x, min.y, min.z], max: [max.x, max.y, max.z] };
}

export function findState(asset: FurnitureAsset, id: string | undefined): AssetState | undefined {
  return asset.states.find((s) => s.id === id);
}

export function initialState(asset: FurnitureAsset, item: Pick<Item, 'state'>, uiOverride?: string): string {
  for (const candidate of [uiOverride, item.state, asset.defaultState]) {
    if (candidate && findState(asset, candidate)) return candidate;
  }
  return asset.states[0].id;
}

/** The state after `current`; when double-clicking a part whose interaction lists `states`, only through those. */
export function nextState(asset: FurnitureAsset, current: string, part?: string): string {
  const only = part ? asset.interactions.find((x) => x.part === part && x.states?.length)?.states : undefined;
  const ids = only?.filter((id) => asset.states.some((s) => s.id === id)) ?? asset.states.map((s) => s.id);
  if (!ids.length) return current;
  const i = ids.indexOf(current);
  return ids[(i + 1) % ids.length];
}

export function interactivePart(asset: FurnitureAsset, partId: string): boolean {
  return asset.interactions.some((x) => x.part === partId && x.action === 'cycleStates');
}
