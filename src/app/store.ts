import { create } from 'zustand';
import type { Bundle } from '../model/bundle';
import type { House, Vec2 } from '../model/schema';
import { computeLayout, toLocal, toWorld, type Layout } from '../model/layout';
import type { Selection } from '../model/lookup';
import { findById } from '../model/lookup';
import { initialState, nextState, openingParams, resolveAsset, resolveParams } from '../model/assets';
import { baseVersionId, composeHouse } from '../model/roomVersions';
import type { CameraPose, Person, View } from './url';
import type { Mood } from '../scene/sun';
import type { LightMode } from '../model/lights';

export const EYE_HEIGHT: Record<Person, number> = { mark: 188, heli: 151 };

export type Toast = { id: number; text: string };
export type LookingAt = Selection & { point: [number, number, number]; distance: number };

type State = {
  bundle: Bundle | null;
  loadError: string | null;
  roomId: string | null;
  /** the active room's version (kept in sync with roomVersions + roomId) */
  versionId: string;
  /** per-room version choices: {roomId: versionId}; rooms not listed show Current */
  roomVersions: Record<string, string>;
  /** the house on screen: Current with each room's chosen version (recomputed only when bundle/roomVersions change) */
  house: House | null;
  selection: Selection | null;
  /** View-only furniture states (bed up/down) toggled by double-click; keyed by item/opening id. */
  itemStates: Record<string, string>;
  /** View-only room lights switched by hand (💡, double-click a lamp); rooms not listed follow the sun (on after dark). */
  /** One switch for the whole house (Mark: opens in work mode). */
  lightMode: LightMode;
  person: Person;
  view: View;
  /** Phone ☰ menu "Select" switch: a tap selects + shows the info panel instead of opening/closing. */
  tapSelects: boolean;
  /** The daylight: ☀️ day, 🌇 golden hour, 🌙 night. */
  mood: Mood;
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
  /** jump to a room (tab click): respawns the player there */
  setRoom: (id: string, spawnAt?: string) => boolean;
  /** the player walked into a room: just update which room is active */
  enterRoom: (id: string) => void;
  /** show version `id` for one room (default: the active room); false if that version doesn't have the room */
  setVersion: (id: string, roomId?: string) => boolean;
  select: (s: Selection | null) => void;
  selectById: (id: string) => boolean;
  /** open / close one section of an item on its own (a drawer): itemStates[`${id}#${section}`] = 'open' */
  toggleSection: (id: string, section: string) => void;
  /** next state of an item/door; `part` = the double-clicked part (its interaction may limit the states) */
  cycleState: (id: string, part?: string) => void;
  /** switch a room's lights (default: the open room) to the opposite of `currentlyOn` */
  setLightMode: (m: LightMode) => void;
  setPerson: (p: Person) => void;
  setView: (v: View) => void;
  setTapSelects: (on: boolean) => void;
  setMood: (m: Mood) => void;
  setCamera: (c: CameraPose) => void;
  setLookingAt: (l: LookingAt | null) => void;
  lookAt: (id: string) => void;
  toast: (text: string) => void;
};

let toastId = 0;

/** The version a room shows: its own choice, else Current. */
export function roomVersionOf(s: Pick<State, 'bundle' | 'roomVersions'>, roomId: string | null): string {
  const base = s.bundle ? baseVersionId(s.bundle) : 'current';
  return (roomId && s.roomVersions[roomId]) || base;
}

/** Keep only choices whose version still exists, still has the room, and isn't the base. */
function pruneRoomVersions(bundle: Bundle, rv: Record<string, string>): Record<string, string> {
  const base = baseVersionId(bundle);
  const out: Record<string, string> = {};
  for (const [room, vid] of Object.entries(rv)) {
    if (vid !== base && bundle.versions[vid]?.rooms.some((r) => r.id === room)) out[room] = vid;
  }
  return out;
}

