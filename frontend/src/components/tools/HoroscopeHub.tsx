import React, { useEffect, useState } from 'react';
import { Copy, Sparkles } from 'lucide-react';
import { apiGet, apiPost, copyText } from '../../lib/api';
import { ZodiacCelestial3D } from '../three/Interactive3DScenes';

interface Props {
  activeTool: string;
  onSelectTool?: (t: string) => void;
  onSync?: () => void;
  onToast: (msg: string) => void;
}

interface ZodiacSign {
  id: string;
  name: string;
  symbol: string;
  dates: string;
  element: string;
  quality: string;
  ruler: string;
  strengths: string;
  weaknesses: string;
  best_matches: string[];
}

export const HoroscopeHub: React.FC<Props> = ({ activeTool, onSelectTool, onSync, onToast }) => {
  const [subTab, setSubTab] = useState<'horoscope' | 'birth' | 'compat'>('horoscope');
  const [signs, setSigns] = useState<ZodiacSign[]>([]);

  // 1. Horoscope state
  const [selectedSign, setSelectedSign] = useState('aries');
  const [period, setPeriod] = useState<'today' | 'tomorrow' | 'week'>('today');
  const [horoData, setHoroData] = useState<any>(null);
  const [loadingHoro, setLoadingHoro] = useState(false);

  // 2. Birth date state
  const [birthInput, setBirthInput] = useState('2002-05-15');
  const [birthRes, setBirthRes] = useState<any>(null);
  const [loadingBirth, setLoadingBirth] = useState(false);

  // 3. Compatibility state
  const [firstDate, setFirstDate] = useState('2002-05-15');
  const [secondDate, setSecondDate] = useState('2003-09-21');
  const [name1, setName1] = useState('');
  const [name2, setName2] = useState('');
  const [compatMode, setCompatMode] = useState<'dates' | 'signs'>('dates');
  const [sign1, setSign1] = useState('aries');
  const [sign2, setSign2] = useState('libra');
  const [compatRes, setCompatRes] = useState<any>(null);
  const [loadingCompat, setLoadingCompat] = useState(false);

  useEffect(() => {
    if (activeTool === 'zodiac_info') setSubTab('birth');
    else if (activeTool === 'compat_calc') setSubTab('compat');
    else setSubTab('horoscope');
  }, [activeTool]);

  useEffect(() => {
    apiGet('/api/v2/astrology/signs')
      .then((r) => setSigns(r.signs || []))
      .catch(() => {});
  }, []);

  const loadHoroscope = async (signId: string, per: 'today' | 'tomorrow' | 'week') => {
    setLoadingHoro(true);
    try {
      const r = await apiGet(`/api/v2/astrology/horoscope?sign=${encodeURIComponent(signId)}&period=${per}`);
      setHoroData(r);
    } catch (e: any) {
      onToast(e.message || 'Ошибка загрузки гороскопа');
    } finally {
      setLoadingHoro(false);
    }
  };

  useEffect(() => {
    loadHoroscope(selectedSign, period);
  }, [selectedSign, period]);

  const runBirthAnalysis = async (val?: string) => {
    const query = (val ?? birthInput).trim();
    if (!query) {
      onToast('Укажите дату рождения');
      return;
    }
    setLoadingBirth(true);
    try {
      const r = await apiPost('/api/v2/astrology/birth', { date: query });
      setBirthRes(r);
      onSync?.();
    } catch (e: any) {
      onToast(e.message || 'Неверный формат даты');
    } finally {
      setLoadingBirth(false);
    }
  };

  const runCompatibility = async () => {
    const f = compatMode === 'dates' ? firstDate : sign1;
    const s = compatMode === 'dates' ? secondDate : sign2;
    if (!f || !s) {
      onToast('Заполните данные обоих партнёров');
      return;
    }
    setLoadingCompat(true);
    try {
      const r = await apiPost('/api/v2/astrology/compatibility', {
        first: f,
        second: s,
        name1,
        name2,
      });
      setCompatRes(r);
      onSync?.();
    } catch (e: any) {
      onToast(e.message || 'Ошибка расчёта совместимости');
    } finally {
      setLoadingCompat(false);
    }
  };

  return (
    <div className="space-y-4 min-w-0">
      {/* Sub-navigation (Desktop only — mobile already has sticky sub-tool strip) */}
      <div className="hidden lg:grid grid-cols-3 gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-white/10">
        {[
          { id: 'horoscope', tool: 'daily_horoscope', label: '🔮 Гороскоп' },
          { id: 'birth', tool: 'zodiac_info', label: '♈ По дате' },
          { id: 'compat', tool: 'compat_calc', label: '💞 Совместимость' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setSubTab(t.id as any);
              onSelectTool?.(t.tool);
            }}
            className={`py-2 px-2 rounded-lg text-xs sm:text-sm font-medium transition truncate ${
              subTab === t.id
                ? 'bg-purple-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Interactive 3D Celestial Ecliptic Sphere */}
      <ZodiacCelestial3D
        selectedSign={
          subTab === 'birth'
            ? birthRes?.sign?.id || selectedSign
            : subTab === 'compat'
              ? compatRes?.person1?.sign?.id || sign1
              : selectedSign
        }
        secondSign={
          subTab === 'compat' ? compatRes?.person2?.sign?.id || sign2 : undefined
        }
        compatPct={subTab === 'compat' ? compatRes?.overall_pct : undefined}
        onSelectSign={(id) => {
          if (subTab === 'compat') {
            setCompatMode('signs');
            setSign1(id);
          } else {
            setSelectedSign(id);
            if (subTab !== 'horoscope') {
              setSubTab('horoscope');
              onSelectTool?.('daily_horoscope');
            }
          }
        }}
      />

      {/* 1. HOROSCOPE */}
      {subTab === 'horoscope' && (
        <div className="space-y-4">
          {/* 12 Zodiac Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {signs.map((s) => {
              const active = s.id === selectedSign;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedSign(s.id)}
                  className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                    active
                      ? 'bg-purple-600/25 border-purple-400 text-white'
                      : 'bg-slate-900/70 border-white/10 text-slate-300 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg">{s.symbol}</span>
                    <span className="text-[10px] text-slate-400">{s.element}</span>
                  </div>
                  <div className="font-semibold text-xs mt-1 truncate">{s.name}</div>
                  <div className="text-[10px] text-slate-400 truncate">{s.dates}</div>
                </button>
              );
            })}
          </div>

          {/* Period switcher */}
          <div className="flex items-center gap-2">
            {[
              { id: 'today', label: 'На сегодня' },
              { id: 'tomorrow', label: 'На завтра' },
              { id: 'week', label: 'На неделю' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id as any)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                  period === p.id
                    ? 'bg-indigo-600 border-indigo-400 text-white'
                    : 'bg-slate-900/70 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Forecast Card */}
          {horoData && (
            <div className="rounded-2xl bg-slate-900/80 border border-white/10 p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <span className="text-2xl">{horoData.sign.symbol}</span>
                    {horoData.sign.name} — {horoData.period_label}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {horoData.sign.dates} • Стихия: {horoData.sign.element} • Планета: {horoData.sign.ruler} • {horoData.target_date}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    const txt = `${horoData.sign.symbol} ${horoData.sign.name} (${horoData.period_label}, ${horoData.target_date})\n\nОбщий фон: ${horoData.general}\nОтношения: ${horoData.love}\nДела: ${horoData.career}`;
                    const ok = await copyText(txt);
                    onToast(ok ? 'Прогноз скопирован' : 'Не удалось скопировать');
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 flex items-center gap-1.5 shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" /> Копировать
                </button>
              </div>

              {loadingHoro ? (
                <div className="text-xs text-slate-400 py-4">Обновление...</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <div className="text-xs font-semibold text-purple-300 mb-1">Общий прогноз</div>
                      <p className="text-sm text-slate-200 leading-relaxed">{horoData.general}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <div className="text-xs font-semibold text-pink-300 mb-1">Отношения и общение</div>
                      <p className="text-sm text-slate-200 leading-relaxed">{horoData.love}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <div className="text-xs font-semibold text-sky-300 mb-1">Работа и финансы</div>
                      <p className="text-sm text-slate-200 leading-relaxed">{horoData.career}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { label: 'Общий фон', val: horoData.scores.overall, color: 'bg-purple-500' },
                      { label: 'Отношения', val: horoData.scores.love, color: 'bg-pink-500' },
                      { label: 'Дела и работа', val: horoData.scores.career, color: 'bg-sky-500' },
                      { label: 'Тонус', val: horoData.scores.energy, color: 'bg-emerald-500' },
                    ].map((m) => (
                      <div key={m.label} className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">{m.label}</span>
                          <span className="font-semibold text-white">{m.val}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div className={`h-full ${m.color}`} style={{ width: `${m.val}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-slate-300 pt-1 border-t border-white/5">
                    <span>Удачное число: <b className="text-white">{horoData.lucky_number}</b></span>
                    <span>Благоприятные часы: <b className="text-white">{horoData.lucky_time}</b></span>
                    <span>Близкие знаки: <b className="text-white">{horoData.sign.best_matches?.join(', ')}</b></span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. ZODIAC BY BIRTH DATE */}
      {subTab === 'birth' && (
        <div className="rounded-2xl bg-slate-900/80 border border-white/10 p-4 space-y-4">
          <div>
            <h3 className="text-base font-bold text-white">Знак зодиака и разбор даты рождения</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Выберите дату в календаре или введите в формате ДД.ММ.ГГГГ
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 min-w-0">
            <input
              type="date"
              value={birthInput.includes('-') ? birthInput : ''}
              onChange={(e) => {
                setBirthInput(e.target.value);
                if (e.target.value) runBirthAnalysis(e.target.value);
              }}
              className="w-full sm:w-auto min-w-0 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white focus:outline-none focus:border-purple-400"
            />
            <input
              type="text"
              value={birthInput}
              onChange={(e) => setBirthInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runBirthAnalysis()}
              placeholder="Например: 15.05.2002"
              className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white focus:outline-none focus:border-purple-400"
            />
            <button
              type="button"
              onClick={() => runBirthAnalysis()}
              disabled={loadingBirth}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition disabled:opacity-50"
            >
              {loadingBirth ? 'Расчёт...' : 'Определить'}
            </button>
          </div>

          {birthRes && (
            <div className="space-y-3 pt-2 border-t border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{birthRes.sign.symbol}</span>
                  <div>
                    <div className="text-lg font-bold text-white">
                      {birthRes.sign.name} ({birthRes.formatted_date})
                    </div>
                    <div className="text-xs text-slate-400">
                      Стихия: {birthRes.sign.element} • Качество: {birthRes.sign.quality} • Планета: {birthRes.sign.ruler}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSign(birthRes.sign.id);
                    setSubTab('horoscope');
                    onSelectTool?.('daily_horoscope');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-purple-600/25 border border-purple-400/40 text-purple-200 text-xs font-medium hover:bg-purple-600/40 transition"
                >
                  Открыть гороскоп ({birthRes.sign.name})
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 space-y-1">
                  <div className="text-xs text-slate-400">Сильные стороны</div>
                  <div className="text-slate-200">{birthRes.sign.strengths}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 space-y-1">
                  <div className="text-xs text-slate-400">Зоны внимания</div>
                  <div className="text-slate-200">{birthRes.sign.weaknesses}</div>
                </div>
                {birthRes.eastern_animal && (
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 space-y-1">
                    <div className="text-xs text-slate-400">Восточный календарь</div>
                    <div className="text-slate-200 font-medium">
                      {birthRes.eastern_animal} ({birthRes.eastern_element})
                      {birthRes.age !== null && ` • Возраст: ${birthRes.age} (до ДР ${birthRes.days_until_birthday} дн.)`}
                    </div>
                  </div>
                )}
                {birthRes.life_path_number && (
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 space-y-1">
                    <div className="text-xs text-slate-400">Число даты рождения: {birthRes.life_path_number}</div>
                    <div className="text-slate-200">{birthRes.life_path_meaning}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. COMPATIBILITY */}
      {subTab === 'compat' && (
        <div className="rounded-2xl bg-slate-900/80 border border-white/10 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-white">Совместимость пары</h3>
              <p className="text-xs text-slate-400">По точным датам рождения или по знакам зодиака</p>
            </div>
            <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-white/10 text-xs">
              <button
                onClick={() => setCompatMode('dates')}
                className={`px-2.5 py-1 rounded-md transition ${compatMode === 'dates' ? 'bg-purple-600 text-white' : 'text-slate-400'}`}
              >
                По датам рождения
              </button>
              <button
                onClick={() => setCompatMode('signs')}
                className={`px-2.5 py-1 rounded-md transition ${compatMode === 'signs' ? 'bg-purple-600 text-white' : 'text-slate-400'}`}
              >
                По знакам
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-white/10 space-y-2">
              <div className="text-xs font-medium text-slate-400">Первый человек</div>
              <input
                type="text"
                value={name1}
                onChange={(e) => setName1(e.target.value)}
                placeholder="Имя (необязательно)"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-sm text-white"
              />
              {compatMode === 'dates' ? (
                <input
                  type="date"
                  value={firstDate}
                  onChange={(e) => setFirstDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-sm text-white"
                />
              ) : (
                <select
                  value={sign1}
                  onChange={(e) => setSign1(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-sm text-white"
                >
                  {signs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.symbol} {s.name} ({s.dates})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-white/10 space-y-2">
              <div className="text-xs font-medium text-slate-400">Второй человек</div>
              <input
                type="text"
                value={name2}
                onChange={(e) => setName2(e.target.value)}
                placeholder="Имя (необязательно)"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-sm text-white"
              />
              {compatMode === 'dates' ? (
                <input
                  type="date"
                  value={secondDate}
                  onChange={(e) => setSecondDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-sm text-white"
                />
              ) : (
                <select
                  value={sign2}
                  onChange={(e) => setSign2(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-sm text-white"
                >
                  {signs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.symbol} {s.name} ({s.dates})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <button
            onClick={runCompatibility}
            disabled={loadingCompat}
            className="w-full py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {loadingCompat ? 'Расчёт...' : 'Рассчитать совместимость'}
          </button>

          {compatRes && (
            <div className="p-4 rounded-xl bg-slate-950/80 border border-white/10 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-base sm:text-lg font-bold text-white">
                    {compatRes.person1.sign.symbol} {compatRes.person1.name} ({compatRes.person1.sign.name}) +{' '}
                    {compatRes.person2.sign.symbol} {compatRes.person2.name} ({compatRes.person2.sign.name})
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{compatRes.level}</div>
                </div>
                <div className="text-2xl font-extrabold text-pink-400">{compatRes.overall_pct}%</div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { label: 'Эмоции', val: compatRes.scores.emotional },
                  { label: 'Общение', val: compatRes.scores.communication },
                  { label: 'Быт и цели', val: compatRes.scores.goals_and_daily },
                  { label: 'Ритмы и числа', val: compatRes.scores.biorhythm_or_numbers },
                ].map((m) => (
                  <div key={m.label} className="p-2.5 rounded-lg bg-slate-900 border border-white/5">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">{m.label}</span>
                      <span className="font-bold text-white">{m.val}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-pink-500" style={{ width: `${m.val}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-sm text-slate-200 leading-relaxed">{compatRes.summary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
