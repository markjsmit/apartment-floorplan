import { currentHouse, useStore } from '../app/store';
import { roomLightOn } from '../model/lights';

type HouseState = Pick<ReturnType<typeof useStore.getState>, 'house'>;

/** Are a room's lights on: switched by hand, else on (default: the open room). */
export function useRoomLightsOn(roomId?: string | null): boolean {
  const override = useStore((s) => s.roomLights[roomId ?? s.roomId ?? '']);
  return override ?? true;
}

/** Every room's lights, for the ui-state Claude reads. */
export function roomLightsState(s: HouseState & Pick<ReturnType<typeof useStore.getState>, 'roomLights'>): Record<string, boolean> {
  return Object.fromEntries((currentHouse(s)?.rooms ?? []).map((r) => [r.id, roomLightOn(s.roomLights, r.id)]));
}
