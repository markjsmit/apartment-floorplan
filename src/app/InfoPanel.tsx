import { useMemo } from 'react';
import { describeSelection } from '../model/lookup';
import { currentHouse, useStore } from './store';

export function InfoPanel({ compact }: { compact: boolean }) {
  const bundle = useStore((s) => s.bundle);
  const house = useStore(currentHouse);
  const selection = useStore((s) => s.selection);
  const itemStates = useStore((s) => s.itemStates);
  const select = useStore((s) => s.select);
  const cycleState = useStore((s) => s.cycleState);

  const d = useMemo(
    () => (bundle && house && selection ? describeSelection(bundle, house, selection, itemStates) : null),
    [bundle, house, selection, itemStates],
  );
  if (!d || !selection) return null;
  const hasStates = d.rows.some(([k]) => k === 'State');

  return (
    <aside className={compact ? 'info compact' : 'info'}>
      <header>
        <span className={`kind ${d.kind}`}>{d.kind}</span>
        <h2>{d.title}</h2>
        <button className="close" onClick={() => select(null)} aria-label="Close">×</button>
      </header>
      {d.tags.length > 0 && (
        <div className="taglist">
          {[...new Set(d.tags)].map((t) => <span key={t} className="tag">{t}</span>)}
        </div>
      )}
      <dl>
        {d.rows.filter(([k]) => !compact || k !== 'Id').map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      {hasStates && (selection.kind === 'item' || selection.kind === 'opening') && (
        <button className="btn" onClick={() => cycleState(selection.id)}>Next state</button>
      )}
      {d.assumptions.length > 0 && (
        <div className="assumed">
          <strong>Assumed, not measured</strong>
          <ul>{d.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      )}
    </aside>
  );
}
