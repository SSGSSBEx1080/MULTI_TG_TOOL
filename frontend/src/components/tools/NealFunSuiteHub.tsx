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

const TROLLEY_DILEMMAS = [
  {
    id: 'classic',
    title: '1. Классическая стрелка (Филиппа Фут, 1967)',
    setup: 'Неуправляемая вагонетка несётся по главному пути, на котором привязаны 5 человек. Вы стоите у рычага стрелки и можете перевести её на запасной путь, где находится 1 человек.',
    optA: 'Дёрнуть рычаг (погибнет 1, спасутся 5)',
    optB: 'Не трогать рычаг (не становиться причиной гибели 1)',
    pctA: 73,
    note: 'Утилитаризм выбирает минимум жертв (1 вместо 5); деонтология Канта разграничивает допущение беды и активное причинение вреда.',
  },
  {
    id: 'friend',
    title: '2. Близкий человек на запасном пути',
    setup: 'На главном пути 5 незнакомцев, а на боковой ветке находится ваш близкий друг, с которым вы знакомы всю жизнь.',
    optA: 'Перевести стрелку на боковой путь (спасти 5 незнакомцев)',
    optB: 'Оставить вагонетку на главном пути (спасти друга)',
    pctA: 26,
    note: 'Этика заботы показывает, что личные обязательства перед близкими резко меняют сухую арифметику утилитаризма.',
  },
  {
    id: 'surgeon',
    title: '3. Дилемма хирурга (Джудит Томсон)',
    setup: 'В клинике лежат 5 пациентов, которым срочно нужны 5 разных органов для выживания. В кабинет заходит полностью здоровый путешественник на плановый осмотр.',
    optA: 'Спасти 5 пациентов ценой 1 донора',
    optB: 'Категорически отказаться (неприкосновенность личности)',
    pctA: 8,
    note: 'Математически исход 5 против 1 идентичен первой задаче, но нарушение базовых прав человека делает утилитарный выбор неприемлемым для 92% людей.',
  },
  {
    id: 'autopilot',
    title: '4. Алгоритм беспилотного автомобиля',
    setup: 'Тормоза отказали на горной дороге. Прямо по курсу — 3 пешехода, перебегающих дорогу на красный свет. Справа — бетонный отбойник, удар о который смертелен для 1 пассажира внутри авто.',
    optA: 'Свернуть в отбойник (защитить 3 пешеходов)',
    optB: 'Сохранить полосу и защитить пассажира авто',
    pctA: 41,
    note: 'Парадокс MIT Moral Machine: большинство одобряет утилитарные авто в теории, но отказывается покупать машину, готовую пожертвовать владельцем.',
  },
  {
    id: 'art',
    title: '5. Наследие цивилизации vs Жизнь',
    setup: 'По левому пути вагонетка уничтожит герметичный контейнер с подлинниками «Моны Лизы», рукописями Леонардо да Винчи и Александрийским свитком. По правому — 1 незнакомого человека.',
    optA: 'Спасти человека (уничтожить шедевры)',
    optB: 'Спасти культурное наследие человечества',
    pctA: 86,
    note: 'Проверка границы ценности материальной культуры в сравнении с единичной человеческой жизнью.',
  },
  {
    id: 'loop',
    title: '6. Информированный парадокс будущего',
    setup: 'На главном пути 5 обычных прохожих, на запасном — 1 биоинженер, который через 5 лет гарантированно изобретёт лекарство, спасающее 100 000 человек.',
    optA: 'Перевести стрелку на биоинженера (спасти 5 сейчас)',
    optB: 'Не переводить стрелку (сохранить жизнь учёного и 100 000 в будущем)',
    pctA: 19,
    note: 'Долгосрочный консеквенциализм учитывает цепочку будущих последствий каждого решения.',
  },
];

