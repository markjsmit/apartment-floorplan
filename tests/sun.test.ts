import { describe, expect, it } from 'vitest';
import { moonForMood, MOODS, sunForMood } from '../src/scene/sun';

const DEG = Math.PI / 180;
const elevation = (d: number[]) => Math.asin(d[1]) / DEG;

describe('sunForMood', () => {
  it('day: sun fairly high in the south-west', () => {
    const d = sunForMood('day', 0)!;
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

  it('night: no sun, a faint moon instead (through the windows only)', () => {
    expect(sunForMood('night', 0)).toBeNull();
    expect(moonForMood('day', 0)).toBeNull();
    const m = moonForMood('night', 0)!;
    expect(elevation(m)).toBeGreaterThan(25);
  });

  it('turns with the room northAngle', () => {
    // north points to +x, so west is -z
    const d = sunForMood('golden', 90)!;
    expect(d[2]).toBeLessThan(-0.9);
  });

  it('has the three moods, day first', () => {
    expect(MOODS.map((m) => m.id)).toEqual(['day', 'golden', 'night']);
  });
});
