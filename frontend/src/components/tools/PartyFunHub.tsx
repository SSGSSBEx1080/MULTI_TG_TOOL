import React, { useEffect, useState } from 'react';
import { Dices, Flame, GlassWater, Lightbulb, Ruler, Search, Volume2 } from 'lucide-react';
import { apiGet, apiPost, copyText } from '../../lib/api';
import { Mini3DSceneBadge, PartyGlass3D, RealScaleComparison3D } from '../three/Interactive3DScenes';
import { CrocoWordsGameView, FortuneWheel8BallBubbleView, LieDetectorPartyView } from './TimbricaPartyExtras';

interface Props {
  activeTool: string;
  onSelectTool: (t: string) => void;
  onSync: () => void;
  onToast: (msg: string) => void;
}

export const PartyFunHub: React.FC<Props> = ({ activeTool, onSelectTool, onSync, onToast }) => {
  const [subTab, setSubTab] = useState<'vodka' | 'boredom' | 'pencil' | 'lie' | 'wheel' | 'croco'>(() => {
    if (activeTool === 'boredom_advisor') return 'boredom';
    if (activeTool === 'pencil_calc') return 'pencil';
    if (activeTool === 'lie_detector_fun') return 'lie';
    if (activeTool === 'fortune_wheel_8ball') return 'wheel';
    if (activeTool === 'croco_words') return 'croco';
    return 'vodka';
  });

  // --- Alcohol 0..40 State ---
  const [people, setPeople] = useState(4);
  const [weight, setWeight] = useState(76);
  const [genderMix, setGenderMix] = useState('mixed');
  const [targetLevel, setTargetLevel] = useState(18);
  const [duration, setDuration] = useState(5);
  const [snack, setSnack] = useState('good');
  const [drink, setDrink] = useState('vodka');
  const [reserve, setReserve] = useState(true);
  const [alkoRes, setAlkoRes] = useState<any>(null);

  // --- Boredom 105+ State ---
  const [bCat, setBCat] = useState('all');
  const [bSpicy, setBSpicy] = useState(false);
  const [bSearch, setBSearch] = useState('');
  const [bCount, setBCount] = useState(12);
  const [boredRes, setBoredRes] = useState<any>(null);
  const [showLiguria, setShowLiguria] = useState(false);
  const [liguriaData, setLiguriaData] = useState<any>(null);

  // --- 10-Factor Realistic Anthropometric Calculator State ---
  const [pAge, setPAge] = useState(21);
  const [pHeight, setPHeight] = useState(178);
  const [pShoe, setPShoe] = useState(42);
  const [pArmGirth, setPArmGirth] = useState(31.5);
  const [pWrist, setPWrist] = useState(17.2);
  const [pFinger, setPFinger] = useState(7.3);
  const [pClashTrophies, setPClashTrophies] = useState(4800);
  const [pMmr, setPMmr] = useState(2400);
  const [pSleep, setPSleep] = useState(7.0);
  const [pTemp, setPTemp] = useState(21);
  const [compareObjId, setCompareObjId] = useState('iphone_16');
  const [pencilRes, setPencilRes] = useState<any>(null);

  useEffect(() => {
    if (activeTool === 'vodka_calc') setSubTab('vodka');
    else if (activeTool === 'boredom_advisor') setSubTab('boredom');
    else if (activeTool === 'pencil_calc') setSubTab('pencil');
    else if (activeTool === 'lie_detector_fun') setSubTab('lie');
    else if (activeTool === 'fortune_wheel_8ball') setSubTab('wheel');
    else if (activeTool === 'croco_words') setSubTab('croco');
  }, [activeTool]);

  const calcVodka = async () => {
    try {
      const r = await apiPost('/api/v2/party/alcohol', {
        people_count: people,
        avg_weight_kg: weight,
        gender_mix: genderMix,
        target_level: targetLevel,
        duration_hours: duration,
        snack_level: snack,
        drink_type: drink,
        reserve_no_run: reserve,
      });
      setAlkoRes(r);
      onSync();
    } catch (e: any) {
      onToast(e.message);
    }
  };

  const loadBoredom = async (cat = bCat, spicy = bSpicy, q = bSearch, cnt = bCount) => {
    try {
      const params = new URLSearchParams({
        category: cat,
        include_spicy: String(spicy),
        count: String(cnt),
        search: q,
      });
      const r = await apiGet(`/api/v2/party/boredom?${params.toString()}`);
      setBoredRes(r);
    } catch (e: any) {
      onToast(e.message);
    }
  };

  const calcPencil = async (syncUser = true) => {
    try {
      const r = await apiPost('/api/v2/party/pencil', {
        age: pAge,
        height_cm: pHeight,
        shoe_size_eu: pShoe,
        arm_girth_cm: pArmGirth,
        wrist_cm: pWrist,
        index_finger_cm: pFinger,
        clash_royale_trophies: pClashTrophies,
        dota_mmr: pMmr,
        sleep_hours: pSleep,
        room_temp_c: pTemp,
      });
      setPencilRes(r);
      if (syncUser) onSync();
    } catch (e: any) {
      onToast(e.message);
    }
  };

  useEffect(() => {
    if (subTab !== 'pencil') return;
    const t = window.setTimeout(() => {
      calcPencil(false);
    }, 180);
    return () => window.clearTimeout(t);
  }, [subTab, pAge, pHeight, pShoe, pArmGirth, pWrist, pFinger, pClashTrophies, pMmr, pSleep, pTemp]);

  useEffect(() => {
    if (subTab === 'vodka' && !alkoRes) calcVodka();
    else if (subTab === 'boredom' && !boredRes) loadBoredom();
    else if (subTab === 'pencil' && !pencilRes) calcPencil(false);
  }, [subTab]);

  const toggleLiguria = async () => {
    try {
      if (!showLiguria && !liguriaData) {
        const d = await apiGet('/api/v2/party/liguria');
        setLiguriaData(d);
      }
      setShowLiguria(!showLiguria);
    } catch (e: any) {
      onToast(e.message || 'Ошибка загрузки');
    }
  };

  const levelColor =
    targetLevel < 12
      ? 'text-emerald-300 border-emerald-400/40 bg-emerald-500/15'
      : targetLevel < 24
      ? 'text-amber-300 border-amber-400/40 bg-amber-500/15'
      : targetLevel < 33
      ? 'text-orange-300 border-orange-400/40 bg-orange-500/15'
      : 'text-rose-300 border-rose-500/50 bg-rose-500/20';

  return (
    <div className="space-y-5 min-w-0">
      {/* 1. ALCOHOL CALCULATOR */}
      {subTab === 'vodka' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-slate-900/75 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <GlassWater className="w-5 h-5 text-orange-400" /> Калькулятор Застолья («Чтобы не бежать за второй»)
              </h3>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-400/30">
                Формула Видмарка
              </span>
            </div>

            {/* 0..40 Scale Slider */}
            <div className="p-4 rounded-xl bg-slate-950/90 border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-medium">Желаемая шкала опьянения (0 — стекло, 40 — отключка):</span>
                <span className={`px-2.5 py-0.5 rounded-lg text-sm font-bold border ${levelColor}`}>
                  {targetLevel} / 40
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={40}
                step={1}
                value={targetLevel}
                onChange={(e) => setTargetLevel(Number(e.target.value))}
                className="w-full accent-orange-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>0 Трезвый</span>
                <span>10 Кураж</span>
                <span>20 Душа поёт</span>
                <span>30 Автопилот</span>
                <span className="text-rose-400">40 Отключка ⚠️</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Человек в компании</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={people}
                  onChange={(e) => setPeople(Number(e.target.value))}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Средний вес (кг)</label>
                <input
                  type="number"
                  min={40}
                  max={180}
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Длительность (часов)</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Напиток</label>
                <select
                  value={drink}
                  onChange={(e) => setDrink(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                >
                  <option value="vodka">Водка (40%)</option>
                  <option value="whiskey">Виски / Коньяк / Ром (40%)</option>
                  <option value="liqueur">Егермейстер / Настойка (35%)</option>
                  <option value="wine">Вино (12.5%)</option>
                  <option value="strong_beer">Крафтовый эль (8%)</option>
                  <option value="beer">Светлое пиво (5%)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Плотность стола</label>
                <select
                  value={snack}
                  onChange={(e) => setSnack(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                >
                  <option value="heavy">Шашлык / Пельмени / Плотно</option>
                  <option value="good">Хорошая закуска</option>
                  <option value="light">Чипсы / Нарезка</option>
                  <option value="none">Почти без закуски</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Состав компании</label>
                <select
                  value={genderMix}
                  onChange={(e) => setGenderMix(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                >
                  <option value="mixed">Смешанная компания</option>
                  <option value="male">Мужская компания</option>
                  <option value="female">Женская компания</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={reserve}
                onChange={(e) => setReserve(e.target.checked)}
                className="rounded accent-orange-500 w-4 h-4"
              />
              <span>Включить стратегический запас <b>+15%</b>, чтобы точно не бежать за догоном ночью</span>
            </label>

            <button
              onClick={calcVodka}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-orange-500/20 transition"
            >
              🥃 Рассчитать закупку на компанию
            </button>
          </div>

          <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-slate-900/75 p-5 flex flex-col justify-between space-y-4">
            <PartyGlass3D
              fillRatio={Math.max(0.08, Math.min(1, targetLevel / 40))}
              label={`Уровень ${targetLevel}/40`}
            />
            {alkoRes ? (
              <>
                <div className="space-y-3">
                  <div className={`p-3.5 rounded-xl border ${levelColor}`}>
                    <div className="text-sm font-bold">{alkoRes.stage_title}</div>
                    <p className="text-xs opacity-90 mt-1">{alkoRes.stage_desc}</p>
                    <div className="text-[11px] mt-2 font-mono opacity-80">
                      Оценка промилле: ~{alkoRes.estimated_promille}‰ • Шкала: {alkoRes.target_level}/40
                    </div>
                  </div>

                  {alkoRes.danger_warning && (
                    <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/50 text-xs text-rose-200 font-medium">
                      {alkoRes.danger_warning}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-orange-400/30">
                      <div className="text-[11px] text-slate-400">Бутылок 0.5 л</div>
                      <div className="text-2xl font-extrabold text-orange-300 mt-0.5">{alkoRes.bottles_05} шт.</div>
                      <div className="text-[11px] text-slate-400">или по 0.7 л: <b>{alkoRes.bottles_07} шт.</b></div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-white/10">
                      <div className="text-[11px] text-slate-400">Общий объём</div>
                      <div className="text-2xl font-extrabold text-white mt-0.5">{alkoRes.total_liters} л</div>
                      <div className="text-[11px] text-slate-400">({alkoRes.per_person_ml} мл / чел.)</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-white/10">
                      <div className="text-[11px] text-slate-400">Стопок по 50 мл</div>
                      <div className="text-lg font-bold text-amber-300">{alkoRes.shots_50ml_per_person} на чел.</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-white/10">
                      <div className="text-[11px] text-slate-400">Выветривание</div>
                      <div className="text-lg font-bold text-sky-300">~{alkoRes.sober_after_hours} ч.</div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 text-xs space-y-1 text-slate-300">
                    <div>🥩 Рекомендуемо закуски на стол: <b className="text-white">{alkoRes.snacks_kg} кг</b></div>
                    <div>🧃 Чистой воды и запивки: <b className="text-white">{alkoRes.water_chasers_liters} л</b></div>
                    <div>🧊 Льда в морозилку: <b className="text-white">{alkoRes.ice_kg} кг</b></div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">
                  Справочный расчёт для совершеннолетних (18+). Чрезмерное употребление алкоголя вредит здоровью; ни в коем случае не садитесь за руль.
                </p>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* 2. BOREDOM ADVISOR (105+ IDEAS + LIGURIA) */}
      {subTab === 'boredom' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-400" /> Генератор Идей «Что Поделать, Когда Скучно»
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  В базе <b>{boredRes?.total_in_vault || 105}+ небанальных занятий</b>: гейминг, инженерия, манги, наука, кулинария, дикция и саморазвитие!
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={toggleLiguria}
                  className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/40 text-xs text-purple-200 flex items-center gap-1.5"
                >
                  <Volume2 className="w-3.5 h-3.5" /> {showLiguria ? 'Скрыть «Лигурию»' : 'Скороговорка «Лигурия»'}
                </button>
                <label className="px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-400/30 text-xs text-rose-200 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bSpicy}
                    onChange={(e) => {
                      setBSpicy(e.target.checked);
                      loadBoredom(bCat, e.target.checked, bSearch, bCount);
                    }}
                    className="accent-rose-500"
                  />
                  <span>🔞 18+ без цензуры</span>
                </label>
              </div>
            </div>

            {showLiguria && liguriaData && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-purple-400/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-300">
                    🗣 Полный эталон дикторов — «Лигурия» ({liguriaData.word_count} слов)
                  </span>
                  <button
                    onClick={() => copyText(liguriaData.liguria, onToast)}
                    className="text-xs text-sky-300 hover:underline"
                  >
                    Копировать текст
                  </button>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed max-h-48 overflow-y-auto pr-2">
                  {liguriaData.liguria}
                </p>
                <div className="pt-2 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {liguriaData.foreign_twisters.map((tw: any) => (
                    <div key={tw.lang} className="p-2.5 rounded-xl bg-slate-900/90 text-xs">
                      <div className="font-semibold text-amber-300">{tw.lang}</div>
                      <div className="text-white font-mono mt-0.5">{tw.text}</div>
                      <div className="text-slate-400 text-[11px]">{tw.meaning}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Category Pills */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: '🌟 Все категории' },
                { id: 'gaming', label: '🎮 Игры & Дота' },
                { id: 'anime', label: '⛩ Манга & Аниме' },
                { id: 'tech', label: '🔧 3D-Принтеры, КПД & Быт' },
                { id: 'cyber', label: '💻 Код, Tor & ИИ' },
                { id: 'mind', label: '📚 Книги, Сон & Религии' },
                { id: 'creative', label: '🎬 Канал, Озвучка & Дикция' },
                { id: 'chill', label: '🍵 Чай, Рецепты & Спорт' },
                { id: 'lore', label: '🌐 Лор, Инвестиции & ПК' },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setBCat(c.id);
                    loadBoredom(c.id, bSpicy, bSearch, bCount);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs border transition ${
                    bCat === c.id
                      ? 'bg-amber-500/20 border-amber-400/50 text-amber-200 font-semibold'
                      : 'bg-slate-950/70 border-white/10 text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Search + Roll Controls */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  value={bSearch}
                  onChange={(e) => {
                    setBSearch(e.target.value);
                    loadBoredom(bCat, bSpicy, e.target.value, 30);
                  }}
                  placeholder="Поиск по базе (например: Sekiro, Дота, чай, Бродяга, 3D-принтер, Гамаз, пылесос)..."
                  className="w-full rounded-xl bg-slate-950 border border-white/10 pl-9 pr-3 py-2 text-xs text-white"
                />
              </div>
              <button
                onClick={() => loadBoredom(bCat, bSpicy, bSearch, 12)}
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shrink-0"
              >
                <Dices className="w-4 h-4" /> Перемешать 12 идей
              </button>
              <button
                onClick={() => {
                  setBCount(120);
                  loadBoredom(bCat, bSpicy, bSearch, 120);
                }}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs shrink-0"
              >
                Показать все ({boredRes?.matching_count || 105})
              </button>
            </div>

            {/* Ideas Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[540px] overflow-y-auto pr-1">
              {(boredRes?.items || []).map((item: any) => (
                <div
                  key={item.id}
                  onClick={() => copyText(item.title, onToast)}
                  className="p-3.5 rounded-xl bg-slate-950/90 hover:bg-slate-950 border border-white/10 hover:border-amber-400/40 cursor-pointer transition flex flex-col justify-between gap-2"
                >
                  <p className="text-xs text-slate-100 leading-relaxed">{item.title}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-white/5">
                    <span className="uppercase tracking-wider text-amber-300/80">#{item.cat}</span>
                    <span>Идея №{item.id} • Копировать</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. 10-FACTOR ANTHROPOMETRIC PENIS LENGTH CALCULATOR + 3D REAL OBJECT SCALE */}
      {subTab === 'pencil' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-6 rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Mini3DSceneBadge seed="pencil_calc" color="#ec4899" size={38} />
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-pink-400" /> Соматометрический расчёт длины члена
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Десятифакторный клинический протокол (μ = 13.12 см, σ = 1.66 см, n = 15 521)
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-300 border border-pink-400/30 shrink-0">
                10 факторов
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-white/5">
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Возраст</span>
                  <b className="font-mono text-pink-300">{pAge} лет</b>
                </div>
                <input
                  type="range"
                  min={18}
                  max={75}
                  value={pAge}
                  onChange={(e) => setPAge(Number(e.target.value))}
                  className="w-full accent-pink-500"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-white/5">
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>🏆 Кубки в Clash Royale</span>
                  <b className="font-mono text-amber-300">{pClashTrophies}</b>
                </div>
                <input
                  type="range"
                  min={0}
                  max={9000}
                  step={100}
                  value={pClashTrophies}
                  onChange={(e) => setPClashTrophies(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-white/5">
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Рост тела</span>
                  <b className="font-mono text-pink-300">{pHeight} см</b>
                </div>
                <input
                  type="range"
                  min={150}
                  max={210}
                  value={pHeight}
                  onChange={(e) => setPHeight(Number(e.target.value))}
                  className="w-full accent-pink-500"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-white/5">
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Размер обуви (EU)</span>
                  <b className="font-mono text-pink-300">{pShoe} EU</b>
                </div>
                <input
                  type="range"
                  min={36}
                  max={49}
                  step={0.5}
                  value={pShoe}
                  onChange={(e) => setPShoe(Number(e.target.value))}
                  className="w-full accent-pink-500"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-white/5">
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>💪 Обхват руки (бицепс)</span>
                  <b className="font-mono text-pink-300">{pArmGirth} см</b>
                </div>
                <input
                  type="range"
                  min={22}
                  max={48}
                  step={0.5}
                  value={pArmGirth}
                  onChange={(e) => setPArmGirth(Number(e.target.value))}
                  className="w-full accent-pink-500"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-white/5">
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Обхват запястья</span>
                  <b className="font-mono text-pink-300">{pWrist} см</b>
                </div>
                <input
                  type="range"
                  min={14}
                  max={22.5}
                  step={0.2}
                  value={pWrist}
                  onChange={(e) => setPWrist(Number(e.target.value))}
                  className="w-full accent-pink-500"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-white/5">
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Длина указательного пальца</span>
                  <b className="font-mono text-pink-300">{pFinger} см</b>
                </div>
                <input
                  type="range"
                  min={5.5}
                  max={10.0}
                  step={0.1}
                  value={pFinger}
                  onChange={(e) => setPFinger(Number(e.target.value))}
                  className="w-full accent-pink-500"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-white/5">
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Рейтинг MMR (Dota 2 / CS)</span>
                  <b className="font-mono text-sky-300">{pMmr}</b>
                </div>
                <input
                  type="range"
                  min={0}
                  max={12000}
                  step={200}
                  value={pMmr}
                  onChange={(e) => setPMmr(Number(e.target.value))}
                  className="w-full accent-sky-400"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-white/5">
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Продолжительность сна</span>
                  <b className="font-mono text-pink-300">{pSleep} ч/сут</b>
                </div>
                <input
                  type="range"
                  min={4}
                  max={11}
                  step={0.5}
                  value={pSleep}
                  onChange={(e) => setPSleep(Number(e.target.value))}
                  className="w-full accent-pink-500"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-white/5">
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Температура в помещении</span>
                  <b className="font-mono text-pink-300">{pTemp} °C</b>
                </div>
                <input
                  type="range"
                  min={10}
                  max={34}
                  step={1}
                  value={pTemp}
                  onChange={(e) => setPTemp(Number(e.target.value))}
                  className="w-full accent-pink-500"
                />
              </div>
            </div>

            <button
              onClick={() => calcPencil(true)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-indigo-500 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-pink-500/15"
            >
              📏 Зафиксировать антропометрический протокол
            </button>

            {pencilRes && (
              <div className="p-3 rounded-xl bg-slate-950/85 border border-white/10 space-y-1.5 text-[11px]">
                <div className="text-slate-300 font-semibold mb-1">
                  Регрессионный вклад каждого параметра (база μ = 13.12 см):
                </div>
                {pencilRes.factors.map((f: any) => (
                  <div key={f.label} className="flex justify-between gap-2 border-b border-white/[0.04] pb-1">
                    <span className="text-slate-300">{f.label}</span>
                    <span
                      className={`font-mono shrink-0 ${
                        f.impact_cm >= 0 ? 'text-emerald-300' : 'text-rose-300'
                      }`}
                    >
                      {f.impact}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-6 rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 flex flex-col justify-between space-y-4">
            {pencilRes && (() => {
              const comps: any[] = pencilRes.comparisons || [];
              const activeComp =
                comps.find((c) => c.id === compareObjId) ||
                pencilRes.closest_object ||
                { name: 'Смартфон iPhone 16', length_cm: 14.76, width_cm: 7.16, shape: 'phone', color: '#6366f1' };

              return (
                <>
                  <div className="space-y-3.5">
                    {/* Crisp Clinical Result Readout */}
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-pink-500/15 via-slate-950 to-indigo-500/15 border border-pink-400/35">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-[11px] text-pink-200 uppercase tracking-wider font-semibold">
                            Расчётная длина (эрекция / покой)
                          </div>
                          <div className="text-3xl sm:text-4xl font-black text-white mt-0.5 font-mono">
                            {pencilRes.estimated_cm} см{' '}
                            <span className="text-base font-normal text-slate-300">
                              / {pencilRes.flaccid_cm || (pencilRes.estimated_cm * 0.7).toFixed(1)} см
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-mono text-sky-300">
                            Обхват: <b>{pencilRes.girth_est_cm} см</b>
                          </div>
                          <div className="text-xs font-mono text-emerald-300">
                            Перцентиль: <b>P{pencilRes.percentile}</b>
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-medium text-amber-200 mt-2">{pencilRes.rank_title}</div>
                    </div>

                    {/* Humorous Interactive 3D Real-Object Scale Comparison */}
                    <RealScaleComparison3D
                      title="🔬 3D-сопоставление с эталонным предметом (масштаб 1:1)"
                      leftObj={{
                        label: 'Ваш результат',
                        sizeCm: pencilRes.estimated_cm,
                        widthCm: Math.max(2.9, (pencilRes.girth_est_cm || 11.6) / Math.PI),
                        shape: 'anatomical',
                        color: '#f472b6',
                      }}
                      rightObj={{
                        label: activeComp.name,
                        sizeCm: activeComp.length_cm,
                        widthCm: activeComp.width_cm,
                        shape: activeComp.shape || 'box',
                        color: activeComp.color || '#38bdf8',
                      }}
                      heightPx={232}
                    />

                    {/* Selector of Everyday Real Objects */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-200">Сравнить с реальным предметом:</span>
                        {activeComp.verdict && (
                          <span className="text-amber-300 font-mono text-[11px]">{activeComp.verdict}</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {comps.map((obj) => (
                          <button
                            key={obj.id}
                            type="button"
                            onClick={() => setCompareObjId(obj.id)}
                            className={`p-2 rounded-xl border text-left transition ${
                              obj.id === activeComp.id
                                ? 'bg-pink-500/20 border-pink-400 text-white'
                                : 'bg-slate-950/80 border-white/10 text-slate-300 hover:border-white/25'
                            }`}
                          >
                            <div className="text-[11px] font-bold truncate">{obj.name}</div>
                            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-0.5">
                              <span>{obj.length_cm} см</span>
                              <span className="text-pink-300">{obj.ratio}×</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/90 border border-white/5 text-[11px] text-slate-400 leading-relaxed">
                    {pencilRes.methodology} {pencilRes.disclaimer}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {subTab === 'lie' && <LieDetectorPartyView onToast={onToast} />}
      {subTab === 'wheel' && <FortuneWheel8BallBubbleView />}
      {subTab === 'croco' && <CrocoWordsGameView />}
    </div>
  );
};
