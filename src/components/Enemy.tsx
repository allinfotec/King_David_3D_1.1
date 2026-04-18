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
  type: 'wolf' | 'bear' | 'lion' | 'philistine_soldier' | 'philistine_archer' | 'philistine_heavy' | 'goliath';
}

export function Enemy({ id, position, health, maxHealth, type }: EnemyProps) {
  const rigidBody = useRef<RapierRigidBody>(null);
  const group = useRef<THREE.Group>(null);
  const { removeEnemy, addScore, takeDamage, damageEnemy, addEffect, isPaused, isDodging, incrementKills, targetId } = useStore();
  const isTarget = targetId === id;
  const targetIndicatorRef = useRef<THREE.Group>(null);
  
  const [isStaggered, setIsStaggered] = useState(false);
  const [isDead, setIsDead] = useState(false);
  const isDeadRef = useRef(false);
  const [isDodgingEnemy, setIsDodgingEnemy] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const dodgeDir = useRef<number>(0);
  const tailRef = useRef<THREE.Group>(null);
  const jawRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const legFLRef = useRef<THREE.Group>(null);
  const legFRRef = useRef<THREE.Group>(null);
  const legBLRef = useRef<THREE.Group>(null);
  const legBRRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (rigidBody.current) {
      enemyRefs.set(id, rigidBody.current);
    }
    return () => {
      enemyRefs.delete(id);
    };
  }, [id, rigidBody.current]);
  
  // AI State
  const [state, setState] = useState<'chase' | 'search' | 'flank' | 'evade' | 'wait' | 'patrol' | 'flee' | 'berserk'>('patrol');
  const searchTarget = useRef<THREE.Vector3 | null>(null);
  const patrolTarget = useRef<THREE.Vector3 | null>(null);
  const flankAngle = useRef<number>(Math.random() > 0.5 ? 1 : -1);
  const lastStateChange = useRef<number>(0);
  const lastSeenPlayer = useRef<number>(0);

  const lastAttackTime = useRef<number>(0);
  const attackStartTime = useRef<number>(0);
  const lastRoarTime = useRef<number>(0);
  const ATTACK_COOLDOWN = type === 'bear' ? 3000 : type === 'lion' ? 1500 : 2000;
  const isAttacking = useRef(false);
  const currentAttackType = useRef<'normal' | 'slam' | 'charge' | 'sweep'>('normal');
  const attackHitApplied = useRef(false);
  const isHumanoid = type.startsWith('philistine') || type === 'goliath';

  // Stats based on type
  const getEnemySpeed = () => {
    if (type === 'goliath') return health < maxHealth / 2 ? 6.5 : 4.0;
    if (type === 'philistine_heavy') return 4.0;
    if (type === 'philistine_archer') return 5.5;
    if (type === 'philistine_soldier') return 5.0;
    return type === 'bear' ? 4.5 : type === 'lion' ? 8.5 : 6.0;
  };

  const getAttackDamage = () => {
    if (type === 'goliath') return health < maxHealth / 2 ? 80 : 50;
    if (type === 'philistine_heavy') return 30;
    if (type === 'philistine_archer') return 15;
    if (type === 'philistine_soldier') return 20;
    return type === 'bear' ? 25 : type === 'lion' ? 35 : 15;
  };

  const getScale = () => {
    if (type === 'goliath') return 4.0;
    if (type === 'philistine_heavy') return 1.2;
    if (type === 'philistine_archer') return 1.0;
    if (type === 'philistine_soldier') return 1.1;
    return type === 'bear' ? 1.45 : type === 'lion' ? 1.5 : 0.95;
  };

  const ENEMY_SPEED = getEnemySpeed();
  const ATTACK_DAMAGE = getAttackDamage();
  const SCALE = getScale();
  
  const getBodyColor = () => {
    if (type === 'goliath') return '#d4af37'; // Gold
    if (type === 'philistine_heavy') return '#37474f'; // Darker iron
    if (type === 'philistine_archer') return '#5d4037'; // Darker leather
    if (type === 'philistine_soldier') return '#263238'; // Darker slate
    return type === 'bear' ? '#4a2e15' : type === 'lion' ? '#f4d03f' : '#45454a';
  };

  const BODY_COLOR = getBodyColor();
  const MANE_COLOR = type === 'bear' ? '#2e1c0d' : type === 'lion' ? '#8b3a1a' : '#222225'; // Darker grey for wolf ruff
  const EYE_COLOR = type === 'bear' ? '#ff4400' : type === 'lion' ? '#ffaa00' : '#ff2200'; // Piercing red/orange for wolf
  const NOSE_COLOR = type === 'lion' ? '#3e2723' : '#111'; // Dark brown nose for lion
  const TONGUE_COLOR = '#e91e63'; // Pink tongue

  const prevHealth = useRef(health);
  const hitEffectTime = useRef(0);
  
  useEffect(() => {
    if (health < prevHealth.current && health > 0) {
        hitEffectTime.current = Date.now();
        // Shake body on hit instantly 
        if (group.current) {
            group.current.position.y += 0.2; // slight knock up
        }
        
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/216/216-preview.mp3');
        audio.volume = 0.6 * useStore.getState().volume;
        audio.playbackRate = 1.0 + Math.random() * 0.2;
        audio.play().catch(() => {});
    }
    prevHealth.current = health;
  }, [health]);

  // Listen for player attacks to trigger dodges/blocks
  useEffect(() => {
    const handlePlayerAttack = (e: CustomEvent) => {
        if (isDeadRef.current || isStaggered || isAttacking.current || isDodgingEnemy || isBlocking) return;
        
        if (!rigidBody.current || !playerRef.current) return;
        
        let enemyPos, playerPos;
        try {
            enemyPos = rigidBody.current.translation();
            playerPos = playerRef.current.translation();
        } catch {
            return;
        }

        const dist = new THREE.Vector3(enemyPos.x, 0, enemyPos.z).distanceTo(new THREE.Vector3(playerPos.x, 0, playerPos.z));
        
        if (dist < 15) {
            const rand = Math.random();
            const isLowHealth = health / maxHealth < 0.3;
            const dodgeChance = isLowHealth ? 0.6 : 0.3; // Double dodge chance when low health
            const blockChance = isLowHealth ? 0.8 : 0.5; // Higher block chance when low health

            if (rand < dodgeChance) {
                // Dodge
                setIsDodgingEnemy(true);
                const dir = new THREE.Vector3(enemyPos.x - playerPos.x, 0, enemyPos.z - playerPos.z).normalize();
                // Add sideways movement
                dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() > 0.5 ? 1 : -1) * Math.PI / 3);
                rigidBody.current.applyImpulse({ x: dir.x * 15, y: 3, z: dir.z * 15 }, true);
                
                dodgeDir.current = dir.x > 0 ? -1 : 1;
                
                // Dodge sound
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2065/2065-preview.mp3');
                audio.volume = 0.4 * useStore.getState().volume;
                audio.playbackRate = 1.5;
                audio.play().catch(() => {});
                
                setTimeout(() => {
                    setIsDodgingEnemy(false);
                    dodgeDir.current = 0;
                }, 600);
            } else if (rand < blockChance) {
                // Block/brace
                setIsBlocking(true);
                
                // Block sound
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/217/217-preview.mp3');
                audio.volume = 0.5 * useStore.getState().volume;
                audio.playbackRate = 0.8;
                audio.play().catch(() => {});
                
                setTimeout(() => {
                    setIsBlocking(false);
                }, 800);
            }
        }
    };
    
    window.addEventListener('attack', handlePlayerAttack as EventListener);
    return () => window.removeEventListener('attack', handlePlayerAttack as EventListener);
  }, [isDead, isStaggered, isDodgingEnemy, isBlocking]);

  useFrame((clockState, delta) => {
    const { health: playerHealth, isTransitioningPhase } = useStore.getState();
    if (!rigidBody.current || !playerRef.current || isPaused || playerHealth <= 0) return;

    if (isTransitioningPhase && !isDead) {
        rigidBody.current.setLinvel({ x: 0, y: rigidBody.current.linvel().y, z: 0 }, true);
        return;
    }

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

    // Dynamic Hit Reaction (Flashing and Shaking)
    if (hitEffectTime.current > 0) {
        const timeSinceHit = Date.now() - hitEffectTime.current;
        if (timeSinceHit < 250) {
            const shakeProgress = timeSinceHit / 250;
            if (group.current) {
                // Intense shaking side-to-side
                group.current.position.x = (Math.random() - 0.5) * 0.5 * (1 - shakeProgress);
                group.current.position.z = (Math.random() - 0.5) * 0.5 * (1 - shakeProgress);
                // Pulse scale
                const scalePulse = SCALE * (1 + 0.2 * Math.sin(shakeProgress * Math.PI));
                group.current.scale.setScalar(scalePulse);
            }
            if (bodyRef.current && bodyRef.current.material) {
                const mat = bodyRef.current.material as THREE.MeshStandardMaterial;
                mat.emissive = new THREE.Color(0xff0000);
                mat.emissiveIntensity = 0.5 * (1 - shakeProgress);
            }
        } else {
            hitEffectTime.current = 0; // Reset
            if (group.current) {
                group.current.position.x = 0;
                group.current.position.z = 0;
                // Scale gradually returns to normal later down below, but we enforce end of hit
            }
            if (bodyRef.current && bodyRef.current.material) {
                const mat = bodyRef.current.material as THREE.MeshStandardMaterial;
                mat.emissive = new THREE.Color(0x000000);
                mat.emissiveIntensity = 0;
            }
        }
    } else if (group.current) {
        // Return to normal scale smoothly
        group.current.scale.setScalar(THREE.MathUtils.lerp(group.current.scale.x, SCALE, 10 * delta));
    }

    if (isDodgingEnemy) {
        // Let physics handle the dodge impulse
        return;
    }

    let enemyPos, playerPos;
    try {
        enemyPos = rigidBody.current.translation();
        playerPos = playerRef.current.translation();
    } catch {
        return; // Physics engine unmounting
    }
    const distToPlayer = new THREE.Vector3(enemyPos.x, 0, enemyPos.z).distanceTo(new THREE.Vector3(playerPos.x, 0, playerPos.z));

    // Line of Sight / Distance check
    const canSeePlayer = distToPlayer < 20;
    const isLowHealth = health / maxHealth < 0.3;

    // State Machine Transitions
    const now = Date.now();
    if (canSeePlayer) {
      lastSeenPlayer.current = now;

      if (isLowHealth && state !== 'evade' && state !== 'flee' && state !== 'berserk' && now - lastStateChange.current > 2000) {
          if (type === 'bear' || type === 'lion') {
              setState('berserk');
              if (type === 'lion') {
                  // Loud berserk roar
                  const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/214/214-preview.mp3');
                  audio.volume = 1.0 * useStore.getState().volume;
                  audio.playbackRate = 0.4 + Math.random() * 0.1; // Very deep, menacing roar
                  audio.play().catch(() => {});
              } else if (type === 'bear') {
                  // Bear berserk roar
                  const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/218/218-preview.mp3');
                  audio.volume = 1.0 * useStore.getState().volume;
                  audio.playbackRate = 0.5 + Math.random() * 0.1;
                  audio.play().catch(() => {});
              }
          } else {
              setState('flee');
          }
          lastStateChange.current = now;
      } else if (!isLowHealth && state !== 'chase' && state !== 'flank' && state !== 'berserk') {
          // Play growl sound when spotting player
          if (state === 'search' || state === 'patrol') {
              let audioUrl = 'https://assets.mixkit.co/active_storage/sfx/214/214-preview.mp3';
              if (type === 'bear') {
                  audioUrl = 'https://assets.mixkit.co/active_storage/sfx/218/218-preview.mp3';
              } else if (type === 'wolf') {
                  audioUrl = 'https://assets.mixkit.co/active_storage/sfx/215/215-preview.mp3';
              }
              const audio = new Audio(audioUrl);
              if (type === 'lion') {
                  audio.volume = 1.0 * useStore.getState().volume;
                  audio.playbackRate = 0.5 + Math.random() * 0.2; // Deep lion roar
              } else if (type === 'bear') {
                  audio.volume = 0.8 * useStore.getState().volume;
                  audio.playbackRate = 0.6 + Math.random() * 0.2; // Bear growl
              } else {
                  audio.volume = 0.5 * useStore.getState().volume;
                  audio.playbackRate = 1.2 + Math.random() * 0.3; // Wolf snarl
              }
              audio.play().catch(() => {});
          }
          setState('chase');
          lastStateChange.current = now;
      }

      // Randomly decide to flank if chasing and close enough
      if (state === 'chase' && distToPlayer < 8 && distToPlayer > 3 && now - lastStateChange.current > 3000) {
          if (Math.random() < 0.4) {
              setState('flank');
              flankAngle.current = Math.random() > 0.5 ? 1 : -1;
              lastStateChange.current = now;
          }
      }

      // Coordinated attacks: Wait if another enemy is already attacking
      if ((state === 'chase' || state === 'berserk') && distToPlayer < 6 && now - lastStateChange.current > 1000) {
          let isAnotherAttacking = false;
          enemyRefs.forEach((ref, enemyId) => {
              if (enemyId !== id) {
                  let otherPos;
                  try {
                      otherPos = ref.translation();
                  } catch { return; }
                  const otherDist = new THREE.Vector3(otherPos.x, 0, otherPos.z).distanceTo(new THREE.Vector3(playerPos.x, 0, playerPos.z));
                  if (otherDist < 4) {
                      isAnotherAttacking = true;
                  }
              }
          });

          if (isAnotherAttacking && Math.random() < 0.6 && state !== 'berserk') {
              setState('wait');
              lastStateChange.current = now;
          }
      }

      // Stop waiting after a while or if player moves away
      if (state === 'wait' && (now - lastStateChange.current > 2000 || distToPlayer > 8)) {
          setState('chase');
          lastStateChange.current = now;
      }

      // Stop flanking after a while or if too close/far
      if (state === 'flank' && (now - lastStateChange.current > 4000 || distToPlayer < 2.5 || distToPlayer > 10)) {
          setState('chase');
          lastStateChange.current = now;
      }

      // Stop evading after a while, maybe try a desperate attack
      if (state === 'evade' && now - lastStateChange.current > 3000) {
          setState('chase');
          lastStateChange.current = now;
      }
      
      // Attack Logic Start
      let attackRange = isHumanoid ? 3.5 : 2.5;
      
      const isEnraged = type === 'goliath' && health < maxHealth / 2;
      
      if (type === 'goliath') attackRange = isEnraged ? 7.0 : 5.5;

      const cooldownMultiplier = (state === 'berserk' || isEnraged) ? 0.4 : 1;
      
      if (distToPlayer < attackRange && !isAttacking.current && now - lastAttackTime.current > (ATTACK_COOLDOWN * cooldownMultiplier)) {
          isAttacking.current = true;
          attackStartTime.current = Date.now();
          attackHitApplied.current = false;
          
          if (type === 'goliath') {
              const r = Math.random();
              if (isEnraged) {
                  // Enraged Goliath favors wild sweeping and rapid charges
                  if (r < 0.20) currentAttackType.current = 'slam';
                  else if (r < 0.60) currentAttackType.current = 'charge';
                  else currentAttackType.current = 'sweep';
              } else {
                  if (r < 0.35) currentAttackType.current = 'slam';
                  else if (r < 0.70) currentAttackType.current = 'charge';
                  else currentAttackType.current = 'sweep';
              }
          } else {
              currentAttackType.current = 'normal';
          }
      }

      // Attack Processing
      if (isAttacking.current) {
          const attackTime = Date.now() - attackStartTime.current;
          let windupDuration = 400;
          let totalDuration = 900;
          
          if (type === 'goliath') {
              if (currentAttackType.current === 'slam') { windupDuration = isEnraged ? 600 : 800; totalDuration = isEnraged ? 1000 : 1400; }
              else if (currentAttackType.current === 'charge') { windupDuration = isEnraged ? 400 : 600; totalDuration = isEnraged ? 800 : 1200; }
              else { windupDuration = isEnraged ? 300 : 500; totalDuration = isEnraged ? 700 : 1000; } // sweep
          }

          // Apply damage / impulse at the moment of strike
          if (attackTime >= windupDuration && !attackHitApplied.current) {
              attackHitApplied.current = true;
              
              if (rigidBody.current && playerRef.current && !isDeadRef.current) {
                  let currentPos, pPos;
                  try {
                      currentPos = rigidBody.current.translation();
                      pPos = playerRef.current.translation();
                  } catch { return; }
                  
                  const lungeDir = new THREE.Vector3(pPos.x - currentPos.x, 0, pPos.z - currentPos.z).normalize();
                  
                  // Movement Impulses based on attack
                  if (type === 'lion') {
                      rigidBody.current.applyImpulse({ x: lungeDir.x * 30, y: 5, z: lungeDir.z * 30 }, true);
                  } else if (type === 'goliath') {
                      const impulseMult = isEnraged ? 1.5 : 1.0;
                      if (currentAttackType.current === 'charge') {
                          rigidBody.current.applyImpulse({ x: lungeDir.x * 120 * impulseMult, y: 2, z: lungeDir.z * 120 * impulseMult }, true);
                      } else if (currentAttackType.current === 'slam') {
                          // Minimal forward momentum, massive downward hit
                          rigidBody.current.applyImpulse({ x: lungeDir.x * 15 * impulseMult, y: -10, z: lungeDir.z * 15 * impulseMult }, true);
                          // Play heavy impact effect
                          const slamRadius = 3;
                          useStore.getState().addEffect([currentPos.x + lungeDir.x * 1.5, currentPos.y, currentPos.z + lungeDir.z * 1.5], 'impact');
                      } else {
                          // Sweep
                          rigidBody.current.applyImpulse({ x: lungeDir.x * 25 * impulseMult, y: 1, z: lungeDir.z * 25 * impulseMult }, true);
                      }
                  } else {
                      rigidBody.current.applyImpulse({ x: lungeDir.x * 20, y: 2, z: lungeDir.z * 20 }, true);
                  }

                  // Damage Calculation
                  const hitDist = new THREE.Vector3(currentPos.x, 0, currentPos.z).distanceTo(new THREE.Vector3(pPos.x, 0, pPos.z));
                  let effectiveRange = type === 'goliath' ? (currentAttackType.current === 'slam' ? 6.0 : 5.0) : 3.5;
                  if (type === 'goliath' && isEnraged) effectiveRange += 1.5;
                  
                  if (hitDist < effectiveRange && !useStore.getState().isDodging) {
                      const isPlayerBlocking = useStore.getState().isBlocking;
                      const isExtraGame = useStore.getState().isExtraGame;
                      
                      let finalDamage = ATTACK_DAMAGE;
                      
                      if (isPlayerBlocking) {
                          // Block sound
                          const blockAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2952/2952-preview.mp3'); 
                          blockAudio.volume = 0.5;
                          blockAudio.playbackRate = 0.5;
                          blockAudio.play().catch(() => {});
                          
                          useStore.getState().addEffect([pPos.x, pPos.y + 1, pPos.z], 'flash');
                          
                          if (isExtraGame) {
                              damageEnemy(id, 25);
                              addEffect([currentPos.x, currentPos.y + 1, currentPos.z], 'impact');
                              window.dispatchEvent(new CustomEvent('attack', { detail: 'knife' }));
                              if (group.current) group.current.position.z -= 0.5; 
                          }
                          
                          // Heavy attacks might break block or do more chip damage
                          if (type === 'goliath' && currentAttackType.current === 'slam') {
                              finalDamage *= 0.5; // Block helps less against giant slam
                              // Optional: stagger player
                          } else {
                              finalDamage *= 0.2;
                          }
                          takeDamage(finalDamage);
                      } else {
                          takeDamage(finalDamage);
                      }
                      
                      // Attack Sound Effect
                      let audioUrl = 'https://assets.mixkit.co/active_storage/sfx/215/215-preview.mp3';
                      if (type === 'bear') audioUrl = 'https://assets.mixkit.co/active_storage/sfx/218/218-preview.mp3';
                      else if (type === 'lion') audioUrl = 'https://assets.mixkit.co/active_storage/sfx/214/214-preview.mp3';
                      else if (type === 'goliath') {
                          if (currentAttackType.current === 'slam') audioUrl = 'https://assets.mixkit.co/active_storage/sfx/218/218-preview.mp3'; // deep roar
                          else audioUrl = 'https://assets.mixkit.co/active_storage/sfx/215/215-preview.mp3'; 
                      }
                      
                      const audio = new Audio(audioUrl); 
                      audio.volume = (type === 'goliath' ? 1.0 : type === 'bear' ? 0.9 : 0.6) * useStore.getState().volume;
                      audio.playbackRate = type === 'goliath' ? 0.5 : type === 'bear' ? 0.7 + Math.random() * 0.2 : 1.4 + Math.random() * 0.3;
                      audio.play().catch(() => {});
                  }
              }
          }

          // Finish Attack
          if (attackTime > totalDuration) {
              isAttacking.current = false;
              lastAttackTime.current = Date.now();
              if (group.current) {
                  group.current.rotation.x = 0;
                  group.current.rotation.y = 0;
                  group.current.rotation.z = 0;
              }
          }
      }

    } else if (now - lastSeenPlayer.current > 5000 && state !== 'search') {
      setState('search');
      searchTarget.current = null;
      lastStateChange.current = now;
    }

    let moveDir = new THREE.Vector3();

    if (!isAttacking.current) {
        if (state === 'chase') {
          moveDir.subVectors(playerPos, enemyPos).normalize();
          
          // Periodic roar for lion during chase
          if (type === 'lion' && now - lastRoarTime.current > 4000) {
              if (Math.random() < 0.4) { // 40% chance every 4 seconds
                  const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/214/214-preview.mp3');
                  audio.volume = 1.0 * useStore.getState().volume;
                  audio.playbackRate = 0.5; // Deeper, longer roar
                  audio.play().catch(() => {});
              }
              lastRoarTime.current = now;
          }
        } else if (state === 'flank') {
          // Move towards player but offset by an angle
          const toPlayer = new THREE.Vector3().subVectors(playerPos, enemyPos).normalize();
          moveDir.copy(toPlayer).applyAxisAngle(new THREE.Vector3(0, 1, 0), flankAngle.current * Math.PI / 2.5);
        } else if (state === 'evade') {
          // Move away from player, slightly randomized
          moveDir.subVectors(enemyPos, playerPos).normalize();
          moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * Math.PI / 2);
        } else if (state === 'wait') {
          // Circle the player slowly
          const toPlayer = new THREE.Vector3().subVectors(playerPos, enemyPos).normalize();
          moveDir.copy(toPlayer).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
        } else if (state === 'search' || state === 'patrol') {
          const targetRef = state === 'patrol' ? patrolTarget : searchTarget;
          const radius = state === 'patrol' ? 15 : 5;
          if (!targetRef.current || new THREE.Vector3(enemyPos.x, 0, enemyPos.z).distanceTo(new THREE.Vector3(targetRef.current.x, 0, targetRef.current.z)) < 1) {
             const angle = Math.random() * Math.PI * 2;
             const r = radius + Math.random() * radius;
             targetRef.current = new THREE.Vector3(
               enemyPos.x + Math.cos(angle) * r,
               enemyPos.y,
               enemyPos.z + Math.sin(angle) * r
             );
          }
          moveDir.subVectors(targetRef.current, enemyPos).normalize();
        } else if (state === 'flee') {
          // Move directly away from player
          moveDir.subVectors(enemyPos, playerPos).normalize();
          // Add some randomness to not get stuck in corners as easily
          moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * Math.PI / 4);
        } else if (state === 'berserk') {
          // Move directly towards player, ignoring flanking
          moveDir.subVectors(playerPos, enemyPos).normalize();
        }
    }

    // Apply movement
    let speed = ENEMY_SPEED;
    if (state === 'search') speed *= 0.5;
    if (state === 'patrol') speed *= 0.3; // Slower than search
    if (state === 'evade') speed *= 1.2; // Run away faster
    if (state === 'flee') speed *= 1.5; // Flee very fast
    if (state === 'flank') speed *= 0.9; // Flank slightly slower than direct chase
    if (state === 'wait') speed *= 0.4; // Circle slowly while waiting
    if (state === 'berserk') speed *= 1.3; // Berserk is faster

    const currentVel = rigidBody.current.linvel();
    
    if (!isAttacking.current) {
        rigidBody.current.setLinvel({ x: moveDir.x * speed, y: currentVel.y, z: moveDir.z * speed }, true);
        
        // Face movement direction
        if (moveDir.lengthSq() > 0.1) {
          const angle = Math.atan2(moveDir.x, moveDir.z);
          const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
          rigidBody.current.setRotation(q, true);
        }
    }

    // Animation (Idle/Run/Dodge/Block/Stagger/Attack)
    if (group.current) {
      const lerpFactor = 1 - Math.exp(-15 * delta);
      let freq = 8;
      if (state === 'chase') freq = 15;
      if (state === 'evade') freq = 20;
      if (state === 'flank') freq = 12;
      if (state === 'wait') freq = 6;

      if (isAttacking.current) {
          const attackTime = Date.now() - attackStartTime.current;
          let windupDuration = 400;
          let totalDuration = 900;
          
          if (type === 'goliath') {
              if (currentAttackType.current === 'slam') { windupDuration = 800; totalDuration = 1400; }
              else if (currentAttackType.current === 'charge') { windupDuration = 600; totalDuration = 1200; }
              else { windupDuration = 500; totalDuration = 1000; } // sweep
          }

          // Wind up
          if (attackTime < windupDuration) {
              const progress = attackTime / windupDuration;
              if (type === 'goliath') {
                  if (currentAttackType.current === 'slam') {
                      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, 0.5, progress * 0.2);
                      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -0.3, progress * 0.2); // lean back
                      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0.2, progress * 0.2); 
                      if(legFRRef.current) legFRRef.current.rotation.x = THREE.MathUtils.lerp(legFRRef.current.rotation.x, -2.8, progress * 0.5); // raise spear hugely
                  } else if (currentAttackType.current === 'charge') {
                      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, -0.2, progress * 0.2);
                      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0.4, progress * 0.2); // lean forward for charge
                      if(legFRRef.current) legFRRef.current.rotation.x = THREE.MathUtils.lerp(legFRRef.current.rotation.x, -1.0, progress * 0.3); // point spear forward
                  } else { // sweep
                      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 1.2, progress * 0.3); // twist far right
                      if(legFRRef.current) legFRRef.current.rotation.z = THREE.MathUtils.lerp(legFRRef.current.rotation.z, -1.0, progress * 0.3); // pull arm out
                  }
              } else if (type === 'bear') {
                  group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, 1.0, progress * 0.2);
                  group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -0.6, progress * 0.2);
              } else if (type === 'lion') {
                  group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, -0.2, progress * 0.2);
                  group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -0.3, progress * 0.2);
              } else {
                  group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, 0.2, progress * 0.2);
                  group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -0.5, progress * 0.2);
              }
          } else if (attackTime < totalDuration) {
              // Lunge
              const progress = (attackTime - windupDuration) / (totalDuration - windupDuration);
              if (type === 'goliath') {
                  if (currentAttackType.current === 'slam') {
                      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, -0.3, progress);
                      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0.6, progress);
                      if(legFRRef.current) legFRRef.current.rotation.x = THREE.MathUtils.lerp(legFRRef.current.rotation.x, 1.5, progress * 2); // smash down
                  } else if (currentAttackType.current === 'charge') {
                      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, Math.sin(progress * Math.PI * 4) * 0.2, progress); // bouncy charge
                      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0.5, progress); 
                  } else { // sweep
                      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, -1.2, progress * 1.5); // rapid sweeping twist left
                      if(legFRRef.current) legFRRef.current.rotation.z = THREE.MathUtils.lerp(legFRRef.current.rotation.z, 0, progress); // arm comes across
                  }
              } else if (type === 'bear') {
                  group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, 0, progress);
                  group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0.6, progress);
              } else if (type === 'lion') {
                  group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, 0.5, progress);
                  group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0.4, progress);
              } else {
                  group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0.5, progress);
              }
          }
      } else {
          if (isDodgingEnemy) {
          // Quick sidestep, no spin
          group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, dodgeDir.current * 0.3, lerpFactor * 0.8);
          group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, 0.2, lerpFactor);
      } else if (isBlocking) {
          // Smooth block crouch
          group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, -0.3, lerpFactor);
          group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0.4, lerpFactor);
          group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0, lerpFactor);
      } else if (isStaggered) {
          // Stagger is handled in handleHit, but we can smooth return
          group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0, lerpFactor);
      } else {
          // Normal movement animation
          if (type === 'goliath' && (state === 'chase' || state === 'evade' || state === 'flank' || state === 'flee' || state === 'berserk')) {
              const walkCycle = clockState.clock.elapsedTime * freq * 0.6; // slow
              group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, Math.abs(Math.sin(walkCycle * 2)) * 0.15, lerpFactor);
              group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, Math.sin(walkCycle) * 0.08, lerpFactor); // side to side sway
              group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0.1, lerpFactor);
          } else if (type === 'lion' && (state === 'chase' || state === 'evade' || state === 'flank' || state === 'flee' || state === 'berserk')) {
             // Feline bounding run - more aggressive and lower to the ground
             const runCycle = clockState.clock.elapsedTime * freq * 0.8;
             group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, Math.abs(Math.sin(runCycle)) * 0.6 - 0.1, lerpFactor);
             group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, Math.cos(runCycle) * 0.35, lerpFactor);
             group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, Math.sin(runCycle * 0.5) * 0.1, lerpFactor); // Shoulder roll
          } else if (type === 'bear' && (state === 'chase' || state === 'evade' || state === 'flank' || state === 'flee' || state === 'berserk')) {
             // Heavy lumbering walk
             group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, Math.abs(Math.sin(clockState.clock.elapsedTime * freq * 0.5)) * 0.15, lerpFactor);
             group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, Math.sin(clockState.clock.elapsedTime * freq * 0.5) * 0.1, lerpFactor); // Side to side sway
             group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, Math.cos(clockState.clock.elapsedTime * freq * 0.5) * 0.05, lerpFactor);
          } else if (type === 'wolf' && (state === 'chase' || state === 'evade' || state === 'flank' || state === 'flee' || state === 'berserk')) {
             // Wolf bounding run - sleek and fast
             const runCycle = clockState.clock.elapsedTime * freq;
             group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, Math.abs(Math.sin(runCycle)) * 0.4 - 0.05, lerpFactor);
             group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, Math.cos(runCycle) * 0.2 + 0.1, lerpFactor); // Leaning forward
             group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, Math.sin(runCycle * 0.5) * 0.05, lerpFactor);
          } else {
             group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, Math.sin(clockState.clock.elapsedTime * freq) * 0.1, lerpFactor);
          }
          
          if ((state === 'search' || state === 'patrol') && Math.sin(clockState.clock.elapsedTime * 2) > 0.8) {
             group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0.3, lerpFactor); // Sniffing ground
          } else if ((state === 'evade' || state === 'flee') && type !== 'lion' && type !== 'bear') {
             group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -0.2, lerpFactor); // Leaning back while running
          } else if (state === 'flank') {
             group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, flankAngle.current * 0.2, lerpFactor); // Leaning into the flank
          } else if (state === 'wait') {
             group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0.1, lerpFactor); // Slightly hunched
          } else if (state === 'berserk') {
             group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0.2, lerpFactor); // Leaning forward aggressively
          } else if (type !== 'lion' && type !== 'bear' && type !== 'goliath') {
             group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0, lerpFactor);
             group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0, lerpFactor);
          }
      }
      }
      
      // Leg Animation
      if (legFLRef.current && legFRRef.current && legBLRef.current && legBRRef.current) {
          const isMoving = state === 'chase' || state === 'evade' || state === 'flank' || state === 'search' || state === 'patrol' || state === 'flee' || state === 'berserk';
          const speedMultiplier = (state === 'search' || state === 'patrol') ? 0.5 : (state === 'chase' || state === 'berserk' || state === 'flee') ? 1.5 : 1;
          const swingFreq = freq * speedMultiplier;
          const swingAmp = isMoving ? 0.6 : 0;
          
          if (!isAttacking.current) {
              if (type === 'goliath') {
                  const walkCycle = clockState.clock.elapsedTime * swingFreq * 0.6;
                  legFLRef.current.rotation.x = -0.5 + Math.sin(walkCycle) * (swingAmp * 0.3); // Shield arm held forward
                  legFRRef.current.rotation.x = Math.sin(walkCycle + Math.PI) * (swingAmp * 0.3); // Spear arm somewhat stable
                  legBLRef.current.rotation.x = Math.sin(walkCycle + Math.PI) * swingAmp;
                  legBRRef.current.rotation.x = Math.sin(walkCycle) * swingAmp;
              } else if (type === 'lion' && (state === 'chase' || state === 'evade' || state === 'flee' || state === 'berserk')) {
                  // Bounding run for lion
                  const runCycle = clockState.clock.elapsedTime * swingFreq * 0.8;
                  legFLRef.current.rotation.x = Math.sin(runCycle) * swingAmp;
                  legFRRef.current.rotation.x = Math.sin(runCycle + 0.5) * swingAmp; // Slight offset
                  legBLRef.current.rotation.x = -Math.sin(runCycle) * swingAmp;
                  legBRRef.current.rotation.x = -Math.sin(runCycle + 0.5) * swingAmp;
              } else {
                  // Alternating trot/walk
                  const runCycle = clockState.clock.elapsedTime * swingFreq;
                  legFLRef.current.rotation.x = Math.sin(runCycle) * swingAmp;
                  legFRRef.current.rotation.x = Math.sin(runCycle + Math.PI) * swingAmp;
                  legBLRef.current.rotation.x = Math.sin(runCycle + Math.PI) * swingAmp;
                  legBRRef.current.rotation.x = Math.sin(runCycle) * swingAmp;
              }
          }
      }

      // Breathing and Head Bobbing
      if (bodyRef.current && headRef.current) {
          if (state === 'wait' || state === 'search' || state === 'patrol') {
              // Breathing
              const breath = Math.sin(clockState.clock.elapsedTime * 2) * 0.05;
              bodyRef.current.scale.set(1 + breath, 1, 1 + breath);
              
              // Head looking around
              if (state === 'wait' || state === 'patrol') {
                  headRef.current.rotation.y = Math.sin(clockState.clock.elapsedTime * 1.5) * 0.4;
                  headRef.current.rotation.x = Math.sin(clockState.clock.elapsedTime * 1) * 0.1;
              }
          } else {
              bodyRef.current.scale.set(1, 1, 1);
              headRef.current.rotation.y = 0;
              // Head bobbing while running
              if (type === 'lion' && (state === 'chase' || state === 'berserk')) {
                  headRef.current.rotation.x = Math.sin(clockState.clock.elapsedTime * freq * 0.8) * 0.2;
              } else {
                  headRef.current.rotation.x = 0;
              }
          }
      }
    }

    if (tailRef.current) {
        if (type === 'lion') {
            const tailSpeed = (state === 'chase' || state === 'evade') ? 15 : 5;
            // More dynamic tail movement for lion, curving upwards
            tailRef.current.rotation.y = Math.sin(clockState.clock.elapsedTime * tailSpeed) * 0.5;
            tailRef.current.rotation.x = 0.5 + Math.cos(clockState.clock.elapsedTime * tailSpeed * 0.5) * 0.3; // Curved up
            tailRef.current.rotation.z = Math.sin(clockState.clock.elapsedTime * tailSpeed * 0.8) * 0.2;
        } else if (type === 'wolf') {
            const tailSpeed = (state === 'chase' || state === 'evade' || state === 'flee') ? 20 : 8;
            // Wolf tail straight out when running, down when walking
            const baseRotX = (state === 'chase' || state === 'evade' || state === 'flee') ? 0.2 : -0.4;
            tailRef.current.rotation.y = Math.sin(clockState.clock.elapsedTime * tailSpeed) * 0.3;
            tailRef.current.rotation.x = THREE.MathUtils.lerp(tailRef.current.rotation.x, baseRotX + Math.cos(clockState.clock.elapsedTime * tailSpeed * 0.5) * 0.1, 5 * delta);
        }
    }

    if (jawRef.current && type === 'lion') {
        if (isAttacking.current) {
            jawRef.current.rotation.x = THREE.MathUtils.lerp(jawRef.current.rotation.x, 0.6, 10 * delta);
        } else if (state === 'chase') {
            jawRef.current.rotation.x = 0.1 + Math.abs(Math.sin(clockState.clock.elapsedTime * 10)) * 0.2;
        } else {
            jawRef.current.rotation.x = THREE.MathUtils.lerp(jawRef.current.rotation.x, 0.1, 5 * delta);
        }
    }

    if (isTarget && targetIndicatorRef.current) {
      targetIndicatorRef.current.rotation.y += 0.05;
      const scale = 1 + Math.sin(clockState.clock.elapsedTime * 5) * 0.1;
      targetIndicatorRef.current.scale.set(scale, scale, scale);
    }
  });

  const handleHit = (impactPos?: THREE.Vector3) => {
    if (isDeadRef.current) return;

    // Reduce damage if blocking
    const damage = isBlocking ? 5 : 15;
    const newHealth = health - damage;
    
    if (rigidBody.current) {
      let pos, playerPos;
      try {
        pos = rigidBody.current.translation();
        if (playerRef.current) {
            playerPos = playerRef.current.translation();
        }
      } catch { return; }
      
      // Blood effect at impact or center
      addEffect(impactPos ? [impactPos.x, impactPos.y, impactPos.z] : [pos.x, pos.y + 0.5, pos.z], 'blood');
      
      // Dust/Impact effect
      addEffect(impactPos ? [impactPos.x, impactPos.y, impactPos.z] : [pos.x, pos.y + 0.5, pos.z], 'impact');

      // Knockback
      if (playerPos) {
          const knockbackDir = new THREE.Vector3(pos.x - playerPos.x, 0, pos.z - playerPos.z).normalize();
          // Less knockback if blocking
          const knockbackForce = isBlocking ? 5 : 10;
          rigidBody.current.applyImpulse({ x: knockbackDir.x * knockbackForce, y: 2, z: knockbackDir.z * knockbackForce }, true);
      }
    }

    if (newHealth <= 0) {
      isDeadRef.current = true;
      setIsDead(true);
      const scoreAmount = type === 'goliath' ? 5000 : type === 'lion' ? 500 : type === 'bear' ? 200 : 100;
      addScore(scoreAmount);
      
      if (useStore.getState().isExtraGame) {
          const coinAmount = type === 'goliath' ? 1000 : type === 'philistine_heavy' ? 50 : type === 'philistine_archer' ? 30 : 20;
          useStore.getState().addCoins(coinAmount);
          useStore.getState().addFaith(5); // 5% faith per kill
      }
      
      incrementKills();
      
      if (rigidBody.current) {
        let pos;
        try {
            pos = rigidBody.current.translation();
        } catch { return; }
        addEffect([pos.x, pos.y, pos.z], 'smoke');
        addEffect([pos.x, pos.y + 1, pos.z], 'smoke');
        addEffect([pos.x, pos.y + 0.5, pos.z], 'blood');
        addEffect([pos.x, pos.y + 0.5, pos.z], 'flash');

        // Death knockback
        rigidBody.current.setLinvel({ 
          x: (Math.random() - 0.5) * 5, 
          y: 2, 
          z: (Math.random() - 0.5) * 5 
        }, true);
      }

      setTimeout(() => {
        enemyRefs.delete(id);
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
          
          // Play hit sound based on type
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/216/216-preview.mp3');
          audio.volume = (type === 'bear' ? 0.7 : type === 'lion' ? 0.9 : 0.5) * useStore.getState().volume;
          audio.playbackRate = type === 'bear' ? 0.7 : type === 'lion' ? 0.8 : 1.2;
          audio.play().catch(() => {});
          
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
        <group position={[0, isHumanoid ? 0.9 : 0.4, 0]}>
           {type === 'goliath' ? (
             <group>
               {/* Torso - Massive Muscle Cuirass */}
               <mesh ref={bodyRef} castShadow position={[0, 0.5, 0]}>
                 <boxGeometry args={[0.7, 0.9, 0.4]} />
                 <meshPhysicalMaterial 
                   color={isStaggered ? "#800" : "#b8860b"} 
                   roughness={0.6} 
                   metalness={0.9}
                   clearcoat={0.3}
                   clearcoatRoughness={0.8}
                   emissive={health < maxHealth / 2 ? "#500" : "#000"}
                   emissiveIntensity={health < maxHealth / 2 ? 0.8 : 0}
                 />
               </mesh>
               
               {/* Enraged Aura */}
               {health < maxHealth / 2 && (
                   <mesh position={[0, 0.5, 0]}>
                       <sphereGeometry args={[1.5, 16, 16]} />
                       <meshBasicMaterial color="#ff0000" transparent opacity={0.15} blending={THREE.AdditiveBlending} depthWrite={false} />
                   </mesh>
               )}

               {/* Pectoral Plates */}
               <mesh position={[0.18, 0.7, 0.2]} rotation={[0, 0.1, 0]}>
                 <boxGeometry args={[0.3, 0.35, 0.1]} />
                 <meshPhysicalMaterial color={"#ffd700"} roughness={0.3} metalness={1.0} clearcoat={0.5} clearcoatRoughness={0.2} />
               </mesh>
               <mesh position={[-0.18, 0.7, 0.2]} rotation={[0, -0.1, 0]}>
                 <boxGeometry args={[0.3, 0.35, 0.1]} />
                 <meshPhysicalMaterial color={"#ffd700"} roughness={0.3} metalness={1.0} clearcoat={0.5} clearcoatRoughness={0.2} />
               </mesh>

               {/* Abs / Lower Armor */}
               <mesh position={[0, 0.4, 0.2]}>
                 <boxGeometry args={[0.5, 0.3, 0.1]} />
                 <meshPhysicalMaterial color={"#a67c00"} roughness={0.6} metalness={0.8} />
               </mesh>
               
               {/* Goliath's Cape */}
               <mesh position={[0, 0.4, -0.25]} rotation={[0.1, 0, 0]}>
                  <cylinderGeometry args={[0.3, 0.6, 1.6, 16, 1, false, Math.PI * 0.8, Math.PI * 1.4]} />
                  <meshPhysicalMaterial color="#3e0000" roughness={1.0} clearcoat={0.0} side={THREE.DoubleSide} />
               </mesh>

               {/* Belt & Skirt */}
               <mesh position={[0, 0.1, 0]}>
                 <cylinderGeometry args={[0.4, 0.45, 0.2, 16]} />
                 <meshPhysicalMaterial color="#3e2723" roughness={0.9} />
               </mesh>
               {/* Leather Pteruges (Skirt strips) - Detailed */}
               {[...Array(10)].map((_, i) => (
                 <mesh key={i} position={[Math.cos(i * Math.PI / 5) * 0.42, -0.2, Math.sin(i * Math.PI / 5) * 0.42]} rotation={[0, -i * Math.PI / 5, 0]}>
                   <boxGeometry args={[0.2, 0.6, 0.04]} />
                   <meshPhysicalMaterial color="#3e2723" roughness={0.9} clearcoat={0.1} clearcoatRoughness={0.9} />
                 </mesh>
               ))}
               {/* Gold Plates on Pteruges */}
               {[...Array(10)].map((_, i) => (
                 <mesh key={`gold_${i}`} position={[Math.cos(i * Math.PI / 5) * 0.44, -0.3, Math.sin(i * Math.PI / 5) * 0.44]} rotation={[0, -i * Math.PI / 5, 0]}>
                   <boxGeometry args={[0.15, 0.1, 0.02]} />
                   <meshPhysicalMaterial color="#b8860b" roughness={0.4} metalness={0.8} />
                 </mesh>
               ))}

               {/* Head & Helmet */}
               <group position={[0, 1.2, 0]}>
                 {/* Face - Details */}
                 <mesh position={[0, -0.05, 0]}>
                   <boxGeometry args={[0.3, 0.35, 0.3]} />
                   <meshPhysicalMaterial color="#5d4037" roughness={0.8} /> {/* Darker skin tone */}
                 </mesh>
                 {/* Beard */}
                 <mesh position={[0, -0.2, 0.1]}>
                    <boxGeometry args={[0.32, 0.15, 0.25]} />
                    <meshPhysicalMaterial color="#1a1a1a" roughness={0.9} />
                 </mesh>
                 {/* Glowing Eyes */}
                 <mesh position={[0.08, 0.05, 0.16]}>
                   <sphereGeometry args={[0.04, 8, 8]} />
                   <meshBasicMaterial color="#ff3300" />
                 </mesh>
                 <mesh position={[-0.08, 0.05, 0.16]}>
                   <sphereGeometry args={[0.04, 8, 8]} />
                   <meshBasicMaterial color="#ff3300" />
                 </mesh>
                 {/* Helmet Base */}
                 <mesh position={[0, 0.05, 0]}>
                   <cylinderGeometry args={[0.18, 0.18, 0.35, 32]} />
                   <meshPhysicalMaterial color="#a67c00" metalness={0.9} roughness={0.4} clearcoat={0.2} clearcoatRoughness={0.5} />
                 </mesh>
                 {/* Helmet Crest/Plume */}
                 <mesh position={[0, 0.35, -0.1]} rotation={[-0.2, 0, 0]}>
                   <cylinderGeometry args={[0.05, 0.08, 0.5, 16]} />
                   <meshPhysicalMaterial color="#8b0000" roughness={0.8} />
                 </mesh>
                 <mesh position={[0, 0.45, 0.05]} rotation={[0.4, 0, 0]}>
                   <cylinderGeometry args={[0.08, 0.02, 0.4, 16]} />
                   <meshPhysicalMaterial color="#8b0000" roughness={0.8} />
                 </mesh>
                 {/* Helmet Nose Guard */}
                 <mesh position={[0, 0, 0.18]}>
                   <boxGeometry args={[0.06, 0.2, 0.05]} />
                   <meshPhysicalMaterial color="#b8860b" metalness={0.9} roughness={0.3} />
                 </mesh>
                 <mesh position={[0.16, 0, 0.12]} rotation={[0, 0.5, 0]}>
                   <boxGeometry args={[0.1, 0.25, 0.05]} />
                   <meshPhysicalMaterial color="#b8860b" metalness={0.9} roughness={0.3} />
                 </mesh>
                 <mesh position={[-0.16, 0, 0.12]} rotation={[0, -0.5, 0]}>
                   <boxGeometry args={[0.1, 0.25, 0.05]} />
                   <meshPhysicalMaterial color="#b8860b" metalness={0.9} roughness={0.3} />
                 </mesh>
               </group>

               {/* Right Arm (Spear) */}
               <group position={[0.5, 0.8, 0]} ref={legFRRef}>
                 {/* Pauldron */}
                 <mesh position={[0, 0.1, 0]} rotation={[0, 0, -0.2]}>
                   <sphereGeometry args={[0.25, 16, 16, 0, Math.PI, 0, Math.PI]} />
                   <meshPhysicalMaterial color="#ffd700" metalness={1.0} roughness={0.3} clearcoat={0.5} />
                 </mesh>
                 <mesh position={[0, -0.3, 0]}>
                   <boxGeometry args={[0.2, 0.7, 0.2]} />
                   <meshPhysicalMaterial color="#5d4037" roughness={0.7} />
                 </mesh>
                 {/* Bracer */}
                 <mesh position={[0, -0.5, 0]}>
                   <cylinderGeometry args={[0.12, 0.1, 0.3, 16]} />
                   <meshPhysicalMaterial color="#a67c00" metalness={0.9} roughness={0.4} clearcoat={0.2} />
                 </mesh>
                 {/* Giant Spear */}
                 <group position={[0, -0.6, 0.3]} rotation={[Math.PI / 2 + 0.2, 0, 0]}>
                   {/* Shaft */}
                   <mesh>
                     <cylinderGeometry args={[0.04, 0.04, 2.5, 8]} />
                     <meshPhysicalMaterial color="#3e2723" roughness={0.9} />
                   </mesh>
                   {/* Spear Tip */}
                   <mesh position={[0, 1.4, 0]}>
                     <coneGeometry args={[0.1, 0.4, 4]} />
                     <meshPhysicalMaterial color="#90a4ae" metalness={0.9} roughness={0.3} />
                   </mesh>
                   <mesh position={[0, 1.25, 0]}>
                     <boxGeometry args={[0.15, 0.1, 0.05]} />
                     <meshPhysicalMaterial color="#b8860b" metalness={0.8} roughness={0.4} />
                   </mesh>
                 </group>
               </group>

               {/* Left Arm (Shield) */}
               <group position={[-0.5, 0.8, 0]} ref={legFLRef}>
                 {/* Pauldron */}
                 <mesh position={[0, 0.1, 0]} rotation={[0, 0, 0.2]}>
                   <sphereGeometry args={[0.25, 16, 16, 0, Math.PI, 0, Math.PI]} />
                   <meshPhysicalMaterial color="#ffd700" metalness={1.0} roughness={0.3} clearcoat={0.5} />
                 </mesh>
                 <mesh position={[0, -0.3, 0]}>
                   <boxGeometry args={[0.2, 0.7, 0.2]} />
                   <meshPhysicalMaterial color="#5d4037" roughness={0.7} />
                 </mesh>
                 {/* Bracer */}
                 <mesh position={[0, -0.5, 0]}>
                   <cylinderGeometry args={[0.12, 0.1, 0.3, 16]} />
                   <meshPhysicalMaterial color="#a67c00" metalness={0.9} roughness={0.4} clearcoat={0.2} />
                 </mesh>
                 {/* Massive Shield */}
                 <group position={[-0.2, -0.2, 0.3]} rotation={[Math.PI / 2, 0, -0.2]}>
                   <mesh>
                     <cylinderGeometry args={[0.6, 0.6, 0.1, 16]} />
                     <meshPhysicalMaterial color="#b8860b" metalness={0.8} roughness={0.5} />
                   </mesh>
                   <mesh position={[0, 0.05, 0]}>
                     <sphereGeometry args={[0.15, 16, 16, 0, Math.PI*2, 0, Math.PI/2]} />
                     <meshPhysicalMaterial color="#90a4ae" metalness={0.9} roughness={0.3} />
                   </mesh>
                 </group>
               </group>

               {/* Legs */}
               <group position={[0.25, -0.1, 0]} ref={legBRRef}>
                 <mesh position={[0, -0.5, 0]}>
                   <boxGeometry args={[0.25, 0.9, 0.25]} />
                   <meshPhysicalMaterial color="#5d4037" roughness={0.7} />
                 </mesh>
                 {/* Greave */}
                 <mesh position={[0, -0.55, 0.05]} rotation={[0.05, 0, 0]}>
                   <cylinderGeometry args={[0.15, 0.12, 0.6, 16]} />
                   <meshPhysicalMaterial color="#a67c00" metalness={0.9} roughness={0.4} clearcoat={0.2} />
                 </mesh>
                 {/* Foot / Sandal */}
                 <mesh position={[0, -0.95, 0.1]}>
                   <boxGeometry args={[0.25, 0.15, 0.35]} />
                   <meshPhysicalMaterial color="#5d4037" roughness={0.7} />
                 </mesh>
                 <mesh position={[0, -1.02, 0.1]}>
                   <boxGeometry args={[0.27, 0.05, 0.37]} />
                   <meshPhysicalMaterial color="#3e2723" roughness={0.9} />
                 </mesh>
               </group>
               <group position={[-0.25, -0.1, 0]} ref={legBLRef}>
                 <mesh position={[0, -0.5, 0]}>
                   <boxGeometry args={[0.25, 0.9, 0.25]} />
                   <meshPhysicalMaterial color="#5d4037" roughness={0.7} />
                 </mesh>
                 {/* Greave */}
                 <mesh position={[0, -0.55, 0.05]} rotation={[0.05, 0, 0]}>
                   <cylinderGeometry args={[0.15, 0.12, 0.6, 16]} />
                   <meshPhysicalMaterial color="#a67c00" metalness={0.9} roughness={0.4} clearcoat={0.2} />
                 </mesh>
                 {/* Foot / Sandal */}
                 <mesh position={[0, -0.95, 0.1]}>
                   <boxGeometry args={[0.25, 0.15, 0.35]} />
                   <meshPhysicalMaterial color="#5d4037" roughness={0.7} />
                 </mesh>
                 <mesh position={[0, -1.02, 0.1]}>
                   <boxGeometry args={[0.27, 0.05, 0.37]} />
                   <meshPhysicalMaterial color="#3e2723" roughness={0.9} />
                 </mesh>
               </group>
             </group>
           ) : isHumanoid ? (
             <group>
               {/* Torso - Armor */}
               <mesh ref={bodyRef} castShadow position={[0, 0.4, 0]}>
                 <boxGeometry args={[0.5, 0.8, 0.3]} />
                 <meshPhysicalMaterial color={isStaggered ? "#800" : BODY_COLOR} roughness={0.5} metalness={isHumanoid ? 0.7 : 0.4} />
               </mesh>
               {/* Breastplate Detail */}
               <mesh position={[0, 0.45, 0.1]} scale={[1.05, 1, 1.1]}>
                  <boxGeometry args={[0.45, 0.6, 0.1]} />
                  <meshPhysicalMaterial color={"#78909c"} metalness={0.8} roughness={0.2} />
               </mesh>
               {/* Head */}
               <mesh position={[0, 1.0, 0]}>
                 <sphereGeometry args={[0.25, 16, 16]} />
                 <meshPhysicalMaterial color="#d2b48c" roughness={0.9} />
               </mesh>
               {/* Helmet */}
               <mesh position={[0, 1.1, 0]} rotation={[-0.2, 0, 0]}>
                 <sphereGeometry args={[0.26, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                 <meshPhysicalMaterial color={"#555"} metalness={0.8} roughness={0.2} />
               </mesh>
               {/* Arms */}
               <group position={[0.35, 0.7, 0]} ref={legFRRef}>
                 <mesh position={[0, -0.3, 0]}>
                   <boxGeometry args={[0.15, 0.6, 0.15]} />
                   <meshPhysicalMaterial color="#d2b48c" />
                 </mesh>
                 {/* Weapon */}
                 <mesh position={[0, -0.6, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
                   <cylinderGeometry args={[0.02, 0.02, 1.2]} />
                   <meshPhysicalMaterial color="#888" metalness={0.8} />
                 </mesh>
               </group>
               <group position={[-0.35, 0.7, 0]} ref={legFLRef}>
                 <mesh position={[0, -0.3, 0]}>
                   <boxGeometry args={[0.15, 0.6, 0.15]} />
                   <meshPhysicalMaterial color="#d2b48c" />
                 </mesh>
                 {/* Shield for heavy */}
                 {type === 'philistine_heavy' && (
                   <mesh position={[-0.1, -0.2, 0.2]} rotation={[0, 0.2, 0]}>
                     <boxGeometry args={[0.6, 0.8, 0.05]} />
                     <meshPhysicalMaterial color="#444" metalness={0.6} />
                   </mesh>
                 )}
               </group>
               {/* Legs */}
               <group position={[0.15, 0, 0]} ref={legBRRef}>
                 <mesh position={[0, -0.4, 0]}>
                   <boxGeometry args={[0.2, 0.8, 0.2]} />
                   <meshPhysicalMaterial color="#222" />
                 </mesh>
               </group>
               <group position={[-0.15, 0, 0]} ref={legBLRef}>
                 <mesh position={[0, -0.4, 0]}>
                   <boxGeometry args={[0.2, 0.8, 0.2]} />
                   <meshPhysicalMaterial color="#222" />
                 </mesh>
               </group>
             </group>
           ) : (
             <>
              {/* Main Body - Muscular */}
              <mesh ref={bodyRef} castShadow position={[0, 0.1, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
                <capsuleGeometry args={type === 'bear' ? [0.6, 1.2, 16, 32] : type === 'lion' ? [0.35, 1.1, 16, 32] : [0.32, 1.0, 12, 16]} />
                <meshPhysicalMaterial color={isStaggered ? "#800" : BODY_COLOR} roughness={0.9} />
              </mesh>
          
          {/* Fur/Mane - Spiky and dark */}
          {type === 'lion' ? (
            <group position={[0, 0.4, 0.4]} rotation={[-0.2, 0, 0]}>
               {/* Main Mane - Fluffy/Majestic */}
               <mesh scale={[1.3, 1.3, 1.2]}>
                 <dodecahedronGeometry args={[0.5, 1]} />
                 <meshPhysicalMaterial color={MANE_COLOR} roughness={1} flatShading />
               </mesh>
               <mesh position={[0, 0, -0.3]} scale={[1.4, 1.4, 1.1]}>
                 <dodecahedronGeometry args={[0.5, 1]} />
                 <meshPhysicalMaterial color={MANE_COLOR} roughness={1} flatShading />
               </mesh>
               <mesh position={[0, -0.3, 0.1]} scale={[1.2, 1.2, 1.2]}>
                 <dodecahedronGeometry args={[0.45, 1]} />
                 <meshPhysicalMaterial color={MANE_COLOR} roughness={1} flatShading />
               </mesh>
               {/* Spiky bits of mane */}
               {[...Array(16)].map((_, i) => (
                 <mesh key={i} position={[Math.cos(i * Math.PI / 8) * 0.55, Math.sin(i * Math.PI / 8) * 0.55, (Math.random() - 0.5) * 0.4]} rotation={[0, 0, i * Math.PI / 8]}>
                   <coneGeometry args={[0.18, 0.5, 4]} />
                   <meshPhysicalMaterial color={MANE_COLOR} roughness={1} flatShading />
                 </mesh>
               ))}
            </group>
          ) : type === 'bear' ? (
            <>
              {/* Bear Ears - Small and rounded */}
              <mesh position={[0.35, 0.7, 0.5]}>
                <sphereGeometry args={[0.1, 16, 16]} />
                <meshPhysicalMaterial color={BODY_COLOR} roughness={0.9} />
              </mesh>
              <mesh position={[-0.35, 0.7, 0.5]}>
                <sphereGeometry args={[0.1, 16, 16]} />
                <meshPhysicalMaterial color={BODY_COLOR} roughness={0.9} />
              </mesh>
              {/* Massive Hump (Grizzly style) */}
              <mesh position={[0, 0.75, 0.1]}>
                <sphereGeometry args={[0.45, 16, 16]} />
                <meshPhysicalMaterial color={BODY_COLOR} roughness={0.9} />
              </mesh>
              {/* Thicker Neck/Shoulders */}
              <mesh position={[0, 0.4, 0.5]} rotation={[Math.PI / 4, 0, 0]}>
                <cylinderGeometry args={[0.5, 0.6, 0.6, 16]} />
                <meshPhysicalMaterial color={BODY_COLOR} roughness={0.9} />
              </mesh>
              {/* Belly */}
              <mesh position={[0, -0.1, 0.1]}>
                <sphereGeometry args={[0.55, 16, 16]} />
                <meshPhysicalMaterial color={BODY_COLOR} roughness={0.9} />
              </mesh>
            </>
          ) : (
            // Wolf Ruff
            <group position={[0, 0.35, 0.4]} rotation={[-0.2, 0, 0]}>
               <mesh scale={[1.1, 1.1, 1.1]}>
                 <dodecahedronGeometry args={[0.35, 1]} />
                 <meshPhysicalMaterial color={MANE_COLOR} roughness={1} flatShading />
               </mesh>
               {/* Spiky bits of ruff */}
               {[...Array(8)].map((_, i) => (
                 <mesh key={i} position={[Math.cos(i * Math.PI / 4) * 0.35, Math.sin(i * Math.PI / 4) * 0.35, (Math.random() - 0.5) * 0.2]} rotation={[0, 0, i * Math.PI / 4]}>
                   <coneGeometry args={[0.1, 0.3, 4]} />
                   <meshPhysicalMaterial color={MANE_COLOR} roughness={1} flatShading />
                 </mesh>
               ))}
            </group>
          )}

          {/* Head - More detailed (Beasts only) */}
          {!isHumanoid && (
            <group ref={headRef} position={[0, 0.4, 0.7]}>
              <mesh castShadow>
                <boxGeometry args={type === 'bear' ? [0.65, 0.55, 0.7] : type === 'lion' ? [0.5, 0.6, 0.7] : [0.4, 0.45, 0.6]} />
                <meshPhysicalMaterial color={isStaggered ? "#800" : BODY_COLOR} roughness={0.9} />
              </mesh>
            
            {/* Glowing Eyes - Angled/Angry */}
            <mesh position={[0.18, 0.1, 0.25]} rotation={[0, -0.2, type === 'lion' ? 0.3 : 0]}>
              <sphereGeometry args={[0.08, 16, 16]} />
              <meshPhysicalMaterial color={EYE_COLOR} emissive={EYE_COLOR} emissiveIntensity={4} />
            </mesh>
            <mesh position={[-0.18, 0.1, 0.25]} rotation={[0, 0.2, type === 'lion' ? -0.3 : 0]}>
              <sphereGeometry args={[0.08, 16, 16]} />
              <meshPhysicalMaterial color={EYE_COLOR} emissive={EYE_COLOR} emissiveIntensity={4} />
            </mesh>
            
            {/* Brow Ridge - More pronounced for angry look */}
             <mesh position={[0, 0.25, 0.28]} rotation={[0.2, 0, 0]}>
               <boxGeometry args={type === 'bear' ? [0.7, 0.15, 0.2] : type === 'lion' ? [0.6, 0.2, 0.3] : [0.5, 0.1, 0.2]} />
               <meshPhysicalMaterial color={MANE_COLOR} roughness={0.9} />
             </mesh>

            {/* Snout & Teeth - Longer and sharper */}
            <mesh castShadow position={[0, -0.1, type === 'wolf' ? 0.45 : 0.5]}>
              <boxGeometry args={type === 'bear' ? [0.4, 0.35, 0.4] : type === 'lion' ? [0.35, 0.3, 0.65] : [0.22, 0.2, 0.5]} />
              <meshPhysicalMaterial color={type === 'bear' ? BODY_COLOR : type === 'lion' ? BODY_COLOR : BODY_COLOR} roughness={0.9} />
            </mesh>
            
            {/* Lower Jaw (for open mouth effect) */}
            {type === 'lion' && (
              <group ref={jawRef} rotation={[0.1, 0, 0]} position={[0, -0.25, 0.45]}>
                <mesh castShadow>
                  <boxGeometry args={[0.3, 0.15, 0.6]} />
                  <meshPhysicalMaterial color={BODY_COLOR} roughness={0.9} />
                </mesh>
                {/* Tongue */}
                <mesh position={[0, 0.08, 0.1]} rotation={[-0.1, 0, 0]}>
                  <boxGeometry args={[0.15, 0.05, 0.4]} />
                  <meshPhysicalMaterial color={TONGUE_COLOR} roughness={0.5} />
                </mesh>
                {/* Lower Fangs */}
                <mesh position={[0.1, 0.1, 0.25]} rotation={[0, 0, 0]}>
                   <coneGeometry args={[0.04, 0.15, 8]} />
                   <meshPhysicalMaterial color="#ffffee" roughness={0.2} />
                </mesh>
                <mesh position={[-0.1, 0.1, 0.25]} rotation={[0, 0, 0]}>
                   <coneGeometry args={[0.04, 0.15, 8]} />
                   <meshPhysicalMaterial color="#ffffee" roughness={0.2} />
                </mesh>
              </group>
            )}
            
            {/* Nose */}
            <mesh position={[0, 0.05, type === 'lion' ? 0.85 : type === 'bear' ? 0.7 : 0.7]}>
              <sphereGeometry args={[type === 'lion' ? 0.1 : 0.06, 8, 8]} />
              <meshPhysicalMaterial color={type === 'lion' ? NOSE_COLOR : "#111"} roughness={0.5} />
            </mesh>
            
            {/* Upper Fangs */}
            <mesh position={[0.1, -0.25, 0.6]} rotation={[Math.PI, 0, 0]}>
               <coneGeometry args={type === 'bear' ? [0.05, 0.15, 8] : type === 'lion' ? [0.05, 0.25, 8] : [0.04, 0.15, 8]} />
               <meshPhysicalMaterial color="#ffffee" roughness={0.2} />
            </mesh>
            <mesh position={[-0.1, -0.25, 0.6]} rotation={[Math.PI, 0, 0]}>
               <coneGeometry args={type === 'bear' ? [0.05, 0.15, 8] : type === 'lion' ? [0.05, 0.25, 8] : [0.04, 0.15, 8]} />
               <meshPhysicalMaterial color="#ffffee" roughness={0.2} />
            </mesh>

            {/* Ears */}
            {type === 'wolf' && (
              <>
                <mesh position={[0.18, 0.35, -0.15]} rotation={[-0.2, 0, 0.3]}>
                  <coneGeometry args={[0.08, 0.35, 8]} />
                  <meshPhysicalMaterial color={MANE_COLOR} />
                </mesh>
                <mesh position={[-0.18, 0.35, -0.15]} rotation={[-0.2, 0, -0.3]}>
                  <coneGeometry args={[0.08, 0.35, 8]} />
                  <meshPhysicalMaterial color={MANE_COLOR} />
                </mesh>
              </>
            )}
            {type === 'lion' && (
              <>
                <mesh position={[0.28, 0.3, -0.1]} rotation={[-0.2, 0, 0.2]}>
                  <sphereGeometry args={[0.12, 8, 8]} />
                  <meshPhysicalMaterial color={BODY_COLOR} />
                </mesh>
                <mesh position={[-0.28, 0.3, -0.1]} rotation={[-0.2, 0, -0.2]}>
                  <sphereGeometry args={[0.12, 8, 8]} />
                  <meshPhysicalMaterial color={BODY_COLOR} />
                </mesh>
              </>
            )}
          </group>
        )}
      </>
    )}

    {/* Legs - Thicker and Animated (Beasts only) */}
        {!isHumanoid && (
          <group>
              <group ref={legFLRef} position={[type === 'bear' ? 0.35 : type === 'lion' ? 0.3 : 0.25, 0, 0.4]}>
                <mesh position={[0, -0.4, 0]} rotation={[0.2, 0, 0]}>
                   <cylinderGeometry args={type === 'bear' ? [0.15, 0.12, 0.8, 8] : type === 'lion' ? [0.12, 0.08, 0.8, 8] : [0.08, 0.06, 0.7, 8]} />
                   <meshPhysicalMaterial color={type === 'bear' ? MANE_COLOR : BODY_COLOR} />
                </mesh>
              </group>
              <group ref={legFRRef} position={[type === 'bear' ? -0.35 : type === 'lion' ? -0.3 : -0.25, 0, 0.4]}>
                <mesh position={[0, -0.4, 0]} rotation={[0.2, 0, 0]}>
                   <cylinderGeometry args={type === 'bear' ? [0.15, 0.12, 0.8, 8] : type === 'lion' ? [0.12, 0.08, 0.8, 8] : [0.08, 0.06, 0.7, 8]} />
                   <meshPhysicalMaterial color={type === 'bear' ? MANE_COLOR : BODY_COLOR} />
                </mesh>
              </group>
              <group ref={legBLRef} position={[type === 'bear' ? 0.35 : type === 'lion' ? 0.3 : 0.25, 0, -0.4]}>
                <mesh position={[0, -0.4, 0]} rotation={[-0.2, 0, 0]}>
                   <cylinderGeometry args={type === 'bear' ? [0.15, 0.12, 0.8, 8] : type === 'lion' ? [0.12, 0.08, 0.8, 8] : [0.08, 0.06, 0.7, 8]} />
                   <meshPhysicalMaterial color={type === 'bear' ? MANE_COLOR : BODY_COLOR} />
                </mesh>
              </group>
              <group ref={legBRRef} position={[type === 'bear' ? -0.35 : type === 'lion' ? -0.3 : -0.25, 0, -0.4]}>
                <mesh position={[0, -0.4, 0]} rotation={[-0.2, 0, 0]}>
                   <cylinderGeometry args={type === 'bear' ? [0.15, 0.12, 0.8, 8] : type === 'lion' ? [0.12, 0.08, 0.8, 8] : [0.08, 0.06, 0.7, 8]} />
                   <meshPhysicalMaterial color={type === 'bear' ? MANE_COLOR : BODY_COLOR} />
                </mesh>
              </group>
          </group>
        )}
        
        {/* Tail - Bushy (Beasts only) */}
        {!isHumanoid && (
          <>
            {type === 'wolf' && (
              <group ref={tailRef} position={[0, 0.2, -0.6]} rotation={[-0.4, 0, 0]}>
                 <mesh position={[0, -0.3, 0]}>
                   <capsuleGeometry args={[0.12, 0.5, 8, 8]} />
                   <meshPhysicalMaterial color={BODY_COLOR} roughness={0.8} />
                 </mesh>
                 <mesh position={[0, -0.6, 0]}>
                   <coneGeometry args={[0.12, 0.3, 8]} />
                   <meshPhysicalMaterial color={MANE_COLOR} roughness={0.8} />
                 </mesh>
              </group>
            )}
            {type === 'lion' && (
              <group ref={tailRef} position={[0, 0.3, -0.5]} rotation={[0.5, 0, 0]}>
                 <mesh position={[0, -0.4, 0]}>
                   <cylinderGeometry args={[0.04, 0.02, 0.9, 8]} />
                   <meshPhysicalMaterial color={BODY_COLOR} />
                 </mesh>
                 {/* Tail Tuft */}
                 <mesh position={[0, -0.9, 0]}>
                   <sphereGeometry args={[0.15, 8, 8]} />
                   <meshPhysicalMaterial color={MANE_COLOR} />
                 </mesh>
                 <mesh position={[0, -1.0, 0]}>
                   <coneGeometry args={[0.15, 0.2, 8]} />
                   <meshPhysicalMaterial color={MANE_COLOR} />
                 </mesh>
              </group>
            )}
            {type === 'bear' && (
              <mesh position={[0, 0.2, -0.4]} rotation={[-0.4, 0, 0]}>
                 <sphereGeometry args={[0.15, 8, 8]} />
                 <meshPhysicalMaterial color={BODY_COLOR} />
              </mesh>
            )}
          </>
        )}
      </group>
    </group>
    </RigidBody>
  );
}
