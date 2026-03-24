import { useState, useRef } from 'react';

interface JoystickProps {
  onMove: (x: number, y: number) => void;
  onStop: () => void;
}

export function Joystick({ onMove, onStop }: JoystickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const center = useRef({ x: 0, y: 0 });
  const pointerId = useRef<number | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== null) return; // Already active with another pointer
    
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerId.current = e.pointerId;
    
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    center.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    setActive(true);
    handleMove(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!active || e.pointerId !== pointerId.current) return;
    handleMove(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== pointerId.current) return;
    
    e.currentTarget.releasePointerCapture(e.pointerId);
    pointerId.current = null;
    setActive(false);
    setPosition({ x: 0, y: 0 });
    onStop();
  };

  const handleMove = (clientX: number, clientY: number) => {
    const dx = clientX - center.current.x;
    const dy = clientY - center.current.y;
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDist = 40; // Max radius
    
    let x = dx;
    let y = dy;
    
    if (distance > maxDist) {
      x = (dx / distance) * maxDist;
      y = (dy / distance) * maxDist;
    }
    
    setPosition({ x, y });
    
    // Normalize output -1 to 1
    onMove(x / maxDist, y / maxDist);
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-32 h-32 bg-white/10 border-2 border-white/30 rounded-full backdrop-blur-sm touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div 
        className="absolute w-12 h-12 bg-white/50 rounded-full shadow-lg pointer-events-none"
        style={{
          left: `calc(50% + ${position.x}px - 24px)`,
          top: `calc(50% + ${position.y}px - 24px)`,
          transition: active ? 'none' : 'all 0.2s ease-out'
        }}
      />
    </div>
  );
}
