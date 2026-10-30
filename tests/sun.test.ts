import { describe, expect, it } from 'vitest';
import { MOODS, sunForMood } from '../src/scene/sun';

const DEG = Math.PI / 180;
const elevation = (d: number[]) => Math.asin(d[1]) / DEG;

describe('sunForMood', () => {
  it('afternoon: sun fairly high in the south-west', () => {
    const d = sunForMood('afternoon', 0)!;
    expect(elevation(d)).toBeGreaterThan(35);
    expect(elevation(d)).toBeLessThan(55);
    // north is -z, east +x: south-west is -x, +z
    expect(d[0]).toBeLessThan(-0.3);
    expect(d[2]).toBeGreaterThan(0.3);
  });

  it('golden hour: sun low in the west', () => {
    const d = sunForMood('golden', 0)!;
    expect(elevation(d)).toBeGreaterThan(3);
    expect(elevation(d)).toBeLessThan(12);
    expect(d[0]).toBeLessThan(-0.9);
  });

  it('night: no sun', () => {
    expect(sunForMood('night', 0)).toBeNull();
  });

  it('turns with the room northAngle', () => {
    // north points to +x, so west is -z
    const d = sunForMood('golden', 90)!;
    expect(d[2]).toBeLessThan(-0.9);
  });

  it('has the three moods, afternoon first', () => {
    expect(MOODS.map((m) => m.id)).toEqual(['afternoon', 'golden', 'night']);
  });
});
