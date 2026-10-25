import React, { useEffect, useRef, useState } from 'react';
import { Fingerprint, HelpCircle, Mic, Plus, RefreshCw, Sparkles, Timer, Trash2 } from 'lucide-react';
import { apiGet } from '../../lib/api';
import { syncHiDPICanvas } from '../../lib/engine3d';

function popBubbleSound(freq = 540) {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.055);
    g.gain.setValueAtTime(0.28, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.065);
    setTimeout(() => ctx.close().catch(() => {}), 250);
  } catch {}
}

// ============================================================================
// 1. PRANK LIE DETECTOR + VOICE TENSION METER + PARTY QUESTIONS
// ============================================================================
export const LieDetectorPartyView: React.FC<{ onToast: (m: string) => void }> = ({ onToast }) => {
  const [scanning, setScanning] = useState(false);
  const [verdict, setVerdict] = useState<'truth' | 'lie' | null>(null);
  const [riggedMode, setRiggedMode] = useState<'random' | 'truth' | 'lie'>('random');
  const [showHostSecret, setShowHostSecret] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [qIdx, setQIdx] = useState(0);

  // Voice tremor / excitement meter
  const [micActive, setMicActive] = useState(false);
  const [tensionPct, setTensionPct] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const holdTimerRef = useRef<number | null>(null);

  useEffect(() => {
    apiGet('/api/v2/timbrica/lie-questions?category=all')
      .then((r) => setQuestions(r.questions || []))
      .catch(() => {});
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    };
  }, []);

  // Secret keyboard shortcuts 1 = Truth, 2 = Lie, 0 = Random
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '1') setRiggedMode('truth');
      else if (e.key === '2') setRiggedMode('lie');
      else if (e.key === '0') setRiggedMode('random');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const beginHoldScan = () => {
    setVerdict(null);
    setScanning(true);
    popBubbleSound(720);
    holdTimerRef.current = window.setTimeout(() => {
      setScanning(false);
      const res: 'truth' | 'lie' =
        riggedMode === 'truth' ? 'truth' : riggedMode === 'lie' ? 'lie' : Math.random() < 0.5 ? 'truth' : 'lie';
      setVerdict(res);
      popBubbleSound(res === 'truth' ? 980 : 220);
    }, 1850);
  };

  const cancelHoldScan = () => {
    if (scanning) {
      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
      setScanning(false);
    }
  };

  const toggleVoiceTension = async () => {
    if (micActive) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setMicActive(false);
      setTensionPct(0);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      src.connect(an);
      setMicActive(true);
      const buf = new Float32Array(an.fftSize);
      let prevRms = 0;

      const tick = () => {
        if (!streamRef.current) {
          ctx.close().catch(() => {});
          return;
        }
        an.getFloatTimeDomainData(buf);
        let sq = 0;
        let zeroCross = 0;
        for (let i = 1; i < buf.length; i++) {
          sq += buf[i] * buf[i];
          if ((buf[i - 1] >= 0 && buf[i] < 0) || (buf[i - 1] < 0 && buf[i] >= 0)) zeroCross++;
        }
        const rms = Math.sqrt(sq / buf.length);
        const jitter = Math.abs(rms - prevRms) * 340 + (zeroCross / buf.length) * 85;
        prevRms = rms;
        const score = rms < 0.008 ? 8 : Math.min(99, Math.round(rms * 280 + jitter));
        setTensionPct(score);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch {
      onToast('Для индикатора волнения голоса разрешите микрофон');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <div className="lg:col-span-7 rounded-2xl border border-orange-500/30 bg-slate-900/80 p-5 space-y-4 text-center">
        <div className="flex items-center justify-between text-left">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white">🕵️ Шуточный Детектор Лжи</h3>
            <p className="text-[11px] text-slate-400">
              Игровой розыгрыш для компании (не является настоящим полиграфом)
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowHostSecret((s) => !s)}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-slate-400"
          >
            🤫 Секрет ведущего
          </button>
        </div>

        {showHostSecret && (
          <div className="p-3 rounded-xl bg-slate-950 border border-amber-400/35 text-left space-y-2 text-xs">
            <div className="text-amber-300 font-semibold">
              Незаметный режим ответа (также клавиши 1 — Правда, 2 — Ложь, 0 — Случайно):
            </div>
            <div className="flex gap-2">
              {[
                { id: 'random', label: '🎲 Честный рандом' },
                { id: 'truth', label: '✅ Всегда ПРАВДА' },
                { id: 'lie', label: '🚨 Всегда ЛОЖЬ' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setRiggedMode(m.id as any)}
                  className={`px-2.5 py-1 rounded-lg border text-xs ${
                    riggedMode === m.id ? 'bg-amber-500/25 border-amber-400 text-white' : 'bg-slate-900 border-white/10 text-slate-400'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="py-3 flex flex-col items-center justify-center">
          <button
            type="button"
            onPointerDown={beginHoldScan}
            onPointerUp={cancelHoldScan}
            onPointerLeave={cancelHoldScan}
            className={`relative w-40 h-40 rounded-full border-4 flex flex-col items-center justify-center select-none transition-all ${
              scanning
                ? 'border-cyan-400 bg-cyan-500/20 scale-105 shadow-2xl shadow-cyan-500/30'
                : verdict === 'truth'
                ? 'border-emerald-400 bg-emerald-500/25 shadow-2xl shadow-emerald-500/30'
                : verdict === 'lie'
                ? 'border-rose-500 bg-rose-500/25 shadow-2xl shadow-rose-500/35'
                : 'border-white/20 bg-slate-950 hover:border-orange-400/60'
            }`}
          >
            <Fingerprint
              className={`w-16 h-16 ${
                scanning
                  ? 'text-cyan-300 animate-pulse'
                  : verdict === 'truth'
                  ? 'text-emerald-300'
                  : verdict === 'lie'
                  ? 'text-rose-400'
                  : 'text-slate-400'
              }`}
            />
            <span className="text-[11px] font-mono text-slate-200 mt-2">
              {scanning ? 'СКАНИРОВАНИЕ…' : 'УДЕРЖИВАЙТЕ ПАЛЕЦ'}
            </span>
          </button>

          {verdict && (
            <div
              className={`mt-4 px-5 py-2 rounded-xl font-display font-black text-lg ${
                verdict === 'truth'
                  ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-300'
                  : 'bg-rose-500/20 border border-rose-500 text-rose-300'
              }`}
            >
              {verdict === 'truth' ? '✅ ВЕРДИКТ: ЧИСТАЯ ПРАВДА' : '🚨 ВЕРДИКТ: ОБНАРУЖЕНА ЛОЖЬ!'}
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-5 space-y-4">
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Mic className="w-4 h-4 text-rose-400" /> Индикатор волнения в голосе
            </span>
            <span className="font-mono text-sm font-bold text-amber-300">{micActive ? `${tensionPct}%` : 'Выкл'}</span>
          </div>
          <div className="h-3 rounded-full bg-slate-950 overflow-hidden border border-white/10">
            <div
              style={{ width: `${tensionPct}%` }}
              className={`h-full transition-all duration-150 ${
                tensionPct > 70 ? 'bg-rose-500' : tensionPct > 40 ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
            />
          </div>
          <button
            type="button"
            onClick={toggleVoiceTension}
            className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white"
          >
            {micActive ? 'Отключить микрофон' : 'Слушать дрожь и громкость голоса'}
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-sky-400" /> Каверзный вопрос допроса
            </span>
            <button
              type="button"
              onClick={() => setQIdx((i) => (i + 1) % Math.max(1, questions.length))}
              className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-200 text-xs flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Другой
            </button>
          </div>
          <p className="text-sm text-slate-100 leading-relaxed">
            {questions[qIdx] || 'Говорил(а) ли ты «я уже выхожу», лёжа при этом в кровати?'}
          </p>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. FORTUNE WHEEL, 20-SIDED MAGIC 8-BALL & ANTISTRESS BUBBLE WRAP
// ============================================================================
const MAGIC_20_ANSWERS = [
  'Бесспорно', 'Предрешено', 'Никаких сомнений', 'Определённо да', 'Можешь быть уверен',
  'Мне кажется — да', 'Вероятнее всего', 'Хорошие перспективы', 'Знаки говорят — да', 'Да',
  'Пока не ясно, попробуй снова', 'Спроси позже', 'Лучше не рассказывать сейчас', 'Сконцентрируйся и спроси опять', 'Даже не думай',
  'Мой ответ — нет', 'По моим данным — нет', 'Перспективы не очень', 'Весьма сомнительно', 'Исключено',
];

export const FortuneWheel8BallBubbleView: React.FC = () => {
  const wheelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [options, setOptions] = useState<string[]>([
    'Пицца', 'Роллы и суши', 'Бургеры', 'Шаурма', 'Паста', 'Готовим дома',
  ]);
  const [newOpt, setNewOpt] = useState('');
  const [angle, setAngle] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const [ballAns, setBallAns] = useState<string>('Задайте вопрос и нажмите на шар');
  const [bubbles, setBubbles] = useState<boolean[]>(() => Array(36).fill(false));

  useEffect(() => {
    const cvs = wheelCanvasRef.current;
    if (!cvs) return;
    const { ctx, W: width, H: height } = syncHiDPICanvas(cvs);
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.min(cx, cy) - 10;
    const n = Math.max(1, options.length);
    const palette = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#0ea5e9', '#8b5cf6', '#f43f5e'];

    for (let i = 0; i < n; i++) {
      const a0 = angle + (i * 2 * Math.PI) / n;
      const a1 = angle + ((i + 1) * 2 * Math.PI) / n;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a0, a1);
      ctx.closePath();
      ctx.fillStyle = palette[i % palette.length];
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((a0 + a1) / 2);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px var(--f-sans, sans-serif)';
      ctx.textAlign = 'right';
      ctx.fillText(options[i].slice(0, 16), r - 12, 4);
      ctx.restore();
    }

    // Top pointer arrow
    ctx.beginPath();
    ctx.moveTo(width - 4, cy - 8);
    ctx.lineTo(width - 4, cy + 8);
    ctx.lineTo(width - 20, cy);
    ctx.closePath();
    ctx.fillStyle = '#facc15';
    ctx.fill();
  }, [options, angle]);

  const spinWheel = () => {
    if (options.length < 2) return;
    setWinner(null);
    const start = angle;
    const extra = Math.PI * 8 + Math.random() * Math.PI * 6;
    const t0 = performance.now();
    const dur = 2600;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const ease = 1 - Math.pow(1 - p, 3);
      const cur = start + extra * ease;
      setAngle(cur);
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        const norm = ((2 * Math.PI - (cur % (2 * Math.PI))) + 2 * Math.PI) % (2 * Math.PI);
        const idx = Math.floor((norm / (2 * Math.PI)) * options.length) % options.length;
        setWinner(options[idx]);
        popBubbleSound(880);
      }
    };
    requestAnimationFrame(step);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Fortune Wheel */}
      <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">🎡 Колесо Фортуны</h3>
          {winner && (
            <span className="px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-400 text-xs font-bold text-amber-200">
              Выпало: {winner}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <canvas
            ref={wheelCanvasRef}
            style={{ height: 220 }}
            onClick={spinWheel}
            className="w-full cursor-pointer"
          />

          <div className="space-y-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newOpt.trim()) return;
                setOptions((o) => [...o, newOpt.trim()]);
                setNewOpt('');
              }}
              className="flex gap-1.5"
            >
              <input
                value={newOpt}
                onChange={(e) => setNewOpt(e.target.value)}
                placeholder="Добавить вариант..."
                className="flex-1 rounded-xl bg-slate-950 border border-white/10 px-2.5 py-1.5 text-xs text-white"
              />
              <button type="submit" className="p-2 rounded-xl bg-indigo-500 text-white">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </form>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {options.map((o, i) => (
                <div key={i} className="px-2.5 py-1 rounded-lg bg-slate-950 flex items-center justify-between text-xs text-slate-200">
                  <span className="truncate">{o}</span>
                  <button
                    type="button"
                    onClick={() => setOptions((arr) => arr.filter((_, k) => k !== i))}
                    className="text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={spinWheel}
              className="w-full py-2 rounded-xl glow-btn text-white text-xs font-bold"
            >
              Крутить колесо!
            </button>
          </div>
        </div>
      </div>

      {/* Magic 8 Ball + Bubble Wrap */}
      <div className="lg:col-span-5 space-y-4">
        <div className="rounded-2xl border border-indigo-500/30 bg-slate-900/80 p-4 text-center space-y-3">
          <div className="text-xs font-bold text-white flex items-center justify-center gap-1.5">
            <Sparkles className="w-4 h-4 text-indigo-400" /> Магический Шар 8 (20 граней ответа)
          </div>
          <button
            type="button"
            onClick={() => {
              const buf = new Uint32Array(1);
              crypto.getRandomValues(buf);
              setBallAns(MAGIC_20_ANSWERS[buf[0] % MAGIC_20_ANSWERS.length]);
              popBubbleSound(420);
            }}
            className="mx-auto w-32 h-32 rounded-full bg-radial from-indigo-900 via-slate-950 to-black border-2 border-indigo-400/50 shadow-xl flex items-center justify-center p-3 active:scale-95 transition"
          >
            <span className="text-xs font-bold text-indigo-200 leading-snug">{ballAns}</span>
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white">🫧 Пузырчатая плёнка (Антистресс)</span>
            <button
              type="button"
              onClick={() => setBubbles(Array(36).fill(false))}
              className="text-sky-300 hover:underline"
            >
              Новый лист
            </button>
          </div>
          <div className="grid grid-cols-9 gap-1.5">
            {bubbles.map((popped, i) => (
              <button
                key={i}
                type="button"
                onPointerDown={() => {
                  if (popped) return;
                  popBubbleSound(480 + (i % 7) * 45);
                  setBubbles((b) => {
                    const next = [...b];
                    next[i] = true;
                    return next.every(Boolean) ? Array(36).fill(false) : next;
                  });
                }}
                className={`aspect-square rounded-full border transition ${
                  popped
                    ? 'bg-slate-950/60 border-white/5 scale-90'
                    : 'bg-gradient-to-br from-sky-300/40 to-indigo-500/30 border-sky-200/40 shadow-inner active:scale-75'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. CROCODILE / CHARADES / ALIAS PARTY WORD GENERATOR WITH ROUND TIMER
// ============================================================================
export const CrocoWordsGameView: React.FC = () => {
  const [level, setLevel] = useState<'all' | 'easy' | 'medium' | 'hard' | 'actions'>('all');
  const [words, setWords] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [roundSec, setRoundSec] = useState(60);
  const [timeLeft, setTimeLeft] = useState(60);
  const [running, setRunning] = useState(false);
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [teamTurn, setTeamTurn] = useState<0 | 1>(0);

  const loadPack = (lvl = level) => {
    apiGet(`/api/v2/timbrica/croco?level=${lvl}&count=20`)
      .then((r) => {
        setWords(r.words || []);
        setIdx(0);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadPack(level);
  }, [level]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          setRunning(false);
          popBubbleSound(200);
          setTeamTurn((t) => (t === 0 ? 1 : 0));
          return roundSec;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, roundSec]);

  const nextWord = (guessed: boolean) => {
    if (guessed) {
      popBubbleSound(860);
      setScores((sc) => (teamTurn === 0 ? [sc[0] + 1, sc[1]] : [sc[0], sc[1] + 1]));
    }
    if (idx + 1 >= words.length) {
      loadPack(level);
    } else {
      setIdx((i) => i + 1);
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/80 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm sm:text-base font-bold text-white">
          🐊 Слова для «Крокодила», Шарад и Шляпы
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'all', label: 'Все' },
            { id: 'easy', label: '🟢 Лёгкие' },
            { id: 'medium', label: '🟡 Средние' },
            { id: 'hard', label: '🔴 Сложные' },
            { id: 'actions', label: '🎭 Действия' },
          ].map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLevel(l.id as any)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                level === l.id ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200' : 'bg-slate-950 border-white/10 text-slate-400'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
        <div className={`p-2.5 rounded-xl border ${teamTurn === 0 ? 'bg-indigo-500/20 border-indigo-400 text-white' : 'bg-slate-950 border-white/10 text-slate-400'}`}>
          Команда 1: <b>{scores[0]}</b>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-400/30 text-amber-300 font-bold flex items-center justify-center gap-1.5">
          <Timer className="w-4 h-4" />
          <button
            type="button"
            onClick={() => {
              const next = roundSec === 60 ? 90 : roundSec === 90 ? 30 : 60;
              setRoundSec(next);
              setTimeLeft(next);
              setRunning(false);
            }}
            title="Нажмите для смены длительности раунда (30/60/90 сек)"
          >
            {timeLeft} с
          </button>
        </div>
        <div className={`p-2.5 rounded-xl border ${teamTurn === 1 ? 'bg-indigo-500/20 border-indigo-400 text-white' : 'bg-slate-950 border-white/10 text-slate-400'}`}>
          Команда 2: <b>{scores[1]}</b>
        </div>
      </div>

      <div
        onClick={() => setHidden((h) => !h)}
        className="p-8 rounded-2xl bg-slate-950 border border-white/15 text-center cursor-pointer select-none space-y-2"
      >
        <div className="text-2xl sm:text-3xl font-display font-black text-white">
          {hidden ? '🙈 Слово скрыто от зрителей (нажмите)' : words[idx] || 'Космонавт'}
        </div>
        <div className="text-[11px] text-slate-400">
          Нажмите по карточке, чтобы спрятать слово перед передачей телефона
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => {
            if (!running) {
              setTimeLeft(roundSec);
              setRunning(true);
            } else {
              setRunning(false);
            }
          }}
          className="py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white"
        >
          {running ? 'Пауза таймера' : `Старт (${roundSec}с)`}
        </button>
        <button
          type="button"
          onClick={() => nextWord(false)}
          className="py-2.5 rounded-xl bg-rose-500/20 border border-rose-400/40 text-xs font-bold text-rose-200"
        >
          Пропустить →
        </button>
        <button
          type="button"
          onClick={() => nextWord(true)}
          className="py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-black"
        >
          ✓ Угадано (+1)
        </button>
      </div>
    </div>
  );
};
