import { currentHouse, useStore } from '../app/store';
import { sunDirection } from './sun';

const DEFAULT_LOCATION = { lat: 50, lon: 10 };

/** The room lights are on when the sun is down — the same rule the ceiling lamp in Lighting uses. */
export function useLightsOn(): boolean {
  const timeOfDay = useStore((s) => s.timeOfDay);
  const dayOfYear = useStore((s) => s.dayOfYear);
  const geo = useStore((s) => currentHouse(s)?.meta.location) ?? DEFAULT_LOCATION;
  return !sunDirection({ lat: geo.lat, lon: geo.lon, year: new Date().getFullYear(), dayOfYear, hours: timeOfDay, northAngle: 0 });
}
