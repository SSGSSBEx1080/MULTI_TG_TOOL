import React, { useEffect, useState } from 'react';
import { Dices, Flame, GlassWater, Lightbulb, Ruler, Search, Volume2 } from 'lucide-react';
import { apiGet, apiPost, copyText } from '../../lib/api';

interface Props {
  activeTool: string;
  onSelectTool: (t: string) => void;
  onSync: () => void;
  onToast: (msg: string) => void;
}

export const PartyFunHub: React.FC<Props> = ({ activeTool, onSelectTool, onSync, onToast }) => {
  const [subTab, setSubTab] = useState<'vodka' | 'boredom' | 'pencil'>('vodka');

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

  // --- Pencil Index State ---
  const [pHeight, setPHeight] = useState(181);
  const [pShoe, setPShoe] = useState(43);
  const [pNose, setPNose] = useState('medium');
  const [pHand, setPHand] = useState(21.5);
  const [pVoice, setPVoice] = useState('baritone');
  const [pMmr, setPMmr] = useState(3200);
  const [pLinux, setPLinux] = useState(true);
  const [pCoffee, setPCoffee] = useState(2);
  const [pPushups, setPPushups] = useState(45);
  const [pZodiac, setPZodiac] = useState('fire');
  const [pencilRes, setPencilRes] = useState<any>(null);

  useEffect(() => {
    if (activeTool === 'vodka_calc') setSubTab('vodka');
    else if (activeTool === 'boredom_advisor') setSubTab('boredom');
    else if (activeTool === 'pencil_calc') setSubTab('pencil');
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

  const calcPencil = async () => {
    try {
      const r = await apiPost('/api/v2/party/pencil', {
        height_cm: pHeight,
        shoe_size_eu: pShoe,
        nose_type: pNose,
        hand_span_cm: pHand,
        voice_timbre: pVoice,
        dota_mmr: pMmr,
        linux_user: pLinux,
        coffee_cups: pCoffee,
        gym_pushups: pPushups,
        zodiac_vibe: pZodiac,
      });
      setPencilRes(r);
      onSync();
    } catch (e: any) {
      onToast(e.message);
    }
  };

  useEffect(() => {
    calcVodka();
    loadBoredom();
    calcPencil();
  }, []);

  const toggleLiguria = async () => {
    if (!showLiguria && !liguriaData) {
      const d = await apiGet('/api/v2/party/liguria');
      setLiguriaData(d);
    }
    setShowLiguria(!showLiguria);
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
    <div className="space-y-5">
      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'vodka', tool: 'vodka_calc', label: '🥃 Алко-Калькулятор 0..40 (Без догона)' },
          { id: 'boredom', tool: 'boredom_advisor', label: '💡 Что делать если скучно (105+ идей + Лигурия)' },
          { id: 'pencil', tool: 'pencil_calc', label: '📏 Индекс «Карандаша» (Био-Рофл)' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setSubTab(t.id as any);
              onSelectTool(t.tool);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition ${
              subTab === t.id
                ? 'bg-orange-500/25 border-orange-400/60 text-orange-200 shadow-lg shadow-orange-500/10'
                : 'bg-slate-900/60 border-white/10 text-slate-300 hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

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

      {/* 3. HUMOROUS BIOMETRIC PENCIL CALCULATOR */}
      {subTab === 'pencil' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-slate-900/75 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Ruler className="w-5 h-5 text-pink-400" /> Шуточный Био-Калькулятор «Длина Боевого Карандаша»
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-300 border border-pink-400/30">
                10 параметров
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Рост (см): <b>{pHeight}</b></label>
                <input type="range" min={150} max={215} value={pHeight} onChange={(e) => setPHeight(Number(e.target.value))} className="w-full accent-pink-500" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Размер обуви EU: <b>{pShoe}</b></label>
                <input type="range" min={36} max={50} step={0.5} value={pShoe} onChange={(e) => setPShoe(Number(e.target.value))} className="w-full accent-pink-500" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Размах ладони (см): <b>{pHand}</b></label>
                <input type="range" min={16} max={27} step={0.5} value={pHand} onChange={(e) => setPHand(Number(e.target.value))} className="w-full accent-pink-500" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Отжиманий за раз: <b>{pPushups}</b></label>
                <input type="range" min={0} max={150} value={pPushups} onChange={(e) => setPPushups(Number(e.target.value))} className="w-full accent-pink-500" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">MMR в Dota 2: <b>{pMmr}</b></label>
                <input type="range" min={0} max={12000} step={200} value={pMmr} onChange={(e) => setPMmr(Number(e.target.value))} className="w-full accent-pink-500" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Кружек чая/кофе: <b>{pCoffee}</b></label>
                <input type="range" min={0} max={10} value={pCoffee} onChange={(e) => setPCoffee(Number(e.target.value))} className="w-full accent-pink-500" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Профиль носа</label>
                <select value={pNose} onChange={(e) => setPNose(e.target.value)} className="w-full rounded-xl bg-slate-950 border border-white/10 px-2.5 py-2 text-white">
                  <option value="small">Аккуратный</option>
                  <option value="medium">Классический</option>
                  <option value="roman">Римский профиль</option>
                  <option value="eagle">Орлиный мощный</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Тембр голоса</label>
                <select value={pVoice} onChange={(e) => setPVoice(e.target.value)} className="w-full rounded-xl bg-slate-950 border border-white/10 px-2.5 py-2 text-white">
                  <option value="tenor">Тенор</option>
                  <option value="baritone">Баритон</option>
                  <option value="bass">Глубокий бас</option>
                  <option value="ultra_bass">Суббас озвучки аниме</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Стихия вайба</label>
                <select value={pZodiac} onChange={(e) => setPZodiac(e.target.value)} className="w-full rounded-xl bg-slate-950 border border-white/10 px-2.5 py-2 text-white">
                  <option value="fire">🔥 Огонь</option>
                  <option value="earth">🪨 Земля</option>
                  <option value="air">🌪 Воздух</option>
                  <option value="water">🌊 Вода</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
              <input type="checkbox" checked={pLinux} onChange={(e) => setPLinux(e.target.checked)} className="accent-pink-500 w-4 h-4" />
              <span>Использую Linux / собирал ядро / писал код ночью (+бонус ауры гика)</span>
            </label>

            <button
              onClick={calcPencil}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-slate-950 font-bold text-sm"
            >
              📏 Вычислить биометрический индекс
            </button>
          </div>

          <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-slate-900/75 p-5 flex flex-col justify-between space-y-4">
            {pencilRes && (
              <>
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-600/20 border border-pink-400/40 text-center">
                    <div className="text-xs text-pink-200 uppercase tracking-wider">Расчётная длина «карандаша»</div>
                    <div className="text-4xl font-black text-white mt-1">
                      {pencilRes.estimated_cm} см <span className="text-lg text-pink-300">({pencilRes.estimated_inches}")</span>
                    </div>
                    <div className="text-xs font-semibold text-amber-300 mt-1.5">{pencilRes.rank_title}</div>
                  </div>

                  {/* Visual Ruler */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Визуальная шкала (0 — 25 см)</span>
                      <span className="text-emerald-300">Топ {100 - pencilRes.percentile}% планеты</span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-sky-400 transition-all duration-300"
                        style={{ width: `${Math.min(100, (pencilRes.estimated_cm / 25) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/80 border border-white/10 space-y-1.5 max-h-48 overflow-y-auto text-xs">
                    <div className="text-slate-400 font-semibold mb-1">Разбор факторов формулы:</div>
                    {pencilRes.factors.map((f: any) => (
                      <div key={f.label} className="flex justify-between">
                        <span className="text-slate-300">{f.label}</span>
                        <span className="font-mono text-pink-300">{f.impact}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 italic">{pencilRes.disclaimer}</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
