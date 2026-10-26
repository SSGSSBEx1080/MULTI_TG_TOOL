import React, { useEffect, useRef, useState } from 'react';
import { Calculator, Copy } from 'lucide-react';
import { apiGet, apiPost, copyText } from '../../lib/api';
import { PhysicsLab3D } from '../three/Interactive3DScenes';

interface Props {
  activeTool: string;
  onSelectTool?: (t: string) => void;
  onSync?: () => void;
  onToast: (msg: string) => void;
}

interface PhysField {
  name: string;
  label: string;
  default: number;
}

interface PhysTarget {
  var: string;
  label: string;
  fields: PhysField[];
}

interface PhysCalc {
  id: string;
  title: string;
  emoji: string;
  formula_display: string;
  targets: PhysTarget[];
}

const TOOL_MAP: Record<string, string> = {
  phys_kinematics: 'kinematics_uniform',
  phys_force: 'newton_force',
  phys_power: 'work_power_eff',
  phys_electric: 'ohm_electric',
  phys_heat: 'heat_boiling',
};

const CALC_TO_TOOL: Record<string, string> = {
  kinematics_uniform: 'phys_kinematics',
  kinematics_accel: 'phys_kinematics',
  free_fall: 'phys_kinematics',
  newton_force: 'phys_force',
  work_power_eff: 'phys_power',
  ohm_electric: 'phys_electric',
  heat_boiling: 'phys_heat',
  energy_pressure: 'phys_heat',
};

