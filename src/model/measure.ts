import type { Vec3 } from './schema';

export type SurfacePoint = { point: Vec3; normal: Vec3 };
export type Axis = 'x' | 'y' | 'z';
export type Measurement = {
  /** room axis the measurement runs along: the first surface's normal, snapped (y = height) */
  axis: Axis;
  /** distance along that axis between the two surfaces (cm) */
  distance: number;
  from: Vec3;
  /** `from` moved along the axis onto the second surface's level, so the line is perfectly straight */
  to: Vec3;
};

const AXES: Axis[] = ['x', 'y', 'z'];

/** Measure from the first surface straight out along its (axis-snapped) normal to the second surface. */
export function measureBetween(a: SurfacePoint, b: SurfacePoint): Measurement {
  const abs = a.normal.map(Math.abs);
  const i = abs.indexOf(Math.max(...abs));
  const delta = b.point[i] - a.point[i];
  const to: Vec3 = [...a.point];
  to[i] = b.point[i];
  return { axis: AXES[i], distance: Math.abs(delta), from: [...a.point], to };
}
