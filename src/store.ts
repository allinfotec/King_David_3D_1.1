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
  type: 'wolf' | 'bear' | 'lion';
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
  storyScreen: number;
  stones: Stone[];
  enemies: Enemy[];
  effects: Effect[];
  targetId: string | null;
  takeDamage: (amount: number) => void;
  damageEnemy: (id: string, amount: number) => void;
  addScore: (amount: number) => void;
  togglePause: () => void;
  setDodging: (dodging: boolean) => void;
  setBlocking: (blocking: boolean) => void;
  setTargetId: (id: string | null) => void;
  startGame: () => void;
  resumeGame: () => void;
  reset: () => void;
  shootStone: (position: [number, number, number], velocity: [number, number, number]) => void;
  removeStone: (id: string) => void;
  spawnEnemy: (position: [number, number, number], type: 'wolf' | 'bear' | 'lion', health: number) => void;
  removeEnemy: (id: string) => void;
  addEffect: (position: [number, number, number], type: 'impact' | 'blood' | 'smoke' | 'flash') => void;
  removeEffect: (id: string) => void;
  setPhaseMessage: (message: string | null) => void;
  nextPhase: () => void;
  incrementKills: () => void;
  setStoryScreen: (screen: number) => void;
  startWalkingHome: () => void;
  setWalkingHome: (walking: boolean) => void;
  finishGame: () => void;
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
  storyScreen: 1,
  stones: [],
  enemies: [],
  effects: [],
  targetId: null,
  takeDamage: (amount) => set((state) => ({ health: Math.max(0, state.health - amount) })),
  damageEnemy: (id, amount) => set((state) => ({
    enemies: state.enemies.map((e) => e.id === id ? { ...e, health: e.health - amount } : e)
  })),
  addScore: (amount) => set((state) => ({ score: state.score + amount })),
  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),
  setDodging: (dodging) => set({ isDodging: dodging }),
  setBlocking: (blocking) => set({ isBlocking: blocking }),
  setTargetId: (id) => set({ targetId: id }),
  startGame: () => set({ isStarted: true, health: 100, score: 0, isPaused: false, phase: 1, enemiesKilledInPhase: 0, phaseMessage: null, isTransitioningPhase: false, isWalkingHome: false, storyScreen: 0, stones: [], enemies: [], effects: [], targetId: null }),
  resumeGame: () => set({ isStarted: true, isPaused: false, storyScreen: 0, stones: [], enemies: [], effects: [] }),
  reset: () => set({ health: 100, score: 0, isPaused: false, isDodging: false, isBlocking: false, isStarted: false, phase: 1, enemiesKilledInPhase: 0, phaseMessage: null, isTransitioningPhase: false, isWalkingHome: false, storyScreen: 1, stones: [], enemies: [], effects: [], targetId: null }),
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
  startWalkingHome: () => set({ isWalkingHome: true, storyScreen: 0, isPaused: false, phaseMessage: null, isStarted: true }),
  setWalkingHome: (walking) => set({ isWalkingHome: walking }),
  finishGame: () => set({ storyScreen: 10, isStarted: false, isWalkingHome: false }),
}));
