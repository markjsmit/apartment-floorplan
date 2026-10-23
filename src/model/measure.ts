import type { Vec3 } from './schema';

export type Box = { min: Vec3; max: Vec3 };
export type SurfacePoint = {
  point: Vec3;
  normal: Vec3;
  /** wall / floor / ceiling: its direction decides the axis */
  roomSurface?: boolean;
};
export type Axis = 'x' | 'y' | 'z';
export type Measurement = {
  /** room axis the measurement runs along (y = height) */
  axis: Axis;
  /** distance along that axis between the two clicked surfaces (cm) */
  distance: number;
  from: Vec3;
  /** `from` moved along the axis onto the second surface's level, so the line is perfectly straight */
  to: Vec3;
};

const AXES: Axis[] = ['x', 'y', 'z'];

function axisIndex(normal: Vec3): number {
  const abs = normal.map(Math.abs);
  return abs.indexOf(Math.max(...abs));
}

/**
 * Distance between the two clicked spots along one room axis: the facing direction of the wall/floor/ceiling
 * if exactly one of the two is one, else of the first surface.
 */
export function measureBetween(a: SurfacePoint, b: SurfacePoint): Measurement {
  const i = a.roomSurface !== b.roomSurface && b.roomSurface ? axisIndex(b.normal) : axisIndex(a.normal);
  const from: Vec3 = [...a.point];
  const to: Vec3 = [...a.point];
  to[i] = b.point[i];
  return { axis: AXES[i], distance: Math.abs(b.point[i] - a.point[i]), from, to };
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
