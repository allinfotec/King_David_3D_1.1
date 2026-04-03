import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store';

const LIFETIME = {
  impact: 600,
  blood: 800,
  smoke: 1500,
  flash: 300
};

function Impact({ position, createdAt, id, type }: { position: [number, number, number], createdAt: number, id: string, type: 'impact' | 'blood' | 'smoke' | 'flash' }) {
  const group = useRef<THREE.Group>(null);
  const removeEffect = useStore((state) => state.removeEffect);
  const lifetime = LIFETIME[type] || 500;
  
  // Random directions for particles
  const particles = useMemo(() => {
    let count = 20;
    if (type === 'flash') count = 8;
    if (type === 'blood') count = 30;
    if (type === 'smoke') count = 40;
    if (type === 'impact') count = 25;
    
    return new Array(count).fill(0).map(() => {
      let color = '#d7ccc8'; // Dust
      if (type === 'blood') {
        const reds = ['#8a0303', '#b71c1c', '#d32f2f', '#ff0000'];
        color = reds[Math.floor(Math.random() * reds.length)];
      }
      if (type === 'smoke') {
        const grays = ['#101010', '#212121', '#424242', '#616161'];
        color = grays[Math.floor(Math.random() * grays.length)];
      }
      if (type === 'flash') {
        const brights = ['#fff59d', '#ffffff', '#ffeb3b'];
        color = brights[Math.floor(Math.random() * brights.length)];
      }
      if (type === 'impact') {
        const sparks = ['#ffcc00', '#ff9900', '#ffffff', '#d7ccc8'];
        color = sparks[Math.floor(Math.random() * sparks.length)];
      }

      return {
        direction: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2 + (type === 'blood' ? 0.5 : (type === 'smoke' ? 1.5 : (type === 'flash' ? 0 : 1.5))), 
          (Math.random() - 0.5) * 2
        ).normalize(),
        speed: Math.random() * (type === 'impact' ? 8 : 5) + (type === 'blood' ? 3 : (type === 'smoke' ? 1 : (type === 'flash' ? 0.5 : 2))), 
        scale: Math.random() * (type === 'blood' ? 0.5 : (type === 'smoke' ? 3.0 : (type === 'flash' ? 4.0 : 1.5))) + 0.2, 
        color: color,
        rotation: new THREE.Vector3(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
        rotationSpeed: new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10)
      };
    });
  }, [type]);

  useFrame((state, delta) => {
    const { isPaused, health } = useStore.getState();
    if (isPaused || health <= 0) return;

    const age = Date.now() - createdAt;
    if (age > lifetime) {
      removeEffect(id);
      return;
    }

    if (group.current) {
      const progress = age / lifetime;
      const timeInSec = age / 1000;
      
      group.current.children.forEach((child, i) => {
        const p = particles[i];
        
        // Move particle
        const currentSpeed = p.speed * Math.max(0, 1 - progress * (type === 'impact' ? 2 : 1)); // Drag
        child.position.copy(p.direction).multiplyScalar(currentSpeed * timeInSec);
        
        // Gravity / Float
        if (type === 'blood') {
           child.position.y -= 15 * Math.pow(timeInSec, 2); // Heavy gravity
        } else if (type === 'smoke') {
           child.position.y += 2.5 * timeInSec; // Smoke rises faster
           child.position.x += Math.sin(timeInSec * 2 + i) * 0.5; // Swirl
           child.position.z += Math.cos(timeInSec * 2 + i) * 0.5;
        } else if (type === 'impact') {
           child.position.y -= 5 * Math.pow(timeInSec, 2); // Light gravity
        }
        
        // Scale
        let scale = p.scale * (1 - progress);
        if (type === 'smoke') scale = p.scale * (0.5 + progress * 1.5); // Smoke expands more
        if (type === 'flash') scale = p.scale * (1 - Math.pow(progress, 3)); // Flash shrinks fast
        child.scale.setScalar(Math.max(0.01, scale));
        
        // Rotation
        child.rotation.x += p.rotationSpeed.x * delta;
        child.rotation.y += p.rotationSpeed.y * delta;
        child.rotation.z += p.rotationSpeed.z * delta;
        
        // Fade out
        const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        if (material) {
          if (type === 'smoke') {
            material.opacity = (1 - progress) * 0.7;
          } else if (type === 'flash') {
            material.opacity = (1 - Math.pow(progress, 2));
          } else {
            material.opacity = 1 - progress;
          }
        }
      });
    }
  });

  return (
    <group ref={group} position={position}>
      {particles.map((p, i) => (
        <mesh key={i} rotation={[p.rotation.x, p.rotation.y, p.rotation.z]}>
          {type === 'blood' ? (
            <sphereGeometry args={[0.1, 4, 4]} />
          ) : type === 'smoke' ? (
            <dodecahedronGeometry args={[0.15, 1]} />
          ) : type === 'flash' ? (
            <icosahedronGeometry args={[0.2, 0]} />
          ) : (
            <boxGeometry args={[0.1, 0.1, 0.1]} />
          )}
          <meshBasicMaterial color={p.color} transparent opacity={0.8} depthWrite={false} />
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
