import { useEffect } from 'react';
import { fetchBundle, reportEvent, reportUiState, subscribe, type Command } from '../data/client';
import { mergeBundle } from '../model/bundle';
import { currentLayout, currentRoom, EYE_HEIGHT, poseInRoom, toRoomLocal, useStore } from './store';
import { facing } from '../model/geometry';
import { labelOf } from './labels';
import { currentMeasurement, useMeasure } from './measureStore';
import { claimActiveTab, createReporter, isActiveTab } from './uiState';

type StoreState = ReturnType<typeof useStore.getState>;

/** The measuring tool's last result: along one room axis from the first clicked surface, or point to point (`axis: 'free'`). */
function measurementState(s: StoreState) {
  const { active, points } = useMeasure.getState();
  const m = currentMeasurement(points);
  if (!active || !m) return null;
  const end = (i: number) => ({ ...(points[i].target ? { id: points[i].target!.id, ...labelOf(s, points[i].target!) } : {}), point: localPoint(s, points[i].point) });
  return { axis: m.axis, distanceCm: Math.round(m.distance), from: end(0), to: end(1), line: [localPoint(s, m.from), localPoint(s, m.to)] };
}

function localPoint(s: StoreState, p: [number, number, number]): [number, number, number] {
  const [x, z] = toRoomLocal(s, [p[0], p[2]]);
  return [Math.round(x), p[1], Math.round(z)];
}

/** What Claude reads from .ui-state/ui-state.json. */
function buildUiState(s: StoreState) {
  const sel = s.selection;
  const selection = sel ? { ...sel, ...labelOf(s, sel) } : null;
  const look = s.lookingAt;
  const lookingAt = look ? { ...look, ...labelOf(s, look), point: localPoint(s, look.point) } : null;
  const room = currentRoom(s);
  // everything Claude reads is in the active room's own coordinates, like the house files
  const pose = poseInRoom(s);
  return {
    room: s.roomId,
    // the active room's version; other rooms show Current unless listed in roomVersions
    version: s.versionId,
    roomVersions: s.roomVersions,
    selection,
    camera: {
      // room-local cm; yaw 0 looks towards -z, positive turns left
      position: [Math.round(pose.x), EYE_HEIGHT[s.person], Math.round(pose.z)],
      yaw: Math.round(pose.yaw),
      pitch: Math.round(s.camera.pitch),
      facing: room ? facing(s.camera.yaw, currentLayout(s)?.northAngle ?? room.northAngle) : null,
      view: s.view,
    },
    lookingAt,
    measurement: measurementState(s),
    person: s.person,
    mood: s.mood,
    itemStates: s.itemStates,
    // view-only: the whole house's lights - off / cozy (decorative lamps) / work (everything)
    lightMode: s.lightMode,
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

/** Go to a room, and (optionally) show that room in `version`; other rooms keep their versions. */
async function goto(room: string, version?: string) {
  const s = useStore.getState();
  // the room first (it may only exist in `version`: then setting the version adds it to the house)
  const entered = s.setRoom(room);
  if (version && !useStore.getState().setVersion(version, room)) {
    // Claude may have just written the file; the reload can still be on its way
    await reload();
    if (!useStore.getState().setVersion(version, room)) {
      const exists = !!useStore.getState().bundle?.versions[version];
      return s.toast(exists ? `Claude asked for room "${room}" in version "${version}", which doesn't have it.` : `Claude asked for version "${version}", which doesn't exist.`);
    }
  }
  if (!entered && !useStore.getState().setRoom(room)) useStore.getState().toast(`Claude asked for room "${room}", which isn't in the house.`);
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
        if (prev.lightMode !== state.lightMode) reportEvent({ type: 'lights', lightMode: state.lightMode });
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
