import type { Vec3 } from './schema';

export type Box = { min: Vec3; max: Vec3 };
export type SurfacePoint = {
  point: Vec3;
  normal: Vec3;
  /** furniture bounds (room space) */
  box?: Box;
  /** "snap to outside": a click on the side of the furniture measures from its outer face (e.g. the closet top) */
  snapOuter?: boolean;
  /** wall / floor / ceiling: its direction decides the axis */
  roomSurface?: boolean;
};
export type Axis = 'x' | 'y' | 'z';
export type Measurement = {
  /** room axis the measurement runs along (y = height) */
  axis: Axis;
  /** distance along that axis between the two surfaces (cm) */
  distance: number;
  from: Vec3;
  /** `from` moved along the axis onto the other surface's level, so the line is perfectly straight */
  to: Vec3;
  /** per clicked point: whether it was snapped to its furniture's outer face instead of the exact spot */
  snapped: [boolean, boolean];
};

const AXES: Axis[] = ['x', 'y', 'z'];

function axisIndex(normal: Vec3): number {
  const abs = normal.map(Math.abs);
  return abs.indexOf(Math.max(...abs));
}

/**
 * Coordinate on axis i of p's surface: exactly where clicked, unless "snap to outside" is on and the clicked face
 * doesn't point along the axis (the side of a closet when measuring height) — then the box face towards the
 * other point (the closet top you can't see).
 */
function level(p: SurfacePoint, i: number, other: number): { value: number; snapped: boolean } {
  const facesAxis = Math.abs(p.normal[i]) / (Math.hypot(...p.normal) || 1) >= 0.5;
  if (!p.box || !p.snapOuter || facesAxis) return { value: p.point[i], snapped: false };
  if (other >= p.box.max[i]) return { value: p.box.max[i], snapped: true };
  if (other <= p.box.min[i]) return { value: p.box.min[i], snapped: true };
  return { value: p.point[i], snapped: false };
}

/**
 * Distance along one room axis. The axis is the facing direction of the wall/floor/ceiling if exactly one of
 * the two is one, else of the first surface. Points are exact; with snapOuter, a click on the side of furniture
 * measures from its outer face ("ceiling → closet top" without seeing the top).
 */
export function measureBetween(a: SurfacePoint, b: SurfacePoint): Measurement {
  const i = a.roomSurface !== b.roomSurface && b.roomSurface ? axisIndex(b.normal) : axisIndex(a.normal);
  const la = level(a, i, b.point[i]);
  const lb = level(b, i, la.value);
  // draw from the furniture side when there is one, so the line sits on the item
  const [anchor, anchorLevel, otherLevel] = !a.box && b.box ? [b, lb.value, la.value] : [a, la.value, lb.value];
  const from: Vec3 = [...anchor.point];
  from[i] = anchorLevel;
  const to: Vec3 = [...from];
  to[i] = otherLevel;
  return { axis: AXES[i], distance: Math.abs(lb.value - la.value), from, to, snapped: [la.snapped, lb.snapped] };
}
