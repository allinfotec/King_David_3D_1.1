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
import { Sword, RectangleVertical, ShieldAlert, Heart, Star, Coins, Sparkles, Pause, Play, Skull, RotateCcw, List } from 'lucide-react';
import { StoryScreen } from './components/StoryScreen';
import { MiniMap } from './components/MiniMap';
import { motion } from 'motion/react';

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
  const retryCount = useStore((state) => state.retryCount);
  
  const stateRef = useRef({
      totalSpawnedInPhase: 0,
      nextWaveTime: 0,
      currentPhase: 1,
      currentRetryCount: 0,
      isTransitioning: false,
      transitionTimeout: null as NodeJS.Timeout | null
  });

  useFrame(({ clock }) => {
    if (isPaused || health <= 0) return;
    
    const state = stateRef.current;
    
    // Reset state if phase changed or retryCount changed
    if (state.currentPhase !== phase || state.currentRetryCount !== retryCount) {
      if (state.transitionTimeout) {
        clearTimeout(state.transitionTimeout);
        state.transitionTimeout = null;
      }
      state.currentPhase = phase;
      state.currentRetryCount = retryCount;
      state.totalSpawnedInPhase = 0;
      state.nextWaveTime = 0;
      state.isTransitioning = false;
    }

    if (state.isTransitioning || isTransitioningPhase) return;

    let targetKills = 0;
    let maxAtOnce = 0;
    let enemyType: 'wolf' | 'bear' | 'lion' | 'philistine_soldier' | 'philistine_archer' | 'philistine_heavy' | 'goliath' = 'wolf';
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
    } else if (phase === 4) {
      targetKills = 1;
      maxAtOnce = 1;
      enemyType = 'goliath';
      enemyHealth = 500;
    } else {
      return;
    }

    // Check for phase completion
    if (enemiesKilledInPhase >= targetKills) {
      state.isTransitioning = true;
      if (phase === 1) {
        setPhaseMessage("Parabéns, você venceu os lobos! Prepare-se para enfrentar o Urso.");
        state.transitionTimeout = setTimeout(() => nextPhase(), 5000);
      } else if (phase === 2) {
        setPhaseMessage("Parabéns, você venceu os ursos! Prepare-se para enfrentar o poderoso Leão.");
        state.transitionTimeout = setTimeout(() => nextPhase(), 5000);
      } else if (phase === 3) {
        setPhaseMessage("O LEÃO FOI DERROTADO! Mas a guerra começou... Filisteus atacam!");
        state.transitionTimeout = setTimeout(() => nextPhase(), 5000);
      } else if (phase === 4) {
        setPhaseMessage("VITÓRIA ÉPICA! GOLIAS FOI DERROTADO!");
        state.transitionTimeout = setTimeout(() => {
          document.exitPointerLock();
          useStore.getState().setGameWon(true);
          useStore.getState().setPhaseMessage(null);
        }, 5000);
      }
      return;
    }

    if (state.totalSpawnedInPhase >= targetKills) return;

    const now = clock.getElapsedTime();

    if (state.nextWaveTime === 0) {
        state.nextWaveTime = now + 2;
        return;
    }

    if (now >= state.nextWaveTime && enemies.length < maxAtOnce) {
        const countToSpawn = Math.min(maxAtOnce - enemies.length, targetKills - state.totalSpawnedInPhase);
        for (let i = 0; i < countToSpawn; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 15 + Math.random() * 10;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            spawnEnemy([x, 2, z], enemyType, enemyHealth);
        }
        state.totalSpawnedInPhase += countToSpawn;
        state.nextWaveTime = now + 3; // Wait 3 seconds before checking to spawn more
    }
  });

  return null;
}

