import React, { useEffect, useState } from 'react';
import {
  Calculator,
  CheckSquare,
  Dices,
  Languages,
  Network,
  Pin,
  Plus,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { HabitItem, NoteItem, TodoItem, apiDelete, apiPost, copyText } from '../../lib/api';
import { HabitRing3D, NetworkTopology3D, PolyhedralDice3D } from '../three/Interactive3DScenes';

interface Props {
  activeCategory: string;
  activeTool: string;
  onSelectTool: (t: string) => void;
  notes: NoteItem[];
  todos: TodoItem[];
  habits: HabitItem[];
  onRefreshWorkspace: () => void;
  onToast: (msg: string) => void;
}

export const CalcTextWorkspaceHub: React.FC<Props> = ({
  activeCategory,
  activeTool,
  onSelectTool,
  notes,
  todos,
  habits,
  onRefreshWorkspace,
  onToast,
}) => {
  // --- Hub 6: Calc & Network ---
  const [calcTab, setCalcTab] = useState<'smart_units' | 'math' | 'units' | 'finance' | 'subnet'>('smart_units');
  const [smartUnitInput, setSmartUnitInput] = useState('6 дюймов');
  const [smartUnitRes, setSmartUnitRes] = useState<any>(null);
  const [mathExpr, setMathExpr] = useState('sqrt(2048 * 2) + (0xFF & 0x3C) + 2^10');
  const [mathRes, setMathRes] = useState<any>(null);

  const [uVal, setUVal] = useState(16);
  const [uCat, setUCat] = useState('data');
  const [uFrom, setUFrom] = useState('GB');
  const [unitRes, setUnitRes] = useState<any>(null);

  const [finMode, setFinMode] = useState<'compound' | 'loan' | 'split'>('compound');
  const [finPrincipal, setFinPrincipal] = useState(500000);
  const [finRate, setFinRate] = useState(18);
  const [finMonths, setFinMonths] = useState(12);
  const [finTopup, setFinTopup] = useState(25000);
  const [finPeople, setFinPeople] = useState(4);
  const [finTip, setFinTip] = useState(10);
  const [finRes, setFinRes] = useState<any>(null);

  const [cidr, setCidr] = useState('192.168.10.42/26');
  const [subRes, setSubRes] = useState<any>(null);

  // --- Hub 7: Text & Random ---
  const [txtTab, setTxtTab] = useState<'rhyme' | 'layout' | 'fonts' | 'diff' | 'random'>('rhyme');
  const [rhymeWord, setRhymeWord] = useState('любовь');
  const [rhymeRes, setRhymeRes] = useState<any>(null);
  const [layoutText, setLayoutText] = useState('Ghbdtn? rfr ltkf&');
  const [layoutRes, setLayoutRes] = useState<any>(null);

  const [fontInput, setFontInput] = useState('MULTI_TG_TOOL 2026');
  const [fontRes, setFontRes] = useState<any>(null);

  const [diffA, setDiffA] = useState('Первая версия конфигурации:\nhost: 127.0.0.1\nport: 3000\ndebug: true');
  const [diffB, setDiffB] = useState('Обновлённая конфигурация:\nhost: 0.0.0.0\nport: 8000\nworkers: 4');
  const [diffRes, setDiffRes] = useState<any>(null);

  const [rndMode, setRndMode] = useState<'dice' | 'teams' | 'pick'>('dice');
  const [diceExpr, setDiceExpr] = useState('2d20+5');
  const [rndList, setRndList] = useState('Алексей, Мария, Дмитрий, Екатерина, Максим, Софья');
  const [teamsCount, setTeamsCount] = useState(2);
  const [rndRes, setRndRes] = useState<any>(null);

  // --- Hub 8: Workspace ---
  const [wsTab, setWsTab] = useState<'habits' | 'todos' | 'notes'>('habits');
  const [habitTitle, setHabitTitle] = useState('');
  const [habitIcon, setHabitIcon] = useState('✅');
  const [habitTarget, setHabitTarget] = useState(7);

  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteTag, setNoteTag] = useState('work');
  const [todoText, setTodoText] = useState('');
  const [todoPriority, setTodoPriority] = useState<'normal' | 'high'>('normal');

  useEffect(() => {
    if (activeTool === 'habit_tracker') setWsTab('habits');
    else if (activeTool === 'todo_board') setWsTab('todos');
    else if (activeTool === 'notes_vault') setWsTab('notes');
  }, [activeTool]);

  useEffect(() => {
    if (activeTool === 'smart_units') setCalcTab('smart_units');
    else if (activeTool === 'smart_calc') setCalcTab('math');
    else if (activeTool === 'unit_conv') setCalcTab('units');
    else if (activeTool === 'finance_calc') setCalcTab('finance');
    else if (activeTool === 'subnet_calc') setCalcTab('subnet');

    if (activeTool === 'rhyme_gen') setTxtTab('rhyme');
    else if (activeTool === 'layout_fixer') setTxtTab('layout');
    else if (activeTool === 'font_styler') setTxtTab('fonts');
    else if (activeTool === 'text_diff') setTxtTab('diff');
    else if (activeTool === 'randomizer') setTxtTab('random');
  }, [activeTool]);

  useEffect(() => {
    if (activeCategory === 'calc' && !smartUnitRes) {
      apiPost('/api/v2/units/smart', { query: smartUnitInput }).then(setSmartUnitRes).catch(() => {});
    }
    if (activeCategory === 'text' && !rhymeRes) {
      apiPost('/api/v2/rhyme', { word: rhymeWord }).then(setRhymeRes).catch(() => {});
    }
  }, [activeCategory]);

  const runSmartUnits = (q?: string) => {
    const target = (q ?? smartUnitInput).trim();
    if (!target) return;
    if (q) setSmartUnitInput(q);
    apiPost('/api/v2/units/smart', { query: target })
      .then((r) => {
        setSmartUnitRes(r);
        onRefreshWorkspace();
      })
      .catch((err) => onToast(err.message));
  };

  const runRhyme = (w?: string) => {
    const target = (w ?? rhymeWord).trim();
    if (!target) return;
    if (w) setRhymeWord(w);
    apiPost('/api/v2/rhyme', { word: target })
      .then((r) => {
        setRhymeRes(r);
        onRefreshWorkspace();
      })
      .catch((err) => onToast(err.message));
  };

  const unitDefaults: Record<string, string> = {
    length: 'km',
    weight: 'kg',
    data: 'GB',
    speed: 'km/h',
    temperature: 'C',
    area: 'ha',
  };

  // =========================================================================
  // HUB 6: SMART CALC, UNITS, FINANCE & SUBNET
  // =========================================================================
  if (activeCategory === 'calc') {
    const finLabels: Record<string, string> = {
      final_balance: 'Итоговая сумма',
      total_invested: 'Внесено средств',
      interest_earned: 'Начислено процентов',
      effective_yield_pct: 'Доходность (%)',
      monthly_payment: 'Ежемесячный платёж',
      total_payout: 'Общая выплата',
      total_interest: 'Переплата по кредиту',
      overpayment_pct: 'Переплата (%)',
      subtotal: 'Сумма чека',
      tip_amount: 'Чаевые',
      total_with_tip: 'Итого с чаевыми',
      per_person: 'С каждого человека',
      people_count: 'Человек',
    };

    return (
      <div className="space-y-5 min-w-0">
        <div className="hidden lg:flex flex-wrap gap-2">
          {[
            { id: 'smart_units', tool: 'smart_units', label: '🔮 Авто-Конвертер («6 дюймов»)' },
            { id: 'math', tool: 'smart_calc', label: '📐 Научный & Bitwise' },
            { id: 'units', tool: 'unit_conv', label: '⚖️ Таблица Величин' },
            { id: 'finance', tool: 'finance_calc', label: '💎 Вклады, Кредиты, Чек' },
            { id: 'subnet', tool: 'subnet_calc', label: '🌐 IP / CIDR Подсети' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setCalcTab(t.id as any);
                onSelectTool(t.tool);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition ${
                calcTab === t.id
                  ? 'bg-indigo-500/25 border-indigo-400/50 text-indigo-200'
                  : 'bg-slate-900/60 border-white/10 text-slate-300 hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {calcTab === 'smart_units' && (
          <div className="rounded-2xl border border-indigo-400/30 bg-slate-900/75 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  🔮 Умный Конвертер Естественного Языка (Авто-определение единиц)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Просто напишите как в жизни («6 дюймов», «5 футов 11 дюймов», «100 миль в час», «2.5 пуда») — популярные величины идут первыми!
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                '6 дюймов',
                '5 футов 11 дюймов',
                '100 миль в час',
                '2.5 пуда',
                '451 фаренгейт',
                '16 унций',
                '32 гигабайта',
                '15 соток',
              ].map((preset) => (
                <button
                  key={preset}
                  onClick={() => runSmartUnits(preset)}
                  className="px-2.5 py-1 rounded-full bg-indigo-500/15 hover:bg-indigo-500/30 border border-indigo-400/30 text-[11px] text-indigo-200 transition"
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                value={smartUnitInput}
                onChange={(e) => setSmartUnitInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSmartUnits()}
                placeholder="Например: 6 дюймов, 180 фунтов, 75 л.с., 12 миль..."
                className="flex-1 rounded-xl bg-slate-950 border border-white/10 px-4 py-2.5 text-sm text-white"
              />
              <button
                onClick={() => runSmartUnits()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 text-slate-950 font-semibold text-xs shrink-0"
              >
                Перевести
              </button>
            </div>

            {smartUnitRes && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-indigo-500/15 border border-indigo-400/30 text-xs">
                  <div>
                    <span className="text-indigo-300 font-semibold">{smartUnitRes.category_title}:</span>{' '}
                    <span className="text-white font-bold">{smartUnitRes.parsed_display}</span>
                  </div>
                  {smartUnitRes.real_world_hint && (
                    <span className="text-amber-300">{smartUnitRes.real_world_hint}</span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {smartUnitRes.conversions.map((item: any) => (
                    <button
                      key={item.unit}
                      onClick={() => copyText(`${item.formatted} ${item.label}`, onToast)}
                      className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                        item.popular
                          ? 'bg-slate-950/95 border-indigo-400/45 shadow-md shadow-indigo-500/10 hover:border-indigo-300'
                          : 'bg-slate-950/60 border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div>
                        <div className="text-xs text-slate-400 flex items-center gap-1">
                          {item.popular && <span title="Популярная величина">🔥</span>}
                          <span>{item.label}</span>
                        </div>
                        <div className="text-base font-mono font-bold text-white mt-0.5">
                          {item.formatted}
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-slate-400 font-mono">
                        {item.unit}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {calcTab === 'math' && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-4">
            <div className="flex items-center gap-2 text-indigo-300 font-semibold text-sm">
              <Calculator className="w-4 h-4" /> Безопасный AST Вычислитель (тригонометрия, факториалы, побитовые операции)
            </div>
            <div className="flex gap-2">
              <input
                value={mathExpr}
                onChange={(e) => setMathExpr(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    apiPost('/api/tools/calc/eval', { expression: mathExpr })
                      .then((r) => {
                        setMathRes(r);
                        onRefreshWorkspace();
                      })
                      .catch((err) => onToast(err.message));
                  }
                }}
                className="flex-1 rounded-xl bg-slate-950 border border-white/10 px-4 py-2.5 font-mono text-sm text-white"
              />
              <button
                onClick={() =>
                  apiPost('/api/tools/calc/eval', { expression: mathExpr })
                    .then((r) => {
                      setMathRes(r);
                      onRefreshWorkspace();
                    })
                    .catch((err) => onToast(err.message))
                }
                className="px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-semibold text-sm"
              >
                = Вычислить
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {['fact(10) / 100', 'sin(pi / 6) + cos(0)', '(0xDEAD ^ 0xBEEF)', 'gcd(1080, 1920)', '2^32'].map((ex) => (
                <button
                  key={ex}
                  onClick={() => setMathExpr(ex)}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-mono"
                >
                  {ex}
                </button>
              ))}
            </div>
            {mathRes && (
              <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/30 space-y-2">
                <div className="text-2xl font-mono font-bold text-indigo-300">{mathRes.formatted}</div>
                {mathRes.bases?.hex && (
                  <div className="flex flex-wrap gap-4 text-xs font-mono text-slate-300">
                    <span>HEX: <b className="text-sky-300">{mathRes.bases.hex}</b></span>
                    <span>BIN: <b className="text-emerald-300">{mathRes.bases.bin}</b></span>
                    <span>OCT: <b className="text-amber-300">{mathRes.bases.oct}</b></span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {calcTab === 'units' && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Категория</label>
                <select
                  value={uCat}
                  onChange={(e) => {
                    const c = e.target.value;
                    setUCat(c);
                    setUFrom(unitDefaults[c] || 'm');
                  }}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                >
                  <option value="data">Объём данных (B..PB)</option>
                  <option value="length">Длина (mm..mi)</option>
                  <option value="weight">Масса (mg..t, lb)</option>
                  <option value="speed">Скорость (km/h, m/s, kn)</option>
                  <option value="temperature">Температура (C, F, K)</option>
                  <option value="area">Площадь (m², ha, acre)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Значение</label>
                <input
                  type="number"
                  value={uVal}
                  onChange={(e) => setUVal(Number(e.target.value))}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Исходная единица</label>
                <input
                  value={uFrom}
                  onChange={(e) => setUFrom(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <button
                onClick={() =>
                  apiPost('/api/tools/calc/units', { value: uVal, category: uCat, from_unit: uFrom })
                    .then((r) => {
                      setUnitRes(r);
                      onRefreshWorkspace();
                    })
                    .catch((err) => onToast(err.message))
                }
                className="py-2 rounded-xl bg-indigo-500 text-white font-semibold text-xs"
              >
                Перевести во все шкалы
              </button>
            </div>
            {unitRes && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                {Object.entries(unitRes.all).map(([u, v]) => (
                  <div
                    key={u}
                    onClick={() => copyText(String(v), onToast)}
                    className="p-3 rounded-xl bg-slate-950 border border-white/10 cursor-pointer hover:border-indigo-400/50"
                  >
                    <div className="text-[11px] text-slate-400">{u}</div>
                    <div className="font-mono text-sm text-white font-semibold truncate">{String(v)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {calcTab === 'finance' && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'compound', label: '💎 Сложный процент (Вклад)' },
                { id: 'loan', label: '🏦 Кредит (Аннуитет)' },
                { id: 'split', label: '🧾 Деление счёта на компанию' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setFinMode(m.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    finMode === m.id
                      ? 'bg-indigo-500 text-white border-indigo-400'
                      : 'bg-slate-950 text-slate-300 border-white/10'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {finMode === 'split' ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Сумма чека</label>
                  <input
                    type="number"
                    value={finPrincipal}
                    onChange={(e) => setFinPrincipal(Number(e.target.value))}
                    className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Количество человек</label>
                  <input
                    type="number"
                    value={finPeople}
                    onChange={(e) => setFinPeople(Number(e.target.value))}
                    className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Чаевые (%)</label>
                  <input
                    type="number"
                    value={finTip}
                    onChange={(e) => setFinTip(Number(e.target.value))}
                    className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Сумма</label>
                  <input
                    type="number"
                    value={finPrincipal}
                    onChange={(e) => setFinPrincipal(Number(e.target.value))}
                    className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Ставка (% годовых)</label>
                  <input
                    type="number"
                    value={finRate}
                    onChange={(e) => setFinRate(Number(e.target.value))}
                    className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Срок (мес.)</label>
                  <input
                    type="number"
                    value={finMonths}
                    onChange={(e) => setFinMonths(Number(e.target.value))}
                    className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                  />
                </div>
                {finMode === 'compound' && (
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Пополнение/мес.</label>
                    <input
                      type="number"
                      value={finTopup}
                      onChange={(e) => setFinTopup(Number(e.target.value))}
                      className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                    />
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() =>
                apiPost('/api/tools/calc/finance', {
                  mode: finMode,
                  principal: finPrincipal,
                  rate_annual_pct: finRate,
                  months: finMonths,
                  monthly_topup: finTopup,
                  people_count: finPeople,
                  tip_pct: finTip,
                })
                  .then((r) => {
                    setFinRes(r);
                    onRefreshWorkspace();
                  })
                  .catch((err) => onToast(err.message))
              }
              className="px-6 py-2.5 rounded-xl bg-indigo-500 text-white font-semibold text-xs"
            >
              Рассчитать
            </button>

            {finRes && (
              <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/30 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {Object.entries(finRes)
                  .filter(([k]) => k !== 'mode')
                  .map(([k, v]) => (
                    <div key={k} className="min-w-0">
                      <div className="text-slate-400 truncate">{finLabels[k] || k}</div>
                      <div className="font-mono text-sm sm:text-base font-bold text-emerald-300 break-words">
                        {typeof v === 'number' ? v.toLocaleString('ru-RU') : String(v)}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {calcTab === 'subnet' && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-4">
            <div className="flex items-center gap-2 text-indigo-300 font-semibold text-sm">
              <Network className="w-4 h-4" /> Сетевой Калькулятор IPv4 / IPv6 CIDR
            </div>
            <NetworkTopology3D cidr={cidr} usableHosts={subRes?.usable_hosts} />
            <div className="flex gap-2">
              <input
                value={cidr}
                onChange={(e) => setCidr(e.target.value)}
                className="flex-1 rounded-xl bg-slate-950 border border-white/10 px-3.5 py-2 font-mono text-sm text-white"
              />
              <button
                onClick={() =>
                  apiPost('/api/tools/calc/subnet', { cidr })
                    .then((r) => {
                      setSubRes(r);
                      onRefreshWorkspace();
                    })
                    .catch((err) => onToast(err.message))
                }
                className="px-5 py-2 rounded-xl bg-indigo-500 text-white font-semibold text-xs"
              >
                Рассчитать сеть
              </button>
            </div>
            {subRes && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-950 border border-white/10 text-xs">
                <div><span className="text-slate-400">Сеть:</span> <div className="font-mono text-white font-semibold">{subRes.network_address}</div></div>
                <div><span className="text-slate-400">Broadcast:</span> <div className="font-mono text-white font-semibold">{subRes.broadcast_address}</div></div>
                <div><span className="text-slate-400">Маска:</span> <div className="font-mono text-sky-300">{subRes.netmask}</div></div>
                <div><span className="text-slate-400">Доступно хостов:</span> <div className="font-mono text-emerald-300 font-bold">{subRes.usable_hosts}</div></div>
                <div className="col-span-2"><span className="text-slate-400">Диапазон:</span> <div className="font-mono text-white">{subRes.first_host} — {subRes.last_host}</div></div>
                <div className="col-span-full"><span className="text-slate-400">Бинарная маска:</span> <div className="font-mono text-indigo-300 break-all">{subRes.binary_netmask}</div></div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // HUB 7: TEXT, LAYOUT FIXER, FONTS, DIFF & RANDOMIZER
  // =========================================================================
  if (activeCategory === 'text') {
    return (
      <div className="space-y-5 min-w-0">
        <div className="hidden lg:flex flex-wrap gap-2">
          {[
            { id: 'rhyme', tool: 'rhyme_gen', label: '🎤 Генератор Рифм' },
            { id: 'layout', tool: 'layout_fixer', label: '⌨️ Раскладка Ghbdtn→Привет' },
            { id: 'fonts', tool: 'font_styler', label: '✨ Стильные Шрифты & Case' },
            { id: 'diff', tool: 'text_diff', label: '📊 Аналитика & Diff' },
            { id: 'random', tool: 'randomizer', label: '🎲 Кубики & Команды' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTxtTab(t.id as any);
                onSelectTool(t.tool);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition ${
                txtTab === t.id
                  ? 'bg-pink-500/20 border-pink-400/50 text-pink-200'
                  : 'bg-slate-900/60 border-white/10 text-slate-300 hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {txtTab === 'rhyme' && (
          <div className="rounded-2xl border border-pink-400/30 bg-slate-900/75 p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white">🎤 Детальный Фонетический Генератор Русских Рифм</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Учитывает оглушение звонких согласных на конце, йотированные гласные и количество слогов для стихов и треков!
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {['любовь', 'рассвет', 'тишина', 'свобода', 'звезда', 'код', 'экран', 'момент', 'игра', 'ночь'].map((w) => (
                <button
                  key={w}
                  onClick={() => runRhyme(w)}
                  className="px-2.5 py-1 rounded-full bg-pink-500/15 hover:bg-pink-500/30 border border-pink-400/30 text-[11px] text-pink-200 transition"
                >
                  {w}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                value={rhymeWord}
                onChange={(e) => setRhymeWord(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runRhyme()}
                placeholder="Введите русское слово..."
                className="flex-1 rounded-xl bg-slate-950 border border-white/10 px-4 py-2.5 text-sm text-white"
              />
              <button
                onClick={() => runRhyme()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-slate-950 font-semibold text-xs shrink-0"
              >
                Подобрать рифмы
              </button>
            </div>

            {rhymeRes && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3 p-3 rounded-xl bg-slate-950/90 border border-white/10 text-xs">
                  <span>Слово: <strong className="text-pink-300">{rhymeRes.word}</strong></span>
                  <span>• Слогов: <strong className="text-white">{rhymeRes.syllables}</strong></span>
                  <span>• Фонетический хвост: <code className="text-sky-300">{rhymeRes.phonetic_ending}</code></span>
                  <span>• Всего рифм: <strong className="text-emerald-300">{rhymeRes.total_found}</strong></span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-pink-400/25 space-y-2">
                    <div className="text-xs font-semibold text-pink-300">💎 Точные и богатые</div>
                    <div className="flex flex-wrap gap-1.5">
                      {rhymeRes.exact_rhymes.map((r: string) => (
                        <button
                          key={r}
                          onClick={() => copyText(r, onToast)}
                          className="px-2 py-1 rounded-lg bg-pink-500/15 hover:bg-pink-500/30 text-xs text-white"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-purple-400/25 space-y-2">
                    <div className="text-xs font-semibold text-purple-300">🎵 Ассонансные и звучные</div>
                    <div className="flex flex-wrap gap-1.5">
                      {rhymeRes.assonance_rhymes.map((r: string) => (
                        <button
                          key={r}
                          onClick={() => copyText(r, onToast)}
                          className="px-2 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/30 text-xs text-slate-200"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-sky-400/25 space-y-2">
                    <div className="text-xs font-semibold text-sky-300">⚡ Глагольные и Панчи</div>
                    <div className="flex flex-wrap gap-1.5">
                      {rhymeRes.verb_rhymes.map((r: string) => (
                        <button
                          key={r}
                          onClick={() => copyText(r, onToast)}
                          className="px-2 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/30 text-xs text-slate-200"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-white/10 space-y-1">
                      {rhymeRes.double_punch_rhymes.map((d: string) => (
                        <div key={d} className="text-[11px] text-amber-200 font-mono">• {d}</div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-400/20 flex items-center justify-between gap-3">
                  <pre className="text-xs text-slate-200 whitespace-pre-wrap font-sans italic">{rhymeRes.sample_quatrain}</pre>
                  <button
                    onClick={() => copyText(rhymeRes.sample_quatrain, onToast)}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white shrink-0"
                  >
                    Копировать строфу
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {txtTab === 'layout' && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-4">
            <div className="flex items-center gap-2 text-pink-300 font-semibold text-sm">
              <Languages className="w-4 h-4" /> Исправление QWERTY ↔ ЙЦУКЕН, ГОСТ Транслит & URL Slug
            </div>
            <textarea
              rows={3}
              value={layoutText}
              onChange={(e) => setLayoutText(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-white/10 p-3 text-sm text-white"
            />
            <button
              onClick={() =>
                apiPost('/api/tools/text/layout', { text: layoutText })
                  .then((r) => {
                    setLayoutRes(r);
                    onRefreshWorkspace();
                  })
                  .catch((err) => onToast(err.message))
              }
              className="px-5 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-400 text-slate-950 font-semibold text-xs"
            >
              Исправить раскладку и транслитерировать
            </button>
            {layoutRes && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div
                  onClick={() => copyText(layoutRes.primary, onToast)}
                  className="p-3.5 rounded-xl bg-slate-950 border border-pink-500/30 cursor-pointer"
                >
                  <div className="text-pink-300 font-semibold mb-1">Исправленный текст:</div>
                  <div className="text-white text-sm">{layoutRes.primary}</div>
                </div>
                <div
                  onClick={() => copyText(layoutRes.translit, onToast)}
                  className="p-3.5 rounded-xl bg-slate-950 border border-white/10 cursor-pointer"
                >
                  <div className="text-slate-400 mb-1">ГОСТ Транслит:</div>
                  <div className="text-slate-200 font-mono">{layoutRes.translit}</div>
                </div>
                <div
                  onClick={() => copyText(layoutRes.slug, onToast)}
                  className="p-3.5 rounded-xl bg-slate-950 border border-white/10 cursor-pointer"
                >
                  <div className="text-slate-400 mb-1">URL Slug:</div>
                  <div className="text-sky-300 font-mono">{layoutRes.slug}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {txtTab === 'fonts' && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-4">
            <div className="flex gap-2">
              <input
                value={fontInput}
                onChange={(e) => setFontInput(e.target.value)}
                className="flex-1 rounded-xl bg-slate-950 border border-white/10 px-3.5 py-2 text-sm text-white"
              />
              <button
                onClick={() =>
                  apiPost('/api/tools/text/fonts', { text: fontInput })
                    .then((r) => {
                      setFontRes(r);
                      onRefreshWorkspace();
                    })
                    .catch((err) => onToast(err.message))
                }
                className="px-5 py-2 rounded-xl bg-pink-500 text-slate-950 font-semibold text-xs"
              >
                Стилизовать
              </button>
            </div>
            {fontRes && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {Object.entries({ ...fontRes.styles, ...fontRes.cases }).map(([name, val]) => (
                  <button
                    key={name}
                    onClick={() => copyText(String(val), onToast)}
                    className="p-3 rounded-xl bg-slate-950 border border-white/10 hover:border-pink-400/50 text-left"
                  >
                    <div className="text-[11px] text-slate-400">{name}</div>
                    <div className="text-sm text-white truncate mt-0.5">{String(val)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {txtTab === 'diff' && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <textarea
                rows={5}
                value={diffA}
                onChange={(e) => setDiffA(e.target.value)}
                placeholder="Исходный текст A…"
                className="rounded-xl bg-slate-950 border border-white/10 p-3 font-mono text-xs text-white"
              />
              <textarea
                rows={5}
                value={diffB}
                onChange={(e) => setDiffB(e.target.value)}
                placeholder="Вторая версия B (опционально для Diff)…"
                className="rounded-xl bg-slate-950 border border-white/10 p-3 font-mono text-xs text-white"
              />
            </div>
            <button
              onClick={() =>
                apiPost('/api/tools/text/diff', { text_a: diffA, text_b: diffB })
                  .then((r) => {
                    setDiffRes(r);
                    onRefreshWorkspace();
                  })
                  .catch((err) => onToast(err.message))
              }
              className="px-5 py-2 rounded-xl bg-pink-500 text-slate-950 font-semibold text-xs"
            >
              Сравнить тексты
            </button>
            {diffRes && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-white/10">Слов: <b>{diffRes.stats.words}</b></div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-white/10">Символов: <b>{diffRes.stats.chars_total}</b></div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-white/10">Чтение: <b>~{diffRes.stats.reading_time_sec} сек</b></div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-white/10">Разнообразие: <b>{diffRes.stats.lexical_diversity_pct}%</b></div>
                </div>
                {diffRes.diff && (
                  <pre className="p-3.5 rounded-xl bg-slate-950 border border-white/10 font-mono text-xs text-slate-200 overflow-x-auto">
                    {diffRes.diff.unified_diff || '(Тексты идентичны)'}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}

        {txtTab === 'random' && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'dice', label: '🎲 Бросок кубиков (NdM+K)' },
                { id: 'teams', label: '👥 Разделить на команды' },
                { id: 'pick', label: '🎯 Случайный жребий' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setRndMode(m.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    rndMode === m.id ? 'bg-pink-500 text-slate-950 border-pink-400 font-semibold' : 'bg-slate-950 text-slate-300 border-white/10'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {rndMode === 'dice' ? (
              <div className="space-y-3">
                <PolyhedralDice3D
                  onRollResult={(sides, val) => {
                    setDiceExpr(`1d${sides}`);
                    setRndRes({ mode: 'dice', expression: `1d${sides}`, rolls: [val], total: val });
                  }}
                />
                <input
                  value={diceExpr}
                  onChange={(e) => setDiceExpr(e.target.value)}
                  placeholder="2d6+3, 1d20, 4d8..."
                  className="w-full sm:w-64 rounded-xl bg-slate-950 border border-white/10 px-3.5 py-2 font-mono text-sm text-white"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  rows={3}
                  value={rndList}
                  onChange={(e) => setRndList(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 p-3 text-xs text-white"
                />
                {rndMode === 'teams' && (
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span>Количество команд:</span>
                    <input
                      type="number"
                      min={2}
                      max={8}
                      value={teamsCount}
                      onChange={(e) => setTeamsCount(Number(e.target.value))}
                      className="w-20 rounded-lg bg-slate-950 border border-white/10 px-2.5 py-1 text-white"
                    />
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() =>
                apiPost('/api/tools/text/random', {
                  mode: rndMode,
                  dice_expr: diceExpr,
                  items_raw: rndList,
                  teams_count: teamsCount,
                })
                  .then((r) => {
                    setRndRes(r);
                    onRefreshWorkspace();
                  })
                  .catch((err) => onToast(err.message))
              }
              className="px-5 py-2.5 rounded-xl bg-pink-500 text-slate-950 font-semibold text-xs flex items-center gap-1.5"
            >
              <Dices className="w-4 h-4" /> Запустить рандомайзер
            </button>
            {rndRes && (
              <div className="p-4 rounded-xl bg-slate-950 border border-pink-500/30 text-sm">
                {rndRes.mode === 'dice' && (
                  <div>
                    Бросок <b>{rndRes.expression}</b>: выпало <code>{JSON.stringify(rndRes.rolls)}</code> → Итог:{' '}
                    <b className="text-2xl text-pink-300 ml-1">{rndRes.total}</b>
                  </div>
                )}
                {rndRes.mode === 'pick' && (
                  <div>
                    🏆 Победитель жребия: <b className="text-xl text-emerald-300">{rndRes.winner}</b>
                  </div>
                )}
                {rndRes.mode === 'teams' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {rndRes.teams?.map((team: string[], idx: number) => (
                      <div key={idx} className="p-3 rounded-lg bg-slate-900 border border-white/10 text-xs">
                        <div className="font-semibold text-pink-300 mb-1">Команда #{idx + 1}</div>
                        <div className="text-slate-200">{team.join(', ')}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // HUB 8: WORKSPACE (HABIT TRACKER, TODOS, NOTES)
  // =========================================================================
  const addHabit = async () => {
    const clean = habitTitle.trim();
    if (!clean) {
      onToast('Введите название привычки');
      return;
    }
    try {
      await apiPost('/api/workspace/habits', {
        title: clean,
        icon: habitIcon,
        target_per_week: habitTarget,
      });
      setHabitTitle('');
      onRefreshWorkspace();
      onToast('Привычка добавлена');
    } catch (e: any) {
      onToast(e.message || 'Ошибка сохранения');
    }
  };

  const toggleHabitDay = async (habitId: number, dateStr?: string) => {
    try {
      await apiPost(`/api/workspace/habits/${habitId}/toggle`, { date: dateStr || null });
      onRefreshWorkspace();
    } catch (e: any) {
      onToast(e.message || 'Ошибка отметки');
    }
  };

  const removeHabit = async (habitId: number) => {
    try {
      await apiDelete(`/api/workspace/habits/${habitId}`);
      onRefreshWorkspace();
      onToast('Привычка удалена');
    } catch (e: any) {
      onToast(e.message || 'Ошибка удаления');
    }
  };

  const addNote = async () => {
    if (!noteContent.trim() && !noteTitle.trim()) {
      onToast('Введите текст заметки');
      return;
    }
    try {
      await apiPost('/api/workspace/notes', {
        title: noteTitle || 'Заметка',
        content: noteContent || noteTitle,
        tag: noteTag,
      });
      setNoteTitle('');
      setNoteContent('');
      onRefreshWorkspace();
      onToast('Заметка сохранена');
    } catch (e: any) {
      onToast(e.message || 'Ошибка сохранения заметки');
    }
  };

  const addTodo = async () => {
    if (!todoText.trim()) {
      onToast('Введите текст задачи');
      return;
    }
    try {
      await apiPost('/api/workspace/todos', {
        text: todoText,
        priority: todoPriority,
      });
      setTodoText('');
      onRefreshWorkspace();
    } catch (e: any) {
      onToast(e.message || 'Ошибка добавления задачи');
    }
  };

  const doneCount = todos.filter((t) => t.done).length;
  const pct = todos.length ? Math.round((doneCount / todos.length) * 100) : 0;

  const formatShortDay = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    const names = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    return `${names[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}`;
  };

  const noteTagLabels: Record<string, string> = {
    general: 'Общее',
    work: 'Работа',
    ideas: 'Идеи',
  };

  return (
    <div className="space-y-4 min-w-0">
      {/* Sub-tabs */}
      <div className="grid grid-cols-3 gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-white/10">
        {[
          { id: 'habits', tool: 'habit_tracker', label: `📅 Привычки (${habits.length})` },
          { id: 'todos', tool: 'todo_board', label: `☑️ Задачи (${doneCount}/${todos.length})` },
          { id: 'notes', tool: 'notes_vault', label: `📝 Заметки (${notes.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setWsTab(t.id as any);
              onSelectTool(t.tool);
            }}
            className={`py-2 px-1.5 rounded-lg text-[11px] sm:text-sm font-medium transition truncate ${
              wsTab === t.id
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 1. HABIT TRACKER */}
      {wsTab === 'habits' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 space-y-4">
          {habits.length > 0 && (
            <HabitRing3D
              doneCount={habits.filter((h) => h.done_today).length}
              totalCount={habits.length}
            />
          )}
          <div className="space-y-2.5 p-3.5 rounded-xl bg-slate-950/70 border border-white/10">
            <div className="text-xs font-medium text-slate-300">Новая привычка</div>
            <div className="flex flex-wrap gap-1.5">
              {['✅', '💪', '📚', '💧', '🏃', '🧘', '💤', '🍎'].map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setHabitIcon(ic)}
                  className={`w-8 h-8 rounded-lg border text-sm flex items-center justify-center transition ${
                    habitIcon === ic
                      ? 'bg-emerald-600/30 border-emerald-400'
                      : 'bg-slate-900 border-white/10 hover:border-white/25'
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={habitTitle}
                onChange={(e) => setHabitTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addHabit();
                }}
                placeholder="Например: Чтение 20 минут, Зарядка, Вода 2 л"
                className="flex-1 rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400"
              />
              <select
                value={habitTarget}
                onChange={(e) => setHabitTarget(Number(e.target.value))}
                className="rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-xs text-white"
              >
                <option value={7}>Цель: каждый день (7/нед)</option>
                <option value={5}>Цель: 5 раз в неделю</option>
                <option value={3}>Цель: 3 раза в неделю</option>
              </select>
              <button
                onClick={addHabit}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Добавить
              </button>
            </div>
          </div>

          {habits.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-400">
              Список привычек пуст. Добавьте первую привычку выше, чтобы отмечать дни выполнения.
            </div>
          ) : (
            <div className="space-y-3">
              {habits.map((h) => (
                <div key={h.id} className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        onClick={() => toggleHabitDay(h.id)}
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center text-sm shrink-0 transition ${
                          h.done_today
                            ? 'bg-emerald-600 border-emerald-400 text-white'
                            : 'bg-slate-900 border-white/15 text-slate-400 hover:border-emerald-400'
                        }`}
                        title="Отметить сегодня"
                      >
                        {h.done_today ? '✓' : h.icon}
                      </button>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                          {h.icon} {h.title}
                        </div>
                        <div className="text-xs text-slate-400">
                          За 7 дн.: <b className="text-slate-200">{h.done_week}/{h.target_per_week}</b>
                          {' • '}Серия: <b className="text-emerald-400">{h.streak} дн.</b>
                          {' • '}Всего: {h.total_completions}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeHabit(h.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-white/5"
                      title="Удалить привычку"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 7-day interactive grid */}
                  <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                    {h.last_7_days.map((cell) => (
                      <button
                        key={cell.date}
                        type="button"
                        onClick={() => toggleHabitDay(h.id, cell.date)}
                        className={`py-1.5 px-0.5 sm:px-1 rounded-lg border text-center transition min-w-0 ${
                          cell.completed
                            ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200 font-semibold'
                            : 'bg-slate-900 border-white/5 text-slate-400 hover:border-white/20'
                        }`}
                      >
                        <div className="text-[9px] sm:text-[10px] leading-tight truncate">{formatShortDay(cell.date)}</div>
                        <div className="text-xs mt-0.5">{cell.completed ? '✓' : '·'}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. TODOS */}
      {wsTab === 'todos' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
              <CheckSquare className="w-4 h-4" /> Список дел ({doneCount}/{todos.length})
            </div>
            <div className="flex items-center gap-3">
              {doneCount > 0 && (
                <button
                  onClick={() =>
                    apiPost('/api/workspace/todos/clear-done', {})
                      .then(onRefreshWorkspace)
                      .catch((e) => onToast(e.message))
                  }
                  className="text-xs text-slate-400 hover:text-rose-300"
                >
                  Очистить выполненные
                </button>
              )}
              <span className="text-xs font-mono text-emerald-300">{pct}%</span>
            </div>
          </div>

          <div className="h-2 rounded-full bg-slate-950 overflow-hidden border border-white/5">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="flex gap-2">
            <input
              value={todoText}
              onChange={(e) => setTodoText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addTodo();
              }}
              placeholder="Новая задача..."
              className="flex-1 rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
            />
            <select
              value={todoPriority}
              onChange={(e) => setTodoPriority(e.target.value as any)}
              className="rounded-xl bg-slate-950 border border-white/10 px-2.5 py-2 text-xs text-white"
            >
              <option value="normal">Обычная</option>
              <option value="high">Важная</option>
            </select>
            <button
              onClick={addTodo}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm"
            >
              +
            </button>
          </div>

          <div className="space-y-1.5">
            {todos.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">Список задач пуст</div>
            ) : (
              todos.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10"
                >
                  <button
                    onClick={() =>
                      apiPost(`/api/workspace/todos/${item.id}/toggle`, {})
                        .then(onRefreshWorkspace)
                        .catch((e) => onToast(e.message))
                    }
                    className="flex items-center gap-2.5 text-left flex-1 min-w-0"
                  >
                    <span className="text-base">{item.done ? '✅' : '⬜'}</span>
                    <span
                      className={`text-sm truncate ${
                        item.done ? 'line-through text-slate-500' : 'text-slate-100'
                      }`}
                    >
                      {item.priority === 'high' && !item.done ? '❗ ' : ''}
                      {item.text}
                    </span>
                  </button>
                  <button
                    onClick={() =>
                      apiDelete(`/api/workspace/todos/${item.id}`)
                        .then(onRefreshWorkspace)
                        .catch((e) => onToast(e.message))
                    }
                    className="p-1.5 text-slate-500 hover:text-rose-400"
                    title="Удалить"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 3. NOTES */}
      {wsTab === 'notes' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-teal-300 font-semibold text-sm">
              <StickyNote className="w-4 h-4" /> Заметки ({notes.length})
            </div>
          </div>

          <div className="space-y-2 p-3 rounded-xl bg-slate-950/70 border border-white/10">
            <div className="flex gap-2">
              <input
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Заголовок..."
                className="flex-1 rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm text-white"
              />
              <select
                value={noteTag}
                onChange={(e) => setNoteTag(e.target.value)}
                className="rounded-lg bg-slate-900 border border-white/10 px-2.5 py-2 text-xs text-white"
              >
                <option value="general">Общее</option>
                <option value="work">Работа</option>
                <option value="ideas">Идеи</option>
              </select>
            </div>
            <textarea
              rows={3}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Текст заметки..."
              className="w-full rounded-lg bg-slate-900 border border-white/10 p-2.5 text-sm text-white"
            />
            <button
              onClick={addNote}
              className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Сохранить заметку
            </button>
          </div>

          <div className="space-y-2">
            {notes.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">Заметок пока нет</div>
            ) : (
              notes.map((n) => (
                <div key={n.id} className="p-3.5 rounded-xl bg-slate-950 border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm text-white flex items-center gap-1.5 min-w-0">
                      {n.pinned === 1 && <span className="text-amber-400 shrink-0">📌</span>}
                      <span className="truncate">{n.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-300 shrink-0">
                        {noteTagLabels[n.tag] || n.tag}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => copyText(`${n.title}\n${n.content}`, onToast)}
                        className="px-2 py-1 rounded text-[11px] text-slate-400 hover:text-white hover:bg-white/5"
                        title="Скопировать"
                      >
                        Коп.
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          apiPost(`/api/workspace/notes/${n.id}/pin`, {})
                            .then(onRefreshWorkspace)
                            .catch((e) => onToast(e.message))
                        }
                        className="p-1.5 text-slate-400 hover:text-amber-300"
                        title="Закрепить"
                      >
                        <Pin className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          apiDelete(`/api/workspace/notes/${n.id}`)
                            .then(onRefreshWorkspace)
                            .catch((e) => onToast(e.message))
                        }
                        className="p-1.5 text-slate-400 hover:text-rose-400"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 whitespace-pre-wrap break-words">{n.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
