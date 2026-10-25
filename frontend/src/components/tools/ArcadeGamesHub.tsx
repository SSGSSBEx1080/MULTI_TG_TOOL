import React, { useEffect, useRef, useState } from 'react';
import { Gamepad2, Play, RotateCcw, Trophy, Zap } from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api';

interface Props {
  activeTool: string;
  onSelectTool: (t: string) => void;
  onSync: () => void;
  onToast: (msg: string) => void;
}

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

  const setPos = (p: 0 | 1 | 2 | 3) => {
    basketRef.current = p;
    setBasketPos(p);
  };

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
  }, []);

  useEffect(() => {
    if (!running) return;
    let animId = 0;
    let curScore = 0;
    let curLives = 3;
    let spawnTimer = 0;
    const eggs: { lane: 0 | 1 | 2 | 3; progress: number }[] = [];
    let lastTs = performance.now();

    const chutes = [
      { x1: 30, y1: 68, x2: 145, y2: 122 },   // 0 TL
      { x1: 30, y1: 158, x2: 145, y2: 212 },  // 1 BL
      { x1: 390, y1: 68, x2: 275, y2: 122 },  // 2 TR
      { x1: 390, y1: 158, x2: 275, y2: 212 }, // 3 BR
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

        // Retro LCD frame
        ctx.strokeStyle = 'rgba(56,189,248,0.25)';
        ctx.lineWidth = 2;
        ctx.strokeRect(8, 8, cvs.width - 16, cvs.height - 16);

        // Chutes
        chutes.forEach((c) => {
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(c.x1, c.y1);
          ctx.lineTo(c.x2, c.y2);
          ctx.stroke();
        });

        // Wolf body in center
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

        // Basket at active chute end
        const target = chutes[bPos];
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(target.x2, target.y2 + 6, 16, 0, Math.PI, false);
        ctx.fill();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Rolling eggs
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

        // HUD
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(`СЧЁТ: ${curScore}`, 22, 32);
        ctx.fillStyle = '#fb7185';
        ctx.fillText(`ЖИЗНИ: ${'❤️'.repeat(Math.max(0, curLives))}`, 295, 32);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [running]);

  const startGame = () => {
    setScore(0);
    setLives(3);
    setGameOver(false);
    setRunning(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-slate-300">
          Управление: клавиши <kbd className="px-1.5 py-0.5 rounded bg-white/10">Q</kbd> <kbd className="px-1.5 py-0.5 rounded bg-white/10">A</kbd> <kbd className="px-1.5 py-0.5 rounded bg-white/10">E</kbd> <kbd className="px-1.5 py-0.5 rounded bg-white/10">D</kbd> или кнопки по углам:
        </div>
        <button
          onClick={startGame}
          className="px-4 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5"
        >
          <Play className="w-3.5 h-3.5" /> {running ? 'Перезапуск' : 'Старт игры!'}
        </button>
      </div>

      <div className="flex flex-col items-center gap-3">
        <canvas
          ref={canvasRef}
          width={420}
          height={260}
          className="w-full max-w-[440px] rounded-2xl border border-sky-400/30 bg-[#0b1220] shadow-xl"
        />
        {gameOver && (
          <div className="text-xs text-amber-300 font-semibold">
            Игра окончена! Ваш счёт: <b>{score}</b> (сохранён в таблицу рекордов 🏆)
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 w-full max-w-[440px]">
          <button
            onClick={() => setPos(0)}
            className={`py-3 rounded-xl font-bold text-xs border ${basketPos === 0 ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-slate-950 text-white border-white/15'}`}
          >
            ↖ Верх-Лево (Q)
          </button>
          <button
            onClick={() => setPos(2)}
            className={`py-3 rounded-xl font-bold text-xs border ${basketPos === 2 ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-slate-950 text-white border-white/15'}`}
          >
            ↗ Верх-Право (E)
          </button>
          <button
            onClick={() => setPos(1)}
            className={`py-3 rounded-xl font-bold text-xs border ${basketPos === 1 ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-slate-950 text-white border-white/15'}`}
          >
            ↙ Низ-Лево (A)
          </button>
          <button
            onClick={() => setPos(3)}
            className={`py-3 rounded-xl font-bold text-xs border ${basketPos === 3 ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-slate-950 text-white border-white/15'}`}
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

        platforms.forEach((p) => {
          ctx.fillStyle = p.boost ? '#f43f5e' : p.vx !== 0 ? '#38bdf8' : '#22c55e';
          ctx.beginPath();
          ctx.roundRect(p.x, p.y, p.w, 10, 5);
          ctx.fill();
        });

        // Cyber Doodler
        ctx.fillStyle = '#a855f7';
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

  return (
    <div className="flex flex-col items-center space-y-3">
      <div className="flex items-center justify-between w-full max-w-[340px]">
        <span className="text-xs text-slate-300">Стрелки ⬅️ ➡️ или A / D</span>
        <button
          onClick={() => {
            setScore(0);
            setGameOver(false);
            setRunning(true);
          }}
          className="px-4 py-1.5 rounded-xl bg-purple-500 text-white font-bold text-xs"
        >
          🚀 {running ? 'Заново' : 'Прыгать!'}
        </button>
      </div>
      <canvas ref={canvasRef} width={340} height={400} className="rounded-2xl border border-purple-400/35 bg-[#090e1a]" />
      {gameOver && <div className="text-xs text-amber-300 font-semibold">Финиш! Высота: <b>{score} м</b> 🏆</div>}
      <div className="grid grid-cols-2 gap-3 w-full max-w-[340px]">
        <button
          onMouseDown={() => (moveDir.current = -1)}
          onMouseUp={() => (moveDir.current = 0)}
          onTouchStart={() => (moveDir.current = -1)}
          onTouchEnd={() => (moveDir.current = 0)}
          className="py-3 rounded-xl bg-slate-950 border border-white/15 text-white font-bold text-sm active:bg-purple-500/40"
        >
          ⬅️ Влево
        </button>
        <button
          onMouseDown={() => (moveDir.current = 1)}
          onMouseUp={() => (moveDir.current = 0)}
          onTouchStart={() => (moveDir.current = 1)}
          onTouchEnd={() => (moveDir.current = 0)}
          className="py-3 rounded-xl bg-slate-950 border border-white/15 text-white font-bold text-sm active:bg-purple-500/40"
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

const NeonTetrisGame: React.FC<{ onSaveScore: (s: number) => void }> = ({ onSaveScore }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const ctrlRef = useRef<{ move: (dx: number) => void; rotate: () => void; drop: () => void }>({
    move: () => {},
    rotate: () => {},
    drop: () => {},
  });

  useEffect(() => {
    if (!running) return;
    const COLS = 10;
    const ROWS = 20;
    const CELL = 20;
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
      ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          ctx.strokeStyle = 'rgba(255,255,255,0.04)';
          ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
          if (board[r][c]) {
            ctx.fillStyle = board[r][c]!;
            ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
          }
        }
      }

      piece.m.forEach((row, r) =>
        row.forEach((v, c) => {
          if (v) {
            ctx.fillStyle = piece.c;
            ctx.fillRect((piece.x + c) * CELL + 1, (piece.y + r) * CELL + 1, CELL - 2, CELL - 2);
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
    <div className="flex flex-col items-center space-y-3">
      <div className="flex items-center justify-between w-full max-w-[260px]">
        <span className="text-xs font-mono text-sky-300 font-bold">СЧЁТ: {score}</span>
        <button
          onClick={() => {
            setScore(0);
            setGameOver(false);
            setRunning(true);
          }}
          className="px-3.5 py-1.5 rounded-xl bg-sky-500 text-slate-950 font-bold text-xs"
        >
          🧱 {running ? 'Рестарт' : 'Играть в Тетрис'}
        </button>
      </div>
      <canvas ref={canvasRef} width={200} height={400} className="rounded-xl border border-sky-400/35 bg-[#090d18]" />
      {gameOver && <div className="text-xs text-amber-300 font-semibold">Стакан полон! Счёт: <b>{score}</b> 🏆</div>}
      <div className="grid grid-cols-4 gap-2 w-full max-w-[280px]">
        <button onClick={() => ctrlRef.current.move(-1)} className="py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white text-xs font-bold">⬅️</button>
        <button onClick={() => ctrlRef.current.rotate()} className="py-2.5 rounded-xl bg-purple-500/30 border border-purple-400/40 text-white text-xs font-bold">🔄</button>
        <button onClick={() => ctrlRef.current.drop()} className="py-2.5 rounded-xl bg-amber-500/30 border border-amber-400/40 text-white text-xs font-bold">⏬</button>
        <button onClick={() => ctrlRef.current.move(1)} className="py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white text-xs font-bold">➡️</button>
      </div>
    </div>
  );
};

// ============================================================================
// 4. NEXUS CYBER CLICKER
// ============================================================================
const CyberClickerGame: React.FC<{ onSaveScore: (s: number) => void }> = ({ onSaveScore }) => {
  const [energy, setEnergy] = useState(0);
  const [clickPower, setClickPower] = useState(1);
  const [autoPerSec, setAutoPerSec] = useState(0);

  useEffect(() => {
    if (autoPerSec <= 0) return;
    const t = setInterval(() => setEnergy((e) => e + autoPerSec), 1000);
    return () => clearInterval(t);
  }, [autoPerSec]);

  const upgrades = [
    { name: '⚡ Двойной свитч мыши (+2 за клик)', cost: 25, buy: () => setClickPower((p) => p + 2) },
    { name: '🤖 Авто-Скрипт на Python (+5/сек)', cost: 80, buy: () => setAutoPerSec((a) => a + 5) },
    { name: '🖥 Квантовый Кластер (+25/сек)', cost: 300, buy: () => setAutoPerSec((a) => a + 25) },
    { name: '🌌 Квантовый Стенд Реквием (+15 за клик & +80/сек)', cost: 1000, buy: () => { setClickPower((p) => p + 15); setAutoPerSec((a) => a + 80); } },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
      <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-950/90 border border-emerald-400/30 space-y-4">
        <div className="text-xs text-emerald-300 uppercase tracking-wider">Накоплено Нейро-Энергии</div>
        <div className="text-4xl font-black font-mono text-white">{energy.toLocaleString('ru-RU')} ⚡</div>
        <div className="text-xs text-slate-400">
          Сила клика: <b className="text-white">+{clickPower}</b> • Авто-добыча: <b className="text-emerald-300">+{autoPerSec}/сек</b>
        </div>
        <button
          onClick={() => setEnergy((e) => e + clickPower)}
          className="w-36 h-36 rounded-full bg-gradient-to-br from-emerald-400 via-sky-500 to-purple-600 shadow-2xl shadow-emerald-500/30 active:scale-95 transition flex flex-col items-center justify-center text-slate-950 font-black"
        >
          <span className="text-4xl">⚡</span>
          <span className="text-xs mt-1">ТАПАЙ!</span>
        </button>
        <button
          onClick={() => energy > 0 && onSaveScore(energy)}
          className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-xs font-semibold"
        >
          🏆 Зафиксировать {energy} очк. в глобальный рейтинг (+XP)
        </button>
      </div>

      <div className="space-y-2.5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Магазин апгрейдов реактора:</h4>
        {upgrades.map((u) => (
          <button
            key={u.name}
            disabled={energy < u.cost}
            onClick={() => {
              if (energy >= u.cost) {
                setEnergy((e) => e - u.cost);
                u.buy();
              }
            }}
            className="w-full p-3.5 rounded-xl bg-slate-950 border border-white/10 disabled:opacity-40 hover:border-emerald-400/50 text-left flex items-center justify-between transition"
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
export const ArcadeGamesHub: React.FC<Props> = ({ activeTool, onSelectTool, onSync, onToast }) => {
  const [gameTab, setGameTab] = useState<'wolf' | 'doodle' | 'tetris' | 'clicker'>('wolf');
  const [highscores, setHighscores] = useState<any[]>([]);

  useEffect(() => {
    if (activeTool === 'arcade_wolf') setGameTab('wolf');
    else if (activeTool === 'arcade_doodle') setGameTab('doodle');
    else if (activeTool === 'arcade_tetris') setGameTab('tetris');
    else if (activeTool === 'arcade_clicker') setGameTab('clicker');
  }, [activeTool]);

  const loadHighscores = () => {
    apiGet('/api/v2/games/highscores?game_id=all').then((r) => setHighscores(r.highscores || []));
  };

  useEffect(() => {
    loadHighscores();
  }, []);

  const saveScore = async (gameId: string, score: number) => {
    try {
      const r = await apiPost('/api/v2/games/score', { game_id: gameId, score });
      setHighscores(r.highscores || []);
      onSync();
      onToast(`Рекорд ${score} сохранён! Начислено +${r.xp_earned} XP 🏆`);
      loadHighscores();
    } catch (e: any) {
      onToast(e.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'wolf', tool: 'arcade_wolf', label: '🐺 Волк ловит яйца (Ну, погоди!)' },
          { id: 'doodle', tool: 'arcade_doodle', label: '🚀 Doodle Cyber Jump' },
          { id: 'tetris', tool: 'arcade_tetris', label: '🧱 Тетрис' },
          { id: 'clicker', tool: 'arcade_clicker', label: '⚡ Кликер' },
        ].map((g) => (
          <button
            key={g.id}
            onClick={() => {
              setGameTab(g.id as any);
              onSelectTool(g.tool);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition ${
              gameTab === g.id
                ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-200 shadow-lg shadow-emerald-500/10'
                : 'bg-slate-900/60 border-white/10 text-slate-300 hover:bg-white/5'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 rounded-2xl border border-white/10 bg-slate-900/75 p-5">
          {gameTab === 'wolf' && <WolfEggsGame onSaveScore={(s) => saveScore('arcade_wolf', s)} />}
          {gameTab === 'doodle' && <DoodleJumpGame onSaveScore={(s) => saveScore('arcade_doodle', s)} />}
          {gameTab === 'tetris' && <NeonTetrisGame onSaveScore={(s) => saveScore('arcade_tetris', s)} />}
          {gameTab === 'clicker' && <CyberClickerGame onSaveScore={(s) => saveScore('arcade_clicker', s)} />}
        </div>

        <div className="lg:col-span-4 rounded-2xl border border-white/10 bg-slate-900/75 p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
            <Trophy className="w-4 h-4" /> Зал Славы Аркады
          </div>
          <p className="text-xs text-slate-400">
            Каждая сыгранная партия приносит XP в ваш глобальный профиль и поднимает вас в общем рейтинге!
          </p>
          <div className="space-y-2">
            {highscores.map((h, i) => (
              <div key={i} className="p-2.5 rounded-xl bg-slate-950/90 border border-white/10 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-base">{h.avatar_emoji || '⚡'}</span>
                  <div>
                    <div className="font-semibold text-white">{h.first_name}</div>
                    <div className="text-[10px] text-slate-400">{h.game_id}</div>
                  </div>
                </div>
                <span className="font-mono font-bold text-emerald-300">{h.best_score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
