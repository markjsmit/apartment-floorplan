import { useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { Color, Euler, Quaternion, Vector3, type Material, type Mesh, type MeshStandardMaterial } from 'three';
import type { FurnitureAsset, Part, Vec3 } from '../model/schema';
import { findState, interactivePart, partTransform } from '../model/assets';
import { useStore } from '../app/store';
import type { SelectionKind } from '../model/lookup';
import { partGeometry } from './cmGeometry';
import { getMaterial } from './materials';
import { registerObject } from './registry';
import { clickAction, isPhone } from './clickAction';
import labelFont from '../../assets/fonts/inter-latin-600-normal.woff?url';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

RectAreaLightUniformsLib.init();

const DEG = Math.PI / 180;
// Pointer moves bigger than this (px) between down and up are drags (looking around), not clicks.
const CLICK_SLOP = 6;

type Props = {
  id: string;
  kind: SelectionKind;
  asset: FurnitureAsset;
  parts: Part[];
  stateId: string;
  position: Vec3;
  rotationDeg: number;
  selectWhole: boolean;
  /** the lights of the room it stands in: lamp parts glow, and double-clicking one switches the room's lights */
  roomId: string;
  lightsOn: boolean;
  /** daylight reaching the room (see roomDaylight) */
  daylight: number;
};

/** A placed asset (furniture item or door/window): parts animate between states; click selects, double-click cycles. */
export function PartsView({ id, kind, asset, parts, stateId, position, rotationDeg, selectWhole, roomId, lightsOn, daylight }: Props) {
  const select = useStore((s) => s.select);
  const cycleState = useStore((s) => s.cycleState);
  const toggleRoomLights = useStore((s) => s.toggleRoomLights);
  const state = findState(asset, stateId);
  const lamp = (part: string) => !!parts.find((p) => p.id === part)?.emit;
  // a lamp's glowing part is a light switch; anything else with an interaction changes state
  const act = (part: string) => (lamp(part) ? toggleRoomLights(lightsOn, roomId) : cycleState(id));
  const interactive = (part: string) => interactivePart(asset, part) || lamp(part);

  const onClick = (part: string) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > CLICK_SLOP) return;
    const action = clickAction({ phone: isPhone(), interactive: interactive(part) });
    if (action === 'select') select({ kind, id, part });
    if (action === 'cycle') act(part);
  };
  const onDoubleClick = (part: string) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // phones already changed state on the first tap
    if (!isPhone() && interactive(part)) act(part);
  };

  return (
    <group ref={selectWhole ? registerObject(id) : undefined} position={position} rotation={[0, rotationDeg * DEG, 0]}>
      {parts.map((p) => (
        <PartMesh
          key={p.id}
          ownerId={id}
          kind={kind}
          part={p}
          pose={partTransform(p, state?.parts[p.id])}
          interactive={interactive(p.id)}
          lightsOn={lightsOn}
          daylight={daylight}
          registerAsPart={!selectWhole}
          onClick={onClick(p.id)}
          onDoubleClick={onDoubleClick(p.id)}
        />
      ))}
    </group>
  );
}

function PartMesh({ ownerId, kind, part, pose, interactive, lightsOn, daylight, registerAsPart, onClick, onDoubleClick }: {
  ownerId: string;
  lightsOn: boolean;
  daylight: number;
  kind: SelectionKind;
  part: Part;
  pose: ReturnType<typeof partTransform>;
  interactive: boolean;
  registerAsPart: boolean;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  onDoubleClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const bundle = useStore((s) => s.bundle);
  const ref = useRef<Mesh | null>(null);
  const target = useRef({ pos: new Vector3(), quat: new Quaternion() });
  target.current.pos.set(...pose.position);
  target.current.quat.setFromEuler(new Euler(pose.rotationDeg[0] * DEG, pose.rotationDeg[1] * DEG, pose.rotationDeg[2] * DEG));
  const initialised = useRef(false);

  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    if (!initialised.current) {
      m.position.copy(target.current.pos);
      m.quaternion.copy(target.current.quat);
      initialised.current = true;
      return;
    }
    // ease towards the state's pose (~250 ms)
    const k = 1 - Math.exp(-dt * 14);
    m.position.lerp(target.current.pos, k);
    m.quaternion.slerp(target.current.quat, k);
  });

  if (!part.geometry) return null;
  const base = getMaterial(bundle, part.material ?? (part.glass ? 'glass' : undefined), part.color, part.glass, daylight);
  const material = part.emit ? emissive(base, part.emit.color, lightsOn) : base;
  return (
    <mesh
      ref={(m) => {
        ref.current = m;
        if (registerAsPart) registerObject(`${ownerId}#${part.id}`)(m);
      }}
      geometry={partGeometry(part.geometry)}
      material={material}
      visible={pose.visible}
      castShadow={part.castShadow && !part.glass}
      receiveShadow={!part.glass}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onPointerOver={interactive ? (e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; } : undefined}
      onPointerOut={interactive ? () => { document.body.style.cursor = ''; } : undefined}
      userData={{ selectable: { kind, id: ownerId, part: part.id } }}
    >
      {part.label && <Label label={part.label} faceZ={faceDepth(part) / 2} />}
      {/* point lamps are lit by the room's light pool (Lighting / RoomLamps), not here */}
      {part.emit && part.emit.kind === 'area' && part.geometry.type === 'box' && (
        // soft light out of the bottom face (a rect area light shines along its -z; -90° about x points that down);
        // always mounted, dark when off: a changing number of lights would recompile every shader
        <rectAreaLight
          args={[part.emit.color, 0, part.geometry.size[0], part.geometry.size[2]]}
          intensity={lightsOn ? part.emit.intensity : 0}
          position={[0, -part.geometry.size[1] / 2 - 0.05, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
      )}
    </mesh>
  );
}

const noRaycast = () => null;

const emissiveCache = new Map<string, Material>();

/** Same material, glowing in `color` while the lights are on. */
function emissive(base: Material, color: string, on: boolean): Material {
  const key = `${base.uuid}|${color}|${on}`;
  let m = emissiveCache.get(key);
  if (!m) {
    const glow = (base as MeshStandardMaterial).clone();
    glow.emissive = new Color(on ? color : '#000000');
    glow.emissiveIntensity = on ? 2.2 : 0;
    m = glow;
    emissiveCache.set(key, m);
  }
  return m;
}

function faceDepth(part: Part): number {
  const g = part.geometry;
  return g?.type === 'box' ? g.size[2] : g?.type === 'cylinder' ? g.radius * 2 : 0;
}

/** Paper tag with text on the part's front face; a child of the part, so it moves with drawers and doors. */
function Label({ label, faceZ }: { label: NonNullable<Part['label']>; faceZ: number }) {
  const { text, size, offset, color } = label;
  const w = Math.max(size * 3, text.length * size * 0.58 + size);
  return (
    <group position={[offset[0], offset[1], faceZ]}>
      <mesh position={[0, 0, 0.03]} raycast={noRaycast}>
        <planeGeometry args={[w, size * 1.7]} />
        <meshStandardMaterial color="#f7f4ea" roughness={0.9} />
      </mesh>
      <Text position={[0, 0, 0.06]} fontSize={size} font={labelFont} color={color} anchorX="center" anchorY="middle" raycast={noRaycast}>
        {text}
      </Text>
    </group>
  );
}
