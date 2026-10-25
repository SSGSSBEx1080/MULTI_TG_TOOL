import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Eraser, Flame, Pause, Play, RotateCcw, StepForward, Trophy } from 'lucide-react';

// ============================================================================
// 1. FALLING SAND CELLULAR AUTOMATA SANDBOX (SAND, WATER, LAVA, ACID, PLANT...)
// ============================================================================
const MAT_EMPTY = 0;
const MAT_SAND = 1;
const MAT_WATER = 2;
const MAT_WALL = 3;
const MAT_WOOD = 4;
const MAT_FIRE = 5;
const MAT_OIL = 6;
const MAT_LAVA = 7;
const MAT_ACID = 8;
const MAT_PLANT = 9;
const MAT_GUNPOWDER = 10;

const MATERIALS = [
  { id: MAT_SAND, name: '🟨 Песок', rgb: [234, 179, 8] },
  { id: MAT_WATER, name: '💧 Вода', rgb: [56, 189, 248] },
  { id: MAT_WALL, name: '🪨 Камень', rgb: [148, 163, 184] },
  { id: MAT_WOOD, name: '🪵 Дерево', rgb: [146, 64, 14] },
  { id: MAT_FIRE, name: '🔥 Огонь', rgb: [249, 115, 22] },
  { id: MAT_LAVA, name: '🌋 Лава', rgb: [239, 68, 68] },
  { id: MAT_OIL, name: '🛢️ Нефть', rgb: [120, 113, 108] },
  { id: MAT_ACID, name: '🧪 Кислота', rgb: [132, 204, 22] },
  { id: MAT_PLANT, name: '🌱 Растение', rgb: [34, 197, 94] },
  { id: MAT_GUNPOWDER, name: '💣 Порох', rgb: [168, 85, 247] },
  { id: MAT_EMPTY, name: '🩹 Ластик', rgb: [8, 12, 24] },
];

const GW = 160;
const GH = 105;

