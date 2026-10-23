import { shareUrl } from './url';
import { useStore } from './store';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dayLabel(day: number): string {
  const d = new Date(2026, 0, day);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function timeLabel(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function Toolbar() {
  const s = useStore();
  const share = async () => {
    const url = shareUrl({ roomId: s.roomId, versionId: s.versionId }, s.bundle?.site.publicUrl ?? '', `${location.origin}${import.meta.env.BASE_URL}`);
    try {
      await navigator.clipboard.writeText(url);
      s.toast('Link copied.');
    } catch {
      window.prompt('Copy this link', url);
    }
    if (s.versionId === 'current' || s.versionId === 'suggestion') {
      s.toast('Tip: ask Claude to save this as a version, so the link keeps showing exactly this.');
    }
    if (import.meta.env.DEV) s.toast('The link works once the site is released (npm run release).');
  };

  return (
    <div className="toolbar">
      <div className="seg">
        <button className={s.person === 'mark' ? 'on' : ''} onClick={() => s.setPerson('mark')} title="Eye height 188 cm">Mark</button>
        <button className={s.person === 'heli' ? 'on' : ''} onClick={() => s.setPerson('heli')} title="Eye height 151 cm">Heli</button>
      </div>
      <button className={s.view === 'top-down' ? 'on' : ''} onClick={() => s.setView(s.view === 'top-down' ? 'first-person' : 'top-down')}>
        {s.view === 'top-down' ? '👁 Walk' : '🗺 Top'}
      </button>
      <label className="slider" title="Time of day">
        ☀️ {timeLabel(s.timeOfDay)}
        <input type="range" min={5} max={22} step={0.25} value={s.timeOfDay} onChange={(e) => s.setTime(Number(e.target.value))} />
      </label>
      <label className="slider" title="Date (sun angle)">
        📅 {dayLabel(s.dayOfYear)}
        <input type="range" min={1} max={365} step={1} value={s.dayOfYear} onChange={(e) => s.setDay(Number(e.target.value))} />
      </label>
      <button onClick={share}>🔗 Share</button>
    </div>
  );
}
