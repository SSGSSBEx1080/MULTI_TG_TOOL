import React, { useEffect, useState } from 'react';
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
  newton_force: 'phys_force',
  work_power_eff: 'phys_power',
  ohm_electric: 'phys_electric',
  heat_boiling: 'phys_heat',
};

export const PhysicsHub: React.FC<Props> = ({ activeTool, onSelectTool, onSync, onToast }) => {
  const [calculators, setCalculators] = useState<PhysCalc[]>([]);
  const [materials, setMaterials] = useState<{ id: string; label: string; c: number }[]>([]);
  const [selectedCalcId, setSelectedCalcId] = useState<string>('kinematics_uniform');
  const [targetVar, setTargetVar] = useState<string>('t');
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiGet('/api/v2/physics/catalog')
      .then((r) => {
        setCalculators(r.calculators || []);
        setMaterials(r.materials || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const mapped = TOOL_MAP[activeTool];
    if (mapped) {
      setSelectedCalcId(mapped);
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
    setValues(defaults);
    setResult(null);
  }, [selectedCalcId, calculators.length]);

  const switchTarget = (tgt: PhysTarget) => {
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

    setLoading(true);
    try {
      const res = await apiPost('/api/v2/physics/solve', {
        calc_id: activeCalc.id,
        target_var: activeTarget.var,
        params: numericParams,
      });
      setResult(res);
      onSync?.();
    } catch (e: any) {
      onToast(e.message || 'Ошибка расчёта');
    } finally {
      setLoading(false);
    }
  };

  if (!activeCalc || !activeTarget) {
    return <div className="p-4 text-sm text-slate-400">Загрузка физических формул...</div>;
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
                  onClick={() => setValues((prev) => ({ ...prev, c: String(m.c) }))}
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
                  onChange={(e) => setValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
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
    </div>
  );
};
