import React, { useEffect, useState, useRef } from 'react';
import { useStore } from '../store';
import { playerRef } from './Player';

export function MiniMap() {
  const { enemies } = useStore();
  const [playerPos, setPlayerPos] = useState({ x: 0, z: 0 });
  const [enemyPositions, setEnemyPositions] = useState<{ id: string, x: number, z: number, type: string }[]>([]);
  
  // Landmarks (static)
  const landmarks = [
    { type: 'well', x: 15, z: -15 },
    { type: 'well', x: -30, z: 25 },
    { type: 'ruins', x: 22, z: 12 },
    { type: 'ruins', x: -21, z: -19 },
    { type: 'passage', x: 0, z: -90 }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current) {
        const pos = playerRef.current.translation();
        setPlayerPos({ x: pos.x, z: pos.z });
      }
      
      // We don't have direct access to enemy rigidbodies here, 
      // but we can use the initial positions or if we add a way to track them in store.
      // For now, we'll just show the ones from the store if they have positions.
      // Actually, enemies in store don't update their position continuously.
      // We can add a simple tracking mechanism or just show their general area.
      // Let's just show the enemies from the store.
      setEnemyPositions(enemies.map(e => ({ id: e.id, x: e.position[0], z: e.position[2], type: e.type })));
    }, 100); // 10fps update for minimap is enough

    return () => clearInterval(interval);
  }, [enemies]);

  // Map scale and bounds
  const mapSize = 150; // UI size in pixels
  const worldSize = 200; // World size in units (-100 to 100)
  const scale = mapSize / worldSize;

  const toMapCoords = (x: number, z: number) => {
    // Center is mapSize / 2
    return {
      left: `${(x + worldSize / 2) * scale}px`,
      top: `${(z + worldSize / 2) * scale}px`
    };
  };

  return (
    <div 
      className="absolute top-4 right-4 bg-black/60 border-2 border-[#d2b48c] rounded-full overflow-hidden shadow-lg backdrop-blur-sm pointer-events-none"
      style={{ width: mapSize, height: mapSize }}
    >
      {/* Compass / Map Background */}
      <div className="absolute inset-0 rounded-full border border-white/10" />
      
      {/* Landmarks */}
      {landmarks.map((landmark, i) => (
        <div 
          key={i}
          className={`absolute w-2 h-2 -ml-1 -mt-1 rounded-sm ${landmark.type === 'well' ? 'bg-blue-400' : landmark.type === 'passage' ? 'bg-yellow-400' : 'bg-gray-400'}`}
          style={toMapCoords(landmark.x, landmark.z)}
          title={landmark.type}
        />
      ))}

      {/* Enemies */}
      {enemyPositions.map(enemy => (
        <div 
          key={enemy.id}
          className="absolute w-2 h-2 -ml-1 -mt-1 bg-red-500 rounded-full animate-pulse"
          style={toMapCoords(enemy.x, enemy.z)}
        />
      ))}

      {/* Player */}
      <div 
        className="absolute w-3 h-3 -ml-1.5 -mt-1.5 bg-green-400 border border-white rounded-full shadow-[0_0_8px_#4ade80]"
        style={toMapCoords(playerPos.x, playerPos.z)}
      />
    </div>
  );
}
