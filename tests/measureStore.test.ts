import { describe, expect, it } from 'vitest';
import { useMeasure } from '../src/app/measureStore';

describe('measure store', () => {
  it('flips the last point to the other side of its board and back', () => {
    const s = useMeasure.getState();
    s.reset();
    s.add({ point: [60, 219.75, 20], normal: [0, -1, 0], target: null, other: { point: [60, 224, 20], normal: [0, 1, 0] } });
    useMeasure.getState().flipLast();
    expect(useMeasure.getState().points[0].point).toEqual([60, 224, 20]);
    expect(useMeasure.getState().points[0].flipped).toBe(true);
    useMeasure.getState().flipLast();
    expect(useMeasure.getState().points[0].point).toEqual([60, 219.75, 20]);
    expect(useMeasure.getState().points[0].flipped).toBe(false);
  });
});
