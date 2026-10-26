import React, { useEffect, useRef, useState } from 'react';
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

type LuggagePreset = 'vacation' | 'business' | 'hiking';
type LuggageItem = { text: string; done: boolean };
const LUGGAGE_STORAGE_PREFIX = 'mt_luggage_v6:';
const LUGGAGE_LEGACY_STORAGE_KEY = 'mt_luggage_v5';

const normalizeLuggage = (raw: unknown): LuggageItem[] | null => {
  if (!Array.isArray(raw)) return null;
  return raw
    .filter((item): item is { text: string; done?: boolean } => !!item && typeof item === 'object' && typeof (item as any).text === 'string')
    .map((item) => ({ text: item.text.trim().slice(0, 120), done: item.done === true }))
    .filter((item) => item.text.length > 0)
    .slice(0, 100);
};

const readLuggage = (preset: LuggagePreset): LuggageItem[] => {
  try {
    const saved = localStorage.getItem(`${LUGGAGE_STORAGE_PREFIX}${preset}`);
    if (saved !== null) return normalizeLuggage(JSON.parse(saved)) || LUGGAGE_PRESETS[preset].map((text) => ({ text, done: false }));
    if (preset === 'vacation') {
      const legacy = localStorage.getItem(LUGGAGE_LEGACY_STORAGE_KEY);
      if (legacy !== null) {
        const migrated = normalizeLuggage(JSON.parse(legacy));
        if (migrated) {
          localStorage.setItem(`${LUGGAGE_STORAGE_PREFIX}${preset}`, JSON.stringify(migrated));
          return migrated;
        }
      }
    }
  } catch {
    // Corrupt or inaccessible local storage falls back to a safe starter list.
  }
  return LUGGAGE_PRESETS[preset].map((text) => ({ text, done: false }));
};

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
  const [fuelLoading, setFuelLoading] = useState(false);
  const [fuelError, setFuelError] = useState('');
  const fuelRequestId = useRef(0);

  // 2. Tires
  const [oldTire, setOldTire] = useState('205/55 R16');
  const [newTire, setNewTire] = useState('215/60 R16');
  const [tireRes, setTireRes] = useState<any>(null);
  const [tireLoading, setTireLoading] = useState(false);
  const [tireError, setTireError] = useState('');
  const tireRequestId = useRef(0);

  // 3. World Timezones (selected Moscow date/time, DST-aware in each city)
  const [mskHour, setMskHour] = useState<number>(() => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Moscow', hour: '2-digit', hourCycle: 'h23' }).format(new Date())));
  const [tzDate, setTzDate] = useState(() => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const part = (type: string) => parts.find((entry) => entry.type === type)?.value || '01';
    return `${part('year')}-${part('month')}-${part('day')}`;
  });
  const [tzCities, setTzCities] = useState<any[]>([]);
  const [tzLoading, setTzLoading] = useState(true);
  const [tzError, setTzError] = useState('');
  const timezoneRequestId = useRef(0);

  // 4. Luggage
  const [lugPreset, setLugPreset] = useState<LuggagePreset>('vacation');
  const [lugItems, setLugItems] = useState<LuggageItem[]>(() => readLuggage('vacation'));
  const doneLuggageCount = lugItems.filter((item) => item.done).length;
  const luggageProgress = lugItems.length ? Math.round((doneLuggageCount / lugItems.length) * 100) : 0;
  const [newLugText, setNewLugText] = useState('');

  // 5. Plate codes
  const [plateQuery, setPlateQuery] = useState('777');
  const [plateHits, setPlateHits] = useState<any[]>([]);
  const [plateLoading, setPlateLoading] = useState(true);
  const [plateError, setPlateError] = useState('');
  const plateRequestId = useRef(0);

  const invalidateFuel = () => {
    fuelRequestId.current += 1;
    setFuelRes(null);
    setFuelError('');
    setFuelLoading(false);
  };
  const invalidateTires = () => {
    tireRequestId.current += 1;
    setTireRes(null);
    setTireError('');
    setTireLoading(false);
  };

  const runFuel = async (silent = false) => {
    const requestId = ++fuelRequestId.current;
    setFuelRes(null);
    setFuelError('');
    setFuelLoading(true);
    try {
      const r = await apiPost('/api/v2/v5/fuel-trip', {
        distance_km: distKm,
        consumption_l_100: consL,
        fuel_price: fuelPrice,
        passengers: pax,
        tolls_rub: tolls,
        round_trip: roundTrip,
      });
      if (requestId !== fuelRequestId.current) return;
      setFuelRes(r);
      if (!silent) onSync();
    } catch (e: any) {
      if (requestId !== fuelRequestId.current) return;
      setFuelError(e?.message || 'Не удалось рассчитать поездку');
      if (!silent) onToast(e?.message || 'Не удалось рассчитать поездку');
    } finally {
      if (requestId === fuelRequestId.current) setFuelLoading(false);
    }
  };

  const runTires = async (silent = false) => {
    const requestId = ++tireRequestId.current;
    setTireRes(null);
    setTireError('');
    setTireLoading(true);
    try {
      const r = await apiPost('/api/v2/v5/tires-compare', { old_spec: oldTire, new_spec: newTire });
      if (requestId !== tireRequestId.current) return;
      setTireRes(r);
      if (!silent) onSync();
    } catch (e: any) {
      if (requestId !== tireRequestId.current) return;
      setTireError(e?.message || 'Не удалось сравнить размеры');
      if (!silent) onToast(e?.message || 'Не удалось сравнить размеры');
    } finally {
      if (requestId === tireRequestId.current) setTireLoading(false);
    }
  };

  const loadTz = async (hr: number, day: string) => {
    const requestId = ++timezoneRequestId.current;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      setTzCities([]);
      setTzLoading(false);
      setTzError('Выберите корректную дату для планирования');
      return;
    }
    setTzLoading(true);
    setTzError('');
    setTzCities([]);
    try {
      const params = new URLSearchParams({ msk_hour: String(hr), local_date: day });
      const r = await apiGet(`/api/v2/v5/world-time?${params.toString()}`);
      if (requestId === timezoneRequestId.current) setTzCities(r.cities || []);
    } catch (error: any) {
      if (requestId === timezoneRequestId.current) setTzError(error?.message || 'Не удалось рассчитать часовые пояса');
    } finally {
      if (requestId === timezoneRequestId.current) setTzLoading(false);
    }
  };

  const searchPlates = async (q: string) => {
    const currentRequest = ++plateRequestId.current;
    setPlateLoading(true);
    setPlateError('');
    try {
      const r = await apiGet(`/api/v2/v5/plate-codes?q=${encodeURIComponent(q)}`);
      if (currentRequest === plateRequestId.current) setPlateHits(r.results || []);
    } catch (error: any) {
      if (currentRequest === plateRequestId.current) setPlateError(error?.message || 'Не удалось найти код региона');
    } finally {
      if (currentRequest === plateRequestId.current) setPlateLoading(false);
    }
  };

  useEffect(() => {
    runFuel(true);
    runTires(true);
  }, []);

  useEffect(() => {
    void loadTz(mskHour, tzDate);
  }, [mskHour, tzDate]);

  useEffect(() => {
    const t = window.setTimeout(() => searchPlates(plateQuery), 150);
    return () => window.clearTimeout(t);
  }, [plateQuery]);

  const persistLuggage = (next: LuggageItem[], preset: LuggagePreset = lugPreset) => {
    const safeItems = normalizeLuggage(next) || [];
    setLugItems(safeItems);
    try {
      localStorage.setItem(`${LUGGAGE_STORAGE_PREFIX}${preset}`, JSON.stringify(safeItems));
    } catch {
      onToast('Не удалось сохранить список в этом браузере');
    }
  };

  const addLuggageItem = () => {
    const text = newLugText.trim().slice(0, 120);
    if (!text) return;
    if (lugItems.length >= 100) {
      onToast('В одном списке может быть не больше 100 вещей');
      return;
    }
    if (lugItems.some((item) => item.text.toLocaleLowerCase() === text.toLocaleLowerCase())) {
      onToast('Такая вещь уже есть в списке');
      return;
    }
    persistLuggage([...lugItems, { text, done: false }]);
    setNewLugText('');
  };

  const exportLuggage = () => {
    const lines = [`Чек-лист поездки · ${lugPreset}`, ...lugItems.map((item) => `${item.done ? '[x]' : '[ ]'} ${item.text}`)];
    const blobUrl = URL.createObjectURL(new Blob([lines.join('\\n')], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `trip-checklist-${lugPreset}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
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
                <input type="number" min="1" max="100000" value={distKm} onChange={(e) => { invalidateFuel(); setDistKm(Number(e.target.value) || 0); }} className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Расход (л / 100 км)</label>
                <input type="number" min="0.1" max="60" step="0.1" value={consL} onChange={(e) => { invalidateFuel(); setConsL(Number(e.target.value) || 0); }} className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Цена 1 литра (₽)</label>
                <input type="number" min="0" max="1000" step="0.5" value={fuelPrice} onChange={(e) => { invalidateFuel(); setFuelPrice(Number(e.target.value) || 0); }} className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Пассажиров (чел.)</label>
                <input type="number" min={1} max={60} value={pax} onChange={(e) => { invalidateFuel(); setPax(Number(e.target.value) || 1); }} className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Платные дороги (₽)</label>
                <input type="number" min="0" max="10000000" value={tolls} onChange={(e) => { invalidateFuel(); setTolls(Number(e.target.value) || 0); }} className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-white" />
              </div>
              <label className="flex items-center gap-2 pt-5 text-slate-200 cursor-pointer">
                <input type="checkbox" checked={roundTrip} onChange={(e) => { invalidateFuel(); setRoundTrip(e.target.checked); }} />
                Туда и обратно (×2)
              </label>
            </div>
            <button
              type="button"
              onClick={() => runFuel(false)}
              disabled={fuelLoading}
              className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-sm transition disabled:opacity-50"
            >
              {fuelLoading ? 'Считаем…' : 'Рассчитать поездку'}
            </button>
          </div>

          <div className="lg:col-span-6 rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-3">
            {fuelLoading && <p role="status" className="text-xs text-sky-200">Считаем топливо, платные дороги и долю на человека…</p>}
            {fuelError && <div className="flex items-center gap-2"><p role="alert" className="text-xs text-rose-200">{fuelError}</p><button type="button" onClick={() => void runFuel(false)} className="rounded-lg border border-rose-300/20 px-2.5 py-1 text-[10px] text-rose-100">Повторить</button></div>}
            {!fuelLoading && !fuelError && !fuelRes && <p className="text-xs text-slate-400">Измените параметры и пересчитайте поездку.</p>}
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
                  <div className="text-xs text-slate-400">Топливо · {fuelRes.liters_needed} л</div>
                  <div className="text-lg font-bold text-white">{fuelRes.fuel_cost} ₽</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-white/10">
                  <div className="text-xs text-slate-400">Платные дороги</div>
                  <div className="text-lg font-bold text-white">{fuelRes.tolls_cost} ₽</div>
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
                <input value={oldTire} maxLength={20} onChange={(e) => { invalidateTires(); setOldTire(e.target.value); }} placeholder="205/55 R16" className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Новый размер шины</label>
                <input value={newTire} maxLength={20} onChange={(e) => { invalidateTires(); setNewTire(e.target.value); }} placeholder="215/60 R16" className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => runTires(false)}
              disabled={tireLoading}
              className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-sm transition disabled:opacity-50"
            >
              {tireLoading ? 'Сравниваем…' : 'Сравнить размеры'}
            </button>
          </div>

          <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-3.5">
            {tireLoading && <p role="status" className="text-xs text-sky-200">Проверяем размеры колёс…</p>}
            {tireError && <div className="flex items-center gap-2"><p role="alert" className="text-xs text-rose-200">{tireError}</p><button type="button" onClick={() => void runTires(false)} className="rounded-lg border border-rose-300/20 px-2.5 py-1 text-[10px] text-rose-100">Повторить</button></div>}
            {!tireLoading && !tireError && !tireRes && <p className="text-xs text-slate-400">Введите размеры обеих шин и запустите сравнение.</p>}
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
                <p className="rounded-lg border border-amber-300/15 bg-amber-300/5 p-2.5 text-[11px] leading-relaxed text-amber-100/80">{tireRes.fitment_note}</p>

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
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-[11px] text-slate-400">Дата в Москве
                <input type="date" value={tzDate} onChange={(e) => setTzDate(e.target.value)} className="ml-2 rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-xs text-white" />
              </label>
              <span className="text-xs text-sky-300 font-semibold">
                МСК: {String(Math.floor(((mskHour % 24) + 24) % 24)).padStart(2, '0')}:00
              </span>
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={23}
            value={((mskHour % 24) + 24) % 24}
            onChange={(e) => setMskHour(Number(e.target.value))}
            className="w-full accent-sky-400"
          />
          {tzLoading && <p role="status" className="text-xs text-sky-200">Рассчитываем местное время с учётом сезонного перевода часов…</p>}
          {tzError && <div className="flex items-center gap-2"><p role="alert" className="text-xs text-rose-200">{tzError}</p><button type="button" onClick={() => void loadTz(mskHour, tzDate)} className="rounded-lg border border-rose-300/20 px-2.5 py-1 text-[10px] text-rose-100">Повторить</button></div>}
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
                <div className="text-[10px] text-slate-400">{c.date}{c.day_offset > 0 ? ` · +${c.day_offset} день` : c.day_offset < 0 ? ` · ${c.day_offset} день` : ''}</div>
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
                    const nextPreset = p.id as LuggagePreset;
                    setLugPreset(nextPreset);
                    setLugItems(readLuggage(nextPreset));
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

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={newLugText}
              maxLength={120}
              disabled={lugItems.length >= 100}
              onChange={(e) => setNewLugText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addLuggageItem(); }}
              placeholder={lugItems.length >= 100 ? 'Достигнут лимит в 100 вещей' : 'Добавить свою вещь в список…'}
              className="min-w-0 flex-1 rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs sm:text-sm text-white disabled:opacity-50"
            />
            <button
              type="button"
              onClick={addLuggageItem}
              disabled={!newLugText.trim() || lugItems.length >= 100}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Добавить
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/70 p-3">
            <div className="min-w-[180px] flex-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-white">Собрано: {doneLuggageCount} из {lugItems.length}</span>
                <span className="text-emerald-300">{luggageProgress}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Готовность чек-листа" aria-valuemin={0} aria-valuemax={100} aria-valuenow={luggageProgress}>
                <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${luggageProgress}%` }} />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={exportLuggage} disabled={lugItems.length === 0} className="rounded-lg border border-sky-300/20 bg-sky-400/10 px-2.5 py-1.5 text-[10px] text-sky-100 disabled:opacity-40">Скачать .txt</button>
              <button type="button" onClick={() => persistLuggage(lugItems.filter((item) => !item.done))} disabled={doneLuggageCount === 0} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] text-slate-200 disabled:opacity-40">Удалить собранное</button>
            </div>
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
              onChange={(e) => {
                plateRequestId.current += 1;
                setPlateHits([]);
                setPlateError('');
                setPlateLoading(true);
                setPlateQuery(e.target.value);
              }}
              placeholder="Введите цифры региона (77, 116, 198, 23, 95) или город (Казань, Сочи)…"
              className="w-full rounded-xl bg-slate-950 border border-white/10 pl-10 pr-3 py-2.5 text-sm text-white"
            />
          </div>
          {plateLoading && <p role="status" className="text-xs text-sky-200">Ищем автомобильный код…</p>}
          {plateError && <div className="flex flex-wrap items-center gap-2"><p role="alert" className="text-xs text-rose-200">{plateError}</p><button type="button" onClick={() => void searchPlates(plateQuery)} className="rounded-lg border border-rose-300/20 px-2.5 py-1 text-[10px] text-rose-100">Повторить</button></div>}
          {!plateLoading && !plateError && plateHits.length === 0 && <p role="status" className="text-xs text-slate-400">По этому запросу коды не найдены.</p>}

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
