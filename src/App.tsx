import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sky, PointerLockControls, Stars, Cloud } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { Suspense, useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { Player, playerRef } from './components/Player';
import { World } from './components/World';
import { Stone } from './components/Stone';
import { Enemy, enemyRefs } from './components/Enemy';
import { Effects } from './components/Effects';
import { useStore } from './store';
import { Joystick } from './components/Joystick';
import { AimJoystick } from './components/AimJoystick';
import { Sword, RectangleVertical } from 'lucide-react';
import { StoryScreen } from './components/StoryScreen';

function Spawner() {
  const spawnEnemy = useStore((state) => state.spawnEnemy);
  const enemies = useStore((state) => state.enemies);
  const isPaused = useStore((state) => state.isPaused);
  const health = useStore((state) => state.health);
  const phase = useStore((state) => state.phase);
  const enemiesKilledInPhase = useStore((state) => state.enemiesKilledInPhase);
  const setPhaseMessage = useStore((state) => state.setPhaseMessage);
  const nextPhase = useStore((state) => state.nextPhase);
  const isTransitioningPhase = useStore((state) => state.isTransitioningPhase);
  
  const stateRef = useRef({
      totalSpawnedInPhase: 0,
      nextWaveTime: 0,
      spawning: false,
      currentPhase: 1
  });

  useFrame(({ clock }) => {
    if (isPaused || isTransitioningPhase || health <= 0) return;
    
    const state = stateRef.current;
    
    // Reset state if phase changed
    if (state.currentPhase !== phase) {
      state.currentPhase = phase;
      state.totalSpawnedInPhase = 0;
      state.nextWaveTime = 0;
      state.spawning = false;
    }

    let targetKills = 0;
    let maxAtOnce = 0;
    let enemyType: 'wolf' | 'bear' | 'lion' = 'wolf';
    let enemyHealth = 30;

    if (phase === 1) {
      targetKills = 10;
      maxAtOnce = 3;
      enemyType = 'wolf';
      enemyHealth = 30;
    } else if (phase === 2) {
      targetKills = 6;
      maxAtOnce = 2;
      enemyType = 'bear';
      enemyHealth = 60;
    } else if (phase === 3) {
      targetKills = 1;
      maxAtOnce = 1;
      enemyType = 'lion';
      enemyHealth = 150;
    } else {
      // Game over or infinite mode
      return;
    }

    // Check for phase completion
    if (enemiesKilledInPhase >= targetKills && !isTransitioningPhase) {
      if (phase === 1) {
        setPhaseMessage("Parabéns, você venceu os lobos! Prepare-se para enfrentar o Urso.");
        setTimeout(() => nextPhase(), 5000);
      } else if (phase === 2) {
        setPhaseMessage("Parabéns, você venceu os ursos! Prepare-se para enfrentar o poderoso Leão.");
        setTimeout(() => nextPhase(), 5000);
      } else if (phase === 3) {
        setPhaseMessage("Parabéns! Você venceu o Leão e provou seu valor!");
        setTimeout(() => {
          useStore.getState().reset();
          window.location.reload();
        }, 8000);
      }
      return;
    }

    if (state.totalSpawnedInPhase >= targetKills) return;

    if (enemies.length >= maxAtOnce) {
        state.spawning = false;
        state.nextWaveTime = 0;
        return;
    }

    if (state.spawning) return;

    const now = clock.getElapsedTime();

    if (state.nextWaveTime === 0) {
        state.nextWaveTime = now + 2;
        return;
    }

    if (now >= state.nextWaveTime) {
        state.spawning = true;
        
        const countToSpawn = Math.min(maxAtOnce - enemies.length, targetKills - state.totalSpawnedInPhase);
        for (let i = 0; i < countToSpawn; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 15 + Math.random() * 10;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            spawnEnemy([x, 2, z], enemyType, enemyHealth);
        }
        state.totalSpawnedInPhase += countToSpawn;
    }
  });

  return null;
}

function UI() {
  const { health, score, isPaused, reset, togglePause, enemies, phase, phaseMessage } = useStore();

  useEffect(() => {
    if (health <= 0) {
      document.exitPointerLock();
    }
  }, [health]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        togglePause();
        if (!isPaused) {
          document.exitPointerLock();
        } else {
          const canvas = document.querySelector('canvas');
          canvas?.requestPointerLock();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaused, togglePause]);

  const sendKey = (code: string, active: boolean) => {
      window.dispatchEvent(new KeyboardEvent(active ? 'keydown' : 'keyup', { code }));
  };

  const handleJoystickMove = (x: number, y: number) => {
      window.dispatchEvent(new CustomEvent('joystickMove', { detail: { x, y } }));
  };

  const handleJoystickStop = () => {
      window.dispatchEvent(new CustomEvent('joystickMove', { detail: { x: 0, y: 0 } }));
  };

  const triggerAttack = (type: 'sling' | 'knife') => {
      window.dispatchEvent(new CustomEvent('attack', { detail: type }));
  };

  if (health <= 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white z-50">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-red-600 mb-4">FIM DE JOGO</h1>
          <p className="text-2xl mb-8">Pontuação: {score}</p>
          <button 
            onClick={() => {
              reset();
              window.location.reload();
            }}
            className="px-8 py-4 bg-white text-black font-bold rounded hover:bg-gray-200"
          >
            TENTAR NOVAMENTE
          </button>
        </div>
      </div>
    );
  }

  if (isPaused) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white z-50">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-8">PAUSADO</h1>
          <button 
            onClick={() => {
              togglePause();
              const canvas = document.querySelector('canvas');
              canvas?.requestPointerLock();
            }}
            className="px-8 py-4 bg-white text-black font-bold rounded hover:bg-gray-200"
          >
            CONTINUAR
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none select-none">
      {/* Crosshair - Improved */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-80">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="20" r="2" fill="white" />
          <path d="M20 5V12" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <path d="M20 28V35" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <path d="M5 20H12" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <path d="M28 20H35" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <circle cx="20" cy="20" r="16" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
        </svg>
      </div>
      
      {/* Top Left: Health & Score */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-auto">
        <div className="flex items-center gap-4">
            {/* Character Portrait */}
            <div className="w-16 h-16 rounded-full border-2 border-white/30 overflow-hidden bg-black/50 backdrop-blur-sm shadow-lg">
                <img 
                    src="/character_portrait.svg" 
                    alt="Character" 
                    className="w-full h-full object-cover"
                />
            </div>
            
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <div className="w-48 h-6 bg-gray-900/80 border-2 border-white/20 rounded-lg overflow-hidden backdrop-blur-sm">
                    <div 
                        className="h-full bg-gradient-to-r from-red-600 to-red-500 transition-all duration-300" 
                        style={{ width: `${health}%` }}
                    />
                    </div>
                    <span className="text-white font-bold text-xl drop-shadow-md">{health}%</span>
                </div>
                <div className="text-yellow-400 font-mono text-xl font-bold drop-shadow-md pl-1">
                    PONTOS: {score}
                </div>
                <div className="text-red-400 font-mono text-lg font-bold drop-shadow-md pl-1">
                    INIMIGOS: {enemies.length}
                </div>
                <div className="text-blue-400 font-mono text-lg font-bold drop-shadow-md pl-1">
                    FASE: {phase}
                </div>
            </div>
        </div>
      </div>

      {/* Phase Transition Message */}
      {phaseMessage && (
        <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/50 backdrop-blur-sm">
          <div className="text-center p-8 bg-black/80 border-2 border-yellow-500 rounded-xl shadow-[0_0_30px_rgba(234,179,8,0.5)] animate-bounce">
            <h2 className="text-4xl md:text-5xl text-yellow-400 font-bold mb-4" style={{ fontFamily: "'Cinzel', serif" }}>
              {phaseMessage}
            </h2>
          </div>
        </div>
      )}
      
      {/* Top Right: Pause Button */}
      <div className="absolute top-4 right-4 pointer-events-auto">
        <button 
          onClick={() => {
            togglePause();
            document.exitPointerLock();
          }}
          className="px-4 py-2 bg-white/20 hover:bg-white/40 text-white rounded backdrop-blur-sm font-bold"
        >
          PAUSAR (P)
        </button>
      </div>

      {/* Bottom Left: Joystick */}
      <div className="absolute bottom-8 left-8 pointer-events-auto">
          <Joystick onMove={handleJoystickMove} onStop={handleJoystickStop} />
      </div>

      {/* Bottom Right: Actions (Jump, Weapons) */}
      <div className="absolute bottom-8 right-8 flex gap-4 pointer-events-auto">
        {/* Column 0: Block */}
        <div className="flex flex-col gap-4 items-center justify-end">
            <button 
                className="w-16 h-16 bg-green-900/60 border-2 border-green-500 rounded-full active:bg-green-700/80 backdrop-blur-md flex items-center justify-center text-white font-bold text-[10px] hover:bg-green-800/60 transition-all shadow-lg shadow-green-900/30"
                onPointerDown={() => window.dispatchEvent(new Event('blockStart'))}
                onPointerUp={() => window.dispatchEvent(new Event('blockEnd'))}
                onPointerLeave={() => window.dispatchEvent(new Event('blockEnd'))}
            >
                DEFESA
            </button>
        </div>

        {/* Column 1: Dodge above Stone */}
        <div className="flex flex-col gap-4 items-center justify-end">
             {/* Dash Button */}
            <button 
                className="w-16 h-16 bg-blue-900/60 border-2 border-blue-500 rounded-full active:bg-blue-700/80 backdrop-blur-md flex items-center justify-center text-white font-bold text-[10px] hover:bg-blue-800/60 transition-all shadow-lg shadow-blue-900/30"
                onPointerDown={() => window.dispatchEvent(new Event('dash'))}
            >
                ESQUIVA
            </button>
            
            {/* Stone Weapon */}
            <AimJoystick 
              onAim={(x, y) => window.dispatchEvent(new CustomEvent('aimJoystickMove', { detail: { x, y } }))}
              onAttack={() => triggerAttack('sling')}
              icon={<RectangleVertical size={28} strokeWidth={2.5} />}
              label="PEDRA"
              colorClass="bg-yellow-900/40 border-yellow-500 text-yellow-500 shadow-[0_0_15px_rgba(250,204,21,0.3)]"
            />
        </div>

        {/* Column 2: Jump above Knife */}
        <div className="flex flex-col gap-4 items-center justify-end">
            {/* Jump Button */}
            <button 
                className="w-20 h-20 bg-gray-800/60 border-2 border-gray-500 rounded-full active:bg-gray-700/80 backdrop-blur-md flex items-center justify-center text-white font-bold text-sm hover:bg-gray-700/60 transition-all shadow-lg"
                onPointerDown={() => sendKey('Space', true)}
                onPointerUp={() => sendKey('Space', false)}
                onPointerLeave={() => sendKey('Space', false)}
            >
                PULAR
            </button>

            {/* Knife Weapon */}
            <AimJoystick 
              onAim={(x, y) => window.dispatchEvent(new CustomEvent('aimJoystickMove', { detail: { x, y } }))}
              onAttack={() => triggerAttack('knife')}
              icon={<Sword size={28} strokeWidth={2.5} />}
              label="FACA"
              colorClass="bg-gray-100/20 border-white text-white shadow-[0_0_15px_rgba(255,255,255,0.3)]"
            />
        </div>
      </div>
      
      {/* Instructions */}
      <div className="absolute top-20 left-4 text-white/50 font-sans text-xs p-2 rounded pointer-events-none">
        <p>WASD / Joystick Esquerdo para Mover</p>
        <p>Arraste a tela para Mirar</p>
        <p>Arraste os botões de arma para Mirar e Atirar</p>
        <p>ESPAÇO / Botão para Pular</p>
        <p>SHIFT / Botão para Esquiva</p>
        <p>E / Botão para Defesa</p>
        <p>CLIQUE ESQUERDO para Faca</p>
        <p>CLIQUE DIREITO para Funda</p>
      </div>
    </div>
  );
}

function AmbientSound() {
  const isPaused = useStore((state) => state.isPaused);
  const health = useStore((state) => state.health);

  const [audio] = useState(() => {
    const a = new Audio('https://assets.mixkit.co/active_storage/sfx/246/246-preview.mp3'); // Desert wind howling
    a.loop = true;
    a.volume = 0.05; // Lower volume
    return a;
  });

  useEffect(() => {
    if (isPaused || health <= 0) {
        audio.pause();
        return;
    }

    const playAudio = () => {
        audio.play().catch((e) => {
            if (e.name === 'NotAllowedError') {
                // Auto-play policy might block this until user interaction
                const clickHandler = () => {
                    if (!useStore.getState().isPaused && useStore.getState().health > 0) {
                        audio.play().catch(() => {});
                    }
                    window.removeEventListener('click', clickHandler);
                    window.removeEventListener('keydown', clickHandler);
                };
                window.addEventListener('click', clickHandler);
                window.addEventListener('keydown', clickHandler);
            }
        });
    };
    playAudio();
    return () => {
        audio.pause();
    };
  }, [audio, isPaused, health]);

  return null;
}

function CombatMusic() {
  const isPaused = useStore((state) => state.isPaused);
  const health = useStore((state) => state.health);
  const enemies = useStore((state) => state.enemies);

  const [audio] = useState(() => {
    // Fast-paced drum loop for combat
    const a = new Audio('https://assets.mixkit.co/active_storage/sfx/2042/2042-preview.mp3'); 
    a.loop = true;
    a.volume = 0;
    return a;
  });

  useEffect(() => {
    if (isPaused || health <= 0) {
        audio.pause();
        return;
    }

    if (enemies.length > 0) {
        if (audio.paused) {
            audio.play().catch(() => {});
        }
        // Adjust volume based on number of enemies (max volume 0.4)
        const targetVolume = Math.min(0.4, 0.1 + enemies.length * 0.1);
        
        // Smooth volume transition
        const fadeInterval = setInterval(() => {
            if (audio.volume < targetVolume) {
                audio.volume = Math.min(targetVolume, audio.volume + 0.05);
            } else if (audio.volume > targetVolume) {
                audio.volume = Math.max(targetVolume, audio.volume - 0.05);
            } else {
                clearInterval(fadeInterval);
            }
        }, 100);
        return () => clearInterval(fadeInterval);
    } else {
        // Fade out
        const fadeInterval = setInterval(() => {
            if (audio.volume > 0.05) {
                audio.volume = Math.max(0, audio.volume - 0.05);
            } else {
                audio.volume = 0;
                audio.pause();
                clearInterval(fadeInterval);
            }
        }, 100);
        return () => clearInterval(fadeInterval);
    }
  }, [enemies.length, isPaused, health, audio]);

  return null;
}

function TouchCameraControls() {
  const { camera, gl } = useThree();
  const isPaused = useStore((state) => state.isPaused);
  const health = useStore((state) => state.health);
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const previousTouch = useRef<{ x: number, y: number, id: number } | null>(null);

  useEffect(() => {
    if (isPaused || health <= 0) return;

    const onTouchStart = (e: TouchEvent) => {
      // Only track if we aren't already tracking a touch for the camera
      if (previousTouch.current) return;
      
      // Find a touch on the right side of the screen
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.clientX > window.innerWidth / 2) {
          previousTouch.current = { x: touch.clientX, y: touch.clientY, id: touch.identifier };
          break;
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!previousTouch.current) return;
      
      let touch: Touch | null = null;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === previousTouch.current.id) {
           touch = e.touches[i];
           break;
        }
      }
      
      if (!touch) return;

      const movementX = touch.clientX - previousTouch.current.x;
      const movementY = touch.clientY - previousTouch.current.y;

      previousTouch.current = { x: touch.clientX, y: touch.clientY, id: touch.identifier };

      euler.current.setFromQuaternion(camera.quaternion);

      // Adjust sensitivity here
      euler.current.y -= movementX * 0.005;
      euler.current.x -= movementY * 0.005;

      // Clamp pitch
      euler.current.x = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, euler.current.x));

      camera.quaternion.setFromEuler(euler.current);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!previousTouch.current) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === previousTouch.current.id) {
          previousTouch.current = null;
          break;
        }
      }
    };

    const canvas = gl.domElement;
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [camera, gl, isPaused, health]);

  return null;
}