export const PhysicsHub: React.FC<Props> = ({ activeTool, onSelectTool, onSync, onToast }) => {
  const [calculators, setCalculators] = useState<PhysCalc[]>([]);
  const [materials, setMaterials] = useState<{ id: string; label: string; c: number }[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [selectedCalcId, setSelectedCalcId] = useState<string>(() => TOOL_MAP[activeTool] || 'kinematics_uniform');
  const [targetVar, setTargetVar] = useState<string>('t');
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const solveRequestId = useRef(0);

  // Ballistics & Thin Lens Studio
  const [v0, setV0] = useState<number>(35);
  const [launchDeg, setLaunchDeg] = useState<number>(45);
  const [focalCm, setFocalCm] = useState<number>(15);
  const [objDistCm, setObjDistCm] = useState<number>(25);

  useEffect(() => {
    let current = true;
    setCatalogLoading(true);
    setCatalogError('');
    apiGet('/api/v2/physics/catalog')
      .then((r) => {
        if (!current) return;
        setCalculators(r.calculators || []);
        setMaterials(r.materials || []);
      })
      .catch((error: any) => { if (current) setCatalogError(error?.message || 'Не удалось загрузить каталог формул'); })
      .finally(() => { if (current) setCatalogLoading(false); });
    return () => { current = false; };
  }, [catalogRetry]);

  useEffect(() => {
    solveRequestId.current += 1;
    setLoading(false);
    setResult(null);
    const mapped = TOOL_MAP[activeTool];
    if (mapped) {
      setSelectedCalcId((prev) => (CALC_TO_TOOL[prev] === activeTool ? prev : mapped));
    }
  }, [activeTool]);

  const activeCalc = calculators.find((c) => c.id === selectedCalcId) || calculators[0];
  const activeTarget =
    activeCalc?.targets.find((t) => t.var === targetVar) || activeCalc?.targets[0];

  useEffect(() => {
    if (!activeCalc || !activeCalc.targets[0]) return;
    const firstTarget = activeCalc.targets[0];
    setTargetVar(firstTarget.var);
    const defaults: Record<string, string> = {};
    firstTarget.fields.forEach((f) => {
      defaults[f.name] = String(f.default);
    });
    solveRequestId.current += 1;
    setLoading(false);
    setValues(defaults);
    setResult(null);
  }, [selectedCalcId, calculators.length]);

  const switchTarget = (tgt: PhysTarget) => {
    solveRequestId.current += 1;
    setLoading(false);
    setTargetVar(tgt.var);
    const nextVals: Record<string, string> = {};
    tgt.fields.forEach((f) => {
      nextVals[f.name] = values[f.name] !== undefined ? values[f.name] : String(f.default);
    });
    setValues(nextVals);
    setResult(null);
  };

  const handleSolve = async () => {
    if (!activeCalc || !activeTarget) return;
    const numericParams: Record<string, number> = {};
    for (const f of activeTarget.fields) {
      const raw = (values[f.name] ?? '').replace(',', '.').trim();
      const parsed = Number(raw);
      if (raw === '' || Number.isNaN(parsed)) {
        onToast(`Введите числовое значение для «${f.label}»`);
        return;
      }
      numericParams[f.name] = parsed;
    }

    const currentRequest = ++solveRequestId.current;
    setLoading(true);
    setResult(null);
    try {
      const res = await apiPost('/api/v2/physics/solve', {
        calc_id: activeCalc.id,
        target_var: activeTarget.var,
        params: numericParams,
      });
      if (currentRequest !== solveRequestId.current) return;
      setResult(res);
      onSync?.();
    } catch (e: any) {
      if (currentRequest === solveRequestId.current) onToast(e.message || 'Ошибка расчёта');
    } finally {
      if (currentRequest === solveRequestId.current) setLoading(false);
    }
  };

  if (!activeCalc || !activeTarget) {
    return <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 text-center">
      {catalogError ? <><p role="alert" className="text-sm text-rose-200">{catalogError}</p><button type="button" onClick={() => setCatalogRetry((value) => value + 1)} className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs text-white">Повторить загрузку формул</button></> : <p role="status" className="text-sm text-slate-400">{catalogLoading ? 'Загружаю каталог физических формул…' : 'Формулы не найдены в каталоге.'}</p>}
    </div>;
  }

  return (
    <div className="space-y-4 min-w-0">
      {/* Module selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {calculators.map((c) => {
          const isSel = c.id === activeCalc.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                solveRequestId.current += 1;
                setLoading(false);
                setResult(null);
                setSelectedCalcId(c.id);
                if (CALC_TO_TOOL[c.id]) onSelectTool?.(CALC_TO_TOOL[c.id]);
              }}
              className={`p-2.5 rounded-xl border text-left transition min-w-0 ${
                isSel
                  ? 'bg-sky-600/25 border-sky-400 text-white'
                  : 'bg-slate-900/70 border-white/10 text-slate-300 hover:border-white/25'
              }`}
            >
              <div className="text-base">{c.emoji}</div>
              <div className="text-xs font-semibold mt-1 leading-snug">{c.title}</div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">{c.formula_display}</div>
            </button>
          );
        })}
      </div>

      {/* Interactive 3D Physics Experiment Stage */}
      <PhysicsLab3D calcId={activeCalc.id} values={values} result={result} />

      {/* Solver workspace */}
      <div className="rounded-2xl bg-slate-900/80 border border-white/10 p-4 space-y-4">
        <div>
          <h3 className="text-base font-bold text-white">
            {activeCalc.emoji} {activeCalc.title}
          </h3>
          <p className="text-xs text-sky-300 font-mono mt-0.5">{activeCalc.formula_display}</p>
        </div>

        {/* Step 1: Choose target */}
        {activeCalc.targets.length > 1 && (
          <div>
            <div className="text-xs font-medium text-slate-400 mb-2">Что нужно найти:</div>
            <div className="flex flex-wrap gap-2">
              {activeCalc.targets.map((tgt) => {
                const active = tgt.var === activeTarget.var;
                return (
                  <button
                    key={tgt.var}
                    onClick={() => switchTarget(tgt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                      active
                        ? 'bg-sky-600 border-sky-400 text-white'
                        : 'bg-slate-950 border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    {tgt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Material presets for heat_boiling */}
        {activeCalc.id === 'heat_boiling' && materials.length > 0 && (
          <div>
            <div className="text-xs text-slate-400 mb-1.5">Быстрый выбор вещества (теплоёмкость c):</div>
            <div className="flex flex-wrap gap-1.5">
              {materials.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    solveRequestId.current += 1;
                    setLoading(false);
                    setResult(null);
                    setValues((prev) => ({ ...prev, c: String(m.c) }));
                  }}
                  className="px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300"
                >
                  {m.label} ({m.c})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Inputs */}
        <div>
          <div className="text-xs font-medium text-slate-400 mb-2">Известные параметры:</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeTarget.fields.map((f) => (
              <label key={f.name} className="block p-3 rounded-xl bg-slate-950/70 border border-white/10">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-200 font-medium">{f.label}</span>
                  <span className="text-sky-400 font-mono">{f.name}</span>
                </div>
                <input
                  type="number"
                  step="any"
                  value={values[f.name] ?? ''}
                  onChange={(e) => {
                    solveRequestId.current += 1;
                    setLoading(false);
                    setResult(null);
                    setValues((prev) => ({ ...prev, [f.name]: e.target.value }));
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-sm text-white font-mono focus:outline-none focus:border-sky-400"
                />
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={handleSolve}
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Calculator className="w-4 h-4" />
          {loading ? 'Вычисление...' : 'Рассчитать'}
        </button>

        {/* Solution display */}
        {result && (
          <div className="p-4 rounded-xl bg-slate-950/90 border border-sky-500/30 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs text-slate-400">{result.target_label}</div>
                <div className="text-xl sm:text-2xl font-extrabold text-sky-300 font-mono mt-0.5">
                  {result.formatted}
                </div>
                {result.si_value && result.si_value !== result.formatted && (
                  <div className="text-xs text-slate-400 font-mono mt-0.5">В СИ: {result.si_value}</div>
                )}
              </div>
              <button
                onClick={() => copyText(`${result.target_label}: ${result.formatted}`, onToast)}
                className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" /> Копировать
              </button>
            </div>

            <div className="space-y-1 text-xs text-slate-300 font-mono bg-slate-900/80 p-3 rounded-lg border border-white/5 overflow-x-auto break-words">
              <div>Формула: {result.formula}</div>
              {(result.steps_list || []).map((s: string, i: number) => (
                <div key={i}>Расчёт: {s}</div>
              ))}
            </div>

            {result.extra?.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {result.extra.map((ex: { label: string; value: string }, idx: number) => (
                  <div key={idx} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs">
                    <span className="text-slate-400">{ex.label}: </span>
                    <span className="font-semibold text-white font-mono">{ex.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ballistics Multi-Planet Trajectory & Thin Lens Optics Studio */}
      <div
        className={`rounded-2xl border p-4 sm:p-5 space-y-4 text-xs ${
          activeTool === 'phys_ballistics_optics'
            ? 'bg-slate-900/90 border-amber-400/50 shadow-lg'
            : 'bg-slate-900/75 border-white/10'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white">
              🎯 Баллистическая Траектория на Планетах и Оптика Тонкой Линзы
            </h3>
            <p className="text-slate-400">
              Сравнение дальности и высоты броска на Земле, Луне, Марсе и Юпитере + формула линзы 1/F = 1/d + 1/f
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-300">Начальная скорость v₀:</span>
              <b className="font-mono text-sky-300">{v0} м/с</b>
            </div>
            <input type="range" min={5} max={120} value={v0} onChange={(e) => setV0(Number(e.target.value))} className="w-full accent-sky-400" />
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-300">Угол броска α:</span>
              <b className="font-mono text-amber-300">{launchDeg}°</b>
            </div>
            <input type="range" min={5} max={85} value={launchDeg} onChange={(e) => setLaunchDeg(Number(e.target.value))} className="w-full accent-amber-400" />
          </div>
        </div>

        {(() => {
          const rad = (launchDeg * Math.PI) / 180;
          const planets = [
            { name: 'Луна (1.62 м/с²)', g: 1.62, color: '#e2e8f0' },
            { name: 'Марс (3.72 м/с²)', g: 3.72, color: '#fb7185' },
            { name: 'Земля (9.81 м/с²)', g: 9.81, color: '#38bdf8' },
            { name: 'Юпитер (24.79 м/с²)', g: 24.79, color: '#facc15' },
          ].map((p) => {
            const range = (v0 * v0 * Math.sin(2 * rad)) / p.g;
            const maxH = (v0 * v0 * Math.pow(Math.sin(rad), 2)) / (2 * p.g);
            const tFlight = (2 * v0 * Math.sin(rad)) / p.g;
            return { ...p, range, maxH, tFlight };
          });
          const maxR = Math.max(1, planets[0].range);
          const maxY = Math.max(1, planets[0].maxH);

          const invImg = 1 / focalCm - 1 / objDistCm;
          const imgDist = Math.abs(invImg) > 1e-6 ? 1 / invImg : Infinity;
          const mag = Number.isFinite(imgDist) ? Math.abs(imgDist / objDistCm) : Infinity;
          const diopters = 100 / focalCm;

          return (
            <>
              <svg viewBox="0 0 520 155" className="w-full h-36 rounded-xl bg-slate-950 border border-white/10 p-2">
                <line x1="24" y1="138" x2="500" y2="138" stroke="rgba(148,163,184,0.35)" strokeWidth="1" />
                {planets.map((pl) => {
                  const pts: string[] = [];
                  for (let s = 0; s <= 32; s++) {
                    const t = (s / 32) * pl.tFlight;
                    const x = v0 * Math.cos(rad) * t;
                    const y = Math.max(0, v0 * Math.sin(rad) * t - 0.5 * pl.g * t * t);
                    const sx = 24 + (x / maxR) * 470;
                    const sy = 138 - (y / maxY) * 116;
                    pts.push(`${sx.toFixed(1)},${sy.toFixed(1)}`);
                  }
                  return (
                    <polyline
                      key={pl.name}
                      fill="none"
                      stroke={pl.color}
                      strokeWidth="2.2"
                      points={pts.join(' ')}
                    />
                  );
                })}
              </svg>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {planets.map((pl) => (
                  <div key={pl.name} className="p-2.5 rounded-xl bg-slate-950 border border-white/10">
                    <div className="font-bold" style={{ color: pl.color }}>
                      {pl.name}
                    </div>
                    <div className="font-mono text-white mt-0.5">Дальность: {pl.range.toFixed(1)} м</div>
                    <div className="font-mono text-slate-400">
                      Высота: {pl.maxH.toFixed(1)} м • {pl.tFlight.toFixed(1)} с
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-white/10 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                <label className="space-y-1">
                  <span className="text-slate-400">Фокус линзы F (см, − рассеив.):</span>
                  <input
                    type="number"
                    value={focalCm}
                    onChange={(e) => setFocalCm(Number(e.target.value) || 10)}
                    className="w-full rounded-lg bg-slate-900 border border-white/15 px-3 py-1.5 font-mono text-white"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400">Расстояние предмета d (см):</span>
                  <input
                    type="number"
                    min={1}
                    value={objDistCm}
                    onChange={(e) => setObjDistCm(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full rounded-lg bg-slate-900 border border-white/15 px-3 py-1.5 font-mono text-white"
                  />
                </label>
                <div className="space-y-0.5 font-mono">
                  <div className="text-emerald-300 font-bold">
                    Оптическая сила: {diopters >= 0 ? '+' : ''}
                    {diopters.toFixed(2)} дптр
                  </div>
                  <div className="text-white">
                    {!Number.isFinite(imgDist)
                      ? 'Лучи параллельны (в фокусе)'
                      : `f = ${imgDist.toFixed(1)} см (${imgDist > 0 ? 'действительное' : 'мнимое'}, Γ = ×${mag.toFixed(2)})`}
                  </div>
                </div>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
};
