import { RigidBody } from '@react-three/rapier';
import { useTexture, Instance, Instances, Float, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useMemo, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { playerRef } from './Player';

function Samuel({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Name Tag */}
      <Text
        position={[0, 4.5, 0]}
        fontSize={0.5}
        color="#ffd700"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="#000000"
      >
        Profeta Samuel
      </Text>
      {/* Body - Robe */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.6, 3, 16]} />
        <meshStandardMaterial color="#5c3a21" roughness={0.9} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 3.3, 0]} castShadow>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial color="#d2b48c" roughness={0.6} />
      </mesh>
      {/* Beard */}
      <mesh position={[0, 3.1, 0.25]} castShadow>
        <coneGeometry args={[0.25, 0.6, 8]} />
        <meshStandardMaterial color="#eeeeee" roughness={0.9} />
      </mesh>
      {/* Staff */}
      <mesh position={[0.6, 1.5, 0.4]} rotation={[0, 0, -0.1]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 3.5, 8]} />
        <meshStandardMaterial color="#3e2723" roughness={0.9} />
      </mesh>
      {/* Horn of Oil */}
      <mesh position={[-0.5, 2, 0.4]} rotation={[0, 0, 0.5]} castShadow>
        <coneGeometry args={[0.1, 0.4, 8]} />
        <meshStandardMaterial color="#ffd700" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Glowing aura */}
      <pointLight position={[0, 2, 0]} intensity={2} color="#ffd700" distance={10} />
    </group>
  );
}

function Passage() {
  const isWalkingHome = useStore((state) => state.isWalkingHome);
  const finishGame = useStore((state) => state.finishGame);
  const startAnointing = useStore((state) => state.startAnointing);
  const isAnointing = useStore((state) => state.isAnointing);
  const arrowRef = useRef<THREE.Group>(null);
  const smallArrowRef = useRef<THREE.Group>(null);
  const isFinishing = useRef(false);

  useFrame((state) => {
    if (!isWalkingHome) return;

    // Animate giant floating arrow
    if (arrowRef.current) {
      arrowRef.current.position.y = 15 + Math.sin(state.clock.elapsedTime * 3) * 2;
      arrowRef.current.rotation.y = state.clock.elapsedTime;
    }

    // Update small arrow to be in front of the player and point to the passage
    if (smallArrowRef.current) {
      if (playerRef.current && !isAnointing) {
        smallArrowRef.current.visible = true;
        const pos = playerRef.current.translation();
        
        // Target is the passage at [0, 0, -90]
        const target = new THREE.Vector3(0, pos.y, -90);
        const playerPos = new THREE.Vector3(pos.x, pos.y, pos.z);
        
        // Direction from player to passage
        const dir = new THREE.Vector3().subVectors(target, playerPos).normalize();
        
        // Place small arrow 3 units in front of the player
        smallArrowRef.current.position.copy(playerPos).add(dir.multiplyScalar(3));
        smallArrowRef.current.position.y += 1.5 + Math.sin(state.clock.elapsedTime * 5) * 0.2; // Floating effect
        
        // Make it point to the passage
        smallArrowRef.current.lookAt(target);
      } else {
        smallArrowRef.current.visible = false;
      }
    }

    // Check player position
    if (playerRef.current && !isFinishing.current) {
      const pos = playerRef.current.translation();
      // If player is close to the passage
      if (pos.z < -70 && pos.x > -30 && pos.x < 30) {
        if (!isAnointing) {
          startAnointing();
          setTimeout(() => {
            isFinishing.current = true;
            document.exitPointerLock();
            finishGame();
          }, 4000); // Wait 4 seconds for the anointing animation
        }
      }
    }
  });

  if (!isWalkingHome) return null;

  return (
    <>
      {/* Small Floating Arrow near the player */}
      <group ref={smallArrowRef}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.3, 1, 8]} />
          <meshStandardMaterial color="#ffff00" emissive="#ffff00" emissiveIntensity={2} transparent opacity={0.8} />
        </mesh>
        <pointLight intensity={2} color="#ffff00" distance={5} />
      </group>

      {/* The Passage at the back */}
      <group position={[0, -2, -90]}>
        {/* Prophet Samuel waiting */}
        <Samuel position={[0, 0, 5]} />

        {/* Passage Rocks */}
        <Rock position={[-15, 0, 0]} scale={8} />
        <Rock position={[15, 0, 0]} scale={8} />
        <Rock position={[-25, 0, 5]} scale={6} />
        <Rock position={[25, 0, 5]} scale={6} />
        <Rock position={[-35, 0, 10]} scale={5} />
        <Rock position={[35, 0, 10]} scale={5} />
        
        {/* Glowing Path */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 10]}>
          <planeGeometry args={[20, 40]} />
          <meshBasicMaterial color="#ffffaa" transparent opacity={0.3} />
        </mesh>

        {/* Giant Floating Arrow */}
        <group ref={arrowRef} position={[0, 15, 0]}>
          <mesh rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[4, 8, 4]} />
            <meshStandardMaterial color="#ffff00" emissive="#ffff00" emissiveIntensity={2} />
          </mesh>
          <pointLight position={[0, -5, 0]} intensity={5} color="#ffff00" distance={50} />
        </group>
      </group>
    </>
  );
}

