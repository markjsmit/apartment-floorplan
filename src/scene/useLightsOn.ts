import { currentHouse, useStore } from '../app/store';
import { roomLightOn } from '../model/lights';
import { sunDirection } from './sun';

const DEFAULT_LOCATION = { lat: 50, lon: 10 };

type SunState = Pick<ReturnType<typeof useStore.getState>, 'house' | 'timeOfDay' | 'dayOfYear'>;

/** Is the sun down (at the house's location, the chosen day and time)? */
export function sunIsDown(s: SunState): boolean {
  const geo = currentHouse(s)?.meta.location ?? DEFAULT_LOCATION;
  return !sunDirection({ lat: geo.lat, lon: geo.lon, year: new Date().getFullYear(), dayOfYear: s.dayOfYear, hours: s.timeOfDay, northAngle: 0 });
}

/** The sun is down — when room lights come on by themselves. */
export function useSunDown(): boolean {
  return useStore(sunIsDown);
}

/** Are a room's lights on: switched by hand, else on after dark (default: the open room). */
export function useRoomLightsOn(roomId?: string | null): boolean {
  const sunDown = useSunDown();
  const override = useStore((s) => s.roomLights[roomId ?? s.roomId ?? '']);
  return override ?? sunDown;
}

/** Every room's lights, for the ui-state Claude reads. */
export function roomLightsState(s: SunState & Pick<ReturnType<typeof useStore.getState>, 'roomLights'>): Record<string, boolean> {
  const sunDown = sunIsDown(s);
  return Object.fromEntries((currentHouse(s)?.rooms ?? []).map((r) => [r.id, roomLightOn(s.roomLights, r.id, sunDown)]));
}
