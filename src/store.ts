import { create } from 'zustand';
import { nanoid } from 'nanoid';

interface Stone {
  id: string;
  position: [number, number, number];
  velocity: [number, number, number];
}

interface Enemy {
  id: string;
  position: [number, number, number];
  health: number;
  maxHealth: number;
  type: 'wolf' | 'bear' | 'lion' | 'philistine_soldier' | 'philistine_archer' | 'philistine_heavy' | 'goliath';
}

interface Effect {
  id: string;
  position: [number, number, number];
  type: 'impact' | 'blood' | 'smoke' | 'flash';
  createdAt: number;
}

interface GameState {
  health: number;
  score: number;
  isPaused: boolean;
  isDodging: boolean;
  isBlocking: boolean;
  isStarted: boolean;
  phase: number;
  enemiesKilledInPhase: number;
  phaseMessage: string | null;
  isTransitioningPhase: boolean;
  isWalkingHome: boolean;
  isAnointing: boolean;
  isExtraGame: boolean;
  coins: number;
  faith: number;
  buildings: { type: string; level: number }[];
  allies: { type: string; count: number }[];
  isMounted: boolean;
  storyScreen: number;
  retryCount: number;
  volume: number;
  weapon: 'sling' | 'knife';
  gameWon: boolean;
  stones: Stone[];
  enemies: Enemy[];
  effects: Effect[];
  targetId: string | null;
  setWeapon: (weapon: 'sling' | 'knife') => void;
  takeDamage: (amount: number) => void;
  damageEnemy: (id: string, amount: number) => void;
  addScore: (amount: number) => void;
  togglePause: () => void;
  setDodging: (dodging: boolean) => void;
  setBlocking: (blocking: boolean) => void;
  setTargetId: (id: string | null) => void;
  setGameWon: (won: boolean) => void;
  startGame: () => void;
  resumeGame: () => void;
  reset: () => void;
  jumpToPhase: (phase: number) => void;
  retryPhase: () => void;
  shootStone: (position: [number, number, number], velocity: [number, number, number]) => void;
  removeStone: (id: string) => void;
  spawnEnemy: (position: [number, number, number], type: 'wolf' | 'bear' | 'lion' | 'philistine_soldier' | 'philistine_archer' | 'philistine_heavy' | 'goliath', health: number) => void;
  removeEnemy: (id: string) => void;
  addEffect: (position: [number, number, number], type: 'impact' | 'blood' | 'smoke' | 'flash') => void;
  removeEffect: (id: string) => void;
  setPhaseMessage: (message: string | null) => void;
  nextPhase: () => void;
  incrementKills: () => void;
  setStoryScreen: (screen: number) => void;
  startWalkingHome: () => void;
  setWalkingHome: (walking: boolean) => void;
  startAnointing: () => void;
  finishGame: () => void;
  setVolume: (volume: number) => void;
  startExtraGame: () => void;
  addCoins: (amount: number) => void;
  useFaith: (amount: number) => void;
  addFaith: (amount: number) => void;
  upgradeBuilding: (type: string) => void;
  recruitAlly: (type: string) => void;
}