function Tree({ position, scale = 1, type = 'normal' }: { position: [number, number, number], scale?: number, type?: 'normal' | 'dead' }) {
  const isDead = type === 'dead';
  const lean = useMemo(() => (Math.random() - 0.5) * 0.2, []);
  
  return (
    <group position={position} scale={scale} rotation={[lean, Math.random() * Math.PI, lean]}>
      {/* Trunk - Twisted and textured look via geometry */}
      <RigidBody type="fixed" colliders="hull">
        <mesh castShadow receiveShadow position={[0, 1.5, 0]}>
          <cylinderGeometry args={[0.25, 0.4, 3, 7]} />
          <meshPhysicalMaterial color={isDead ? "#4e342e" : "#3e2723"} roughness={0.9} />
        </mesh>
      </RigidBody>
      
      {/* Branches - More complex structure */}
      <group position={[0, 3, 0]}>
        <mesh castShadow receiveShadow rotation={[0.5, 0, 0]} position={[0, 0.5, 0.2]}>
          <cylinderGeometry args={[0.1, 0.2, 1.5, 5]} />
          <meshPhysicalMaterial color={isDead ? "#4e342e" : "#3e2723"} />
        </mesh>
        <mesh castShadow receiveShadow rotation={[-0.4, 0.4, 0]} position={[-0.5, 0.2, -0.2]}>
          <cylinderGeometry args={[0.08, 0.18, 1.4, 5]} />
          <meshPhysicalMaterial color={isDead ? "#4e342e" : "#3e2723"} />
        </mesh>
        <mesh castShadow receiveShadow rotation={[0.2, -0.5, 0.3]} position={[0.5, 0.4, 0]}>
          <cylinderGeometry args={[0.09, 0.15, 1.3, 5]} />
          <meshPhysicalMaterial color={isDead ? "#4e342e" : "#3e2723"} />
        </mesh>
      </group>

       {/* Foliage - Clusters for better volume (Only if not dead) */}
       {!isDead && (
        <group position={[0, 4, 0]}>
            <mesh castShadow receiveShadow position={[0, 0, 0]} scale={1.2}>
            <dodecahedronGeometry args={[1]} />
            <meshPhysicalMaterial color="#2d5a27" roughness={0.8} clearcoat={0.1} clearcoatRoughness={0.8} />
            </mesh>
            <mesh castShadow receiveShadow position={[0.8, -0.5, 0.5]} scale={0.8}>
            <dodecahedronGeometry args={[1]} />
            <meshPhysicalMaterial color="#3a6b32" roughness={0.8} clearcoat={0.1} clearcoatRoughness={0.8} />
            </mesh>
            <mesh castShadow receiveShadow position={[-0.7, 0.2, -0.6]} scale={0.9}>
            <dodecahedronGeometry args={[1]} />
            <meshPhysicalMaterial color="#1e4620" roughness={0.8} clearcoat={0.1} clearcoatRoughness={0.8} />
            </mesh>
            <mesh castShadow receiveShadow position={[0.3, 0.8, -0.3]} scale={0.7}>
            <dodecahedronGeometry args={[1]} />
            <meshPhysicalMaterial color="#4a7c3a" roughness={0.8} clearcoat={0.1} clearcoatRoughness={0.8} />
            </mesh>
        </group>
       )}
    </group>
  );
}