export const NealFunSuiteHub: React.FC<{
  activeTool: string;
  onSelectTool: (t: string) => void;
  onSync: () => void;
  onToast: (msg: string) => void;
}> = ({ activeTool, onSelectTool, onSync, onToast }) => {
  const tab = (
    [
      'infinite_craft_lab',
      'spend_billionaire',
      'absurd_password_game',
      'deep_sea_space_scale',
      'trolley_problem_sim',
      'asteroid_launcher_sim',
    ] as const
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

  // --- 5. Trolley Problem State ---
  const [trolleyAnswers, setTrolleyAnswers] = useState<Record<string, 'A' | 'B'>>({});

  // --- 6. Asteroid Impact Simulator State ---
  const [astDiamM, setAstDiamM] = useState<number>(370); // Apophis scale
  const [astDensity, setAstDensity] = useState<number>(3100); // Stony kg/m3
  const [astVelKms, setAstVelKms] = useState<number>(19);
  const [astAngleDeg, setAstAngleDeg] = useState<number>(45);

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

  const asteroidStats = useMemo(() => {
    const r = astDiamM / 2;
    const volumeM3 = (4 / 3) * Math.PI * r * r * r;
    const massKg = volumeM3 * astDensity;
    const vMs = astVelKms * 1000;
    const energyJ = 0.5 * massKg * vMs * vMs;
    const megatonsTnt = energyJ / 4.184e15;
    const sinTheta = Math.sin((astAngleDeg * Math.PI) / 180);
    // Collins-Melosh transient-to-final crater scaling against crystalline rock (2650 kg/m3)
    const craterDiamM =
      1.35 *
      Math.pow(astDensity / 2650, 1 / 3) *
      Math.pow(astDiamM, 0.78) *
      Math.pow(vMs, 0.44) *
      Math.pow(9.81, -0.22) *
      Math.pow(sinTheta, 1 / 3);
    const craterDepthM = craterDiamM * 0.21;
    const fireballRadiusKm = 0.0022 * Math.pow(energyJ, 0.333) / 1000;
    const shockwave5psiKm = 2.2 * Math.pow(Math.max(0.001, megatonsTnt), 1 / 3);
    const richterMag = Math.max(0, 0.67 * Math.log10(Math.max(1, energyJ)) - 5.87);
    const airburstOnly = astDiamM < 35 && astDensity <= 3100;
    return {
      massTons: massKg / 1000,
      megatonsTnt,
      craterDiamKm: airburstOnly ? 0 : craterDiamM / 1000,
      craterDepthM: airburstOnly ? 0 : craterDepthM,
      fireballRadiusKm,
      shockwave5psiKm,
      richterMag,
      airburstOnly,
    };
  }, [astDiamM, astDensity, astVelKms, astAngleDeg]);

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-wrap gap-1.5">
        {[
          { id: 'infinite_craft_lab', label: '⚗️ Бесконечная Алхимия' },
          { id: 'spend_billionaire', label: '💸 Потрать $350 Млрд' },
          { id: 'absurd_password_game', label: '🔐 Абсурдный Пароль' },
          { id: 'deep_sea_space_scale', label: '🌊 Глубины и Статистика Жизни' },
          { id: 'trolley_problem_sim', label: '🚋 Проблема Вагонетки' },
          { id: 'asteroid_launcher_sim', label: '☄️ Падение Астероида' },
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

      {/* 5. TROLLEY PROBLEM & MORAL DILEMMAS */}
      {tab === 'trolley_problem_sim' && (
        <div className="rounded-2xl bg-slate-900/80 border border-amber-500/25 p-4 sm:p-5 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">🚋 Проблема Вагонетки и Моральные Дилеммы</h3>
              <p className="text-slate-400">
                Примите решение в каждом сценарии и сравните свой выбор с распределением ответов и классической философией
              </p>
            </div>
            <span className="px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-400/40 font-mono text-amber-200 font-bold">
              Решено: {Object.keys(trolleyAnswers).length} / {TROLLEY_DILEMMAS.length}
            </span>
          </div>

          <div className="space-y-3">
            {TROLLEY_DILEMMAS.map((d) => {
              const choice = trolleyAnswers[d.id];
              return (
                <div key={d.id} className="p-4 rounded-xl bg-slate-950 border border-white/10 space-y-3">
                  <div className="text-sm font-bold text-amber-300">{d.title}</div>
                  <p className="text-slate-200 leading-relaxed">{d.setup}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTrolleyAnswers((prev) => ({ ...prev, [d.id]: 'A' }));
                        onSync();
                      }}
                      className={`p-3 rounded-xl border text-left font-semibold transition ${
                        choice === 'A'
                          ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100'
                          : 'bg-slate-900 border-white/10 text-slate-200 hover:border-white/25'
                      }`}
                    >
                      🔀 {d.optA}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTrolleyAnswers((prev) => ({ ...prev, [d.id]: 'B' }));
                        onSync();
                      }}
                      className={`p-3 rounded-xl border text-left font-semibold transition ${
                        choice === 'B'
                          ? 'bg-sky-500/25 border-sky-400 text-sky-100'
                          : 'bg-slate-900 border-white/10 text-slate-200 hover:border-white/25'
                      }`}
                    >
                      ✋ {d.optB}
                    </button>
                  </div>

                  {choice && (
                    <div className="space-y-1.5 pt-1">
                      <div className="w-full h-5 rounded-lg overflow-hidden flex font-mono text-[10px] font-bold">
                        <div
                          style={{ width: `${d.pctA}%` }}
                          className="bg-emerald-500/75 text-slate-950 flex items-center justify-center"
                        >
                          {d.pctA}%
                        </div>
                        <div
                          style={{ width: `${100 - d.pctA}%` }}
                          className="bg-sky-500/75 text-slate-950 flex items-center justify-center"
                        >
                          {100 - d.pctA}%
                        </div>
                      </div>
                      <p className="text-slate-400 leading-relaxed">{d.note}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. ASTEROID LAUNCHER IMPACT SIMULATOR */}
      {tab === 'asteroid_launcher_sim' && (
        <div className="rounded-2xl bg-slate-900/80 border border-rose-500/30 p-4 sm:p-5 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">☄️ Физический Симулятор Падения Астероида</h3>
              <p className="text-slate-400">
                Расчёт кинетической энергии удара, ударного кратера (модель Коллинза–Мелоша), огненного шара и сейсмики
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Челябинск (18 м)', d: 18, rho: 3100, v: 19 },
                { label: 'Тунгусский (60 м)', d: 60, rho: 1500, v: 22 },
                { label: 'Апофис (370 м)', d: 370, rho: 3100, v: 19 },
                { label: 'Чиксулуб (10 км)', d: 10000, rho: 3100, v: 20 },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setAstDiamM(p.d);
                    setAstDensity(p.rho);
                    setAstVelKms(p.v);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 border border-white/10 hover:border-rose-400 text-rose-200 font-semibold"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Диаметр тела:</span>
                <b className="font-mono text-white">
                  {astDiamM >= 1000 ? `${(astDiamM / 1000).toFixed(2)} км` : `${astDiamM} м`}
                </b>
              </div>
              <input
                type="range"
                min={15}
                max={12000}
                step={5}
                value={astDiamM}
                onChange={(e) => setAstDiamM(Number(e.target.value))}
                className="w-full accent-rose-400"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Скорость входа в атмосферу:</span>
                <b className="font-mono text-amber-300">{astVelKms} км/с</b>
              </div>
              <input
                type="range"
                min={11}
                max={72}
                value={astVelKms}
                onChange={(e) => setAstVelKms(Number(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-1.5">
              <span className="text-slate-400 block">Состав и плотность:</span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { rho: 1000, label: 'Кометный лёд' },
                  { rho: 3100, label: 'Каменный' },
                  { rho: 7800, label: 'Железный' },
                ].map((m) => (
                  <button
                    key={m.rho}
                    type="button"
                    onClick={() => setAstDensity(m.rho)}
                    className={`py-1.5 rounded-lg font-semibold border ${
                      astDensity === m.rho
                        ? 'bg-rose-500/25 border-rose-400 text-rose-100'
                        : 'bg-slate-900 border-white/10 text-slate-300'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Угол входа к горизонту:</span>
                <b className="font-mono text-sky-300">{astAngleDeg}°</b>
              </div>
              <input
                type="range"
                min={15}
                max={90}
                value={astAngleDeg}
                onChange={(e) => setAstAngleDeg(Number(e.target.value))}
                className="w-full accent-sky-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-rose-500/30">
              <div className="text-slate-400">Энергия взрыва (ТНТ)</div>
              <div className="text-base sm:text-lg font-mono font-black text-rose-300 mt-0.5">
                {asteroidStats.megatonsTnt >= 1000
                  ? `${(asteroidStats.megatonsTnt / 1000).toFixed(1)} Гт ТНТ`
                  : asteroidStats.megatonsTnt >= 1
                  ? `${asteroidStats.megatonsTnt.toFixed(1)} Мт ТНТ`
                  : `${(asteroidStats.megatonsTnt * 1000).toFixed(0)} Кт ТНТ`}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950 border border-amber-500/30">
              <div className="text-slate-400">Диаметр кратера</div>
              <div className="text-base sm:text-lg font-mono font-black text-amber-300 mt-0.5">
                {asteroidStats.airburstOnly
                  ? 'Воздушный взрыв'
                  : `${asteroidStats.craterDiamKm.toFixed(2)} км (глуб. ${Math.round(asteroidStats.craterDepthM)} м)`}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950 border border-orange-500/30">
              <div className="text-slate-400">Радиус огненного шара</div>
              <div className="text-base sm:text-lg font-mono font-black text-orange-300 mt-0.5">
                {asteroidStats.fireballRadiusKm.toFixed(2)} км
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950 border border-sky-500/30">
              <div className="text-slate-400">Ударная волна (разрушения)</div>
              <div className="text-base sm:text-lg font-mono font-black text-sky-300 mt-0.5">
                R = {asteroidStats.shockwave5psiKm.toFixed(1)} км
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950 border border-purple-500/30">
              <div className="text-slate-400">Сейсмическая магнитуда</div>
              <div className="text-base sm:text-lg font-mono font-black text-purple-300 mt-0.5">
                M {asteroidStats.richterMag.toFixed(1)} по Рихтеру
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/30">
              <div className="text-slate-400">Масса объекта</div>
              <div className="text-base font-mono font-black text-emerald-300 mt-0.5">
                {asteroidStats.massTons >= 1e9
                  ? `${(asteroidStats.massTons / 1e9).toFixed(2)} млрд т`
                  : asteroidStats.massTons >= 1e6
                  ? `${(asteroidStats.massTons / 1e6).toFixed(2)} млн т`
                  : `${Math.round(asteroidStats.massTons).toLocaleString('ru-RU')} т`}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