export const SandPhysicsSandbox: React.FC<{ onToast: (m: string) => void }> = ({ onToast }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gridRef = useRef<Uint8Array>(new Uint8Array(GW * GH));
  const [selectedMat, setSelectedMat] = useState<number>(MAT_SAND);
  const [brushSize, setBrushSize] = useState<number>(3);
  const [paused, setPaused] = useState(false);
  const drawingRef = useRef(false);
  const cursorRef = useRef({ gx: 80, gy: 25 });

  // Seed a fun starter island with water basin & wood bridge
  const seedStarterScene = () => {
    const g = new Uint8Array(GW * GH);
    for (let x = 25; x < 135; x++) {
      g[88 * GW + x] = MAT_WALL;
      g[89 * GW + x] = MAT_WALL;
    }
    for (let y = 74; y < 88; y++) {
      g[y * GW + 25] = MAT_WALL;
      g[y * GW + 134] = MAT_WALL;
    }
    for (let x = 27; x < 78; x++) {
      for (let y = 80; y < 88; y++) g[y * GW + x] = MAT_WATER;
    }
    for (let x = 85; x < 125; x++) {
      g[65 * GW + x] = MAT_WOOD;
      g[66 * GW + x] = MAT_WOOD;
    }
    gridRef.current = g;
  };

  useEffect(() => {
    seedStarterScene();
  }, []);

  const stepSimulation = () => {
    const g = gridRef.current;
    const updated = new Uint8Array(GW * GH);

    const swap = (i1: number, i2: number) => {
      const t = g[i1];
      g[i1] = g[i2];
      g[i2] = t;
      updated[i1] = 1;
      updated[i2] = 1;
    };

    for (let y = GH - 2; y >= 1; y--) {
      const leftFirst = Math.random() < 0.5;
      for (let ix = 1; ix < GW - 1; ix++) {
        const x = leftFirst ? ix : GW - 1 - ix;
        const idx = y * GW + x;
        if (updated[idx]) continue;
        const m = g[idx];
        if (m === MAT_EMPTY || m === MAT_WALL || m === MAT_WOOD) continue;

        const below = (y + 1) * GW + x;
        const dir = Math.random() < 0.5 ? -1 : 1;
        const belowA = (y + 1) * GW + (x + dir);
        const belowB = (y + 1) * GW + (x - dir);

        if (m === MAT_SAND || m === MAT_GUNPOWDER) {
          if (g[below] === MAT_EMPTY || g[below] === MAT_WATER || g[below] === MAT_OIL) {
            swap(idx, below);
          } else if (g[belowA] === MAT_EMPTY || g[belowA] === MAT_WATER) {
            swap(idx, belowA);
          } else if (g[belowB] === MAT_EMPTY || g[belowB] === MAT_WATER) {
            swap(idx, belowB);
          }
        } else if (m === MAT_WATER || m === MAT_OIL || m === MAT_LAVA || m === MAT_ACID) {
          // Chemical reactions around liquid cell
          const neighbors = [below, idx - 1, idx + 1, (y - 1) * GW + x];
          for (const nb of neighbors) {
            const nm = g[nb];
            if (m === MAT_LAVA) {
              if (nm === MAT_WATER) {
                g[idx] = MAT_WALL; // Lava + Water -> Stone!
                g[nb] = MAT_EMPTY;
                break;
              }
              if (nm === MAT_WOOD || nm === MAT_PLANT || nm === MAT_OIL || nm === MAT_GUNPOWDER) {
                g[nb] = MAT_FIRE;
              }
            } else if (m === MAT_WATER && nm === MAT_FIRE) {
              g[nb] = MAT_EMPTY;
            } else if (m === MAT_WATER && nm === MAT_PLANT && Math.random() < 0.08) {
              g[idx] = MAT_PLANT; // Plant absorbs water and grows!
              break;
            } else if (m === MAT_ACID && nm !== MAT_EMPTY && nm !== MAT_ACID && nm !== MAT_WALL) {
              if (Math.random() < 0.35) {
                g[nb] = MAT_EMPTY;
                g[idx] = MAT_EMPTY;
                break;
              }
            } else if (m === MAT_ACID && nm === MAT_WALL && Math.random() < 0.12) {
              g[nb] = MAT_EMPTY;
              g[idx] = MAT_EMPTY;
              break;
            }
          }

          if (g[idx] !== m) continue;
          if (g[below] === MAT_EMPTY || (m === MAT_WATER && g[below] === MAT_OIL)) {
            swap(idx, below);
          } else if (g[belowA] === MAT_EMPTY) {
            swap(idx, belowA);
          } else if (g[belowB] === MAT_EMPTY) {
            swap(idx, belowB);
          } else if (g[idx + dir] === MAT_EMPTY) {
            swap(idx, idx + dir);
          } else if (g[idx - dir] === MAT_EMPTY) {
            swap(idx, idx - dir);
          }
        } else if (m === MAT_FIRE) {
          const neighbors = [below, (y - 1) * GW + x, idx - 1, idx + 1];
          for (const nb of neighbors) {
            const nm = g[nb];
            if (nm === MAT_WOOD || nm === MAT_PLANT) {
              if (Math.random() < 0.12) g[nb] = MAT_FIRE;
            } else if (nm === MAT_OIL || nm === MAT_GUNPOWDER) {
              g[nb] = MAT_FIRE;
              if (nm === MAT_GUNPOWDER) {
                // Micro-burst
                for (let dy = -2; dy <= 2; dy++) {
                  for (let dx = -2; dx <= 2; dx++) {
                    const bi = (y + dy) * GW + (x + dx);
                    if (bi >= 0 && bi < GW * GH && g[bi] !== MAT_WALL) g[bi] = MAT_FIRE;
                  }
                }
              }
            } else if (nm === MAT_WATER) {
              g[idx] = MAT_EMPTY;
            }
          }
          const up = (y - 1) * GW + (x + (Math.random() < 0.5 ? 0 : dir));
          if (Math.random() < 0.16) {
            g[idx] = MAT_EMPTY;
          } else if (y > 1 && g[up] === MAT_EMPTY) {
            swap(idx, up);
          }
        }
      }
    }
  };

  const paintBrush = (gx: number, gy: number) => {
    const g = gridRef.current;
    for (let dy = -brushSize; dy <= brushSize; dy++) {
      for (let dx = -brushSize; dx <= brushSize; dx++) {
        if (dx * dx + dy * dy > brushSize * brushSize) continue;
        const x = gx + dx;
        const y = gy + dy;
        if (x < 1 || x >= GW - 1 || y < 1 || y >= GH - 1) continue;
        if (selectedMat !== MAT_EMPTY && selectedMat !== MAT_WALL && selectedMat !== MAT_WOOD && Math.random() < 0.25) {
          continue;
        }
        g[y * GW + x] = selectedMat;
      }
    }
  };

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    cvs.width = GW;
    cvs.height = GH;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(GW, GH);

    const colorLut: Record<number, number[]> = {};
    for (const m of MATERIALS) colorLut[m.id] = m.rgb;

    let raf = 0;
    const loop = () => {
      if (drawingRef.current) {
        paintBrush(cursorRef.current.gx, cursorRef.current.gy);
      }
      if (!paused) {
        stepSimulation();
      }
      const g = gridRef.current;
      const d = img.data;
      for (let i = 0; i < GW * GH; i++) {
        const m = g[i];
        const rgb = colorLut[m] || [8, 12, 24];
        const flicker = m === MAT_FIRE || m === MAT_LAVA ? ((i * 17) % 35) - 15 : (i % 3) * 4;
        const p = i * 4;
        d[p] = Math.min(255, Math.max(0, rgb[0] + flicker));
        d[p + 1] = Math.min(255, Math.max(0, rgb[1] + (m === MAT_FIRE ? flicker * 2 : 0)));
        d[p + 2] = rgb[2];
        d[p + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [paused, selectedMat, brushSize]);

  const updatePointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const gx = Math.floor(((e.clientX - rect.left) / rect.width) * GW);
    const gy = Math.floor(((e.clientY - rect.top) / rect.height) * GH);
    cursorRef.current = { gx, gy };
  };

  const downloadPng = () => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const url = cvs.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sand_sandbox.png';
    a.click();
    onToast('Снимок песочницы сохранён в PNG');
  };

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-slate-900/80 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" /> Физическая песочница стихий (60 FPS)
          </h3>
          <p className="text-xs text-slate-400">
            Вода превращает лаву в камень, огонь сжигает дерево и взрывает порох, кислота прожигает стены, а растения пьют воду
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white flex items-center gap-1"
          >
            {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {paused ? 'Пуск' : 'Пауза'}
          </button>
          <button
            type="button"
            onClick={stepSimulation}
            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white flex items-center gap-1"
            title="Один шаг физики"
          >
            <StepForward className="w-3.5 h-3.5" /> Шаг
          </button>
          <button
            type="button"
            onClick={() => {
              gridRef.current = new Uint8Array(GW * GH);
            }}
            className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-xs text-rose-200 flex items-center gap-1"
          >
            <Eraser className="w-3.5 h-3.5" /> Очистить
          </button>
          <button
            type="button"
            onClick={downloadPng}
            className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-xs text-emerald-200 flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" /> PNG
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {MATERIALS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setSelectedMat(m.id)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
              selectedMat === m.id
                ? 'bg-amber-500/25 border-amber-400 text-white'
                : 'bg-slate-950 border-white/10 text-slate-300 hover:border-white/25'
            }`}
          >
            {m.name}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-300">
        <span>Размер кисти: {brushSize}</span>
        <input
          type="range"
          min={1}
          max={7}
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="w-32"
        />
      </div>

      <canvas
        ref={canvasRef}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawingRef.current = true;
          updatePointer(e);
          paintBrush(cursorRef.current.gx, cursorRef.current.gy);
        }}
        onPointerMove={updatePointer}
        onPointerUp={() => {
          drawingRef.current = false;
        }}
        onPointerCancel={() => {
          drawingRef.current = false;
        }}
        className="w-full aspect-[160/105] max-h-[380px] rounded-2xl border border-white/15 bg-[#080c18] pixel cursor-crosshair touch-none"
      />
    </div>
  );
};

// ============================================================================
// 2. NONOGRAMS (JAPANESE PICROSS) & SOLVABLE 15-PUZZLE
// ============================================================================
const NONOGRAM_LEVELS = [
  {
    id: 'heart',
    title: '❤️ Пиксельное сердце (5×5)',
    grid: [
      [0, 1, 0, 1, 0],
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
      [0, 1, 1, 1, 0],
      [0, 0, 1, 0, 0],
    ],
  },
  {
    id: 'rocket',
    title: '🚀 Космическая ракета (7×7)',
    grid: [
      [0, 0, 0, 1, 0, 0, 0],
      [0, 0, 1, 1, 1, 0, 0],
      [0, 0, 1, 0, 1, 0, 0],
      [0, 1, 1, 1, 1, 1, 0],
      [0, 1, 1, 1, 1, 1, 0],
      [1, 1, 0, 1, 0, 1, 1],
      [1, 0, 0, 0, 0, 0, 1],
    ],
  },
  {
    id: 'crown',
    title: '👑 Корона (7×7)',
    grid: [
      [1, 0, 0, 1, 0, 0, 1],
      [1, 1, 0, 1, 0, 1, 1],
      [1, 1, 1, 1, 1, 1, 1],
      [1, 0, 1, 0, 1, 0, 1],
      [1, 1, 1, 1, 1, 1, 1],
      [0, 1, 1, 1, 1, 1, 0],
      [0, 0, 0, 0, 0, 0, 0],
    ],
  },
  {
    id: 'cat',
    title: '🐱 Силуэт кота (7×7)',
    grid: [
      [0, 1, 0, 0, 0, 1, 0],
      [0, 1, 1, 1, 1, 1, 0],
      [0, 1, 0, 1, 0, 1, 0],
      [0, 1, 1, 1, 1, 1, 0],
      [0, 0, 1, 1, 1, 0, 1],
      [0, 1, 1, 1, 1, 0, 1],
      [0, 1, 1, 1, 1, 1, 0],
    ],
  },
];

function computeClues(line: number[]): number[] {
  const res: number[] = [];
  let run = 0;
  for (const v of line) {
    if (v === 1) run++;
    else if (run > 0) {
      res.push(run);
      run = 0;
    }
  }
  if (run > 0) res.push(run);
  return res.length ? res : [0];
}

function makeSolvableSliding(n: number): number[] {
  const total = n * n;
  const arr = Array.from({ length: total }, (_, i) => (i + 1) % total);
  // Apply 140 valid neighbor slides from solved state -> 100% guaranteed solvable!
  let emptyIdx = total - 1;
  for (let s = 0; s < 140; s++) {
    const r = Math.floor(emptyIdx / n);
    const c = emptyIdx % n;
    const moves: number[] = [];
    if (r > 0) moves.push((r - 1) * n + c);
    if (r < n - 1) moves.push((r + 1) * n + c);
    if (c > 0) moves.push(r * n + (c - 1));
    if (c < n - 1) moves.push(r * n + (c + 1));
    const pick = moves[Math.floor(Math.random() * moves.length)];
    [arr[emptyIdx], arr[pick]] = [arr[pick], arr[emptyIdx]];
    emptyIdx = pick;
  }
  return arr;
}

export const NonogramAndSlidingHub: React.FC<{
  onScoreSubmit: (gameId: string, score: number) => void;
}> = ({ onScoreSubmit }) => {
  const [sub, setSub] = useState<'nonogram' | 'sliding'>('nonogram');
  const [lvlIdx, setLvlIdx] = useState(0);
  const [markMode, setMarkMode] = useState<'fill' | 'cross'>('fill');

  const level = NONOGRAM_LEVELS[lvlIdx];
  const N = level.grid.length;
  const [board, setBoard] = useState<number[][]>(() =>
    Array.from({ length: N }, () => Array(N).fill(0))
  );

  useEffect(() => {
    const dim = NONOGRAM_LEVELS[lvlIdx].grid.length;
    setBoard(Array.from({ length: dim }, () => Array(dim).fill(0)));
  }, [lvlIdx]);

  const rowClues = useMemo(() => level.grid.map((row) => computeClues(row)), [level]);
  const colClues = useMemo(
    () =>
      Array.from({ length: N }, (_, c) =>
        computeClues(level.grid.map((row) => row[c]))
      ),
    [level, N]
  );

  const nonogramSolved = useMemo(() => {
    if (board.length !== N) return false;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const filled = board[r]?.[c] === 1 ? 1 : 0;
        if (filled !== level.grid[r][c]) return false;
      }
    }
    return true;
  }, [board, level, N]);

  // 15-puzzle state
  const [slideSize, setSlideSize] = useState<3 | 4>(4);
  const [tiles, setTiles] = useState<number[]>(() => makeSolvableSliding(4));
  const [moves, setMoves] = useState(0);

  const resetSliding = (sz = slideSize) => {
    setSlideSize(sz);
    setTiles(makeSolvableSliding(sz));
    setMoves(0);
  };

  const slideSolved = useMemo(
    () => tiles.every((v, idx) => v === (idx + 1) % (slideSize * slideSize)),
    [tiles, slideSize]
  );

  const handleTileClick = (idx: number) => {
    const emptyIdx = tiles.indexOf(0);
    const r1 = Math.floor(idx / slideSize);
    const c1 = idx % slideSize;
    const r2 = Math.floor(emptyIdx / slideSize);
    const c2 = emptyIdx % slideSize;
    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return;
    const next = [...tiles];
    [next[idx], next[emptyIdx]] = [next[emptyIdx], next[idx]];
    setTiles(next);
    setMoves((m) => m + 1);
    if (next.every((v, i) => v === (i + 1) % (slideSize * slideSize))) {
      onScoreSubmit('nonogram_15', Math.max(200, 2000 - moves * 10));
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-slate-900/80 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setSub('nonogram')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
              sub === 'nonogram'
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                : 'bg-slate-950 border-white/10 text-slate-400'
            }`}
          >
            🧩 Нонограммы (Японский кроссворд)
          </button>
          <button
            type="button"
            onClick={() => setSub('sliding')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
              sub === 'sliding'
                ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                : 'bg-slate-950 border-white/10 text-slate-400'
            }`}
          >
            🔢 Пятнашки (3×3 и 4×4)
          </button>
        </div>
      </div>

      {sub === 'nonogram' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {NONOGRAM_LEVELS.map((l, idx) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLvlIdx(idx)}
                  className={`px-2.5 py-1 rounded-lg text-xs border ${
                    lvlIdx === idx
                      ? 'bg-white/15 border-white/30 text-white font-semibold'
                      : 'bg-slate-950 border-white/10 text-slate-400'
                  }`}
                >
                  {l.title}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setMarkMode('fill')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                  markMode === 'fill' ? 'bg-emerald-500 text-slate-950 border-emerald-300' : 'bg-slate-950 text-slate-300 border-white/10'
                }`}
              >
                ■ Закрасить
              </button>
              <button
                type="button"
                onClick={() => setMarkMode('cross')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                  markMode === 'cross' ? 'bg-rose-500/30 text-rose-200 border-rose-400' : 'bg-slate-950 text-slate-300 border-white/10'
                }`}
              >
                ✕ Пусто
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="mx-auto border-collapse select-none">
              <thead>
                <tr>
                  <th className="p-1" />
                  {colClues.map((cl, c) => (
                    <th key={c} className="px-1.5 pb-1.5 text-[11px] font-mono text-sky-300 align-bottom">
                      {cl.map((n, k) => (
                        <div key={k}>{n}</div>
                      ))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {board.map((row, r) => (
                  <tr key={r}>
                    <td className="pr-2 text-right text-[11px] font-mono text-sky-300 whitespace-nowrap">
                      {rowClues[r]?.join(' ')}
                    </td>
                    {row.map((cell, c) => (
                      <td key={c} className="p-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            const copy = board.map((rw) => [...rw]);
                            const targetVal = markMode === 'fill' ? 1 : 2;
                            copy[r][c] = copy[r][c] === targetVal ? 0 : targetVal;
                            setBoard(copy);
                          }}
                          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg border font-mono text-sm font-bold flex items-center justify-center transition ${
                            cell === 1
                              ? 'bg-emerald-400 border-emerald-200 text-slate-950'
                              : cell === 2
                              ? 'bg-slate-950 border-white/10 text-rose-400'
                              : 'bg-slate-950 hover:bg-slate-800 border-white/15 text-transparent'
                          }`}
                        >
                          {cell === 2 ? '✕' : ''}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {nonogramSolved && (
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-between text-xs text-emerald-200">
              <span className="font-bold flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-300" /> Нонограмма разгадана безошибочно!
              </span>
              <button
                type="button"
                onClick={() => {
                  onScoreSubmit('nonogram_15', N * 200);
                  setLvlIdx((i) => (i + 1) % NONOGRAM_LEVELS.length);
                }}
                className="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-bold"
              >
                Следующий рисунок →
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-sm mx-auto space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex gap-1.5">
              {([3, 4] as const).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => resetSliding(sz)}
                  className={`px-3 py-1 rounded-lg border font-mono ${
                    slideSize === sz ? 'bg-sky-500/25 border-sky-400 text-sky-200' : 'bg-slate-950 border-white/10 text-slate-400'
                  }`}
                >
                  {sz}×{sz}
                </button>
              ))}
            </div>
            <span className="font-mono text-slate-300">Ходов: {moves}</span>
          </div>

          <div
            style={{ gridTemplateColumns: `repeat(${slideSize}, minmax(0, 1fr))` }}
            className="grid gap-2 p-2.5 rounded-2xl bg-slate-950 border border-white/10"
          >
            {tiles.map((v, idx) => (
              <button
                key={idx}
                type="button"
                disabled={v === 0}
                onClick={() => handleTileClick(idx)}
                className={`aspect-square rounded-xl font-mono text-lg font-black transition ${
                  v === 0
                    ? 'bg-transparent cursor-default'
                    : 'bg-slate-800 hover:bg-sky-500/30 border border-white/15 text-white active:scale-95'
                }`}
              >
                {v === 0 ? '' : v}
              </button>
            ))}
          </div>

          {slideSolved && moves > 0 && (
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400 text-center text-xs font-bold text-emerald-200">
              Собрано за {moves} ходов!
            </div>
          )}

          <button
            type="button"
            onClick={() => resetSliding(slideSize)}
            className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Перемешать плитки
          </button>
        </div>
      )}
    </div>
  );
};
