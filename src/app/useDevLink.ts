import { useEffect } from 'react';
import { fetchBundle, reportEvent, reportUiState, subscribe, type Command } from '../data/client';
import { mergeBundle } from '../model/bundle';
import { currentHouse, currentRoom, EYE_HEIGHT, useStore } from './store';
import { facing } from '../model/geometry';
import { labelOf } from './labels';
import { currentMeasurement, useMeasure } from './measureStore';
import { claimActiveTab, createReporter, isActiveTab } from './uiState';

type StoreState = ReturnType<typeof useStore.getState>;

/** The measuring tool's last result: along one room axis, from the first clicked surface. */
function measurementState(s: StoreState) {
  const { active, points } = useMeasure.getState();
  const m = currentMeasurement(points);
  if (!active || !m) return null;
  const end = (i: number) => ({ ...(points[i].target ? { id: points[i].target!.id, ...labelOf(s, points[i].target!) } : {}), point: points[i].point.map(Math.round) });
  return { axis: m.axis, distanceCm: Math.round(m.distance), from: end(0), to: end(1), line: [m.from.map(Math.round), m.to.map(Math.round)] };
}

/** What Claude reads from .ui-state/ui-state.json. */
function buildUiState(s: StoreState) {
  const sel = s.selection;
  const selection = sel ? { ...sel, ...labelOf(s, sel) } : null;
  const look = s.lookingAt;
  const lookingAt = look ? { ...look, ...labelOf(s, look) } : null;
  const room = currentRoom(s);
  return {
    room: s.roomId,
    version: s.versionId,
    selection,
    camera: {
      // room-local cm; yaw 0 looks towards -z, positive turns left
      position: [Math.round(s.camera.x), EYE_HEIGHT[s.person], Math.round(s.camera.z)],
      yaw: Math.round(s.camera.yaw),
      pitch: Math.round(s.camera.pitch),
      facing: room ? facing(s.camera.yaw, room.northAngle) : null,
      view: s.view,
    },
    lookingAt,
    measurement: measurementState(s),
    person: s.person,
    timeOfDay: s.timeOfDay,
    dayOfYear: s.dayOfYear,
    itemStates: s.itemStates,
  };
}

async function reload() {
  try {
    const next = await fetchBundle();
    useStore.getState().setBundle(mergeBundle(useStore.getState().bundle, next));
    useStore.getState().setLoadError(null);
  } catch (e) {
    useStore.getState().setLoadError((e as Error).message);
  }
}

async function goto(room: string, version?: string) {
  const s = useStore.getState();
  if (version && !s.setVersion(version)) {
    // Claude may have just written the file; the reload can still be on its way
    await reload();
    if (!useStore.getState().setVersion(version)) return s.toast(`Claude asked for version "${version}", which doesn't exist.`);
  }
  if (!useStore.getState().setRoom(room)) useStore.getState().toast(`Claude asked for room "${room}", which isn't in this version.`);
}

/** Dev mode only: live reload from disk, Claude's commands, and reporting what Mark sees to .ui-state/. */
export function useDevLink() {
  useEffect(() => {
    const onCommand = (c: Command) => {
      const s = useStore.getState();
      if (c.type === 'select' && !s.selectById(c.id)) s.toast(`Claude tried to select "${c.id}" but it doesn't exist here.`);
      if (c.type === 'clear') s.select(null);
      if (c.type === 'goto') void goto(c.room, c.version);
      if (c.type === 'look-at') s.lookAt(c.id);
      if (c.type === 'toast') s.toast(c.text);
      if (c.type === 'reload') void reload();
    };
    return subscribe(() => void reload(), onCommand);
  }, []);

  // Report UI state from the tab Mark used last, and only when something he sees changed.
  useEffect(() => {
    const reporter = createReporter((state) => reportUiState(state, isActiveTab));
    let prev: ReturnType<typeof buildUiState> | null = null;
    const update = (s: StoreState) => {
      if (s.noreport || !s.bundle) return;
      const state = buildUiState(s);
      const active = isActiveTab();
      reporter(state, active);
      if (active && prev) {
        if (JSON.stringify(prev.selection) !== JSON.stringify(state.selection)) reportEvent({ type: 'select', selection: state.selection });
        if (prev.room !== state.room || prev.version !== state.version) reportEvent({ type: 'tab', room: state.room, version: state.version });
        if (JSON.stringify(prev.itemStates) !== JSON.stringify(state.itemStates)) reportEvent({ type: 'state', itemStates: state.itemStates });
      }
      prev = state;
    };
    const activate = () => {
      if (useStore.getState().noreport) return;
      claimActiveTab();
      reporter.activate();
    };
    if (document.hasFocus()) activate();
    window.addEventListener('focus', activate);
    window.addEventListener('pointerdown', activate);
    const unsub = useStore.subscribe(update);
    const unsubMeasure = useMeasure.subscribe(() => update(useStore.getState()));
    return () => {
      unsub();
      unsubMeasure();
      window.removeEventListener('focus', activate);
      window.removeEventListener('pointerdown', activate);
    };
  }, []);
}
