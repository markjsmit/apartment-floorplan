import { useEffect } from 'react';
import { shareUrl } from './url';
import { ignoresKeys } from '../scene/input';
import { useStore } from './store';
import { useMeasure } from './measureStore';
import { useRoomLightsOn } from '../scene/useLightsOn';

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

/** Copies a link to the open room + version (and the other rooms' choices). */
export async function share() {
  const s = useStore.getState();
  const url = shareUrl({ roomId: s.roomId, versionId: s.versionId, roomVersions: s.roomVersions }, s.bundle?.site.publicUrl ?? '', `${location.origin}${import.meta.env.BASE_URL}`);
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
}

export function Toolbar() {
  const s = useStore();
  const measuring = useMeasure((m) => m.active);
  const toggleMeasure = useMeasure((m) => m.toggle);
  const lightsOn = useRoomLightsOn(s.roomId);
  // L switches the open room's lights
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (ignoresKeys(e.target as HTMLInputElement) || e.metaKey || e.ctrlKey || e.code !== 'KeyL') return;
      useStore.getState().toggleRoomLights(lightsOn);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [lightsOn]);
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
      <button className={lightsOn ? 'on' : ''} onClick={() => s.toggleRoomLights(lightsOn)} title="This room's lights on/off (L) — or double-click a lamp">💡 Lights</button>
      <button className={measuring ? 'on' : ''} onClick={toggleMeasure} title="Measure between two surfaces (M)">📏 Measure</button>
      <button onClick={share}>🔗 Share</button>
    </div>
  );
}
