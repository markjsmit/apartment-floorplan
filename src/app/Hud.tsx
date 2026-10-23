import { facing } from '../model/geometry';
import { labelOf } from './labels';
import { currentRoom, useStore } from './store';

/** Crosshair + one line: where you stand, which way you face, what's under the crosshair. */
export function Hud() {
  const s = useStore();
  const room = currentRoom(s);
  if (!room || s.view !== 'first-person') return null;
  const dir = facing(s.camera.yaw, room.northAngle);
  const look = s.lookingAt;
  return (
    <>
      <div className="crosshair" />
      <div className="hud">
        📍 {Math.round(s.camera.x)}, {Math.round(s.camera.z)} cm · facing {dir.compass}
        {look && <> · 👁 {labelOf(s, look).name}{look.part && look.kind === 'item' ? ` (${look.part})` : ''} · {(look.distance / 100).toFixed(1)} m</>}
      </div>
    </>
  );
}
