import { useEffect } from 'react';
import { fetchBundle } from '../data/client';
import { Viewer } from '../scene/Viewer';
import { Banner } from './Banner';
import { Hud } from './Hud';
import { InfoPanel } from './InfoPanel';
import { Tabs } from './Tabs';
import { Toolbar } from './Toolbar';
import { TouchControls } from './TouchControls';
import { useDevLink } from './useDevLink';
import { useIsMobile, useIsTouch } from './useIsMobile';
import { useStore } from './store';
import { parseUrlState, serializeUrlState } from './url';

export function App() {
  const bundle = useStore((s) => s.bundle);
  const roomId = useStore((s) => s.roomId);
  const versionId = useStore((s) => s.versionId);
  const mobile = useIsMobile();
  const touch = useIsTouch();
  useDevLink();

  useEffect(() => {
    fetchBundle()
      .then((b) => {
        const u = parseUrlState(location.search, b);
        useStore.setState({
          versionId: u.versionId,
          roomId: u.roomId,
          noreport: u.noreport,
          ...(u.view ? { view: u.view } : {}),
          ...(u.person ? { person: u.person } : {}),
          ...(u.time !== undefined ? { timeOfDay: u.time } : {}),
          ...(u.camera ? { camera: u.camera } : {}),
        });
        useStore.getState().setBundle(b);
        if (!u.camera) useStore.setState((s) => ({ spawnTick: s.spawnTick + 1 }));
      })
      .catch((e) => useStore.getState().setLoadError(e.message));
  }, []);

  // keep the address bar pointing at the open room + version (camera is only added for snapshots)
  useEffect(() => {
    if (!bundle) return;
    // keep any other params (noreport, view, debug flags...) as they were
    const q = new URLSearchParams(location.search);
    ['room', 'version', 'cam'].forEach((k) => q.delete(k));
    const rest = q.toString();
    history.replaceState(null, '', `${serializeUrlState({ roomId, versionId })}${rest ? `&${rest}` : ''}`);
  }, [bundle, roomId, versionId]);

  return (
    <div className={mobile ? 'app mobile' : 'app'}>
      <Viewer />
      <Tabs showVersions={!mobile} />
      {!mobile && <Toolbar />}
      {!mobile && <Hud />}
      <InfoPanel compact={mobile} />
      <Banner />
      {touch && <TouchControls />}
      {!mobile && !touch && (
        <div className="help">↑↓ walk · ←→ turn · W A S D walk + step sideways · two-finger swipe / E C look · click select · double-click change state · Esc deselect</div>
      )}
      {!bundle && <div className="loading">Loading…</div>}
    </div>
  );
}
