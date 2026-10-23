import { Euler, Matrix4, Vector3 } from 'three';
import type { AssetState, FurnitureAsset, Item, Part, PartOverride, Vec3 } from './schema';
import { generators } from './generators';

const DEG = Math.PI / 180;

export function resolveParams(asset: FurnitureAsset, item: Pick<Item, 'params'>): Record<string, unknown> {
  const defaults = Object.fromEntries(Object.entries(asset.params).map(([k, v]) => [k, v.default]));
  return { ...defaults, ...item.params };
}

export function resolveParts(asset: FurnitureAsset, params: Record<string, unknown>): Part[] {
  const generated =
    asset.source.kind === 'procedural' && asset.source.generator && generators[asset.source.generator]
      ? generators[asset.source.generator](params)
      : [];
  return [...generated, ...asset.parts];
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
  return { position, rotationDeg, visible: override?.visible ?? true, material: override?.material ?? part.material };
}

function eulerOf(deg: Vec3): Euler {
  return new Euler(deg[0] * DEG, deg[1] * DEG, deg[2] * DEG);
}

function halfExtents(part: Part): Vec3 | null {
  const g = part.geometry;
  if (!g) return null;
  if (g.type === 'box') return [g.size[0] / 2, g.size[1] / 2, g.size[2] / 2];
  if (g.type === 'cylinder') return [g.radius, g.height / 2, g.radius];
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

export function nextState(asset: FurnitureAsset, current: string): string {
  const i = asset.states.findIndex((s) => s.id === current);
  return asset.states[(i + 1) % asset.states.length].id;
}

export function interactivePart(asset: FurnitureAsset, partId: string): boolean {
  return asset.interactions.some((x) => x.part === partId && x.action === 'cycleStates');
}
