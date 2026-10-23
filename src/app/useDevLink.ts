import { useEffect } from 'react';
import { fetchBundle, reportEvent, reportUiState, subscribe, type Command } from '../data/client';
import { mergeBundle } from '../model/bundle';
import { findById } from '../model/lookup';
import { currentHouse, EYE_HEIGHT, useStore } from './store';

/** Dev mode only: live reload from disk, Claude's commands, and reporting what Mark sees to .ui-state/. */
export function useDevLink() {
  useEffect(() => {
    const reload = async () => {
      try {
        const next = await fetchBundle();
        useStore.getState().setBundle(mergeBundle(useStore.getState().bundle, next));
        useStore.getState().setLoadError(null);
      } catch (e) {
        useStore.getState().setLoadError((e as Error).message);
      }
    };
    const onCommand = (c: Command) => {
      const s = useStore.getState();
      if (c.type === 'select' && !s.selectById(c.id)) s.toast(`Claude tried to select "${c.id}" but it doesn't exist here.`);
      if (c.type === 'clear') s.select(null);
      if (c.type === 'goto') {
        if (c.version) s.setVersion(c.version);
        s.setRoom(c.room);
      }
      if (c.type === 'look-at') s.lookAt(c.id);
      if (c.type === 'toast') s.toast(c.text);
      if (c.type === 'reload') void reload();
    };
    return subscribe(reload, onCommand);
  }, []);

  // Report UI state whenever something Claude cares about changes.
  useEffect(() => {
    let prev: Record<string, unknown> = {};
    return useStore.subscribe((s) => {
      if (s.noreport || !s.bundle) return;
      const house = currentHouse(s);
      const sel = s.selection;
      let selection = null;
      if (sel && house) {
        const f = findById(house, sel.id);
        const tags = f?.kind === 'item' ? f.item.tags : f?.kind === 'opening' ? f.opening.tags : f?.kind === 'wall' ? f.wall.tags : [];
        const name = f?.kind === 'item' ? (f.item.name ?? f.item.asset) : f?.kind === 'opening' ? (f.opening.name ?? f.opening.type) : sel.kind;
        selection = { ...sel, name, tags, ...(f?.kind === 'item' ? { asset: f.item.asset } : {}) };
      }
      const state = {
        room: s.roomId,
        version: s.versionId,
        selection,
        camera: {
          position: [Math.round(s.camera.x), EYE_HEIGHT[s.person], Math.round(s.camera.z)],
          yaw: Math.round(s.camera.yaw),
          pitch: Math.round(s.camera.pitch),
          view: s.view,
        },
        person: s.person,
        timeOfDay: s.timeOfDay,
        dayOfYear: s.dayOfYear,
        itemStates: s.itemStates,
      };
      reportUiState(state);
      // events for the log: selection, state toggles, tab switches
      if (JSON.stringify(prev.selection) !== JSON.stringify(selection)) reportEvent({ type: 'select', selection });
      if (prev.room !== state.room || prev.version !== state.version) reportEvent({ type: 'tab', room: state.room, version: state.version });
      if (JSON.stringify(prev.itemStates) !== JSON.stringify(state.itemStates)) reportEvent({ type: 'state', itemStates: state.itemStates });
      prev = state;
    });
  }, []);
}
