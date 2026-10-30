import { useEffect } from 'react';
import { shareUrl } from './url';
import { ignoresKeys } from '../scene/input';
import { useStore } from './store';
import { useMeasure } from './measureStore';
import { useRoomLightsOn } from '../scene/useLightsOn';
import { MoodSwitch } from './MoodSwitch';

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
      <MoodSwitch labels />
      <button className={lightsOn ? 'on' : ''} onClick={() => s.toggleRoomLights(lightsOn)} title="This room's lights on/off (L) — or double-click a lamp">💡 Lights</button>
      <button className={measuring ? 'on' : ''} onClick={toggleMeasure} title="Measure between two surfaces (M)">📏 Measure</button>
      <button onClick={share}>🔗 Share</button>
    </div>
  );
}
