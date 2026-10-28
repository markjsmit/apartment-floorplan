import { held, type MoveKey } from '../scene/input';
import { useStore } from './store';
import { useRoomLightsOn } from '../scene/useLightsOn';

function HoldButton({ k, className, label }: { k: MoveKey; className: string; label: string }) {
  const on = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    held.add(k);
  };
  const off = () => held.delete(k);
  return (
    <button className={className} onPointerDown={on} onPointerUp={off} onPointerCancel={off} onPointerLeave={off} onContextMenu={(e) => e.preventDefault()}>
      {label}
    </button>
  );
}

/** Phone/tablet controls, buttons only: ▲▼ walk, ◀▶ turn (left hand); look up/down (right hand). */
export function TouchControls() {
  return (
    <>
      <div className="touchpad">
        <HoldButton k="forward" className="up" label="▲" />
        <HoldButton k="left" className="left" label="◀" />
        <HoldButton k="back" className="down" label="▼" />
        <HoldButton k="right" className="right" label="▶" />
      </div>
      <div className="touchpad look">
        <HoldButton k="up" className="up" label="⤒" />
        <HoldButton k="down" className="down" label="⤓" />
      </div>
    </>
  );
}

/** Eye height switch for the phone layout (the desktop toolbar has the same). */
export function PersonSwitch() {
  const person = useStore((s) => s.person);
  const setPerson = useStore((s) => s.setPerson);
  const toggleRoomLights = useStore((s) => s.toggleRoomLights);
  const lightsOn = useRoomLightsOn();
  return (
    <div className="seg person-switch">
      <button className={person === 'mark' ? 'on' : ''} onClick={() => setPerson('mark')}>Mark</button>
      <button className={person === 'heli' ? 'on' : ''} onClick={() => setPerson('heli')}>Heli</button>
      {/* the lights of the room you're standing in */}
      <button className={lightsOn ? 'on' : ''} onClick={() => toggleRoomLights(lightsOn)} aria-label="Room lights">💡</button>
    </div>
  );
}
