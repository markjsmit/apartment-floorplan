import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Raycaster, Vector2 } from 'three';
import type { House, Vec2 } from '../model/schema';
import { polygonCentroid, resolveWalls } from '../model/geometry';
import { placeRoomItems } from '../model/placement';
import { isFree, moveWithCollision, nearestFree } from '../model/collision';
import { buildHouseColliders, resolveHousePosition, roomAt } from '../model/houseCollision';
import { toWorld, type Layout } from '../model/layout';
import { findById } from '../model/lookup';
import { EYE_HEIGHT, useStore } from '../app/store';
import { held, ignoresKeys, lookDelta, mouseLook, moveKeyFor, touchLook } from './input';
import { selectableFromHit } from './selectable';

const CENTER = new Vector2(0, 0);

const DEG = Math.PI / 180;
const WALK = 140; // cm/s
const TURN = 100; // deg/s
const PITCH = 70; // deg/s
const RADIUS = 20; // cm
const MAX_PITCH = 80;


/** Arrows walk and turn (old style); W/S walk, A/D step sideways (modern, look with the trackpad); E/C pitch;
 *  trackpad and touch drags look around; a middle click toggles mouse-look. Walks through the whole house (house coordinates): open doorways
 *  let you through, and the active room follows where you are. Always mounted; drives the camera only in
 *  first-person view. */
