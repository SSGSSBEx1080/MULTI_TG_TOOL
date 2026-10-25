import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Flame, RotateCcw, Sparkles, Waves, XCircle } from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api';
import { Mini3DSceneBadge } from '../three/Interactive3DScenes';

interface CraftElem {
  emoji: string;
  name: string;
  first?: boolean;
}

const STARTER_ELEMS: CraftElem[] = [
  { emoji: '💧', name: 'Вода' },
  { emoji: '🔥', name: 'Огонь' },
  { emoji: '🌱', name: 'Земля' },
  { emoji: '💨', name: 'Воздух' },
];

const OCEAN_ZONES = [
  { depth: 0, title: 'Поверхность Мирового океана (Эпипелагиаль)', temp: '+17 °C', pressure: '1 атм', desc: 'Коралловые рифы, дельфины, морские черепахи и фотосинтезирующий фитопланктон.' },
  { depth: 40, title: 'Предел любительского дайвинга с аквалангом', temp: '+14 °C', pressure: '5 атм', desc: 'Ниже этой отметки азотный наркоз требует газовых смесей тримикс/гелиокс.' },
  { depth: 200, title: 'Сумеречная зона (Мезопелагиаль)', temp: '+9 °C', pressure: '21 атм', desc: 'Солнечный свет гаснет; начинается царство биолюминесцентных медуз и рыб-топориков.' },
  { depth: 535, title: 'Рекорд погружения императорского пингвина', temp: '+5 °C', pressure: '54 атм', desc: 'Птица задерживает дыхание более чем на 20 минут при охоте на кальмаров.' },
  { depth: 830, title: 'Высота небоскрёба Бурдж-Халифа под водой', temp: '+4 °C', pressure: '84 атм', desc: 'Зона охоты гигантских кальмаров Architeuthis.' },
  { depth: 1044, title: 'Рабочая глубина охоты кашалота', temp: '+3.5 °C', pressure: '105 атм', desc: 'Грудная клетка кашалота эластично складывается под давлением сотни атмосфер.' },
  { depth: 2500, title: 'Чёрные курильщики (Гидротермальные источники)', temp: '+2 °C (струя +380 °C)', pressure: '251 атм', desc: 'Оазисы хемосинтетической жизни в вечной тьме без участия Солнца (вестиментиферы Рифтии).' },
  { depth: 3800, title: 'Покоящийся корпус «Титаника» (Северная Атлантика)', temp: '+1.8 °C', pressure: '381 атм', desc: 'Носовая и кормовая части лайнера на абиссальной равнине.' },
  { depth: 6000, title: 'Ультраабиссаль (Хадальная зона желобов)', temp: '+1.5 °C', pressure: '601 атм', desc: 'Морские слизни псевдолипарисы — самые глубоководные позвоночные рыбы (до 8336 м).' },
  { depth: 8849, title: 'Вершина горы Эверест, если поставить её на дно', temp: '+1.3 °C', pressure: '886 атм', desc: 'Над пиком Джомолунгмы всё ещё оставалось бы более 2 километров воды!' },
  { depth: 10994, title: 'Бездна Челленджера — Дно Марианской впадины', temp: '+1.2 °C', pressure: '1086 атм (~1.1 т на см²)', desc: 'Низшая точка земной коры: здесь побывали Жак Пикар и Дон Уолш («Триест», 1960), Джеймс Кэмерон и Виктор Весково.' },
];

