import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Grid, HeartPulse, MousePointerClick, RotateCcw, Trophy, Zap } from 'lucide-react';
import { apiPost } from '../../lib/api';
import { syncHiDPICanvas } from '../../lib/engine3d';

interface Props {
  activeTool: string;
  onSync: () => void;
  onToast: (msg: string) => void;
}

function playShortBeep(freq = 880, dur = 0.09) {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.28, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.01);
    setTimeout(() => ctx.close().catch(() => {}), 350);
  } catch {
    // ignore
  }
}

// ============================================================================
// 1. REACTION TIME (VISUAL & AUDIO MS) + CPS CLICK SPEED TEST
// ============================================================================
const ReactionAndCpsView: React.FC<{ onSaveScore: (id: string, s: number) => void }> = ({ onSaveScore }) => {
  const [mobReflexTab, setMobReflexTab] = useState<'reaction' | 'cps'>('reaction');
  const [mode, setMode] = useState<'visual' | 'audio'>('visual');
  const [phase, setPhase] = useState<'idle' | 'waiting' | 'ready' | 'early' | 'done'>('idle');
  const [times, setTimes] = useState<number[]>([]);
  const startStampRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  // CPS state
  const [cpsDuration, setCpsDuration] = useState<1 | 5 | 10 | 30>(5);
  const [cpsRunning, setCpsRunning] = useState(false);
  const [cpsClicks, setCpsClicks] = useState(0);
  const [cpsLeft, setCpsLeft] = useState<number>(5);
  const [cpsResult, setCpsResult] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const armReaction = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setPhase('waiting');
    const delay = 1400 + Math.random() * 2600;
    timerRef.current = window.setTimeout(() => {
      startStampRef.current = performance.now();
      setPhase('ready');
      if (mode === 'audio') {
        playShortBeep(960, 0.12);
      }
    }, delay);
  };

  const handlePadDown = () => {
    if (phase === 'idle' || phase === 'early' || phase === 'done') {
      armReaction();
      return;
    }
    if (phase === 'waiting') {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setPhase('early');
      return;
    }
    if (phase === 'ready') {
      const ms = Math.max(60, Math.round(performance.now() - startStampRef.current));
      const next = [...times.slice(-4), ms];
      setTimes(next);
      setPhase('done');
    }
  };

  const medianMs = useMemo(() => {
    if (times.length === 0) return 0;
    const sorted = [...times].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }, [times]);

  // CPS countdown
  useEffect(() => {
    if (!cpsRunning) return;
    const started = performance.now();
    const id = window.setInterval(() => {
      const elapsed = (performance.now() - started) / 1000;
      const rem = Math.max(0, cpsDuration - elapsed);
      setCpsLeft(Number(rem.toFixed(1)));
      if (rem <= 0) {
        window.clearInterval(id);
        setCpsRunning(false);
      }
    }, 60);
    return () => window.clearInterval(id);
  }, [cpsRunning, cpsDuration]);

  useEffect(() => {
    if (!cpsRunning && cpsLeft === 0 && cpsClicks > 0) {
      const cps = Number((cpsClicks / cpsDuration).toFixed(2));
      setCpsResult(cps);
    }
  }, [cpsRunning, cpsLeft, cpsClicks, cpsDuration]);

  const handleCpsTap = () => {
    if (!cpsRunning) {
      if (cpsLeft === 0) {
        setCpsLeft(cpsDuration);
        setCpsClicks(1);
        setCpsResult(null);
        setCpsRunning(true);
        return;
      }
      setCpsClicks(1);
      setCpsResult(null);
      setCpsRunning(true);
    } else {
      setCpsClicks((c) => c + 1);
    }
  };

  return (
    <div className="space-y-3">
      {/* Mobile switch so Reaction & CPS are both immediately reachable above the fold */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-white/10 lg:hidden">
        <button
          type="button"
          onClick={() => setMobReflexTab('reaction')}
          className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
            mobReflexTab === 'reaction' ? 'bg-indigo-500 text-white' : 'text-slate-300'
          }`}
        >
          ⚡ Скорость реакции (мс)
        </button>
        <button
          type="button"
          onClick={() => setMobReflexTab('cps')}
          className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
            mobReflexTab === 'cps' ? 'bg-sky-500 text-slate-950' : 'text-slate-300'
          }`}
        >
          🖱️ Скорость клика (CPS)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Millisecond Reaction Test */}
        <div
          className={`lg:col-span-7 rounded-2xl border border-indigo-500/30 bg-slate-900/80 p-4 sm:p-5 space-y-4 ${
            mobReflexTab === 'reaction' ? 'block' : 'hidden lg:block'
          }`}
        >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" /> Скорость реакции (Визуальная и Звуковая)
            </h3>
            <p className="text-xs text-slate-400">
              Слуховой сигнал обрабатывается корой мозга на 20–40 мс быстрее зрительного
            </p>
          </div>
          <div className="flex gap-1.5">
            {[
              { id: 'visual', label: '👁️ На цвет' },
              { id: 'audio', label: '🔊 На звук' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMode(m.id as any);
                  setPhase('idle');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                  mode === m.id
                    ? 'bg-indigo-500/25 border-indigo-400 text-indigo-200'
                    : 'bg-slate-950 border-white/10 text-slate-400'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onPointerDown={handlePadDown}
          className={`w-full h-52 rounded-2xl border-2 transition-colors flex flex-col items-center justify-center p-4 select-none ${
            phase === 'waiting'
              ? 'bg-rose-600/85 border-rose-300 text-white'
              : phase === 'ready'
              ? 'bg-emerald-500 border-emerald-200 text-slate-950'
              : phase === 'early'
              ? 'bg-amber-500/30 border-amber-400 text-amber-100'
              : 'bg-slate-950 border-indigo-400/40 text-white hover:border-indigo-400'
          }`}
        >
          <div className="text-xl sm:text-2xl font-display font-black text-center">
            {phase === 'idle' && 'Нажмите для начала замера'}
            {phase === 'waiting' && (mode === 'audio' ? 'Ждите звуковой импульс…' : 'Ждите зелёный экран…')}
            {phase === 'ready' && 'ЖМИТЕ СЕЙЧАС!'}
            {phase === 'early' && 'Фальстарт! Нажмите, чтобы повторить'}
            {phase === 'done' && `${times[times.length - 1]} мс — нажмите для следующей попытки`}
          </div>
          {times.length > 0 && (
            <div className="mt-2 text-xs font-mono opacity-85">
              Попытки ({times.length}/5): {times.map((t) => `${t} мс`).join(' • ')}
            </div>
          )}
        </button>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="text-slate-300">
            Медиана: <span className="font-mono font-bold text-emerald-300">{medianMs ? `${medianMs} мс` : '—'}</span>
            {medianMs > 0 && (
              <span className="text-slate-400 ml-2">
                ({medianMs < 170 ? 'уровень киберспорта' : medianMs < 225 ? 'отличная реакция' : 'средняя норма'})
              </span>
            )}
          </div>
          {medianMs > 0 && (
            <button
              type="button"
              onClick={() => onSaveScore('reaction_cps_lab', Math.max(100, 1000 - medianMs * 2))}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-semibold flex items-center gap-1.5"
            >
              <Trophy className="w-3.5 h-3.5" /> В рейтинг
            </button>
          )}
        </div>
      </div>

      {/* CPS Click Speed Test */}
      <div
        className={`lg:col-span-5 rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 space-y-4 ${
          mobReflexTab === 'cps' ? 'block' : 'hidden lg:block'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <MousePointerClick className="w-4 h-4 text-sky-400" /> Тест скорости клика (CPS)
          </h3>
          <div className="flex gap-1">
            {([1, 5, 10, 30] as const).map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => {
                  setCpsRunning(false);
                  setCpsDuration(sec);
                  setCpsLeft(sec);
                  setCpsClicks(0);
                  setCpsResult(null);
                }}
                className={`px-2 py-1 rounded-lg text-xs font-mono border ${
                  cpsDuration === sec
                    ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                    : 'bg-slate-950 border-white/10 text-slate-400'
                }`}
              >
                {sec}с
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onPointerDown={handleCpsTap}
          className="w-full h-44 rounded-2xl bg-slate-950 hover:bg-slate-900 active:scale-[0.99] border border-sky-400/40 flex flex-col items-center justify-center select-none transition"
        >
          <div className="text-3xl font-mono font-black text-sky-300">
            {cpsResult !== null ? `${cpsResult} CPS` : cpsRunning ? `${cpsClicks} кликов` : 'Кликайте сюда!'}
          </div>
          <div className="text-xs font-mono text-slate-400 mt-1.5">
            {cpsRunning
              ? `Осталось: ${cpsLeft} с`
              : cpsResult !== null
              ? `Всего ${cpsClicks} за ${cpsDuration} с • ${
                  cpsResult >= 13 ? 'Баттерфляй' : cpsResult >= 9.5 ? 'Джиттер-клик' : 'Обычный темп'
                }`
              : `Таймер ${cpsDuration} с запустится с первого клика`}
          </div>
        </button>

        {cpsResult !== null && (
          <button
            type="button"
            onClick={() => {
              setCpsLeft(cpsDuration);
              setCpsClicks(0);
              setCpsResult(null);
            }}
            className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white font-semibold"
          >
            Сбросить таймер CPS
          </button>
        )}
      </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. 3D AIM TRAINER (FLICK, TRACKING, SPEED, PRECISION)
// ============================================================================
const AimTrainer3DView: React.FC<{ onSaveScore: (id: string, s: number) => void }> = ({ onSaveScore }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [aimMode, setAimMode] = useState<'flick' | 'tracking' | 'speed' | 'precision'>('flick');
  const [diff, setDiff] = useState<'easy' | 'med' | 'hard'>('med');
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState({ score: 0, hits: 0, shots: 0, secLeft: 30 });

  const stateRef = useRef({
    tx: 200,
    ty: 130,
    tr: 28,
    spawnAt: 0,
    pointerX: -999,
    pointerY: -999,
    trackInsideFrames: 0,
    trackTotalFrames: 0,
    hits: 0,
    shots: 0,
    score: 0,
  });

  const baseRadius = diff === 'easy' ? 40 : diff === 'med' ? 28 : 19;

  const spawnTarget = (w: number, h: number) => {
    const pad = baseRadius + 18;
    stateRef.current.tx = pad + Math.random() * Math.max(40, w - pad * 2);
    stateRef.current.ty = pad + Math.random() * Math.max(40, h - pad * 2);
    stateRef.current.tr = baseRadius;
    stateRef.current.spawnAt = performance.now();
  };

  const startAim = () => {
    const cvs = canvasRef.current;
    const rect = cvs?.getBoundingClientRect();
    stateRef.current = {
      tx: (rect?.width || 400) / 2,
      ty: (rect?.height || 260) / 2,
      tr: baseRadius,
      spawnAt: performance.now(),
      pointerX: -999,
      pointerY: -999,
      trackInsideFrames: 0,
      trackTotalFrames: 0,
      hits: 0,
      shots: 0,
      score: 0,
    };
    spawnTarget(rect?.width || 400, rect?.height || 260);
    setStats({ score: 0, hits: 0, shots: 0, secLeft: 30 });
    setRunning(true);
  };

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    let raf = 0;
    const startTs = performance.now();

    const draw = (now: number) => {
      const { ctx, W: width, H: height } = syncHiDPICanvas(cvs);
      if (!ctx) return;
      ctx.fillStyle = '#060a16';
      ctx.fillRect(0, 0, width, height);

      // Subtle perspective grid
      ctx.strokeStyle = 'rgba(99,102,241,0.12)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 36) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 36) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (running) {
        const elapsed = (now - startTs) / 1000;
        const rem = Math.max(0, 30 - elapsed);

        if (aimMode === 'tracking') {
          const spd = diff === 'easy' ? 1.1 : diff === 'med' ? 1.75 : 2.5;
          stateRef.current.tx = width * 0.5 + Math.sin(elapsed * spd) * (width * 0.34);
          stateRef.current.ty = height * 0.5 + Math.cos(elapsed * spd * 1.37) * (height * 0.3);
          const dx = stateRef.current.pointerX - stateRef.current.tx;
          const dy = stateRef.current.pointerY - stateRef.current.ty;
          stateRef.current.trackTotalFrames += 1;
          if (dx * dx + dy * dy <= baseRadius * baseRadius) {
            stateRef.current.trackInsideFrames += 1;
            stateRef.current.score += 2;
          }
        } else if (aimMode === 'speed') {
          const age = (now - stateRef.current.spawnAt) / 1000;
          const life = diff === 'easy' ? 1.9 : diff === 'med' ? 1.35 : 0.95;
          stateRef.current.tr = Math.max(5, baseRadius * (1 - age / life));
          if (age >= life) {
            stateRef.current.shots += 1;
            spawnTarget(width, height);
          }
        }

        // Render shaded 3D target sphere
        const { tx, ty, tr } = stateRef.current;
        const g = ctx.createRadialGradient(tx - tr * 0.32, ty - tr * 0.32, tr * 0.1, tx, ty, tr);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.28, aimMode === 'tracking' ? '#38bdf8' : '#f43f5e');
        g.addColorStop(1, aimMode === 'tracking' ? '#0369a1' : '#881337');
        ctx.beginPath();
        ctx.arc(tx, ty, tr, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();

        // Bullseye inner ring
        ctx.beginPath();
        ctx.arc(tx, ty, tr * 0.38, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const acc =
          aimMode === 'tracking'
            ? Math.round((stateRef.current.trackInsideFrames / Math.max(1, stateRef.current.trackTotalFrames)) * 100)
            : stateRef.current.shots > 0
            ? Math.round((stateRef.current.hits / stateRef.current.shots) * 100)
            : 100;

        setStats({
          score: stateRef.current.score,
          hits: acc,
          shots: stateRef.current.shots,
          secLeft: Math.ceil(rem),
        });

        if (rem <= 0 || (aimMode === 'precision' && stateRef.current.shots >= 20)) {
          setRunning(false);
          onSaveScore('aim_trainer_3d', stateRef.current.score);
          return;
        }
      } else {
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 14px var(--f-sans, sans-serif)';
        ctx.textAlign = 'center';
        ctx.fillText('Нажмите «Старт тренировки» или кликните по полю', width / 2, height / 2);
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [running, aimMode, diff, baseRadius]);

  const onCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (!running) {
      startAim();
      return;
    }
    if (aimMode === 'tracking') return;

    stateRef.current.shots += 1;
    const dx = x - stateRef.current.tx;
    const dy = y - stateRef.current.ty;
    const dist = Math.hypot(dx, dy);
    if (dist <= stateRef.current.tr) {
      stateRef.current.hits += 1;
      const centerBonus = Math.round((1 - dist / stateRef.current.tr) * 55);
      stateRef.current.score += 100 + centerBonus;
      playShortBeep(760, 0.04);
      spawnTarget(rect.width, rect.height);
    }
  };

  return (
    <div className="rounded-2xl border border-rose-500/30 bg-slate-900/80 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-rose-400" />
          <h3 className="text-sm sm:text-base font-bold text-white">3D Тренажёр Аима (Флики и Трекинг)</h3>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'flick', label: 'Флик-шот' },
            { id: 'tracking', label: 'Трекинг' },
            { id: 'speed', label: 'Скорость' },
            { id: 'precision', label: 'Точность (20)' },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setRunning(false);
                setAimMode(m.id as any);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                aimMode === m.id
                  ? 'bg-rose-500/25 border-rose-400 text-rose-200'
                  : 'bg-slate-950 border-white/10 text-slate-400'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex gap-1.5">
          {[
            { id: 'easy', label: 'Лёгкий (40px)' },
            { id: 'med', label: 'Средний (28px)' },
            { id: 'hard', label: 'Сложный (19px)' },
          ].map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                setRunning(false);
                setDiff(d.id as any);
              }}
              className={`px-2.5 py-1 rounded-lg border ${
                diff === d.id ? 'bg-white/15 border-white/30 text-white' : 'bg-slate-950 border-white/10 text-slate-400'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 font-mono">
          <span className="text-emerald-300 font-bold">Очки: {stats.score}</span>
          <span className="text-sky-300">Меткость: {stats.hits}%</span>
          <span className="text-amber-300">{stats.secLeft}с</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        style={{ height: 300 }}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          stateRef.current.pointerX = e.clientX - rect.left;
          stateRef.current.pointerY = e.clientY - rect.top;
        }}
        className="w-full rounded-2xl border border-white/15 bg-slate-950 cursor-crosshair touch-none"
      />

      <button
        type="button"
        onClick={() => (running ? setRunning(false) : startAim())}
        className="w-full py-2.5 rounded-xl glow-btn text-white text-xs font-bold"
      >
        {running ? 'Завершить досрочно' : 'Старт тренировки'}
      </button>
    </div>
  );
};

// ============================================================================
// 3. SCHULTE TABLES (5-SERIES ER/VR/PU) & STROOP ATTENTION TEST
// ============================================================================
const STROOP_COLORS = [
  { name: 'КРАСНЫЙ', hex: '#ef4444' },
  { name: 'СИНИЙ', hex: '#38bdf8' },
  { name: 'ЗЕЛЁНЫЙ', hex: '#22c55e' },
  { name: 'ЖЁЛТЫЙ', hex: '#eab308' },
];

const SchulteAndStroopView: React.FC<{ onSaveScore: (id: string, s: number) => void }> = ({ onSaveScore }) => {
  const [sub, setSub] = useState<'schulte' | 'stroop'>('schulte');
  const [size, setSize] = useState<3 | 4 | 5>(5);
  const [cells, setCells] = useState<number[]>([]);
  const [nextNum, setNextNum] = useState(1);
  const [tableStart, setTableStart] = useState<number | null>(null);
  const [seriesTimes, setSeriesTimes] = useState<number[]>([]);

  // Stroop state
  const [stroopRound, setStroopRound] = useState(0);
  const [stroopScore, setStroopScore] = useState(0);
  const [stroopPair, setStroopPair] = useState({ wordIdx: 0, inkIdx: 1 });

  const generateTable = (n = size) => {
    const arr = Array.from({ length: n * n }, (_, i) => i + 1);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setCells(arr);
    setNextNum(1);
    setTableStart(null);
  };

  useEffect(() => {
    generateTable(size);
  }, [size]);

  const onCellClick = (val: number) => {
    if (val !== nextNum) return;
    const now = performance.now();
    const started = nextNum === 1 ? now : tableStart || now;
    if (nextNum === 1) setTableStart(now);

    if (val === size * size) {
      const sec = Number(((now - started) / 1000).toFixed(2));
      const updated = [...seriesTimes, sec];
      setSeriesTimes(updated);
      if (updated.length < 5) {
        generateTable(size);
      } else {
        const avg = updated.reduce((a, b) => a + b, 0) / 5;
        onSaveScore('schulte_stroop', Math.max(100, Math.round(3000 / Math.max(5, avg))));
      }
    } else {
      setNextNum(val + 1);
    }
  };

  const er = seriesTimes.length ? seriesTimes.reduce((a, b) => a + b, 0) / seriesTimes.length : 0;
  const vr = seriesTimes.length >= 2 ? seriesTimes[0] / er : 0;
  const pu = seriesTimes.length >= 4 ? seriesTimes[3] / er : 0;

  const rollStroop = () => {
    const w = Math.floor(Math.random() * STROOP_COLORS.length);
    const ink = (w + 1 + Math.floor(Math.random() * (STROOP_COLORS.length - 1))) % STROOP_COLORS.length;
    setStroopPair({ wordIdx: w, inkIdx: ink });
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Grid className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm sm:text-base font-bold text-white">
            Таблицы Шульте (ЭР / ВР / ПУ) и Тест Струпа
          </h3>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setSub('schulte')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${
              sub === 'schulte' ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200' : 'bg-slate-950 border-white/10 text-slate-400'
            }`}
          >
            🔢 Таблицы Шульте
          </button>
          <button
            type="button"
            onClick={() => {
              setSub('stroop');
              setStroopRound(1);
              setStroopScore(0);
              rollStroop();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${
              sub === 'stroop' ? 'bg-indigo-500/20 border-indigo-400 text-indigo-200' : 'bg-slate-950 border-white/10 text-slate-400'
            }`}
          >
            🎨 Тест Струпа
          </button>
        </div>
      </div>

      {sub === 'schulte' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex gap-1.5">
                {([3, 4, 5] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setSize(s);
                      setSeriesTimes([]);
                    }}
                    className={`px-2.5 py-1 rounded-lg border font-mono ${
                      size === s ? 'bg-white/15 border-white/30 text-white' : 'bg-slate-950 border-white/10 text-slate-400'
                    }`}
                  >
                    {s}×{s}
                  </button>
                ))}
              </div>
              <span className="font-mono text-emerald-300 font-bold">
                Ищите: {nextNum} • Таблица {Math.min(5, seriesTimes.length + 1)}/5
              </span>
            </div>

            <div
              style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
              className="relative grid gap-1.5 max-w-md mx-auto"
            >
              {cells.map((v, idx) => (
                <button
                  key={idx}
                  type="button"
                  onPointerDown={() => onCellClick(v)}
                  className={`aspect-square rounded-xl border font-mono text-base sm:text-lg font-bold flex items-center justify-center select-none transition ${
                    v < nextNum
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300/50'
                      : 'bg-slate-950 hover:bg-slate-800 border-white/15 text-white active:scale-95'
                  }`}
                >
                  {v}
                </button>
              ))}
              {/* Center peripheral fixation dot */}
              <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-rose-500 shadow-lg shadow-rose-500/70" />
            </div>
          </div>

          <div className="lg:col-span-5 p-4 rounded-2xl bg-slate-950/85 border border-white/10 space-y-3 text-xs">
            <div className="font-bold text-white">Результаты классической серии (5 таблиц):</div>
            <div className="text-slate-400">
              Держите взгляд на красной точке в центре и ищите числа боковым зрением. Таймер запускается с нажатия «1».
            </div>
            {seriesTimes.length > 0 && (
              <div className="space-y-1.5 font-mono">
                <div className="text-slate-300">
                  Времена: {seriesTimes.map((t, i) => `#${i + 1}: ${t}с`).join(' | ')}
                </div>
                <div className="text-emerald-300">Эффективность работы (ЭР): {er.toFixed(2)} с</div>
                {seriesTimes.length >= 2 && (
                  <div className="text-sky-300">
                    Врабатываемость (ВР): {vr.toFixed(2)} {vr < 1 ? '(быстрый старт)' : '(нужна разминка)'}
                  </div>
                )}
                {seriesTimes.length >= 4 && (
                  <div className="text-amber-300">
                    Псих. устойчивость (ПУ): {pu.toFixed(2)} {pu < 1 ? '(высокая устойчивость)' : '(утомление к концу)'}
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setSeriesTimes([]);
                generateTable(size);
              }}
              className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Начать новую серию
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-lg mx-auto p-5 rounded-2xl bg-slate-950 border border-white/10 text-center space-y-4">
          <div className="text-xs text-slate-400">
            Выберите <b>ЦВЕТ БУКВ</b>, игнорируя написанное слово • Раунд {Math.min(20, stroopRound)}/20 • Верно:{' '}
            {stroopScore}
          </div>
          {stroopRound <= 20 ? (
            <>
              <div
                style={{ color: STROOP_COLORS[stroopPair.inkIdx].hex }}
                className="py-6 text-3xl sm:text-4xl font-display font-black tracking-wider select-none"
              >
                {STROOP_COLORS[stroopPair.wordIdx].name}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {STROOP_COLORS.map((c, idx) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => {
                      if (idx === stroopPair.inkIdx) setStroopScore((s) => s + 1);
                      setStroopRound((r) => r + 1);
                      rollStroop();
                    }}
                    className="py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-xs font-bold text-white"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="text-xl font-bold text-emerald-300">Точность когнитивного контроля: {stroopScore} / 20</div>
              <button
                type="button"
                onClick={() => {
                  setStroopRound(1);
                  setStroopScore(0);
                  rollStroop();
                }}
                className="px-5 py-2 rounded-xl glow-btn text-white text-xs font-bold"
              >
                Пройти ещё раз
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 4. 3D BREATHING & CALM BUTTON (4-4-4-4 / 4-7-8 / PHYSIOLOGICAL SIGH)
// ============================================================================
const BREATH_PROTOCOLS = [
  { id: 'box', title: 'Квадратное 4–4–4–4', phases: [4, 4, 4, 4], desc: 'Снятие острого стресса и возврат концентрации' },
  { id: '478', title: 'Сон и покой 4–7–8', phases: [4, 7, 8, 0], desc: 'Замедление пульса перед сном' },
  { id: 'sigh', title: 'Физиологический вздох', phases: [3, 1, 6, 0], desc: 'Быстрый сброс тревоги и паники за 60 секунд' },
];

const BreathCalm3DView: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [protoIdx, setProtoIdx] = useState(0);
  const [active, setActive] = useState(true);
  const [phaseLabel, setPhaseLabel] = useState('Вдох через нос');

  const proto = BREATH_PROTOCOLS[protoIdx];

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    let raf = 0;
    const t0 = performance.now();
    const totalCycle = proto.phases.reduce((a, b) => a + b, 0);

    const draw = (now: number) => {
      const { ctx, W: width, H: height } = syncHiDPICanvas(cvs);
      if (!ctx) return;
      ctx.fillStyle = '#050914';
      ctx.fillRect(0, 0, width, height);

      const elapsed = active ? ((now - t0) / 1000) % totalCycle : 0;
      const [inS, hold1S, outS] = proto.phases;
      let scale = 0.55;
      let label = 'Пауза';

      if (!active) {
        scale = 0.6;
        label = 'Нажмите Старт';
      } else if (elapsed < inS) {
        scale = 0.45 + 0.55 * (elapsed / inS);
        label = `Вдох (${Math.ceil(inS - elapsed)} с)`;
      } else if (elapsed < inS + hold1S) {
        scale = 1.0;
        label = `Задержка (${Math.ceil(inS + hold1S - elapsed)} с)`;
      } else if (elapsed < inS + hold1S + outS) {
        const p = (elapsed - inS - hold1S) / outS;
        scale = 1.0 - 0.55 * p;
        label = `Медленный выдох (${Math.ceil(inS + hold1S + outS - elapsed)} с)`;
      } else {
        scale = 0.45;
        label = `Пауза (${Math.ceil(totalCycle - elapsed)} с)`;
      }
      setPhaseLabel(label);

      const cx = width / 2;
      const cy = height / 2;
      const maxR = Math.min(width, height) * 0.36 * scale;

      const glow = ctx.createRadialGradient(cx, cy, maxR * 0.15, cx, cy, maxR * 1.45);
      glow.addColorStop(0, 'rgba(56,189,248,0.55)');
      glow.addColorStop(0.6, 'rgba(99,102,241,0.22)');
      glow.addColorStop(1, 'rgba(5,9,20,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * 1.45, 0, Math.PI * 2);
      ctx.fill();

      // 3D particle latitude rings on breathing sphere
      const rot = now * 0.0007;
      for (let i = 0; i < 64; i++) {
        const phi = Math.acos(1 - (2 * (i + 0.5)) / 64);
        const theta = Math.PI * (1 + Math.sqrt(5)) * i + rot;
        const x3 = Math.sin(phi) * Math.cos(theta);
        const y3 = Math.cos(phi);
        const z3 = Math.sin(phi) * Math.sin(theta);
        const depth = (z3 + 1.5) / 2.5;
        ctx.beginPath();
        ctx.arc(cx + x3 * maxR, cy + y3 * maxR, 1.5 + depth * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(186,230,253,${(0.25 + depth * 0.7).toFixed(2)})`;
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [proto, active]);

  return (
    <div className="rounded-2xl border border-sky-500/30 bg-slate-900/80 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HeartPulse className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm sm:text-base font-bold text-white">3D Дыхательный тренажёр и Кнопка спокойствия</h3>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {BREATH_PROTOCOLS.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setProtoIdx(idx)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                protoIdx === idx ? 'bg-sky-500/20 border-sky-400 text-sky-200' : 'bg-slate-950 border-white/10 text-slate-400'
              }`}
            >
              {p.title}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-400">{proto.desc}</p>

      <img
        src="/art/breathing_calm.gif"
        alt="Ритмическое дыхание антистресс"
        loading="lazy"
        className="w-full max-h-28 object-contain rounded-xl border border-teal-500/25 bg-[#070f1a]"
      />

      <div className="relative">
        <canvas
          ref={canvasRef}
          style={{ height: 250 }}
          className="w-full rounded-2xl border border-white/10 bg-slate-950"
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="px-4 py-1.5 rounded-full bg-slate-950/75 border border-sky-400/30 text-sm font-display font-bold text-white">
            {phaseLabel}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setActive((v) => !v)}
        className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white"
      >
        {active ? 'Поставить дыхательный гид на паузу' : 'Возобновить дыхательный ритм'}
      </button>
    </div>
  );
};

// ============================================================================
// MAIN BRAIN & REFLEX HUB EXPORT
// ============================================================================
export const BrainReflexHub: React.FC<Props> = ({ activeTool, onSync, onToast }) => {
  const saveScore = async (gameId: string, score: number) => {
    try {
      const r = await apiPost('/api/v2/games/score', { game_id: gameId, score });
      onSync();
      onToast(`Результат сохранён (+${r.xp_earned} XP)`);
    } catch (e: any) {
      onToast(e.message || 'Ошибка сохранения');
    }
  };

  return (
    <div className="space-y-4 min-w-0">
      {activeTool === 'reaction_cps_lab' && <ReactionAndCpsView onSaveScore={saveScore} />}
      {activeTool === 'aim_trainer_3d' && <AimTrainer3DView onSaveScore={saveScore} />}
      {activeTool === 'schulte_stroop' && <SchulteAndStroopView onSaveScore={saveScore} />}
      {activeTool === 'breath_panic_calm' && <BreathCalm3DView />}
      {!['reaction_cps_lab', 'aim_trainer_3d', 'schulte_stroop', 'breath_panic_calm'].includes(activeTool) && (
        <ReactionAndCpsView onSaveScore={saveScore} />
      )}
    </div>
  );
};
