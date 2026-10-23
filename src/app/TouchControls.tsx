import { held, type MoveKey } from '../scene/input';

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

/** On-screen buttons for phones/tablets: ▲▼ walk, ◀▶ step sideways; swiping on the view turns and looks around. */
export function TouchControls() {
  return (
    <div className="touchpad">
      <HoldButton k="forward" className="up" label="▲" />
      <HoldButton k="strafeLeft" className="left" label="◀" />
      <HoldButton k="back" className="down" label="▼" />
      <HoldButton k="strafeRight" className="right" label="▶" />
    </div>
  );
}