function Rock({ position, scale = 1 }: { position: [number, number, number], scale?: number }) {
  // Create a composite rock from multiple shapes
  const rotation = useMemo(() => [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI] as [number, number, number], []);
  
  return (
    <RigidBody type="fixed" colliders="hull" position={position} userData={{ material: 'rock' }}>
      <group scale={scale} rotation={rotation}>
        {/* Main mass */}
        <mesh castShadow receiveShadow>
          <dodecahedronGeometry args={[1.5, 1]} /> {/* More detail */}
          <meshPhysicalMaterial color="#795548" roughness={0.8} flatShading clearcoat={0.1} clearcoatRoughness={0.8} />
        </mesh>
        {/* Detail chunks */}
        <mesh castShadow receiveShadow position={[1, -0.5, 0.5]} scale={0.6}>
          <dodecahedronGeometry args={[1.2, 0]} />
          <meshPhysicalMaterial color="#6d4c41" roughness={0.9} flatShading clearcoat={0.1} clearcoatRoughness={0.8} />
        </mesh>
        <mesh castShadow receiveShadow position={[-0.8, -0.8, -0.5]} scale={0.7}>
          <dodecahedronGeometry args={[1.1, 0]} />
          <meshPhysicalMaterial color="#5d4037" roughness={0.9} flatShading clearcoat={0.1} clearcoatRoughness={0.8} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 1.2, 0]} scale={0.4}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshPhysicalMaterial color="#8d6e63" roughness={0.9} flatShading clearcoat={0.1} clearcoatRoughness={0.8} />
        </mesh>
        {/* Moss/Lichen patch */}
        <mesh position={[0.5, 0.5, 0.8]} scale={0.3}>
           <dodecahedronGeometry args={[1, 0]} />
           <meshPhysicalMaterial color="#556b2f" roughness={1} clearcoat={0.1} clearcoatRoughness={0.8} />
        </mesh>
      </group>
    </RigidBody>
  );
}

function Bush({ position, scale = 1, color = '#556b2f' }: { position: [number, number, number], scale?: number, color?: string }) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow receiveShadow position={[0, 0.3, 0]}>
        <dodecahedronGeometry args={[0.5]} />
        <meshPhysicalMaterial color={color} roughness={1} />
      </mesh>
      <mesh castShadow receiveShadow position={[0.4, 0.2, 0.3]} scale={0.8}>
        <dodecahedronGeometry args={[0.5]} />
        <meshPhysicalMaterial color={color} roughness={1} />
      </mesh>
      <mesh castShadow receiveShadow position={[-0.3, 0.4, -0.2]} scale={0.7}>
        <dodecahedronGeometry args={[0.5]} />
        <meshPhysicalMaterial color={color} roughness={1} />
      </mesh>
    </group>
  );
}

