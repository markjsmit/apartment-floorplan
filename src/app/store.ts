import { create } from 'zustand';
import type { Bundle } from '../model/bundle';
import type { House } from '../model/schema';
import type { Selection } from '../model/lookup';
import { findById } from '../model/lookup';
import { initialState, nextState, openingParams, resolveAsset, resolveParams } from '../model/assets';
import type { CameraPose, Person, View } from './url';

export const EYE_HEIGHT: Record<Person, number> = { mark: 188, heli: 151 };

export type Toast = { id: number; text: string };
export type LookingAt = Selection & { point: [number, number, number]; distance: number };

type State = {
  bundle: Bundle | null;
  loadError: string | null;
  roomId: string | null;
  versionId: string;
  selection: Selection | null;
  /** View-only furniture states (bed up/down) toggled by double-click; keyed by item/opening id. */
  itemStates: Record<string, string>;
  person: Person;
  view: View;
  timeOfDay: number;
  dayOfYear: number;
  camera: CameraPose;
  /** What's under the crosshair in first-person view (point in room cm, distance in cm). */
  lookingAt: LookingAt | null;
  /** Bumped to ask the controls to (re)spawn the player in the current room. */
  spawnTick: number;
  /** Opening id to spawn at on the next spawn (walked through a door into another room). */
  spawnAt: string | null;
  lookAtTarget: { id: string; tick: number } | null;
  toasts: Toast[];
  noreport: boolean;
};

type Actions = {
  setBundle: (b: Bundle) => void;
  setLoadError: (e: string | null) => void;
  setRoom: (id: string, spawnAt?: string) => boolean;
  setVersion: (id: string) => boolean;
  select: (s: Selection | null) => void;
  selectById: (id: string) => boolean;
  cycleState: (id: string) => void;
  setPerson: (p: Person) => void;
  setView: (v: View) => void;
  setTime: (h: number) => void;
  setDay: (d: number) => void;
  setCamera: (c: CameraPose) => void;
  setLookingAt: (l: LookingAt | null) => void;
  lookAt: (id: string) => void;
  toast: (text: string) => void;
};

function todayOfYear(): number {
  const now = new Date();
  return Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
}

let toastId = 0;

export const useStore = create<State & Actions>((set, get) => ({
  bundle: null,
  loadError: null,
  roomId: null,
  versionId: 'current',
  selection: null,
  itemStates: {},
  person: 'mark',
  view: 'first-person',
  timeOfDay: 14,
  dayOfYear: todayOfYear(),
  camera: { x: 0, z: 0, yaw: 0, pitch: 0 },
  lookingAt: null,
  spawnTick: 0,
  spawnAt: null,
  lookAtTarget: null,
  toasts: [],
  // read straight away so a snapshot browser never reports, not even before the first load
  noreport: typeof location !== 'undefined' && new URLSearchParams(location.search).get('noreport') === '1',

  setBundle: (bundle) => {
    const { versionId, roomId } = get();
    const vid = bundle.versions[versionId] ? versionId : 'current';
    const rooms = bundle.versions[vid]?.rooms ?? [];
    const rid = rooms.some((r) => r.id === roomId) ? roomId : (rooms[0]?.id ?? null);
    const selection = get().selection;
    const stillThere = selection && bundle.versions[vid] && findById(bundle.versions[vid], selection.id);
    set({ bundle, versionId: vid, roomId: rid, selection: stillThere ? selection : null, spawnTick: rid !== roomId ? get().spawnTick + 1 : get().spawnTick });
  },
  setLoadError: (loadError) => set({ loadError }),
  setRoom: (id, spawnAt) => {
    if (!currentHouse(get())?.rooms.some((r) => r.id === id)) return false;
    if (id !== get().roomId) set({ roomId: id, selection: null, spawnTick: get().spawnTick + 1, spawnAt: spawnAt ?? null });
    return true;
  },
  setVersion: (id) => {
    const house = get().bundle?.versions[id];
    if (!house) return false;
    const sameRoom = house.rooms.some((r) => r.id === get().roomId);
    const sel = get().selection;
    set({
      versionId: id,
      roomId: sameRoom ? get().roomId : (house.rooms[0]?.id ?? null),
      selection: sel && findById(house, sel.id) ? sel : null,
      spawnTick: sameRoom ? get().spawnTick : get().spawnTick + 1,
    });
    return true;
  },
  select: (selection) => set({ selection }),
  selectById: (id) => {
    const house = currentHouse(get());
    if (!house) return false;
    const found = findById(house, id);
    if (!found) return false;
    if (found.roomId !== get().roomId) get().setRoom(found.roomId);
    set({ selection: { kind: found.kind, id, part: null } });
    return true;
  },
  cycleState: (id) => {
    const { bundle, itemStates } = get();
    const house = currentHouse(get());
    if (!bundle || !house) return;
    const found = findById(house, id);
    const ref = found?.kind === 'item' ? found.item : found?.kind === 'opening' ? found.opening : null;
    const raw = ref?.asset ? bundle.furniture[ref.asset] : undefined;
    if (!raw || !ref || !found) return;
    // states can depend on params (generated), so cycle through the resolved asset's states
    const params = found.kind === 'item' ? resolveParams(raw, found.item) : found.kind === 'opening' ? openingParams(raw, found.opening) : {};
    const asset = resolveAsset(raw, params);
    const current = initialState(asset, ref, itemStates[id]);
    set({ itemStates: { ...itemStates, [id]: nextState(asset, current) } });
  },
  setPerson: (person) => set({ person }),
  setView: (view) => set({ view }),
  setTime: (timeOfDay) => set({ timeOfDay }),
  setDay: (dayOfYear) => set({ dayOfYear }),
  setCamera: (camera) => set({ camera }),
  setLookingAt: (lookingAt) => set({ lookingAt }),
  lookAt: (id) => {
    if (get().selectById(id)) set({ lookAtTarget: { id, tick: Date.now() } });
  },
  toast: (text) => {
    const id = ++toastId;
    set({ toasts: [...get().toasts, { id, text }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 6000);
  },
}));

export function currentHouse(s: Pick<State, 'bundle' | 'versionId'>): House | null {
  return s.bundle?.versions[s.versionId] ?? null;
}

export function currentRoom(s: Pick<State, 'bundle' | 'versionId' | 'roomId'>) {
  return currentHouse(s)?.rooms.find((r) => r.id === s.roomId) ?? null;
}
