import { useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { EffectComposer, N8AO, Outline } from '@react-three/postprocessing';
import { PCFSoftShadowMap, PerspectiveCamera, type Mesh, type Object3D } from 'three';
import { currentRoom, useStore } from '../app/store';
import { useIsMobile } from '../app/useIsMobile';
import { RoomView } from './RoomView';
import { Lighting } from './Lighting';
import { PlayerControls } from './PlayerControls';
import { TopDownCamera } from './TopDownCamera';
import { sceneObjects } from './registry';

declare global {
  interface Window { __sceneReady?: boolean }
}

function meshesOf(obj: Object3D | undefined): Mesh[] {
  const out: Mesh[] = [];
  obj?.traverse((o) => {
    if ((o as Mesh).isMesh && o.visible) out.push(o as Mesh);
  });
  return out;
}

function SelectionOutline() {
  const selection = useStore((s) => s.selection);
  const versionId = useStore((s) => s.versionId);
  const itemStates = useStore((s) => s.itemStates);
  // live reloads remount meshes (e.g. a Kallax going 2x2 -> 2x4), so re-collect them
  const bundle = useStore((s) => s.bundle);
  const [objs, setObjs] = useState<{ strong: Mesh[]; soft: Mesh[] }>({ strong: [], soft: [] });
  useEffect(() => {
    // wait a frame so freshly mounted objects have registered
    const t = requestAnimationFrame(() => {
      if (!selection) return setObjs({ strong: [], soft: [] });
      const whole = sceneObjects.get(selection.id);
      const part = selection.part ? sceneObjects.get(`${selection.id}#${selection.part}`) : undefined;
      const meshes = meshesOf(whole ?? part);
      const strong = selection.kind === 'item' || selection.kind === 'opening';
      setObjs(strong ? { strong: meshes, soft: [] } : { strong: [], soft: meshes });
    });
    return () => cancelAnimationFrame(t);
  }, [selection, versionId, itemStates, bundle]);
  return (
    <>
      <Outline selection={objs.strong} selectionLayer={10} visibleEdgeColor={0x39ff14} hiddenEdgeColor={0x1f8f0b} edgeStrength={10} blur={false} xRay />
      <Outline selection={objs.soft} selectionLayer={11} visibleEdgeColor={0x9fffb0} hiddenEdgeColor={0x9fffb0} edgeStrength={2.5} blur xRay={false} />
    </>
  );
}

/** Keep at least ~75° horizontal view on portrait phones (a fixed vertical fov feels like a keyhole there). */
function FovFit() {
  const camera = useThree((s) => s.camera);
  const aspect = useThree((s) => s.size.width / s.size.height);
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const minHorizontal = 75 * (Math.PI / 180);
    const vertical = (2 * Math.atan(Math.tan(minHorizontal / 2) / aspect) * 180) / Math.PI;
    camera.fov = Math.min(110, Math.max(70, vertical));
    camera.updateProjectionMatrix();
  }, [camera, aspect]);
  return null;
}

export function Viewer() {
  const room = useStore(currentRoom);
  const view = useStore((s) => s.view);
  const mobile = useIsMobile();
  const select = useStore((s) => s.select);
  const ao = !mobile && new URLSearchParams(location.search).get('ao') !== '0';

  useEffect(() => {
    if (!room) return;
    window.__sceneReady = false;
    const t = setTimeout(() => (window.__sceneReady = true), 1500);
    return () => clearTimeout(t);
  }, [room, view]);

  return (
    <div className="viewer">
      <Canvas
        shadows={{ type: PCFSoftShadowMap }}
        dpr={[1, mobile ? 1.5 : 2]}
        camera={{ fov: 70, near: 2, far: 30000, position: [0, 170, 0] }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => { gl.toneMappingExposure = 1.15; }}
        onPointerMissed={(e) => e.type === 'click' && select(null)}
      >
        <FovFit />
        {room && (
          <>
            <RoomView key={room.id} room={room} showCeiling={view === 'first-person'} />
            <Lighting room={room} mobile={mobile} />
            <PlayerControls room={room} driveCamera={view === 'first-person'} />
            {view === 'top-down' && <TopDownCamera room={room} />}
          </>
        )}
        <EffectComposer multisampling={mobile ? 0 : 4} autoClear={false}>
          {ao ? <N8AO aoRadius={40} distanceFalloff={1} intensity={2.2} quality="medium" halfRes /> : <></>}
          <SelectionOutline />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
