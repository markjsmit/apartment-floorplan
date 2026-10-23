import SunCalc from 'suncalc';
import type { Vec3 } from '../model/schema';

const DEG = Math.PI / 180;

export type SunInput = { lat: number; lon: number; year: number; dayOfYear: number; hours: number; northAngle: number };

/**
 * Unit vector (room-local) pointing towards the sun, or null when it's below the horizon.
 * `hours` is local solar time (clock time without daylight saving, roughly).
 */
export function sunDirection({ lat, lon, year, dayOfYear, hours, northAngle }: SunInput): Vec3 | null {
  const utcHours = hours - lon / 15;
  const date = new Date(Date.UTC(year, 0, dayOfYear) + utcHours * 3600_000);
  const { azimuth, altitude } = SunCalc.getPosition(date, lat, lon);
  if (altitude <= 0) return null;
  // suncalc azimuth: 0 = south, positive towards west
  const a = northAngle * DEG;
  const north = [Math.sin(a), -Math.cos(a)];
  const east = [Math.cos(a), Math.sin(a)];
  const hx = -Math.cos(azimuth) * north[0] - Math.sin(azimuth) * east[0];
  const hz = -Math.cos(azimuth) * north[1] - Math.sin(azimuth) * east[1];
  const c = Math.cos(altitude);
  return [hx * c, Math.sin(altitude), hz * c];
}
