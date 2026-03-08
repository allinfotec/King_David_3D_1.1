import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store';

const PARTICLE_COUNT = 8;
const LIFETIME = 500; // ms

function Impact({ position, createdAt, id, type }: { position: [number, number, number], createdAt: number, id: string, type: 'impact' | 'blood' | 'smoke' | 'flash' }) {
  const group = useRef<THREE.Group>(null);
  const removeEffect = useStore((state) => state.removeEffect);
  
  // Random directions for particles
  const particles = useMemo(() => {
    let color = '#d7ccc8'; // Dust
    if (type === 'blood') color = '#8a0303';
    if (type === 'smoke') color = '#101010'; // Very dark smoke
    if (type === 'flash') color = '#fff59d'; // Bright flash

    const count = type === 'flash' ? 6 : (type === 'blood' ? 20 : (type === 'smoke' ? 30 : 20)); 
    
    return new Array(count).fill(0).map(() => ({
      direction: new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2 + (type === 'blood' ? 0.5 : (type === 'smoke' ? 1 : (type === 'flash' ? 0 : 1.5))), 
        (Math.random() - 0.5) * 2
      ).normalize(),
      speed: Math.random() * 5 + (type === 'blood' ? 2 : (type === 'smoke' ? 1 : (type === 'flash' ? 0.5 : 2))), 
      scale: Math.random() * (type === 'blood' ? 0.4 : (type === 'smoke' ? 2.5 : (type === 'flash' ? 3.0 : 1.0))) + 0.2, 
      color: color,
      rotation: Math.random() * Math.PI
    }));
  }, [type]);

  useFrame(() => {
    const age = Date.now() - createdAt;
    if (age > LIFETIME) {
      removeEffect(id);
      return;
    }

    if (group.current) {
      const progress = age / LIFETIME;
      
      group.current.children.forEach((child, i) => {
        const p = particles[i];
        // Move particle
        child.position.copy(p.direction).multiplyScalar(p.speed * (age / 1000));
        
        // Gravity / Float
        if (type === 'blood') {
           child.position.y -= 9.8 * Math.pow(age / 1000, 2);
        } else if (type === 'smoke') {
           child.position.y += 1.5 * (age / 1000); // Smoke rises
        } else if (type === 'flash') {
           // No movement, just expand
        } else {
           child.position.y += 0.5 * (age / 1000); // Dust floats
        }
        
        // Scale
        let scale = p.scale * (1 - progress);
        if (type === 'smoke') scale = p.scale * (0.5 + progress); // Smoke expands
        if (type === 'flash') scale = p.scale * (1 - progress * 0.5); // Flash shrinks slightly or stays big
        child.scale.setScalar(scale);
        
        // Rotation
        child.rotation.x += 0.1;
        child.rotation.z += 0.1;
        
        // Fade out
        const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        if (material) {
          material.opacity = (1 - progress) * (type === 'smoke' ? 0.6 : (type === 'flash' ? 0.9 : 0.8));
        }
      });
    }
  });

  return (
    <group ref={group} position={position}>
      {particles.map((p, i) => (
        <mesh key={i} rotation={[p.rotation, p.rotation, p.rotation]}>
          <dodecahedronGeometry args={[0.1, 0]} />
          <meshBasicMaterial color={p.color} transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
}

export function Effects() {
  const effects = useStore((state) => state.effects);

  return (
    <>
      {effects.map((effect) => (
        <Impact key={effect.id} {...effect} />
      ))}
    </>
  );
}
