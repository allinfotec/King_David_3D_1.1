import { useState, useRef, useEffect } from 'react';

interface JoystickProps {
  onMove: (x: number, y: number) => void;
  onStop: () => void;
}

export function Joystick({ onMove, onStop }: JoystickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const touchStart = useRef({ x: 0, y: 0 });
  const pointerId = useRef<number | null>(null);
  const onStopRef = useRef(onStop);
  const onMoveRef = useRef(onMove);

  useEffect(() => {
    onStopRef.current = onStop;
    onMoveRef.current = onMove;
  }, [onStop, onMove]);

  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (pointerId.current === e.pointerId) {
        handleMove(e.clientX, e.clientY);
      }
    };

    const handleGlobalPointerUp = (e: PointerEvent) => {
      if (pointerId.current === e.pointerId) {
        pointerId.current = null;
        setActive(false);
        setPosition({ x: 0, y: 0 });
        onStopRef.current();
      }
    };
    
    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    
    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== null) return; // Already active with another pointer
    
    pointerId.current = e.pointerId;
    touchStart.current = { x: e.clientX, y: e.clientY };
    setActive(true);
    handleMove(e.clientX, e.clientY);
  };

  const handleMove = (clientX: number, clientY: number) => {
    const dx = clientX - touchStart.current.x;
    const dy = clientY - touchStart.current.y;
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxVisualDist = 50; // Max radius for visual knob
    const maxLogicalDist = 30; // Distance to reach 100% speed (more sensitive)
    
    let x = dx;
    let y = dy;
    
    if (distance > maxVisualDist) {
      x = (dx / distance) * maxVisualDist;
      y = (dy / distance) * maxVisualDist;
    }
    
    setPosition({ x, y });
    
    // Normalize output -1 to 1 based on logical distance
    let outX = dx / maxLogicalDist;
    let outY = dy / maxLogicalDist;

    // Small deadzone
    const deadzone = 0.05; // Reduced deadzone for quicker response
    let outDist = Math.sqrt(outX * outX + outY * outY);
    
    if (outDist > 1) {
      outX /= outDist;
      outY /= outDist;
      outDist = 1;
    }

    if (outDist < deadzone) {
      outX = 0;
      outY = 0;
    } else {
      // Rescale so it smoothly goes from 0 to 1 after deadzone
      // Apply a slight curve to make small movements more precise but ramp up faster
      const rescale = Math.pow((outDist - deadzone) / (1 - deadzone), 0.85);
      outX = (outX / outDist) * rescale;
      outY = (outY / outDist) * rescale;
    }

    onMoveRef.current(outX, outY);
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-40 h-40 bg-white/10 border-2 border-white/30 rounded-full backdrop-blur-sm touch-none flex items-center justify-center shadow-lg"
      onPointerDown={handlePointerDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Inner decorative circle */}
      <div className="absolute w-16 h-16 rounded-full border border-white/20 pointer-events-none" />
      
      {/* The Joystick Knob */}
      <div 
        className="absolute w-14 h-14 bg-white/60 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.4)] pointer-events-none"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          transition: active ? 'none' : 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
      />
    </div>
  );
}