export const useStore = create<State & Actions>((set, get) => ({
  bundle: null,
  loadError: null,
  roomId: null,
  versionId: 'current',
  roomVersions: {},
  house: null,
  selection: null,
  itemStates: {},
  lightMode: 'work',
  person: 'mark',
  view: 'first-person',
  tapSelects: false,
  mood: 'day',
  camera: { x: 0, z: 0, yaw: 0, pitch: 0 },
  lookingAt: null,
  spawnTick: 0,
  spawnAt: null,
  lookAtTarget: null,
  toasts: [],
  // read straight away so a snapshot browser never reports, not even before the first load
  noreport: typeof location !== 'undefined' && new URLSearchParams(location.search).get('noreport') === '1',

  setBundle: (bundle) => {
    const { roomId } = get();
    const roomVersions = pruneRoomVersions(bundle, get().roomVersions);
    const house = composeHouse(bundle, roomVersions);
    const rooms = house?.rooms ?? [];
    const rid = rooms.some((r) => r.id === roomId) ? roomId : (rooms[0]?.id ?? null);
    const selection = get().selection;
    const stillThere = selection && house && findById(house, selection.id);
    set({
      bundle,
      house,
      roomVersions,
      versionId: roomVersionOf({ bundle, roomVersions }, rid),
      roomId: rid,
      selection: stillThere ? selection : null,
      spawnTick: rid !== roomId ? get().spawnTick + 1 : get().spawnTick,
    });
  },
  setLoadError: (loadError) => set({ loadError }),
  setRoom: (id, spawnAt) => {
    if (!currentHouse(get())?.rooms.some((r) => r.id === id)) return false;
    if (id !== get().roomId) {
      set({ roomId: id, versionId: roomVersionOf(get(), id), selection: null, spawnTick: get().spawnTick + 1, spawnAt: spawnAt ?? null });
    }
    return true;
  },
  enterRoom: (id) => {
    if (id !== get().roomId) set({ roomId: id, versionId: roomVersionOf(get(), id) });
  },
  setVersion: (id, roomId) => {
    const { bundle } = get();
    const room = roomId ?? get().roomId;
    if (!bundle || !room || !bundle.versions[id]?.rooms.some((r) => r.id === room)) return false;
    const roomVersions = { ...get().roomVersions };
    if (id === baseVersionId(bundle)) delete roomVersions[room];
    else roomVersions[room] = id;
    if (roomVersions[room] === get().roomVersions[room]) return true;
    const house = composeHouse(bundle, roomVersions);
    const sel = get().selection;
    set({
      roomVersions,
      house,
      versionId: roomVersionOf({ bundle, roomVersions }, get().roomId),
      selection: sel && house && findById(house, sel.id) ? sel : null,
    });
    return true;
  },
  select: (selection) => set({ selection }),
  selectById: (id) => {
    const house = currentHouse(get());
    if (!house) return false;
    const found = findById(house, id);
    if (!found) return false;
    // one house: no teleport, the outline shows through walls
    set({ selection: { kind: found.kind, id, part: null } });
    return true;
  },
  toggleSection: (id, section) => {
    const key = `${id}#${section}`;
    const { itemStates } = get();
    const next = { ...itemStates };
    if (next[key] === 'open') delete next[key];
    else next[key] = 'open';
    set({ itemStates: next });
  },
  cycleState: (id, part) => {
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
    set({ itemStates: { ...itemStates, [id]: nextState(asset, current, part) } });
  },
  setLightMode: (lightMode) => set({ lightMode }),
  setPerson: (person) => set({ person }),
  setView: (view) => set({ view }),
  setTapSelects: (tapSelects) => set(tapSelects ? { tapSelects } : { tapSelects, selection: null }),
  setMood: (mood) => set({ mood }),
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

/** The house on screen (every room in its own chosen version). */
export function currentHouse(s: Pick<State, 'house'>): House | null {
  return s.house;
}

export function currentRoom(s: Pick<State, 'house' | 'roomId'>) {
  return currentHouse(s)?.rooms.find((r) => r.id === s.roomId) ?? null;
}

const layoutCache = new WeakMap<House, Layout>();
/** Where every room of the house on screen sits in house space (cached per house object). */
export function currentLayout(s: Pick<State, 'house'>): Layout | null {
  const house = currentHouse(s);
  if (!house) return null;
  let l = layoutCache.get(house);
  if (!l) {
    l = computeLayout(house);
    layoutCache.set(house, l);
  }
  return l;
}

/** House-space point -> coordinates of the active room (what the JSON uses). */
export function toRoomLocal(s: Pick<State, 'house' | 'roomId'>, p: Vec2): Vec2 {
  const pl = s.roomId ? currentLayout(s)?.placements[s.roomId] : undefined;
  return pl ? toLocal(p, pl) : p;
}

/** The player's pose in the active room's own coordinates (yaw too: rooms can be turned in the house). */
export function poseInRoom(s: Pick<State, 'house' | 'roomId' | 'camera'>): CameraPose {
  const pl = s.roomId ? currentLayout(s)?.placements[s.roomId] : undefined;
  if (!pl) return s.camera;
  const [x, z] = toLocal([s.camera.x, s.camera.z], pl);
  return { x, z, yaw: s.camera.yaw - pl.rotationDeg, pitch: s.camera.pitch };
}

/** A pose given in a room's own coordinates (e.g. a `cam=` link) -> house space. */
export function poseFromRoom(s: Pick<State, 'house'>, roomId: string | null, pose: CameraPose): CameraPose {
  const pl = roomId ? currentLayout(s)?.placements[roomId] : undefined;
  if (!pl) return pose;
  const [x, z] = toWorld([pose.x, pose.z], pl);
  return { x, z, yaw: pose.yaw + pl.rotationDeg, pitch: pose.pitch };
}
