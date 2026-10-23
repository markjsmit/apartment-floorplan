import { currentMeasurement, formatCm, useMeasure, type MeasurePoint } from './measureStore';
import { labelOf } from './labels';
import { useStore } from './store';

const AXIS_NAME = { x: 'along x', y: 'height', z: 'along z' };

/** Steps and result of the measuring tool, with buttons to flip the last point, start over, or leave. */
export function MeasurePanel() {
  const { active, points, flipLast, reset, stop } = useMeasure();
  const s = useStore();
  if (!active) return null;
  const m = currentMeasurement(points);
  const name = (p: MeasurePoint) => `${p.flipped ? 'other side of ' : ''}${p.target ? labelOf(s, p.target).name : 'surface'}`;
  return (
    <div className="measure-panel">
      <strong>📏 Measure</strong>
      {points.length === 0 && <span>Click the first surface</span>}
      {points.length === 1 && <span>From <b>{name(points[0])}</b> — now click the second surface</span>}
      {m && (
        <span>
          <b>{name(points[0])}</b> → <b>{name(points[1])}</b>: <b className="big">{formatCm(m.distance)}</b> ({AXIS_NAME[m.axis]})
        </span>
      )}
      {points.length > 0 && (
        <button onClick={flipLast} title="Move the last point to the other side of that board (or double-click it)">⇅ Other side</button>
      )}
      {points.length > 0 && <button onClick={reset}>New</button>}
      <button onClick={stop}>Done</button>
    </div>
  );
}
