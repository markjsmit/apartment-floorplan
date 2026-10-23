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

/** On-screen walk buttons for phones/tablets; swiping on the view looks around. */
export function TouchControls() {
  return (
    <div className="touchpad">
      <HoldButton k="forward" className="up" label="▲" />
      <HoldButton k="left" className="left" label="◀" />
      <HoldButton k="back" className="down" label="▼" />
      <HoldButton k="right" className="right" label="▶" />
    </div>
  );
}
