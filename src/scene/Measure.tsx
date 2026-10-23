import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { Raycaster, Vector2, type Material, type Mesh } from 'three';
import type { Vec3 } from '../model/schema';
import { currentMeasurement, formatCm, useMeasure } from '../app/measureStore';
import { selectableFromHit } from './selectable';

const CLICK_SLOP = 6;

/** Measuring mode: clicks pick surface points (and don't select or toggle furniture); draws the result. */
export function Measure() {
  const { camera, scene, gl } = useThree();
  const active = useMeasure((s) => s.active);
  const points = useMeasure((s) => s.points);

  // points belong to one room (this component is keyed by room)
  useEffect(() => useMeasure.getState().reset(), []);

  // M toggles, Esc leaves
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || e.metaKey || e.ctrlKey) return;
      if (e.key === 'm' || e.key === 'M') useMeasure.getState().toggle();
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
    let down: { x: number; y: number } | null = null;
    const swallow = (e: Event) => e.stopPropagation();
    const pdown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
      e.stopPropagation();
    };
    const pup = (e: PointerEvent) => {
      e.stopPropagation();
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > CLICK_SLOP) return;
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(scene.children, true).find((h) => {
        const m = (h.object as Mesh).material as Material | undefined;
        return h.object.visible && m?.colorWrite !== false && selectableFromHit(h.object);
      });
      if (!hit?.face) return;
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      useMeasure.getState().add({
        point: [hit.point.x, hit.point.y, hit.point.z],
        normal: [n.x, n.y, n.z],
        target: selectableFromHit(hit.object),
      });
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
