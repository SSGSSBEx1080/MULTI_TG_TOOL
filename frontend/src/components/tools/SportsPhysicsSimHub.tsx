import React, { useEffect, useRef, useState } from 'react';
import { Play, RotateCcw, Sparkles } from 'lucide-react';
import { syncHiDPICanvas, useCanvasVisibility } from '../../lib/engine3d';
import { Mini3DSceneBadge } from '../three/Interactive3DScenes';

type SportMode = 'billiards_3d_sim' | 'curling_sim' | 'carrom_sim' | 'bowling_3d_sim';

interface Disc {
  id: number;
  x: number; // normalized table coordinates
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  label?: string;
  pocketed?: boolean;
  kind?: string;
}

export const SportsPhysicsSimHub: React.FC<{
  activeTool: string;
  onSelectTool: (t: string) => void;
  onSync: () => void;
}> = ({ activeTool, onSelectTool, onSync }) => {
  const mode: SportMode = (
    ['billiards_3d_sim', 'curling_sim', 'carrom_sim', 'bowling_3d_sim'] as const
  ).includes(activeTool as SportMode)
    ? (activeTool as SportMode)
    : 'billiards_3d_sim';

  const { wrapRef, visible } = useCanvasVisibility();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [angleDeg, setAngleDeg] = useState<number>(0);
  const [power, setPower] = useState<number>(68);
  const [spin, setSpin] = useState<number>(15);
  const [strikerPos, setStrikerPos] = useState<number>(0); // -0.6..0.6 for carrom/bowling/curling
  const [sweeping, setSweeping] = useState<boolean>(false);
  const [scoreText, setScoreText] = useState<string>('Готов к удару');

  const discsRef = useRef<Disc[]>([]);
  const curlingTurnRef = useRef<number>(0);
  const sweepingRef = useRef<boolean>(false);
  sweepingRef.current = sweeping;

  const initTable = (m: SportMode) => {
    const arr: Disc[] = [];
    if (m === 'billiards_3d_sim') {
      // Cue ball on left (-0.52, 0), 15 rack balls on right (+0.38, 0)
      arr.push({ id: 0, x: -0.52, y: 0, vx: 0, vy: 0, r: 0.036, color: '#ffffff', label: '' });
      const ballColors = [
        '#facc15', '#3b82f6', '#ef4444', '#a855f7', '#f97316',
        '#10b981', '#991b1b', '#0f172a', '#fde047', '#60a5fa',
        '#f87171', '#c084fc', '#fb923c', '#34d399', '#b91c1c',
      ];
      let idx = 0;
      const r = 0.036;
      for (let col = 0; col < 5; col++) {
        for (let row = 0; row <= col; row++) {
          const bx = 0.34 + col * (r * 1.78);
          const by = (row - col / 2) * (r * 2.04);
          arr.push({
            id: idx + 1,
            x: bx,
            y: by,
            vx: 0,
            vy: 0,
            r,
            color: ballColors[idx % ballColors.length],
            label: String(idx + 1),
          });
          idx++;
        }
      }
      setAngleDeg(0);
      setScoreText('Забито шаров: 0 / 15');
    } else if (m === 'curling_sim') {
      curlingTurnRef.current = 0;
      setAngleDeg(0);
      setScoreText('Бросок 1: Красные vs Жёлтые (зажмите «Свиповать лёд» при скольжении!)');
    } else if (m === 'carrom_sim') {
      // Striker at bottom (0, 0.66), Queen at (0,0), ring of white/black men
      arr.push({ id: 0, x: 0, y: 0.66, vx: 0, vy: 0, r: 0.048, color: '#fef08a', label: 'S', kind: 'striker' });
      arr.push({ id: 1, x: 0, y: 0, vx: 0, vy: 0, r: 0.036, color: '#e11d48', label: 'Q', kind: 'queen' });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        arr.push({
          id: 2 + i,
          x: Math.cos(a) * 0.078,
          y: Math.sin(a) * 0.078,
          vx: 0,
          vy: 0,
          r: 0.035,
          color: i % 2 === 0 ? '#f8fafc' : '#1e293b',
          kind: i % 2 === 0 ? 'white' : 'black',
        });
      }
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + 0.25;
        arr.push({
          id: 8 + i,
          x: Math.cos(a) * 0.155,
          y: Math.sin(a) * 0.155,
          vx: 0,
          vy: 0,
          r: 0.035,
          color: i % 2 === 0 ? '#f8fafc' : '#1e293b',
          kind: i % 2 === 0 ? 'white' : 'black',
        });
      }
      setAngleDeg(-90);
      setScoreText('Забито фишек Каррома: 0 / 19');
    } else if (m === 'bowling_3d_sim') {
      // Bowling ball on left (-0.75, strikerPos), 10 pins on right (+0.48..+0.78)
      arr.push({ id: 0, x: -0.76, y: 0, vx: 0, vy: 0, r: 0.056, color: '#6366f1', label: '🎳', kind: 'ball' });
      let pid = 1;
      for (let col = 0; col < 4; col++) {
        for (let row = 0; row <= col; row++) {
          arr.push({
            id: pid++,
            x: 0.46 + col * 0.088,
            y: (row - col / 2) * 0.095,
            vx: 0,
            vy: 0,
            r: 0.034,
            color: '#f8fafc',
            label: '',
            kind: 'pin',
          });
        }
      }
      setAngleDeg(0);
      setScoreText('Сбито кеглей: 0 / 10');
    }
    discsRef.current = arr;
  };

  useEffect(() => {
    initTable(mode);
  }, [mode]);

  const launchShot = () => {
    const arr = discsRef.current;
    const rad = (angleDeg * Math.PI) / 180;
    const spd = (power / 100) * 0.048 + 0.008;

    if (mode === 'billiards_3d_sim') {
      const cue = arr.find((d) => d.id === 0);
      if (!cue) return;
      if (cue.pocketed) {
        cue.pocketed = false;
        cue.x = -0.52;
        cue.y = 0;
      }
      cue.vx = Math.cos(rad) * spd;
      cue.vy = Math.sin(rad) * spd;
    } else if (mode === 'curling_sim') {
      const idx = curlingTurnRef.current++;
      const isRed = idx % 2 === 0;
      arr.push({
        id: 100 + idx,
        x: -0.82,
        y: strikerPos * 0.32,
        vx: Math.cos(rad) * (spd * 0.56),
        vy: Math.sin(rad) * (spd * 0.56),
        r: 0.046,
        color: isRed ? '#ef4444' : '#facc15',
        label: isRed ? 'R' : 'Y',
        kind: isRed ? 'red' : 'yellow',
      });
    } else if (mode === 'carrom_sim') {
      const striker = arr.find((d) => d.id === 0);
      if (!striker) return;
      striker.pocketed = false;
      striker.x = strikerPos * 0.55;
      striker.y = 0.66;
      striker.vx = Math.cos(rad) * spd;
      striker.vy = Math.sin(rad) * spd;
    } else if (mode === 'bowling_3d_sim') {
      const ball = arr.find((d) => d.id === 0);
      if (!ball) return;
      ball.pocketed = false;
      ball.x = -0.76;
      ball.y = strikerPos * 0.28;
      ball.vx = Math.cos(rad) * (spd * 0.85);
      ball.vy = Math.sin(rad) * (spd * 0.85);
    }
    onSync();
  };

  // Physics + 60 FPS Render Loop
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs || !visible) return;
    let raf = 0;

    const stepAndRender = () => {
      const { ctx, W, H } = syncHiDPICanvas(cvs);
      if (!ctx || W < 40) {
        raf = requestAnimationFrame(stepAndRender);
        return;
      }
      ctx.clearRect(0, 0, W, H);
      const arr = discsRef.current;

      // Normalized arena bounds:
      // Billiards/Curling/Bowling: X in [-0.92, 0.92], Y in [-0.46, 0.46]
      // Carrom: Square X in [-0.82, 0.82], Y in [-0.82, 0.82]
      const isSquare = mode === 'carrom_sim';
      const halfX = isSquare ? 0.82 : 0.92;
      const halfY = isSquare ? 0.82 : 0.46;

      const scale = Math.min((W - 36) / (halfX * 2), (H - 36) / (halfY * 2));
      const toScreen = (nx: number, ny: number) => ({
        sx: W / 2 + nx * scale,
        sy: H / 2 + ny * scale,
      });

      // Draw Arena Background
      const tl = toScreen(-halfX, -halfY);
      const br = toScreen(halfX, halfY);
      const bw = br.sx - tl.sx;
      const bh = br.sy - tl.sy;

      ctx.fillStyle = '#040712';
      ctx.fillRect(0, 0, W, H);

      if (mode === 'billiards_3d_sim') {
        ctx.fillStyle = '#451a03';
        ctx.fillRect(tl.sx - 10, tl.sy - 10, bw + 20, bh + 20);
        const felt = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, bw * 0.7);
        felt.addColorStop(0, '#059669');
        felt.addColorStop(1, '#064e3b');
        ctx.fillStyle = felt;
        ctx.fillRect(tl.sx, tl.sy, bw, bh);

        // 6 Pockets
        const pockets = [
          [-halfX, -halfY], [0, -halfY], [halfX, -halfY],
          [-halfX, halfY], [0, halfY], [halfX, halfY],
        ];
        for (const [px, py] of pockets) {
          const sp = toScreen(px, py);
          ctx.beginPath();
          ctx.arc(sp.sx, sp.sy, 0.056 * scale, 0, Math.PI * 2);
          ctx.fillStyle = '#020617';
          ctx.fill();
        }
      } else if (mode === 'curling_sim') {
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(tl.sx, tl.sy, bw, bh);
        // Curling House at (+0.56, 0)
        const house = toScreen(0.56, 0);
        const rings = [
          { r: 0.28, c: '#2563eb' },
          { r: 0.19, c: '#ffffff' },
          { r: 0.1, c: '#dc2626' },
          { r: 0.032, c: '#ffffff' },
        ];
        for (const rg of rings) {
          ctx.beginPath();
          ctx.arc(house.sx, house.sy, rg.r * scale, 0, Math.PI * 2);
          ctx.fillStyle = rg.c;
          ctx.fill();
        }
      } else if (mode === 'carrom_sim') {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(tl.sx - 10, tl.sy - 10, bw + 20, bh + 20);
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(tl.sx, tl.sy, bw, bh);
        // Center circle & baseline
        const cc = toScreen(0, 0);
        ctx.strokeStyle = 'rgba(180,83,9,0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cc.sx, cc.sy, 0.19 * scale, 0, Math.PI * 2);
        ctx.stroke();
        const bl1 = toScreen(-0.56, 0.66);
        const bl2 = toScreen(0.56, 0.66);
        ctx.beginPath();
        ctx.moveTo(bl1.sx, bl1.sy);
        ctx.lineTo(bl2.sx, bl2.sy);
        ctx.stroke();
        // 4 Corner Pockets
        for (const [px, py] of [
          [-halfX + 0.05, -halfY + 0.05],
          [halfX - 0.05, -halfY + 0.05],
          [-halfX + 0.05, halfY - 0.05],
          [halfX - 0.05, halfY - 0.05],
        ]) {
          const sp = toScreen(px, py);
          ctx.beginPath();
          ctx.arc(sp.sx, sp.sy, 0.062 * scale, 0, Math.PI * 2);
          ctx.fillStyle = '#0f172a';
          ctx.fill();
        }
      } else if (mode === 'bowling_3d_sim') {
        // Wood lane + top/bottom dark gutters
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(tl.sx, tl.sy, bw, bh);
        const lTop = toScreen(-halfX, -0.32);
        const lBot = toScreen(halfX, 0.32);
        ctx.fillStyle = '#d97706';
        ctx.fillRect(lTop.sx, lTop.sy, lBot.sx - lTop.sx, lBot.sy - lTop.sy);
      }

      // Physics Integration
      const friction =
        mode === 'curling_sim'
          ? sweepingRef.current
            ? 0.9945
            : 0.9875
          : mode === 'bowling_3d_sim'
          ? 0.993
          : 0.985;

      for (const d of arr) {
        if (d.pocketed) continue;
        // Apply curl / hook lateral curve when moving
        const speed = Math.hypot(d.vx, d.vy);
        if (speed > 0.00045) {
          if (mode === 'curling_sim') {
            d.vy += (spin / 100) * 0.00018 * (sweepingRef.current ? 0.45 : 1);
          } else if (mode === 'bowling_3d_sim' && d.kind === 'ball' && d.x > -0.1) {
            d.vy += (spin / 100) * 0.00038;
          }
          d.x += d.vx;
          d.y += d.vy;
          d.vx *= friction;
          d.vy *= friction;
        } else {
          d.vx = 0;
          d.vy = 0;
        }

        // Wall / Pocket / Gutter Checks
        if (mode === 'billiards_3d_sim') {
          const pockets = [
            [-halfX, -halfY], [0, -halfY], [halfX, -halfY],
            [-halfX, halfY], [0, halfY], [halfX, halfY],
          ];
          for (const [px, py] of pockets) {
            if (Math.hypot(d.x - px, d.y - py) < 0.062) {
              d.pocketed = true;
              d.vx = 0;
              d.vy = 0;
            }
          }
          if (!d.pocketed) {
            if (d.x - d.r < -halfX) { d.x = -halfX + d.r; d.vx = Math.abs(d.vx) * 0.85; }
            if (d.x + d.r > halfX) { d.x = halfX - d.r; d.vx = -Math.abs(d.vx) * 0.85; }
            if (d.y - d.r < -halfY) { d.y = -halfY + d.r; d.vy = Math.abs(d.vy) * 0.85; }
            if (d.y + d.r > halfY) { d.y = halfY - d.r; d.vy = -Math.abs(d.vy) * 0.85; }
          }
        } else if (mode === 'carrom_sim') {
          for (const [px, py] of [
            [-halfX + 0.05, -halfY + 0.05],
            [halfX - 0.05, -halfY + 0.05],
            [-halfX + 0.05, halfY - 0.05],
            [halfX - 0.05, halfY - 0.05],
          ]) {
            if (Math.hypot(d.x - px, d.y - py) < 0.065) {
              if (d.kind !== 'striker') d.pocketed = true;
              d.vx = 0;
              d.vy = 0;
            }
          }
          if (!d.pocketed) {
            if (d.x - d.r < -halfX) { d.x = -halfX + d.r; d.vx = Math.abs(d.vx) * 0.86; }
            if (d.x + d.r > halfX) { d.x = halfX - d.r; d.vx = -Math.abs(d.vx) * 0.86; }
            if (d.y - d.r < -halfY) { d.y = -halfY + d.r; d.vy = Math.abs(d.vy) * 0.86; }
            if (d.y + d.r > halfY) { d.y = halfY - d.r; d.vy = -Math.abs(d.vy) * 0.86; }
          }
        } else if (mode === 'curling_sim') {
          if (Math.abs(d.x) > halfX + 0.06 || Math.abs(d.y) > halfY + 0.04) {
            d.pocketed = true;
          }
        } else if (mode === 'bowling_3d_sim') {
          if (d.kind === 'ball' && Math.abs(d.y) > 0.33) {
            // Gutter! Ball stays in gutter channel
            d.vy = 0;
            d.y = d.y > 0 ? 0.38 : -0.38;
          }
          if (d.kind === 'pin' && (Math.hypot(d.vx, d.vy) > 0.005 || d.x > halfX || Math.abs(d.y) > 0.34)) {
            if (d.x > halfX || Math.abs(d.y) > 0.34) d.pocketed = true;
          }
          if (d.kind === 'ball' && d.x > halfX + 0.08) {
            d.vx = 0;
            d.vy = 0;
          }
        }
      }

      // Elastic Disc-Disc Collisions
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const a = arr[i];
          const b = arr[j];
          if (a.pocketed || b.pocketed) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          const minDist = a.r + b.r;
          if (dist > 0 && dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;
            a.x -= nx * overlap * 0.5;
            a.y -= ny * overlap * 0.5;
            b.x += nx * overlap * 0.5;
            b.y += ny * overlap * 0.5;

            const dvx = a.vx - b.vx;
            const dvy = a.vy - b.vy;
            const vn = dvx * nx + dvy * ny;
            if (vn > 0) {
              const mA = a.kind === 'ball' ? 3.2 : 1;
              const mB = b.kind === 'ball' ? 3.2 : 1;
              const imp = (1.92 * vn) / (mA + mB);
              a.vx -= imp * mB * nx;
              a.vy -= imp * mB * ny;
              b.vx += imp * mA * nx;
              b.vy += imp * mA * ny;
            }
          }
        }
      }

      // Update live scoreboard
      if (mode === 'billiards_3d_sim') {
        const sunk = arr.filter((d) => d.id > 0 && d.pocketed).length;
        setScoreText(`Забито шаров в лузы: ${sunk} / 15`);
      } else if (mode === 'carrom_sim') {
        const sunk = arr.filter((d) => d.id > 0 && d.pocketed).length;
        setScoreText(`Забито фишек Каррома: ${sunk} / 19`);
      } else if (mode === 'bowling_3d_sim') {
        const knocked = arr.filter((d) => d.kind === 'pin' && (d.pocketed || Math.hypot(d.x - (0.46 + 0.13), d.y) > 0.36)).length;
        setScoreText(knocked === 10 ? '🎳 СТРАЙК! 10 / 10 кеглей!' : `Сбито кеглей: ${knocked} / 10`);
      } else if (mode === 'curling_sim' && arr.length > 0) {
        const inHouse = arr
          .filter((d) => !d.pocketed)
          .map((d) => ({ kind: d.kind, dist: Math.hypot(d.x - 0.56, d.y) }))
          .filter((d) => d.dist <= 0.29)
          .sort((a, b) => a.dist - b.dist);
        if (inHouse.length > 0) {
          const leader = inHouse[0].kind;
          let pts = 0;
          for (const st of inHouse) {
            if (st.kind === leader) pts++;
            else break;
          }
          setScoreText(`Лидируют ${leader === 'red' ? 'Красные' : 'Жёлтые'}: +${pts} очк. в доме`);
        }
      }

      // Aiming Dotted Laser Line
      const rad = (angleDeg * Math.PI) / 180;
      let aimOrigin: { x: number; y: number } | null = null;
      if (mode === 'billiards_3d_sim') {
        const cue = arr.find((d) => d.id === 0 && !d.pocketed);
        if (cue && Math.hypot(cue.vx, cue.vy) < 0.001) aimOrigin = { x: cue.x, y: cue.y };
      } else if (mode === 'curling_sim') {
        aimOrigin = { x: -0.82, y: strikerPos * 0.32 };
      } else if (mode === 'carrom_sim') {
        aimOrigin = { x: strikerPos * 0.55, y: 0.66 };
      } else if (mode === 'bowling_3d_sim') {
        aimOrigin = { x: -0.76, y: strikerPos * 0.28 };
      }
      if (aimOrigin) {
        const a0 = toScreen(aimOrigin.x, aimOrigin.y);
        const a1 = toScreen(aimOrigin.x + Math.cos(rad) * 0.58, aimOrigin.y + Math.sin(rad) * 0.58);
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'rgba(250,204,21,0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a0.sx, a0.sy);
        ctx.lineTo(a1.sx, a1.sy);
        ctx.stroke();
        ctx.restore();
      }

      // Draw Discs / Balls / Stones / Pins with 3D specular shading
      for (const d of arr) {
        if (d.pocketed) continue;
        const sp = toScreen(d.x, d.y);
        const sr = Math.max(4, d.r * scale);
        const grad = ctx.createRadialGradient(sp.sx - sr * 0.3, sp.sy - sr * 0.3, sr * 0.1, sp.sx, sp.sy, sr);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.28, d.color);
        grad.addColorStop(1, '#020617');
        ctx.beginPath();
        ctx.arc(sp.sx, sp.sy, sr, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        if (d.label) {
          ctx.font = `700 ${Math.max(8, Math.round(sr * 0.72))}px "Inter", sans-serif`;
          ctx.fillStyle = '#0f172a';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(d.label, sp.sx, sp.sy);
          ctx.textAlign = 'start';
        }
      }

      raf = requestAnimationFrame(stepAndRender);
    };

    raf = requestAnimationFrame(stepAndRender);
    return () => cancelAnimationFrame(raf);
  }, [visible, mode, angleDeg, spin, strikerPos]);

  return (
    <div ref={wrapRef} className="space-y-4 min-w-0">
      <div className="flex flex-wrap gap-1.5">
        {[
          { id: 'billiards_3d_sim', label: '🎱 Бильярд 8-Ball' },
          { id: 'curling_sim', label: '🥌 Кёрлинг на Льду' },
          { id: 'carrom_sim', label: '🎯 Карром (Carrom)' },
          { id: 'bowling_3d_sim', label: '🎳 Боулинг (10 кеглей)' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelectTool(t.id)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
              mode === t.id
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100'
                : 'bg-slate-900 border-white/10 text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-slate-900/80 border border-emerald-500/25 p-4 space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Mini3DSceneBadge seed={mode} color="#10b981" size={36} />
            <div className="font-bold text-sm text-white">{scoreText}</div>
          </div>
          <button
            type="button"
            onClick={() => initTable(mode)}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Расставить заново
          </button>
        </div>

        <canvas
          ref={canvasRef}
          style={{ height: mode === 'carrom_sim' ? 370 : 290 }}
          className="w-full rounded-2xl bg-slate-950 border border-white/15 block"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <div className="flex justify-between mb-1">
              <span>Угол прицела</span>
              <span className="font-mono text-amber-300">{angleDeg}°</span>
            </div>
            <input
              type="range"
              min={mode === 'carrom_sim' ? -165 : -65}
              max={mode === 'carrom_sim' ? -15 : 65}
              value={angleDeg}
              onChange={(e) => setAngleDeg(Number(e.target.value))}
              className="w-full accent-amber-400"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span>Сила удара / броска</span>
              <span className="font-mono text-emerald-300">{power}%</span>
            </div>
            <input
              type="range"
              min={15}
              max={100}
              value={power}
              onChange={(e) => setPower(Number(e.target.value))}
              className="w-full accent-emerald-400"
            />
          </div>

          {mode !== 'billiards_3d_sim' && (
            <div>
              <div className="flex justify-between mb-1">
                <span>Позиция / Подкрутка</span>
                <span className="font-mono text-sky-300">{Math.round(strikerPos * 100)} / {spin}</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="range"
                  min={-100}
                  max={100}
                  value={Math.round(strikerPos * 100)}
                  onChange={(e) => setStrikerPos(Number(e.target.value) / 100)}
                  className="w-1/2 accent-sky-400"
                />
                <input
                  type="range"
                  min={-60}
                  max={60}
                  value={spin}
                  onChange={(e) => setSpin(Number(e.target.value))}
                  className="w-1/2 accent-purple-400"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={launchShot}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-black flex items-center justify-center gap-1.5 shadow-lg"
            >
              <Play className="w-4 h-4" /> Бросок / Удар
            </button>
            {mode === 'curling_sim' && (
              <button
                type="button"
                onMouseDown={() => setSweeping(true)}
                onMouseUp={() => setSweeping(false)}
                onTouchStart={() => setSweeping(true)}
                onTouchEnd={() => setSweeping(false)}
                className={`px-3 py-2.5 rounded-xl font-bold border ${
                  sweeping
                    ? 'bg-sky-400 text-slate-950 border-sky-200'
                    : 'bg-sky-500/20 text-sky-200 border-sky-400/40'
                }`}
              >
                🧹 Свиповать!
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
