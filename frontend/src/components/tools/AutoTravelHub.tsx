import React, { useEffect, useState } from 'react';
import { Car, CheckSquare, Compass, Fuel, Globe2, Plus, Search, Star, Trash2 } from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api';

interface Props {
  activeTool: string;
  onSelectTool: (t: string) => void;
  favorites: string[];
  onToggleFav: (id: string) => void;
  onSync: () => void;
  onToast: (msg: string) => void;
}

type AutoTab = 'fuel_trip' | 'tire_calc' | 'timezone_planner' | 'luggage_checklist' | 'plate_codes';

const LUGGAGE_PRESETS: Record<string, string[]> = {
  vacation: [
    'Паспорт / загранпаспорт и билеты',
    'Банковские карты и наличные',
    'Зарядка телефона и Powerbank',
    'Аптечка (болеутоляющее, пластыри, антисептик)',
    'Солнцезащитный крем и очки',
    'Купальник / плавки и сланцы',
    'Сменная одежда и бельё',
    'Зубная щётка и гигиенический набор',
  ],
  business: [
    'Паспорт и командировочные документы',
    'Ноутбук, блок питания и кабель USB-C',
    'Презентация на флешке / офлайн-копия',
    'Деловой комплект одежды',
    'Визитки / QR-визитка в телефоне',
    'Наушники с микрофоном для созвонов',
    'Powerbank и переходник для розетки',
  ],
  hiking: [
    'Рюкзак, дождевик и гермочехол',
    'Треккинговая обувь и тёплые носки',
    'Налобный фонарь + запасные батарейки',
    'Термос / фляга для воды (1.5 л)',
    'Походная аптечка и эластичный бинт',
    'Офлайн-карты и заряженный Powerbank',
    'Спички в герметичной упаковке / зажигалка',
  ],
};

const LUGGAGE_STORAGE_KEY = 'mt_luggage_v5';