function Grass() {
  const count = 40000;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const timeRef = useRef({ value: 0 });

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(0.2, 0.8);
    geo.translate(0, 0.4, 0); // Translate so origin is at the bottom
    return geo;
  }, []);

  useEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 98; 
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const scale = 0.5 + Math.random() * 0.8;
      const rotation = Math.random() * Math.PI;
      const tilt = (Math.random() - 0.5) * 0.2;
      
      dummy.position.set(x, -2.0, z); // Adjust Y because of geometry translation
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.set(tilt, rotation, tilt);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [count]);

  useFrame(({ clock }) => {
    const { isPaused, health } = useStore.getState();
    if (isPaused || health <= 0) return;
    timeRef.current.value = clock.getElapsedTime();
  });

  const onBeforeCompile = (shader: any) => {
    shader.uniforms.uTime = timeRef.current;
    shader.vertexShader = `
      uniform float uTime;
      ${shader.vertexShader}
    `;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      
      // Calculate wind based on instance position
      vec4 instancePos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float wind = sin(uTime * 1.5 + instancePos.x * 0.2 + instancePos.z * 0.2) * 0.15 + sin(uTime * 3.0 + instancePos.x * 0.5) * 0.05;
      
      // Apply wind only to top vertices (y > 0)
      if (position.y > 0.0) {
        transformed.x += wind * position.y;
        transformed.z += wind * position.y;
      }
      `
    );
  };

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, count]} receiveShadow>
      <meshPhysicalMaterial 
        color="#4a7c3a" 
        side={THREE.DoubleSide} 
        roughness={0.8}
        onBeforeCompile={onBeforeCompile}
      />
    </instancedMesh>
  );
}

function SmallStones() {
  const count = 1000;
  const positions = useMemo(() => {
    const pos = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 98; 
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      pos.push({ x, z, scale: 0.1 + Math.random() * 0.2, rotation: Math.random() * Math.PI });
    }
    return pos;
  }, []);

  return (
    <Instances range={count}>
      <dodecahedronGeometry args={[0.5, 0]} />
      <meshPhysicalMaterial color="#5d4037" roughness={0.9} clearcoat={0.1} clearcoatRoughness={0.8} />
      {positions.map((p, i) => (
        <Instance
          key={i}
          position={[p.x, -1.95, p.z]} // Adjusted to sit on ground at -2
          scale={[p.scale, p.scale * 0.6, p.scale]}
          rotation={[Math.random(), p.rotation, Math.random()]}
        />
      ))}
    </Instances>
  );
}

function Hills() {
  return (
    <group>
      {/* Distant Hills - Ring around the map */}
      <mesh position={[-120, -5, -120]} scale={[80, 40, 80]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshPhysicalMaterial color="#5d4037" roughness={1} clearcoat={0.1} clearcoatRoughness={0.8} />
      </mesh>
      <mesh position={[0, -10, -160]} scale={[120, 50, 80]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshPhysicalMaterial color="#4e342e" roughness={1} clearcoat={0.1} clearcoatRoughness={0.8} />
      </mesh>
      <mesh position={[120, -5, -120]} scale={[80, 40, 80]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshPhysicalMaterial color="#5d4037" roughness={1} clearcoat={0.1} clearcoatRoughness={0.8} />
      </mesh>
       <mesh position={[160, -5, 0]} scale={[80, 50, 100]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshPhysicalMaterial color="#4e342e" roughness={1} clearcoat={0.1} clearcoatRoughness={0.8} />
      </mesh>
       <mesh position={[120, -5, 120]} scale={[80, 40, 80]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshPhysicalMaterial color="#5d4037" roughness={1} clearcoat={0.1} clearcoatRoughness={0.8} />
      </mesh>
      <mesh position={[0, -10, 160]} scale={[120, 50, 80]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshPhysicalMaterial color="#4e342e" roughness={1} clearcoat={0.1} clearcoatRoughness={0.8} />
      </mesh>
       <mesh position={[-120, -5, 120]} scale={[80, 40, 80]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshPhysicalMaterial color="#5d4037" roughness={1} clearcoat={0.1} clearcoatRoughness={0.8} />
      </mesh>
      <mesh position={[-160, -5, 0]} scale={[80, 50, 100]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshPhysicalMaterial color="#4e342e" roughness={1} clearcoat={0.1} clearcoatRoughness={0.8} />
      </mesh>
    </group>
  );
}

function Pillar({ position, scale = 1, broken = false }: { position: [number, number, number], scale?: number, broken?: boolean }) {
  return (
    <RigidBody type="fixed" colliders="cuboid" position={position} userData={{ material: 'rock' }}>
      <group scale={scale}>
        {/* Base */}
        <mesh castShadow receiveShadow position={[0, 0.25, 0]}>
          <boxGeometry args={[1.2, 0.5, 1.2]} />
          <meshPhysicalMaterial color="#d7ccc8" roughness={0.9} clearcoat={0.1} clearcoatRoughness={0.8} />
        </mesh>
        {/* Column */}
        <mesh castShadow receiveShadow position={[0, broken ? 1.5 : 2.5, 0]}>
          <cylinderGeometry args={[0.4, 0.4, broken ? 2 : 4, 8]} />
          <meshPhysicalMaterial color="#d7ccc8" roughness={0.9} clearcoat={0.1} clearcoatRoughness={0.8} />
        </mesh>
        {/* Top (if not broken) */}
        {!broken && (
          <mesh castShadow receiveShadow position={[0, 4.75, 0]}>
            <boxGeometry args={[1.2, 0.5, 1.2]} />
            <meshPhysicalMaterial color="#d7ccc8" roughness={0.9} clearcoat={0.1} clearcoatRoughness={0.8} />
          </mesh>
        )}
        {/* Debris if broken */}
        {broken && (
          <mesh castShadow receiveShadow position={[1, 0.5, 0]} rotation={[0, 0, 1.2]}>
             <cylinderGeometry args={[0.4, 0.4, 1.5, 8]} />
             <meshPhysicalMaterial color="#d7ccc8" roughness={0.9} clearcoat={0.1} clearcoatRoughness={0.8} />
          </mesh>
        )}
      </group>
    </RigidBody>
  );
}

function Well({ position }: { position: [number, number, number] }) {
  return (
    <RigidBody type="fixed" colliders="hull" position={position} userData={{ material: 'rock' }}>
      <group>
        {/* Base ring */}
        <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
          <cylinderGeometry args={[1.5, 1.5, 1, 12]} />
          <meshPhysicalMaterial color="#8d6e63" roughness={1} clearcoat={0.1} clearcoatRoughness={0.8} />
        </mesh>
        {/* Inner hole (fake depth) */}
        <mesh position={[0, 0.9, 0]}>
          <cylinderGeometry args={[1.2, 1.2, 0.1, 12]} />
          <meshPhysicalMaterial color="#1a1a1a" roughness={1} clearcoat={0.1} clearcoatRoughness={0.8} />
        </mesh>
        {/* Wooden supports */}
        <mesh castShadow receiveShadow position={[-1.2, 1.5, 0]}>
          <boxGeometry args={[0.2, 2, 0.2]} />
          <meshPhysicalMaterial color="#4e342e" clearcoat={0.1} clearcoatRoughness={0.8} />
        </mesh>
        <mesh castShadow receiveShadow position={[1.2, 1.5, 0]}>
          <boxGeometry args={[0.2, 2, 0.2]} />
          <meshPhysicalMaterial color="#4e342e" clearcoat={0.1} clearcoatRoughness={0.8} />
        </mesh>
        {/* Crossbeam */}
        <mesh castShadow receiveShadow position={[0, 2.5, 0]}>
          <boxGeometry args={[2.8, 0.2, 0.2]} />
          <meshPhysicalMaterial color="#4e342e" clearcoat={0.1} clearcoatRoughness={0.8} />
        </mesh>
        {/* Rope */}
        <mesh castShadow position={[0, 1.5, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 2, 8]} />
          <meshPhysicalMaterial color="#d7ccc8" clearcoat={0.1} clearcoatRoughness={0.8} />
        </mesh>
      </group>
    </RigidBody>
  );
}

export function World() {
  // Load texture - Rocky/Sandy Ground - Darker
  const texture = useTexture('https://picsum.photos/seed/darkground/1024/1024');
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(20, 20);

  // Procedural Generation
  const trees = useMemo(() => {
      const items = [];
      for (let i = 0; i < 60; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = 15 + Math.random() * 80; // Spread out more
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          const scale = 0.8 + Math.random() * 0.8;
          const type = Math.random() > 0.8 ? 'dead' : 'normal';
          items.push({ position: [x, -2, z] as [number, number, number], scale, type });
      }
      return items;
  }, []);

  const rocks = useMemo(() => {
      const items = [];
      for (let i = 0; i < 40; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = 10 + Math.random() * 85;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          const scale = 0.8 + Math.random() * 1.5;
          items.push({ position: [x, -2, z] as [number, number, number], scale });
      }
      return items;
  }, []);

  const bushes = useMemo(() => {
      const items = [];
      const colors = ['#556b2f', '#6b8e23', '#334411', '#8f9779'];
      for (let i = 0; i < 100; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = 5 + Math.random() * 90;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          const scale = 0.6 + Math.random() * 0.6;
          const color = colors[Math.floor(Math.random() * colors.length)];
          items.push({ position: [x, -2, z] as [number, number, number], scale, color });
      }
      return items;
  }, []);

  return (
    <group>
      {/* Ground - Moved to y=-2 to match physics/visuals */}
      <RigidBody type="fixed" colliders="hull" userData={{ material: 'grass' }}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
          <planeGeometry args={[200, 200, 64, 64]} />
          <meshPhysicalMaterial map={texture} bumpMap={texture} bumpScale={0.05} color="#4e342e" roughness={1} clearcoat={0.1} clearcoatRoughness={0.9} />
        </mesh>
      </RigidBody>

      {/* Sandy Area */}
      <RigidBody type="fixed" colliders="cuboid" position={[20, -1.95, -20]} userData={{ material: 'sand' }}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[40, 40]} />
          <meshPhysicalMaterial color="#d2b48c" roughness={1} />
        </mesh>
      </RigidBody>

      {/* Trees */}
      {trees.map((tree, i) => (
          <Tree key={i} position={tree.position} scale={tree.scale} type={tree.type as 'normal' | 'dead'} />
      ))}

      {/* Rocks */}
      {rocks.map((rock, i) => (
          <Rock key={i} position={rock.position} scale={rock.scale} />
      ))}

      {/* Bushes */}
      {bushes.map((bush, i) => (
          <Bush key={i} position={bush.position} scale={bush.scale} color={bush.color} />
      ))}

      {/* Grass - Adjusted elevation in component if needed, but here we just render it */}
      <Grass />
      
      {/* Small Stones on Ground */}
      <SmallStones />

      {/* Background Hills */}
      <Hills />

      {/* Ancient Ruins - Wall - Adjusted Y to sit on ground at -2 */}
      <RigidBody type="fixed" colliders="cuboid" position={[-10, -1, 10]} userData={{ material: 'rock' }}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[8, 3, 1]} />
          <meshPhysicalMaterial color="#a1887f" roughness={0.9} clearcoat={0.1} clearcoatRoughness={0.8} />
        </mesh>
        <mesh castShadow receiveShadow position={[2, 2, 0]} rotation={[0, 0, 0.2]}>
          <boxGeometry args={[2, 1, 0.8]} />
          <meshPhysicalMaterial color="#a1887f" roughness={0.9} clearcoat={0.1} clearcoatRoughness={0.8} />
        </mesh>
        {/* Debris */}
        <mesh castShadow receiveShadow position={[-3, -1, 1]} rotation={[0.5, 0.5, 0]}>
           <boxGeometry args={[1, 1, 1]} />
           <meshPhysicalMaterial color="#8d6e63" clearcoat={0.1} clearcoatRoughness={0.8} />
        </mesh>
      </RigidBody>

      {/* New Biblical/Medieval Props */}
      <Well position={[15, -2, -15]} />
      <Pillar position={[20, -2, 10]} scale={1.2} />
      <Pillar position={[24, -2, 10]} scale={1.2} broken />
      <Pillar position={[22, -2, 14]} scale={1.2} />
      <Pillar position={[-20, -2, -20]} scale={0.8} broken />
      <Pillar position={[-22, -2, -18]} scale={0.8} />

      {/* End Game Passage */}
      <Passage />

      {/* Map Boundaries - Invisible Walls */}
      <RigidBody type="fixed" colliders="cuboid">
        {/* North Wall */}
        <mesh position={[0, 10, -100]}>
          <boxGeometry args={[200, 30, 1]} />
          <meshBasicMaterial visible={false} />
        </mesh>
        {/* South Wall */}
        <mesh position={[0, 10, 100]}>
          <boxGeometry args={[200, 30, 1]} />
          <meshBasicMaterial visible={false} />
        </mesh>
        {/* East Wall */}
        <mesh position={[100, 10, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[200, 30, 1]} />
          <meshBasicMaterial visible={false} />
        </mesh>
        {/* West Wall */}
        <mesh position={[-100, 10, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[200, 30, 1]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      </RigidBody>
    </group>
  );
}
