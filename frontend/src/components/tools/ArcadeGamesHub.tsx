import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Trophy } from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api';
import { createIcosahedron, cross3, hexToRgb, project3D, rotateEuler, scale3, shadeBlinnPhong, sub3 } from '../../lib/engine3d';
import { ChessAcademyHub } from './ChessAcademyHub';
import { GuessSizeGame, SpyLobbyHub } from './SpyAndGuessHub';

interface Props {
  activeTool: string;
  onSelectTool: (t: string) => void;
  onSync: () => void;
  onToast: (msg: string) => void;
}

const GAME_NAMES: Record<string, string> = {
  chess_academy: '♟️ Шахматы',
  spy_lobby: '🕵️ Шпион',
  guess_size: '📐 Guess Size',
  arcade_wolf: '🐺 Ну, погоди!',
  wolf: '🐺 Ну, погоди!',
  arcade_doodle: '🚀 Doodle Jump',
  doodle: '🚀 Doodle Jump',
  arcade_tetris: '🧱 Тетрис',
  tetris: '🧱 Тетрис',
  arcade_clicker: '⚡ Кликер',
  clicker: '⚡ Кликер',
};

// ============================================================================
// 1. WOLF CATCHING EGGS («НУ, ПОГОДИ!»)
// ============================================================================
const WolfEggsGame: React.FC<{ onSaveScore: (s: number) => void }> = ({ onSaveScore }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [basketPos, setBasketPos] = useState<0 | 1 | 2 | 3>(0); // 0:TL, 1:BL, 2:TR, 3:BR
  const basketRef = useRef<0 | 1 | 2 | 3>(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const startGame = () => {
    setScore(0);
    setLives(3);
    setGameOver(false);
    setRunning(true);
  };

  const setPos = (p: 0 | 1 | 2 | 3) => {
    basketRef.current = p;
    setBasketPos(p);
    if (!running && !gameOver) {
      startGame();
    }
  };

  // Draw initial idle preview frame when not running
  useEffect(() => {
    if (running) return;
    const cvs = canvasRef.current;
    const ctx = cvs?.getContext('2d');
    if (!cvs || !ctx) return;

    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    ctx.strokeStyle = 'rgba(56,189,248,0.28)';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, cvs.width - 16, cvs.height - 16);

    const chutes = [
      { x1: 30, y1: 68, x2: 145, y2: 122 },
      { x1: 30, y1: 158, x2: 145, y2: 212 },
      { x1: 390, y1: 68, x2: 275, y2: 122 },
      { x1: 390, y1: 158, x2: 275, y2: 212 },
    ];
    chutes.forEach((c) => {
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(c.x1, c.y1);
      ctx.lineTo(c.x2, c.y2);
      ctx.stroke();
    });

    ctx.font = '28px sans-serif';
    ctx.fillText('🐺', 196, 152);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      gameOver ? `Игра окончена • Счёт: ${score}` : 'Нажмите на экран или кнопку для старта',
      cvs.width / 2,
      238
    );
    ctx.textAlign = 'start';
  }, [running, gameOver, score]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'q' || k === 'й') setPos(0);
      else if (k === 'a' || k === 'ф') setPos(1);
      else if (k === 'e' || k === 'у') setPos(2);
      else if (k === 'd' || k === 'в') setPos(3);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, gameOver]);

  useEffect(() => {
    if (!running) return;
    let animId = 0;
    let curScore = 0;
    let curLives = 3;
    let spawnTimer = 0;
    const eggs: { lane: 0 | 1 | 2 | 3; progress: number }[] = [];
    let lastTs = performance.now();

    const chutes = [
      { x1: 30, y1: 68, x2: 145, y2: 122 },
      { x1: 30, y1: 158, x2: 145, y2: 212 },
      { x1: 390, y1: 68, x2: 275, y2: 122 },
      { x1: 390, y1: 158, x2: 275, y2: 212 },
    ];

    const loop = (ts: number) => {
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;

      const speed = 0.42 + Math.min(0.65, curScore * 0.012);
      const spawnInterval = Math.max(0.45, 1.35 - curScore * 0.018);
      spawnTimer += dt;
      if (spawnTimer >= spawnInterval) {
        spawnTimer = 0;
        const lane = Math.floor(Math.random() * 4) as 0 | 1 | 2 | 3;
        eggs.push({ lane, progress: 0 });
      }

      for (let i = eggs.length - 1; i >= 0; i--) {
        eggs[i].progress += speed * dt;
        if (eggs[i].progress >= 1.0) {
          if (eggs[i].lane === basketRef.current) {
            curScore += 10;
            setScore(curScore);
          } else {
            curLives -= 1;
            setLives(curLives);
            if (curLives <= 0) {
              setRunning(false);
              setGameOver(true);
              if (curScore > 0) onSaveScore(curScore);
              return;
            }
          }
          eggs.splice(i, 1);
        }
      }

      const cvs = canvasRef.current;
      const ctx = cvs?.getContext('2d');
      if (cvs && ctx) {
        ctx.fillStyle = '#0b1220';
        ctx.fillRect(0, 0, cvs.width, cvs.height);

        ctx.strokeStyle = 'rgba(56,189,248,0.25)';
        ctx.lineWidth = 2;
        ctx.strokeRect(8, 8, cvs.width - 16, cvs.height - 16);

        chutes.forEach((c) => {
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(c.x1, c.y1);
          ctx.lineTo(c.x2, c.y2);
          ctx.stroke();
        });

        const bPos = basketRef.current;
        const wolfX = 210;
        const wolfY = 175;
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(wolfX, wolfY - 35, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(wolfX - 16, wolfY - 16, 32, 54);
        ctx.font = '20px sans-serif';
        ctx.fillText('🐺', wolfX - 12, wolfY - 28);

        const target = chutes[bPos];
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(target.x2, target.y2 + 6, 16, 0, Math.PI, false);
        ctx.fill();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.stroke();

        eggs.forEach((eg) => {
          const c = chutes[eg.lane];
          const ex = c.x1 + (c.x2 - c.x1) * eg.progress;
          const ey = c.y1 + (c.y2 - c.y1) * eg.progress - 8;
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.ellipse(ex, ey, 7, 9, eg.progress * 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(`СЧЁТ: ${curScore}`, 22, 32);
        ctx.fillStyle = '#fb7185';
        ctx.fillText(`ЖИЗНИ: ${'❤️'.repeat(Math.max(0, curLives))}`, 285, 32);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [running]);

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-slate-300">
          Клавиши <kbd className="px-1.5 py-0.5 rounded bg-white/10">Q</kbd>{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-white/10">A</kbd>{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-white/10">E</kbd>{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-white/10">D</kbd> или кнопки корзин:
        </div>
        <button
          type="button"
          onClick={startGame}
          className="px-4 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shrink-0"
        >
          <Play className="w-3.5 h-3.5" /> {running ? 'Перезапуск' : 'Старт игры'}
        </button>
      </div>

      <div className="flex flex-col items-center gap-3">
        <canvas
          ref={canvasRef}
          width={420}
          height={260}
          onClick={() => {
            if (!running) startGame();
          }}
          className="w-full max-w-[440px] h-auto rounded-2xl border border-sky-400/30 bg-[#0b1220] shadow-xl cursor-pointer select-none touch-none"
        />
        {gameOver && (
          <div className="text-xs text-amber-300 font-semibold text-center">
            Игра окончена! Ваш счёт: <b>{score}</b> (сохранён в таблицу рекордов 🏆)
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 w-full max-w-[440px] select-none">
          <button
            type="button"
            onPointerDown={() => setPos(0)}
            className={`py-3 rounded-xl font-bold text-xs border touch-manipulation ${
              basketPos === 0 ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-slate-950 text-white border-white/15'
            }`}
          >
            ↖ Верх-Лево (Q)
          </button>
          <button
            type="button"
            onPointerDown={() => setPos(2)}
            className={`py-3 rounded-xl font-bold text-xs border touch-manipulation ${
              basketPos === 2 ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-slate-950 text-white border-white/15'
            }`}
          >
            ↗ Верх-Право (E)
          </button>
          <button
            type="button"
            onPointerDown={() => setPos(1)}
            className={`py-3 rounded-xl font-bold text-xs border touch-manipulation ${
              basketPos === 1 ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-slate-950 text-white border-white/15'
            }`}
          >
            ↙ Низ-Лево (A)
          </button>
          <button
            type="button"
            onPointerDown={() => setPos(3)}
            className={`py-3 rounded-xl font-bold text-xs border touch-manipulation ${
              basketPos === 3 ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-slate-950 text-white border-white/15'
            }`}
          >
            ↘ Низ-Право (D)
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. DOODLE CYBER JUMP
// ============================================================================
const DoodleJumpGame: React.FC<{ onSaveScore: (s: number) => void }> = ({ onSaveScore }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const moveDir = useRef<number>(0);
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const startJump = () => {
    setScore(0);
    setGameOver(false);
    setRunning(true);
  };

  // Draw initial idle preview frame
  useEffect(() => {
    if (running) return;
    const cvs = canvasRef.current;
    const ctx = cvs?.getContext('2d');
    if (!cvs || !ctx) return;

    ctx.fillStyle = '#090e1a';
    ctx.fillRect(0, 0, 340, 400);
    [
      { x: 135, y: 350, c: '#22c55e' },
      { x: 55, y: 270, c: '#38bdf8' },
      { x: 205, y: 190, c: '#f43f5e' },
      { x: 95, y: 115, c: '#22c55e' },
    ].forEach((p) => {
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, 65, 10, 5);
      ctx.fill();
    });
    ctx.fillStyle = '#a855f7';
    ctx.beginPath();
    ctx.arc(168, 325, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      gameOver ? `Финиш • Высота: ${score} м` : 'Нажмите на поле или кнопку «Прыгать»',
      170,
      55
    );
    ctx.textAlign = 'start';
  }, [running, gameOver, score]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') moveDir.current = -1;
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') moveDir.current = 1;
    };
    const up = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(e.key)) moveDir.current = 0;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    let anim = 0;
    const W = 340;
    const H = 400;
    let px = W / 2;
    let py = H - 70;
    let vy = -9.5;
    let bestHeight = 0;

    const platforms: { x: number; y: number; w: number; vx: number; boost?: boolean }[] = [
      { x: W / 2 - 35, y: H - 25, w: 70, vx: 0 },
    ];
    for (let i = 1; i < 8; i++) {
      platforms.push({
        x: Math.random() * (W - 65),
        y: H - 25 - i * 52,
        w: 62,
        vx: i % 3 === 0 ? (Math.random() > 0.5 ? 1.5 : -1.5) : 0,
        boost: i % 5 === 0,
      });
    }

    const stars3D = Array.from({ length: 34 }, (_, i) => ({
      x: (i * 53) % W,
      y: (i * 89) % H,
      z: (i % 3) + 1,
    }));

    const tick = () => {
      px += moveDir.current * 4.8;
      if (px < 0) px = W;
      if (px > W) px = 0;

      vy += 0.32;
      py += vy;

      platforms.forEach((p) => {
        p.x += p.vx;
        if (p.x < 0 || p.x + p.w > W) p.vx *= -1;
        if (vy > 0 && px + 12 > p.x && px - 12 < p.x + p.w && py + 14 >= p.y && py + 14 <= p.y + 14) {
          vy = p.boost ? -13.5 : -9.6;
        }
      });

      if (py < H * 0.45) {
        const shift = H * 0.45 - py;
        py = H * 0.45;
        bestHeight += Math.round(shift);
        setScore(bestHeight);
        stars3D.forEach((s) => {
          s.y = (s.y + shift * (0.18 * s.z)) % H;
        });
        platforms.forEach((p) => {
          p.y += shift;
          if (p.y > H) {
            p.y = 0;
            p.x = Math.random() * (W - 65);
            p.boost = Math.random() < 0.18;
            p.vx = Math.random() < 0.35 ? (Math.random() > 0.5 ? 1.8 : -1.8) : 0;
          }
        });
      }

      if (py > H + 20) {
        moveDir.current = 0;
        setRunning(false);
        setGameOver(true);
        if (bestHeight > 0) onSaveScore(bestHeight);
        return;
      }

      const cvs = canvasRef.current;
      const ctx = cvs?.getContext('2d');
      if (cvs && ctx) {
        ctx.fillStyle = '#090e1a';
        ctx.fillRect(0, 0, W, H);

        // 3D Multi-depth Parallax Starfield
        stars3D.forEach((s) => {
          ctx.fillStyle = `rgba(186,230,253,${0.15 * s.z})`;
          ctx.fillRect(s.x, s.y, s.z, s.z);
        });

        // 3D Extruded Platforms
        platforms.forEach((p) => {
          const topCol = p.boost ? '#f43f5e' : p.vx !== 0 ? '#38bdf8' : '#22c55e';
          const sideCol = p.boost ? '#9f1239' : p.vx !== 0 ? '#0369a1' : '#15803d';
          ctx.fillStyle = sideCol;
          ctx.beginPath();
          ctx.roundRect(p.x + 2, p.y + 4, p.w, 10, 4);
          ctx.fill();

          ctx.fillStyle = topCol;
          ctx.beginPath();
          ctx.roundRect(p.x, p.y, p.w, 9, 4);
          ctx.fill();
        });

        // 3D Shaded Sphere Jumper
        const sphereGrad = ctx.createRadialGradient(px - 4, py - 5, 2, px, py, 14);
        sphereGrad.addColorStop(0, '#f3e8ff');
        sphereGrad.addColorStop(0.4, '#a855f7');
        sphereGrad.addColorStop(1, '#4c1d95');
        ctx.fillStyle = sphereGrad;
        ctx.beginPath();
        ctx.arc(px, py, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(px - 6, py - 4, 4, 4);
        ctx.fillRect(px + 2, py - 4, 4, 4);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 13px monospace';
        ctx.fillText(`ВЫСОТА: ${bestHeight} м`, 12, 24);
      }

      anim = requestAnimationFrame(tick);
    };

    anim = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(anim);
  }, [running]);

  const holdDir = (dir: number) => {
    if (!running && !gameOver) startJump();
    moveDir.current = dir;
  };

  return (
    <div className="flex flex-col items-center space-y-3 min-w-0">
      <div className="flex items-center justify-between w-full max-w-[340px] gap-2">
        <span className="text-xs text-slate-300">Стрелки ⬅️ ➡️ или кнопки</span>
        <button
          type="button"
          onClick={startJump}
          className="px-4 py-1.5 rounded-xl bg-purple-500 text-white font-bold text-xs shrink-0"
        >
          🚀 {running ? 'Заново' : 'Прыгать'}
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={340}
        height={400}
        onClick={() => {
          if (!running) startJump();
        }}
        className="w-full max-w-[340px] h-auto rounded-2xl border border-purple-400/35 bg-[#090e1a] cursor-pointer select-none touch-none"
      />
      {gameOver && <div className="text-xs text-amber-300 font-semibold">Финиш! Высота: <b>{score} м</b> 🏆</div>}
      <div className="grid grid-cols-2 gap-3 w-full max-w-[340px] select-none">
        <button
          type="button"
          onPointerDown={() => holdDir(-1)}
          onPointerUp={() => (moveDir.current = 0)}
          onPointerLeave={() => (moveDir.current = 0)}
          onPointerCancel={() => (moveDir.current = 0)}
          className="py-3 rounded-xl bg-slate-950 border border-white/15 text-white font-bold text-sm active:bg-purple-500/40 touch-manipulation select-none"
        >
          ⬅️ Влево
        </button>
        <button
          type="button"
          onPointerDown={() => holdDir(1)}
          onPointerUp={() => (moveDir.current = 0)}
          onPointerLeave={() => (moveDir.current = 0)}
          onPointerCancel={() => (moveDir.current = 0)}
          className="py-3 rounded-xl bg-slate-950 border border-white/15 text-white font-bold text-sm active:bg-purple-500/40 touch-manipulation select-none"
        >
          Вправо ➡️
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// 3. NEON TETRIS (10x20)
// ============================================================================
const SHAPES = [
  { m: [[1, 1, 1, 1]], c: '#38bdf8' },
  { m: [[1, 1], [1, 1]], c: '#facc15' },
  { m: [[0, 1, 0], [1, 1, 1]], c: '#a855f7' },
  { m: [[1, 0, 0], [1, 1, 1]], c: '#fb923c' },
  { m: [[0, 0, 1], [1, 1, 1]], c: '#60a5fa' },
  { m: [[0, 1, 1], [1, 1, 0]], c: '#4ade80' },
  { m: [[1, 1, 0], [0, 1, 1]], c: '#f43f5e' },
];

const drawVoxelBlock = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  hex: string,
  is3D: boolean
) => {
  if (!is3D) {
    ctx.fillStyle = hex;
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
    return;
  }
  const [r, g, b] = hexToRgb(hex);
  const d = 4;
  // Front face
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(x + 1, y + 1, size - 3, size - 3);
  // Top face (lit)
  ctx.fillStyle = `rgb(${Math.min(255, r + 55)},${Math.min(255, g + 55)},${Math.min(255, b + 55)})`;
  ctx.beginPath();
  ctx.moveTo(x + 1, y + 1);
  ctx.lineTo(x + 1 + d, y + 1 - d);
  ctx.lineTo(x + size - 2 + d, y + 1 - d);
  ctx.lineTo(x + size - 2, y + 1);
  ctx.closePath();
  ctx.fill();
  // Right side face (shaded)
  ctx.fillStyle = `rgb(${Math.max(0, r - 55)},${Math.max(0, g - 55)},${Math.max(0, b - 55)})`;
  ctx.beginPath();
  ctx.moveTo(x + size - 2, y + 1);
  ctx.lineTo(x + size - 2 + d, y + 1 - d);
  ctx.lineTo(x + size - 2 + d, y + size - 2 - d);
  ctx.lineTo(x + size - 2, y + size - 2);
  ctx.closePath();
  ctx.fill();
};

const NeonTetrisGame: React.FC<{ onSaveScore: (s: number) => void }> = ({ onSaveScore }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [mode3D, setMode3D] = useState(true);
  const mode3DRef = useRef(true);
  mode3DRef.current = mode3D;
  const ctrlRef = useRef<{ move: (dx: number) => void; rotate: () => void; drop: () => void }>({
    move: () => {},
    rotate: () => {},
    drop: () => {},
  });

  const startTetris = () => {
    setScore(0);
    setGameOver(false);
    setRunning(true);
  };

  // Draw initial 3D grid preview
  useEffect(() => {
    if (running) return;
    const cvs = canvasRef.current;
    const ctx = cvs?.getContext('2d');
    if (!cvs || !ctx) return;
    ctx.fillStyle = '#090d18';
    ctx.fillRect(0, 0, 210, 408);
    const ox = 4;
    const oy = 8;
    for (let r = 0; r < 20; r++) {
      for (let c = 0; c < 10; c++) {
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.strokeRect(ox + c * 20, oy + r * 20, 20, 20);
      }
    }
    // Sample decorative 3D blocks on idle screen
    [
      [3, 18, '#38bdf8'],
      [4, 18, '#38bdf8'],
      [5, 18, '#a855f7'],
      [4, 17, '#a855f7'],
    ].forEach(([c, r, col]) =>
      drawVoxelBlock(ctx, ox + Number(c) * 20, oy + Number(r) * 20, 20, String(col), mode3D)
    );
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(gameOver ? `Счёт: ${score}` : 'Нажмите для старта', 105, 195);
    ctx.textAlign = 'start';
  }, [running, gameOver, score, mode3D]);

  useEffect(() => {
    if (!running) return;
    const COLS = 10;
    const ROWS = 20;
    const CELL = 20;
    const OX = 4;
    const OY = 8;
    const board: (string | null)[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    let curScore = 0;

    const spawn = () => {
      const s = SHAPES[Math.floor(Math.random() * SHAPES.length)];
      return { m: s.m.map((r) => [...r]), c: s.c, x: 3, y: 0 };
    };
    let piece = spawn();

    const collides = (m: number[][], px: number, py: number) => {
      for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m[r].length; c++) {
          if (!m[r][c]) continue;
          const nx = px + c;
          const ny = py + r;
          if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
          if (ny >= 0 && board[ny][nx]) return true;
        }
      }
      return false;
    };

    const draw = () => {
      const cvs = canvasRef.current;
      const ctx = cvs?.getContext('2d');
      if (!cvs || !ctx) return;
      ctx.fillStyle = '#090d18';
      ctx.fillRect(0, 0, cvs.width, cvs.height);

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          ctx.strokeStyle = 'rgba(255,255,255,0.04)';
          ctx.strokeRect(OX + c * CELL, OY + r * CELL, CELL, CELL);
          if (board[r][c]) {
            drawVoxelBlock(ctx, OX + c * CELL, OY + r * CELL, CELL, board[r][c]!, mode3DRef.current);
          }
        }
      }

      // Ghost drop preview
      let ghostY = piece.y;
      while (!collides(piece.m, piece.x, ghostY + 1)) ghostY++;
      if (ghostY > piece.y) {
        piece.m.forEach((row, r) =>
          row.forEach((v, c) => {
            if (v) {
              ctx.strokeStyle = 'rgba(255,255,255,0.22)';
              ctx.strokeRect(OX + (piece.x + c) * CELL + 2, OY + (ghostY + r) * CELL + 2, CELL - 4, CELL - 4);
            }
          })
        );
      }

      piece.m.forEach((row, r) =>
        row.forEach((v, c) => {
          if (v) {
            drawVoxelBlock(ctx, OX + (piece.x + c) * CELL, OY + (piece.y + r) * CELL, CELL, piece.c, mode3DRef.current);
          }
        })
      );
    };

    const lockPiece = () => {
      piece.m.forEach((row, r) =>
        row.forEach((v, c) => {
          if (v && piece.y + r >= 0) board[piece.y + r][piece.x + c] = piece.c;
        })
      );
      let cleared = 0;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r].every((cell) => cell !== null)) {
          board.splice(r, 1);
          board.unshift(Array(COLS).fill(null));
          cleared++;
          r++;
        }
      }
      if (cleared > 0) {
        curScore += [0, 100, 300, 700, 1500][cleared] || 200;
        setScore(curScore);
      } else {
        curScore += 10;
        setScore(curScore);
      }
      piece = spawn();
      if (collides(piece.m, piece.x, piece.y)) {
        setRunning(false);
        setGameOver(true);
        if (curScore > 0) onSaveScore(curScore);
      }
    };

    const stepDown = () => {
      if (!collides(piece.m, piece.x, piece.y + 1)) {
        piece.y++;
      } else {
        lockPiece();
      }
      draw();
    };

    ctrlRef.current = {
      move: (dx) => {
        if (!collides(piece.m, piece.x + dx, piece.y)) {
          piece.x += dx;
          draw();
        }
      },
      rotate: () => {
        const rotated = piece.m[0].map((_, idx) => piece.m.map((row) => row[idx]).reverse());
        if (!collides(rotated, piece.x, piece.y)) {
          piece.m = rotated;
          draw();
        }
      },
      drop: () => {
        while (!collides(piece.m, piece.x, piece.y + 1)) piece.y++;
        lockPiece();
        draw();
      },
    };

    const onKey = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === 'ArrowLeft') ctrlRef.current.move(-1);
      else if (e.key === 'ArrowRight') ctrlRef.current.move(1);
      else if (e.key === 'ArrowUp') ctrlRef.current.rotate();
      else if (e.key === 'ArrowDown') stepDown();
      else if (e.key === ' ') ctrlRef.current.drop();
    };
    window.addEventListener('keydown', onKey);
    draw();
    const timer = setInterval(stepDown, 430);
    return () => {
      clearInterval(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [running]);

  return (
    <div className="flex flex-col items-center space-y-3 min-w-0">
      <div className="flex items-center justify-between w-full max-w-[280px] gap-1.5">
        <span className="text-xs font-mono text-sky-300 font-bold">СЧЁТ: {score}</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMode3D((m) => !m)}
            className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${
              mode3D ? 'bg-indigo-500/30 border-indigo-400 text-indigo-200' : 'bg-white/5 border-white/10 text-slate-400'
            }`}
          >
            {mode3D ? '🧊 3D' : '2D'}
          </button>
          <button
            type="button"
            onClick={startTetris}
            className="px-3 py-1.5 rounded-xl bg-sky-500 text-slate-950 font-bold text-xs shrink-0"
          >
            🧱 {running ? 'Рестарт' : 'Старт'}
          </button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={210}
        height={408}
        onClick={() => {
          if (!running) startTetris();
        }}
        className="w-full max-w-[215px] h-auto rounded-xl border border-sky-400/35 bg-[#090d18] cursor-pointer select-none touch-none"
      />
      {gameOver && <div className="text-xs text-amber-300 font-semibold">Стакан полон! Счёт: <b>{score}</b> 🏆</div>}
      <div className="grid grid-cols-4 gap-2 w-full max-w-[280px] select-none">
        <button
          type="button"
          onPointerDown={() => (running ? ctrlRef.current.move(-1) : startTetris())}
          className="py-3 rounded-xl bg-slate-950 border border-white/15 text-white text-xs font-bold touch-manipulation"
        >
          ⬅️
        </button>
        <button
          type="button"
          onPointerDown={() => (running ? ctrlRef.current.rotate() : startTetris())}
          className="py-3 rounded-xl bg-purple-500/30 border border-purple-400/40 text-white text-xs font-bold touch-manipulation"
        >
          🔄
        </button>
        <button
          type="button"
          onPointerDown={() => (running ? ctrlRef.current.drop() : startTetris())}
          className="py-3 rounded-xl bg-amber-500/30 border border-amber-400/40 text-white text-xs font-bold touch-manipulation"
        >
          ⏬
        </button>
        <button
          type="button"
          onPointerDown={() => (running ? ctrlRef.current.move(1) : startTetris())}
          className="py-3 rounded-xl bg-slate-950 border border-white/15 text-white text-xs font-bold touch-manipulation"
        >
          ➡️
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// 4. 3D QUANTUM CRYSTAL CLICKER
// ============================================================================
const CyberClickerGame: React.FC<{ onSaveScore: (s: number) => void }> = ({ onSaveScore }) => {
  const [energy, setEnergy] = useState(0);
  const [clickPower, setClickPower] = useState(1);
  const [autoPerSec, setAutoPerSec] = useState(0);
  const crystalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const crystalAnimRef = useRef({ rx: 0.4, ry: 0.6, spinBoost: 0, pulse: 0 });
  const icoMesh = useMemo(() => createIcosahedron(1.25), []);

  useEffect(() => {
    if (autoPerSec <= 0) return;
    const t = setInterval(() => setEnergy((e) => e + autoPerSec), 1000);
    return () => clearInterval(t);
  }, [autoPerSec]);

  useEffect(() => {
    let raf = 0;
    const rgb: [number, number, number] = [16, 185, 129];

    const renderCrystal = () => {
      const cvs = crystalCanvasRef.current;
      const ctx = cvs?.getContext('2d');
      if (!cvs || !ctx) return;
      const W = cvs.width;
      const H = cvs.height;
      const st = crystalAnimRef.current;

      st.ry += 0.014 + st.spinBoost;
      st.rx += 0.006 + st.spinBoost * 0.4;
      st.spinBoost *= 0.9;
      st.pulse *= 0.88;

      ctx.clearRect(0, 0, W, H);

      if (st.pulse > 0.02) {
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, 58 + (1 - st.pulse) * 28, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(52,211,153,${st.pulse * 0.75})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      const scaleFactor = 1 + st.pulse * 0.14;
      const transformed = icoMesh.vertices.map((vt) =>
        scale3(rotateEuler(vt, st.rx, st.ry), scaleFactor)
      );
      const projected = transformed.map((vt) => project3D(vt, W, H, 195, 4.0));

      const faces = icoMesh.faces
        .map((f) => {
          const center = {
            x: (transformed[f[0]].x + transformed[f[1]].x + transformed[f[2]].x) / 3,
            y: (transformed[f[0]].y + transformed[f[1]].y + transformed[f[2]].y) / 3,
            z: (transformed[f[0]].z + transformed[f[1]].z + transformed[f[2]].z) / 3,
          };
          let normal = cross3(
            sub3(transformed[f[1]], transformed[f[0]]),
            sub3(transformed[f[2]], transformed[f[0]])
          );
          if (normal.x * center.x + normal.y * center.y + normal.z * center.z < 0) {
            normal = scale3(normal, -1);
          }
          return { f, center, normal };
        })
        .sort((a, b) => a.center.z - b.center.z);

      for (const item of faces) {
        const p0 = projected[item.f[0]];
        const p1 = projected[item.f[1]];
        const p2 = projected[item.f[2]];
        if (!p0.visible || !p1.visible || !p2.visible) continue;
        ctx.beginPath();
        ctx.moveTo(p0.sx, p0.sy);
        ctx.lineTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.closePath();
        ctx.fillStyle = shadeBlinnPhong(item.normal, item.center, rgb, undefined, 0.9);
        ctx.fill();
        ctx.strokeStyle = 'rgba(167,243,208,0.45)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      raf = requestAnimationFrame(renderCrystal);
    };

    raf = requestAnimationFrame(renderCrystal);
    return () => cancelAnimationFrame(raf);
  }, [icoMesh]);

  const handleCrystalTap = () => {
    setEnergy((e) => e + clickPower);
    crystalAnimRef.current.spinBoost = Math.min(0.22, crystalAnimRef.current.spinBoost + 0.08);
    crystalAnimRef.current.pulse = 1.0;
  };

  const upgrades = [
    { name: '⚡ Двойной свитч мыши (+2 за клик)', cost: 25, buy: () => setClickPower((p) => p + 2) },
    { name: '🤖 Авто-Скрипт на Python (+5/сек)', cost: 80, buy: () => setAutoPerSec((a) => a + 5) },
    { name: '🖥 Вычислительный кластер (+25/сек)', cost: 300, buy: () => setAutoPerSec((a) => a + 25) },
    {
      name: '🌌 Квантовый ускоритель (+15 за клик & +80/сек)',
      cost: 1000,
      buy: () => {
        setClickPower((p) => p + 15);
        setAutoPerSec((a) => a + 80);
      },
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center min-w-0">
      <div className="flex flex-col items-center justify-center p-5 sm:p-6 rounded-2xl bg-slate-950/90 border border-emerald-400/30 space-y-3 select-none">
        <div className="text-xs text-emerald-300 uppercase tracking-wider">Накоплено энергии</div>
        <div className="text-3xl sm:text-4xl font-black font-mono text-white">
          {energy.toLocaleString('ru-RU')} ⚡
        </div>
        <div className="text-xs text-slate-400 text-center">
          Клик: <b className="text-white">+{clickPower}</b> • Авто: <b className="text-emerald-300">+{autoPerSec}/сек</b>
        </div>
        <canvas
          ref={crystalCanvasRef}
          width={176}
          height={176}
          onPointerDown={handleCrystalTap}
          className="w-40 h-40 cursor-pointer active:scale-95 transition touch-manipulation select-none"
          title="Тапайте по 3D-кристаллу!"
        />
        <div className="text-[11px] text-emerald-300/80 font-semibold">Тапайте по 3D-кристаллу</div>
        <button
          type="button"
          disabled={energy <= 0}
          onClick={() => energy > 0 && onSaveScore(energy)}
          className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 border border-amber-400/40 text-amber-200 text-xs font-semibold text-center"
        >
          🏆 Сохранить {energy} очк. в рейтинг (+XP)
        </button>
      </div>

      <div className="space-y-2.5 min-w-0">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Улучшения генератора:</h4>
        {upgrades.map((u) => (
          <button
            key={u.name}
            type="button"
            disabled={energy < u.cost}
            onClick={() => {
              if (energy >= u.cost) {
                setEnergy((e) => e - u.cost);
                u.buy();
              }
            }}
            className="w-full p-3.5 rounded-xl bg-slate-950 border border-white/10 disabled:opacity-40 hover:border-emerald-400/50 text-left flex items-center justify-between gap-2 transition"
          >
            <span className="text-xs text-white font-medium">{u.name}</span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-mono text-xs shrink-0">
              {u.cost} ⚡
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN ARCADE HUB WRAPPER
// ============================================================================
export const ArcadeGamesHub: React.FC<Props> = ({ activeTool, onSync, onToast }) => {
  const [gameTab, setGameTab] = useState<'chess' | 'spy' | 'guess' | 'wolf' | 'doodle' | 'tetris' | 'clicker'>('chess');
  const [highscores, setHighscores] = useState<any[]>([]);

  useEffect(() => {
    if (activeTool === 'chess_academy') setGameTab('chess');
    else if (activeTool === 'spy_lobby') setGameTab('spy');
    else if (activeTool === 'guess_size') setGameTab('guess');
    else if (activeTool === 'arcade_wolf') setGameTab('wolf');
    else if (activeTool === 'arcade_doodle') setGameTab('doodle');
    else if (activeTool === 'arcade_tetris') setGameTab('tetris');
    else if (activeTool === 'arcade_clicker') setGameTab('clicker');
  }, [activeTool]);

  const loadHighscores = () => {
    apiGet('/api/v2/games/highscores?game_id=all')
      .then((r) => setHighscores(r.highscores || []))
      .catch(() => {});
  };

  useEffect(() => {
    loadHighscores();
  }, []);

  const saveScore = async (gameId: string, score: number) => {
    try {
      const r = await apiPost('/api/v2/games/score', { game_id: gameId, score });
      setHighscores(r.highscores || []);
      onSync();
      onToast(`Рекорд ${score} сохранён (+${r.xp_earned} XP) 🏆`);
      loadHighscores();
    } catch (e: any) {
      onToast(e.message);
    }
  };

  const isWideFeatured = gameTab === 'chess' || gameTab === 'spy' || gameTab === 'guess';

  return (
    <div className="space-y-5 min-w-0">
      {gameTab === 'chess' && <ChessAcademyHub onScoreSubmit={saveScore} onToast={onToast} />}
      {gameTab === 'spy' && <SpyLobbyHub onToast={onToast} />}
      {gameTab === 'guess' && <GuessSizeGame onScoreSubmit={saveScore} onToast={onToast} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {!isWideFeatured && (
          <div className="lg:col-span-8 rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 min-w-0">
            {gameTab === 'wolf' && <WolfEggsGame onSaveScore={(s) => saveScore('arcade_wolf', s)} />}
            {gameTab === 'doodle' && <DoodleJumpGame onSaveScore={(s) => saveScore('arcade_doodle', s)} />}
            {gameTab === 'tetris' && <NeonTetrisGame onSaveScore={(s) => saveScore('arcade_tetris', s)} />}
            {gameTab === 'clicker' && <CyberClickerGame onSaveScore={(s) => saveScore('arcade_clicker', s)} />}
          </div>
        )}

        <div
          className={`${
            isWideFeatured ? 'lg:col-span-12' : 'lg:col-span-4'
          } rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-3 min-w-0`}
        >
          <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
            <Trophy className="w-4 h-4 shrink-0" /> Зал Славы Игр
          </div>
          <p className="text-xs text-slate-400">
            Каждая сыгранная партия приносит XP в ваш профиль и поднимает вас в общем рейтинге.
          </p>
          {highscores.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-950/70 border border-white/5 text-center text-xs text-slate-400">
              Рекордов от игроков из Telegram пока нет — сыграйте первым!
            </div>
          ) : (
            <div className={isWideFeatured ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2' : 'space-y-2'}>
              {highscores.map((h, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-xl bg-slate-950/90 border border-white/10 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">{h.avatar_emoji || '⚡'}</span>
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">{h.first_name}</div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {GAME_NAMES[h.game_id] || h.game_id}
                      </div>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-emerald-300 shrink-0">{h.best_score}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