function TargetManager() {
  const enemies = useStore((state) => state.enemies);
  const targetId = useStore((state) => state.targetId);
  const setTargetId = useStore((state) => state.setTargetId);

  useFrame(() => {
    const { isPaused, health } = useStore.getState();
    if (isPaused || health <= 0) return;

    if (!playerRef.current) return;
    const playerPos = playerRef.current.translation();
    const pVec = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);

    const aliveEnemies = enemies;

    if (aliveEnemies.length === 0) {
      if (targetId !== null) setTargetId(null);
      return;
    }

    const currentTarget = aliveEnemies.find(e => e.id === targetId);
    if (currentTarget) {
      return;
    }

    let closestEnemy = null;
    let minDistance = Infinity;

    aliveEnemies.forEach(enemy => {
      const rb = enemyRefs.get(enemy.id);
      if (!rb) return;
      const ePos = rb.translation();
      const eVec = new THREE.Vector3(ePos.x, ePos.y, ePos.z);
      const dist = pVec.distanceTo(eVec);
      if (dist < minDistance) {
        minDistance = dist;
        closestEnemy = enemy;
      }
    });

    if (closestEnemy) {
      if (targetId !== closestEnemy.id) {
        setTargetId(closestEnemy.id);
      }
    } else {
      if (targetId !== null) setTargetId(null);
    }
  });

  return null;
}

