import React, { useEffect, useRef, useState } from 'react';
import { Activity, Clock, Dumbbell, Flame, Moon, Play, RotateCcw, Star, Timer } from 'lucide-react';
import { apiPost } from '../../lib/api';

interface Props {
  activeTool: string;
  onSelectTool: (t: string) => void;
  favorites: string[];
  onToggleFav: (id: string) => void;
  onSync: () => void;
  onToast: (msg: string) => void;
}

type TabId = 'bmi_macros' | 'sleep_cycles' | 'workout_1rm' | 'running_pace' | 'fasting_pomodoro';

const PLATE_COLORS: Record<string, string> = {
  '25': '#ef4444',
  '20': '#2563eb',
  '15': '#eab308',
  '10': '#16a34a',
  '5': '#f8fafc',
  '2.5': '#94a3b8',
  '1.25': '#cbd5e1',
};

function playChime() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.14, ctx.currentTime + i * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.14 + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.14);
      osc.stop(ctx.currentTime + i * 0.14 + 0.46);
    });
  } catch {
    // ignore audio block
  }
}

export const HealthWellnessHub: React.FC<Props> = ({
  activeTool,
  onSelectTool,
  favorites,
  onToggleFav,
  onSync,
  onToast,
}) => {
  const [tab, setTab] = useState<TabId>(() =>
    (['bmi_macros', 'sleep_cycles', 'workout_1rm', 'running_pace', 'fasting_pomodoro'] as const).includes(activeTool as any)
      ? (activeTool as TabId)
      : 'bmi_macros'
  );

  useEffect(() => {
    if ((['bmi_macros', 'sleep_cycles', 'workout_1rm', 'running_pace', 'fasting_pomodoro'] as const).includes(activeTool as any)) {
      setTab(activeTool as TabId);
    }
  }, [activeTool]);

  // 1. BMI & Macros
  const [sex, setSex] = useState<'m' | 'f'>('m');
  const [age, setAge] = useState(25);
  const [heightCm, setHeightCm] = useState(178);
  const [weightKg, setWeightKg] = useState(75);
  const [activity, setActivity] = useState('moderate');
  const [goal, setGoal] = useState('maintain');
  const [bmiRes, setBmiRes] = useState<any>(null);

  // 2. Sleep Cycles
  const [sleepMode, setSleepMode] = useState<'wakeup' | 'bedtime'>('wakeup');
  const [sleepTime, setSleepTime] = useState('07:30');
  const [fallMin, setFallMin] = useState(14);
  const [sleepRes, setSleepRes] = useState<any>(null);

  // 3. 1RM & Barbell Plates
  const [liftKg, setLiftKg] = useState(85);
  const [liftReps, setLiftReps] = useState(5);
  const [barKg, setBarKg] = useState(20);
  const [rmRes, setRmRes] = useState<any>(null);

  // 4. Running Pace
  const [runDist, setRunDist] = useState(5);
  const [runMin, setRunMin] = useState(25);
  const [restHr, setRestHr] = useState(60);
  const [runRes, setRunRes] = useState<any>(null);

  // 5. Pomodoro & Fasting
  const [pomoPreset, setPomoPreset] = useState<'25/5' | '50/10' | 'tabata'>('25/5');
  const [pomoSeconds, setPomoSeconds] = useState(25 * 60);
  const [pomoRunning, setPomoRunning] = useState(false);
  const [fastProtocol, setFastProtocol] = useState<'16:8' | '18:6' | '20:4'>('16:8');
  const [fastStartHour, setFastStartHour] = useState(20);
  const timerRef = useRef<number | null>(null);

  const runBmi = async (silent = false) => {
    try {
      const r = await apiPost('/api/v2/v5/bmi-macros', {
        sex,
        age,
        height_cm: heightCm,
        weight_kg: weightKg,
        activity,
        goal,
      });
      setBmiRes(r);
      if (!silent) onSync();
    } catch (e: any) {
      if (!silent) onToast(e.message);
    }
  };

  const runSleep = async (overrideMode?: 'wakeup' | 'bedtime', overrideTime?: string) => {
    try {
      const r = await apiPost('/api/v2/v5/sleep-cycles', {
        mode: overrideMode || sleepMode,
        time_hhmm: overrideTime || sleepTime,
        fall_asleep_min: fallMin,
      });
      setSleepRes(r);
      onSync();
    } catch (e: any) {
      onToast(e.message);
    }
  };

  const run1Rm = async (silent = false) => {
    try {
      const r = await apiPost('/api/v2/v5/workout-1rm', {
        weight_kg: liftKg,
        reps: liftReps,
        bar_kg: barKg,
      });
      setRmRes(r);
      if (!silent) onSync();
    } catch (e: any) {
      if (!silent) onToast(e.message);
    }
  };

  const runPace = async (silent = false) => {
    try {
      const r = await apiPost('/api/v2/v5/running-pace', {
        distance_km: runDist,
        time_minutes: runMin,
        age,
        resting_hr: restHr,
      });
      setRunRes(r);
      if (!silent) onSync();
    } catch (e: any) {
      if (!silent) onToast(e.message);
    }
  };

  useEffect(() => {
    runBmi(true);
    runSleep();
    run1Rm(true);
    runPace(true);
  }, []);

  useEffect(() => {
    if (!pomoRunning) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      return;
    }
    timerRef.current = window.setInterval(() => {
      setPomoSeconds((prev) => {
        if (prev <= 1) {
          setPomoRunning(false);
          playChime();
          onToast('Интервал завершён!');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [pomoRunning, onToast]);

  const applyPomoPreset = (p: '25/5' | '50/10' | 'tabata') => {
    setPomoRunning(false);
    setPomoPreset(p);
    setPomoSeconds(p === '25/5' ? 25 * 60 : p === '50/10' ? 50 * 60 : 20);
  };

  const isFav = favorites.includes(tab);
  const fastHours = Number(fastProtocol.split(':')[0]);
  const eatStartHour = (fastStartHour + fastHours) % 24;

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-900/80 p-2">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'bmi_macros', label: '🥗 ИМТ и КБЖУ' },
            { id: 'sleep_cycles', label: '🌙 Циклы Сна' },
            { id: 'workout_1rm', label: '🏋️ 1RM и Штанга' },
            { id: 'running_pace', label: '🏃 Бег и Пульс' },
            { id: 'fasting_pomodoro', label: '⏳ Помодоро & 16:8' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id as TabId);
                onSelectTool(t.id);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                tab === t.id ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onToggleFav(tab)}
          className={`px-2.5 py-1.5 rounded-xl text-xs border flex items-center gap-1 ${
            isFav ? 'bg-amber-500/20 border-amber-400/40 text-amber-200' : 'border-white/10 text-slate-400'
          }`}
        >
          <Star className="w-3.5 h-3.5" /> {isFav ? 'В избранном' : 'В избранное'}
        </button>
      </div>

      {/* 1. BMI & MACROS */}
      {tab === 'bmi_macros' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-6 rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-3.5">
            <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
              <Flame className="w-5 h-5 text-emerald-400" /> Расчёт ИМТ, Калорийности (КБЖУ) и Воды
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSex('m')}
                className={`py-2 rounded-xl text-xs font-semibold border ${
                  sex === 'm' ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200' : 'bg-slate-950 border-white/10 text-slate-400'
                }`}
              >
                Мужчина
              </button>
              <button
                type="button"
                onClick={() => setSex('f')}
                className={`py-2 rounded-xl text-xs font-semibold border ${
                  sex === 'f' ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200' : 'bg-slate-950 border-white/10 text-slate-400'
                }`}
              >
                Женщина
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Возраст</span>
                  <b>{age} лет</b>
                </div>
                <input type="range" min={14} max={90} value={age} onChange={(e) => setAge(Number(e.target.value))} className="w-full accent-emerald-400" />
              </div>
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Рост</span>
                  <b>{heightCm} см</b>
                </div>
                <input type="range" min={135} max={220} value={heightCm} onChange={(e) => setHeightCm(Number(e.target.value))} className="w-full accent-emerald-400" />
              </div>
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Вес</span>
                  <b>{weightKg} кг</b>
                </div>
                <input type="range" min={35} max={180} value={weightKg} onChange={(e) => setWeightKg(Number(e.target.value))} className="w-full accent-emerald-400" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <select value={activity} onChange={(e) => setActivity(e.target.value)} className="rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white">
                <option value="sedentary">Сидячий образ жизни</option>
                <option value="light">1–3 тренировки / нед</option>
                <option value="moderate">3–5 тренировок / нед</option>
                <option value="active">6–7 тренировок / нед</option>
                <option value="athlete">Высокие нагрузки</option>
              </select>
              <select value={goal} onChange={(e) => setGoal(e.target.value)} className="rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white">
                <option value="cut">Снижение веса (−18%)</option>
                <option value="maintain">Поддержание формы</option>
                <option value="bulk">Набор массы (+14%)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => runBmi(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition"
            >
              Рассчитать норму КБЖУ
            </button>
          </div>

          <div className="lg:col-span-6 rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-4">
            {bmiRes && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-xl bg-slate-950 border border-white/10">
                    <div className="text-[11px] text-slate-400">ИМТ (BMI)</div>
                    <div className="text-xl font-bold text-white">{bmiRes.bmi}</div>
                    <div className="text-[11px] text-emerald-300">{bmiRes.bmi_category}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-white/10">
                    <div className="text-[11px] text-slate-400">Целевые калории</div>
                    <div className="text-xl font-bold text-amber-300">{bmiRes.target_kcal} ккал</div>
                    <div className="text-[11px] text-slate-400">База BMR: {bmiRes.bmr_kcal}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-white/10 col-span-2 sm:col-span-1">
                    <div className="text-[11px] text-slate-400">Норма воды</div>
                    <div className="text-xl font-bold text-sky-300">{bmiRes.water_liters} л</div>
                    <div className="text-[11px] text-slate-400">Норма веса: {bmiRes.healthy_weight_range_kg}</div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/90 border border-white/10 space-y-2.5">
                  <div className="text-xs font-semibold text-white">Суточный баланс Б / Ж / У ({bmiRes.goal_label})</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-400/30">
                      <div className="text-[11px] text-rose-200">Белки</div>
                      <div className="text-lg font-bold text-white">{bmiRes.macros.protein_g} г</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-500/15 border border-amber-400/30">
                      <div className="text-[11px] text-amber-200">Жиры</div>
                      <div className="text-lg font-bold text-white">{bmiRes.macros.fat_g} г</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-sky-500/15 border border-sky-400/30">
                      <div className="text-[11px] text-sky-200">Углеводы</div>
                      <div className="text-lg font-bold text-white">{bmiRes.macros.carbs_g} г</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 2. SLEEP CYCLES */}
      {tab === 'sleep_cycles' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
              <Moon className="w-5 h-5 text-indigo-400" /> Калькулятор Фаз и Циклов Сна (по 90 минут)
            </h3>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                setSleepMode('bedtime');
                setSleepTime(hhmm);
                runSleep('bedtime', hhmm);
              }}
              className="px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-xs font-semibold"
            >
              Ложусь спать прямо сейчас
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Режим расчёта</label>
              <select
                value={sleepMode}
                onChange={(e) => setSleepMode(e.target.value as any)}
                className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs sm:text-sm text-white"
              >
                <option value="wakeup">Во сколько встать → когда лечь</option>
                <option value="bedtime">Во сколько лечь → когда встать</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Время (ЧЧ:ММ)</label>
              <input
                type="time"
                value={sleepTime}
                onChange={(e) => setSleepTime(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">На засыпание ({fallMin} мин)</label>
              <input type="range" min={5} max={40} value={fallMin} onChange={(e) => setFallMin(Number(e.target.value))} className="w-full accent-indigo-400" />
            </div>
            <button
              type="button"
              onClick={() => runSleep()}
              className="py-2.5 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-semibold text-sm transition"
            >
              Рассчитать циклы
            </button>
          </div>

          {sleepRes && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {sleepRes.recommendations.map((s: any, idx: number) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border ${
                    s.quality === 'Оптимум'
                      ? 'bg-indigo-500/15 border-indigo-400/40'
                      : 'bg-slate-950/80 border-white/10'
                  }`}
                >
                  <div className="text-2xl font-bold text-white">{s.time}</div>
                  <div className="text-xs text-indigo-300 mt-1">
                    {s.cycles} цикл. • {s.hours} ч сна
                  </div>
                  <div className="text-[11px] text-slate-400">{s.quality}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. 1RM & BARBELL PLATE LOADER */}
      {tab === 'workout_1rm' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-3.5">
            <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-amber-400" /> Силовой Максимум (1RM) и Гриф
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Рабочий вес на штанге</span>
                  <b>{liftKg} кг</b>
                </div>
                <input type="range" min={20} max={300} step={2.5} value={liftKg} onChange={(e) => setLiftKg(Number(e.target.value))} className="w-full accent-amber-400" />
              </div>
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Выполнено повторений</span>
                  <b>{liftReps} повт.</b>
                </div>
                <input type="range" min={1} max={20} value={liftReps} onChange={(e) => setLiftReps(Number(e.target.value))} className="w-full accent-amber-400" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Вес пустого грифа</label>
                <select value={barKg} onChange={(e) => setBarKg(Number(e.target.value))} className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-white">
                  <option value={20}>Олимпийский гриф — 20 кг</option>
                  <option value={15}>Женский олимпийский — 15 кг</option>
                  <option value={10}>EZ-гриф — 10 кг</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={() => run1Rm(false)}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition"
            >
              Рассчитать 1RM и блины
            </button>
          </div>

          <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-4">
            {rmRes && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-950 border border-amber-400/30">
                  <div>
                    <div className="text-xs text-slate-400">Расчётный максимум на 1 повторение (1RM)</div>
                    <div className="text-2xl font-bold text-amber-300">{rmRes.one_rep_max_kg} кг</div>
                  </div>
                  <div className="text-xs text-slate-400">
                    Эпли: {rmRes.formulas.epley} • Бжицки: {rmRes.formulas.brzycki} • Лэндер: {rmRes.formulas.lander}
                  </div>
                </div>

                {/* Visual Barbell Sleeve */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-white/10 space-y-2">
                  <div className="text-xs text-slate-300">
                    Набор блинов <b>на каждую сторону</b> для {rmRes.loaded_exact_kg} кг (гриф {rmRes.bar_kg} кг):
                  </div>
                  <div className="flex items-center gap-1 py-3 px-2 overflow-x-auto">
                    <div className="h-3 w-12 bg-slate-500 rounded-l shrink-0" />
                    <div className="h-8 w-2.5 bg-slate-400 rounded shrink-0" />
                    {rmRes.plates_per_side.length > 0 ? (
                      rmRes.plates_per_side.map((p: number, idx: number) => (
                        <div
                          key={idx}
                          style={{
                            backgroundColor: PLATE_COLORS[String(p)] || '#38bdf8',
                            height: `${Math.max(36, Math.min(74, 34 + p * 1.5))}px`,
                          }}
                          className="w-6 rounded border border-black/40 flex items-center justify-center text-[10px] font-bold text-slate-950 shrink-0"
                        >
                          {p}
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 pl-2">Пустой гриф без блинов</span>
                    )}
                    <div className="h-3 w-8 bg-slate-500 rounded-r shrink-0" />
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
                  {rmRes.training_table.map((z: any) => (
                    <div key={z.pct} className="p-2 rounded-lg bg-slate-950 border border-white/10">
                      <div className="text-amber-300 font-semibold">{z.pct}%</div>
                      <div className="text-white font-bold">{z.weight_kg} кг</div>
                      <div className="text-[10px] text-slate-400">{z.reps_hint}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 4. RUNNING PACE & HR ZONES */}
      {tab === 'running_pace' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-3">
            <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-sky-400" /> Беговой Темп и Пульсовые Зоны
            </h3>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Дистанция (км)</label>
                <input type="number" step="0.1" value={runDist} onChange={(e) => setRunDist(Number(e.target.value) || 1)} className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Время (минут)</label>
                <input type="number" step="0.5" value={runMin} onChange={(e) => setRunMin(Number(e.target.value) || 1)} className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Возраст</label>
                <input type="number" value={age} onChange={(e) => setAge(Number(e.target.value) || 25)} className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Пульс покоя</label>
                <input type="number" value={restHr} onChange={(e) => setRestHr(Number(e.target.value) || 60)} className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-white" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => runPace(false)}
              className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-sm transition"
            >
              Рассчитать темп и зоны
            </button>
          </div>

          <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-3.5">
            {runRes && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-950 border border-sky-400/30">
                    <div className="text-xs text-slate-400">Средний темп</div>
                    <div className="text-xl font-bold text-sky-300">{runRes.pace_formatted}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-emerald-400/30">
                    <div className="text-xs text-slate-400">Скорость</div>
                    <div className="text-xl font-bold text-emerald-300">{runRes.speed_kmh} км/ч</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {runRes.predictions.map((p: any) => (
                    <div key={p.race} className="p-2.5 rounded-xl bg-slate-950 border border-white/10">
                      <div className="text-slate-400">{p.race}</div>
                      <div className="text-base font-bold text-white">{p.predicted_time}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5 text-xs">
                  {runRes.hr_zones.map((z: any) => (
                    <div key={z.zone} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-950/80 border border-white/5">
                      <span className="text-slate-300">{z.zone}</span>
                      <b className="text-rose-300">{z.bpm}</b>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 5. POMODORO & INTERMITTENT FASTING */}
      {tab === 'fasting_pomodoro' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-5 flex flex-col items-center justify-between space-y-4">
            <div className="w-full flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Timer className="w-4 h-4 text-emerald-400" /> Таймер Концентрации Помодоро
              </h3>
              <div className="flex gap-1">
                {(['25/5', '50/10', 'tabata'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => applyPomoPreset(p)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                      pomoPreset === p ? 'bg-emerald-500 text-slate-950 font-semibold' : 'bg-slate-950 text-slate-300'
                    }`}
                  >
                    {p === 'tabata' ? 'Табата 20с' : p}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-5xl font-mono font-bold text-white tracking-wider py-4">
              {String(Math.floor(pomoSeconds / 60)).padStart(2, '0')}:{String(pomoSeconds % 60).padStart(2, '0')}
            </div>

            <div className="flex gap-2.5 w-full">
              <button
                type="button"
                onClick={() => setPomoRunning((v) => !v)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm flex items-center justify-center gap-1.5"
              >
                <Play className="w-4 h-4" /> {pomoRunning ? 'Пауза' : 'Старт'}
              </button>
              <button
                type="button"
                onClick={() => applyPomoPreset(pomoPreset)}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm flex items-center gap-1"
              >
                <RotateCcw className="w-4 h-4" /> Сброс
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400" /> Расписание Интервального Питания
            </h3>
            <div className="flex gap-2">
              {(['16:8', '18:6', '20:4'] as const).map((pr) => (
                <button
                  key={pr}
                  type="button"
                  onClick={() => setFastProtocol(pr)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border ${
                    fastProtocol === pr ? 'bg-sky-500/20 border-sky-400 text-sky-200' : 'bg-slate-950 border-white/10 text-slate-300'
                  }`}
                >
                  Протокол {pr}
                </button>
              ))}
            </div>
            <div className="text-xs">
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Начало паузы после ужина</span>
                <b>{String(fastStartHour).padStart(2, '0')}:00</b>
              </div>
              <input type="range" min={0} max={23} value={fastStartHour} onChange={(e) => setFastStartHour(Number(e.target.value))} className="w-full accent-sky-400" />
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-white/10">
                <div className="text-slate-400">Окно без калорий ({fastHours} ч)</div>
                <div className="text-base font-bold text-amber-300">
                  {String(fastStartHour).padStart(2, '0')}:00 → {String(eatStartHour).padStart(2, '0')}:00
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-white/10">
                <div className="text-slate-400">Пищевое окно ({24 - fastHours} ч)</div>
                <div className="text-base font-bold text-emerald-300">
                  {String(eatStartHour).padStart(2, '0')}:00 → {String(fastStartHour).padStart(2, '0')}:00
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
