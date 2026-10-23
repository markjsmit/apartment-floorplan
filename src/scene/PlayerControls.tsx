import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Room, Vec2 } from '../model/schema';
import { resolveWalls } from '../model/geometry';
import { placeRoomItems } from '../model/placement';
import { buildColliders, findFreeSpawn, isFree, moveWithCollision, resolvePlayerPosition } from '../model/collision';
import { findById } from '../model/lookup';
import { currentHouse, EYE_HEIGHT, useStore } from '../app/store';
import { held, lookDelta, type MoveKey } from './input';

const DEG = Math.PI / 180;
const WALK = 140; // cm/s
const TURN = 100; // deg/s
const PITCH = 70; // deg/s
const RADIUS = 20; // cm
const MAX_PITCH = 80;

const KEYS: Record<string, MoveKey> = {
  ArrowUp: 'forward', ArrowDown: 'back', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'forward', W: 'forward', s: 'back', S: 'back',
  a: 'left', A: 'left', d: 'right', D: 'right', e: 'up', E: 'up', c: 'down', C: 'down',
};

/** Doom-style walking: arrows or W/S/A/D move/turn, E/C pitch, trackpad and touch drags look around. Always mounted;
 *  drives the camera only in first-person view. */
export function PlayerControls({ room, driveCamera }: { room: Room; driveCamera: boolean }) {
  const { camera, gl } = useThree();
  const bundle = useStore((s) => s.bundle);
  const itemStates = useStore((s) => s.itemStates);
  const person = useStore((s) => s.person);
  const spawnTick = useStore((s) => s.spawnTick);
  const lookAtTarget = useStore((s) => s.lookAtTarget);
  const pose = useRef({ ...useStore.getState().camera });
  const lastReport = useRef(0);

  const walls = useMemo(() => resolveWalls(room), [room]);
  const colliders = useMemo(() => {
    const placed = bundle ? placeRoomItems(room, bundle.furniture, walls, itemStates) : [];
    return buildColliders(walls, placed.map((p) => ({ position: p.position, rotationDeg: p.rotationDeg, min: p.size.min, max: p.size.max })));
  }, [room, bundle, walls, itemStates]);

  // spawn: just inside the door looking in, else the room centre
  useEffect(() => {
    if (spawnTick === 0) return;
    const door = room.openings.find((o) => o.type === 'door');
    const w = door && walls.find((x) => x.id === door.wall);
    let p: Vec2 | null = null;
    let yaw = 0;
    if (door && w) {
      const u = door.offset + door.width / 2;
      p = [w.start[0] + w.dir[0] * u + w.inward[0] * 70, w.start[1] + w.dir[1] * u + w.inward[1] * 70];
      yaw = Math.atan2(-w.inward[0], -w.inward[1]) / DEG;
      if (!isFree(p, RADIUS, colliders)) p = null;
    }
    if (!p) p = findFreeSpawn(room, colliders, RADIUS);
    pose.current = { x: p[0], z: p[1], yaw, pitch: -8 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spawnTick]);

  // furniture changed state (bed folds down on you) or the room changed shape: step back to a valid spot
  useEffect(() => {
    const p = pose.current;
    const [x, z] = resolvePlayerPosition([p.x, p.z], room, colliders, RADIUS);
    if (x !== p.x || z !== p.z) pose.current = { ...p, x, z };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colliders, room.footprint]);

  // Claude's "look-at": turn towards the item's centre
  useEffect(() => {
    if (!lookAtTarget || !bundle) return;
    const house = currentHouse(useStore.getState());
    const f = house && findById(house, lookAtTarget.id);
    if (!f || f.roomId !== room.id) return;
    let target: [number, number, number] | null = null;
    if (f.kind === 'item') {
      const placed = placeRoomItems(room, bundle.furniture, walls, itemStates).find((x) => x.item.id === f.item.id);
      if (placed) {
        const lx = (placed.size.min[0] + placed.size.max[0]) / 2;
        const lz = (placed.size.min[2] + placed.size.max[2]) / 2;
        const r = placed.rotationDeg * DEG;
        target = [placed.position[0] + lx * Math.cos(r) + lz * Math.sin(r), placed.position[1] + (placed.size.min[1] + placed.size.max[1]) / 2, placed.position[2] - lx * Math.sin(r) + lz * Math.cos(r)];
      }
    } else if (f.kind === 'opening') {
      const w = walls.find((x) => x.id === f.opening.wall);
      if (w) {
        const u = f.opening.offset + f.opening.width / 2;
        target = [w.start[0] + w.dir[0] * u, f.opening.sill + f.opening.height / 2, w.start[1] + w.dir[1] * u];
      }
    } else if (f.kind === 'wall') {
      const w = f.wall;
      target = [(w.start[0] + w.end[0]) / 2, room.ceilingHeight / 2, (w.start[1] + w.end[1]) / 2];
    }
    if (!target) return;
    const p = pose.current;
    const dx = target[0] - p.x;
    const dz = target[2] - p.z;
    const dy = target[1] - EYE_HEIGHT[useStore.getState().person];
    pose.current = { ...p, yaw: Math.atan2(-dx, -dz) / DEG, pitch: Math.atan2(dy, Math.hypot(dx, dz)) / DEG };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookAtTarget]);

  // keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') useStore.getState().select(null);
      const k = KEYS[e.key];
      if (!k || e.metaKey || e.ctrlKey) return;
      held.add(k);
      e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      const k = KEYS[e.key];
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
    const pdown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      last = { x: e.clientX, y: e.clientY, id: e.pointerId };
    };
    const pmove = (e: PointerEvent) => {
      if (!last || e.pointerId !== last.id) return;
      lookDelta.yaw += (e.clientX - last.x) * 0.25;
      lookDelta.pitch += (e.clientY - last.y) * 0.25;
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
    if (forward) {
      const fx = -Math.sin(yaw * DEG);
      const fz = -Math.cos(yaw * DEG);
      [x, z] = moveWithCollision([x, z], [fx * WALK * dt * forward, fz * WALK * dt * forward], RADIUS, colliders);
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
    }
  });

  return null;
}