export const NealFunSuiteHub: React.FC<{
  activeTool: string;
  onSelectTool: (t: string) => void;
  onSync: () => void;
  onToast: (msg: string) => void;
}> = ({ activeTool, onSelectTool, onSync, onToast }) => {
  const tab = (
    ['infinite_craft_lab', 'spend_billionaire', 'absurd_password_game', 'deep_sea_space_scale'] as const
  ).includes(activeTool as any)
    ? activeTool
    : 'infinite_craft_lab';

  // --- 1. Infinite Craft State ---
  const [elements, setElements] = useState<CraftElem[]>(() => {
    try {
      const saved = localStorage.getItem('mt_inf_craft_v6');
      return saved ? JSON.parse(saved) : STARTER_ELEMS;
    } catch {
      return STARTER_ELEMS;
    }
  });
  const [slotA, setSlotA] = useState<CraftElem>(STARTER_ELEMS[0]);
  const [slotB, setSlotB] = useState<CraftElem>(STARTER_ELEMS[1]);
  const [craftLog, setCraftLog] = useState<string[]>([]);

  // --- 2. Spend Billionaire State ---
  const [fortuneTotal] = useState(350_000_000_000);
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});

  // --- 3. Absurd Password Game State ---
  const [pwd, setPwd] = useState('');

  // --- 4. Deep Sea & Life Stats State ---
  const [depthM, setDepthM] = useState(3800);
  const [birthDate, setBirthDate] = useState('2004-05-15');

  useEffect(() => {
    if (tab === 'spend_billionaire' && shopItems.length === 0) {
      apiGet('/api/v6/nealfun/billionaire')
        .then((r) => setShopItems(r.items || []))
        .catch(() => {});
    }
  }, [tab, shopItems.length]);

  const doCombine = async () => {
    try {
      const r = await apiPost('/api/v6/nealfun/craft', {
        item_a: slotA.name,
        item_b: slotB.name,
      });
      const created: CraftElem = { emoji: r.emoji, name: r.result, first: r.first_discovery };
      setCraftLog((prev) => [
        `${slotA.emoji} ${slotA.name} + ${slotB.emoji} ${slotB.name} = ${created.emoji} ${created.name}${
          created.first ? ' (ПЕРВООТКРЫТИЕ!)' : ''
        }`,
        ...prev.slice(0, 14),
      ]);
      setElements((prev) => {
        if (prev.some((x) => x.name === created.name)) return prev;
        const next = [...prev, created];
        try {
          localStorage.setItem('mt_inf_craft_v6', JSON.stringify(next));
        } catch {}
        return next;
      });
      setSlotA(created);
      onSync();
    } catch (e: any) {
      onToast(e.message || 'Ошибка синтеза');
    }
  };

  const spentUsd = useMemo(() => {
    return shopItems.reduce((acc, it) => acc + (cart[it.id] || 0) * it.price_usd, 0);
  }, [shopItems, cart]);
  const leftUsd = Math.max(0, fortuneTotal - spentUsd);

  // Absurd Password Validation Rules
  const pwdRules = useMemo(() => {
    const digits = (pwd.match(/\d/g) || []).map(Number);
    const digitSum = digits.reduce((a, b) => a + b, 0);
    const chem2 = /(He|Li|Be|Ne|Na|Mg|Al|Si|Cl|Ar|Ca|Sc|Ti|Cr|Mn|Fe|Co|Ni|Cu|Zn|Kr|Ag|Sn|Xe|Pt|Au|Hg|Pb)/;
    const romanMap: Record<string, number> = { I: 1, V: 5, X: 10, L: 50 };
    const romanSum = (pwd.match(/[IVXL]/g) || []).reduce((acc, c) => acc + (romanMap[c] || 0), 0);

    const rules = [
      { id: 1, text: 'Пароль должен содержать минимум 8 символов', ok: pwd.length >= 8 },
      { id: 2, text: 'Пароль должен содержать хотя бы одну цифру', ok: /\d/.test(pwd) },
      { id: 3, text: 'Пароль должен содержать хотя бы одну заглавную букву', ok: /[A-ZА-ЯЁ]/.test(pwd) },
      { id: 4, text: 'Пароль должен содержать спецсимвол (!@#$%^&*+-)', ok: /[!@#$%^&*+\-=]/.test(pwd) },
      { id: 5, text: `Сумма всех цифр в пароле должна быть ровно 25 (сейчас: ${digitSum})`, ok: digitSum === 25 },
      { id: 6, text: 'Пароль должен включать название текущего месяца (октябрь или october)', ok: /(октябр|october)/i.test(pwd) },
      { id: 7, text: 'Включите двубуквенный символ химического элемента с заглавной (например Fe, Au, Ag, Si, Ti)', ok: chem2.test(pwd) },
      { id: 8, text: `Сумма заглавных римских цифр I, V, X, L в пароле должна равняться 35 (например XXXV; сейчас: ${romanSum})`, ok: romanSum === 35 },
      { id: 9, text: 'Включите шахматный ход с шахом в нотации (например Qh5+ или Nf3+ или Bb5+)', ok: /[KQRBN][a-h][1-8]\+/.test(pwd) },
      { id: 10, text: 'Поселите в пароль питомца 🐛 и лист 🍃 рядом с ним', ok: pwd.includes('🐛') && pwd.includes('🍃') },
    ];
    let visibleCount = 1;
    for (let i = 0; i < rules.length; i++) {
      if (rules[i].ok) visibleCount = Math.min(rules.length, i + 2);
      else break;
    }
    return { all: rules, visible: rules.slice(0, visibleCount), won: rules.every((r) => r.ok) };
  }, [pwd]);

  // Life Stats up to 2026-10-25
  const lifeStats = useMemo(() => {
    const ref = new Date('2026-10-25T12:00:00Z').getTime();
    const b = new Date(birthDate).getTime();
    const days = Math.max(1, Math.floor((ref - (Number.isNaN(b) ? ref - 8000 * 86400000 : b)) / 86400000));
    return {
      days,
      heartbeats: Math.round(days * 100800),
      breaths: Math.round(days * 20160),
      solarOrbitKm: Math.round(days * 2_573_000),
      galacticKm: Math.round(days * 19_008_000),
      dreams: Math.round(days * 4.2),
      redBloodCells: `${(days * 216).toLocaleString('ru-RU')} млрд`,
    };
  }, [birthDate]);

  const nearestZone = useMemo(() => {
    return OCEAN_ZONES.reduce((best, z) => (Math.abs(z.depth - depthM) < Math.abs(best.depth - depthM) ? z : best), OCEAN_ZONES[0]);
  }, [depthM]);

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-wrap gap-1.5">
        {[
          { id: 'infinite_craft_lab', label: '⚗️ Бесконечная Алхимия' },
          { id: 'spend_billionaire', label: '💸 Потрать $350 Млрд' },
          { id: 'absurd_password_game', label: '🔐 Абсурдный Пароль' },
          { id: 'deep_sea_space_scale', label: '🌊 Глубины и Статистика Жизни' },
        ].map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => onSelectTool(b.id)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
              tab === b.id
                ? 'bg-amber-500/25 border-amber-400 text-amber-100'
                : 'bg-slate-900 border-white/10 text-slate-300'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* 1. INFINITE CRAFT */}
      {tab === 'infinite_craft_lab' && (
        <div className="rounded-2xl bg-slate-900/80 border border-amber-500/25 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Mini3DSceneBadge seed="infinite_craft_lab" color="#f59e0b" size={38} />
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  ⚗️ Бесконечная Алхимия (открыто элементов: {elements.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Левый клик выбирает Слот 1, правый клик или второй выбор — Слот 2, затем нажмите «Скрестить»
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setElements(STARTER_ELEMS);
                localStorage.removeItem('mt_inf_craft_v6');
              }}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Сброс
            </button>
          </div>

          {/* Crucible Reactor */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-amber-400/35 flex flex-wrap items-center justify-center gap-3">
            <div className="px-4 py-2.5 rounded-xl bg-slate-900 border border-sky-400/50 text-sm font-bold text-white">
              {slotA.emoji} {slotA.name}
            </div>
            <span className="text-lg font-black text-amber-400">+</span>
            <div className="px-4 py-2.5 rounded-xl bg-slate-900 border border-fuchsia-400/50 text-sm font-bold text-white">
              {slotB.emoji} {slotB.name}
            </div>
            <button
              type="button"
              onClick={doCombine}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg"
            >
              <Sparkles className="w-4 h-4" /> Скрестить элементы
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {elements.map((el) => (
              <div
                key={el.name}
                className="p-2.5 rounded-xl bg-slate-950/90 border border-white/10 flex flex-col justify-between gap-2 text-xs"
              >
                <div className="font-bold text-white truncate">
                  {el.emoji} {el.name}
                  {el.first && <span className="ml-1 text-[9px] text-amber-300">★ NEW</span>}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => setSlotA(el)}
                    className={`py-1 rounded text-[10px] font-semibold ${
                      slotA.name === el.name ? 'bg-sky-500/30 text-sky-100' : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    Слот 1
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlotB(el)}
                    className={`py-1 rounded text-[10px] font-semibold ${
                      slotB.name === el.name ? 'bg-fuchsia-500/30 text-fuchsia-100' : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    Слот 2
                  </button>
                </div>
              </div>
            ))}
          </div>

          {craftLog.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-1 text-xs font-mono text-slate-300">
              {craftLog.map((ln, idx) => (
                <div key={idx}>{ln}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. SPEND BILLIONAIRE FORTUNE */}
      {tab === 'spend_billionaire' && (
        <div className="rounded-2xl bg-slate-900/80 border border-emerald-500/25 p-4 space-y-4">
          <div className="sticky top-24 z-10 p-4 rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-950 to-teal-950 border border-emerald-400/40 flex flex-wrap items-center justify-between gap-2 shadow-xl">
            <div>
              <div className="text-[11px] uppercase font-mono text-emerald-300">Остаток на счету миллиардера (2026)</div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-white">
                ${leftUsd.toLocaleString('ru-RU')}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-300">
                Потрачено: <b className="text-amber-300">{((spentUsd / fortuneTotal) * 100).toFixed(5)}%</b>
              </div>
              <button
                type="button"
                onClick={() => setCart({})}
                className="mt-1 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] text-white"
              >
                Обнулить чек
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {shopItems.map((it) => {
              const qty = cart[it.id] || 0;
              const canBuy1 = leftUsd >= it.price_usd;
              return (
                <div key={it.id} className="p-3.5 rounded-xl bg-slate-950/90 border border-white/10 flex flex-col justify-between gap-2.5 text-xs">
                  <div>
                    <div className="text-2xl mb-1">{it.emoji}</div>
                    <div className="font-bold text-white text-sm">{it.name}</div>
                    <div className="font-mono text-emerald-300 font-bold mt-0.5">
                      ${Number(it.price_usd).toLocaleString('ru-RU')}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      disabled={qty === 0}
                      onClick={() => setCart((p) => ({ ...p, [it.id]: Math.max(0, (p[it.id] || 0) - 1) }))}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/20 disabled:opacity-30 text-rose-200 font-bold"
                    >
                      Продать
                    </button>
                    <span className="font-mono font-bold text-white text-sm">{qty}</span>
                    <button
                      type="button"
                      disabled={!canBuy1}
                      onClick={() => setCart((p) => ({ ...p, [it.id]: (p[it.id] || 0) + 1 }))}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 disabled:opacity-30 text-slate-950 font-bold"
                    >
                      Купить
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. ABSURD PASSWORD GAME */}
      {tab === 'absurd_password_game' && (
        <div className="rounded-2xl bg-slate-900/80 border border-rose-500/25 p-4 sm:p-5 space-y-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white">🔐 Игра «Абсурдный Пароль» (10 цепных правил)</h3>
            <p className="text-xs text-slate-400">
              Каждое выполненное требование открывает следующее безумное ограничение, не нарушая предыдущие
            </p>
          </div>

          <textarea
            rows={3}
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="Начните придумывать пароль здесь..."
            className="w-full rounded-xl bg-slate-950 border border-white/15 p-3.5 font-mono text-sm text-white focus:outline-none focus:border-amber-400"
          />

          {pwdRules.won && (
            <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-400 text-emerald-100 font-bold text-sm">
              🏆 Все 10 правил Абсурдного Пароля одновременно выполнены! Абсолютный триумф логики!
            </div>
          )}

          <div className="space-y-2">
            {[...pwdRules.visible].reverse().map((r) => (
              <div
                key={r.id}
                className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                  r.ok
                    ? 'bg-emerald-950/35 border-emerald-500/35 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-500/45 text-rose-100'
                }`}
              >
                {r.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <b>Правило #{r.id}:</b> {r.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. DEEP SEA & LIFE STATS */}
      {tab === 'deep_sea_space_scale' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-gradient-to-b from-sky-950/75 via-blue-950/80 to-[#02040a] border border-sky-500/30 p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Waves className="w-4 h-4 text-sky-400" /> Батискаф: Погружение до Марианской Впадины (0 — 10 994 м)
              </h3>
              <span className="font-mono font-black text-lg text-sky-300">−{depthM} м</span>
            </div>

            <input
              type="range"
              min={0}
              max={10994}
              step={10}
              value={depthM}
              onChange={(e) => setDepthM(Number(e.target.value))}
              className="w-full accent-sky-400"
            />

            <div className="flex flex-wrap gap-1.5">
              {OCEAN_ZONES.map((z) => (
                <button
                  key={z.depth}
                  type="button"
                  onClick={() => setDepthM(z.depth)}
                  className="px-2.5 py-1 rounded-lg bg-slate-950/80 hover:bg-sky-500/20 border border-white/10 text-[11px] text-sky-200 font-mono"
                >
                  −{z.depth} м
                </button>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-slate-950/90 border border-sky-400/35 space-y-1.5 text-xs">
              <div className="text-sm font-bold text-white">
                Горизонт ~{nearestZone.depth} м: {nearestZone.title}
              </div>
              <div className="text-sky-300 font-mono">
                Давление: {nearestZone.pressure} • Температура воды: {nearestZone.temp}
              </div>
              <p className="text-slate-300 leading-relaxed">{nearestZone.desc}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900/80 border border-indigo-500/25 p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-white">⏳ Статистика Вашей Жизни во Вселенной (к 25.10.2026)</h4>
                <p className="text-xs text-slate-400">Введите дату рождения для расчёта физических и биологических циклов</p>
              </div>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="rounded-xl bg-slate-950 border border-white/15 px-3 py-1.5 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-white/10">
                <div className="text-slate-400">Прожито суток к 25.10.2026</div>
                <div className="text-lg font-mono font-bold text-white">{lifeStats.days.toLocaleString('ru-RU')}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-white/10">
                <div className="text-slate-400">Ударов вашего сердца</div>
                <div className="text-lg font-mono font-bold text-rose-300">
                  {lifeStats.heartbeats.toLocaleString('ru-RU')}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-white/10">
                <div className="text-slate-400">Сделано вдохов и выдохов</div>
                <div className="text-lg font-mono font-bold text-sky-300">
                  {lifeStats.breaths.toLocaleString('ru-RU')}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-white/10">
                <div className="text-slate-400">Пролетели вместе с Землёй вокруг Солнца</div>
                <div className="text-base font-mono font-bold text-amber-300">
                  {lifeStats.solarOrbitKm.toLocaleString('ru-RU')} км
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-white/10">
                <div className="text-slate-400">Путь вокруг центра Млечного Пути</div>
                <div className="text-base font-mono font-bold text-purple-300">
                  {lifeStats.galacticKm.toLocaleString('ru-RU')} км
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-white/10">
                <div className="text-slate-400">Создано новых эритроцитов</div>
                <div className="text-base font-mono font-bold text-emerald-300">{lifeStats.redBloodCells}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
