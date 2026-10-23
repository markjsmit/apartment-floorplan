import { useEffect } from 'react';
import { OrthographicCamera } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type { Room } from '../model/schema';
import { roomBounds } from '../model/geometry';
import { useStore } from '../app/store';

const DEG = Math.PI / 180;

/** Plan view from above, north (-z) up, with a marker for where you're standing. */
export function TopDownCamera({ room }: { room: Room }) {
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera);
  const cam = useStore((s) => s.camera);
  const b = roomBounds(room);
  const w = b.maxX - b.minX;
  const d = b.maxZ - b.minZ;
  const zoom = Math.min(size.width / (w * 1.25), (size.height - 140) / (d * 1.25));

  useEffect(() => {
    camera.up.set(0, 0, -1);
    camera.lookAt((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
  }, [camera, b.minX, b.maxX, b.minZ, b.maxZ]);

  return (
    <>
      <OrthographicCamera makeDefault position={[(b.minX + b.maxX) / 2, 3000, (b.minZ + b.maxZ) / 2]} zoom={zoom} near={1} far={10000} up={[0, 0, -1]} />
      <group position={[cam.x, 2, cam.z]} rotation={[0, cam.yaw * DEG, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[20, 24]} />
          <meshBasicMaterial color="#39ff14" />
        </mesh>
        <mesh position={[0, 1, -30]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[12, 30, 3]} />
          <meshBasicMaterial color="#39ff14" />
        </mesh>
      </group>
    </>
  );
}
