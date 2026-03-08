import { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, RapierRigidBody, CapsuleCollider } from '@react-three/rapier';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';
import { playerRef } from './Player';

export const enemyRefs = new Map<string, RapierRigidBody>();

interface EnemyProps {
  id: string;
  position: [number, number, number];
  health: number;
  maxHealth: number;
  type: 'wolf' | 'bear' | 'lion';
}

export function Enemy({ id, position, health, maxHealth, type }: EnemyProps) {
  const rigidBody = useRef<RapierRigidBody>(null);
  const group = useRef<THREE.Group>(null);
  const { removeEnemy, addScore, takeDamage, damageEnemy, addEffect, isPaused, isDodging, incrementKills, targetId } = useStore();
  const isTarget = targetId === id;
  const targetIndicatorRef = useRef<THREE.Group>(null);
  
  const [isStaggered, setIsStaggered] = useState(false);
  const [isDead, setIsDead] = useState(false);
  const [isDodgingEnemy, setIsDodgingEnemy] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);

  useEffect(() => {
    if (rigidBody.current) {
      enemyRefs.set(id, rigidBody.current);
    }
    return () => {
      enemyRefs.delete(id);
    };
  }, [id, rigidBody.current]);
  
  // AI State
  const [state, setState] = useState<'chase' | 'search'>('chase');
  const searchTarget = useRef<THREE.Vector3 | null>(null);
  const lastSeenPlayer = useRef<number>(0);

  const lastAttackTime = useRef<number>(0);
  const ATTACK_COOLDOWN = type === 'bear' ? 3000 : type === 'lion' ? 1500 : 2000;
  const isAttacking = useRef(false);

  // Stats based on type
  const ENEMY_SPEED = type === 'bear' ? 3 : type === 'lion' ? 5.5 : 4;
  const ATTACK_DAMAGE = type === 'bear' ? 25 : type === 'lion' ? 35 : 15;
  const SCALE = type === 'bear' ? 1.2 : type === 'lion' ? 1.0 : 0.7;
  const BODY_COLOR = type === 'bear' ? '#4a2e15' : type === 'lion' ? '#c29b0c' : '#2a2a2a';
  const MANE_COLOR = type === 'bear' ? '#2e1c0d' : type === 'lion' ? '#8b4513' : '#0a0a0a';
  const EYE_COLOR = type === 'bear' ? '#ff4400' : type === 'lion' ? '#ffaa00' : '#ff0000';

  // Listen for player attacks to trigger dodges/blocks
  useEffect(() => {
    const handlePlayerAttack = (e: CustomEvent) => {
        if (isDead || isStaggered || isAttacking.current || isDodgingEnemy || isBlocking) return;
        
        if (!rigidBody.current || !playerRef.current) return;
        const enemyPos = rigidBody.current.translation();
        const playerPos = playerRef.current.translation();
        const dist = new THREE.Vector3(enemyPos.x, 0, enemyPos.z).distanceTo(new THREE.Vector3(playerPos.x, 0, playerPos.z));
        
        if (dist < 15) {
            const rand = Math.random();
            if (rand < 0.3) {
                // 30% chance to dodge
                setIsDodgingEnemy(true);
                const dir = new THREE.Vector3(enemyPos.x - playerPos.x, 0, enemyPos.z - playerPos.z).normalize();
                // Add sideways movement
                dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() > 0.5 ? 1 : -1) * Math.PI / 3);
                rigidBody.current.applyImpulse({ x: dir.x * 15, y: 3, z: dir.z * 15 }, true);
                
                // Visual dodge roll/lean
                if (group.current) {
                    group.current.rotation.z = dir.x > 0 ? -0.5 : 0.5;
                }
                
                setTimeout(() => {
                    setIsDodgingEnemy(false);
                    if (group.current) group.current.rotation.z = 0;
                }, 600);
            } else if (rand < 0.5) {
                // 20% chance to block/brace
                setIsBlocking(true);
                if (group.current) {
                    group.current.position.y = -0.2; // Crouch down
                    group.current.rotation.x = 0.2; // Head down
                }
                setTimeout(() => {
                    setIsBlocking(false);
                    if (group.current) {
                        group.current.position.y = 0;
                        group.current.rotation.x = 0;
                    }
                }, 800);
            }
        }
    };
    
    window.addEventListener('attack', handlePlayerAttack as EventListener);
    return () => window.removeEventListener('attack', handlePlayerAttack as EventListener);
  }, [isDead, isStaggered, isDodgingEnemy, isBlocking]);

  useFrame((clockState, delta) => {
    if (!rigidBody.current || !playerRef.current || isPaused) return;

    if (isDead) {
      if (group.current) {
        // Death animation based on type
        if (type === 'bear') {
          // Bear falls backward heavily
          group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -Math.PI / 2, 3 * delta);
          group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, -0.2, 2 * delta);
        } else if (type === 'lion') {
          // Lion slumps forward and to the side
          group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, Math.PI / 3, 4 * delta);
          group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, Math.PI / 2, 4 * delta);
          group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, -0.3, 3 * delta);
        } else {
          // Wolf falls over and shrinks slightly
          group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, Math.PI / 2, 5 * delta);
          group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, Math.PI / 4, 5 * delta);
          group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, -0.4, 2 * delta);
          group.current.scale.setScalar(THREE.MathUtils.lerp(group.current.scale.x, 0, 1.5 * delta));
        }
      }
      return;
    }

    if (isStaggered || isBlocking) {
      rigidBody.current.setLinvel({ x: 0, y: rigidBody.current.linvel().y, z: 0 }, true);
      return;
    }

    if (isDodgingEnemy) {
        // Let physics handle the dodge impulse
        return;
    }

    const enemyPos = rigidBody.current.translation();
    const playerPos = playerRef.current.translation();
    const distToPlayer = new THREE.Vector3(enemyPos.x, 0, enemyPos.z).distanceTo(new THREE.Vector3(playerPos.x, 0, playerPos.z));

    // Line of Sight / Distance check
    const canSeePlayer = distToPlayer < 20;

    if (canSeePlayer) {
      if (state !== 'chase') {
          // Play growl sound on spot
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/212/212-preview.mp3'); // Placeholder growl
          audio.volume = 0.2;
          audio.playbackRate = 0.5;
          audio.play().catch(() => {});
      }
      setState('chase');
      lastSeenPlayer.current = Date.now();
      
      // Attack Logic
      if (distToPlayer < 3 && !isAttacking.current && Date.now() - lastAttackTime.current > ATTACK_COOLDOWN) {
          isAttacking.current = true;
          
          // Wind up animation (visual only)
          if (group.current) {
              group.current.position.y = 0.2;
              group.current.rotation.x = -0.5; // Lean back
          }
          
          setTimeout(() => {
              // Lunge / Attack
              if (rigidBody.current && playerRef.current && !isDead) {
                  // Lunge forward
                  const currentPos = rigidBody.current.translation();
                  const pPos = playerRef.current.translation();
                  const lungeDir = new THREE.Vector3(pPos.x - currentPos.x, 0, pPos.z - currentPos.z).normalize();
                  rigidBody.current.applyImpulse({ x: lungeDir.x * 20, y: 2, z: lungeDir.z * 20 }, true);
                  
                  // Visual Lunge
                  if (group.current) {
                      group.current.rotation.x = 0.5; // Lean forward
                  }

                  // Check Hit
                  const hitDist = new THREE.Vector3(currentPos.x, 0, currentPos.z).distanceTo(new THREE.Vector3(pPos.x, 0, pPos.z));
                  if (hitDist < 3.5 && !useStore.getState().isDodging) {
                      takeDamage(ATTACK_DAMAGE);
                      
                      // Attack Sound
                      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/212/212-preview.mp3'); 
                      audio.volume = 0.5;
                      audio.playbackRate = 1.5;
                      audio.play().catch(() => {});
                      
                      // Knockback Player (Optional, maybe just visual shake)
                  }
              }
              
              setTimeout(() => {
                  isAttacking.current = false;
                  lastAttackTime.current = Date.now();
                  if (group.current) group.current.rotation.x = 0;
              }, 500);
          }, 400);
      }

    } else if (Date.now() - lastSeenPlayer.current > 5000 && state === 'chase') {
      setState('search');
      searchTarget.current = null;
    }

    let moveDir = new THREE.Vector3();

    if (!isAttacking.current) {
        if (state === 'chase') {
          moveDir.subVectors(playerPos, enemyPos).normalize();
        } else if (state === 'search') {
          if (!searchTarget.current || new THREE.Vector3(enemyPos.x, 0, enemyPos.z).distanceTo(new THREE.Vector3(searchTarget.current.x, 0, searchTarget.current.z)) < 1) {
             const angle = Math.random() * Math.PI * 2;
             const radius = 5 + Math.random() * 5;
             searchTarget.current = new THREE.Vector3(
               enemyPos.x + Math.cos(angle) * radius,
               enemyPos.y,
               enemyPos.z + Math.sin(angle) * radius
             );
          }
          moveDir.subVectors(searchTarget.current, enemyPos).normalize();
        }
    }

    // Apply movement
    const speed = state === 'chase' ? ENEMY_SPEED : ENEMY_SPEED * 0.5;
    const currentVel = rigidBody.current.linvel();
    
    if (!isAttacking.current) {
        rigidBody.current.setLinvel({ x: moveDir.x * speed, y: currentVel.y, z: moveDir.z * speed }, true);
        
        // Face movement direction
        if (moveDir.lengthSq() > 0.1) {
          const angle = Math.atan2(moveDir.x, moveDir.z);
          rigidBody.current.setRotation({ x: 0, y: angle, z: 0, w: 1 }, true);
        }
    }

    // Animation (Idle/Run)
    if (group.current && !isAttacking.current) {
      const freq = state === 'chase' ? 15 : 8;
      group.current.position.y = Math.sin(clockState.clock.elapsedTime * freq) * 0.1;
      
      if (state === 'search' && Math.sin(clockState.clock.elapsedTime * 2) > 0.8) {
         group.current.rotation.x = 0.3;
      } else {
         group.current.rotation.x = 0;
      }
    }

    if (isTarget && targetIndicatorRef.current) {
      targetIndicatorRef.current.rotation.y += 0.05;
      const scale = 1 + Math.sin(clockState.clock.elapsedTime * 5) * 0.1;
      targetIndicatorRef.current.scale.set(scale, scale, scale);
    }
  });

  const handleHit = (impactPos?: THREE.Vector3) => {
    if (isDead) return;

    // Reduce damage if blocking
    const damage = isBlocking ? 5 : 15;
    const newHealth = health - damage;
    
    if (rigidBody.current) {
      const pos = rigidBody.current.translation();
      // Blood effect at impact or center
      addEffect(impactPos ? [impactPos.x, impactPos.y, impactPos.z] : [pos.x, pos.y + 0.5, pos.z], 'blood');
      
      // Dust/Impact effect
      addEffect(impactPos ? [impactPos.x, impactPos.y, impactPos.z] : [pos.x, pos.y + 0.5, pos.z], 'impact');

      // Knockback
      if (playerRef.current) {
          const playerPos = playerRef.current.translation();
          const knockbackDir = new THREE.Vector3(pos.x - playerPos.x, 0, pos.z - playerPos.z).normalize();
          // Less knockback if blocking
          const knockbackForce = isBlocking ? 5 : 10;
          rigidBody.current.applyImpulse({ x: knockbackDir.x * knockbackForce, y: 2, z: knockbackDir.z * knockbackForce }, true);
      }
    }

    if (newHealth <= 0) {
      setIsDead(true);
      addScore(50);
      incrementKills();
      
      if (rigidBody.current) {
        const pos = rigidBody.current.translation();
        addEffect([pos.x, pos.y, pos.z], 'smoke');

        // Death knockback
        rigidBody.current.setLinvel({ 
          x: (Math.random() - 0.5) * 5, 
          y: 2, 
          z: (Math.random() - 0.5) * 5 
        }, true);
      }

      setTimeout(() => {
        removeEnemy(id);
      }, 2000);
    } else {
      damageEnemy(id, damage);
      setIsStaggered(true);
      setState('chase');
      lastSeenPlayer.current = Date.now();
      
      // Stagger animation (visual shake)
      if (group.current) {
          // Lean back and shake
          group.current.rotation.x = -0.5;
          group.current.position.y = 0.2;
          
          let shakeCount = 0;
          const shakeInterval = setInterval(() => {
              if (group.current) {
                  group.current.rotation.z = (Math.random() - 0.5) * 0.5;
                  group.current.position.x = (Math.random() - 0.5) * 0.2;
              }
              shakeCount++;
              if (shakeCount > 5) {
                  clearInterval(shakeInterval);
                  if (group.current) {
                      group.current.rotation.z = 0;
                      group.current.rotation.x = 0;
                      group.current.position.x = 0;
                      group.current.position.y = 0;
                  }
              }
          }, 50);
      }

      setTimeout(() => {
        setIsStaggered(false);
      }, 500);
    }
  };

  return (
    <RigidBody
      ref={rigidBody}
      position={position}
      colliders={false}
      enabledRotations={[false, true, false]}
      userData={{ type: 'enemy', id }}
      onCollisionEnter={({ other }) => {
        if (other.rigidBodyObject?.userData?.type === 'stone') {
          // Try to get contact point if available, otherwise undefined
          handleHit();
        }
      }}
    >
      <CapsuleCollider args={[0.4, 0.4]} position={[0, 0.4, 0]} /> {/* Increased collider size */}
      <group ref={group} scale={SCALE}> {/* Scaled based on type */}
        
        {/* Health Bar */}
        {!isDead && (
          <Html position={[0, 1.5, 0]} center>
            <div className="w-16 h-2 bg-gray-700 border border-black rounded overflow-hidden">
              <div 
                className="h-full bg-red-600 transition-all duration-200"
                style={{ width: `${(health / maxHealth) * 100}%` }}
              />
            </div>
          </Html>
        )}

        {/* Enemy Body - High Res & Menacing */}
        <group position={[0, 0.4, 0]}>
           {/* Main Body - Muscular */}
          <mesh castShadow position={[0, 0.1, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={type === 'bear' ? [0.45, 1.0, 16, 32] : type === 'lion' ? [0.35, 1.1, 16, 32] : [0.35, 0.9, 8, 16]} />
            <meshStandardMaterial color={isStaggered ? "#800" : BODY_COLOR} roughness={0.9} />
          </mesh>
          
          {/* Fur/Mane - Spiky and dark */}
          {type === 'lion' ? (
            <group position={[0, 0.4, 0.4]} rotation={[-0.2, 0, 0]}>
               {/* Main Mane */}
               <mesh>
                 <torusGeometry args={[0.38, 0.25, 16, 32]} />
                 <meshStandardMaterial color={MANE_COLOR} roughness={1} />
               </mesh>
               {/* Secondary Mane layer for volume */}
               <mesh position={[0, 0, -0.15]} scale={1.1}>
                 <torusGeometry args={[0.35, 0.2, 16, 32]} />
                 <meshStandardMaterial color={MANE_COLOR} roughness={1} />
               </mesh>
               {/* Spiky bits of mane */}
               {[...Array(8)].map((_, i) => (
                 <mesh key={i} position={[Math.cos(i * Math.PI / 4) * 0.4, Math.sin(i * Math.PI / 4) * 0.4, 0]} rotation={[0, 0, i * Math.PI / 4]}>
                   <coneGeometry args={[0.1, 0.3, 4]} />
                   <meshStandardMaterial color={MANE_COLOR} roughness={1} />
                 </mesh>
               ))}
            </group>
          ) : type === 'bear' ? (
            <>
              {/* Bear Ears */}
              <mesh position={[0.25, 0.6, 0.5]}>
                <sphereGeometry args={[0.12, 16, 16]} />
                <meshStandardMaterial color={BODY_COLOR} roughness={0.9} />
              </mesh>
              <mesh position={[-0.25, 0.6, 0.5]}>
                <sphereGeometry args={[0.12, 16, 16]} />
                <meshStandardMaterial color={BODY_COLOR} roughness={0.9} />
              </mesh>
              {/* Hump */}
              <mesh position={[0, 0.55, 0.1]}>
                <sphereGeometry args={[0.3, 16, 16]} />
                <meshStandardMaterial color={BODY_COLOR} roughness={0.9} />
              </mesh>
              {/* Thicker Neck */}
              <mesh position={[0, 0.3, 0.4]} rotation={[Math.PI / 4, 0, 0]}>
                <cylinderGeometry args={[0.35, 0.4, 0.5, 16]} />
                <meshStandardMaterial color={BODY_COLOR} roughness={0.9} />
              </mesh>
            </>
          ) : (
            <>
              <mesh position={[0, 0.45, -0.3]} rotation={[-0.5, 0, 0]}>
                 <coneGeometry args={[0.15, 0.5, 8]} />
                 <meshStandardMaterial color={MANE_COLOR} />
              </mesh>
              <mesh position={[0, 0.45, 0]} rotation={[-0.3, 0, 0]}>
                 <coneGeometry args={[0.15, 0.5, 8]} />
                 <meshStandardMaterial color={MANE_COLOR} />
              </mesh>
              <mesh position={[0, 0.45, 0.3]} rotation={[-0.1, 0, 0]}>
                 <coneGeometry args={[0.15, 0.5, 8]} />
                 <meshStandardMaterial color={MANE_COLOR} />
              </mesh>
            </>
          )}

          {/* Head - More detailed */}
          <group position={[0, 0.4, 0.7]}>
            <mesh castShadow>
              <boxGeometry args={type === 'bear' ? [0.55, 0.5, 0.6] : type === 'lion' ? [0.45, 0.55, 0.65] : [0.45, 0.5, 0.6]} />
              <meshStandardMaterial color={isStaggered ? "#800" : BODY_COLOR} roughness={0.9} />
            </mesh>
            
            {/* Glowing Eyes - Angled */}
            <mesh position={[0.18, 0.1, 0.25]} rotation={[0, -0.2, 0]}>
              <sphereGeometry args={[0.08, 16, 16]} />
              <meshStandardMaterial color={EYE_COLOR} emissive={EYE_COLOR} emissiveIntensity={4} />
            </mesh>
            <mesh position={[-0.18, 0.1, 0.25]} rotation={[0, 0.2, 0]}>
              <sphereGeometry args={[0.08, 16, 16]} />
              <meshStandardMaterial color={EYE_COLOR} emissive={EYE_COLOR} emissiveIntensity={4} />
            </mesh>
            
            {/* Brow Ridge */}
             <mesh position={[0, 0.25, 0.28]} rotation={[0.2, 0, 0]}>
               <boxGeometry args={type === 'bear' ? [0.6, 0.15, 0.2] : [0.5, 0.1, 0.2]} />
               <meshStandardMaterial color={MANE_COLOR} roughness={0.9} />
             </mesh>

            {/* Snout & Teeth - Longer and sharper */}
            <mesh castShadow position={[0, -0.1, 0.5]}>
              <boxGeometry args={type === 'bear' ? [0.35, 0.3, 0.5] : type === 'lion' ? [0.3, 0.25, 0.6] : [0.28, 0.25, 0.5]} />
              <meshStandardMaterial color={type === 'bear' ? BODY_COLOR : MANE_COLOR} roughness={0.9} />
            </mesh>
            
            {/* Nose */}
            <mesh position={[0, 0.05, type === 'lion' ? 0.8 : 0.75]}>
              <sphereGeometry args={[0.06, 8, 8]} />
              <meshStandardMaterial color="#111" roughness={0.5} />
            </mesh>
            
            {/* Fangs */}
            <mesh position={[0.1, -0.25, 0.6]} rotation={[Math.PI, 0, 0]}>
               <coneGeometry args={type === 'bear' ? [0.05, 0.15, 8] : type === 'lion' ? [0.04, 0.2, 8] : [0.04, 0.15, 8]} />
               <meshStandardMaterial color="#ffffee" roughness={0.2} />
            </mesh>
            <mesh position={[-0.1, -0.25, 0.6]} rotation={[Math.PI, 0, 0]}>
               <coneGeometry args={type === 'bear' ? [0.05, 0.15, 8] : type === 'lion' ? [0.04, 0.2, 8] : [0.04, 0.15, 8]} />
               <meshStandardMaterial color="#ffffee" roughness={0.2} />
            </mesh>

            {/* Ears */}
            {type === 'wolf' && (
              <>
                <mesh position={[0.2, 0.35, -0.1]} rotation={[-0.2, 0, 0.2]}>
                  <coneGeometry args={[0.1, 0.35, 8]} />
                  <meshStandardMaterial color={BODY_COLOR} />
                </mesh>
                <mesh position={[-0.2, 0.35, -0.1]} rotation={[-0.2, 0, -0.2]}>
                  <coneGeometry args={[0.1, 0.35, 8]} />
                  <meshStandardMaterial color={BODY_COLOR} />
                </mesh>
              </>
            )}
            {type === 'lion' && (
              <>
                <mesh position={[0.25, 0.25, -0.1]} rotation={[-0.2, 0, 0.2]}>
                  <sphereGeometry args={[0.1, 8, 8]} />
                  <meshStandardMaterial color={BODY_COLOR} />
                </mesh>
                <mesh position={[-0.25, 0.25, -0.1]} rotation={[-0.2, 0, -0.2]}>
                  <sphereGeometry args={[0.1, 8, 8]} />
                  <meshStandardMaterial color={BODY_COLOR} />
                </mesh>
              </>
            )}
          </group>

          {/* Legs - Thicker */}
          <group>
              <mesh position={[0.25, -0.4, 0.4]} rotation={[0.2, 0, 0]}>
                 <cylinderGeometry args={[0.08, 0.06, 0.7, 8]} />
                 <meshStandardMaterial color={BODY_COLOR} />
              </mesh>
              <mesh position={[-0.25, -0.4, 0.4]} rotation={[0.2, 0, 0]}>
                 <cylinderGeometry args={[0.08, 0.06, 0.7, 8]} />
                 <meshStandardMaterial color={BODY_COLOR} />
              </mesh>
              <mesh position={[0.25, -0.4, -0.4]} rotation={[-0.2, 0, 0]}>
                 <cylinderGeometry args={[0.08, 0.06, 0.7, 8]} />
                 <meshStandardMaterial color={BODY_COLOR} />
              </mesh>
              <mesh position={[-0.25, -0.4, -0.4]} rotation={[-0.2, 0, 0]}>
                 <cylinderGeometry args={[0.08, 0.06, 0.7, 8]} />
                 <meshStandardMaterial color={BODY_COLOR} />
              </mesh>
          </group>
          
          {/* Tail - Bushy */}
          {type === 'wolf' && (
            <mesh position={[0, 0.2, -0.6]} rotation={[-0.4, 0, 0]}>
               <cylinderGeometry args={[0.1, 0.02, 0.8, 8]} />
               <meshStandardMaterial color={BODY_COLOR} />
            </mesh>
          )}
          {type === 'lion' && (
            <group position={[0, 0.2, -0.6]} rotation={[-0.4, 0, 0]}>
               <cylinderGeometry args={[0.03, 0.03, 0.8, 8]} />
               <meshStandardMaterial color={BODY_COLOR} />
               <mesh position={[0, -0.4, 0]}>
                 <sphereGeometry args={[0.08, 8, 8]} />
                 <meshStandardMaterial color={MANE_COLOR} />
               </mesh>
            </group>
          )}
          {type === 'bear' && (
            <mesh position={[0, 0.2, -0.4]} rotation={[-0.4, 0, 0]}>
               <sphereGeometry args={[0.15, 8, 8]} />
               <meshStandardMaterial color={BODY_COLOR} />
            </mesh>
          )}
        </group>
      </group>
    </RigidBody>
  );
}
