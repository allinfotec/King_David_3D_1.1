import { useState, useRef, useEffect } from 'react';

interface JoystickProps {
  onMove: (x: number, y: number) => void;
  onStop: () => void;
}

export function Joystick({ onMove, onStop }: JoystickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const center = useRef({ x: 0, y: 0 });

  const handleStart = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    center.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    setActive(true);
    handleMove(clientX, clientY);
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
    // Invert Y because screen Y is down, but usually up is positive in games (or forward)
    // Actually, let's keep standard screen coords: Y down is positive.
    // In 3D: Forward is usually -Z. Backward is +Z.
    // So Up on joystick (negative screen Y) should be Forward (positive movement value for calculation).
    onMove(x / maxDist, y / maxDist);
  };

  const handleEnd = () => {
    setActive(false);
    setPosition({ x: 0, y: 0 });
    onStop();
  };

  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (active) {
        e.preventDefault(); // Prevent scrolling
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchEnd = () => {
      if (active) handleEnd();
    };
    
    const onMouseMove = (e: MouseEvent) => {
      if (active) handleMove(e.clientX, e.clientY);
    };
    const onMouseUp = () => {
      if (active) handleEnd();
    };

    if (active) {
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onTouchEnd);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }

    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [active]);

  return (
    <div 
      ref={containerRef}
      className="relative w-32 h-32 bg-white/10 border-2 border-white/30 rounded-full backdrop-blur-sm touch-none"
      onPointerDown={(e) => {
        e.preventDefault();
        handleStart(e.clientX, e.clientY);
      }}
    >
      <div 
        ref={knobRef}
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
