import { useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Euler, Quaternion, Vector3, type Mesh } from 'three';
import type { FurnitureAsset, Part, Vec3 } from '../model/schema';
import { findState, interactivePart, partTransform } from '../model/assets';
import { useStore } from '../app/store';
import type { SelectionKind } from '../model/lookup';
import { partGeometry } from './cmGeometry';
import { getMaterial } from './materials';
import { registerObject } from './registry';

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
};

/** A placed asset (furniture item or door/window): parts animate between states; click selects, double-click cycles. */
export function PartsView({ id, kind, asset, parts, stateId, position, rotationDeg, selectWhole }: Props) {
  const select = useStore((s) => s.select);
  const cycleState = useStore((s) => s.cycleState);
  const state = findState(asset, stateId);

  const onClick = (part: string) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > CLICK_SLOP) return;
    select({ kind, id, part });
  };
  const onDoubleClick = (part: string) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (interactivePart(asset, part)) cycleState(id);
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
          interactive={interactivePart(asset, p.id)}
          registerAsPart={!selectWhole}
          onClick={onClick(p.id)}
          onDoubleClick={onDoubleClick(p.id)}
        />
      ))}
    </group>
  );
}

function PartMesh({ ownerId, kind, part, pose, interactive, registerAsPart, onClick, onDoubleClick }: {
  ownerId: string;
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
  const material = getMaterial(bundle, part.material ?? (part.glass ? 'glass' : undefined), part.color, part.glass);
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
    />
  );
}