function UI() {
  const { health, score, isPaused, reset, retryPhase, togglePause, enemies, phase, phaseMessage, isWalkingHome, volume, setVolume, faith, coins, isExtraGame, weapon, gameWon } = useStore();

  const [bestScore, setBestScore] = useState(() => {
     return parseInt(localStorage.getItem('david_game_best_score') || '0', 10);
  });

  useEffect(() => {
    if (health <= 0 || gameWon) {
      document.exitPointerLock();
      if (score > bestScore) {
          setBestScore(score);
          localStorage.setItem('david_game_best_score', score.toString());
      }
    }
  }, [health, score, bestScore, gameWon]);

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

  const handleRestart = () => {
      retryPhase();
      const canvas = document.querySelector('canvas');
      if (canvas) {
        try {
          canvas.requestPointerLock();
        } catch (e) {
          console.error(e);
        }
      }
  };

  if (gameWon) {
    return (
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        transition={{ duration: 0.5 }}
        className="absolute inset-0 flex items-center justify-center bg-white/20 backdrop-blur-md z-50 pointer-events-auto"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-500/20 via-transparent to-transparent opacity-80 animate-pulse pointer-events-none"></div>

        <div className="relative flex flex-col items-center">
          {/* Level Star Badge - Trophies */}
          <motion.div 
            initial={{ scale: 0, y: 50 }} 
            animate={{ scale: 1, y: 0 }} 
            transition={{ type: "spring", delay: 0.1 }}
            className="absolute -top-20 z-20 flex flex-col items-center"
          >
            <div className="relative flex items-center justify-center w-40 h-40">
                <Star className="absolute w-full h-full text-yellow-300 fill-yellow-400 drop-shadow-[0_8px_8px_rgba(250,204,21,0.6)]" style={{ filter: 'drop-shadow(0 4px 0 #b45309)' }} />
                <div className="absolute flex flex-col items-center justify-center pt-2">
                    <span className="text-4xl font-black text-white drop-shadow-md" style={{ WebkitTextStroke: '2px #b45309' }}>VENCEDOR</span>
                </div>
            </div>
          </motion.div>

          {/* MAIN BANNER */}
          <motion.div 
            initial={{ scale: 0 }} 
            animate={{ scale: 1 }} 
            transition={{ type: "spring", delay: 0.2, bounce: 0.6 }}
            className="bg-gradient-to-b from-yellow-300 to-yellow-600 p-2 rounded-full border-4 border-yellow-800 shadow-[0_0_40px_rgba(250,204,21,0.5)] z-10 mb-[-20px] relative px-12"
          >
            <div className="bg-yellow-400 px-8 py-2 rounded-full border-[3px] border-yellow-100/50 shadow-[inset_0_-6px_0_rgba(180,83,9,0.5)]">
                <h2 className="text-4xl font-black text-yellow-900 uppercase tracking-widest py-1 drop-shadow-sm">
                    A Batalha Acabou!
                </h2>
            </div>
          </motion.div>

          {/* Main Golden Box */}
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.4, delay: 0.3 }}
            className="bg-gradient-to-br from-yellow-100 to-yellow-500 p-4 rounded-[40px] border-[6px] border-yellow-700 shadow-[0_20px_40px_rgba(0,0,0,0.4)] relative w-96 max-w-[90vw]"
          >
            {/* Inner Lighter Box */}
            <div className="bg-gradient-to-b from-white to-yellow-200 rounded-[24px] px-6 py-8 pt-10 shadow-[inset_0_-10px_0_rgba(202,138,4,0.2)] flex flex-col items-center relative overflow-hidden">
                 
                 {/* Shine graphic over background */}
                 <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(255,255,255,0.8)_10deg,transparent_20deg,rgba(255,255,255,0.8)_30deg,transparent_40deg,rgba(255,255,255,0.8)_50deg,transparent_60deg)] animate-[spin_15s_linear_infinite] opacity-50 pointer-events-none"></div>

                 {/* Dialogue Bubble */}
                 <div className="relative z-10 bg-white/90 rounded-2xl p-4 shadow-md border-2 border-yellow-300 w-full mb-6">
                    <p className="text-gray-800 text-lg font-bold italic text-center">
                      "A batalha é do Senhor! O gigante caiu não pela minha força, mas pela fé no Deus de Israel!"
                    </p>
                    <p className="text-right text-gray-500 text-sm mt-2 font-black">- Davi</p>
                 </div>

                 {/* 3 Stars */}
                 <div className="flex gap-2 mb-4 relative z-10">
                     <motion.div initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: -15 }} transition={{ delay: 0.6, type: 'spring' }}>
                         <Star className="w-12 h-12 text-yellow-500 fill-yellow-400 drop-shadow-[0_4px_4px_rgba(0,0,0,0.2)]" />
                     </motion.div>
                     <motion.div initial={{ scale: 0, y: 20 }} animate={{ scale: 1.2, y: -10 }} transition={{ delay: 0.8, type: 'spring' }}>
                         <Star className="w-16 h-16 text-yellow-500 fill-yellow-400 drop-shadow-[0_4px_4px_rgba(0,0,0,0.2)]" />
                     </motion.div>
                     <motion.div initial={{ scale: 0, rotate: 45 }} animate={{ scale: 1, rotate: 15 }} transition={{ delay: 1.0, type: 'spring' }}>
                         <Star className="w-12 h-12 text-yellow-500 fill-yellow-400 drop-shadow-[0_4px_4px_rgba(0,0,0,0.2)]" />
                     </motion.div>
                 </div>

                 {/* Scores */}
                 <div className="w-full space-y-4 relative z-10 px-2">
                     <div className="flex justify-between items-center border-b-[3px] border-yellow-600/20 pb-2">
                         <span className="text-[26px] font-black text-yellow-800 uppercase" style={{ WebkitTextStroke: '1px rgba(255,255,255,0.5)' }}>Score Final</span>
                         <span className="text-[28px] font-black text-yellow-500 drop-shadow-[0_2px_1px_rgba(0,0,0,0.2)]" style={{ WebkitTextStroke: '1px #78350f' }}>{score}</span>
                     </div>
                 </div>
            </div>

            {/* Floating Menu Button */}
            <div className="absolute -bottom-8 left-0 right-0 flex justify-center gap-6">
                 <motion.button 
                    whileHover={{ scale: 1.1, translateY: -4 }} whileTap={{ scale: 0.9, translateY: 4 }}
                    onClick={() => window.location.reload()}
                    className="w-20 h-20 bg-gradient-to-b from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center border-4 border-blue-900 shadow-[0_8px_0_#1e3a8a] transition-all relative overflow-hidden"
                 >
                     <div className="absolute inset-0 bg-white/20 rounded-2xl top-1 h-1/2"></div>
                     <div className="bg-blue-300 rounded-full p-3 border-[3px] border-white/80 shadow-inner z-10 text-white">
                        <List className="w-8 h-8 stroke-[3px]" />
                     </div>
                     <span className="absolute bottom-2 font-black text-[10px] text-white">MENU</span>
                 </motion.button>
                 <motion.button 
                    whileHover={{ scale: 1.1, translateY: -4 }} whileTap={{ scale: 0.9, translateY: 4 }}
                    onClick={() => {
                        useStore.getState().setStoryScreen(16);
                        useStore.getState().setGameWon(false);
                    }}
                    className="w-20 h-20 bg-gradient-to-b from-green-400 to-green-600 rounded-2xl flex items-center justify-center border-4 border-green-900 shadow-[0_8px_0_#14532d] transition-all relative overflow-hidden"
                 >
                     <div className="absolute inset-0 bg-white/20 rounded-2xl top-1 h-1/2"></div>
                     <div className="bg-green-300 rounded-full p-3 border-[3px] border-white/80 shadow-inner z-10 text-white flex items-center justify-center">
                        <Play className="w-8 h-8 fill-white stroke-[3px] translate-x-[2px]" />
                     </div>
                     <span className="absolute bottom-2 font-black text-[10px] text-white">HISTÓRIA</span>
                 </motion.button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  if (health <= 0) {
    return (
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        transition={{ duration: 0.5 }}
        className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50 pointer-events-auto"
      >
        <div className="relative flex flex-col items-center">
          {/* Level Star Badge at Top */}
          <motion.div 
            initial={{ scale: 0, y: 50 }} 
            animate={{ scale: 1, y: 0 }} 
            transition={{ type: "spring", delay: 0.1 }}
            className="absolute -top-16 z-20 flex flex-col items-center"
          >
            <div className="relative flex items-center justify-center w-32 h-32">
                <Star className="absolute w-full h-full text-[#facc15] fill-[#facc15] drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]" />
                <div className="absolute flex flex-col items-center justify-center pt-2">
                    <span className="text-4xl font-black text-white drop-shadow-md" style={{ WebkitTextStroke: '2px #b45309' }}>{phase}</span>
                    <span className="text-sm font-black text-[#78350f] uppercase -mt-1 tracking-widest">Nível</span>
                </div>
            </div>
          </motion.div>

          {/* GAME OVER Pill Banner */}
          <motion.div 
            initial={{ scale: 0 }} 
            animate={{ scale: 1 }} 
            transition={{ type: "spring", delay: 0.2, bounce: 0.6 }}
            className="bg-gradient-to-b from-[#fcd34d] to-[#d97706] p-2 rounded-full border-4 border-[#78350f] shadow-xl z-10 mb-[-20px] relative px-12"
          >
            <div className="bg-[#fbbf24] px-8 py-1 rounded-full border-[3px] border-yellow-200/50 shadow-[inset_0_-6px_0_rgba(180,83,9,0.5)]">
                <h2 className="text-4xl font-black text-[#ef4444] uppercase tracking-widest py-1 drop-shadow-md" style={{ WebkitTextStroke: '1px white' }}>
                    Fim de Jogo
                </h2>
            </div>
          </motion.div>

          {/* Main Golden Box */}
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.4, delay: 0.3 }}
            className="bg-gradient-to-br from-[#fef08a] to-[#eab308] p-4 rounded-[40px] border-[6px] border-[#a16207] shadow-[0_15px_30px_rgba(0,0,0,0.5)] relative w-80"
          >
            {/* Inner Lighter Box */}
            <div className="bg-gradient-to-b from-[#fef9c3] to-[#fde047] rounded-[24px] px-6 py-10 pt-12 shadow-[inset_0_-10px_0_rgba(202,138,4,0.3)] flex flex-col items-center relative overflow-hidden">
                 
                 {/* Shine graphic over background */}
                 <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(255,255,255,0.4)_10deg,transparent_20deg,rgba(255,255,255,0.4)_30deg,transparent_40deg,rgba(255,255,255,0.4)_50deg,transparent_60deg)] animate-[spin_10s_linear_infinite] opacity-30 pointer-events-none"></div>

                 {/* Three Stars */}
                 <div className="flex gap-1 mb-6 relative z-10">
                     <motion.div initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: -15 }} transition={{ delay: 0.6, type: 'spring' }}>
                         <Star className="w-14 h-14 text-yellow-500 fill-[#facc15] drop-shadow-[0_4px_4px_rgba(0,0,0,0.3)]" style={{ filter: 'drop-shadow(0 2px 0 #a16207)' }} />
                     </motion.div>
                     <motion.div initial={{ scale: 0, y: 20 }} animate={{ scale: 1.2, y: -10 }} transition={{ delay: 0.8, type: 'spring' }}>
                         <Star className="w-16 h-16 text-yellow-500 fill-[#facc15] drop-shadow-[0_4px_4px_rgba(0,0,0,0.3)]" style={{ filter: 'drop-shadow(0 2px 0 #a16207)' }} />
                     </motion.div>
                     <motion.div initial={{ scale: 0, rotate: 45 }} animate={{ scale: 1, rotate: 15 }} transition={{ delay: 1.0, type: 'spring' }}>
                         <Star className="w-14 h-14 text-yellow-500 fill-[#facc15] drop-shadow-[0_4px_4px_rgba(0,0,0,0.3)]" style={{ filter: 'drop-shadow(0 2px 0 #a16207)' }} />
                     </motion.div>
                 </div>

                 {/* Scores */}
                 <div className="w-full space-y-4 relative z-10 px-2 mt-4">
                     <div className="flex justify-between items-center border-b-[3px] border-[#a16207]/20 pb-2">
                         <span className="text-[26px] font-black text-[#854d0e] uppercase" style={{ fontFamily: '"Comic Sans MS", "Chalkboard SE", sans-serif', WebkitTextStroke: '1px rgba(255,255,255,0.5)' }}>Score</span>
                         <span className="text-[28px] font-black text-white drop-shadow-[0_3px_2px_rgba(0,0,0,0.4)]" style={{ WebkitTextStroke: '2px #78350f' }}>{score}</span>
                     </div>
                     <div className="flex justify-between items-center pt-2">
                         <span className="text-[26px] font-black text-[#854d0e] uppercase" style={{ fontFamily: '"Comic Sans MS", "Chalkboard SE", sans-serif', WebkitTextStroke: '1px rgba(255,255,255,0.5)' }}>Best</span>
                         <span className="text-[28px] font-black text-white drop-shadow-[0_3px_2px_rgba(0,0,0,0.4)]" style={{ WebkitTextStroke: '2px #78350f' }}>{bestScore}</span>
                     </div>
                 </div>
            </div>

            {/* Floating Buttons */}
            <div className="absolute -bottom-8 left-0 right-0 flex justify-center gap-6">
                 {/* Revert/Back Button */}
                 <motion.button 
                    whileHover={{ scale: 1.1, translateY: -4 }} whileTap={{ scale: 0.9, translateY: 4 }}
                    onClick={handleRestart}
                    className="w-16 h-16 bg-gradient-to-b from-[#fcd34d] to-[#d97706] rounded-2xl flex items-center justify-center border-4 border-[#78350f] shadow-[0_6px_0_#451a03] transition-all relative overflow-hidden"
                 >
                     <div className="absolute inset-0 bg-white/20 rounded-2xl top-1 h-1/2"></div>
                     <div className="bg-[#ef4444] rounded-full p-2.5 border-[3px] border-white/80 shadow-inner z-10 text-white">
                        <RotateCcw className="w-5 h-5 stroke-[4px]" />
                     </div>
                 </motion.button>
                 {/* Menu Button */}
                 <motion.button 
                    whileHover={{ scale: 1.1, translateY: -4 }} whileTap={{ scale: 0.9, translateY: 4 }}
                    onClick={() => window.location.reload()}
                    className="w-16 h-16 bg-gradient-to-b from-[#fcd34d] to-[#d97706] rounded-2xl flex items-center justify-center border-4 border-[#78350f] shadow-[0_6px_0_#451a03] transition-all relative overflow-hidden"
                 >
                     <div className="absolute inset-0 bg-white/20 rounded-2xl top-1 h-1/2"></div>
                     <div className="bg-[#fb923c] rounded-full p-2.5 border-[3px] border-white/80 shadow-inner z-10 text-white">
                        <List className="w-5 h-5 stroke-[4px]" />
                     </div>
                 </motion.button>
                 {/* Play Button */}
                 <motion.button 
                    whileHover={{ scale: 1.1, translateY: -4 }} whileTap={{ scale: 0.9, translateY: 4 }}
                    onClick={handleRestart}
                    className="w-16 h-16 bg-gradient-to-b from-[#fcd34d] to-[#d97706] rounded-2xl flex items-center justify-center border-4 border-[#78350f] shadow-[0_6px_0_#451a03] transition-all relative overflow-hidden"
                 >
                     <div className="absolute inset-0 bg-white/20 rounded-2xl top-1 h-1/2"></div>
                     <div className="bg-[#22c55e] rounded-full p-2 border-[3px] border-white/80 shadow-inner z-10 text-white flex items-center justify-center">
                        <div className="translate-x-[2px]"><Play className="w-6 h-6 fill-white stroke-[2px]" /></div>
                     </div>
                 </motion.button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  if (isPaused) {
    return (
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-md text-white z-50"
      >
        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-center flex flex-col items-center">
          <Pause size={80} className="text-blue-400 mb-6 drop-shadow-[0_0_15px_rgba(96,165,250,0.8)]" />
          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-blue-300 to-blue-500 mb-8 drop-shadow-xl">PAUSADO</h1>
          <motion.button 
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={() => {
              togglePause();
              const canvas = document.querySelector('canvas');
              canvas?.requestPointerLock();
            }}
            className="px-10 py-5 bg-gradient-to-b from-blue-400 to-blue-600 text-white font-extrabold text-xl rounded-full shadow-[0_0_20px_rgba(59,130,246,0.6)] border-4 border-blue-200 flex items-center gap-3"
          >
            <Play fill="currentColor" /> CONTINUAR JOGO
          </motion.button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none select-none">
      <MiniMap />
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
      
      {/* Top Left: HUD Dashboard Styled */}
      <div className="absolute top-4 left-4 flex flex-col gap-4 pointer-events-auto">
        <div className="flex items-center gap-3 bg-gray-900/60 p-2 pr-6 rounded-full border-2 border-white/10 backdrop-blur-md shadow-lg">
            {/* Character Portrait */}
            <div className="w-16 h-16 rounded-full border-4 border-yellow-400/80 overflow-hidden bg-black/80 flex items-center justify-center shadow-[0_0_15px_rgba(250,204,21,0.4)] relative">
                <img src="/character_portrait.svg" alt="Davi" className="w-full h-full object-cover opacity-80 mix-blend-screen" onError={(e) => e.currentTarget.style.display = 'none'} />
                <Sparkles size={20} className="text-yellow-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20" />
            </div>
            
            <div className="flex flex-col gap-1 items-start">
                <div className="flex items-center gap-2">
                    <Heart size={20} fill="#ef4444" className="text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]" />
                    <div className="w-40 h-5 bg-black/60 border border-white/20 rounded-full overflow-hidden shadow-inner relative">
                        <motion.div 
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-600 via-rose-500 to-red-400" 
                            initial={{ width: `${health}%` }} animate={{ width: `${health}%` }} transition={{ type: 'spring', stiffness: 50 }}
                        />
                        {/* Shine effect on bar */}
                        <div className="absolute top-0 left-0 w-full h-1/2 bg-white/20" />
                    </div>
                </div>
                
                <div className="flex gap-4 px-1 mt-1">
                  <div className="flex items-center gap-1">
                      <Star size={16} fill="#facc15" className="text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]" />
                      <span className="text-white font-bold font-mono text-sm drop-shadow-md">{score.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                      <Sword size={16} className="text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.8)]" />
                      <span className="text-white font-bold font-mono text-sm drop-shadow-md">{enemies.length}</span>
                  </div>
                  <div className="flex items-center gap-1">
                      <span className="text-blue-300 font-black text-xs uppercase bg-blue-900/50 px-2 py-0.5 rounded border border-blue-500/30">Fase {phase}</span>
                  </div>
                </div>
            </div>
        </div>

        {/* Extra Game HUD Elements */}
        {isExtraGame && (
          <motion.div initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex flex-col gap-2 ml-4">
            <div className="flex items-center gap-2 bg-yellow-900/60 p-1.5 pr-4 rounded-full border border-yellow-500/30 backdrop-blur-sm w-fit">
                <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center shadow-[0_0_10px_rgba(234,179,8,0.8)]">
                  <Coins size={16} fill="#fff" className="text-yellow-200" />
                </div>
                <span className="text-yellow-400 font-bold font-mono drop-shadow-md">{coins}</span>
            </div>
            
            <div className="flex items-center gap-2 bg-blue-900/60 p-1.5 pr-4 rounded-full border border-blue-500/30 backdrop-blur-sm w-fit">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shadow-[0_0_10px_rgba(59,130,246,0.8)]">
                  <Sparkles size={16} fill="#fff" className="text-blue-200" />
                </div>
                <div className="w-24 h-3 bg-black/60 rounded-full overflow-hidden relative border border-blue-400/20">
                    <motion.div 
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-600 to-cyan-400" 
                        animate={{ width: `${faith}%` }}
                    />
                </div>
                <span className="text-blue-300 font-bold text-xs">{Math.floor(faith)}%</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Phase Transition Message */}
      {phaseMessage && !isWalkingHome && (
        <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/40 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0, y: 50 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 1.5, opacity: 0 }} transition={{ type: 'spring', bounce: 0.6 }}
            className="text-center p-8 bg-gradient-to-b from-yellow-700/80 to-yellow-900/90 border-4 border-yellow-400 rounded-3xl shadow-[0_0_50px_rgba(250,204,21,0.6)] backdrop-blur-md"
          >
            <h2 className="text-4xl md:text-5xl text-white font-black drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] uppercase" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {phaseMessage}
            </h2>
          </motion.div>
        </div>
      )}
      
      {/* Right Middle: Volume */}
      <div className="absolute top-1/2 -translate-y-1/2 right-2 pointer-events-auto z-50 opacity-50 hover:opacity-100 transition-opacity">
        <div className="bg-gray-900/60 backdrop-blur-sm p-1.5 rounded-full border border-white/5 flex flex-col items-center gap-1 shadow-md py-2">
          <span className="text-white/60 text-[7px] font-bold tracking-widest">VOL</span>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-1 h-14 accent-yellow-400 appearance-none bg-white/20 rounded-full cursor-pointer"
            style={{ writingMode: 'vertical-lr', WebkitAppearance: 'slider-vertical' }}
          />
        </div>
      </div>

      {/* Top Right: Pause Button */}
      <div className="absolute top-4 right-4 pointer-events-auto z-50">
        <motion.button 
          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
          onClick={() => {
            togglePause();
            document.exitPointerLock();
          }}
          className="w-14 h-14 bg-gray-900/80 border-2 border-white/20 rounded-full flex items-center justify-center text-white backdrop-blur-sm shadow-lg hover:border-white/50 transition-colors"
        >
          <Pause fill="currentColor" size={24} />
        </motion.button>
      </div>

      {/* Bottom Left: Joystick */}
      <div className="absolute bottom-12 left-12 pointer-events-auto">
          <Joystick onMove={handleJoystickMove} onStop={handleJoystickStop} />
      </div>

      {/* Bottom Right: Actions (Arc Layout MOBA style) */}
      <div className="absolute bottom-12 right-12 pointer-events-none w-56 h-56">
        {!isExtraGame ? (
          <>
            {/* Primary Button: Stone */}
            <div className={`pointer-events-auto absolute bottom-0 right-0 w-24 h-24 rounded-full transition-all ${weapon === 'sling' ? 'scale-110' : ''}`}>
              <AimJoystick 
                onAim={(x, y) => window.dispatchEvent(new CustomEvent('aimJoystickMove', { detail: { x, y } }))}
                onAttack={() => triggerAttack('sling')}
                icon={<RectangleVertical size={32} strokeWidth={2.5} />}
                label=""
                colorClass="bg-gray-900/80 border-[4px] border-yellow-400 text-white shadow-[0_0_20px_rgba(250,204,21,0.6)]"
              />
            </div>
            
            {/* Secondary Button 1: Knife (Left of Primary) */}
            <div className={`pointer-events-auto absolute bottom-4 right-[115px] w-14 h-14 rounded-full transition-all ${weapon === 'knife' ? 'scale-110' : ''}`}>
              <AimJoystick 
                onAim={(x, y) => window.dispatchEvent(new CustomEvent('aimJoystickMove', { detail: { x, y } }))}
                onAttack={() => triggerAttack('knife')}
                icon={<Sword size={20} strokeWidth={2.5} />}
                label=""
                colorClass="bg-gray-800/90 border-[3px] border-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.5)]"
              />
            </div>

            {/* Secondary Button 2: Defense (Top-Left of Primary) */}
            <button 
                className="pointer-events-auto absolute bottom-[95px] right-[95px] w-14 h-14 bg-gray-800/90 border-[3px] border-cyan-400 rounded-full active:bg-cyan-900/90 flex flex-col items-center justify-center text-white transition-all shadow-[0_0_15px_rgba(34,211,238,0.5)]"
                onPointerDown={() => window.dispatchEvent(new Event('blockStart'))}
                onPointerUp={() => window.dispatchEvent(new Event('blockEnd'))}
                onPointerLeave={() => window.dispatchEvent(new Event('blockEnd'))}
                onPointerCancel={() => window.dispatchEvent(new Event('blockEnd'))}
            >
                <ShieldAlert size={20} strokeWidth={2.5} />
            </button>

            {/* Secondary Button 3: Jump (Top of Primary) */}
            <button 
                className="pointer-events-auto absolute bottom-[125px] right-2 w-14 h-14 bg-gray-800/90 border-[3px] border-pink-500 rounded-full active:bg-pink-900/90 flex flex-col items-center justify-center text-white transition-all shadow-[0_0_15px_rgba(236,72,153,0.5)]"
                onPointerDown={() => sendKey('Space', true)}
                onPointerUp={() => sendKey('Space', false)}
                onPointerLeave={() => sendKey('Space', false)}
                onPointerCancel={() => sendKey('Space', false)}
            >
                <span className="font-extrabold text-sm">PULO</span>
            </button>
          </>
        ) : (
          <>
            {/* Primary Button: Sword (Extra Game focuses on Sword) */}
            <button 
                className="pointer-events-auto absolute bottom-0 right-0 w-24 h-24 rounded-full bg-gray-900/80 border-[4px] border-yellow-400 flex flex-col items-center justify-center text-white font-bold transition-all shadow-[0_0_20px_rgba(250,204,21,0.6)] active:bg-gray-800/90 hover:scale-105 active:scale-95"
                onPointerDown={(e) => {
                    e.preventDefault();
                    triggerAttack('knife');
                }}
                onContextMenu={(e) => e.preventDefault()}
            >
                <Sword size={36} strokeWidth={2.5} />
            </button>

            {/* Secondary Button 1: Stone (Left of Primary) */}
            <div className={`pointer-events-auto absolute bottom-4 right-[115px] w-14 h-14 rounded-full transition-all ${weapon === 'sling' ? 'scale-110' : ''}`}>
              <AimJoystick 
                onAim={(x, y) => window.dispatchEvent(new CustomEvent('aimJoystickMove', { detail: { x, y } }))}
                onAttack={() => triggerAttack('sling')}
                icon={<RectangleVertical size={20} strokeWidth={2.5} />}
                label=""
                colorClass="bg-gray-800/90 border-[3px] border-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.5)]"
              />
            </div>

            {/* Secondary Button 2: Defense (Top-Left of Primary) */}
            <button 
                className="pointer-events-auto absolute bottom-[95px] right-[95px] w-14 h-14 bg-gray-800/90 border-[3px] border-cyan-400 rounded-full active:bg-cyan-900/90 flex flex-col items-center justify-center text-white transition-all shadow-[0_0_15px_rgba(34,211,238,0.5)]"
                onPointerDown={() => window.dispatchEvent(new Event('blockStart'))}
                onPointerUp={() => window.dispatchEvent(new Event('blockEnd'))}
                onPointerLeave={() => window.dispatchEvent(new Event('blockEnd'))}
                onPointerCancel={() => window.dispatchEvent(new Event('blockEnd'))}
            >
                <ShieldAlert size={20} strokeWidth={2.5} />
            </button>

            {/* Secondary Button 3: Jump (Top of Primary) */}
            <button 
                className="pointer-events-auto absolute bottom-[125px] right-2 w-14 h-14 bg-gray-800/90 border-[3px] border-pink-500 rounded-full active:bg-pink-900/90 flex flex-col items-center justify-center text-white transition-all shadow-[0_0_15px_rgba(236,72,153,0.5)]"
                onPointerDown={() => sendKey('Space', true)}
                onPointerUp={() => sendKey('Space', false)}
                onPointerLeave={() => sendKey('Space', false)}
                onPointerCancel={() => sendKey('Space', false)}
            >
                <span className="font-extrabold text-sm">PULO</span>
            </button>
          </>
        )}
      </div>
      
      {/* Instructions */}
      <div className="absolute top-20 left-4 text-white/50 font-sans text-xs p-2 rounded pointer-events-none">
        <p>WASD / Joystick Esquerdo para Mover</p>
        <p>Arraste a tela para Mirar</p>
        <p>Arraste os botões de arma para Mirar e Atirar</p>
        <p>ESPAÇO / Botão para Pular</p>
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
  const volume = useStore((state) => state.volume);

  const [audio] = useState(() => {
    // Dynamic ambient track
    const a = new Audio('https://assets.mixkit.co/active_storage/sfx/246/246-preview.mp3'); 
    a.loop = true;
    a.volume = 0.15 * volume; // Slightly louder and more present
    a.playbackRate = 1.2; // Faster wind for more tension
    return a;
  });

  useEffect(() => {
    audio.volume = 0.15 * volume;
  }, [volume, audio]);

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

  useEffect(() => {
    return () => {
        audio.pause();
    };
  }, [audio]);

  return null;
}

function CombatMusic() {
  const isPaused = useStore((state) => state.isPaused);
  const health = useStore((state) => state.health);
  const enemies = useStore((state) => state.enemies);
  const volume = useStore((state) => state.volume);

  const [audio] = useState(() => {
    // Fast-paced epic loop for combat
    const a = new Audio('https://assets.mixkit.co/active_storage/sfx/2042/2042-preview.mp3'); 
    a.loop = true;
    a.volume = 0;
    a.playbackRate = 1.4; // Make it much more animated and dynamic
    return a;
  });

  useEffect(() => {
    return () => {
        audio.pause();
    };
  }, [audio]);

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
        const targetVolume = Math.min(0.4, 0.1 + enemies.length * 0.1) * volume;
        
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
  }, [enemies.length, isPaused, health, audio, volume]);

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
      try {
        const ePos = rb.translation();
        const eVec = new THREE.Vector3(ePos.x, ePos.y, ePos.z);
        const dist = pVec.distanceTo(eVec);
        if (dist < minDistance) {
          minDistance = dist;
          closestEnemy = enemy;
        }
      } catch (e) {
        // Ignore invalid rigid bodies
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
        try {
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
        } catch (e) {
          groupRef.current.visible = false;
          wasVisible.current = false;
        }
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
  const storyScreen = useStore((state) => state.storyScreen);

  return (
    <div className="w-full h-screen bg-black">
      <StoryScreen />
      
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

              <Physics gravity={[0, -9.81, 0]} paused={isPaused || health <= 0 || storyScreen !== 0}>
                <GameContent />
              </Physics>
              
              <PointerLockControls enabled={health > 0 && !isPaused && storyScreen === 0} />
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