export const useStore = create<GameState>((set) => ({
  health: 100,
  score: 0,
  isPaused: false,
  isDodging: false,
  isBlocking: false,
  isStarted: false,
  phase: 1,
  enemiesKilledInPhase: 0,
  phaseMessage: null,
  isTransitioningPhase: false,
  isWalkingHome: false,
  isAnointing: false,
  isExtraGame: false,
  coins: 0,
  faith: 100,
  buildings: [],
  allies: [],
  isMounted: false,
  storyScreen: 1,
  retryCount: 0,
  volume: 1,
  weapon: 'sling',
  gameWon: false,
  stones: [],
  enemies: [],
  effects: [],
  targetId: null,
  setWeapon: (weapon) => set({ weapon }),
  takeDamage: (amount) => set((state) => ({ health: Math.max(0, state.health - amount) })),
  damageEnemy: (id, amount) => set((state) => ({
    enemies: state.enemies.map((e) => e.id === id ? { ...e, health: e.health - amount } : e)
  })),
  addScore: (amount) => set((state) => ({ score: state.score + amount })),
  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),
  setDodging: (dodging) => set({ isDodging: dodging }),
  setBlocking: (blocking) => set({ isBlocking: blocking }),
  setTargetId: (id) => set({ targetId: id }),
  setGameWon: (won) => set({ gameWon: won }),
  startGame: () => set({ isStarted: true, health: 100, score: 0, isPaused: false, phase: 1, enemiesKilledInPhase: 0, phaseMessage: null, isTransitioningPhase: false, isWalkingHome: false, isAnointing: false, isExtraGame: false, storyScreen: 0, gameWon: false, stones: [], enemies: [], effects: [], targetId: null }),
  resumeGame: () => set({ isStarted: true, isPaused: false, storyScreen: 0, stones: [], enemies: [], effects: [] }),
  reset: () => set({ health: 100, score: 0, isPaused: false, isDodging: false, isBlocking: false, isStarted: false, phase: 1, enemiesKilledInPhase: 0, phaseMessage: null, isTransitioningPhase: false, isWalkingHome: false, isAnointing: false, isExtraGame: false, storyScreen: 1, gameWon: false, stones: [], enemies: [], effects: [], targetId: null }),
  jumpToPhase: (phase) => set({ isStarted: true, health: 100, score: 0, isPaused: false, phase: phase, enemiesKilledInPhase: 0, phaseMessage: null, isTransitioningPhase: false, isWalkingHome: false, isAnointing: false, isExtraGame: false, storyScreen: 0, gameWon: false, stones: [], enemies: [], effects: [], targetId: null }),
  retryPhase: () => set((state) => ({ health: 100, isPaused: false, isDodging: false, isBlocking: false, enemiesKilledInPhase: 0, phaseMessage: null, isTransitioningPhase: false, isWalkingHome: false, isAnointing: false, gameWon: false, stones: [], enemies: [], effects: [], targetId: null, retryCount: state.retryCount + 1 })),
  shootStone: (position, velocity) => set((state) => ({
    stones: [...state.stones, { id: nanoid(), position, velocity }]
  })),
  removeStone: (id) => set((state) => ({
    stones: state.stones.filter((s) => s.id !== id)
  })),
  spawnEnemy: (position, type, health) => set((state) => ({
    enemies: [...state.enemies, { id: nanoid(), position, health, maxHealth: health, type }]
  })),
  removeEnemy: (id) => set((state) => ({
    enemies: state.enemies.filter((e) => e.id !== id)
  })),
  addEffect: (position, type) => set((state) => ({
    effects: [...state.effects, { id: nanoid(), position, type, createdAt: Date.now() }]
  })),
  removeEffect: (id) => set((state) => ({
    effects: state.effects.filter((e) => e.id !== id)
  })),
  setPhaseMessage: (message) => set({ phaseMessage: message, isTransitioningPhase: message !== null }),
  nextPhase: () => set((state) => {
    let nextStoryScreen = 0;
    if (state.phase === 1) nextStoryScreen = 5;
    else if (state.phase === 2) nextStoryScreen = 7;
    else if (state.phase === 3) nextStoryScreen = 9;
    
    return { 
      health: 100, // Replenish health when passing the phase
      phase: state.phase + 1, 
      enemiesKilledInPhase: 0, 
      phaseMessage: null, 
      isTransitioningPhase: false,
      storyScreen: nextStoryScreen,
      isStarted: nextStoryScreen === 0, // Pause game if going to story screen
      enemies: [], // Clear remaining enemies
      stones: [], // Clear remaining stones
      effects: [] // Clear remaining effects
    };
  }),
  incrementKills: () => set((state) => ({ enemiesKilledInPhase: state.enemiesKilledInPhase + 1 })),
  setStoryScreen: (screen) => set({ storyScreen: screen }),
  startWalkingHome: () => set({ isWalkingHome: true, storyScreen: 0, isPaused: false, phaseMessage: null, isStarted: true, isAnointing: false }),
  setWalkingHome: (walking) => set({ isWalkingHome: walking }),
  startAnointing: () => set({ isAnointing: true }),
  finishGame: () => set({ storyScreen: 11, isStarted: false, isWalkingHome: false, isAnointing: false }),
  setVolume: (volume) => set({ volume }),
  startExtraGame: () => set({ 
    isExtraGame: true, 
    isStarted: true, 
    health: 100, 
    score: 0, 
    coins: 0, 
    faith: 100, 
    phase: 4, // Phase 4 starts the Philistine war
    enemiesKilledInPhase: 0, 
    storyScreen: 0, 
    isMounted: false, // David on foot for extra phase
    enemies: [],
    stones: [],
    allies: [],
    buildings: [
      { type: 'barracks', level: 1 },
      { type: 'mine', level: 1 }
    ]
  }),
  addCoins: (amount) => set((state) => ({ coins: state.coins + amount })),
  useFaith: (amount) => set((state) => ({ faith: Math.max(0, state.faith - amount) })),
  addFaith: (amount) => set((state) => ({ faith: Math.min(100, state.faith + amount) })),
  upgradeBuilding: (type) => set((state) => ({
    buildings: state.buildings.map(b => b.type === type ? { ...b, level: b.level + 1 } : b)
  })),
  recruitAlly: (type) => set((state) => ({
    allies: state.allies.some(a => a.type === type) 
      ? state.allies.map(a => a.type === type ? { ...a, count: a.count + 1 } : a)
      : [...state.allies, { type, count: 1 }]
  })),
}));
