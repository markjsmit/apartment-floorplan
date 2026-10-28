import type { Vec3 } from './schema';

export type Box = { min: Vec3; max: Vec3 };
export type SurfacePoint = {
  point: Vec3;
  normal: Vec3;
  /** wall / floor / ceiling: its direction decides the axis */
  roomSurface?: boolean;
};
export type Axis = 'x' | 'y' | 'z';
/** `axis`: straight out from the first surface along one room axis; `free`: straight line between the two spots */
export type MeasureMode = 'axis' | 'free';
export type Measurement = {
  /** room axis the measurement runs along (y = height), or `free` for a point-to-point line */
  axis: Axis | 'free';
  /** distance between the two clicked surfaces (cm) */
  distance: number;
  from: Vec3;
  /** axis: `from` moved along the axis onto the second surface's level, so the line is perfectly straight; free: the second spot */
  to: Vec3;
};

const AXES: Axis[] = ['x', 'y', 'z'];

function axisIndex(normal: Vec3): number {
  const abs = normal.map(Math.abs);
  return abs.indexOf(Math.max(...abs));
}

/** Below this the two spots lie on one flat surface (two spots on a wall): an axis distance would read 0. */
const SAME_PLANE_CM = 0.5;

/**
 * Distance between the two clicked spots. `axis` mode: along one room axis — the facing direction of the
 * wall/floor/ceiling if exactly one of the two is one, else of the first surface — falling back to point to
 * point when both spots are on the same flat surface. `free` mode: the straight line between the two spots.
 */
export function measureBetween(a: SurfacePoint, b: SurfacePoint, mode: MeasureMode = 'axis'): Measurement {
  if (mode === 'free') return pointToPoint(a, b);
  const i = a.roomSurface !== b.roomSurface && b.roomSurface ? axisIndex(b.normal) : axisIndex(a.normal);
  const from: Vec3 = [...a.point];
  const to: Vec3 = [...a.point];
  to[i] = b.point[i];
  const distance = Math.abs(b.point[i] - a.point[i]);
  if (distance < SAME_PLANE_CM) return pointToPoint(a, b);
  return { axis: AXES[i], distance, from, to };
}

function pointToPoint(a: SurfacePoint, b: SurfacePoint): Measurement {
  const d = Math.hypot(b.point[0] - a.point[0], b.point[1] - a.point[1], b.point[2] - a.point[2]);
  return { axis: 'free', distance: d, from: [...a.point], to: [...b.point] };
}

/** The same spot on the other side of the board it was clicked on (box = that board's bounds). */
export function oppositeFace(p: SurfacePoint, board: Box): SurfacePoint {
  const i = axisIndex(p.normal);
  const point: Vec3 = [...p.point];
  point[i] = p.normal[i] > 0 ? board.min[i] : board.max[i];
  const normal: Vec3 = [0, 0, 0];
  normal[i] = p.normal[i] > 0 ? -1 : 1;
  return { ...p, point, normal };
}