export function PlayerControls({ house, layout, driveCamera }: { house: House; layout: Layout; driveCamera: boolean }) {
  const { camera, gl, scene } = useThree();
  const bundle = useStore((s) => s.bundle);
  const itemStates = useStore((s) => s.itemStates);
  const person = useStore((s) => s.person);
  const spawnTick = useStore((s) => s.spawnTick);
  const lookAtTarget = useStore((s) => s.lookAtTarget);
  const pose = useRef({ ...useStore.getState().camera });
  const lastReport = useRef(0);

  const colliders = useMemo(
    () => buildHouseColliders(house, layout, bundle?.furniture ?? {}, itemStates),
    [house, layout, bundle, itemStates],
  );

  // spawn (tab click / first load): just inside the room's door looking in, else the room centre
  useEffect(() => {
    if (spawnTick === 0) return;
    const store = useStore.getState();
    const room = house.rooms.find((r) => r.id === store.roomId);
    if (!room) return;
    const pl = layout.placements[room.id];
    const footprint = room.footprint.map((q) => toWorld(q, pl));
    const walls = resolveWalls(room);
    const door = (store.spawnAt ? room.openings.find((o) => o.id === store.spawnAt) : undefined) ?? room.openings.find((o) => o.type === 'door');
    const w = door && walls.find((x) => x.id === door.wall);
    let p: Vec2 | null = null;
    let yaw = 0;
    if (door && w) {
      const u = door.offset + door.width / 2;
      p = toWorld([w.start[0] + w.dir[0] * u + w.inward[0] * 70, w.start[1] + w.dir[1] * u + w.inward[1] * 70], pl);
      const into = toWorld([w.start[0] + w.dir[0] * u + w.inward[0] * 170, w.start[1] + w.dir[1] * u + w.inward[1] * 170], pl);
      yaw = Math.atan2(-(into[0] - p[0]), -(into[1] - p[1])) / DEG;
      if (!isFree(p, RADIUS, colliders)) p = null;
    }
    if (!p) p = nearestFree(toWorld(polygonCentroid(room.footprint), pl), RADIUS, colliders, footprint);
    pose.current = { x: p[0], z: p[1], yaw, pitch: -8 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spawnTick]);

  // a door closed on you, furniture changed state, or a room changed shape: step back to a valid spot
  useEffect(() => {
    const p = pose.current;
    const [x, z] = resolveHousePosition([p.x, p.z], house, layout, colliders, RADIUS, useStore.getState().roomId);
    if (x !== p.x || z !== p.z) pose.current = { ...p, x, z };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colliders]);

  // Claude's "look-at": turn towards the thing's centre
  useEffect(() => {
    if (!lookAtTarget || !bundle) return;
    const f = findById(house, lookAtTarget.id);
    if (!f) return;
    const room = f.room;
    const pl = layout.placements[room.id];
    const walls = resolveWalls(room);
    let local: [number, number, number] | null = null;
    if (f.kind === 'item') {
      const placed = placeRoomItems(room, bundle.furniture, walls, itemStates).find((x) => x.item.id === f.item.id);
      if (placed) {
        const lx = (placed.size.min[0] + placed.size.max[0]) / 2;
        const lz = (placed.size.min[2] + placed.size.max[2]) / 2;
        const r = placed.rotationDeg * DEG;
        local = [placed.position[0] + lx * Math.cos(r) + lz * Math.sin(r), placed.position[1] + (placed.size.min[1] + placed.size.max[1]) / 2, placed.position[2] - lx * Math.sin(r) + lz * Math.cos(r)];
      }
    } else if (f.kind === 'opening') {
      const w = walls.find((x) => x.id === f.opening.wall);
      if (w) {
        const u = f.opening.offset + f.opening.width / 2;
        local = [w.start[0] + w.dir[0] * u, f.opening.sill + f.opening.height / 2, w.start[1] + w.dir[1] * u];
      }
    } else if (f.kind === 'wall') {
      const w = f.wall;
      local = [(w.start[0] + w.end[0]) / 2, room.ceilingHeight / 2, (w.start[1] + w.end[1]) / 2];
    }
    if (!local || !pl) return;
    const [tx, tz] = toWorld([local[0], local[2]], pl);
    const p = pose.current;
    const dx = tx - p.x;
    const dz = tz - p.z;
    const dy = local[1] - EYE_HEIGHT[useStore.getState().person];
    pose.current = { ...p, yaw: Math.atan2(-dx, -dz) / DEG, pitch: Math.atan2(dy, Math.hypot(dx, dz)) / DEG };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookAtTarget]);

  // keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (ignoresKeys(e.target as HTMLInputElement)) return;
      if (e.key === 'Escape') useStore.getState().select(null);
      const k = moveKeyFor(e);
      if (!k || e.metaKey || e.ctrlKey) return;
      held.add(k);
      // stops arrows from also moving a focused slider
      e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      const k = moveKeyFor(e);
      if (k) held.delete(k);
    };
    const blur = () => held.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // trackpad two-finger swipe + touch drag
  useEffect(() => {
    const el = gl.domElement;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) return; // pinch-zoom gesture
      lookDelta.yaw -= e.deltaX * 0.15;
      lookDelta.pitch -= e.deltaY * 0.15;
    };
    let last: { x: number; y: number; id: number } | null = null;
    // phones use the on-screen buttons only (no swipe-to-look)
    const phone = window.matchMedia('(pointer: coarse) and (max-width: 900px)').matches;
    const pdown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || phone) return;
      last = { x: e.clientX, y: e.clientY, id: e.pointerId };
    };
    const pmove = (e: PointerEvent) => {
      if (!last || e.pointerId !== last.id) return;
      const look = touchLook(e.clientX - last.x, e.clientY - last.y);
      lookDelta.yaw += look.yaw;
      lookDelta.pitch += look.pitch;
      last = { x: e.clientX, y: e.clientY, id: e.pointerId };
    };
    const pup = (e: PointerEvent) => {
      if (last && e.pointerId === last.id) last = null;
    };
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('pointerdown', pdown);
    window.addEventListener('pointermove', pmove);
    window.addEventListener('pointerup', pup);
    window.addEventListener('pointercancel', pup);
    return () => {
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('pointerdown', pdown);
      window.removeEventListener('pointermove', pmove);
      window.removeEventListener('pointerup', pup);
      window.removeEventListener('pointercancel', pup);
    };
  }, [gl]);

  // regular mouse: a middle click toggles mouse-look (pointer lock); clicks then aim with the crosshair, Esc also leaves
  useEffect(() => {
    const el = gl.domElement;
    const locked = () => document.pointerLockElement === el;
    const mdown = (e: MouseEvent) => {
      if (e.button !== 1) return;
      e.preventDefault(); // no auto-scroll
      if (locked()) document.exitPointerLock();
      else if (driveCamera) el.requestPointerLock();
    };
    const mmove = (e: MouseEvent) => {
      if (!locked()) return;
      const look = mouseLook(e.movementX, e.movementY);
      lookDelta.yaw += look.yaw;
      lookDelta.pitch += look.pitch;
    };
    const change = () => {
      if (locked()) useStore.getState().toast('Mouse look on — middle-click or Esc to stop.');
    };
    if (!driveCamera && locked()) document.exitPointerLock();
    el.addEventListener('mousedown', mdown);
    window.addEventListener('mousemove', mmove);
    document.addEventListener('pointerlockchange', change);
    return () => {
      el.removeEventListener('mousedown', mdown);
      window.removeEventListener('mousemove', mmove);
      document.removeEventListener('pointerlockchange', change);
    };
  }, [gl, driveCamera]);

  // what's under the crosshair (screen centre), so Mark can say "this" without clicking
  const raycaster = useMemo(() => new Raycaster(), []);
  const updateLookingAt = () => {
    const store = useStore.getState();
    if (!driveCamera) {
      if (store.lookingAt) store.setLookingAt(null);
      return;
    }
    raycaster.setFromCamera(CENTER, camera);
    const hit = raycaster.intersectObjects(scene.children, true).find((h) => h.object.visible && selectableFromHit(h.object));
    const sel = hit ? selectableFromHit(hit.object) : null;
    const next = hit && sel
      ? { ...sel, point: [Math.round(hit.point.x), Math.round(hit.point.y), Math.round(hit.point.z)] as [number, number, number], distance: Math.round(hit.distance) }
      : null;
    const prev = store.lookingAt;
    const moved = !prev || !next || prev.id !== next.id || prev.part !== next.part
      || Math.hypot(prev.point[0] - next.point[0], prev.point[1] - next.point[1], prev.point[2] - next.point[2]) > 5;
    if (moved) store.setLookingAt(next);
  };

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const p = pose.current;
    let yaw = p.yaw + lookDelta.yaw;
    let pitch = p.pitch + lookDelta.pitch;
    lookDelta.yaw = 0;
    lookDelta.pitch = 0;
    if (held.has('left')) yaw += TURN * dt;
    if (held.has('right')) yaw -= TURN * dt;
    if (held.has('up')) pitch += PITCH * dt;
    if (held.has('down')) pitch -= PITCH * dt;
    pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));

    let x = p.x;
    let z = p.z;
    const forward = (held.has('forward') ? 1 : 0) - (held.has('back') ? 1 : 0);
    const side = (held.has('strafeRight') ? 1 : 0) - (held.has('strafeLeft') ? 1 : 0);
    if (forward || side) {
      const s = Math.sin(yaw * DEG);
      const c = Math.cos(yaw * DEG);
      // forward is (-sin, -cos), right is (cos, -sin); diagonal isn't faster than straight
      let dx = -s * forward + c * side;
      let dz = -c * forward - s * side;
      const len = Math.hypot(dx, dz);
      dx = (dx / len) * WALK * dt;
      dz = (dz / len) * WALK * dt;
      [x, z] = moveWithCollision([x, z], [dx, dz], RADIUS, colliders);
      // walked into another room: it becomes the active one (tab, reports to Claude)
      const inside = roomAt([x, z], house, layout);
      if (inside) useStore.getState().enterRoom(inside);
    }
    pose.current = { x, z, yaw, pitch };

    if (driveCamera) {
      camera.position.set(x, EYE_HEIGHT[person], z);
      camera.rotation.set(pitch * DEG, yaw * DEG, 0, 'YXZ');
    }
    if (state.clock.elapsedTime - lastReport.current > 0.25) {
      lastReport.current = state.clock.elapsedTime;
      const c = useStore.getState().camera;
      if (Math.abs(c.x - x) > 1 || Math.abs(c.z - z) > 1 || Math.abs(c.yaw - yaw) > 1 || Math.abs(c.pitch - pitch) > 1) {
        useStore.getState().setCamera({ x, z, yaw, pitch });
      }
      updateLookingAt();
    }
  });

  return null;
}
