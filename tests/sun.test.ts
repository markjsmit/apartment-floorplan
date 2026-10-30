import { describe, expect, it } from 'vitest';
import { goldenHour, sunDirection } from '../src/scene/sun';

const DEG = Math.PI / 180;

describe('sunDirection', () => {
  it('is high in the south at midsummer noon at lat 50', () => {
    const d = sunDirection({ lat: 50, lon: 10, year: 2026, dayOfYear: 172, hours: 12, northAngle: 0 })!;
    const elevation = Math.asin(d[1]) / DEG;
    expect(elevation).toBeGreaterThan(61);
    expect(elevation).toBeLessThan(65);
    expect(d[2]).toBeGreaterThan(0); // south is +z when north is -z
    expect(Math.abs(d[0])).toBeLessThan(0.1);
  });

  it('rotates with the room northAngle', () => {
    // north points to +x, so south is -x
    const d = sunDirection({ lat: 50, lon: 10, year: 2026, dayOfYear: 172, hours: 12, northAngle: 90 })!;
    expect(d[0]).toBeLessThan(-0.3);
  });

  it('rises in the east in the morning', () => {
    const d = sunDirection({ lat: 50, lon: 10, year: 2026, dayOfYear: 80, hours: 8, northAngle: 0 })!;
    expect(d[0]).toBeGreaterThan(0.3); // east is +x
  });

  it('returns null at night', () => {
    expect(sunDirection({ lat: 50, lon: 10, year: 2026, dayOfYear: 172, hours: 0, northAngle: 0 })).toBeNull();
  });
});

describe('goldenHour', () => {
  it('is in the last hour before sunset, later in summer than in winter (Tel Aviv)', () => {
    const summer = goldenHour({ lat: 32.08, lon: 34.78, year: 2026, dayOfYear: 172 });
    const winter = goldenHour({ lat: 32.08, lon: 34.78, year: 2026, dayOfYear: 355 });
    expect(summer).toBeGreaterThan(18);
    expect(summer).toBeLessThan(19.5);
    expect(winter).toBeGreaterThan(16);
    expect(winter).toBeLessThan(17);
    // the sun is still up, low
    const dir = sunDirection({ lat: 32.08, lon: 34.78, year: 2026, dayOfYear: 172, hours: summer, northAngle: 0 });
    expect(dir).not.toBeNull();
    expect(dir![1]).toBeLessThan(0.15);
  });
});
