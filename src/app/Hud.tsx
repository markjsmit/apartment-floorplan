import { facing } from '../model/geometry';
import { labelOf } from './labels';
import { currentLayout, currentRoom, poseInRoom, useStore } from './store';

/** Crosshair + one line: where you stand, which way you face, what's under the crosshair. */
export function Hud() {
  const s = useStore();
  const room = currentRoom(s);
  if (!room || s.view !== 'first-person') return null;
  // shown in the active room's own coordinates, like the house files
  const pose = poseInRoom(s);
  const dir = facing(s.camera.yaw, currentLayout(s)?.northAngle ?? room.northAngle);
  const look = s.lookingAt;
  return (
    <>
      <div className="crosshair" />
      <div className="hud">
        📍 {room.name} {Math.round(pose.x)}, {Math.round(pose.z)} cm · facing {dir.compass}
        {look && <> · 👁 {labelOf(s, look).name}{look.part && look.kind === 'item' ? ` (${look.part})` : ''} · {(look.distance / 100).toFixed(1)} m</>}
      </div>
    </>
  );
}
