import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { Box3, Raycaster, Vector2, type Material, type Mesh } from 'three';
import type { Vec3 } from '../model/schema';
import { oppositeFace } from '../model/measure';
import { currentMeasurement, formatCm, useMeasure, type MeasurePoint } from '../app/measureStore';
import { selectableFromHit } from './selectable';
import { ignoresKeys } from './input';

const CLICK_SLOP = 6;
const DOUBLE_CLICK_MS = 350;

/**
 * Measuring mode: click a surface, click another → distance along one axis. Double-clicking a surface moves
 * that point to the other side of the board (e.g. from the underside of a shelf top to its top, to measure
 * up to the ceiling). Clicks here never select or toggle furniture.
 */
export function Measure() {
  const { camera, scene, gl } = useThree();
  const active = useMeasure((s) => s.active);
  const points = useMeasure((s) => s.points);

  // points belong to one room (this component is keyed by room)
  useEffect(() => useMeasure.getState().reset(), []);

  // M toggles, Esc leaves
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (ignoresKeys(e.target as HTMLInputElement) || e.metaKey || e.ctrlKey) return;
      if (e.code === 'KeyM') useMeasure.getState().toggle();
      if (e.key === 'Escape') useMeasure.getState().stop();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  // capture-phase listeners on the viewer so the scene's own click/select handlers never see these clicks
  useEffect(() => {
    if (!active) return;
    const host = gl.domElement.closest('.viewer') as HTMLElement | null;
    if (!host) return;
    const raycaster = new Raycaster();
    const pick = (clientX: number, clientY: number): MeasurePoint | null => {
      const rect = gl.domElement.getBoundingClientRect();
      // mouse-look: aim with the crosshair
      const ndc = document.pointerLockElement === gl.domElement
        ? new Vector2(0, 0)
        : new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(scene.children, true).find((h) => {
        const m = (h.object as Mesh).material as Material | undefined;
        return h.object.visible && m?.colorWrite !== false && selectableFromHit(h.object);
      });
      if (!hit?.face) return null;
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      const target = selectableFromHit(hit.object);
      const surface = { point: [hit.point.x, hit.point.y, hit.point.z] as Vec3, normal: [n.x, n.y, n.z] as Vec3 };
      const b = new Box3().setFromObject(hit.object);
      return {
        ...surface,
        target,
        roomSurface: target?.kind === 'wall' || target?.kind === 'floor' || target?.kind === 'ceiling',
        other: oppositeFace(surface, { min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z] }),
      };
    };
    let down: { x: number; y: number } | null = null;
    let lastClick = { t: 0, x: 0, y: 0 };
    const swallow = (e: Event) => e.stopPropagation();
    const pdown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
      e.stopPropagation();
    };
    const pup = (e: PointerEvent) => {
      e.stopPropagation();
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > CLICK_SLOP) return;
      const now = performance.now();
      const isDouble = now - lastClick.t < DOUBLE_CLICK_MS && Math.hypot(e.clientX - lastClick.x, e.clientY - lastClick.y) < CLICK_SLOP;
      lastClick = { t: isDouble ? 0 : now, x: e.clientX, y: e.clientY };
      // the first click of a double-click already placed the point: the second one flips it
      if (isDouble) return useMeasure.getState().flipLast();
      const p = pick(e.clientX, e.clientY);
      if (p) useMeasure.getState().add(p);
    };
    host.addEventListener('pointerdown', pdown, true);
    host.addEventListener('pointerup', pup, true);
    host.addEventListener('click', swallow, true);
    host.addEventListener('dblclick', swallow, true);
    document.body.style.cursor = 'crosshair';
    return () => {
      host.removeEventListener('pointerdown', pdown, true);
      host.removeEventListener('pointerup', pup, true);
      host.removeEventListener('click', swallow, true);
      host.removeEventListener('dblclick', swallow, true);
      document.body.style.cursor = '';
    };
  }, [active, camera, scene, gl]);

  if (!active || points.length === 0) return null;
  const m = currentMeasurement(points);
  // the line runs along one axis: from the first point to the second surface's level
  const ends: Vec3[] = m ? [m.from, m.to] : [points[0].point];
  const mid: Vec3 | null = m ? [(m.from[0] + m.to[0]) / 2, (m.from[1] + m.to[1]) / 2, (m.from[2] + m.to[2]) / 2] : null;
  return (
    <group>
      {ends.map((p, i) => (
        <mesh key={i} position={p} renderOrder={999}>
          <sphereGeometry args={[2.5, 16, 12]} />
          <meshBasicMaterial color="#ffd400" depthTest={false} />
        </mesh>
      ))}
      {m && <Line points={[m.from, m.to]} color="#ffd400" lineWidth={3} depthTest={false} renderOrder={998} />}
      {m && mid && (
        <Html position={mid} center zIndexRange={[20, 10]}>
          <div className="measure-label">{formatCm(m.distance)}</div>
        </Html>
      )}
    </group>
  );
}
