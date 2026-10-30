import { useEffect } from 'react';
import { fetchBundle } from '../data/client';
import { Viewer } from '../scene/Viewer';
import { Banner } from './Banner';
import { Hud } from './Hud';
import { InfoPanel } from './InfoPanel';
import { MeasurePanel } from './MeasurePanel';
import { Tabs } from './Tabs';
import { Toolbar } from './Toolbar';
import { PersonSwitch, TouchControls } from './TouchControls';
import { PhoneMenu } from './PhoneMenu';
import { MoodSwitch } from './MoodSwitch';
import { useDevLink } from './useDevLink';
import { useIsMobile, useIsTouch } from './useIsMobile';
import { composeHouse } from '../model/roomVersions';
import { poseFromRoom, useStore } from './store';
import { parseUrlState, serializeUrlState } from './url';

export function App() {
  const bundle = useStore((s) => s.bundle);
  const roomId = useStore((s) => s.roomId);
  const versionId = useStore((s) => s.versionId);
  const roomVersions = useStore((s) => s.roomVersions);
  const mobile = useIsMobile();
  const touch = useIsTouch();
  useDevLink();

  useEffect(() => {
    fetchBundle()
      .then((b) => {
        const u = parseUrlState(location.search, b);
        useStore.setState({
          // version= applies to the linked room only (setBundle derives versionId from roomVersions)
          roomVersions: u.roomVersions,
          roomId: u.roomId,
          spawnAt: u.spawnAt ?? null,
          noreport: u.noreport,
          ...(u.view ? { view: u.view } : {}),
          ...(u.person ? { person: u.person } : {}),
          ...(u.mood ? { mood: u.mood } : {}),
          ...(u.itemStates ? { itemStates: u.itemStates } : {}),
          // cam= in a link is in the room's own coordinates
          ...(u.camera ? { camera: poseFromRoom({ house: composeHouse(b, u.roomVersions) }, u.roomId, u.camera) } : {}),
        });
        useStore.getState().setBundle(b);
        if (!u.camera) useStore.setState((s) => ({ spawnTick: s.spawnTick + 1 }));
      })
      .catch((e) => useStore.getState().setLoadError(e.message));
  }, []);

  // Cmd/Ctrl+C with no text selected copies a reference for what's selected (else what's under the crosshair):
  // "<version>:<room>:<id>" - the object's own room, the version that room shows, the id without the room prefix
  // (e.g. "current:living:passage-mirror", "saved/urban-jungle:living:divider") - so Mark can paste exactly what he means
  useEffect(() => {
    const onCopy = (e: ClipboardEvent) => {
      const text = window.getSelection()?.toString().trim();
      const t = e.target as HTMLElement | null;
      if (text || t?.closest('input, textarea, [contenteditable="true"]')) return;
      const s = useStore.getState();
      const id = s.selection?.id ?? s.lookingAt?.id;
      if (!id || !e.clipboardData) return;
      const dot = id.indexOf('.');
      const room = dot > 0 ? id.slice(0, dot) : (s.roomId ?? '');
      const ref = `${s.roomVersions[room] ?? 'current'}:${room}:${dot > 0 ? id.slice(dot + 1) : id}`;
      e.clipboardData.setData('text/plain', ref);
      e.preventDefault();
      s.toast(`Copied ${ref}`);
    };
    document.addEventListener('copy', onCopy);
    return () => document.removeEventListener('copy', onCopy);
  }, []);

  // keep the address bar pointing at the open room + its version, + other rooms' choices (camera is only added for snapshots)
  useEffect(() => {
    if (!bundle) return;
    // keep any other params (noreport, view, debug flags...) as they were
    const q = new URLSearchParams(location.search);
    ['room', 'version', 'rv', 'cam'].forEach((k) => q.delete(k));
    const rest = q.toString();
    history.replaceState(null, '', `${serializeUrlState({ roomId, versionId, roomVersions })}${rest ? `&${rest}` : ''}`);
  }, [bundle, roomId, versionId, roomVersions]);

  return (
    <div className={mobile ? 'app mobile' : 'app'}>
      <Viewer />
      {/* phone: rooms, versions and tools live in the ☰ menu; a clean screen otherwise */}
      {!mobile && <Tabs showVersions />}
      {mobile && <PersonSwitch />}
      {mobile && <MoodSwitch className="time-switch" labels={false} />}
      {mobile && <PhoneMenu />}
      {!mobile && <Toolbar />}
      {!mobile && <Hud />}
      {/* phone: the info panel only shows when Select is on in the ☰ menu (else a tap just opens/closes) */}
      <InfoPanel compact={mobile} />
      <MeasurePanel />
      <Banner />
      {touch && <TouchControls />}
      {!mobile && !touch && (
        <div className="help">↑↓ walk · ←→ turn · W A S D walk + step sideways · two-finger swipe / E C look · middle-click mouse look ·click select · double-click change state · M measure (F angled) · L lights · Esc deselect</div>
      )}
      {!bundle && <div className="loading">Loading…</div>}
    </div>
  );
}
