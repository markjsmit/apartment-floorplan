import { describe, expect, it } from 'vitest';
import { measureBetween } from '../src/model/measure';

describe('measureBetween (snapped to one axis)', () => {
  it('measures straight out from the first surface, along its axis', () => {
    // sofa front at z = 100 (facing +z), wall at z = 300; second click is off to the side and higher
    const m = measureBetween(
      { point: [50, 40, 100], normal: [0, 0, 1] },
      { point: [120, 150, 300], normal: [0, 0, -1] },
    );
    expect(m.axis).toBe('z');
    expect(m.distance).toBeCloseTo(200);
    expect(m.from).toEqual([50, 40, 100]);
    expect(m.to).toEqual([50, 40, 300]); // the line stays on the axis
  });

  it('measures height from floor to ceiling', () => {
    const m = measureBetween({ point: [10, 0, 10], normal: [0, 1, 0] }, { point: [200, 270, 80], normal: [0, -1, 0] });
    expect(m.axis).toBe('y');
    expect(m.distance).toBeCloseTo(270);
  });

  it('snaps a slightly tilted normal to the nearest axis', () => {
    const m = measureBetween({ point: [0, 0, 0], normal: [0.1, 0, 0.99] }, { point: [30, 0, 80], normal: [0, 0, -1] });
    expect(m.axis).toBe('z');
    expect(m.distance).toBeCloseTo(80);
  });

  it('still measures along the first axis when the second surface faces another way', () => {
    const m = measureBetween({ point: [0, 100, 0], normal: [-1, 0, 0] }, { point: [-150, 0, 20], normal: [0, 1, 0] });
    expect(m.axis).toBe('x');
    expect(m.distance).toBeCloseTo(150);
    expect(m.to).toEqual([-150, 100, 0]);
  });
});
