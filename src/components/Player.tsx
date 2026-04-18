import { useRef, useState, useEffect, createRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useRapier, RigidBody, CapsuleCollider, RapierRigidBody } from '@react-three/rapier';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';
import { enemyRefs } from './Enemy';

const SPEED = 6;
const JUMP_FORCE = 9.5;
const SLING_COOLDOWN = 500; // ms
const STONE_SPEED = 35;

// Export a ref to track player position for enemies
export const playerRef = createRef<RapierRigidBody>();

export function Player() {
  const { camera, scene } = useThree();
  const { rapier, world } = useRapier();
  const [lastShot, setLastShot] = useState(0);
  const { isPaused, shootStone, damageEnemy, addEffect, setDodging, health, retryCount, isAnointing, volume, isMounted, faith, useFaith, addFaith, weapon, setWeapon } = useStore();
  const playerMesh = useRef<THREE.Group>(null);
  const horseRef = useRef<THREE.Group>(null);
  const shieldMeshRef = useRef<THREE.Mesh>(null);
  const [lastFaithTime, setLastFaithTime] = useState(0);

  const PLAYER_SPEED = isMounted ? SPEED * 1.8 : SPEED;
  const PLAYER_JUMP = isMounted ? JUMP_FORCE * 1.2 : JUMP_FORCE;
  const [isAttacking, setIsAttacking] = useState(false);
  const [trajectoryPoints, setTrajectoryPoints] = useState<THREE.Vector3[]>([]);
  
  useEffect(() => {
    if (playerRef.current) {
        playerRef.current.setTranslation({ x: 0, y: 5, z: 0 }, true);
        playerRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        playerRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  }, [retryCount]);
  
  const trajectoryGeometry = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints(trajectoryPoints);
  }, [trajectoryPoints]);
  
  // Movement state
  const keys = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    dash: false,
    block: false,
  });
  
  const joystick = useRef({ x: 0, y: 0 });
  const aimJoystick = useRef({ x: 0, y: 0 });
  const [lastDash, setLastDash] = useState(0);
  const DASH_COOLDOWN = 1000;
  const DASH_FORCE = 25; // Increased slightly
  const DASH_DURATION = 300; // ms of invulnerability

  const jumpCount = useRef(0);
  const isJumping = useRef(false);
  const lastGroundedTime = useRef(0);
  const lastJumpPressedTime = useRef(0);

  const performJump = (force: number) => {
      if (!playerRef.current || health <= 0) return;
      const vel = playerRef.current.linvel();
      playerRef.current.setLinvel({ x: vel.x, y: force, z: vel.z }, true);
      
      // Animation trigger
      isJumping.current = true;
      
      // Squash and Stretch Animation
      if (playerMesh.current) {
          // Stretch up
          playerMesh.current.scale.set(0.8, 1.2, 0.8); 
          
          // Return to normal
          setTimeout(() => {
              if (playerMesh.current) {
                  playerMesh.current.scale.set(1, 1, 1);
              }
          }, 200);
      }

      // Play jump sound based on material
      const playerPos = playerRef.current.translation();
      const ray = new rapier.Ray(playerPos, { x: 0, y: -1, z: 0 });
      const hit = world.castRay(ray, 2.0, true);
      let material = 'grass';
      if (hit && hit.collider) {
          const rb = hit.collider.parent();
          if (rb && rb.userData && (rb.userData as any).material) {
              material = (rb.userData as any).material;
          }
      }
      const sound = footstepSounds.current[material] || footstepSounds.current['grass'];
      if (sound) {
          sound.playbackRate = 1.2; // Higher pitch for jumping
          sound.volume = 0.3;
          sound.currentTime = 0;
          sound.play().catch(() => {});
          // Reset volume after
          setTimeout(() => {
              if (material === 'grass') sound.volume = 0.2;
              else if (material === 'sand') sound.volume = 0.15;
              else if (material === 'rock') sound.volume = 0.25;
          }, 100);
      }
  };

  // Weapon switch sound effect
  useEffect(() => {
    const audioUrl = weapon === 'sling' 
      ? 'https://assets.mixkit.co/active_storage/sfx/204/204-preview.mp3' // Swoosh/leather sound
      : 'https://assets.mixkit.co/active_storage/sfx/2952/2952-preview.mp3'; // Knife unsheath sound
    
    const audio = new Audio(audioUrl);
    audio.volume = 0.4 * volume;
    audio.playbackRate = weapon === 'sling' ? 1.5 : 1.0;
    audio.play().catch(() => {});
  }, [weapon, volume]);

  // Input handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (useStore.getState().health <= 0) return;
      switch (e.code) {
        case 'KeyW': keys.current.forward = true; break;
        case 'KeyS': keys.current.backward = true; break;
        case 'KeyA': keys.current.left = true; break;
        case 'KeyD': keys.current.right = true; break;
        case 'KeyE': keys.current.block = true; break;
        case 'Space': 
            if (!keys.current.jump) {
                lastJumpPressedTime.current = Date.now();
            }
            keys.current.jump = true; 
            break;
        case 'ShiftLeft': keys.current.dash = true; break;
        case 'KeyF': 
            if (faith >= 20) {
                useFaith(20);
                window.dispatchEvent(new Event('faithDivine'));
            }
            break;
        case 'Digit1': setWeapon('sling'); break;
        case 'Digit2': setWeapon('knife'); break;
      }
    };

    const performJump = (force: number) => {
        if (!playerRef.current || useStore.getState().health <= 0) return;
        const vel = playerRef.current.linvel();
        playerRef.current.setLinvel({ x: vel.x, y: force, z: vel.z }, true);
        
        // Animation trigger
        isJumping.current = true;
        
        // Squash and Stretch Animation
        if (playerMesh.current) {
            // Stretch up
            playerMesh.current.scale.set(0.8, 1.2, 0.8); 
            
            // Return to normal
            setTimeout(() => {
                if (playerMesh.current) {
                    // Smooth return to normal could be handled in useFrame, but setTimeout is simple enough for now.
                    // Let's just set it back to 1,1,1. The landing will squash it.
                    playerMesh.current.scale.set(1, 1, 1);
                }
            }, 200);
        }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': keys.current.forward = false; break;
        case 'KeyS': keys.current.backward = false; break;
        case 'KeyA': keys.current.left = false; break;
        case 'KeyD': keys.current.right = false; break;
        case 'KeyE': keys.current.block = false; break;
        case 'Space': keys.current.jump = false; break;
        case 'ShiftLeft': keys.current.dash = false; break;
      }
    };
    
    const handleJoystickMove = (e: CustomEvent) => {
        if (useStore.getState().health <= 0) return;
        joystick.current = e.detail;
    };

    const handleAimJoystickMove = (e: CustomEvent) => {
        if (useStore.getState().health <= 0) return;
        aimJoystick.current = e.detail;
    };

    const handleDash = () => {
        if (useStore.getState().health <= 0) return;
        keys.current.dash = true;
        setTimeout(() => keys.current.dash = false, 100);
    };
    
    const handleWeaponSelect = (e: CustomEvent) => {
        if (useStore.getState().health <= 0) return;
        setWeapon(e.detail);
    };

    let blockTimeout: NodeJS.Timeout | null = null;

    const handleBlockStart = () => { 
        keys.current.block = true; 
        if (blockTimeout) clearTimeout(blockTimeout);
    };
    
    const handleBlockEnd = () => { 
        // Ensure shield is up for at least a brief moment for visual feedback
        blockTimeout = setTimeout(() => {
            keys.current.block = false; 
        }, 200); // 200ms minimum block time on click/tap
    };
    
    const handleFaithDivine = () => {
        const now = Date.now();
        if (now - lastFaithTime < 5000) return;
        setLastFaithTime(now);
        
        // Healing and power up effect
        useStore.getState().addEffect([playerRef.current?.translation().x || 0, (playerRef.current?.translation().y || 0) + 1, playerRef.current?.translation().z || 0], 'flash');
        
        // Play epic sound
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2042/2042-preview.mp3');
        audio.volume = 0.8 * useStore.getState().volume;
        audio.playbackRate = 0.5;
        audio.play().catch(() => {});
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('joystickMove', handleJoystickMove as EventListener);
    window.addEventListener('aimJoystickMove', handleAimJoystickMove as EventListener);
    window.addEventListener('dash', handleDash);
    window.addEventListener('blockStart', handleBlockStart);
    window.addEventListener('blockEnd', handleBlockEnd);
    window.addEventListener('weaponSelect', handleWeaponSelect as EventListener);
    window.addEventListener('faithDivine', handleFaithDivine);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('joystickMove', handleJoystickMove as EventListener);
      window.removeEventListener('aimJoystickMove', handleAimJoystickMove as EventListener);
      window.removeEventListener('dash', handleDash);
      window.removeEventListener('blockStart', handleBlockStart);
      window.removeEventListener('blockEnd', handleBlockEnd);
      window.removeEventListener('weaponSelect', handleWeaponSelect as EventListener);
      window.removeEventListener('faithDivine', handleFaithDivine);
    };
  }, []); // Empty dependency array for stable input handling

  const slingSound = useRef<HTMLAudioElement | null>(null);
  const knifeSound = useRef<HTMLAudioElement | null>(null);
  const footstepSounds = useRef<{ [key: string]: HTMLAudioElement }>({});
  const lastFootstepTime = useRef(0);

  useEffect(() => {
    // More dynamic sling sound (fast swoosh)
    slingSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2067/2067-preview.mp3');
    slingSound.current.volume = 0.6;
    slingSound.current.playbackRate = 1.5; // Faster for more dynamic feel

    // More dynamic knife sound (sword slash instead of clink)
    knifeSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/214/214-preview.mp3');
    knifeSound.current.volume = 0.6;
    knifeSound.current.playbackRate = 1.3; // Faster for more dynamic feel

    footstepSounds.current = {
      grass: new Audio('https://assets.mixkit.co/active_storage/sfx/216/216-preview.mp3'),
      sand: new Audio('https://assets.mixkit.co/active_storage/sfx/2065/2065-preview.mp3'),
      rock: new Audio('https://assets.mixkit.co/active_storage/sfx/217/217-preview.mp3'),
    };
    footstepSounds.current.grass.volume = 0.2;
    footstepSounds.current.sand.volume = 0.15;
    footstepSounds.current.rock.volume = 0.25;
  }, []);

  useEffect(() => {
    if (slingSound.current) slingSound.current.volume = 0.6 * volume;
    if (knifeSound.current) knifeSound.current.volume = 0.6 * volume;
    if (footstepSounds.current.grass) footstepSounds.current.grass.volume = 0.2 * volume;
    if (footstepSounds.current.sand) footstepSounds.current.sand.volume = 0.15 * volume;
    if (footstepSounds.current.rock) footstepSounds.current.rock.volume = 0.25 * volume;
  }, [volume]);

  // Attack handler
  useEffect(() => {
    const triggerAttack = (type: 'sling' | 'knife') => {
      if (isPaused || isAttacking || health <= 0) return;
      
      const now = Date.now();
      
      if (type === 'sling') {
        if (now - lastShot > SLING_COOLDOWN) {
          setWeapon('sling');
          setLastShot(now);
          setIsAttacking(true);
          
          if (slingSound.current) {
              slingSound.current.currentTime = 0;
              slingSound.current.play().catch(() => {});
          }
          
          // Delay shot for windup animation (100ms) - Reduced for responsiveness
          setTimeout(() => {
              if (!playerRef.current) return;
              let pos;
              try {
                  pos = playerRef.current.translation();
              } catch { return; }
              
              const direction = new THREE.Vector3();
              camera.getWorldDirection(direction);
              
              // Calculate target point in the distance (where the crosshair is aiming)
              const targetDistance = 40; // Slightly closer convergence for mid-range accuracy
              let targetPoint = camera.position.clone().add(direction.clone().multiplyScalar(targetDistance));

              const targetId = useStore.getState().targetId;
              const enemies = useStore.getState().enemies;
              const targetEnemy = enemies.find(e => e.id === targetId);

              if (targetEnemy) {
                  const rb = enemyRefs.get(targetId);
                  if (rb) {
                      try {
                          const ePos = rb.translation();
                          // Aim at the target enemy's center
                          targetPoint = new THREE.Vector3(ePos.x, ePos.y + 0.5, ePos.z);
                      } catch (e) {
                          targetPoint = new THREE.Vector3(targetEnemy.position[0], targetEnemy.position[1] + 0.5, targetEnemy.position[2]);
                      }
                  } else {
                      targetPoint = new THREE.Vector3(targetEnemy.position[0], targetEnemy.position[1] + 0.5, targetEnemy.position[2]);
                  }
              }

              // Calculate right vector for offset
              const right = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();

              // Spawn position (hand - offset to right)
              const spawnPos = new THREE.Vector3(pos.x, pos.y + 1.0, pos.z)
                  .add(direction.clone().normalize().multiplyScalar(0.5)) // Forward
                  .add(right.multiplyScalar(0.2)); // Right (Shoulder width)

              // Calculate velocity vector from spawn point to target point
              const velocityDir = new THREE.Vector3().subVectors(targetPoint, spawnPos).normalize();
              
              // Add upward bias for arc (Minimal, high speed)
              velocityDir.y += 0.02; 
              
              const velocity = velocityDir.multiplyScalar(STONE_SPEED);
              
              shootStone([spawnPos.x, spawnPos.y, spawnPos.z], [velocity.x, velocity.y, velocity.z]);
          }, 100);
          
          // Animation duration matches cooldown roughly
          setTimeout(() => setIsAttacking(false), 500);
        }
      } else if (type === 'knife') {
        setWeapon('knife');
        setIsAttacking(true);
        setLastShot(now);
        
        if (knifeSound.current) {
            knifeSound.current.currentTime = 0;
            knifeSound.current.play().catch(() => {});
        }
        
        const enemies = useStore.getState().enemies;
        let playerPos;
        try {
            playerPos = playerRef.current?.translation();
        } catch { return; }
        if (!playerPos) return;
        
        const playerVec = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
        const lookDir = new THREE.Vector3();
        camera.getWorldDirection(lookDir);
        
        enemies.forEach(enemy => {
          const rb = enemyRefs.get(enemy.id);
          let enemyVec;
          if (rb) {
              try {
                  const ePos = rb.translation();
                  enemyVec = new THREE.Vector3(ePos.x, ePos.y, ePos.z);
              } catch (e) {
                  enemyVec = new THREE.Vector3(enemy.position[0], enemy.position[1], enemy.position[2]);
              }
          } else {
              enemyVec = new THREE.Vector3(enemy.position[0], enemy.position[1], enemy.position[2]);
          }
          
          const dist = playerVec.distanceTo(enemyVec);
          
          if (dist < 3) {
            const dirToEnemy = enemyVec.clone().sub(playerVec).normalize();
            const dot = lookDir.dot(dirToEnemy);
            
            if (dot > 0.8) {
               damageEnemy(enemy.id, 15);
               addEffect([enemyVec.x, enemyVec.y + 1, enemyVec.z], 'blood');
               addEffect([enemyVec.x, enemyVec.y + 1, enemyVec.z], 'impact');
            }
          }
        });
        
        setTimeout(() => {
            if (Date.now() - (lastShot || 0) > 600) {
                setIsAttacking(false);
            }
        }, 700);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      // 0 is left click (knife), 2 is right click (sling)
      if (e.button === 0) {
        triggerAttack('knife');
      } else if (e.button === 2) {
        triggerAttack('sling');
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault(); // Prevent right-click menu
    };

    const handleCustomAttack = (e: CustomEvent) => {
      triggerAttack(e.detail);
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('attack', handleCustomAttack as EventListener);
    
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('attack', handleCustomAttack as EventListener);
    };
  }, [isPaused, lastShot, shootStone, camera, isAttacking, damageEnemy, addEffect]);

  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const slingRef = useRef<THREE.Group>(null);
  const knifeRef = useRef<THREE.Group>(null);
  const rollGroup = useRef<THREE.Group>(null);
  const rollState = useRef({ active: false, startTime: 0, direction: new THREE.Vector3() });
  const doubleJumpState = useRef({ active: false, startTime: 0 });
  const staggerState = useRef({ active: false, startTime: 0 });
  const prevHealth = useRef(health);

  useEffect(() => {
      if (health < prevHealth.current && health > 0) {
          // Took damage
          staggerState.current = { active: true, startTime: Date.now() };
      }
      prevHealth.current = health;
  }, [health]);

  // Gamepad state
  const gamepadState = useRef({
      lastAttackTime: 0,
      lastDodgeTime: 0,
      lastJumpTime: 0,
      lastPauseTime: 0,
  });

  useFrame((state, delta) => {
    try {
        const { isTransitioningPhase, isAnointing } = useStore.getState();
        if (!playerRef.current || isPaused || health <= 0) return;

        if (isTransitioningPhase) {
            playerRef.current.setLinvel({ x: 0, y: playerRef.current.linvel().y, z: 0 }, true);
            return;
        }

    if (isAnointing) {
        playerRef.current.setLinvel({ x: 0, y: playerRef.current.linvel().y, z: 0 }, true);
        
        // Kneeling animation
        if (playerMesh.current && leftLeg.current && rightLeg.current && leftArm.current && rightArm.current) {
            const lerpFactor = 1 - Math.exp(-5 * delta);
            playerMesh.current.position.y = THREE.MathUtils.lerp(playerMesh.current.position.y, -1.3, lerpFactor);
            playerMesh.current.rotation.x = THREE.MathUtils.lerp(playerMesh.current.rotation.x, 0.4, lerpFactor);
            
            // Bend legs
            leftLeg.current.rotation.x = THREE.MathUtils.lerp(leftLeg.current.rotation.x, -1.5, lerpFactor);
            rightLeg.current.rotation.x = THREE.MathUtils.lerp(rightLeg.current.rotation.x, -1.5, lerpFactor);
            
            // Force facing forward (negative Z)
            let rotDiff = 0 - playerMesh.current.rotation.y;
            while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
            while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
            playerMesh.current.rotation.y += rotDiff * lerpFactor;
            
            // Arms down and slightly forward
            leftArm.current.rotation.x = THREE.MathUtils.lerp(leftArm.current.rotation.x, 0.2, lerpFactor);
            rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, 0.2, lerpFactor);
            leftArm.current.rotation.z = THREE.MathUtils.lerp(leftArm.current.rotation.z, 0, lerpFactor);
            rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, 0, lerpFactor);
        }
        
        // Camera looks at player from front
        const pos = playerRef.current.translation();
        const cameraTargetPos = new THREE.Vector3(pos.x, pos.y + 1.5, pos.z - 4);
        camera.position.lerp(cameraTargetPos, 1 - Math.exp(-2 * delta));
        camera.lookAt(pos.x, pos.y + 0.5, pos.z);
        
        return;
    }

    // Weapon scale animation
    if (slingRef.current) {
        const targetScale = weapon === 'sling' ? 1 : 0;
        slingRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 1 - Math.exp(-15 * delta));
        
        // Add a little rotation for flair when drawing the weapon
        if (targetScale === 1 && slingRef.current.scale.x < 0.9) {
            slingRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 20) * 0.2;
        } else {
            slingRef.current.rotation.z = 0;
        }
    }
    if (knifeRef.current) {
        const targetScale = weapon === 'knife' ? 1 : 0;
        knifeRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 1 - Math.exp(-15 * delta));
        
        // Add a little rotation for flair when drawing the weapon
        if (targetScale === 1 && knifeRef.current.scale.x < 0.9) {
            knifeRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 20) * 0.2;
        } else {
            knifeRef.current.rotation.z = 0;
        }
    }

    // Get current velocity
    const vel = playerRef.current.linvel();

    // Gamepad Input Handling
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[0]; // Use first gamepad
    
    let gpForward = 0;
    let gpSide = 0;
    
    if (aimJoystick.current.x !== 0 || aimJoystick.current.y !== 0) {
        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.setFromQuaternion(camera.quaternion);
        euler.y -= aimJoystick.current.x * 0.05;
        euler.x -= aimJoystick.current.y * 0.05;
        euler.x = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, euler.x));
        camera.quaternion.setFromEuler(euler);
    }

    if (gp) {
        // Left stick for movement
        if (Math.abs(gp.axes[1]) > 0.1) gpForward = gp.axes[1];
        if (Math.abs(gp.axes[0]) > 0.1) gpSide = gp.axes[0];
        
        // Right stick for camera (handled in App.tsx or here? Better here for now if we can access camera)
        if (Math.abs(gp.axes[2]) > 0.1 || Math.abs(gp.axes[3]) > 0.1) {
            const euler = new THREE.Euler(0, 0, 0, 'YXZ');
            euler.setFromQuaternion(camera.quaternion);
            euler.y -= gp.axes[2] * 0.05;
            euler.x -= gp.axes[3] * 0.05;
            euler.x = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, euler.x));
            camera.quaternion.setFromEuler(euler);
        }

        const now = Date.now();
        
        // Buttons
        // A / Cross (0) -> Attack (Knife)
        if (gp.buttons[0].pressed && now - gamepadState.current.lastAttackTime > 500) {
            window.dispatchEvent(new CustomEvent('attack', { detail: 'knife' }));
            gamepadState.current.lastAttackTime = now;
        }
        
        // B / Circle (1) or X / Square (2) -> Attack (Sling)
        if ((gp.buttons[1].pressed || gp.buttons[2].pressed) && now - gamepadState.current.lastAttackTime > 500) {
            window.dispatchEvent(new CustomEvent('attack', { detail: 'sling' }));
            gamepadState.current.lastAttackTime = now;
        }
        
        // Shoulders (4, 5) -> Dodge
        if ((gp.buttons[4].pressed || gp.buttons[5].pressed) && now - gamepadState.current.lastDodgeTime > 500) {
            window.dispatchEvent(new Event('dash'));
            gamepadState.current.lastDodgeTime = now;
        }
        
        // Y / Triangle (3) -> Jump
        if (gp.buttons[3].pressed && now - gamepadState.current.lastJumpTime > 500) {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
            gamepadState.current.lastJumpTime = now;
        } else if (!gp.buttons[3].pressed) {
            window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
        }
        
        // Start (9) -> Pause
        if (gp.buttons[9].pressed && now - gamepadState.current.lastPauseTime > 1000) {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
            gamepadState.current.lastPauseTime = now;
        }
    }

    // ... (camera direction logic)
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0;
    cameraDirection.normalize();
    
    const cameraRight = new THREE.Vector3();
    cameraRight.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0));

    // Combine Keyboard and Joystick and Gamepad input
    const forwardInput = (Number(keys.current.forward) - Number(keys.current.backward)) + (-joystick.current.y) + gpForward;
    const sideInput = (Number(keys.current.right) - Number(keys.current.left)) + (joystick.current.x) + gpSide;

    const inputVector = new THREE.Vector2(sideInput, forwardInput);
    if (inputVector.length() > 1) inputVector.normalize();

    const frontVector = cameraDirection.clone().multiplyScalar(inputVector.y);
    const sideVector = cameraRight.clone().multiplyScalar(inputVector.x);

    const direction = new THREE.Vector3();
    direction.addVectors(frontVector, sideVector);
    
    // Rotate player mesh to face camera direction (Back to camera)
    if (playerMesh.current) {
        // Calculate target rotation (Camera yaw + PI because model faces -Z)
        const targetRotation = Math.atan2(cameraDirection.x, cameraDirection.z) + Math.PI;
        
        // Smooth rotation
        let rotDiff = targetRotation - playerMesh.current.rotation.y;
        // Normalize angle to -PI to PI
        while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
        while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
        
        playerMesh.current.rotation.y += rotDiff * (1 - Math.exp(-10 * delta));
    }

    const currentSpeed = keys.current.block ? PLAYER_SPEED * 0.4 : PLAYER_SPEED;

    if (direction.length() > 0) {
      direction.normalize().multiplyScalar(currentSpeed);
      direction.multiplyScalar(Math.min(inputVector.length(), 1)); 
    }

    // Dash Logic
    if (keys.current.dash) {
        const now = Date.now();
        if (now - lastDash > DASH_COOLDOWN) {
            setLastDash(now);
            
            // Determine dash direction: joystick direction OR player's current facing direction
            let dashDir = new THREE.Vector3();
            if (direction.length() > 0) {
                dashDir = direction.clone().normalize();
            } else if (playerMesh.current) {
                // Use player's current rotation to determine forward direction
                const rotY = playerMesh.current.rotation.y;
                dashDir.set(Math.sin(rotY), 0, Math.cos(rotY)).normalize();
            } else {
                dashDir = cameraDirection.clone();
            }

            playerRef.current.applyImpulse({ x: dashDir.x * DASH_FORCE, y: 0, z: dashDir.z * DASH_FORCE }, true);
            
            // Visual effect for dash
            addEffect([playerRef.current.translation().x, playerRef.current.translation().y, playerRef.current.translation().z], 'impact');
            
            // Invulnerability
            setDodging(true);
            setTimeout(() => setDodging(false), DASH_DURATION);

            // Set roll state
            rollState.current = {
                active: true,
                startTime: now,
                direction: dashDir.clone()
            };
        }
    }

    // Roll Animation Logic
    if (rollState.current.active) {
        const elapsed = Date.now() - rollState.current.startTime;
        const progress = elapsed / DASH_DURATION;
        
        if (progress < 1) {
            if (rollGroup.current && playerMesh.current) {
                // Calculate local roll axis
                const localDir = rollState.current.direction.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -playerMesh.current.rotation.y);
                const localAxis = new THREE.Vector3(-localDir.z, 0, localDir.x).normalize();
                
                // Apply rotation
                rollGroup.current.setRotationFromAxisAngle(localAxis, progress * Math.PI * 2);
                rollGroup.current.position.y = Math.sin(progress * Math.PI) * 0.5; // slight jump
            }
        } else {
            rollState.current.active = false;
            if (rollGroup.current) {
                rollGroup.current.rotation.set(0, 0, 0);
                rollGroup.current.position.y = 0;
            }
        }
    }

    // Double Jump Flip Animation Logic
    if (doubleJumpState.current.active) {
        const elapsed = Date.now() - doubleJumpState.current.startTime;
        const progress = elapsed / 600; // 600ms flip duration
        
        if (progress < 1) {
            if (rollGroup.current && playerMesh.current) {
                // Front flip around local X axis for cambalhota
                rollGroup.current.rotation.x = progress * Math.PI * 2;
                
                // Lift him up during the flip so he rotates around his center mass
                rollGroup.current.position.y = Math.sin(progress * Math.PI) * 0.8;
                
                // Tuck arms and legs into a ball
                const tuck = Math.sin(progress * Math.PI);
                if (leftArm.current) leftArm.current.rotation.x = tuck * 2.0;
                if (rightArm.current) rightArm.current.rotation.x = tuck * 2.0;
                if (leftLeg.current) {
                    leftLeg.current.rotation.x = tuck * 1.5;
                    leftLeg.current.position.y = 0.5 + tuck * 0.3;
                }
                if (rightLeg.current) {
                    rightLeg.current.rotation.x = tuck * 1.5;
                    rightLeg.current.position.y = 0.5 + tuck * 0.3;
                }
            }
        } else {
            doubleJumpState.current.active = false;
            if (rollGroup.current && !rollState.current.active) {
                rollGroup.current.rotation.x = 0;
                rollGroup.current.position.y = 0;
                
                // Ensure limbs are reset
                if (leftLeg.current) { leftLeg.current.rotation.x = 0; leftLeg.current.position.y = 0.5; }
                if (rightLeg.current) { rightLeg.current.rotation.x = 0; rightLeg.current.position.y = 0.5; }
            }
        }
    }

    // Stagger Animation Logic
    if (staggerState.current.active) {
        const elapsed = Date.now() - staggerState.current.startTime;
        const progress = elapsed / 300; // 300ms stagger duration
        
        if (progress < 1) {
            if (playerMesh.current) {
                // Shake and lean back
                playerMesh.current.rotation.x = Math.sin(progress * Math.PI) * -0.3;
                playerMesh.current.rotation.z = Math.sin(progress * Math.PI * 4) * 0.1; // Shake
            }
        } else {
            staggerState.current.active = false;
            if (playerMesh.current) {
                // Return to normal rotation is handled by the look-at-camera logic, 
                // but we should reset X and Z
                playerMesh.current.rotation.x = 0;
                playerMesh.current.rotation.z = 0;
            }
        }
    }

    // Apply velocity (keep Y velocity for gravity)
    // Let's try: If recently dashed, let physics handle it.
    if (Date.now() - lastDash < 200) {
        // Dashing, let momentum carry
    } else {
        const isGrounded = Math.abs(vel.y) < 0.1;
        const ACCEL = isGrounded ? 15 : 5; // Less acceleration in air
        const DECEL = isGrounded ? 15 : 2;  // Less deceleration in air
        
        // Update blocking state in store
        const store = useStore.getState();
        if (store.isBlocking !== keys.current.block) {
            store.setBlocking(keys.current.block);
        }
        
        let newX = vel.x;
        let newZ = vel.z;
        
        if (direction.lengthSq() > 0) {
            // Accelerating
            const accelLerp = 1 - Math.exp(-ACCEL * delta);
            newX = THREE.MathUtils.lerp(vel.x, direction.x, accelLerp);
            newZ = THREE.MathUtils.lerp(vel.z, direction.z, accelLerp);
        } else {
            // Decelerating
            const decelLerp = 1 - Math.exp(-DECEL * delta);
            newX = THREE.MathUtils.lerp(vel.x, 0, decelLerp);
            newZ = THREE.MathUtils.lerp(vel.z, 0, decelLerp);
        }
        
        playerRef.current.setLinvel({ x: newX, y: vel.y, z: newZ }, true);
    }

    // Ground Check & Reset Jump Count
    const isGrounded = Math.abs(vel.y) < 0.1;
    if (isGrounded) {
        lastGroundedTime.current = Date.now();
        if (isJumping.current) {
            // Landing Squash
            if (playerMesh.current) {
                playerMesh.current.scale.set(1.2, 0.8, 1.2);
                setTimeout(() => {
                    if (playerMesh.current) playerMesh.current.scale.set(1, 1, 1);
                }, 100);
            }
            
            // Play landing sound based on material
            const playerPos = playerRef.current.translation();
            const ray = new rapier.Ray(playerPos, { x: 0, y: -1, z: 0 });
            const hit = world.castRay(ray, 2.0, true);
            let material = 'grass';
            if (hit && hit.collider) {
                const rb = hit.collider.parent();
                if (rb && rb.userData && (rb.userData as any).material) {
                    material = (rb.userData as any).material;
                }
            }
            const sound = footstepSounds.current[material] || footstepSounds.current['grass'];
            if (sound) {
                sound.playbackRate = 0.8; // Deeper pitch for landing
                sound.volume = 0.4; // Louder for landing
                sound.currentTime = 0;
                sound.play().catch(() => {});
                // Reset volume after
                setTimeout(() => {
                    if (material === 'grass') sound.volume = 0.2;
                    else if (material === 'sand') sound.volume = 0.15;
                    else if (material === 'rock') sound.volume = 0.25;
                }, 100);
            }
        }
        jumpCount.current = 0;
        isJumping.current = false;
    }

    // Footstep Logic
    const isMoving = isGrounded && (Math.abs(vel.x) > 1 || Math.abs(vel.z) > 1);
    const isDashing = Date.now() - lastDash < DASH_DURATION;

    if (isMoving && !isDashing) {
        const now = Date.now();
        const speedSq = vel.x * vel.x + vel.z * vel.z;
        const interval = speedSq > 25 ? 300 : 450; // Faster footsteps if running

        if (now - lastFootstepTime.current > interval) {
            lastFootstepTime.current = now;
            
            const playerPos = playerRef.current.translation();
            const ray = new rapier.Ray(playerPos, { x: 0, y: -1, z: 0 });
            const hit = world.castRay(ray, 2.0, true);
            
            let material = 'grass';
            if (hit && hit.collider) {
                const rb = hit.collider.parent();
                if (rb && rb.userData && (rb.userData as any).material) {
                    material = (rb.userData as any).material;
                }
            }
            
            const sound = footstepSounds.current[material] || footstepSounds.current['grass'];
            if (sound) {
                sound.playbackRate = 0.9 + Math.random() * 0.2; // Randomize pitch slightly
                sound.currentTime = 0;
                sound.play().catch(() => {});
            }
        }
    }

    // Jump Logic (Coyote Time & Buffering)
    const nowTime = Date.now();
    const timeSinceGrounded = nowTime - lastGroundedTime.current;
    const timeSinceJumpPressed = nowTime - lastJumpPressedTime.current;
    
    if (timeSinceJumpPressed < 150) { // 150ms jump buffer
        if (timeSinceGrounded < 150 && jumpCount.current === 0) { // 150ms coyote time
            jumpCount.current = 1;
            lastJumpPressedTime.current = 0; // Consume jump
            performJump(PLAYER_JUMP);
        } else if (jumpCount.current === 1 && !isGrounded) {
            jumpCount.current = 2;
            lastJumpPressedTime.current = 0; // Consume jump
            performJump(PLAYER_JUMP); // Double jump higher
            
            // Double jump effect
            const pos = playerRef.current.translation();
            addEffect([pos.x, pos.y - 0.5, pos.z], 'impact');
            
            // Start double jump flip animation
            doubleJumpState.current = { active: true, startTime: nowTime };
        }
    }

    // Variable Jump Height (Release early to fall faster)
    if (!keys.current.jump && vel.y > 0) {
        playerRef.current.setLinvel({ x: vel.x, y: vel.y * Math.exp(-10 * delta), z: vel.z }, true);
    }

    // Camera Follow Logic
    const playerPos = playerRef.current.translation();
    const isExtraGame = useStore.getState().isExtraGame;
    const cameraHeight = isExtraGame ? 5.5 : 3.5;
    const cameraDistance = isExtraGame ? 8 : 5;
    
    const cameraTargetPos = new THREE.Vector3(playerPos.x, playerPos.y + cameraHeight, playerPos.z); 

    // Calculate direction from camera to player (horizontal only for consistent distance)
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    camDir.y = 0;
    if (camDir.lengthSq() > 0) {
      camDir.normalize();
    } else {
      camDir.set(0, 0, 1);
    }

    cameraTargetPos.sub(camDir.multiplyScalar(cameraDistance));

    // Smoothly move camera
    camera.position.lerp(cameraTargetPos, 1 - Math.exp(-15 * delta)); 

    // Animation Logic
    const time = state.clock.getElapsedTime();
    const speed = new THREE.Vector3(vel.x, 0, vel.z).length();
    
    if (leftLeg.current && rightLeg.current && leftArm.current && rightArm.current && playerMesh.current) {
        // Walking Animation
        if (speed > 0.1) {
            const freq = 12; // Slightly faster steps
            const amp = 0.7; // More exaggerated swing
            
            // Legs - Swing with slight knee bend simulation (visual only via rotation)
            leftLeg.current.rotation.x = Math.sin(time * freq) * amp;
            rightLeg.current.rotation.x = Math.sin(time * freq + Math.PI) * amp;
            
            // Arms - Opposite to legs
            if (!keys.current.block) {
                leftArm.current.rotation.x = Math.sin(time * freq + Math.PI) * amp;
                leftArm.current.rotation.z = 0.15 + Math.abs(Math.sin(time * freq)) * 0.1; // Dynamic outward angle
            }
            
            // Body Bobbing and Swaying
            playerMesh.current.position.y = -0.8 + Math.abs(Math.sin(time * freq)) * 0.1;
            playerMesh.current.rotation.z = Math.sin(time * freq * 0.5) * 0.05; // Slight side-to-side sway
            playerMesh.current.rotation.x = 0.1; // Slight lean forward when walking
            
            if (!isAttacking) {
                playerMesh.current.rotation.y = THREE.MathUtils.lerp(playerMesh.current.rotation.y, 0, 1 - Math.exp(-10 * delta));
                playerMesh.current.position.z = THREE.MathUtils.lerp(playerMesh.current.position.z, 0, 1 - Math.exp(-10 * delta));
            }
            
            // Right arm follows walk cycle unless attacking or blocking
            if (!isAttacking && !keys.current.block) {
                rightArm.current.rotation.x = Math.sin(time * freq) * amp;
                rightArm.current.rotation.z = -0.15 - Math.abs(Math.sin(time * freq + Math.PI)) * 0.1; // Dynamic outward angle
            }
        } else {
            // Idle - Breathing
            const breathe = Math.sin(time * 2) * 0.02;
            const lerpFactor = 1 - Math.exp(-10 * delta);
            
            if (!keys.current.block) {
                playerMesh.current.position.y = THREE.MathUtils.lerp(playerMesh.current.position.y, -0.8 + breathe, lerpFactor);
                playerMesh.current.rotation.z = THREE.MathUtils.lerp(playerMesh.current.rotation.z, 0, lerpFactor);
                playerMesh.current.rotation.x = THREE.MathUtils.lerp(playerMesh.current.rotation.x, 0, lerpFactor);
                
                leftLeg.current.rotation.x = THREE.MathUtils.lerp(leftLeg.current.rotation.x, 0, lerpFactor);
                rightLeg.current.rotation.x = THREE.MathUtils.lerp(rightLeg.current.rotation.x, 0, lerpFactor);
                
                leftArm.current.rotation.x = THREE.MathUtils.lerp(leftArm.current.rotation.x, 0, lerpFactor);
                leftArm.current.rotation.z = THREE.MathUtils.lerp(leftArm.current.rotation.z, 0.1, lerpFactor);
            }
            
            if (!isAttacking && !keys.current.block) {
                playerMesh.current.rotation.y = THREE.MathUtils.lerp(playerMesh.current.rotation.y, 0, lerpFactor);
                playerMesh.current.position.z = THREE.MathUtils.lerp(playerMesh.current.position.z, 0, lerpFactor);
                
                rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, 0, lerpFactor);
                rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, -0.1, lerpFactor);
            }
        }

        // Block Animation
        if (keys.current.block) {
            const blockLerp = 1 - Math.exp(-35 * delta); // Faster snap for snapping feedback on block
            
            // Body crouch and lean back significantly to brace
            playerMesh.current.position.y = THREE.MathUtils.lerp(playerMesh.current.position.y, -1.1, blockLerp);
            playerMesh.current.rotation.x = THREE.MathUtils.lerp(playerMesh.current.rotation.x, -0.2, blockLerp);
            playerMesh.current.rotation.y = THREE.MathUtils.lerp(playerMesh.current.rotation.y, -0.4, blockLerp); // Turn side to block
            playerMesh.current.position.z = THREE.MathUtils.lerp(playerMesh.current.position.z, 0.2, blockLerp); // Lean back

            // Left arm holds shield up and completely across the body high up
            leftArm.current.rotation.x = THREE.MathUtils.lerp(leftArm.current.rotation.x, -Math.PI * 0.7, blockLerp);
            leftArm.current.rotation.z = THREE.MathUtils.lerp(leftArm.current.rotation.z, 0.4, blockLerp);
            leftArm.current.rotation.y = THREE.MathUtils.lerp(leftArm.current.rotation.y, 1.2, blockLerp);
            
            // Legs brace for impact (one forward, one back)
            leftLeg.current.rotation.x = THREE.MathUtils.lerp(leftLeg.current.rotation.x, -0.4, blockLerp);
            rightLeg.current.rotation.x = THREE.MathUtils.lerp(rightLeg.current.rotation.x, 0.2, blockLerp);

            // Left leg bends
            leftLeg.current.position.y = THREE.MathUtils.lerp(leftLeg.current.position.y, 0.6, blockLerp); // Lift knee slightly
            leftLeg.current.position.z = THREE.MathUtils.lerp(leftLeg.current.position.z, -0.3, blockLerp);
            
            if (!isAttacking) {
                // Right arm tucked in close for safety
                rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, -Math.PI * 0.2, blockLerp);
                rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, -0.5, blockLerp);
                rightArm.current.rotation.y = THREE.MathUtils.lerp(rightArm.current.rotation.y, -0.5, blockLerp);
            }
        } else {
            // Reset block rotations if not blocking
            leftArm.current.rotation.y = THREE.MathUtils.lerp(leftArm.current.rotation.y, 0, 1 - Math.exp(-15 * delta));
            
            // Reset leg shifts
            leftLeg.current.position.y = THREE.MathUtils.lerp(leftLeg.current.position.y, 0.5, 1 - Math.exp(-15 * delta));
            leftLeg.current.position.z = THREE.MathUtils.lerp(leftLeg.current.position.z, 0, 1 - Math.exp(-15 * delta));
        }

        // Shield Mesh Animation
        if (shieldMeshRef.current) {
            const targetScale = keys.current.block ? 1.2 : 0; // slightly larger shield
            shieldMeshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 1 - Math.exp(-25 * delta));
            if (keys.current.block) {
                shieldMeshRef.current.rotation.y += delta * 3;
                shieldMeshRef.current.rotation.x += delta * 2;
            }
        }

        // Attack Animation (Right Arm)
        if (isAttacking) {
            if (weapon === 'sling') {
                // Dynamic Sling animation: Spinning windup and Snap Throw
                const timeSinceShot = Date.now() - lastShot;
                
                if (timeSinceShot < 250) {
                    // Wind up Phase (0-250ms) - Spin around head
                    const spinProgress = timeSinceShot / 250; 
                    const spinAngle = spinProgress * Math.PI * 6; // 3 full spins
                    
                    // Arm positioning for overhead spin
                    rightArm.current.rotation.x = -Math.PI / 2 + Math.cos(spinAngle) * 0.4;
                    rightArm.current.rotation.z = -1.0 + Math.sin(spinAngle) * 0.4;
                    
                    // Twist body into the throw
                    if (!keys.current.block) {
                        playerMesh.current.rotation.y = THREE.MathUtils.lerp(playerMesh.current.rotation.y, 1.2, 0.2);
                        // Lean back a bit
                        playerMesh.current.rotation.x = THREE.MathUtils.lerp(playerMesh.current.rotation.x, -0.2, 0.1);
                    }
                } else if (timeSinceShot < 350) {
                    // Throw Phase (250-350ms) - Snap Forward (Release)
                    const snapLerp = 1 - Math.exp(-60 * delta);
                    rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, Math.PI * 0.9, snapLerp);
                    rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, -0.2, snapLerp);
                    
                    // Body snaps forward in the throw direction
                    if (!keys.current.block) {
                        playerMesh.current.rotation.y = THREE.MathUtils.lerp(playerMesh.current.rotation.y, -0.5, 0.3);
                        playerMesh.current.rotation.x = THREE.MathUtils.lerp(playerMesh.current.rotation.x, 0.3, 0.2);
                    }
                } else {
                    // Follow Through / Recovery - Slow return
                    const recoveryLerp = 1 - Math.exp(-10 * delta);
                    rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, 0, recoveryLerp);
                    rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, -0.1, recoveryLerp);
                    if (!keys.current.block) {
                        playerMesh.current.rotation.y = THREE.MathUtils.lerp(playerMesh.current.rotation.y, 0, recoveryLerp);
                        playerMesh.current.rotation.x = THREE.MathUtils.lerp(playerMesh.current.rotation.x, 0, recoveryLerp);
                    }
                }
            } else {
                // Sword/Knife multi-hit dynamic slash
                const attackTime = (Date.now() - lastShot) / 400;
                
                if (attackTime < 0.25) { // 0-100ms
                    // Exaggerated Wind up: arm goes far back and up, torso twists back significantly
                    const windUpProgress = attackTime * 4; // 0 to 1
                    const easeOutQuad = (t: number) => t * (2 - t);
                    const eased = easeOutQuad(windUpProgress);
                    
                    rightArm.current.rotation.x = THREE.MathUtils.lerp(0, Math.PI * 0.9, eased);
                    rightArm.current.rotation.z = THREE.MathUtils.lerp(0, 1.2, eased);
                    rightArm.current.rotation.y = THREE.MathUtils.lerp(0, 0.8, eased);
                    
                    if (!keys.current.block) {
                        playerMesh.current.rotation.y = THREE.MathUtils.lerp(playerMesh.current.rotation.y, -0.6, eased);
                    }
                    if (knifeRef.current) knifeRef.current.rotation.z = THREE.MathUtils.lerp(0, -Math.PI / 4, eased);
                } else if (attackTime < 0.45) { // 100-180ms
                    // Powerful Slash down and across
                    const slashProgress = (attackTime - 0.25) * 5; 
                    
                    rightArm.current.rotation.x = THREE.MathUtils.lerp(Math.PI * 0.9, -Math.PI * 0.7, slashProgress);
                    rightArm.current.rotation.z = THREE.MathUtils.lerp(1.2, -1.5, slashProgress);
                    rightArm.current.rotation.y = THREE.MathUtils.lerp(0.8, -1.0, slashProgress);
                    
                    if (!keys.current.block) {
                        playerMesh.current.rotation.y = THREE.MathUtils.lerp(playerMesh.current.rotation.y, 0.8, slashProgress);
                        // Forward attack lunge
                        playerMesh.current.position.z = THREE.MathUtils.lerp(0, 0.5, Math.sin(slashProgress * Math.PI));
                        playerMesh.current.rotation.x = THREE.MathUtils.lerp(0, 0.2, slashProgress); 
                    }
                    if (knifeRef.current) knifeRef.current.rotation.z = THREE.MathUtils.lerp(-Math.PI / 4, Math.PI / 2, slashProgress);
                } else if (attackTime < 0.65) {
                    // Secondary combo follow-through swipe up
                    const swipeProgress = (attackTime - 0.45) * 5;
                    rightArm.current.rotation.x = THREE.MathUtils.lerp(-Math.PI * 0.7, -0.2, swipeProgress);
                    rightArm.current.rotation.z = THREE.MathUtils.lerp(-1.5, 1.5, swipeProgress);
                    if (!keys.current.block) {
                       playerMesh.current.rotation.y = THREE.MathUtils.lerp(0.8, -0.4, swipeProgress);
                    }
                } else { 
                    // Smooth Recovery
                    const returnProgress = Math.min(1, (attackTime - 0.65) / 0.35);
                    const easeInQuad = (t: number) => t * t;
                    const eased = 1 - easeInQuad(1 - returnProgress); // Smooth out return
                    
                    rightArm.current.rotation.x = THREE.MathUtils.lerp(-0.2, 0, eased);
                    rightArm.current.rotation.z = THREE.MathUtils.lerp(1.5, 0, eased);
                    rightArm.current.rotation.y = THREE.MathUtils.lerp(-1.0, 0, eased);
                    
                    if (!keys.current.block) {
                        playerMesh.current.rotation.y = THREE.MathUtils.lerp(-0.4, 0, eased);
                        playerMesh.current.position.z = THREE.MathUtils.lerp(0.5, 0, eased);
                        playerMesh.current.rotation.x = THREE.MathUtils.lerp(0.2, 0, eased);
                    }
                    
                    if (knifeRef.current) knifeRef.current.rotation.z = THREE.MathUtils.lerp(Math.PI / 2, 0, eased);
                }
            }
        }
    }

    // Trajectory calculation
    if (weapon === 'sling') {
      const pos = playerRef.current.translation();
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      
      const targetId = useStore.getState().targetId;
      let targetPoint = new THREE.Vector3(pos.x, pos.y, pos.z).add(direction.clone().multiplyScalar(100));
      
      const enemies = useStore.getState().enemies;
      const targetEnemy = enemies.find(e => e.id === targetId);

      if (targetEnemy) {
          const rb = enemyRefs.get(targetId);
          if (rb) {
              try {
                  const ePos = rb.translation();
                  targetPoint = new THREE.Vector3(ePos.x, ePos.y + 0.5, ePos.z);
              } catch (e) {
                  targetPoint = new THREE.Vector3(targetEnemy.position[0], targetEnemy.position[1] + 0.5, targetEnemy.position[2]);
              }
          } else {
              targetPoint = new THREE.Vector3(targetEnemy.position[0], targetEnemy.position[1] + 0.5, targetEnemy.position[2]);
          }
      }

      const right = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
      const spawnPos = new THREE.Vector3(pos.x, pos.y + 1.0, pos.z)
          .add(direction.clone().normalize().multiplyScalar(0.5))
          .add(right.multiplyScalar(0.2));

      const velocityDir = new THREE.Vector3().subVectors(targetPoint, spawnPos).normalize();
      velocityDir.y += 0.02; 
      const velocity = velocityDir.multiplyScalar(STONE_SPEED);

      const points = [];
      const gravity = -9.81;
      const timeStep = 0.05;
      for (let i = 0; i < 30; i++) {
        const t = i * timeStep;
        const x = spawnPos.x + velocity.x * t;
        const y = spawnPos.y + velocity.y * t + 0.5 * gravity * t * t;
        const z = spawnPos.z + velocity.z * t;
        points.push(new THREE.Vector3(x, y, z));
        if (y < 0) {
            // Interpolate to find exact ground hit
            if (i > 0) {
                const prevT = (i - 1) * timeStep;
                const prevY = spawnPos.y + velocity.y * prevT + 0.5 * gravity * prevT * prevT;
                const fraction = prevY / (prevY - y);
                const exactT = prevT + fraction * timeStep;
                const exactX = spawnPos.x + velocity.x * exactT;
                const exactZ = spawnPos.z + velocity.z * exactT;
                points[points.length - 1] = new THREE.Vector3(exactX, 0, exactZ);
            }
            break;
        }
      }
      setTrajectoryPoints(points);
    } else {
      setTrajectoryPoints([]);
    }
  } catch (error) {
    // Catch any Rust physics panic and ignore to drop current frame safely
    return;
  }
  });

  return (
    <>
      {weapon === 'sling' && trajectoryPoints.length > 1 && (
        <Line
          points={trajectoryPoints}
          color="white"
          lineWidth={2}
          dashed={true}
          dashScale={50}
          dashSize={1}
          dashOffset={0}
          opacity={0.5}
          transparent
        />
      )}
      <RigidBody
        ref={playerRef}
        colliders={false}
        mass={1}
        type="dynamic"
        position={[0, 5, 0]}
        enabledRotations={[false, false, false]}
        lockRotations
        userData={{ type: 'player' }}
      >
      <CapsuleCollider args={[0.75, 0.5]} friction={0} />
      
      {/* Visible Player Model - Young David - High Res */}
      <group ref={playerMesh} position={[0, isMounted ? 0.2 : -0.8, 0]}>
        {isAnointing && (
          <group position={[0, 10, 0]}>
            <spotLight 
              angle={0.4} 
              penumbra={0.5} 
              intensity={80} 
              color="#ffffcc" 
              castShadow 
              distance={20}
              target={playerMesh.current || undefined}
            />
            <pointLight intensity={10} color="#ffffff" distance={15} />
          </group>
        )}
        <group ref={rollGroup}>
          {/* Horse Model (Only if mounted) */}
          {isMounted && (
            <group ref={horseRef} position={[0, -0.8, 0]}>
              {/* Horse Body */}
              <mesh castShadow position={[0, 0.4, 0]}>
                <capsuleGeometry args={[0.4, 1.2, 8, 8]} />
                <meshPhysicalMaterial color="#4E342E" roughness={0.8} />
              </mesh>
              {/* Horse Neck */}
              <mesh castShadow position={[0, 0.8, 0.6]} rotation={[-0.5, 0, 0]}>
                <cylinderGeometry args={[0.2, 0.25, 0.8, 8]} />
                <meshPhysicalMaterial color="#4E342E" roughness={0.8} />
              </mesh>
              {/* Horse Head */}
              <mesh castShadow position={[0, 1.2, 0.9]} rotation={[-0.2, 0, 0]}>
                <capsuleGeometry args={[0.18, 0.4, 8, 8]} />
                <meshPhysicalMaterial color="#4E342E" roughness={0.8} />
              </mesh>
              {/* Horse Legs */}
              <group position={[0.3, 0, 0.4]}>
                <mesh castShadow position={[0, 0, 0]}>
                  <cylinderGeometry args={[0.1, 0.08, 0.8, 8]} />
                  <meshPhysicalMaterial color="#3E2723" />
                </mesh>
              </group>
              <group position={[-0.3, 0, 0.4]}>
                <mesh castShadow position={[0, 0, 0]}>
                  <cylinderGeometry args={[0.1, 0.08, 0.8, 8]} />
                  <meshPhysicalMaterial color="#3E2723" />
                </mesh>
              </group>
              <group position={[0.3, 0, -0.4]}>
                <mesh castShadow position={[0, 0, 0]}>
                  <cylinderGeometry args={[0.1, 0.08, 0.8, 8]} />
                  <meshPhysicalMaterial color="#3E2723" />
                </mesh>
              </group>
              <group position={[-0.3, 0, -0.4]}>
                <mesh castShadow position={[0, 0, 0]}>
                  <cylinderGeometry args={[0.1, 0.08, 0.8, 8]} />
                  <meshPhysicalMaterial color="#3E2723" />
                </mesh>
              </group>
              {/* Tail */}
              <mesh position={[0, 0.6, -0.8]} rotation={[0.5, 0, 0]}>
                 <capsuleGeometry args={[0.05, 0.6, 8, 8]} />
                 <meshPhysicalMaterial color="#212121" />
              </mesh>
            </group>
          )}
          {/* Tunic (Body) */}
          {useStore.getState().isExtraGame ? (
            <>
              {/* Warrior Outfit */}
              <mesh castShadow position={[0, 0.6, 0]}>
                <cylinderGeometry args={[0.26, 0.45, 1.2, 32]} />
                <meshPhysicalMaterial color="#1a237e" roughness={0.8} clearcoat={0.1} clearcoatRoughness={0.4} /> {/* Deep Blue Tunic */}
              </mesh>
              
              {/* Breastplate / Armor */}
              <mesh castShadow position={[0, 0.85, 0]} scale={[1.1, 1, 1.1]}>
                <cylinderGeometry args={[0.28, 0.3, 0.6, 32]} />
                <meshPhysicalMaterial color="#cfd8dc" metalness={0.8} roughness={0.2} clearcoat={1} />
              </mesh>
              
              {/* Shoulder Guards (Pauldrons) */}
              <mesh position={[0.35, 1.25, 0]} rotation={[0, 0, -0.2]}>
                <sphereGeometry args={[0.18, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshPhysicalMaterial color="#cfd8dc" metalness={0.8} roughness={0.2} />
              </mesh>
              <mesh position={[-0.35, 1.25, 0]} rotation={[0, 0, 0.2]}>
                <sphereGeometry args={[0.18, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshPhysicalMaterial color="#cfd8dc" metalness={0.8} roughness={0.2} />
              </mesh>
            
              {/* Tunic Folds (Details) */}
              <mesh position={[0, 0.6, 0.28]} rotation={[0, 0, 0]}>
                  <cylinderGeometry args={[0.02, 0.05, 1.1, 8]} />
                  <meshPhysicalMaterial color="#0d47a1" roughness={1} clearcoat={0.1} clearcoatRoughness={0.4} />
              </mesh>
              <mesh position={[0.15, 0.6, 0.25]} rotation={[0, 0, 0.1]}>
                  <cylinderGeometry args={[0.02, 0.04, 1.1, 8]} />
                  <meshPhysicalMaterial color="#0d47a1" roughness={1} clearcoat={0.1} clearcoatRoughness={0.4} />
              </mesh>
            </>
          ) : (
            <>
              {/* Rustic Shepherd Tunic */}
              <mesh castShadow position={[0, 0.6, 0]}>
                <cylinderGeometry args={[0.26, 0.45, 1.2, 16]} />
                <meshPhysicalMaterial color="#dcd2c6" roughness={1} clearcoat={0} /> {/* Off-white unbleached linen */}
              </mesh>
              
              {/* Leather Belt */}
              <mesh castShadow position={[0, 0.7, 0]}>
                <cylinderGeometry args={[0.33, 0.35, 0.1, 16]} />
                <meshPhysicalMaterial color="#5d4037" roughness={0.7} />
              </mesh>
              <mesh castShadow position={[0, 0.7, 0.33]}>
                <boxGeometry args={[0.1, 0.15, 0.05]} />
                <meshPhysicalMaterial color="#bcaaa4" metalness={0.6} roughness={0.4} /> {/* Belt buckle */}
              </mesh>

              {/* Shepherd's Scrip (Bag) */}
              <group position={[-0.3, 0.6, -0.15]} rotation={[0, 0, 0.2]}>
                  {/* Leather Strap over shoulder */}
                  <mesh position={[0.3, 0.4, 0.15]} rotation={[0, 0, -0.6]}>
                      <cylinderGeometry args={[0.32, 0.32, 0.05, 16, 1, false, 0, Math.PI]} />
                      <meshPhysicalMaterial color="#3e2723" roughness={0.9} />
                  </mesh>
                  {/* The Bag */}
                  <mesh position={[0, -0.1, 0]}>
                      <boxGeometry args={[0.2, 0.25, 0.1]} />
                      <meshPhysicalMaterial color="#6d4c41" roughness={0.9} />
                  </mesh>
                  {/* Bag Flap */}
                  <mesh position={[0, 0.05, 0.05]} rotation={[-0.2, 0, 0]}>
                      <boxGeometry args={[0.2, 0.15, 0.02]} />
                      <meshPhysicalMaterial color="#5d4037" roughness={0.9} />
                  </mesh>
              </group>
            </>
          )}
              {/* Scarf / Shawl */}
              {useStore.getState().isExtraGame ? (
                <>
                  <mesh position={[0, 1.15, 0]} rotation={[0.1, 0, 0]}>
                       <torusGeometry args={[0.3, 0.08, 16, 32]} />
                       <meshPhysicalMaterial color="#b71c1c" roughness={0.8} clearcoat={0.2} clearcoatRoughness={0.6} />
                  </mesh>
                  <mesh position={[0.2, 0.9, -0.25]} rotation={[-0.5, 0, -0.2]}>
                       <capsuleGeometry args={[0.06, 0.4, 8, 16]} />
                       <meshPhysicalMaterial color="#b71c1c" roughness={0.8} clearcoat={0.2} clearcoatRoughness={0.6} />
                  </mesh>
                </>
              ) : (
                <>
                  {/* Scarf / Shawl - Shepherd Brown */}
                  <mesh position={[0, 1.15, 0]} rotation={[0.1, 0, 0]}>
                       <torusGeometry args={[0.3, 0.08, 16, 32]} />
                       <meshPhysicalMaterial color="#8b4513" roughness={0.9} clearcoat={0.1} clearcoatRoughness={0.8} />
                  </mesh>
                  {/* Scarf tail */}
                  <mesh position={[0.2, 0.9, -0.25]} rotation={[-0.5, 0, -0.2]}>
                       <capsuleGeometry args={[0.06, 0.4, 8, 16]} />
                       <meshPhysicalMaterial color="#8b4513" roughness={0.9} clearcoat={0.1} clearcoatRoughness={0.8} />
                  </mesh>
                </>
              )}
        
        {/* Belt/Sash - Detailed */}
        <mesh castShadow position={[0, 0.6, 0]} scale={[1.05, 1, 1.05]}>
          <cylinderGeometry args={[0.3, 0.4, 0.25, 32]} />
          <meshPhysicalMaterial color="#8b4513" roughness={0.8} clearcoat={0.2} clearcoatRoughness={0.5} />
        </mesh>
        {/* Belt Buckle/Knot */}
        <mesh position={[0.2, 0.5, 0.28]} rotation={[0, 0, -0.2]}>
           <boxGeometry args={[0.12, 0.35, 0.06]} />
           <meshPhysicalMaterial color="#8b4513" roughness={0.8} clearcoat={0.2} clearcoatRoughness={0.5} />
        </mesh>

        {/* Head */}
        <mesh castShadow position={[0, 1.4, 0]}>
          <sphereGeometry args={[0.26, 32, 32]} /> {/* Higher res sphere */}
          <meshPhysicalMaterial color="#ffcd94" roughness={0.4} clearcoat={0.1} clearcoatRoughness={0.3} transmission={0.1} thickness={0.5} />
        </mesh>

        {/* Face Details */}
        <group position={[0, 1.4, -0.22]}>
          {/* Eyes */}
          <mesh position={[0.09, 0.05, 0]}>
            <sphereGeometry args={[0.035, 16, 16]} />
            <meshPhysicalMaterial color="#1a1a1a" roughness={0.2} clearcoat={1.0} clearcoatRoughness={0.0} />
          </mesh>
          {/* Eye highlights */}
          <mesh position={[0.1, 0.06, -0.03]}>
            <sphereGeometry args={[0.01, 8, 8]} />
            <meshPhysicalMaterial color="#ffffff" clearcoat={1.0} clearcoatRoughness={0.0} />
          </mesh>
          
          <mesh position={[-0.09, 0.05, 0]}>
            <sphereGeometry args={[0.035, 16, 16]} />
            <meshPhysicalMaterial color="#1a1a1a" roughness={0.2} clearcoat={1.0} clearcoatRoughness={0.0} />
          </mesh>
          {/* Eye highlights */}
          <mesh position={[-0.08, 0.06, -0.03]}>
            <sphereGeometry args={[0.01, 8, 8]} />
            <meshPhysicalMaterial color="#ffffff" clearcoat={1.0} clearcoatRoughness={0.0} />
          </mesh>

          {/* Eyebrows */}
          <mesh position={[0.09, 0.13, -0.01]} rotation={[0, 0, -0.1]}>
             <boxGeometry args={[0.09, 0.025, 0.01]} />
             <meshPhysicalMaterial color="#5C3A21" clearcoat={0.1} clearcoatRoughness={0.8} /> 
          </mesh>
          <mesh position={[-0.09, 0.13, -0.01]} rotation={[0, 0, 0.1]}>
             <boxGeometry args={[0.09, 0.025, 0.01]} />
             <meshPhysicalMaterial color="#5C3A21" clearcoat={0.1} clearcoatRoughness={0.8} /> 
          </mesh>
          
          {/* Nose */}
          <mesh position={[0, 0, -0.06]} rotation={[-0.2, 0, 0]}>
             <capsuleGeometry args={[0.025, 0.08, 8, 8]} />
             <meshPhysicalMaterial color="#f0b87d" clearcoat={0.1} clearcoatRoughness={0.3} transmission={0.1} thickness={0.5} />
          </mesh>
          
          {/* Ears */}
          <mesh position={[0.25, 0.05, 0.15]} rotation={[0, 0.3, 0]}>
              <sphereGeometry args={[0.04, 16, 16]} />
              <meshPhysicalMaterial color="#ffcd94" clearcoat={0.1} clearcoatRoughness={0.3} transmission={0.1} thickness={0.5} />
          </mesh>
          <mesh position={[-0.25, 0.05, 0.15]} rotation={[0, -0.3, 0]}>
              <sphereGeometry args={[0.04, 16, 16]} />
              <meshPhysicalMaterial color="#ffcd94" clearcoat={0.1} clearcoatRoughness={0.3} transmission={0.1} thickness={0.5} />
          </mesh>

          {/* Mouth/Smile */}
          <mesh position={[0, -0.08, -0.03]} rotation={[0.1 + Math.PI, 0, 0]}>
              <torusGeometry args={[0.04, 0.01, 8, 16, Math.PI]} />
              <meshPhysicalMaterial color="#cc7a6f" clearcoat={0.2} clearcoatRoughness={0.2} />
          </mesh>

          {/* Blush */}
          <mesh position={[0.15, -0.02, 0.05]}>
              <sphereGeometry args={[0.03, 16, 16]} />
              <meshPhysicalMaterial color="#ff9999" roughness={0.8} transmission={0.5} thickness={0.1} />
          </mesh>
          <mesh position={[-0.15, -0.02, 0.05]}>
              <sphereGeometry args={[0.03, 16, 16]} />
              <meshPhysicalMaterial color="#ff9999" roughness={0.8} transmission={0.5} thickness={0.1} />
          </mesh>
        </group>

        {/* Hair (Brown/Auburn) - More detailed curls */}
        <group position={[0, 1.45, 0]}>
          {/* Base Hair */}
          <mesh castShadow position={[0, 0.05, 0.05]}>
            <sphereGeometry args={[0.27, 32, 32, 0, Math.PI * 2, 0, Math.PI / 1.7]} />
            <meshPhysicalMaterial color="#5C3A21" roughness={0.9} clearcoat={0.1} clearcoatRoughness={0.8} /> 
          </mesh>
          
          {/* Curls/Bangs */}
          <mesh position={[0.1, 0.1, -0.2]} rotation={[0.2, 0.1, 0]}>
             <sphereGeometry args={[0.08, 16, 16]} />
             <meshPhysicalMaterial color="#5C3A21" roughness={0.9} />
          </mesh>
          <mesh position={[-0.1, 0.1, -0.2]} rotation={[0.2, -0.1, 0]}>
             <sphereGeometry args={[0.08, 16, 16]} />
             <meshPhysicalMaterial color="#5C3A21" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.15, -0.22]} rotation={[0.3, 0, 0]}>
             <sphereGeometry args={[0.09, 16, 16]} />
             <meshPhysicalMaterial color="#5C3A21" roughness={0.9} />
          </mesh>
          
          {/* Headband */}
          <mesh position={[0, 0.02, 0]} rotation={[-0.1, 0, 0]}>
              <torusGeometry args={[0.265, 0.02, 16, 32]} />
              <meshPhysicalMaterial color="#8b4513" clearcoat={0.2} clearcoatRoughness={0.5} />
          </mesh>

          {/* Curls/Messy bits */}
          {[...Array(12)].map((_, i) => (
              <mesh 
                  key={i} 
                  position={[
                      Math.cos(i * Math.PI / 6) * 0.22, 
                      Math.random() * 0.15, 
                      Math.sin(i * Math.PI / 6) * 0.22 + 0.05
                  ]} 
                  rotation={[Math.random(), Math.random(), Math.random()]}
              >
                 <sphereGeometry args={[0.06 + Math.random() * 0.04, 16, 16]} />
                 <meshPhysicalMaterial color="#5C3A21" roughness={0.9} clearcoat={0.1} clearcoatRoughness={0.8} />
              </mesh>
          ))}
          
          {/* Front bangs */}
          <mesh position={[0.1, -0.05, -0.22]} rotation={[0.2, 0, -0.2]}>
              <capsuleGeometry args={[0.04, 0.1, 8, 8]} />
              <meshPhysicalMaterial color="#5C3A21" roughness={0.9} clearcoat={0.1} clearcoatRoughness={0.8} />
          </mesh>
          <mesh position={[-0.1, -0.08, -0.22]} rotation={[0.2, 0, 0.3]}>
              <capsuleGeometry args={[0.03, 0.12, 8, 8]} />
              <meshPhysicalMaterial color="#5C3A21" roughness={0.9} clearcoat={0.1} clearcoatRoughness={0.8} />
          </mesh>
        </group>

        {/* Arms - Pivot at shoulder */}
        <group ref={leftArm} position={[-0.35, 1.3, 0]}>
            {/* Sleeve */}
            {useStore.getState().isExtraGame ? (
              <mesh castShadow position={[0, -0.15, 0]}>
                  <cylinderGeometry args={[0.1, 0.09, 0.3, 16]} />
                  <meshPhysicalMaterial color="#cfd8dc" metalness={0.6} roughness={0.3} />
              </mesh>
            ) : (
              <mesh castShadow position={[0, -0.15, 0]}>
                  <cylinderGeometry args={[0.1, 0.09, 0.3, 16]} />
                  <meshPhysicalMaterial color="#e0d8c8" roughness={0.9} clearcoat={0.1} clearcoatRoughness={0.8} />
              </mesh>
            )}
            {/* Arm */}
            <mesh castShadow position={[0, -0.35, 0]}>
                <capsuleGeometry args={[0.07, 0.5, 16, 16]} />
                <meshPhysicalMaterial color="#ffcd94" clearcoat={0.1} clearcoatRoughness={0.3} transmission={0.1} thickness={0.5} />
            </mesh>
            {/* Hand */}
            <mesh castShadow position={[0, -0.65, 0]}>
                <sphereGeometry args={[0.08, 16, 16]} />
                <meshPhysicalMaterial color="#ffcd94" clearcoat={0.1} clearcoatRoughness={0.3} transmission={0.1} thickness={0.5} />
            </mesh>
            {/* Shield (Always in extra game) */}
            {useStore.getState().isExtraGame && (
              <group position={[-0.1, -0.5, 0.2]} rotation={[0, 0.5, 0]}>
                <mesh castShadow rotation={[Math.PI/2, 0, 0]}>
                  <cylinderGeometry args={[0.4, 0.4, 0.05, 32]} />
                  <meshPhysicalMaterial color="#cfd8dc" metalness={0.8} roughness={0.2} />
                </mesh>
                <mesh position={[0, 0, 0.03]} rotation={[Math.PI/2, 0, 0]}>
                  <torusGeometry args={[0.35, 0.02, 16, 32]} />
                  <meshPhysicalMaterial color="#ffd700" metalness={0.9} roughness={0.1} />
                </mesh>
              </group>
            )}
        </group>
        
        <group ref={rightArm} position={[0.35, 1.3, 0]}>
            {/* Sleeve */}
            {useStore.getState().isExtraGame ? (
              <mesh castShadow position={[0, -0.15, 0]}>
                  <cylinderGeometry args={[0.1, 0.09, 0.3, 16]} />
                  <meshPhysicalMaterial color="#cfd8dc" metalness={0.6} roughness={0.3} />
              </mesh>
            ) : (
              <mesh castShadow position={[0, -0.15, 0]}>
                  <cylinderGeometry args={[0.1, 0.09, 0.3, 16]} />
                  <meshPhysicalMaterial color="#e0d8c8" roughness={0.9} clearcoat={0.1} clearcoatRoughness={0.8} />
              </mesh>
            )}
            {/* Arm */}
            <mesh castShadow position={[0, -0.35, 0]}>
                <capsuleGeometry args={[0.07, 0.5, 16, 16]} />
                <meshPhysicalMaterial color="#ffcd94" clearcoat={0.1} clearcoatRoughness={0.3} transmission={0.1} thickness={0.5} />
            </mesh>
            {/* Hand */}
            <mesh castShadow position={[0, -0.65, 0]}>
                <sphereGeometry args={[0.08, 16, 16]} />
                <meshPhysicalMaterial color="#ffcd94" clearcoat={0.1} clearcoatRoughness={0.3} transmission={0.1} thickness={0.5} />
            </mesh>
            
            {/* Weapon: Sling (Attached to Right Arm) */}
            <group ref={slingRef} position={[0, -0.65, 0.1]} rotation={[0, 0, 0]}>
               {/* Main Leather Strip */}
               <mesh>
                 <boxGeometry args={[0.05, 0.6, 0.02]} />
                 <meshPhysicalMaterial color="#5c4033" clearcoat={0.2} clearcoatRoughness={0.5} />
               </mesh>
               {/* Pouch */}
               <mesh position={[0, -0.3, 0]}>
                 <sphereGeometry args={[0.08, 16, 16]} />
                 <meshPhysicalMaterial color="#3e2723" clearcoat={0.3} clearcoatRoughness={0.5} />
               </mesh>
               {/* Wrist Strap */}
               <mesh position={[0, 0.25, -0.05]} rotation={[0.2, 0, 0]}>
                  <boxGeometry args={[0.04, 0.3, 0.01]} />
                  <meshPhysicalMaterial color="#4e342e" clearcoat={0.3} clearcoatRoughness={0.5} />
               </mesh>
            </group>
    
            {/* Weapon: Knife (Attached to Right Arm) */}
            <group ref={knifeRef} position={[0, -0.65, 0.1]} rotation={[Math.PI/2, 0, 0]}>
               {/* Handle */}
               <mesh position={[0, -0.1, 0]}>
                 <cylinderGeometry args={[0.03, 0.04, 0.2, 16]} />
                 <meshPhysicalMaterial color="#3e2723" clearcoat={0.3} clearcoatRoughness={0.5} />
               </mesh>
               {/* Guard */}
               <mesh position={[0, 0, 0]}>
                 <boxGeometry args={[0.12, 0.02, 0.04]} />
                 <meshPhysicalMaterial color="#cfd8dc" metalness={0.8} roughness={0.2} clearcoat={1.0} clearcoatRoughness={0.1} />
               </mesh>
               {/* Blade */}
               <mesh position={[0, 0.15, 0]}>
                 <boxGeometry args={[0.05, 0.3, 0.01]} />
                 <meshPhysicalMaterial color="#cfd8dc" metalness={0.8} roughness={0.2} clearcoat={1.0} clearcoatRoughness={0.1} />
               </mesh>
            </group>
        </group>

        {/* Legs - Pivot at hip */}
        <group ref={leftLeg} position={[-0.15, 0.5, 0]}>
            {/* Leg */}
            <mesh castShadow position={[0, -0.4, 0]}>
                <capsuleGeometry args={[0.08, 0.7, 16, 16]} />
                <meshPhysicalMaterial color="#ffcd94" clearcoat={0.1} clearcoatRoughness={0.3} transmission={0.1} thickness={0.5} />
            </mesh>
            {/* Foot */}
            <mesh castShadow position={[0, -0.8, 0.05]}>
                <boxGeometry args={[0.1, 0.08, 0.22]} />
                <meshPhysicalMaterial color="#ffcd94" clearcoat={0.1} clearcoatRoughness={0.3} transmission={0.1} thickness={0.5} />
            </mesh>
            {/* Sandal Sole */}
            <mesh castShadow position={[0, -0.84, 0.05]}>
                <boxGeometry args={[0.12, 0.02, 0.25]} />
                <meshPhysicalMaterial color="#5c4033" clearcoat={0.2} clearcoatRoughness={0.5} />
            </mesh>
            {/* Sandal Straps */}
            <mesh position={[0, -0.75, 0.08]} rotation={[0.2, 0, 0]}>
                <boxGeometry args={[0.11, 0.02, 0.02]} />
                <meshPhysicalMaterial color="#3E2723" clearcoat={0.3} clearcoatRoughness={0.5} />
            </mesh>
            <mesh position={[0, -0.7, 0.06]} rotation={[0.2, 0, 0]}>
                <boxGeometry args={[0.11, 0.02, 0.02]} />
                <meshPhysicalMaterial color="#3E2723" clearcoat={0.3} clearcoatRoughness={0.5} />
            </mesh>
            {/* Cross strap */}
            <mesh position={[0, -0.78, 0.02]} rotation={[0.5, 0.5, 0]}>
                <boxGeometry args={[0.11, 0.02, 0.02]} />
                <meshPhysicalMaterial color="#3E2723" clearcoat={0.3} clearcoatRoughness={0.5} />
            </mesh>
        </group>

        <group ref={rightLeg} position={[0.15, 0.5, 0]}>
            {/* Leg */}
            <mesh castShadow position={[0, -0.4, 0]}>
                <capsuleGeometry args={[0.08, 0.7, 16, 16]} />
                <meshPhysicalMaterial color="#ffcd94" clearcoat={0.1} clearcoatRoughness={0.3} transmission={0.1} thickness={0.5} />
            </mesh>
            {/* Foot */}
            <mesh castShadow position={[0, -0.8, 0.05]}>
                <boxGeometry args={[0.1, 0.08, 0.22]} />
                <meshPhysicalMaterial color="#ffcd94" clearcoat={0.1} clearcoatRoughness={0.3} transmission={0.1} thickness={0.5} />
            </mesh>
            {/* Sandal Sole */}
            <mesh castShadow position={[0, -0.84, 0.05]}>
                <boxGeometry args={[0.12, 0.02, 0.25]} />
                <meshPhysicalMaterial color="#5c4033" clearcoat={0.2} clearcoatRoughness={0.5} />
            </mesh>
            {/* Sandal Straps */}
            <mesh position={[0, -0.75, 0.08]} rotation={[0.2, 0, 0]}>
                <boxGeometry args={[0.11, 0.02, 0.02]} />
                <meshPhysicalMaterial color="#3E2723" clearcoat={0.3} clearcoatRoughness={0.5} />
            </mesh>
            <mesh position={[0, -0.7, 0.06]} rotation={[0.2, 0, 0]}>
                <boxGeometry args={[0.11, 0.02, 0.02]} />
                <meshPhysicalMaterial color="#3E2723" clearcoat={0.3} clearcoatRoughness={0.5} />
            </mesh>
            {/* Cross strap */}
            <mesh position={[0, -0.78, 0.02]} rotation={[0.5, -0.5, 0]}>
                <boxGeometry args={[0.11, 0.02, 0.02]} />
                <meshPhysicalMaterial color="#3E2723" clearcoat={0.3} clearcoatRoughness={0.5} />
            </mesh>
        </group>
        </group>

        {/* Visual Shield when blocking */}
        <mesh ref={shieldMeshRef} position={[0, 1, 0]} scale={[0, 0, 0]}>
            <sphereGeometry args={[1.2, 32, 32]} />
            <meshPhysicalMaterial 
                color="#4da6ff" 
                emissive="#2a75d3"
                emissiveIntensity={0.5}
                transparent={true} 
                opacity={0.3} 
                roughness={0.1} 
                transmission={0.9} 
                thickness={0.1}
                side={THREE.DoubleSide}
            />
        </mesh>
      </group>
    </RigidBody>
    </>
  );
}
