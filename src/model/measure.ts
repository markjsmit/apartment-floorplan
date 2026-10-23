import type { Vec3 } from './schema';

export type Box = { min: Vec3; max: Vec3 };
export type SurfacePoint = {
  point: Vec3;
  normal: Vec3;
  /** furniture bounds (room space): the measurement snaps to the box face towards the other point */
  box?: Box;
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
};

const AXES: Axis[] = ['x', 'y', 'z'];

function axisIndex(normal: Vec3): number {
  const abs = normal.map(Math.abs);
  return abs.indexOf(Math.max(...abs));
}

/** Coordinate on axis i of p's surface, snapped to its box face nearest the other coordinate. */
function level(p: SurfacePoint, i: number, other: number): number {
  if (!p.box) return p.point[i];
  if (other >= p.box.max[i]) return p.box.max[i];
  if (other <= p.box.min[i]) return p.box.min[i];
  return p.point[i];
}

/**
 * Distance along one room axis. The axis is the facing direction of the wall/floor/ceiling if exactly one of
 * the two is one, else of the first surface. Furniture snaps to its box face, so "ceiling → closet" measures
 * from the closet top even when you can only click its side.
 */
export function measureBetween(a: SurfacePoint, b: SurfacePoint): Measurement {
  const i = a.roomSurface !== b.roomSurface && b.roomSurface ? axisIndex(b.normal) : axisIndex(a.normal);
  const la = level(a, i, b.point[i]);
  const lb = level(b, i, la);
  // draw from the furniture side when there is one, so the line sits on the item
  const [anchor, anchorLevel, otherLevel] = !a.box && b.box ? [b, lb, la] : [a, la, lb];
  const from: Vec3 = [...anchor.point];
  from[i] = anchorLevel;
  const to: Vec3 = [...from];
  to[i] = otherLevel;
  return { axis: AXES[i], distance: Math.abs(lb - la), from, to };
}
