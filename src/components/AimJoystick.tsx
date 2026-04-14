import { useState, useRef, useEffect } from 'react';

interface AimJoystickProps {
  onAim: (x: number, y: number) => void;
  onAttack: () => void;
  icon: React.ReactNode;
  label: string;
  colorClass: string;
}

export function AimJoystick({ onAim, onAttack, icon, label, colorClass }: AimJoystickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const touchStart = useRef({ x: 0, y: 0 });
  const pointerId = useRef<number | null>(null);
  const onAimRef = useRef(onAim);
  const onAttackRef = useRef(onAttack);

  useEffect(() => {
    onAimRef.current = onAim;
    onAttackRef.current = onAttack;
  }, [onAim, onAttack]);

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
        onAimRef.current(0, 0);
        onAttackRef.current();
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
    if (pointerId.current !== null) return;
    
    pointerId.current = e.pointerId;
    touchStart.current = { x: e.clientX, y: e.clientY };
    setActive(true);
    handleMove(e.clientX, e.clientY);
  };

  const handleMove = (clientX: number, clientY: number) => {
    const dx = clientX - touchStart.current.x;
    const dy = clientY - touchStart.current.y;
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxVisualDist = 40; // Max visual radius
    const maxLogicalDist = 25; // Distance to reach 100% aim (more sensitive)
    
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
    const deadzone = 0.05; // Reduced deadzone
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
      const rescale = Math.pow((outDist - deadzone) / (1 - deadzone), 0.85);
      outX = (outX / outDist) * rescale;
      outY = (outY / outDist) * rescale;
    }

    onAimRef.current(outX, outY);
  };

  return (
    <div 
      ref={containerRef}
      className={`relative w-16 h-16 p-2 rounded-xl border-2 flex flex-col items-center justify-center transition-all backdrop-blur-md touch-none select-none ${colorClass}`}
      onPointerDown={handlePointerDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* The actual button content */}
      <div 
        className="flex flex-col items-center justify-center pointer-events-none z-10"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          transition: active ? 'none' : 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
      >
        {icon}
        <span className="text-[10px] font-bold mt-1 tracking-wider">{label}</span>
      </div>
      
      {/* Background indicator when active */}
      {active && (
        <div className="absolute inset-0 rounded-xl bg-white/10 pointer-events-none" />
      )}
    </div>
  );
}