function TargetIndicator() {
  const targetId = useStore((state) => state.targetId);
  const groupRef = useRef<THREE.Group>(null);
  const wasVisible = useRef(false);

  useFrame((state, delta) => {
    const { isPaused, health } = useStore.getState();
    if (isPaused || health <= 0) return;

    if (!groupRef.current) return;

    if (targetId) {
      const rb = enemyRefs.get(targetId);
      if (rb) {
        const pos = rb.translation();
        const targetPos = new THREE.Vector3(pos.x, pos.y + 2.0, pos.z);
        
        // Smoothly interpolate position
        if (!wasVisible.current) {
            // Snap to position if it was hidden
            groupRef.current.position.copy(targetPos);
        } else {
            // Smoothly interpolate position if it was already visible
            groupRef.current.position.lerp(targetPos, 1 - Math.exp(-15 * delta));
        }
        
        // Face the camera
        groupRef.current.quaternion.copy(state.camera.quaternion);
        
        // Add a slow spin around the Z axis (facing the camera)
        groupRef.current.rotateZ(state.clock.elapsedTime * 2);
        
        // Make it visible
        groupRef.current.visible = true;
        wasVisible.current = true;
      } else {
        groupRef.current.visible = false;
        wasVisible.current = false;
      }
    } else {
      groupRef.current.visible = false;
      wasVisible.current = false;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      {/* Outer ring */}
      <mesh>
        <ringGeometry args={[0.3, 0.35, 32]} />
        <meshBasicMaterial color="#ff0000" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      {/* Crosshairs */}
      <mesh>
        <boxGeometry args={[0.05, 0.8, 0.01]} />
        <meshBasicMaterial color="#ff0000" transparent opacity={0.8} />
      </mesh>
      <mesh>
        <boxGeometry args={[0.8, 0.05, 0.01]} />
        <meshBasicMaterial color="#ff0000" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

function GameContent() {
  const stones = useStore((state) => state.stones);
  const enemies = useStore((state) => state.enemies);

  return (
    <>
      <Player />
      <World />
      <Spawner />
      <TargetManager />
      <TargetIndicator />
      <Effects />
      <AmbientSound />
      <CombatMusic />
      <TouchCameraControls />
      
      {stones.map((stone) => (
        <Stone key={stone.id} {...stone} />
      ))}
      
      {enemies.map((enemy) => (
        <Enemy key={enemy.id} {...enemy} />
      ))}
    </>
  );
}

import { EffectComposer, Bloom, Vignette, Noise, DepthOfField } from '@react-three/postprocessing';
import { Environment } from '@react-three/drei';

export default function App() {
  const isPaused = useStore((state) => state.isPaused);
  const isStarted = useStore((state) => state.isStarted);
  const health = useStore((state) => state.health);

  return (
    <div className="w-full h-screen bg-black">
      {!isStarted && <StoryScreen />}
      
      {isStarted && (
        <>
          <Canvas 
            shadows 
            camera={{ fov: 75 }} 
            dpr={[1, 2.5]} 
            gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2, powerPreference: "high-performance" }}
            onCreated={({ gl }) => {
              gl.shadowMap.enabled = true;
              gl.shadowMap.type = THREE.PCFSoftShadowMap;
            }}
          >
            <Suspense fallback={null}>
              {/* Environment Map for realistic reflections on Physical Materials */}
              <Environment preset="sunset" />
              
              {/* Dramatic Sunset Sky */}
              <Sky 
                sunPosition={[100, 10, 100]} 
                turbidity={8} 
                rayleigh={6} 
                mieCoefficient={0.005} 
                mieDirectionalG={0.8} 
                inclination={0.49} 
                azimuth={0.25} 
              />
              <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
              
              {/* Volumetric Clouds */}
              <Cloud position={[-4, -2, -25]} speed={0.2} opacity={0.5} />
              <Cloud position={[4, 2, -15]} speed={0.2} opacity={0.5} />
              <Cloud position={[-4, 2, -10]} speed={0.2} opacity={1} />
              <Cloud position={[4, -2, -5]} speed={0.2} opacity={0.5} />
              <Cloud position={[4, 2, 0]} speed={0.2} opacity={0.75} />
              
              {/* Atmospheric Lighting */}
              <ambientLight intensity={0.6} color="#ffccaa" /> {/* Brighter warm ambient */}
              
              {/* Main directional light (Sun) - Warmer and lower angle */}
              <directionalLight 
                position={[100, 50, 100]} 
                intensity={2.5} 
                castShadow 
                color="#ffaa77" 
                shadow-mapSize={[2048, 2048]}
                shadow-camera-left={-100}
                shadow-camera-right={100}
                shadow-camera-top={100}
                shadow-camera-bottom={-100}
                shadow-bias={-0.0001}
              />
              
              {/* Rim light for characters */}
              <spotLight position={[-10, 10, -10]} angle={0.5} intensity={1.5} color="#88ccff" />

              <Physics gravity={[0, -9.81, 0]} paused={isPaused || health <= 0}>
                <GameContent />
              </Physics>
              
              <PointerLockControls enabled={health > 0 && !isPaused} />
              <TouchCameraControls />
              
              {/* Post-processing effects */}
              <EffectComposer multisampling={8}>
                <Bloom luminanceThreshold={0.8} luminanceSmoothing={0.9} intensity={0.8} resolutionScale={2} />
                <Noise opacity={0.025} />
                <Vignette eskil={false} offset={0.1} darkness={1.1} />
              </EffectComposer>
            </Suspense>
          </Canvas>
          <UI />
        </>
      )}
    </div>
  );
}
