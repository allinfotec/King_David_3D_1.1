import { useRef, useEffect } from 'react';
import { RigidBody, RapierRigidBody, BallCollider } from '@react-three/rapier';
import { Trail } from '@react-three/drei';
import { useStore } from '../store';

interface StoneProps {
  id: string;
  position: [number, number, number];
  velocity: [number, number, number];
}

export function Stone({ id, position, velocity }: StoneProps) {
  const rigidBody = useRef<RapierRigidBody>(null);
  const removeStone = useStore((state) => state.removeStone);

  const addEffect = useStore((state) => state.addEffect);

  useEffect(() => {
    // Set initial velocity
    if (rigidBody.current) {
      rigidBody.current.setLinvel({ x: velocity[0], y: velocity[1], z: velocity[2] }, true);
    }

    // Despawn after 3 seconds
    const timer = setTimeout(() => {
      removeStone(id);
    }, 3000);

    return () => clearTimeout(timer);
  }, [id, velocity, removeStone]);

  return (
    <RigidBody
      ref={rigidBody}
      position={position}
      colliders={false} // Use custom collider
      restitution={0.5}
      ccd // Enable Continuous Collision Detection
      userData={{ type: 'stone', id }}
      onCollisionEnter={(e) => {
        // Check what we hit
        const isEnemy = e.other.rigidBodyObject?.userData?.type === 'enemy';
        
        if (rigidBody.current) {
           const pos = rigidBody.current.translation();
           
           if (isEnemy) {
               // Flesh hit sound
               const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/212/212-preview.mp3'); // Placeholder for flesh hit
               audio.volume = 0.4;
               audio.playbackRate = 0.8; // Lower pitch for flesh
               audio.play().catch(() => {});
               
               // Visuals
               addEffect([pos.x, pos.y, pos.z], 'flash');
               addEffect([pos.x, pos.y, pos.z], 'blood');
           } else {
               // Environment hit
               addEffect([pos.x, pos.y, pos.z], 'flash');
               addEffect([pos.x, pos.y, pos.z], 'impact');
               
               // Rock hit sound
               const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/212/212-preview.mp3'); // Placeholder for rock hit
               audio.volume = 0.3;
               audio.playbackRate = 1.2; // Higher pitch for rock
               audio.play().catch(() => {});
           }
        }

        if (isEnemy) {
          removeStone(id);
        }
      }}
    >
      <BallCollider args={[0.3]} /> {/* Larger collider for better hit detection */}
      <Trail
        width={0.15}
        length={12}
        color="#ffffff"
        attenuation={(t) => t * t}
      >
        <mesh castShadow>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color="#888" />
        </mesh>
      </Trail>
    </RigidBody>
  );
}
