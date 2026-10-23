import { currentMeasurement, formatCm, useMeasure, type MeasurePoint } from './measureStore';
import { labelOf } from './labels';
import { useStore } from './store';

const AXIS_NAME = { x: 'along x', y: 'height', z: 'along z' };

/** Steps and result of the measuring tool, with buttons for a new measurement or leaving the tool. */
export function MeasurePanel() {
  const { active, points, hover, snapOuter, reset, stop, toggleSnap } = useMeasure();
  const s = useStore();
  if (!active) return null;
  const m = currentMeasurement(points);
  const preview = points.length === 1 && hover ? currentMeasurement([points[0], hover]) : null;
  const name = (p: MeasurePoint) => (p.target ? labelOf(s, p.target).name : 'surface');
  // a click on the side of furniture measures from its outer face: say which one
  const end = (i: 0 | 1) => {
    const p = points[i];
    if (!m?.snapped[i]) return name(p);
    const other = points[1 - i];
    const face = m.axis !== 'y' ? 'side' : other.point[1] > p.point[1] ? 'top' : 'bottom';
    return `${face} of ${name(p)}`;
  };
  return (
    <div className="measure-panel">
      <strong>📏 Measure</strong>
      {points.length === 0 && <span>Click the first surface</span>}
      {points.length === 1 && !preview && <span>From <b>{name(points[0])}</b> — now click the second surface</span>}
      {preview && <span>From <b>{name(points[0])}</b> to <b>{name(hover!)}</b>: <b className="big">{formatCm(preview.distance)}</b> — click to keep</span>}
      {m && (
        <span>
          <b>{end(0)}</b> → <b>{end(1)}</b>: <b className="big">{formatCm(m.distance)}</b> ({AXIS_NAME[m.axis]})
        </span>
      )}
      <button className={snapOuter ? 'on' : ''} onClick={toggleSnap} title="A click on the side of furniture measures from its outside (top of a closet). Shift-click does it once.">
        ⤒ Snap to outside
      </button>
      {points.length > 0 && <button onClick={reset}>New</button>}
      <button onClick={stop}>Done</button>
    </div>
  );
}
