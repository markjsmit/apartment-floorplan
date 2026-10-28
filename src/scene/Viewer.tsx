import { useEffect, useMemo, useState } from 'react';
import { Canvas, events as pointerEvents, useThree, type RootState } from '@react-three/fiber';
import { EffectComposer, N8AO, Outline, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { PCFSoftShadowMap, PerspectiveCamera, type Mesh, type Object3D } from 'three';
import { currentHouse, currentLayout, useStore } from '../app/store';
import { houseFrame } from '../model/layout';
import { useIsMobile } from '../app/useIsMobile';
import { RoomView } from './RoomView';
import { Lighting } from './Lighting';
import { PlayerControls } from './PlayerControls';
import { TopDownCamera } from './TopDownCamera';
import { Measure } from './Measure';
import { sceneObjects } from './registry';

declare global {
  interface Window { __sceneReady?: boolean; __renderer?: unknown }
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
      // a section (or part) of a big piece: just its meshes
      const inSection = selection.part && whole
        ? meshesOf(whole).filter((m) => (m.userData.selectable as { part?: string } | undefined)?.part === selection.part)
        : [];
      const meshes = inSection.length ? inSection : meshesOf(part ?? whole);
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

/** In mouse-look (pointer lock) the cursor is hidden: clicks hit what's under the crosshair (screen centre). */
const crosshairEvents: typeof pointerEvents = (store) => {
  const base = pointerEvents(store);
  return {
    ...base,
    compute(event, state: RootState) {
      if (document.pointerLockElement !== state.gl.domElement) return base.compute?.(event, state);
      state.pointer.set(0, 0);
      state.raycaster.setFromCamera(state.pointer, state.camera);
    },
  };
};

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
  const house = useStore(currentHouse);
  const layout = useStore(currentLayout);
  const frame = useMemo(() => (house && layout ? houseFrame(house, layout) : null), [house, layout]);
  const versionId = useStore((s) => s.versionId);
  const view = useStore((s) => s.view);
  const mobile = useIsMobile();
  const select = useStore((s) => s.select);
  const ao = !mobile && new URLSearchParams(location.search).get('ao') !== '0';

  useEffect(() => {
    if (!house) return;
    window.__sceneReady = false;
    const t = setTimeout(() => (window.__sceneReady = true), 1500);
    return () => clearTimeout(t);
  }, [house, view]);

  return (
    <div className="viewer">
      <Canvas
        shadows={{ type: PCFSoftShadowMap }}
        dpr={[1, mobile ? 1.5 : 2]}
        camera={{ fov: 70, near: 2, far: 30000, position: [0, 170, 0] }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          // dev only: lets tools read renderer.info (draw calls, textures) for the phone performance check
          if (import.meta.env.DEV) window.__renderer = gl;
        }}
        events={crosshairEvents}
        onPointerMissed={(e) => e.type === 'click' && select(null)}
      >
        <FovFit />
        {house && layout && frame && (
          <>
            {/* the whole house in one space: every room at its placement */}
            {house.rooms.map((r) => (
              <RoomView key={r.id} room={r} placement={layout.placements[r.id]} hiddenAssets={layout.hiddenAssets} showCeiling={view === 'first-person'} shade={ao ? 0.2 : 0.34} />
            ))}
            <Lighting room={frame} mobile={mobile} />
            <PlayerControls house={house} layout={layout} driveCamera={view === 'first-person'} />
            <Measure key={`measure-${versionId}`} />
            {view === 'top-down' && <TopDownCamera room={frame} />}
          </>
        )}
        <EffectComposer multisampling={mobile ? 0 : 4} autoClear={false}>
          {ao ? <N8AO aoRadius={40} distanceFalloff={1} intensity={2.2} quality="medium" halfRes /> : <></>}
          <SelectionOutline />
          {/* the composer switches the renderer's own tone mapping off, so it happens here: Khronos PBR Neutral keeps
              white walls white and colours true (ACES/AgX grey and shift them) */}
          <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
