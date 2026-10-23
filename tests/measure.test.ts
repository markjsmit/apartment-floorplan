import { describe, expect, it } from 'vitest';
import { measureBetween, oppositeFace } from '../src/model/measure';

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

  it('uses exactly the clicked spots (a shelf inside a kallax)', () => {
    const m = measureBetween(
      { point: [200, 0, 100], normal: [0, 1, 0], roomSurface: true },
      { point: [36, 151.25, 20], normal: [0, 1, 0] },
    );
    expect(m.distance).toBeCloseTo(151.25);
  });

  it('lets a wall/floor/ceiling decide the axis whichever order you click', () => {
    const m = measureBetween(
      { point: [90, 150, 160], normal: [0, 0, 1] },
      { point: [300, 270, 300], normal: [0, -1, 0], roomSurface: true },
    );
    expect(m.axis).toBe('y');
    expect(m.distance).toBeCloseTo(120);
  });
});

describe('oppositeFace', () => {
  it('moves a point on the underside of a board to its top side', () => {
    // top board of a kallax: 1.5 cm... here 4.25 cm thick, y from 219.75 to 224
    const board = { min: [0, 219.75, 0] as [number, number, number], max: [147, 224, 39] as [number, number, number] };
    const flipped = oppositeFace({ point: [60, 219.75, 20], normal: [0, -1, 0] }, board);
    expect(flipped.point).toEqual([60, 224, 20]);
    expect(flipped.normal).toEqual([0, 1, 0]);
  });

  it('works sideways too (front of a door leaf to its back)', () => {
    const leaf = { min: [0, 0, -4] as [number, number, number], max: [80, 210, 0] as [number, number, number] };
    expect(oppositeFace({ point: [40, 100, 0], normal: [0, 0, 1] }, leaf).point).toEqual([40, 100, -4]);
  });
});
