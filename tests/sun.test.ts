import { describe, expect, it } from 'vitest';
import { sunDirection } from '../src/scene/sun';

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
