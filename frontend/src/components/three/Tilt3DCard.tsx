import React, { useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';

interface TiltProps {
  children: React.ReactNode;
  className?: string;
  accentColor?: string;
  maxTilt?: number;
  onClick?: () => void;
}

/**
 * Hardware-accelerated CSS 3D perspective card with dynamic specular light reflection.
 * Zero server load, smooth reset on pointer leave, touch-scroll friendly.
 */
export const Tilt3DCard: React.FC<TiltProps> = ({
  children,
  className = '',
  accentColor = '#38bdf8',
  maxTilt = 10,
  onClick,
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [glare, setGlare] = useState<{ x: number; y: number; active: boolean }>({
    x: 50,
    y: 50,
    active: false,
  });

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // Keep vertical touch scrolling completely unimpeded on phones; apply subtle tilt on mouse/pen
    if (e.pointerType === 'touch') return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / Math.max(1, rect.width);
    const py = (e.clientY - rect.top) / Math.max(1, rect.height);
    const rx = (0.5 - py) * maxTilt * 2;
    const ry = (px - 0.5) * maxTilt * 2;
    setStyle({
      transform: `perspective(850px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateZ(4px)`,
      transition: 'transform 60ms linear',
    });
    setGlare({ x: Math.round(px * 100), y: Math.round(py * 100), active: true });
  };

  const handlePointerLeave = () => {
    setStyle({
      transform: 'perspective(850px) rotateX(0deg) rotateY(0deg) translateZ(0px)',
      transition: 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
    });
    setGlare((g) => ({ ...g, active: false }));
  };

  return (
    <div
      ref={ref}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (event) => {
        if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        onClick();
      } : undefined}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={style}
      className={`relative overflow-hidden will-change-transform ${onClick ? 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300' : ''} ${className}`}
    >
      {glare.active && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-200"
          style={{
            background: `radial-gradient(circle 180px at ${glare.x}% ${glare.y}%, ${accentColor}28, transparent 75%)`,
          }}
        />
      )}
      {children}
    </div>
  );
};

interface HoloQrProps {
  imageDataUrl: string;
  badgeText?: string;
  caption?: string;
}

/**
 * Interactive multi-layer 3D Holographic QR / Badge Card Stage
 * Supports full touch & mouse 3D tilt, rainbow diffraction foil, and depth parallax layers.
 */
export const HoloQr3DShowcase: React.FC<HoloQrProps> = ({ imageDataUrl, badgeText, caption }) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [rot, setRot] = useState({ x: -12, y: 16 });
  const [foilPos, setFoilPos] = useState({ x: 35, y: 30 });
  const draggingRef = useRef<{ active: boolean; sx: number; sy: number; ox: number; oy: number }>({
    active: false,
    sx: 0,
    sy: 0,
    ox: -12,
    oy: 16,
  });

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    draggingRef.current = {
      active: true,
      sx: e.clientX,
      sy: e.clientY,
      ox: rot.x,
      oy: rot.y,
    };
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = stageRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setFoilPos({
        x: Math.max(0, Math.min(100, ((e.clientX - r.left) / Math.max(1, r.width)) * 100)),
        y: Math.max(0, Math.min(100, ((e.clientY - r.top) / Math.max(1, r.height)) * 100)),
      });
    }
    if (!draggingRef.current.active) return;
    const dx = e.clientX - draggingRef.current.sx;
    const dy = e.clientY - draggingRef.current.sy;
    const nx = Math.max(-34, Math.min(34, draggingRef.current.ox - dy * 0.25));
    const ny = Math.max(-38, Math.min(38, draggingRef.current.oy + dx * 0.28));
    setRot({ x: nx, y: ny });
  };

  const onUp = () => {
    draggingRef.current.active = false;
  };

  return (
    <div className="w-full flex flex-col items-center gap-2.5 select-none">
      <div
        ref={stageRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative w-full max-w-[270px] aspect-square flex items-center justify-center cursor-grab active:cursor-grabbing touch-none py-3"
        style={{ perspective: '900px' }}
      >
        <div
          className="relative w-52 h-52 sm:w-56 sm:h-56 rounded-2xl border border-sky-400/45 bg-gradient-to-br from-slate-900 via-indigo-950/90 to-slate-950 shadow-[0_22px_50px_rgba(14,165,233,0.28)] flex items-center justify-center"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
            transition: draggingRef.current.active ? 'none' : 'transform 260ms ease-out',
          }}
        >
          {/* Deep 3D Backplate Rim */}
          <div
            className="absolute inset-0 rounded-2xl border border-indigo-500/30 bg-slate-950/90"
            style={{ transform: 'translateZ(-14px)' }}
          />

          {/* Corner 3D Alignment Pillars */}
          <div
            className="absolute inset-2.5 rounded-xl border border-dashed border-sky-400/35 pointer-events-none"
            style={{ transform: 'translateZ(10px)' }}
          />

          {/* Main Elevated QR Matrix Layer */}
          <div
            className="relative p-2.5 rounded-xl bg-white shadow-xl"
            style={{ transform: 'translateZ(24px)' }}
          >
            <img
              src={imageDataUrl}
              alt="3D QR"
              draggable={false}
              className="w-40 h-40 sm:w-44 sm:h-44 object-contain rounded-lg pointer-events-none"
            />
            {/* Iridescent Holographic Foil Glare */}
            <div
              className="pointer-events-none absolute inset-0 rounded-xl mix-blend-color-dodge opacity-55"
              style={{
                background: `linear-gradient(${115 + rot.y * 1.5}deg, transparent 18%, rgba(56,189,248,0.42) ${
                  foilPos.x - 12
                }%, rgba(232,121,249,0.45) ${foilPos.x + 6}%, rgba(250,204,21,0.32) ${
                  foilPos.x + 20
                }%, transparent 82%)`,
              }}
            />
          </div>

          {/* Floating Top Badge Chip */}
          {(badgeText || caption) && (
            <div
              className="absolute -bottom-3 px-2.5 py-0.5 rounded-full bg-sky-500 text-slate-950 font-mono font-bold text-[10px] shadow-lg border border-white/40 max-w-[85%] truncate"
              style={{ transform: 'translateZ(38px)' }}
            >
              {badgeText || caption}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-slate-400">
        <span>Вращайте 3D-карту пальцем или мышью ({Math.round(rot.x)}°, {Math.round(rot.y)}°)</span>
        <button
          type="button"
          onClick={() => setRot({ x: -12, y: 16 })}
          className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-sky-300 flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" /> Сброс
        </button>
      </div>
    </div>
  );
};