export const AutoTravelHub: React.FC<Props> = ({
  activeTool,
  onSelectTool,
  favorites,
  onToggleFav,
  onSync,
  onToast,
}) => {
  const [tab, setTab] = useState<AutoTab>(() =>
    (['fuel_trip', 'tire_calc', 'timezone_planner', 'luggage_checklist', 'plate_codes'] as const).includes(activeTool as any)
      ? (activeTool as AutoTab)
      : 'fuel_trip'
  );

  useEffect(() => {
    if ((['fuel_trip', 'tire_calc', 'timezone_planner', 'luggage_checklist', 'plate_codes'] as const).includes(activeTool as any)) {
      setTab(activeTool as AutoTab);
    }
  }, [activeTool]);

  // 1. Fuel
  const [distKm, setDistKm] = useState(450);
  const [consL, setConsL] = useState(8.2);
  const [fuelPrice, setFuelPrice] = useState(61.5);
  const [pax, setPax] = useState(2);
  const [tolls, setTolls] = useState(0);
  const [roundTrip, setRoundTrip] = useState(false);
  const [fuelRes, setFuelRes] = useState<any>(null);

  // 2. Tires
  const [oldTire, setOldTire] = useState('205/55 R16');
  const [newTire, setNewTire] = useState('215/60 R16');
  const [tireRes, setTireRes] = useState<any>(null);

  // 3. World Timezones
  const [mskHour, setMskHour] = useState<number>(() => new Date().getUTCHours() + 3);
  const [tzCities, setTzCities] = useState<any[]>([]);

  // 4. Luggage
  const [lugPreset, setLugPreset] = useState<'vacation' | 'business' | 'hiking'>('vacation');
  const [lugItems, setLugItems] = useState<Array<{ text: string; done: boolean }>>(() => {
    try {
      const saved = localStorage.getItem(LUGGAGE_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return LUGGAGE_PRESETS.vacation.map((t) => ({ text: t, done: false }));
  });
  const [newLugText, setNewLugText] = useState('');

  // 5. Plate codes
  const [plateQuery, setPlateQuery] = useState('777');
  const [plateHits, setPlateHits] = useState<any[]>([]);

  const runFuel = async (silent = false) => {
    try {
      const r = await apiPost('/api/v2/v5/fuel-trip', {
        distance_km: distKm,
        consumption_l_100: consL,
        fuel_price: fuelPrice,
        passengers: pax,
        tolls_rub: tolls,
        round_trip: roundTrip,
      });
      setFuelRes(r);
      if (!silent) onSync();
    } catch (e: any) {
      if (!silent) onToast(e.message);
    }
  };

  const runTires = async (silent = false) => {
    try {
      const r = await apiPost('/api/v2/v5/tires-compare', { old_spec: oldTire, new_spec: newTire });
      setTireRes(r);
      if (!silent) onSync();
    } catch (e: any) {
      if (!silent) onToast(e.message);
    }
  };

  const loadTz = async (hr: number) => {
    try {
      const r = await apiGet(`/api/v2/v5/world-time?msk_hour=${hr}`);
      setTzCities(r.cities || []);
    } catch {
      // ignore
    }
  };

  const searchPlates = async (q: string) => {
    try {
      const r = await apiGet(`/api/v2/v5/plate-codes?q=${encodeURIComponent(q)}`);
      setPlateHits(r.results || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    runFuel(true);
    runTires(true);
    loadTz(mskHour);
    searchPlates(plateQuery);
  }, []);

  useEffect(() => {
    loadTz(mskHour);
  }, [mskHour]);

  useEffect(() => {
    const t = window.setTimeout(() => searchPlates(plateQuery), 150);
    return () => window.clearTimeout(t);
  }, [plateQuery]);

  const persistLuggage = (next: Array<{ text: string; done: boolean }>) => {
    setLugItems(next);
    try {
      localStorage.setItem(LUGGAGE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const isFav = favorites.includes(tab);

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-900/80 p-2">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'fuel_trip', label: '⛽ Топливо и Маршрут' },
            { id: 'tire_calc', label: '🛞 Шины и Клиренс' },
            { id: 'timezone_planner', label: '🌐 Часовые Пояса' },
            { id: 'luggage_checklist', label: '🧳 Чек-лист Багажа' },
            { id: 'plate_codes', label: '🚘 Коды Регионов РФ' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id as AutoTab);
                onSelectTool(t.id);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                tab === t.id ? 'bg-sky-500 text-slate-950' : 'text-slate-300 hover:bg-white/5'
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

      {/* 1. FUEL & TRIP */}
      {tab === 'fuel_trip' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-6 rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-3">
            <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
              <Fuel className="w-5 h-5 text-sky-400" /> Расход Топлива и Стоимость Поездки
            </h3>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Расстояние (км)</label>
                <input type="number" value={distKm} onChange={(e) => setDistKm(Number(e.target.value) || 0)} className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Расход (л / 100 км)</label>
                <input type="number" step="0.1" value={consL} onChange={(e) => setConsL(Number(e.target.value) || 0)} className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Цена 1 литра (₽)</label>
                <input type="number" step="0.5" value={fuelPrice} onChange={(e) => setFuelPrice(Number(e.target.value) || 0)} className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Пассажиров (чел.)</label>
                <input type="number" min={1} value={pax} onChange={(e) => setPax(Number(e.target.value) || 1)} className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Платные дороги (₽)</label>
                <input type="number" value={tolls} onChange={(e) => setTolls(Number(e.target.value) || 0)} className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-white" />
              </div>
              <label className="flex items-center gap-2 pt-5 text-slate-200 cursor-pointer">
                <input type="checkbox" checked={roundTrip} onChange={(e) => setRoundTrip(e.target.checked)} />
                Туда и обратно (×2)
              </label>
            </div>
            <button
              type="button"
              onClick={() => runFuel(false)}
              className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-sm transition"
            >
              Рассчитать поездку
            </button>
          </div>

          <div className="lg:col-span-6 rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5">
            {fuelRes && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-sky-400/30">
                  <div className="text-xs text-slate-400">С человека</div>
                  <div className="text-2xl font-bold text-sky-300">{fuelRes.per_person} ₽</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-400/30">
                  <div className="text-xs text-slate-400">Общий бюджет</div>
                  <div className="text-2xl font-bold text-emerald-300">{fuelRes.total_cost} ₽</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-white/10">
                  <div className="text-xs text-slate-400">Потребуется топлива</div>
                  <div className="text-lg font-bold text-white">{fuelRes.liters_needed} л</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-white/10">
                  <div className="text-xs text-slate-400">Дистанция / 1 км</div>
                  <div className="text-lg font-bold text-white">
                    {fuelRes.total_distance_km} км ({fuelRes.cost_per_km} ₽/км)
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. TIRE CALCULATOR */}
      {tab === 'tire_calc' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-3.5">
            <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
              <Compass className="w-5 h-5 text-sky-400" /> Шинный Калькулятор и Клиренс
            </h3>
            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Штатный размер шины</label>
                <input value={oldTire} onChange={(e) => setOldTire(e.target.value)} placeholder="205/55 R16" className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Новый размер шины</label>
                <input value={newTire} onChange={(e) => setNewTire(e.target.value)} placeholder="215/60 R16" className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => runTires(false)}
              className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-sm transition"
            >
              Сравнить размеры
            </button>
          </div>

          <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-3.5">
            {tireRes && (
              <>
                <div
                  className={`p-3 rounded-xl border text-xs font-semibold ${
                    tireRes.compatible
                      ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-200'
                      : 'bg-amber-500/15 border-amber-400/35 text-amber-200'
                  }`}
                >
                  {tireRes.verdict} (изменение диаметра: {tireRes.diameter_diff_pct > 0 ? `+${tireRes.diameter_diff_pct}` : tireRes.diameter_diff_pct}%)
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                  <svg viewBox="0 0 180 180" className="w-36 h-36 mx-auto">
                    <circle cx="90" cy="90" r="68" fill="none" stroke="#38bdf8" strokeWidth="6" strokeDasharray="5 3" />
                    <circle
                      cx="90"
                      cy="90"
                      r={Math.max(44, Math.min(82, 68 * (tireRes.new.diameter_mm / tireRes.old.diameter_mm)))}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="5"
                    />
                    <circle cx="90" cy="90" r="36" fill="#0f172a" stroke="#64748b" strokeWidth="3" />
                  </svg>
                  <div className="sm:col-span-2 grid grid-cols-2 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-white/10">
                      <div className="text-slate-400">Изменение клиренса</div>
                      <div className="text-lg font-bold text-emerald-300">
                        {tireRes.clearance_diff_mm > 0 ? `+${tireRes.clearance_diff_mm}` : tireRes.clearance_diff_mm} мм
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-white/10">
                      <div className="text-slate-400">При 100 км/ч реально</div>
                      <div className="text-lg font-bold text-sky-300">{tireRes.real_speed_at_100kmh} км/ч</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-white/10">
                      <div className="text-slate-400">Диаметр старой</div>
                      <div className="text-base font-bold text-white">{tireRes.old.diameter_mm} мм</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-white/10">
                      <div className="text-slate-400">Диаметр новой</div>
                      <div className="text-base font-bold text-white">{tireRes.new.diameter_mm} мм</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 3. WORLD TIMEZONES & MEETING PLANNER */}
      {tab === 'timezone_planner' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
              <Globe2 className="w-5 h-5 text-sky-400" /> Мировые Часовые Пояса и Планер Созвонов
            </h3>
            <span className="text-xs text-sky-300 font-semibold">
              Выбрано МСК: {String(Math.floor(((mskHour % 24) + 24) % 24)).padStart(2, '0')}:00
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={23}
            value={((mskHour % 24) + 24) % 24}
            onChange={(e) => setMskHour(Number(e.target.value))}
            className="w-full accent-sky-400"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 text-xs">
            {tzCities.map((c) => (
              <div
                key={c.city}
                className={`p-3 rounded-xl border ${
                  c.status === 'Рабочие часы'
                    ? 'bg-emerald-500/10 border-emerald-400/30'
                    : c.status === 'Ночь'
                    ? 'bg-slate-950/90 border-white/5 opacity-75'
                    : 'bg-slate-950 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-200 truncate">
                    {c.flag} {c.city}
                  </span>
                  <span className="text-[10px] text-slate-400">{c.utc_offset}</span>
                </div>
                <div className="text-xl font-mono font-bold text-white mt-1">{c.time}</div>
                <div className="text-[11px] text-slate-400">{c.status}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. LUGGAGE CHECKLIST */}
      {tab === 'luggage_checklist' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-emerald-400" /> Чек-лист Сборов в Поездку
            </h3>
            <div className="flex gap-1.5">
              {[
                { id: 'vacation', label: 'Отпуск / Море' },
                { id: 'business', label: 'Командировка' },
                { id: 'hiking', label: 'Поход / Горы' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setLugPreset(p.id as any);
                    persistLuggage(LUGGAGE_PRESETS[p.id].map((t) => ({ text: t, done: false })));
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                    lugPreset === p.id ? 'bg-emerald-500 text-slate-950 font-semibold' : 'bg-slate-950 text-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <input
              value={newLugText}
              onChange={(e) => setNewLugText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newLugText.trim()) {
                  persistLuggage([...lugItems, { text: newLugText.trim(), done: false }]);
                  setNewLugText('');
                }
              }}
              placeholder="Добавить свою вещь в список…"
              className="flex-1 rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs sm:text-sm text-white"
            />
            <button
              type="button"
              onClick={() => {
                if (!newLugText.trim()) return;
                persistLuggage([...lugItems, { text: newLugText.trim(), done: false }]);
                setNewLugText('');
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-semibold text-xs flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Добавить
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {lugItems.map((it, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/90 border border-white/10 text-xs"
              >
                <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={it.done}
                    onChange={() => {
                      const next = lugItems.map((x, i) => (i === idx ? { ...x, done: !x.done } : x));
                      persistLuggage(next);
                    }}
                    className="accent-emerald-400"
                  />
                  <span className={it.done ? 'line-through text-slate-500' : 'text-slate-100'}>{it.text}</span>
                </label>
                <button
                  type="button"
                  onClick={() => persistLuggage(lugItems.filter((_, i) => i !== idx))}
                  className="text-slate-500 hover:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. RUSSIAN REGION PLATE CODES */}
      {tab === 'plate_codes' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
              <Car className="w-5 h-5 text-sky-400" /> Автомобильные Коды Регионов России
            </h3>
            {/* Visual Russian License Plate Badge */}
            <div className="inline-flex items-center rounded-lg bg-white text-slate-950 border-2 border-slate-800 px-3 py-1 font-mono font-bold text-sm shadow">
              <span>А 777 АА</span>
              <span className="mx-2 h-5 w-0.5 bg-slate-800" />
              <span className="text-xs">{plateHits[0]?.codes?.[0] || '777'} RUS 🇷🇺</span>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              value={plateQuery}
              onChange={(e) => setPlateQuery(e.target.value)}
              placeholder="Введите цифры региона (77, 116, 198, 23, 95) или город (Казань, Сочи)…"
              className="w-full rounded-xl bg-slate-950 border border-white/10 pl-10 pr-3 py-2.5 text-sm text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
            {plateHits.map((r) => (
              <div key={r.region} className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-1">
                <div className="font-semibold text-white">{r.region}</div>
                <div className="text-slate-400">Центр: {r.capital}</div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {r.codes.map((c: string) => (
                    <span key={c} className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-200 font-mono font-semibold">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
