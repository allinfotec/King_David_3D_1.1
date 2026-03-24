import { useState, useRef } from 'react';

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
  const center = useRef({ x: 0, y: 0 });
  const pointerId = useRef<number | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== null) return;
    
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerId.current = e.pointerId;
    
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    center.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    setActive(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!active || e.pointerId !== pointerId.current) return;
    
    const dx = e.clientX - center.current.x;
    const dy = e.clientY - center.current.y;
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDist = 40;
    
    let x = dx;
    let y = dy;
    
    if (distance > maxDist) {
      x = (dx / distance) * maxDist;
      y = (dy / distance) * maxDist;
    }
    
    setPosition({ x, y });
    onAim(x / maxDist, y / maxDist);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== pointerId.current) return;
    
    e.currentTarget.releasePointerCapture(e.pointerId);
    pointerId.current = null;
    setActive(false);
    setPosition({ x: 0, y: 0 });
    onAim(0, 0);
    onAttack(); // Fire attack when released
  };

  return (
    <div 
      ref={containerRef}
      className={`relative w-[72px] h-[72px] p-3 rounded-xl border-2 flex flex-col items-center justify-center transition-all backdrop-blur-md touch-none select-none ${colorClass}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* The actual button content */}
      <div 
        className="flex flex-col items-center justify-center pointer-events-none z-10"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          transition: active ? 'none' : 'transform 0.2s ease-out'
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
