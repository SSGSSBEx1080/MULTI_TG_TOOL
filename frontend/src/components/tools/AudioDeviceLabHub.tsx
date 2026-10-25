import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Download,
  Ear,
  Gamepad2,
  Maximize2,
  Mic,
  Monitor,
  Mouse,
  Music,
  Pause,
  Play,
  Volume2,
  Waves,
} from 'lucide-react';
import { syncHiDPICanvas } from '../../lib/engine3d';

interface Props {
  activeTool: string;
  onSelectTool?: (t: string) => void;
  onToast: (msg: string) => void;
}

function getSharedAudioCtx(ref: React.MutableRefObject<AudioContext | null>): AudioContext {
  if (!ref.current || ref.current.state === 'closed') {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    ref.current = new Ctx();
  }
  if (ref.current.state === 'suspended') {
    ref.current.resume().catch(() => {});
  }
  return ref.current;
}

// ============================================================================
// 1. SPEAKER WATER CLEANER (165 Hz) & STEREO / SUBWOOFER TEST
// ============================================================================
const SpeakerCleanerView: React.FC<{ onToast: (m: string) => void }> = ({ onToast }) => {
  const ctxRef = useRef<AudioContext | null>(null);
  const stopFnRef = useRef<(() => void) | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [mode, setMode] = useState<'water165' | 'dust_sweep' | 'sub_bass'>('water165');
  const [playing, setPlaying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [activeChan, setActiveChan] = useState<string | null>(null);

  const stopSound = () => {
    stopFnRef.current?.();
    stopFnRef.current = null;
    setPlaying(false);
    setActiveChan(null);
  };

  useEffect(() => {
    return () => {
      stopSound();
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  // Countdown during cleaning cycle
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          stopSound();
          onToast('Цикл акустической очистки завершён!');
          return 30;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [playing, onToast]);

  // HiDPI 3D standing acoustic wave visualizer
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    let raf = 0;
    let phase = 0;
    const render = () => {
      const { ctx, W: width, H: height } = syncHiDPICanvas(cvs);
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      const grad = ctx.createRadialGradient(width / 2, height / 2, 10, width / 2, height / 2, width * 0.55);
      grad.addColorStop(0, playing ? 'rgba(6,182,212,0.22)' : 'rgba(15,23,42,0.5)');
      grad.addColorStop(1, 'rgba(6,9,19,0.95)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      phase += playing ? 0.14 : 0.025;
      const cx = width / 2;
      const cy = height / 2;
      const rings = 7;
      for (let r = 1; r <= rings; r++) {
        const baseR = r * (Math.min(width, height) * 0.062);
        const pulse = playing ? Math.sin(phase * 2.2 - r * 0.7) * 9 : Math.sin(phase - r * 0.4) * 2;
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 0.05; a += 0.08) {
          const ripple = playing ? Math.cos(a * 6 + phase * 1.8) * 3.5 : 0;
          const rad = Math.max(4, baseR + pulse + ripple);
          const x = cx + Math.cos(a) * rad;
          const y = cy + Math.sin(a) * rad * 0.82;
          if (a === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = playing
          ? `rgba(34,211,238,${(0.75 - r * 0.08).toFixed(2)})`
          : `rgba(148,163,184,${(0.28 - r * 0.03).toFixed(2)})`;
        ctx.lineWidth = playing ? 2.2 : 1.2;
        ctx.stroke();
      }

      // Ejected water droplets animation when active
      if (playing) {
        for (let i = 0; i < 14; i++) {
          const ang = (i / 14) * Math.PI * 2 + phase * 0.25;
          const dist = ((phase * 28 + i * 19) % (Math.min(width, height) * 0.46)) + 16;
          const dx = cx + Math.cos(ang) * dist;
          const dy = cy + Math.sin(ang) * dist * 0.82;
          ctx.beginPath();
          ctx.arc(dx, dy, 2.6, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(125,211,252,0.85)';
          ctx.fill();
        }
      }

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '600 12px var(--f-mono, monospace)';
      ctx.textAlign = 'center';
      ctx.fillText(
        playing
          ? mode === 'water165'
            ? `ВЫБРОС ВОДЫ • 165 Гц • ${secondsLeft}с`
            : mode === 'dust_sweep'
            ? `ОЧИСТКА ОТ ПЫЛИ • 140–420 Гц • ${secondsLeft}с`
            : `ПРОГРЕВ САБВУФЕРА • 35–85 Гц • ${secondsLeft}с`
          : 'Положите телефон экраном вниз и прибавьте громкость до 90–100%',
        cx,
        height - 14
      );
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [playing, mode, secondsLeft]);

  const startCleaner = () => {
    stopSound();
    const ctx = getSharedAudioCtx(ctxRef);
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const master = ctx.createGain();

    if (mode === 'water165') {
      osc.type = 'sine';
      osc.frequency.value = 165;
      // Pulsed amplitude modulation helps dislodge water tension droplets
      lfo.type = 'square';
      lfo.frequency.value = 4.5;
      lfoGain.gain.value = 0.35;
      master.gain.value = 0.6;
      lfo.connect(lfoGain);
      lfoGain.connect(master.gain);
    } else if (mode === 'dust_sweep') {
      osc.type = 'sawtooth';
      osc.frequency.value = 260;
      lfo.type = 'triangle';
      lfo.frequency.value = 1.4;
      lfoGain.gain.value = 135;
      master.gain.value = 0.55;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
    } else {
      osc.type = 'sine';
      osc.frequency.value = 55;
      lfo.type = 'sine';
      lfo.frequency.value = 0.8;
      lfoGain.gain.value = 22;
      master.gain.value = 0.75;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
    }

    osc.connect(master);
    master.connect(ctx.destination);
    osc.start();
    lfo.start();
    setSecondsLeft(30);
    setPlaying(true);

    stopFnRef.current = () => {
      try {
        osc.stop();
        lfo.stop();
        osc.disconnect();
        master.disconnect();
      } catch {
        // ignore
      }
    };
  };

  const playChannelCheck = (chan: 'left' | 'right' | 'center' | 'phase') => {
    stopSound();
    const ctx = getSharedAudioCtx(ctxRef);
    setActiveChan(chan);

    const oscL = ctx.createOscillator();
    const gainL = ctx.createGain();
    oscL.type = 'sine';
    oscL.frequency.value = 440;
    gainL.gain.value = 0.35;

    if (chan === 'phase') {
      const merger = ctx.createChannelMerger(2);
      const oscR = ctx.createOscillator();
      const gainR = ctx.createGain();
      oscR.type = 'sine';
      oscR.frequency.value = 440;
      gainR.gain.value = -0.35; // 180 deg inverted phase!
      oscL.connect(gainL);
      oscR.connect(gainR);
      gainL.connect(merger, 0, 0);
      gainR.connect(merger, 0, 1);
      merger.connect(ctx.destination);
      oscL.start();
      oscR.start();
      stopFnRef.current = () => {
        try {
          oscL.stop();
          oscR.stop();
        } catch {}
      };
    } else {
      const panner = ctx.createStereoPanner();
      panner.pan.value = chan === 'left' ? -1 : chan === 'right' ? 1 : 0;
      oscL.connect(gainL);
      gainL.connect(panner);
      panner.connect(ctx.destination);
      oscL.start();
      stopFnRef.current = () => {
        try {
          oscL.stop();
        } catch {}
      };
    }

    setTimeout(() => {
      if (stopFnRef.current) stopSound();
    }, 2400);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <div className="lg:col-span-7 rounded-2xl border border-cyan-500/30 bg-slate-900/80 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Waves className="w-4 h-4 text-cyan-400" /> Очистка динамика от воды и пыли (165 Гц)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Резонансная стоячая волна выталкивает капли воды из сетки разговорного и основного динамика
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'water165', title: '💦 Вода (165 Гц)', sub: 'Импульсный резонанс' },
            { id: 'dust_sweep', title: '💨 Пыль (Свип)', sub: '140–420 Гц волна' },
            { id: 'sub_bass', title: '🔊 Сабвуфер', sub: 'Бас 35–85 Гц' },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                stopSound();
                setMode(m.id as any);
              }}
              className={`p-2.5 rounded-xl border text-left transition ${
                mode === m.id
                  ? 'bg-cyan-500/20 border-cyan-400/60 text-white'
                  : 'bg-slate-950/70 border-white/10 text-slate-300 hover:border-white/25'
              }`}
            >
              <div className="text-xs font-bold">{m.title}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{m.sub}</div>
            </button>
          ))}
        </div>

        <canvas
          ref={canvasRef}
          style={{ height: 210 }}
          className="w-full rounded-2xl border border-white/10 bg-slate-950"
        />

        <button
          type="button"
          onClick={() => (playing ? stopSound() : startCleaner())}
          className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition ${
            playing
              ? 'bg-rose-500/25 border border-rose-400/60 text-rose-200'
              : 'glow-btn text-white'
          }`}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {playing ? `Остановить очистку (${secondsLeft} с)` : 'Запустить 30-секундный цикл очистки'}
        </button>
      </div>

      <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-sky-400" /> Проверка наушников и стереоканалов
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Проверьте правильность посадки наушников L/R, баланс громкости и отсутствие системного моно-микширования
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {[
            { id: 'left', label: '⬅️ Левый канал (L)', desc: 'Звучит только слева' },
            { id: 'right', label: 'Правый канал (R) ➡️', desc: 'Звучит только справа' },
            { id: 'center', label: '🎯 Центр (Стерео)', desc: 'Одинаково в обоих ушах' },
            { id: 'phase', label: '〰️ Противофаза 180°', desc: 'Широкий «расфокус» звука' },
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => playChannelCheck(c.id as any)}
              className={`p-3 rounded-xl border text-left transition ${
                activeChan === c.id
                  ? 'bg-sky-500/25 border-sky-400 text-white'
                  : 'bg-slate-950/80 border-white/10 text-slate-200 hover:border-sky-400/40'
              }`}
            >
              <div className="text-xs font-bold">{c.label}</div>
              <div className="text-[10px] text-slate-400 mt-1">{c.desc}</div>
            </button>
          ))}
        </div>

        <div className="p-3 rounded-xl bg-slate-950/80 border border-white/10 text-[11px] text-slate-300 space-y-1.5 leading-relaxed">
          <div className="font-semibold text-cyan-300">Как диагностировать проблему:</div>
          <div>• Если «Левый канал» слышен в обоих наушниках — в настройках телефона/ПК включён режим «Моно-аудио».</div>
          <div>• После падения телефона в воду запустите 2–3 цикла на 165 Гц экраном вниз и промокните решётку сухой салфеткой.</div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. BINAURAL BEATS & PROCEDURAL COLOR NOISE MIXER (+ WAV EXPORT)
// ============================================================================
const BRAINWAVE_PRESETS = [
  { id: 'delta', name: 'Дельта • 2 Гц', base: 160, beat: 2, desc: 'Глубокий сон без сновидений и восстановление' },
  { id: 'theta', name: 'Тета • 6 Гц', base: 200, beat: 6, desc: 'Глубокая медитация и образное мышление' },
  { id: 'schumann', name: 'Шуман • 7.83 Гц', base: 210, beat: 7.83, desc: 'Резонанс Земли, спокойное заземление' },
  { id: 'alpha', name: 'Альфа • 10 Гц', base: 220, beat: 10, desc: 'Снятие тревоги и мягкая концентрация' },
  { id: 'beta', name: 'Бета • 20 Гц', base: 250, beat: 20, desc: 'Активное чтение, код и аналитическая работа' },
  { id: 'gamma', name: 'Гамма • 40 Гц', base: 280, beat: 40, desc: 'Пиковая когнитивная сборка и память' },
];

const BinauralAndNoiseView: React.FC<{ onToast: (m: string) => void }> = ({ onToast }) => {
  const ctxRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  const [baseHz, setBaseHz] = useState(210);
  const [beatHz, setBeatHz] = useState(7.83);
  const [isochronic, setIsochronic] = useState(false);
  const [noiseType, setNoiseType] = useState<'none' | 'white' | 'pink' | 'brown'>('brown');
  const [noiseVol, setNoiseVol] = useState(0.25);
  const [toneVol, setToneVol] = useState(0.35);
  const [playing, setPlaying] = useState(false);

  const stopAll = () => {
    stopRef.current?.();
    stopRef.current = null;
    setPlaying(false);
  };

  useEffect(() => {
    return () => {
      stopAll();
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  const buildNoiseBuffer = (ctx: AudioContext, kind: 'white' | 'pink' | 'brown') => {
    const len = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    let lastOut = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      if (kind === 'white') {
        data[i] = white * 0.35;
      } else if (kind === 'pink') {
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
        b6 = white * 0.115926;
      } else {
        const out = (lastOut + 0.02 * white) / 1.02;
        lastOut = out;
        data[i] = out * 1.4;
      }
    }
    return buffer;
  };

  const startSession = (
    nextBase = baseHz,
    nextBeat = beatHz,
    nextIso = isochronic,
    nextNoise = noiseType
  ) => {
    stopAll();
    const ctx = getSharedAudioCtx(ctxRef);
    const cleanups: (() => void)[] = [];

    if (nextIso) {
      // Isochronic pulses work even without headphones
      const osc = ctx.createOscillator();
      const pulseGain = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      osc.frequency.value = nextBase;
      pulseGain.gain.value = toneVol * 0.5;
      lfo.frequency.value = nextBeat;
      lfoGain.gain.value = toneVol * 0.5;
      lfo.connect(lfoGain);
      lfoGain.connect(pulseGain.gain);
      osc.connect(pulseGain);
      pulseGain.connect(ctx.destination);
      osc.start();
      lfo.start();
      cleanups.push(() => {
        osc.stop();
        lfo.stop();
      });
    } else {
      // True stereo binaural: Left = baseHz, Right = baseHz + beatHz
      const merger = ctx.createChannelMerger(2);
      const oscL = ctx.createOscillator();
      const oscR = ctx.createOscillator();
      const master = ctx.createGain();
      oscL.frequency.value = nextBase;
      oscR.frequency.value = nextBase + nextBeat;
      master.gain.value = toneVol;
      oscL.connect(merger, 0, 0);
      oscR.connect(merger, 0, 1);
      merger.connect(master);
      master.connect(ctx.destination);
      oscL.start();
      oscR.start();
      cleanups.push(() => {
        oscL.stop();
        oscR.stop();
      });
    }

    if (nextNoise !== 'none') {
      const src = ctx.createBufferSource();
      const nGain = ctx.createGain();
      src.buffer = buildNoiseBuffer(ctx, nextNoise);
      src.loop = true;
      nGain.gain.value = noiseVol;
      src.connect(nGain);
      nGain.connect(ctx.destination);
      src.start();
      cleanups.push(() => src.stop());
    }

    setPlaying(true);
    stopRef.current = () => {
      cleanups.forEach((fn) => {
        try {
          fn();
        } catch {}
      });
    };
  };

  const exportWav15Sec = () => {
    const sr = 22050;
    const secs = 15;
    const samples = sr * secs;
    const buf = new ArrayBuffer(44 + samples * 4); // 16-bit stereo
    const view = new DataView(buf);
    const writeStr = (off: number, s: string) => {
      for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + samples * 4, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 2, true);
    view.setUint32(24, sr, true);
    view.setUint32(28, sr * 4, true);
    view.setUint16(32, 4, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, samples * 4, true);

    let lastBrown = 0;
    for (let i = 0; i < samples; i++) {
      const t = i / sr;
      let n = 0;
      if (noiseType !== 'none') {
        const w = Math.random() * 2 - 1;
        lastBrown = (lastBrown + 0.02 * w) / 1.02;
        n = (noiseType === 'white' ? w * 0.25 : lastBrown * 1.1) * noiseVol;
      }
      const l = Math.sin(2 * Math.PI * baseHz * t) * toneVol + n;
      const r = Math.sin(2 * Math.PI * (baseHz + beatHz) * t) * toneVol + n;
      view.setInt16(44 + i * 4, Math.max(-1, Math.min(1, l)) * 32767, true);
      view.setInt16(44 + i * 4 + 2, Math.max(-1, Math.min(1, r)) * 32767, true);
    }

    const blob = new Blob([buf], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `binaural_${baseHz}Hz_${beatHz}Hz.wav`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    onToast('Стерео WAV-файл сохранён на устройство');
  };

  return (
    <div className="rounded-2xl border border-indigo-500/30 bg-slate-900/80 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-white">
            🧠 Генератор бинауральных ритмов и цветного шума
          </h3>
          <p className="text-xs text-slate-400">
            Левое ухо: <span className="font-mono text-cyan-300">{baseHz} Гц</span> • Правое ухо:{' '}
            <span className="font-mono text-cyan-300">{(baseHz + beatHz).toFixed(2)} Гц</span> • Ритм мозга:{' '}
            <span className="font-mono text-indigo-300">{beatHz} Гц</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              const next = !isochronic;
              setIsochronic(next);
              if (playing) startSession(baseHz, beatHz, next, noiseType);
            }}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
              isochronic
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                : 'bg-slate-950 border-white/10 text-slate-300'
            }`}
          >
            {isochronic ? 'Режим: Изохронный (динамики)' : 'Режим: Стерео (наушники)'}
          </button>
          <button
            type="button"
            onClick={exportWav15Sec}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> WAV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {BRAINWAVE_PRESETS.map((p) => {
          const act = Math.abs(beatHz - p.beat) < 0.05;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setBaseHz(p.base);
                setBeatHz(p.beat);
                startSession(p.base, p.beat, isochronic, noiseType);
              }}
              className={`p-2.5 rounded-xl border text-left transition ${
                act
                  ? 'bg-indigo-500/25 border-indigo-400 text-white'
                  : 'bg-slate-950/80 border-white/10 text-slate-300 hover:border-white/25'
              }`}
            >
              <div className="text-xs font-bold">{p.name}</div>
              <div className="text-[10px] text-slate-400 mt-1 line-clamp-2">{p.desc}</div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        <div className="p-3.5 rounded-xl bg-slate-950/75 border border-white/10 space-y-3">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300">Несущая частота (Solfeggio / тон)</span>
            <span className="font-mono text-cyan-300">{baseHz} Гц</span>
          </div>
          <input
            type="range"
            min={100}
            max={963}
            step={1}
            value={baseHz}
            onChange={(e) => {
              const v = Number(e.target.value);
              setBaseHz(v);
              if (playing) startSession(v, beatHz, isochronic, noiseType);
            }}
            className="w-full"
          />
          <div className="flex flex-wrap gap-1.5">
            {[174, 285, 396, 432, 528, 639, 852].map((hz) => (
              <button
                key={hz}
                type="button"
                onClick={() => {
                  setBaseHz(hz);
                  if (playing) startSession(hz, beatHz, isochronic, noiseType);
                }}
                className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[11px] font-mono text-slate-300"
              >
                {hz} Гц
              </button>
            ))}
          </div>

          <div className="flex justify-between text-xs pt-1">
            <span className="text-slate-300">Частота биений (Δf)</span>
            <span className="font-mono text-indigo-300">{beatHz} Гц</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={45}
            step={0.5}
            value={beatHz}
            onChange={(e) => {
              const v = Number(e.target.value);
              setBeatHz(v);
              if (playing) startSession(baseHz, v, isochronic, noiseType);
            }}
            className="w-full"
          />
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/75 border border-white/10 space-y-3">
          <div className="text-xs font-semibold text-slate-200">Фоновый шум для маскировки тишины</div>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { id: 'none', label: 'Выкл' },
              { id: 'brown', label: 'Коричн.' },
              { id: 'pink', label: 'Розовый' },
              { id: 'white', label: 'Белый' },
            ].map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  setNoiseType(n.id as any);
                  if (playing) startSession(baseHz, beatHz, isochronic, n.id as any);
                }}
                className={`py-1.5 rounded-lg text-xs font-medium border ${
                  noiseType === n.id
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                    : 'bg-slate-900 border-white/10 text-slate-400'
                }`}
              >
                {n.label}
              </button>
            ))}
          </div>

          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Громкость тона / шума</span>
            <span className="font-mono text-slate-300">
              {Math.round(toneVol * 100)}% / {Math.round(noiseVol * 100)}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="range"
              min={0.05}
              max={0.8}
              step={0.05}
              value={toneVol}
              onChange={(e) => setToneVol(Number(e.target.value))}
            />
            <input
              type="range"
              min={0}
              max={0.7}
              step={0.05}
              value={noiseVol}
              onChange={(e) => setNoiseVol(Number(e.target.value))}
            />
          </div>

          <button
            type="button"
            onClick={() => (playing ? stopAll() : startSession())}
            className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 ${
              playing ? 'bg-rose-500/25 border border-rose-400 text-rose-200' : 'glow-btn text-white'
            }`}
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {playing ? 'Остановить сеанс' : 'Запустить аудиосессию'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. HEARING AUDIOMETRY (125–18 000 Hz) & LIVE DECIBEL SOUND METER
// ============================================================================
const AUDIOMETRY_BANDS = [
  { hz: 250, label: '250 Гц', note: 'Низкие частоты и тембр речи' },
  { hz: 500, label: '500 Гц', note: 'Основа гласных звуков' },
  { hz: 1000, label: '1 кГц', note: 'Эталон аудиометрии ISO' },
  { hz: 2000, label: '2 кГц', note: 'Разборчивость согласных' },
  { hz: 4000, label: '4 кГц', note: 'Звонкие сибилянты' },
  { hz: 8000, label: '8 кГц', note: 'Верхние обертоны (норма до 60 лет)' },
  { hz: 12000, label: '12 кГц', note: 'Высокие частоты (норма до 45 лет)' },
  { hz: 15000, label: '15 кГц', note: 'Тонкий писк (норма до 30 лет)' },
  { hz: 17500, label: '17.5 кГц', note: 'Молодой слух (< 22 лет)' },
];

const HearingAndDecibelView: React.FC<{ onToast: (m: string) => void }> = ({ onToast }) => {
  const ctxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const specCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [heardMap, setHeardMap] = useState<Record<number, boolean>>({});
  const [customHz, setCustomHz] = useState(14000);
  const [micOn, setMicOn] = useState(false);
  const [dbNow, setDbNow] = useState(0);
  const [dbMax, setDbMax] = useState(0);

  const stopMic = () => {
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    setMicOn(false);
  };

  useEffect(() => {
    return () => {
      stopMic();
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  const playTestTone = (hz: number) => {
    const ctx = getSharedAudioCtx(ctxRef);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = hz;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
  };

  const toggleMicMeter = async () => {
    if (micOn) {
      stopMic();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const ctx = getSharedAudioCtx(ctxRef);
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      setMicOn(true);
      setDbMax(0);

      const timeBuf = new Float32Array(analyser.fftSize);
      const freqBuf = new Uint8Array(analyser.frequencyBinCount);

      const loop = () => {
        if (!micStreamRef.current) return;
        analyser.getFloatTimeDomainData(timeBuf);
        analyser.getByteFrequencyData(freqBuf);
        let sumSq = 0;
        for (let i = 0; i < timeBuf.length; i++) sumSq += timeBuf[i] * timeBuf[i];
        const rms = Math.sqrt(sumSq / timeBuf.length);
        // Calibrated approximate SPL dB for typical MEMS smartphone/laptop mics
        const approxDb = Math.max(22, Math.min(115, Math.round(20 * Math.log10(Math.max(rms, 1e-5)) + 100)));
        setDbNow(approxDb);
        setDbMax((m) => Math.max(m, approxDb));

        const cvs = specCanvasRef.current;
        if (cvs) {
          const { ctx: c, W: width, H: height } = syncHiDPICanvas(cvs);
          if (c) {
            c.fillStyle = '#050814';
            c.fillRect(0, 0, width, height);
            const bars = 32;
            const bw = width / bars;
            for (let b = 0; b < bars; b++) {
              const v = freqBuf[b * 2] / 255;
              const bh = Math.max(3, v * (height - 16));
              c.fillStyle = v > 0.7 ? '#f43f5e' : v > 0.4 ? '#38bdf8' : '#10b981';
              c.fillRect(b * bw + 2, height - bh - 4, Math.max(2, bw - 4), bh);
            }
          }
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } catch {
      onToast('Разрешите доступ к микрофону в браузере для замера дБ');
    }
  };

  const maxHeardHz = Math.max(0, ...Object.entries(heardMap).filter(([, ok]) => ok).map(([k]) => Number(k)));
  const hearingAgeLabel =
    maxHeardHz >= 17000
      ? 'Слух моложе 22 лет (отличный ВЧ-резерв)'
      : maxHeardHz >= 15000
      ? 'Возрастная норма ~25–32 года'
      : maxHeardHz >= 12000
      ? 'Возрастная норма ~35–45 лет'
      : maxHeardHz >= 8000
      ? 'Стандартный речевой и музыкальный диапазон'
      : 'Нажмите на карточки частот и отметьте слышимые тоны';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Ear className="w-4 h-4 text-emerald-400" /> Тональная проверка слуха (ISO 7029)
            </h3>
            <p className="text-xs text-slate-400">
              Нажмите «Слушать» на каждой частоте на умеренной громкости и отметьте «Слышу»
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {AUDIOMETRY_BANDS.map((b) => {
            const ok = heardMap[b.hz];
            return (
              <div
                key={b.hz}
                className={`p-2.5 rounded-xl border space-y-2 ${
                  ok ? 'bg-emerald-500/15 border-emerald-400/50' : 'bg-slate-950/80 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-white">{b.label}</span>
                  <button
                    type="button"
                    onClick={() => playTestTone(b.hz)}
                    className="px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/35 text-[11px] text-sky-200 font-semibold"
                  >
                    ▶ Тон
                  </button>
                </div>
                <div className="text-[10px] text-slate-400 leading-tight">{b.note}</div>
                <button
                  type="button"
                  onClick={() => setHeardMap((m) => ({ ...m, [b.hz]: !m[b.hz] }))}
                  className={`w-full py-1 rounded-lg text-[11px] font-semibold transition ${
                    ok ? 'bg-emerald-500 text-slate-950' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {ok ? '✓ Слышу отчётливо' : 'Отметить «Слышу»'}
                </button>
              </div>
            );
          })}
        </div>

        <div className="p-3 rounded-xl bg-slate-950/90 border border-emerald-500/25 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-emerald-300 font-semibold">{hearingAgeLabel}</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={100}
              max={19000}
              step={100}
              value={customHz}
              onChange={(e) => setCustomHz(Number(e.target.value))}
              className="w-28"
            />
            <button
              type="button"
              onClick={() => playTestTone(customHz)}
              className="px-2.5 py-1 rounded-lg bg-white/10 text-white font-mono"
            >
              ▶ {customHz} Гц
            </button>
          </div>
        </div>
      </div>

      <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Mic className="w-4 h-4 text-rose-400" /> Живой Шумомер (дБ) и Спектр
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Измерение уровня окружающего звука через микрофон устройства в реальном времени
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-xl bg-slate-950 border border-white/10 text-center">
            <div className="text-[10px] font-mono text-slate-400">ТЕКУЩИЙ ШУМ</div>
            <div className="text-2xl font-mono font-black text-white mt-0.5">{micOn ? `${dbNow} дБ` : '—'}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-white/10 text-center">
            <div className="text-[10px] font-mono text-slate-400">ПИК СЕССИИ</div>
            <div className="text-2xl font-mono font-black text-amber-300 mt-0.5">{micOn ? `${dbMax} дБ` : '—'}</div>
          </div>
        </div>

        <canvas
          ref={specCanvasRef}
          style={{ height: 115 }}
          className="w-full rounded-xl border border-white/10 bg-slate-950"
        />

        <div className="text-[11px] text-slate-400 space-y-1">
          <div>• 25–35 дБ — тихая спальня ночью / шёпот</div>
          <div>• 45–55 дБ — спокойный офис / обычная речь</div>
          <div>• 70–80 дБ — оживлённый проспект / пылесос</div>
          <div>• 85+ дБ — порог утомления слуха при долгом воздействии</div>
        </div>

        <button
          type="button"
          onClick={toggleMicMeter}
          className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 ${
            micOn ? 'bg-rose-500/25 border border-rose-400 text-rose-200' : 'glow-btn text-white'
          }`}
        >
          <Mic className="w-4 h-4" />
          {micOn ? 'Выключить микрофон' : 'Включить шумомер'}
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// 4. VIRTUAL PIANO, 17-TINE KALIMBA & TAP-BPM METRONOME
// ============================================================================
const PIANO_NOTES = [
  { note: 'C4', hz: 261.63, black: false, key: 'A' },
  { note: 'C#4', hz: 277.18, black: true, key: 'W' },
  { note: 'D4', hz: 293.66, black: false, key: 'S' },
  { note: 'D#4', hz: 311.13, black: true, key: 'E' },
  { note: 'E4', hz: 329.63, black: false, key: 'D' },
  { note: 'F4', hz: 349.23, black: false, key: 'F' },
  { note: 'F#4', hz: 369.99, black: true, key: 'T' },
  { note: 'G4', hz: 392.00, black: false, key: 'G' },
  { note: 'G#4', hz: 415.30, black: true, key: 'Y' },
  { note: 'A4', hz: 440.00, black: false, key: 'H' },
  { note: 'A#4', hz: 466.16, black: true, key: 'U' },
  { note: 'B4', hz: 493.88, black: false, key: 'J' },
  { note: 'C5', hz: 523.25, black: false, key: 'K' },
  { note: 'D5', hz: 587.33, black: false, key: 'L' },
  { note: 'E5', hz: 659.25, black: false, key: ';' },
];

const KALIMBA_TINES = [
  { label: 'D6', hz: 1174.66, h: 52 },
  { label: 'B5', hz: 987.77, h: 60 },
  { label: 'G5', hz: 783.99, h: 68 },
  { label: 'E5', hz: 659.25, h: 76 },
  { label: 'C5', hz: 523.25, h: 86 },
  { label: 'A4', hz: 440.0, h: 95 },
  { label: 'F4', hz: 349.23, h: 105 },
  { label: 'D4', hz: 293.66, h: 115 },
  { label: 'C4', hz: 261.63, h: 126 },
  { label: 'E4', hz: 329.63, h: 112 },
  { label: 'G4', hz: 392.0, h: 102 },
  { label: 'B4', hz: 493.88, h: 92 },
  { label: 'D5', hz: 587.33, h: 82 },
  { label: 'F5', hz: 698.46, h: 72 },
  { label: 'A5', hz: 880.0, h: 64 },
  { label: 'C6', hz: 1046.5, h: 56 },
  { label: 'E6', hz: 1318.51, h: 48 },
];

const MusicSynthStudioView: React.FC = () => {
  const ctxRef = useRef<AudioContext | null>(null);
  const [inst, setInst] = useState<'piano' | 'kalimba' | 'chiptune'>('piano');
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [bpm, setBpm] = useState(110);
  const [metroOn, setMetroOn] = useState(false);
  const [beatIdx, setBeatIdx] = useState(0);
  const tapTimesRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  const triggerNote = (hz: number, label: string, kalimbaBell = false) => {
    const ctx = getSharedAudioCtx(ctxRef);
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const gain = ctx.createGain();
    const overGain = ctx.createGain();

    if (kalimbaBell || inst === 'kalimba') {
      osc.type = 'sine';
      overtone.type = 'sine';
      overtone.frequency.value = hz * 6.2; // Metallic tine ping
      overGain.gain.setValueAtTime(0.08, now);
      overGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    } else if (inst === 'chiptune') {
      osc.type = 'square';
      overtone.type = 'square';
      overtone.frequency.value = hz * 2;
      overGain.gain.value = 0.03;
    } else {
      osc.type = 'triangle';
      overtone.type = 'sine';
      overtone.frequency.value = hz * 2;
      overGain.gain.setValueAtTime(0.12, now);
      overGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    }

    osc.frequency.value = hz;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.32, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 1.25);

    osc.connect(gain);
    overtone.connect(overGain);
    overGain.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    overtone.start(now);
    osc.stop(now + 1.3);
    overtone.stop(now + 1.3);

    setActiveNote(label);
    setTimeout(() => setActiveNote((cur) => (cur === label ? null : cur)), 200);
  };

  // Metronome loop
  useEffect(() => {
    if (!metroOn) return;
    let step = 0;
    const ms = Math.round(60000 / bpm);
    const tick = () => {
      const ctx = getSharedAudioCtx(ctxRef);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const accent = step % 4 === 0;
      osc.frequency.value = accent ? 1150 : 780;
      g.gain.setValueAtTime(accent ? 0.28 : 0.16, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.055);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
      setBeatIdx(step % 4);
      step++;
    };
    tick();
    const id = setInterval(tick, ms);
    return () => clearInterval(id);
  }, [metroOn, bpm]);

  const handleTapTempo = () => {
    const now = performance.now();
    const arr = [...tapTimesRef.current.filter((t) => now - t < 3000), now];
    tapTimesRef.current = arr;
    if (arr.length >= 2) {
      const diffs = arr.slice(1).map((t, i) => t - arr[i]);
      const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      setBpm(Math.max(40, Math.min(240, Math.round(60000 / avg))));
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm sm:text-base font-bold text-white">Виртуальное Пианино и 17-язычковая Калимба</h3>
          </div>
          <div className="flex gap-1.5">
            {[
              { id: 'piano', label: '🎹 Фортепиано' },
              { id: 'kalimba', label: '🪵 Калимба 17' },
              { id: 'chiptune', label: '👾 8-bit Чиптюн' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setInst(m.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  inst === m.id
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'bg-slate-950 border-white/10 text-slate-300'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {inst === 'kalimba' ? (
          <div className="p-4 rounded-2xl bg-gradient-to-b from-amber-950/60 to-slate-950 border border-amber-500/25 flex items-start justify-center gap-1 overflow-x-auto">
            {KALIMBA_TINES.map((t) => (
              <button
                key={t.label}
                type="button"
                onPointerDown={() => triggerNote(t.hz, t.label, true)}
                style={{ height: t.h + 44 }}
                className={`w-7 sm:w-8 shrink-0 rounded-b-xl border flex flex-col justify-end items-center pb-2 text-[10px] font-mono transition active:translate-y-1 ${
                  activeNote === t.label
                    ? 'bg-amber-300 text-slate-950 border-white shadow-lg shadow-amber-400/40'
                    : 'bg-gradient-to-b from-slate-300 to-slate-400 text-slate-900 border-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex gap-1 overflow-x-auto pb-2">
            {PIANO_NOTES.map((n) => (
              <button
                key={n.note}
                type="button"
                onPointerDown={() => triggerNote(n.hz, n.note)}
                className={`shrink-0 rounded-b-xl border flex flex-col justify-end items-center pb-2.5 transition select-none ${
                  n.black
                    ? activeNote === n.note
                      ? 'w-9 h-28 bg-cyan-400 text-slate-950 border-cyan-200 font-bold'
                      : 'w-9 h-28 bg-slate-950 text-slate-300 border-white/20 hover:bg-slate-800'
                    : activeNote === n.note
                    ? 'w-11 h-36 bg-cyan-300 text-slate-950 border-white font-bold'
                    : 'w-11 h-36 bg-slate-100 text-slate-900 border-slate-300 hover:bg-white'
                }`}
              >
                <span className="text-[11px] font-mono font-bold">{n.note}</span>
                <span className="text-[9px] opacity-60 mt-0.5">[{n.key}]</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quartz Metronome with Tap Tempo */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {[0, 1, 2, 3].map((b) => (
              <span
                key={b}
                className={`w-3.5 h-3.5 rounded-full transition ${
                  metroOn && beatIdx === b
                    ? b === 0
                      ? 'bg-amber-400 scale-125'
                      : 'bg-cyan-400 scale-110'
                    : 'bg-slate-800'
                }`}
              />
            ))}
          </div>
          <div>
            <div className="text-xs font-bold text-white">Метроном • {bpm} BPM</div>
            <div className="text-[11px] text-slate-400">Размер 4/4 с акцентом сильной доли</div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="range"
            min={40}
            max={220}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="w-32"
          />
          <button
            type="button"
            onClick={handleTapTempo}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white"
          >
            👆 Настучать BPM
          </button>
          <button
            type="button"
            onClick={() => setMetroOn((v) => !v)}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold ${
              metroOn ? 'bg-rose-500/25 border border-rose-400 text-rose-200' : 'glow-btn text-white'
            }`}
          >
            {metroOn ? 'Стоп' : 'Старт'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 5. DISPLAY HZ, DEAD PIXEL FULLSCREEN PATTERNS, MOUSE & GAMEPAD DRIFT TEST
// ============================================================================
const PIXEL_PATTERNS = [
  { name: 'Красный (Red)', bg: '#ff0000' },
  { name: 'Зелёный (Green)', bg: '#00ff00' },
  { name: 'Синий (Blue)', bg: '#0000ff' },
  { name: 'Белый (100%)', bg: '#ffffff' },
  { name: 'Чёрный (Засветы)', bg: '#000000' },
  { name: '50% Серый (OLED бандинг)', bg: '#7f7f7f' },
];

const DeviceScreenMouseGamepadView: React.FC<{ onToast: (m: string) => void }> = ({ onToast }) => {
  const [measuredHz, setMeasuredHz] = useState<number>(60);
  const [jitterMs, setJitterMs] = useState<number>(0);
  const [pixelIdx, setPixelIdx] = useState<number | null>(null);

  // Mouse tester state
  const [pressedBtns, setPressedBtns] = useState<Record<number, number>>({});
  const [doubleClickFaults, setDoubleClickFaults] = useState(0);
  const [wheelCount, setWheelCount] = useState(0);
  const lastLeftDownRef = useRef<number>(0);

  // Gamepad state
  const [gpInfo, setGpInfo] = useState<{ id: string; axes: number[]; pressed: number[]; driftPct: number } | null>(null);

  // Measure real refresh rate via rAF frame deltas
  useEffect(() => {
    let raf = 0;
    const stamps: number[] = [];
    const tick = (t: number) => {
      stamps.push(t);
      if (stamps.length > 65) stamps.shift();
      if (stamps.length >= 25) {
        const diffs = stamps.slice(1).map((v, i) => v - stamps[i]).filter((d) => d > 2 && d < 50);
        if (diffs.length > 10) {
          const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
          const variance = diffs.reduce((a, d) => a + (d - avg) ** 2, 0) / diffs.length;
          setMeasuredHz(Math.round(1000 / avg));
          setJitterMs(Number(Math.sqrt(variance).toFixed(2)));
        }
      }

      // Poll Gamepad API
      const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
      if (pads[0]) {
        const gp = pads[0]!;
        const axes = gp.axes.slice(0, 4).map((a) => Number(a.toFixed(3)));
        const pressed = gp.buttons
          .map((b, idx) => (b.pressed ? idx : -1))
          .filter((idx) => idx >= 0);
        const maxRestOffset = Math.max(...axes.map((a) => Math.abs(a)), 0);
        setGpInfo({
          id: gp.id,
          axes,
          pressed,
          driftPct: Math.round(maxRestOffset * 100),
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const vibrateGamepad = () => {
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
    const act = (pads[0] as any)?.vibrationActuator;
    if (act?.playEffect) {
      act.playEffect('dual-rumble', { duration: 450, strongMagnitude: 0.85, weakMagnitude: 0.65 });
      onToast('Импульс вибрации отправлен на геймпад');
    } else if (navigator.vibrate) {
      navigator.vibrate([120, 60, 180]);
      onToast('Виброотклик устройства выполнен');
    } else {
      onToast('Подключите геймпад и нажмите на нём любую кнопку');
    }
  };

  return (
    <div className="space-y-4">
      {pixelIdx !== null && (
        <div
          onClick={() => setPixelIdx((i) => (i === null ? null : (i + 1) % PIXEL_PATTERNS.length))}
          onContextMenu={(e) => {
            e.preventDefault();
            setPixelIdx(null);
          }}
          style={{ backgroundColor: PIXEL_PATTERNS[pixelIdx].bg }}
          className="fixed inset-0 z-50 cursor-pointer flex items-end justify-center p-5 select-none"
        >
          <div className="px-4 py-2 rounded-full bg-black/70 text-white text-xs font-mono flex items-center gap-3">
            <span>
              Паттерн {pixelIdx + 1}/{PIXEL_PATTERNS.length}: {PIXEL_PATTERNS[pixelIdx].name} (клик — следующий)
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPixelIdx(null);
              }}
              className="px-2.5 py-0.5 rounded-full bg-white/20 hover:bg-white/30 text-white font-bold"
            >
              Выйти
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Display Hz + Dead Pixels */}
        <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-slate-900/80 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Monitor className="w-4 h-4 text-cyan-400" /> Экран: Герцовка и Битые пиксели
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-950 border border-cyan-500/30">
              <div className="text-[10px] font-mono text-slate-400">ЧАСТОТА ЭКРАНА</div>
              <div className="text-2xl font-mono font-black text-cyan-300">{measuredHz} Гц</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-white/10">
              <div className="text-[10px] font-mono text-slate-400">ДЖИТТЕР КАДРА</div>
              <div className="text-2xl font-mono font-black text-white">{jitterMs} мс</div>
            </div>
          </div>
          <div className="text-xs text-slate-400">
            Разрешение: <span className="font-mono text-white">{window.screen.width}×{window.screen.height}</span> • DPR:{' '}
            <span className="font-mono text-white">{window.devicePixelRatio.toFixed(2)}x</span>
          </div>
          <button
            type="button"
            onClick={() => setPixelIdx(0)}
            className="w-full py-2.5 rounded-xl glow-btn text-white text-xs font-bold flex items-center justify-center gap-2"
          >
            <Maximize2 className="w-4 h-4" /> Запустить проверку на битые пиксели (6 цветов)
          </button>
        </div>

        {/* Mouse 5-button + Double-click fault detector */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            setPressedBtns((m) => ({ ...m, [e.button]: (m[e.button] || 0) + 1 }));
            if (e.button === 0) {
              const now = performance.now();
              if (now - lastLeftDownRef.current < 78) {
                setDoubleClickFaults((f) => f + 1);
              }
              lastLeftDownRef.current = now;
            }
          }}
          onContextMenu={(e) => e.preventDefault()}
          onWheel={() => setWheelCount((w) => w + 1)}
          className="lg:col-span-4 rounded-2xl border border-white/10 bg-slate-900/80 p-4 space-y-3 select-none"
        >
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Mouse className="w-4 h-4 text-indigo-400" /> Тест мыши и дабл-клика
          </div>
          <p className="text-[11px] text-slate-400">
            Кликайте внутри этой карточки ЛКМ, ПКМ, колесом и боковыми кнопками 4/5:
          </p>
          <div className="grid grid-cols-5 gap-1.5 text-center text-[11px] font-mono">
            {[
              { b: 0, n: 'ЛКМ' },
              { b: 1, n: 'Колесо' },
              { b: 2, n: 'ПКМ' },
              { b: 3, n: 'Бок 4' },
              { b: 4, n: 'Бок 5' },
            ].map((item) => (
              <div
                key={item.b}
                className={`p-2 rounded-lg border ${
                  pressedBtns[item.b]
                    ? 'bg-indigo-500/25 border-indigo-400 text-white'
                    : 'bg-slate-950 border-white/10 text-slate-500'
                }`}
              >
                <div>{item.n}</div>
                <div className="font-bold mt-0.5">{pressedBtns[item.b] || 0}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs pt-1">
            <span className="text-slate-400">Прокрутка: {wheelCount}</span>
            <span className={doubleClickFaults > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
              Дребезг (&lt;78 мс): {doubleClickFaults}
            </span>
          </div>
        </div>

        {/* Gamepad & Stick Drift */}
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-slate-900/80 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Gamepad2 className="w-4 h-4 text-emerald-400" /> Геймпад и Дрифт
          </div>
          {gpInfo ? (
            <div className="space-y-2 text-xs">
              <div className="text-emerald-300 font-semibold truncate">{gpInfo.id}</div>
              <div className="font-mono text-[11px] text-slate-300">
                Стик L: ({gpInfo.axes[0]}, {gpInfo.axes[1]})<br />
                Стик R: ({gpInfo.axes[2] ?? 0}, {gpInfo.axes[3] ?? 0})
              </div>
              <div className={gpInfo.driftPct > 7 ? 'text-amber-300 font-bold' : 'text-slate-400'}>
                Отклонение от центра: {gpInfo.driftPct}%
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 leading-relaxed">
              Подключите Xbox / DualSense / Switch Pro по USB или Bluetooth и нажмите любую кнопку.
            </p>
          )}
          <button
            type="button"
            onClick={vibrateGamepad}
            className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white flex items-center justify-center gap-1.5"
          >
            <Activity className="w-3.5 h-3.5" /> Тест вибрации
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN EXPORT: AUDIO, HEARING & DEVICE DIAGNOSTICS HUB
// ============================================================================
export const AudioDeviceLabHub: React.FC<Props> = ({ activeTool, onToast }) => {
  return (
    <div className="space-y-4 min-w-0">
      {activeTool === 'speaker_cleaner' && <SpeakerCleanerView onToast={onToast} />}
      {activeTool === 'binaural_noise' && <BinauralAndNoiseView onToast={onToast} />}
      {activeTool === 'hearing_sound_meter' && <HearingAndDecibelView onToast={onToast} />}
      {activeTool === 'music_synth_studio' && <MusicSynthStudioView />}
      {activeTool === 'device_screen_test' && <DeviceScreenMouseGamepadView onToast={onToast} />}
      {![
        'speaker_cleaner',
        'binaural_noise',
        'hearing_sound_meter',
        'music_synth_studio',
        'device_screen_test',
      ].includes(activeTool) && <SpeakerCleanerView onToast={onToast} />}
    </div>
  );
};
