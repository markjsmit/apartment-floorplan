import type { AssetState, Part, PartOverride, Vec3 } from '../schema';
import type { Generated, Generator } from './index';

/**
 * Several generated pieces as one item (e.g. KALLAX TV bench + shelving unit + LACK shelf).
 * params.members: [{ generator, params, offset: [x, y, z], prefix }]. Part ids become `<prefix>.<id>`;
 * states with the same id (closed/open) are merged, offsets applied to positions and pivots.
 */
export function group(params: Record<string, unknown>, registry: Record<string, Generator>): Generated {
  const members = Array.isArray(params.members) ? (params.members as Record<string, unknown>[]) : [];
  const parts: Part[] = [];
  const states = new Map<string, AssetState>();
  const interactions: { part: string; action: 'cycleStates' }[] = [];
  members.forEach((m, i) => {
    const gen = registry[String(m.generator)];
    if (!gen || String(m.generator) === 'group') throw new Error(`group: unknown generator "${String(m.generator)}"`);
    const [dx, dy, dz] = (Array.isArray(m.offset) ? m.offset : [0, 0, 0]).map(Number) as Vec3;
    const move = (v: Vec3): Vec3 => [v[0] + dx, v[1] + dy, v[2] + dz];
    const prefix = String(m.prefix ?? `m${i + 1}`);
    const out = gen((m.params as Record<string, unknown>) ?? {});
    const g = Array.isArray(out) ? { parts: out } : out;
    for (const p of g.parts) parts.push({ ...p, id: `${prefix}.${p.id}`, position: move(p.position), pivot: p.pivot && move(p.pivot) });
    for (const s of g.states ?? []) {
      const merged = states.get(s.id) ?? { id: s.id, name: s.name, parts: {} };
      for (const [pid, o] of Object.entries(s.parts)) {
        const moved: PartOverride = { ...o, position: o.position && move(o.position) };
        merged.parts[`${prefix}.${pid}`] = moved;
      }
      states.set(s.id, merged);
    }
    for (const x of g.interactions ?? []) interactions.push({ ...x, part: `${prefix}.${x.part}` });
  });
  return { parts, states: [...states.values()], interactions };
}
