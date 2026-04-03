import { useRef, useState, useEffect, createRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useRapier, RigidBody, CapsuleCollider, RapierRigidBody } from '@react-three/rapier';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';
import { enemyRefs } from './Enemy';

const SPEED = 6;
const JUMP_FORCE = 6;
const SLING_COOLDOWN = 500; // ms
const STONE_SPEED = 35;

// Export a ref to track player position for enemies
export const playerRef = createRef<RapierRigidBody>();

export function Player() {
  const { camera, scene } = useThree();
  const { rapier, world } = useRapier();
  const [lastShot, setLastShot] = useState(0);
  const { isPaused, shootStone, damageEnemy, addEffect, setDodging, health, retryCount } = useStore();
  const playerMesh = useRef<THREE.Group>(null);
  const [weapon, setWeapon] = useState<'sling' | 'knife'>('sling');
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

    const handleBlockStart = () => { keys.current.block = true; };
    const handleBlockEnd = () => { keys.current.block = false; };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('joystickMove', handleJoystickMove as EventListener);
    window.addEventListener('aimJoystickMove', handleAimJoystickMove as EventListener);
    window.addEventListener('dash', handleDash);
    window.addEventListener('blockStart', handleBlockStart);
    window.addEventListener('blockEnd', handleBlockEnd);
    window.addEventListener('weaponSelect', handleWeaponSelect as EventListener);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('joystickMove', handleJoystickMove as EventListener);
      window.removeEventListener('aimJoystickMove', handleAimJoystickMove as EventListener);
      window.removeEventListener('dash', handleDash);
      window.removeEventListener('blockStart', handleBlockStart);
      window.removeEventListener('blockEnd', handleBlockEnd);
      window.removeEventListener('weaponSelect', handleWeaponSelect as EventListener);
    };
  }, []); // Empty dependency array for stable input handling

  const slingSound = useRef<HTMLAudioElement | null>(null);
  const knifeSound = useRef<HTMLAudioElement | null>(null);
  const footstepSounds = useRef<{ [key: string]: HTMLAudioElement }>({});
  const lastFootstepTime = useRef(0);

  useEffect(() => {
    slingSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2067/2067-preview.mp3');
    slingSound.current.volume = 0.5;
    knifeSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2952/2952-preview.mp3');
    knifeSound.current.volume = 0.5;

    footstepSounds.current = {
      grass: new Audio('https://assets.mixkit.co/active_storage/sfx/216/216-preview.mp3'),
      sand: new Audio('https://assets.mixkit.co/active_storage/sfx/2065/2065-preview.mp3'),
      rock: new Audio('https://assets.mixkit.co/active_storage/sfx/217/217-preview.mp3'),
    };
    footstepSounds.current.grass.volume = 0.2;
    footstepSounds.current.sand.volume = 0.15;
    footstepSounds.current.rock.volume = 0.25;
  }, []);

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
              const pos = playerRef.current.translation();
              
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
                      const ePos = rb.translation();
                      // Aim at the target enemy's center
                      targetPoint = new THREE.Vector3(ePos.x, ePos.y + 0.5, ePos.z);
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
        const playerPos = playerRef.current?.translation();
        if (!playerPos) return;
        
        const playerVec = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
        const lookDir = new THREE.Vector3();
        camera.getWorldDirection(lookDir);
        
        enemies.forEach(enemy => {
          const rb = enemyRefs.get(enemy.id);
          let enemyVec;
          if (rb) {
              const ePos = rb.translation();
              enemyVec = new THREE.Vector3(ePos.x, ePos.y, ePos.z);
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
        
        setTimeout(() => setIsAttacking(false), 400);
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
    const { isTransitioningPhase } = useStore.getState();
    if (!playerRef.current || isPaused || health <= 0) return;

    if (isTransitioningPhase) {
        playerRef.current.setLinvel({ x: 0, y: playerRef.current.linvel().y, z: 0 }, true);
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

    const currentSpeed = keys.current.block ? SPEED * 0.4 : SPEED;

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
        const progress = elapsed / 400; // 400ms flip duration
        
        if (progress < 1) {
            if (rollGroup.current && playerMesh.current) {
                // Front flip around local X axis
                rollGroup.current.rotation.x = progress * Math.PI * 2;
            }
        } else {
            doubleJumpState.current.active = false;
            if (rollGroup.current && !rollState.current.active) {
                rollGroup.current.rotation.x = 0;
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
            performJump(JUMP_FORCE);
        } else if (jumpCount.current === 1 && !isGrounded) {
            jumpCount.current = 2;
            lastJumpPressedTime.current = 0; // Consume jump
            performJump(JUMP_FORCE * 0.8); // Double jump
            
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
    const cameraTargetPos = new THREE.Vector3(playerPos.x, playerPos.y + 2.5, playerPos.z); // Height offset

    // Calculate direction from camera to player (horizontal only for consistent distance)
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    camDir.y = 0;
    if (camDir.lengthSq() > 0) {
      camDir.normalize();
    } else {
      camDir.set(0, 0, 1);
    }

    const CAMERA_DISTANCE = 5;
    cameraTargetPos.sub(camDir.multiplyScalar(CAMERA_DISTANCE));

    // Smoothly move camera
    camera.position.lerp(cameraTargetPos, 1 - Math.exp(-15 * delta)); // Frame-independent lerp

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
                leftArm.current.rotation.z = 0.15; // More outward angle
            }
            
            // Body Bobbing - More noticeable
            playerMesh.current.position.y = -0.8 + Math.abs(Math.sin(time * freq)) * 0.08;
            
            // Right arm follows walk cycle unless attacking or blocking
            if (!isAttacking && !keys.current.block) {
                rightArm.current.rotation.x = Math.sin(time * freq) * amp;
                rightArm.current.rotation.z = -0.15; // More outward angle
            }
        } else {
            // Idle - Breathing
            const breathe = Math.sin(time * 2) * 0.02;
            const lerpFactor = 1 - Math.exp(-10 * delta);
            playerMesh.current.position.y = THREE.MathUtils.lerp(playerMesh.current.position.y, -0.8 + breathe, lerpFactor);

            leftLeg.current.rotation.x = THREE.MathUtils.lerp(leftLeg.current.rotation.x, 0, lerpFactor);
            rightLeg.current.rotation.x = THREE.MathUtils.lerp(rightLeg.current.rotation.x, 0, lerpFactor);
            
            if (!keys.current.block) {
                leftArm.current.rotation.x = THREE.MathUtils.lerp(leftArm.current.rotation.x, 0, lerpFactor);
                leftArm.current.rotation.z = THREE.MathUtils.lerp(leftArm.current.rotation.z, 0.1, lerpFactor);
            }

            if (!isAttacking && !keys.current.block) {
                rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, 0, lerpFactor);
                rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, -0.1, lerpFactor);
            }
        }

        // Block Animation
        if (keys.current.block) {
            const blockLerp = 1 - Math.exp(-20 * delta);
            leftArm.current.rotation.x = THREE.MathUtils.lerp(leftArm.current.rotation.x, -Math.PI * 0.6, blockLerp);
            leftArm.current.rotation.z = THREE.MathUtils.lerp(leftArm.current.rotation.z, 0.5, blockLerp);
            
            if (!isAttacking) {
                rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, -Math.PI * 0.6, blockLerp);
                rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, -0.5, blockLerp);
            }
        }

        // Attack Animation (Right Arm)
        if (isAttacking) {
            if (weapon === 'sling') {
                // Sling animation: Wind up and Throw
                const timeSinceShot = Date.now() - lastShot;
                
                if (timeSinceShot < 150) {
                    // Wind up Phase (0-150ms) - Very fast pull back
                    // Rotate arm back and up significantly
                    const windUpLerp = 1 - Math.exp(-40 * delta);
                    rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, -Math.PI * 1.8, windUpLerp);
                    rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, 1.5, windUpLerp); 
                } else {
                    // Throw Phase (150ms+)
                    const throwProgress = (timeSinceShot - 150) / 350; // Remaining time
                    
                    if (throwProgress < 0.2) {
                        // Snap Forward (Release) - Instant whip
                        const snapLerp = 1 - Math.exp(-80 * delta);
                        rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, Math.PI * 0.8, snapLerp);
                        rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, -0.5, snapLerp);
                    } else {
                        // Follow Through / Recovery - Slow return
                        const recoveryLerp = 1 - Math.exp(-15 * delta);
                        rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, 0, recoveryLerp);
                        rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, -0.1, recoveryLerp);
                    }
                }
            } else {
                // Knife stab
                const attackTime = (Date.now() - lastShot) / 400;
                if (attackTime < 0.2) {
                    // Wind up slightly
                    rightArm.current.rotation.x = THREE.MathUtils.lerp(0, Math.PI * 0.2, attackTime * 5);
                    rightArm.current.rotation.z = THREE.MathUtils.lerp(0, 0.2, attackTime * 5);
                } else if (attackTime < 0.4) {
                    // Quick stab out
                    const stabProgress = (attackTime - 0.2) * 5;
                    rightArm.current.rotation.x = THREE.MathUtils.lerp(Math.PI * 0.2, -Math.PI * 0.6, stabProgress);
                    rightArm.current.rotation.z = THREE.MathUtils.lerp(0.2, -0.2, stabProgress);
                } else {
                    // Recoil and return
                    const returnProgress = Math.min(1, (attackTime - 0.4) / 0.6);
                    rightArm.current.rotation.x = THREE.MathUtils.lerp(-Math.PI * 0.6, 0, returnProgress);
                    rightArm.current.rotation.z = THREE.MathUtils.lerp(-0.2, 0, returnProgress);
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
              const ePos = rb.translation();
              targetPoint = new THREE.Vector3(ePos.x, ePos.y + 0.5, ePos.z);
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
      <CapsuleCollider args={[0.75, 0.5]} />
      
      {/* Visible Player Model - Young David - High Res */}
      <group ref={playerMesh} position={[0, -0.8, 0]}>
        <group ref={rollGroup}>
          {/* Tunic (Body) - Better shape */}
          <mesh castShadow position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.26, 0.45, 1.2, 32]} /> {/* Increased segments, wider base */}
          <meshPhysicalMaterial color="#e3dac9" roughness={0.9} clearcoat={0.1} clearcoatRoughness={0.4} />
        </mesh>
        
        {/* Tunic Folds (Details) */}
        <mesh position={[0, 0.6, 0.28]} rotation={[0, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.05, 1.1, 8]} />
            <meshPhysicalMaterial color="#d4cbb8" roughness={1} clearcoat={0.1} clearcoatRoughness={0.4} />
        </mesh>
        <mesh position={[0.15, 0.6, 0.25]} rotation={[0, 0, 0.1]}>
            <cylinderGeometry args={[0.02, 0.04, 1.1, 8]} />
            <meshPhysicalMaterial color="#d4cbb8" roughness={1} clearcoat={0.1} clearcoatRoughness={0.4} />
        </mesh>
        <mesh position={[-0.15, 0.6, 0.25]} rotation={[0, 0, -0.1]}>
            <cylinderGeometry args={[0.02, 0.04, 1.1, 8]} />
            <meshPhysicalMaterial color="#d4cbb8" roughness={1} clearcoat={0.1} clearcoatRoughness={0.4} />
        </mesh>

        {/* Scarf / Shawl */}
        <mesh position={[0, 1.15, 0]} rotation={[0.1, 0, 0]}>
             <torusGeometry args={[0.3, 0.08, 16, 32]} />
             <meshPhysicalMaterial color="#8D6E63" roughness={0.8} clearcoat={0.2} clearcoatRoughness={0.6} />
        </mesh>
        {/* Scarf tail */}
        <mesh position={[0.2, 0.9, -0.25]} rotation={[-0.5, 0, -0.2]}>
             <capsuleGeometry args={[0.06, 0.4, 8, 16]} />
             <meshPhysicalMaterial color="#8D6E63" roughness={0.8} clearcoat={0.2} clearcoatRoughness={0.6} />
        </mesh>

        {/* Bag Strap */}
        <mesh position={[0, 0.7, 0]} rotation={[0, 0, -0.8]} scale={[1, 1, 1.2]}>
             <torusGeometry args={[0.32, 0.03, 8, 32]} />
             <meshPhysicalMaterial color="#3E2723" clearcoat={0.3} clearcoatRoughness={0.5} />
        </mesh>
        
        {/* Shepherd's Bag */}
        <group position={[0.28, 0.4, 0.2]} rotation={[0, 0, -0.2]}>
            <mesh castShadow>
                 <boxGeometry args={[0.25, 0.3, 0.15]} />
                 <meshPhysicalMaterial color="#5D4037" roughness={0.9} clearcoat={0.3} clearcoatRoughness={0.5} />
            </mesh>
            {/* Bag Flap */}
            <mesh position={[0, 0.15, 0.08]} rotation={[0.2, 0, 0]}>
                 <boxGeometry args={[0.26, 0.15, 0.02]} />
                 <meshPhysicalMaterial color="#4E342E" roughness={0.9} clearcoat={0.3} clearcoatRoughness={0.5} />
            </mesh>
            {/* Bag Button */}
            <mesh position={[0, 0.08, 0.09]} rotation={[Math.PI/2, 0, 0]}>
                 <cylinderGeometry args={[0.03, 0.03, 0.02, 16]} />
                 <meshPhysicalMaterial color="#FFD700" metalness={0.6} roughness={0.4} clearcoat={1.0} clearcoatRoughness={0.1} />
            </mesh>
        </group>
        
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
            <mesh castShadow position={[0, -0.15, 0]}>
                <cylinderGeometry args={[0.1, 0.09, 0.3, 16]} />
                <meshPhysicalMaterial color="#e3dac9" roughness={0.9} clearcoat={0.1} clearcoatRoughness={0.4} />
            </mesh>
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
        </group>
        
        <group ref={rightArm} position={[0.35, 1.3, 0]}>
            {/* Sleeve */}
            <mesh castShadow position={[0, -0.15, 0]}>
                <cylinderGeometry args={[0.1, 0.09, 0.3, 16]} />
                <meshPhysicalMaterial color="#e3dac9" roughness={0.9} clearcoat={0.1} clearcoatRoughness={0.4} />
            </mesh>
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
      </group>
    </RigidBody>
    </>
  );
}
