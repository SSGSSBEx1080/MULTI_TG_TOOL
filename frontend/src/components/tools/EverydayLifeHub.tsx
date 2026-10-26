import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlarmClock, BookOpen, Check, ChevronRight, CircleHelp, Clock3, Flower2, Heart, MessageCircle, Music2, Pause, Play, Send, ShieldCheck, Sparkles, Volume2 } from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api';

type Props = { activeTool: string; onToast: (s: string) => void };
type AnyRow = Record<string, any>;
const card = 'rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5';
const field = 'w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400/50';
const btn = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.06] px-3 py-2 text-sm text-slate-100 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 active:scale-[.98]';

type FoodLogEntry = {
  id: string; date: string; food: string; grams: number;
  kcal: number; kj: number; protein_g: number; fat_g: number; carbs_g: number; fiber_g: number;
};
const FOOD_LOG_KEY = 'multi-food-log-v1';
const localDateISO = (date = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const addDaysToLocalISO = (iso: string, days: number): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (localDateISO(date) !== iso) return null;
  date.setDate(date.getDate() + days);
  return Number.isFinite(date.getTime()) ? date : null;
};
const parseFoodLog = (value: unknown): FoodLogEntry[] => {
  if (!Array.isArray(value)) return [];
  return value.slice(-1000).filter((row): row is FoodLogEntry => {
    if (!row || typeof row !== 'object') return false;
    const item = row as Partial<FoodLogEntry>;
    return typeof item.id === 'string' && item.id.length <= 100
      && typeof item.date === 'string' && addDaysToLocalISO(item.date, 0) !== null
      && typeof item.food === 'string' && item.food.length > 0 && item.food.length <= 120
      && [item.grams, item.kcal, item.kj, item.protein_g, item.fat_g, item.carbs_g, item.fiber_g]
        .every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1_000_000);
  });
};

const APPLIANCES = [
  ['Холодильник','Компрессор гонит хладагент по замкнутому контуру: испаритель забирает тепло из камеры, конденсатор отдаёт его комнате.','Не перекрывайте вентиляцию; при утечке, запахе или повреждении контура обратитесь в сервис.'],
  ['Стиральная машина','Набор воды, нагрев (если выбран), вращение барабана, слив и отжим; насос и датчики контролируют цикл.','Перед обслуживанием отключите питание и воду. Не вскрывайте сетевую часть под напряжением.'],
  ['Электрический чайник','Нагревательный элемент преобразует электрическую энергию в тепло; термовыключатель отключает нагрев при кипении.','Не включать пустым, не погружать основание в воду; при повреждении шнура прекратить использование.'],
  ['Микроволновая печь','Магнетрон генерирует СВЧ, металлическая камера формирует поле; вращение/распределитель уменьшает неоднородность нагрева.','Не запускать с открытой дверцей и не снимать кожух: внутри опасные высокие напряжения.'],
  ['Индукционная плита','Переменное магнитное поле индуцирует токи в подходящей посуде, нагревая её дно.','Нужна совместимая посуда; кардиостимуляторы и ограничения сверять с инструкциями производителей.'],
  ['Пылесос','Вентилятор создаёт перепад давления, поток воздуха переносит пыль в фильтр/контейнер.','Фильтры и мешок — по инструкции; не собирать горячую золу или жидкости обычным пылесосом.'],
];
const HABITS = [
  ['Никотин: сигареты, сигары, вейпы','Определите триггеры и дату отказа, уберите запасы, подготовьте замену ритуалу и поддержку. Никотин вызывает зависимость; аэрозоль вейпа не является безвредным.','Врач/фармацевт помогут подобрать доказательные способы отказа, включая никотин-заместительную терапию. При боли в груди или выраженной одышке — срочная помощь.'],
  ['Грызть ногти / ковырять кожу','Заметьте контекст, укоротите ногти, закройте триггерные поверхности пластырем, займите руки безопасным предметом.','При кровотечении, инфекции, сильном стрессе или невозможности остановиться обсудите привычку со специалистом; помогают поведенческие подходы.'],
  ['Компульсивная мастурбация / порнография','Само по себе либидо не является болезнью. Оценивайте влияние на сон, отношения, безопасность и повседневные обязанности; задайте реалистичные границы.','Обращение к сексологу/психотерапевту уместно при потере контроля или заметном ущербе, без стыда и моральных ярлыков.'],
  ['Ковыряние в носу / поедание слизи','Это не «слабость характера»: сухость и раздражение могут поддерживать цикл. Увлажнение воздуха и солевой раствор иногда помогают.','Не травмировать слизистую; при частых кровотечениях, боли или корках обратитесь к врачу.']
];
const SLEEP_TIPS = ['Стабильное время подъёма помогает закрепить циркадный ритм.','Большинству взрослых рекомендуется регулярно спать не менее 7 часов; потребность индивидуальна.','Уменьшите яркий свет и активную работу перед сном, если они мешают засыпанию.','Кофеин может мешать сну многие часы; чувствительность сильно различается.','При стойкой бессоннице, громком храпе с остановками дыхания или дневной сонливости обратитесь к врачу.'];
const COLORS = ['#38bdf8','#818cf8','#c084fc','#f472b6','#fb7185','#fb923c','#facc15','#4ade80','#2dd4bf','#a3e635'];

function getLocalUserId() { try { const w = window as any; return Number(w.Telegram?.WebApp?.initDataUnsafe?.user?.id || 0); } catch { return 0; } }

export const EverydayLifeHub: React.FC<Props> = ({ activeTool, onToast }) => {
  const [catalog, setCatalog] = useState<any>({});
  const [food, setFood] = useState('Овсяные хлопья, сухие');
  const [foodQuery, setFoodQuery] = useState('');
  const [grams, setGrams] = useState(60);
  const [nutrition, setNutrition] = useState<any>(null);
  const [foodLog, setFoodLog] = useState<FoodLogEntry[]>([]);
  const [foodLogDay, setFoodLogDay] = useState(localDateISO);
  const [foodLogLoaded, setFoodLogLoaded] = useState(false);
  const [foodLogCanPersist, setFoodLogCanPersist] = useState(false);
  const [foodLogStorageError, setFoodLogStorageError] = useState(false);
  const [wake, setWake] = useState('07:30');
  const [latency, setLatency] = useState(15);
  const [sleep, setSleep] = useState<any>(null);
  const [bouquetRows, setBouquetRows] = useState([{ name: 'Роза', count: 1, price: 0 }]);
  const [bouquetWrap, setBouquetWrap] = useState(0);
  const [bouquetLabor, setBouquetLabor] = useState(0);
  const [bouquetMarkup, setBouquetMarkup] = useState(0);
  const [bouquetCurrency, setBouquetCurrency] = useState<'RUB'|'EUR'|'USD'|'GBP'|'KZT'>('RUB');
  const [bouquet, setBouquet] = useState<any>(null);
  const [gameMode, setGameMode] = useState<'cities'|'names'|'words'>('cities');
  const [gameEntry, setGameEntry] = useState('');
  const [gameWords, setGameWords] = useState<string[]>([]);
  const [gameMessage, setGameMessage] = useState('Начните цепочку. Следующее слово — на последнюю букву предыдущего.');
  const [alarmTime, setAlarmTime] = useState('08:00');
  const [alarmOn, setAlarmOn] = useState(false);
  const [alarmTick, setAlarmTick] = useState('');
  const [cycleDate, setCycleDate] = useState('');
  const [cycleDays, setCycleDays] = useState(28);
  const [cycleSaved, setCycleSaved] = useState(false);
  const [instrument, setInstrument] = useState<'piano'|'guitar'|'drums'>('piano');
  useEffect(() => {
    if (activeTool === 'music_guitar') setInstrument('guitar');
    else if (activeTool === 'music_drums') setInstrument('drums');
    else if (activeTool === 'music_keyboard') setInstrument('piano');
  }, [activeTool]);
  const [activeNotes, setActiveNotes] = useState<string[]>([]);
  const audioRef = useRef<AudioContext | null>(null);
  const [chat, setChat] = useState<any>({messages: []});
  const [chatText, setChatText] = useState('');
  const [replyTo, setReplyTo] = useState<any>(null);
  const [chatTopic, setChatTopic] = useState('general');
  const [chatBusy, setChatBusy] = useState(false);
  const [snell, setSnell] = useState({ n1: 1, n2: 1.5, angle: 35 });
  const userId = useMemo(getLocalUserId, []);
  const isChat = activeTool === 'public_chat';

  useEffect(() => { apiGet('/api/life/catalog').then(setCatalog).catch((e:any) => onToast(e.message)); }, []);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FOOD_LOG_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) throw new Error('Stored food log is not an array');
      setFoodLog(parseFoodLog(parsed)); setFoodLogCanPersist(true);
    } catch { setFoodLogStorageError(true); }
    finally { setFoodLogLoaded(true); }
  }, []);
  useEffect(() => {
    if (!foodLogLoaded || !foodLogCanPersist) return;
    try {
      localStorage.setItem(FOOD_LOG_KEY, JSON.stringify(foodLog));
      setFoodLogStorageError(false);
    } catch { setFoodLogStorageError(true); }
  }, [foodLog, foodLogLoaded, foodLogCanPersist]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('multi-cycle-local') || '{}');
      if (typeof saved.date === 'string' && addDaysToLocalISO(saved.date, 0)
        && Number.isInteger(saved.days) && saved.days >= 15 && saved.days <= 60) {
        setCycleDate(saved.date); setCycleDays(saved.days); setCycleSaved(true);
      }
    } catch { /* ignore invalid local settings */ }
  }, []);
  useEffect(() => {
    if (!alarmOn) return;
    const tick = () => {
      const now = new Date();
      setAlarmTick(now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'}));
      if (`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}` === alarmTime && now.getSeconds() < 2) {
        setAlarmOn(false); onToast('Будильник: пора!');
        try { const ctx = audioRef.current || new AudioContext(); audioRef.current = ctx; const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.frequency.value = 880; gain.gain.value = .16; osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 1.2); } catch { /* audio may be blocked */ }
        if ('Notification' in window && Notification.permission === 'granted') new Notification('MULTI_TG_TOOL — будильник');
      }
    };
    tick(); const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer);
  }, [alarmOn, alarmTime, onToast]);

  const refreshChat = useCallback(async () => {
    if (!isChat) return;
    try { setChat(await apiGet(`/api/life/chat?topic=${encodeURIComponent(chatTopic)}&user_id=${userId}`)); } catch (e:any) { onToast(e.message); }
  }, [isChat, chatTopic, userId, onToast]);
  useEffect(() => { refreshChat(); if (!isChat) return; const t = window.setInterval(refreshChat, 5000); return () => window.clearInterval(t); }, [refreshChat, isChat]);

  const playTone = (frequency: number, duration = .32, waveform: OscillatorType = 'triangle') => {
    try {
      const ctx = audioRef.current || new AudioContext(); audioRef.current = ctx;
      if (ctx.state === 'suspended') void ctx.resume();
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = waveform; osc.frequency.value = frequency; gain.gain.setValueAtTime(.0001, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.22, ctx.currentTime + .015); gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + duration);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + duration + .03);
    } catch (e:any) { onToast(`Звук недоступен: ${e.message || 'разрешите аудио'}`); }
  };

  const runNutrition = async () => { setNutrition(null); try { setNutrition(await apiPost('/api/life/nutrition', {food, grams})); } catch (e:any) { onToast(e.message); } };
  const dayFoodLog = foodLog.filter((entry) => entry.date === foodLogDay);
  const foodLogTotals = dayFoodLog.reduce((sum, entry) => ({
    kcal: sum.kcal + entry.kcal, kj: sum.kj + entry.kj, protein_g: sum.protein_g + entry.protein_g,
    fat_g: sum.fat_g + entry.fat_g, carbs_g: sum.carbs_g + entry.carbs_g,
    fiber_g: sum.fiber_g + entry.fiber_g,
  }), {kcal: 0, kj: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0});
  const addNutritionToFoodLog = () => {
    if (!addDaysToLocalISO(foodLogDay, 0)) { onToast('Выберите корректную дату для записи'); return; }
    if (!nutrition || !Number.isFinite(Number(nutrition.grams)) || Number(nutrition.grams) <= 0) {
      onToast('Сначала рассчитайте положительную массу порции');
      return;
    }
    const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const entry: FoodLogEntry = {
      id: uuid, date: foodLogDay, food: String(nutrition.food).slice(0, 120),
      grams: Number(nutrition.grams), kcal: Number(nutrition.kcal), kj: Number(nutrition.kj),
      protein_g: Number(nutrition.protein_g), fat_g: Number(nutrition.fat_g),
      carbs_g: Number(nutrition.carbs_g), fiber_g: Number(nutrition.fiber_g),
    };
    setFoodLog((items) => [...items, entry].slice(-1000));
    onToast(`Добавлено в локальный дневник на ${foodLogDay}`);
  };
  const removeFoodLogEntry = (id: string) => setFoodLog((items) => items.filter((entry) => entry.id !== id));
  const clearFoodLogDay = () => {
    if (!dayFoodLog.length || !window.confirm(`Удалить ${dayFoodLog.length} записей за ${foodLogDay} с этого устройства?`)) return;
    setFoodLog((items) => items.filter((entry) => entry.date !== foodLogDay));
  };
  const exportFoodLog = () => {
    if (!dayFoodLog.length) return;
    const csvCell = (value: string | number) => {
      let text = String(value).replace(/[\r\n]+/g, ' ');
      if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    const rows = [
      ['Дата', 'Продукт', 'Масса, г', 'ккал', 'кДж', 'Белки, г', 'Жиры, г', 'Углеводы, г', 'Клетчатка, г'],
      ...dayFoodLog.map((entry) => [entry.date, entry.food, entry.grams, entry.kcal, entry.kj, entry.protein_g, entry.fat_g, entry.carbs_g, entry.fiber_g]),
    ];
    const content = `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([content], {type: 'text/csv;charset=utf-8'}));
    const link = document.createElement('a'); link.href = url; link.download = `food-log-${foodLogDay}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const runSleep = async () => { try { setSleep(await apiPost('/api/life/sleep', {wake_time:wake, latency_min:latency})); } catch (e:any) { onToast(e.message); } };
  const runBouquet = async () => {
    setBouquet(null);
    try { setBouquet(await apiPost('/api/life/bouquet', {stems:bouquetRows, wrapping:bouquetWrap, labor:bouquetLabor, markup_pct:bouquetMarkup, currency:bouquetCurrency})); }
    catch (e:any) { onToast(e.message); }
  };
  const submitChat = async (ev: React.FormEvent) => { ev.preventDefault(); if (!chatText.trim() || chatBusy) return; setChatBusy(true); try { setChat(await apiPost('/api/life/chat', {user_id:userId, topic:chatTopic, text:chatText, reply_to_id:replyTo?.id || 0})); setChatText(''); setReplyTo(null); } catch(e:any) { onToast(e.message); } finally { setChatBusy(false); } };
  const reactChat = async (id:number, emoji:string) => { try { setChat(await apiPost(`/api/life/chat/${id}/reaction`, {user_id:userId, topic:chatTopic, emoji})); } catch(e:any) { onToast(e.message); } };
  const chatAction = async (id:number, action:string, text='') => { try { setChat(await apiPost(`/api/life/chat/${id}/action`, {user_id:userId, topic:chatTopic, action, text})); } catch(e:any) { onToast(e.message); } };

  const gameAdd = () => {
    const word = gameEntry.trim().toLocaleLowerCase('ru-RU').replaceAll('ё','е');
    if (!word || !/^[а-яa-z -]+$/i.test(word)) { setGameMessage('Введите слово русскими или латинскими буквами.'); return; }
    if (gameWords.includes(word)) { setGameMessage('Это слово уже использовали.'); return; }
    const prev = gameWords.at(-1); const last = prev?.replace(/[^а-яa-z]/gi,'').slice(-1);
    const first = word.replace(/[^а-яa-z]/gi,'')[0];
    if (last && first !== last) { setGameMessage(`Нужно слово на букву «${last.toUpperCase()}».`); return; }
    setGameWords((v) => [...v, word]); setGameEntry(''); setGameMessage(`Принято: ${word}. Следующая буква — «${word.replace(/[^а-яa-z]/gi,'').slice(-1).toUpperCase()}».`);
  };
  const saveCycle = () => {
    if (!addDaysToLocalISO(cycleDate, 0) || cycleDate > localDateISO()) { onToast('Укажите корректную дату не позже сегодняшнего дня'); return; }
    if (!Number.isInteger(cycleDays) || cycleDays < 15 || cycleDays > 60) { onToast('Длина цикла должна быть целым числом от 15 до 60 дней'); return; }
    try {
      localStorage.setItem('multi-cycle-local', JSON.stringify({date:cycleDate, days:cycleDays}));
      setCycleSaved(true); onToast('Данные цикла сохранены только в этом браузере');
    } catch { setCycleSaved(false); onToast('Браузер не смог сохранить данные цикла'); }
  };
  const nextPeriodDate = cycleDate ? addDaysToLocalISO(cycleDate, cycleDays) : null;
  const nextPeriod = nextPeriodDate ? new Intl.DateTimeFormat('ru-RU', {dateStyle:'long'}).format(nextPeriodDate) : '';
  const phaseAngle = snell.n1 * Math.sin(snell.angle * Math.PI / 180) / snell.n2;
  const refracted = Math.abs(phaseAngle) <= 1 ? Math.asin(phaseAngle) * 180 / Math.PI : null;

  const header = (eyebrow:string, title:string, subtitle:string) => <header className="mb-4"><div className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-cyan-300">{eyebrow}</div><h2 className="text-xl font-black text-white sm:text-2xl">{title}</h2><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">{subtitle}</p></header>;
  const safe = (text:string) => <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[.06] p-3 text-xs leading-relaxed text-amber-100/80"><ShieldCheck className="mr-1 inline h-4 w-4"/>{text}</div>;
  const selected = (key:string) => activeTool === key;

  if (isChat) return <section className={`${card} flex min-h-[70vh] flex-col`}>
    {header('ОБЩЕНИЕ · ПУБЛИЧНЫЙ ЧАТ', 'Общий чат с именами', 'Сообщения публикуются с именем Telegram-профиля. Доступность отдельных функций Telegram зависит от подключения и прав пользователя.')}
    {!userId && <div className="mb-3 rounded-lg border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-amber-200">Откройте Mini App из Telegram, чтобы публиковать сообщения от своего аккаунта. Вне Telegram чат доступен только для просмотра.</div>}
    <div className="mb-3 flex gap-2"><select className={`${field} max-w-xs`} value={chatTopic} onChange={e=>setChatTopic(e.target.value)}><option value="general">Общий</option><option value="games">Игры</option><option value="science">Наука</option><option value="music">Музыка</option></select><button className={btn} onClick={refreshChat}><Activity className="h-4 w-4"/>Обновить</button></div>
    {!!chat.pinned && <div className="mb-3 rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-3 text-xs"><b>📌 Закреплено · {chat.pinned.sender_name}</b><div className="mt-1">{chat.pinned.text || chat.pinned.sticker}</div></div>}
    <div className="flex-1 space-y-3 overflow-y-auto rounded-xl bg-black/20 p-2 sm:p-3">{(chat.messages||[]).map((m:any)=><article key={m.id} className="rounded-xl border border-white/[.06] bg-slate-950/65 p-3">
      {m.reply_preview && <div className="mb-2 border-l-2 border-cyan-400 pl-2 text-xs text-slate-400">↪ {m.reply_preview}</div>}
      <div className="flex flex-wrap items-center gap-2"><span>{m.sender_avatar}</span><b className="text-sm text-cyan-200">{m.sender_name}</b>{m.sender_username&&<span className="text-xs text-slate-500">@{m.sender_username}</span>}<span className="text-[10px] text-slate-500">{new Date(m.created_at*1000).toLocaleString()}</span>{m.edited_at>0&&<span className="text-[10px] text-slate-500">изменено</span>}</div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-200">{m.text}{m.sticker&&` ${m.sticker}`}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5"><button className={btn} onClick={()=>setReplyTo(m)}><MessageCircle className="h-3.5 w-3.5"/>Ответить</button>{['❤️','👍','😂','🔥','🎉'].map((emoji:string)=><button key={emoji} className={`${btn} !px-2 !py-1 text-xs ${m.reactions?.find((r:any)=>r.emoji===emoji&&r.me)?'border-cyan-400/40 bg-cyan-500/15':''}`} onClick={()=>reactChat(m.id,emoji)}>{emoji} {m.reactions?.find((r:any)=>r.emoji===emoji)?.count||''}</button>)}{m.is_own&&<><button className={btn} onClick={()=>{const value=window.prompt('Изменить сообщение',m.text); if(value!==null) chatAction(m.id,'edit',value);}}>Изменить</button><button className={btn} onClick={()=>{if(window.confirm('Удалить своё сообщение?'))chatAction(m.id,'delete');}}>Удалить</button><button className={btn} onClick={()=>chatAction(m.id,'pin')}>{m.is_pinned?'Открепить':'Закрепить'}</button></>}</div>
    </article>)}</div>
    <form className="mt-3 space-y-2" onSubmit={submitChat}>{replyTo&&<div className="flex items-center justify-between rounded-lg bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">Ответ: {replyTo.sender_name} — {(replyTo.text||'').slice(0,70)}<button type="button" onClick={()=>setReplyTo(null)}>×</button></div>}<div className="flex gap-2"><input className={field} value={chatText} onChange={e=>setChatText(e.target.value)} placeholder="Сообщение в общий чат" maxLength={1200}/><button className={`${btn} shrink-0`} disabled={!userId||chatBusy}><Send className="h-4 w-4"/>Отправить</button></div></form>
  </section>;

  if (selected('nutrition_bju_calc')) return <div className="space-y-4">
    {header('ПИТАНИЕ · СПРАВОЧНЫЙ РАСЧЁТ','БЖУ, ккал, кДж и дневник продуктов','Посчитайте справочный состав порции и при желании запишите её в дневник на выбранную дату. Дневник хранится только в этом браузере; он не задаёт норму питания и не оценивает рацион.')}
    <section className={card}>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_160px_auto]">
        <label className="text-xs text-slate-400">Поиск продукта<input className={`${field} mt-1`} value={foodQuery} onChange={e=>setFoodQuery(e.target.value)} placeholder="Например, фасоль, лосось…"/></label>
        <label className="text-xs text-slate-400">Продукт<select className={`${field} mt-1`} value={food} onChange={e=>{setFood(e.target.value);setNutrition(null)}}>{(catalog.foods||[]).filter((x:any)=>x.name===food||!foodQuery||x.name.toLocaleLowerCase('ru').includes(foodQuery.toLocaleLowerCase('ru'))).map((x:any)=><option key={x.name} value={x.name}>{x.name}</option>)}</select></label>
        <label className="text-xs text-slate-400">Масса, г<input className={`${field} mt-1`} type="number" min="0" max="10000" step="0.1" value={grams} onChange={e=>{setGrams(Number(e.target.value));setNutrition(null)}}/></label>
        <button className={`${btn} self-end`} onClick={runNutrition}><Activity className="h-4 w-4"/>Посчитать</button>
      </div>
      {nutrition&&<>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Энергия',`${nutrition.kcal} ккал`],['Энергия',`${nutrition.kj} кДж`],['Белки',`${nutrition.protein_g} г`],['Жиры',`${nutrition.fat_g} г`],['Углеводы',`${nutrition.carbs_g} г`],['Клетчатка',`${nutrition.fiber_g} г`],['ХЕ*',nutrition.bread_units],['Порция',`${nutrition.grams} г`]].map(([k,v])=><div key={k+v} className="rounded-xl bg-slate-950 p-3"><div className="text-[11px] text-slate-500">{k}</div><b className="mt-1 block text-lg text-white">{v}</b></div>)}</div>
        <p className="mt-3 text-xs text-slate-500">{nutrition.reference}</p>
        <button className={`${btn} mt-3`} onClick={addNutritionToFoodLog} disabled={!foodLogLoaded || Number(nutrition.grams)<=0}>＋ Записать эту порцию в дневник за {foodLogDay}</button>
      </>}
    </section>

    <section className={card}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="min-w-48 flex-1 text-xs text-slate-400">Дата дневника<input className={`${field} mt-1 max-w-xs`} type="date" value={foodLogDay} onChange={e=>setFoodLogDay(e.target.value)}/></label>
        <div className="flex flex-wrap gap-2">
          <button className={btn} onClick={exportFoodLog} disabled={!dayFoodLog.length}>Экспорт CSV</button>
          <button className={`${btn} border-rose-300/15 text-rose-200`} onClick={clearFoodLogDay} disabled={!dayFoodLog.length}>Очистить этот день</button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {[[`Записано · ${dayFoodLog.length}`, 'порций'], ['Энергия', `${foodLogTotals.kcal.toFixed(1)} ккал`], ['Энергия', `${foodLogTotals.kj.toFixed(1)} кДж`], ['Белки', `${foodLogTotals.protein_g.toFixed(1)} г`], ['Жиры', `${foodLogTotals.fat_g.toFixed(1)} г`], ['Углеводы', `${foodLogTotals.carbs_g.toFixed(1)} г`], ['Клетчатка', `${foodLogTotals.fiber_g.toFixed(1)} г`]].map(([label,value], index)=><div className="rounded-xl bg-slate-950 p-3" key={`${label}-${index}`}><div className="text-[11px] text-slate-500">{label}</div><b className="mt-1 block text-sm text-white">{value}</b></div>)}
      </div>
      {dayFoodLog.length===0?<p className="mt-4 rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-slate-500">За эту дату записей пока нет. Рассчитайте порцию выше и добавьте её вручную.</p>:<ul className="mt-4 space-y-2">{dayFoodLog.map(entry=><li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-slate-950/70 p-3">
        <div className="min-w-0"><b className="text-sm text-white">{entry.food}</b><div className="mt-1 text-xs text-slate-400">{entry.grams} г · {entry.kcal.toFixed(1)} ккал · Б {entry.protein_g.toFixed(1)} г · Ж {entry.fat_g.toFixed(1)} г · У {entry.carbs_g.toFixed(1)} г · Клетчатка {entry.fiber_g.toFixed(1)} г</div></div>
        <button type="button" className="rounded-lg px-2 py-1 text-xs text-rose-200 hover:bg-rose-400/10" aria-label={`Удалить запись: ${entry.food}`} onClick={()=>removeFoodLogEntry(entry.id)}>Удалить</button>
      </li>)}</ul>}
      <p className="mt-3 text-xs text-slate-500">Значения ориентировочные и не учитывают точную марку, рецепт и приготовление. Данные остаются на устройстве; экспорт создаёт CSV-файл вручную.</p>
      {foodLogStorageError&&<p role="status" className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/[.06] p-3 text-xs text-amber-100">Браузер не смог прочитать или сохранить дневник. Экспортируйте нужные записи, если они доступны, и проверьте настройки хранилища.</p>}
    </section>
  </div>;

  if (selected('sleep_calculator')) return <div className="space-y-4">{header('РЕЖИМ · СОН','Планировщик времени сна','Обратный расчёт времени, когда лечь, по времени подъёма. 90 минут — условная длительность цикла, а не точное предсказание фаз.')}
    <div className={`${card} grid gap-3 sm:grid-cols-[1fr_1fr_auto]`}><label className="text-xs text-slate-400">Подъём<input className={`${field} mt-1`} type="time" value={wake} onChange={e=>setWake(e.target.value)}/></label><label className="text-xs text-slate-400">Засыпание, мин<input className={`${field} mt-1`} type="number" min="0" max="120" value={latency} onChange={e=>setLatency(Number(e.target.value))}/></label><button className={`${btn} self-end`} onClick={runSleep}><Clock3 className="h-4 w-4"/>Подобрать</button></div>
    {sleep?.options&&<div className="grid gap-3 sm:grid-cols-3">{sleep.options.map((x:any)=><article className={card} key={x.cycles}><div className="text-xs text-slate-400">{x.cycles} условных циклов · {x.sleep_hours} ч</div><div className="mt-2 text-3xl font-black text-cyan-200">{x.bedtime}</div><p className="mt-2 text-xs text-slate-500">{x.note}</p></article>)}</div>}{safe(sleep?.note||'Сонный калькулятор не диагностирует расстройства сна. При стойких проблемах обратитесь к врачу.')}</div>;

  if (selected('menstrual_cycle_tracker')) return <div className="space-y-4">{header('ПРИВАТНОСТЬ · ЦИКЛ','Календарь менструального цикла','Даты хранятся только в localStorage этого браузера и не отправляются на сервер. Прогноз приблизительный: циклы и кровотечения могут меняться.')}
    <div className={`${card} grid gap-3 sm:grid-cols-3`}><label className="text-xs text-slate-400">Первый день последней менструации<input className={`${field} mt-1`} type="date" max={localDateISO()} value={cycleDate} onChange={e=>{setCycleDate(e.target.value);setCycleSaved(false)}}/></label><label className="text-xs text-slate-400">Введённая средняя длина цикла, дней<input className={`${field} mt-1`} type="number" min="15" max="60" step="1" value={cycleDays} onChange={e=>{const value=Number(e.target.value);if(Number.isFinite(value))setCycleDays(Math.max(15,Math.min(60,Math.trunc(value))))}}/></label><button className={`${btn} self-end`} onClick={saveCycle}><Heart className="h-4 w-4"/>Сохранить локально</button></div>
    {nextPeriod&&<div className={card}><div className="text-sm text-slate-400">Календарный расчёт по введённой длине цикла</div><div className="mt-2 text-3xl font-black text-pink-200">{nextPeriod}</div><p className="mt-2 text-xs text-slate-500">Это только дата, полученная прибавлением введённого числа дней к выбранной дате. Она не предсказывает фактическое кровотечение, не диагностирует состояние и не является методом контрацепции. При необычной боли, кровотечении или тревожных симптомах обратитесь за медицинской помощью.</p>{cycleSaved&&<span className="mt-3 inline-flex items-center gap-1 text-xs text-emerald-300"><Check className="h-4 w-4"/>Данные сохранены на устройстве</span>}</div>}{safe('Если нужна точная конфиденциальность, не используйте общий или чужой браузер. Можно очистить данные сайта, чтобы удалить сохранённую запись.')}</div>;

  if (selected('alarm_clock')) return <div className="space-y-4">{header('ЛОКАЛЬНО · БУДИЛЬНИК','Будильник браузера','Работает пока вкладка открыта. Браузер может приостанавливать фоновые вкладки — для критичного будильника используйте системное приложение.')}
    <div className={`${card} flex flex-col items-center gap-4 py-8`}><div className="font-mono text-5xl font-black tabular-nums text-cyan-200">{alarmTick||new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div><div className="flex flex-wrap justify-center gap-3"><input className={`${field} max-w-[170px] text-center text-lg`} type="time" value={alarmTime} onChange={e=>setAlarmTime(e.target.value)}/><button className={`${btn} ${alarmOn?'border-rose-400/40 bg-rose-500/10':''}`} onClick={async()=>{if(!alarmOn&&'Notification'in window&&Notification.permission==='default') await Notification.requestPermission(); setAlarmOn(!alarmOn)}}>{alarmOn?<Pause className="h-4 w-4"/>:<Play className="h-4 w-4"/>}{alarmOn?'Остановить':'Включить'}</button></div><div className="text-sm text-slate-400">{alarmOn?`Установлен на ${alarmTime}`:'Будильник выключен'}</div></div>{safe('Звук и уведомления зависят от разрешений и ограничений браузера. Не полагайтесь на страницу для экстренных или жизненно важных напоминаний.')}</div>;

  if (selected('word_chain_games')) return <div className="space-y-4">{header('ИГРА · СЛОВЕСНАЯ ЦЕПОЧКА','Слова, города и имена','Играйте вдвоём на одном устройстве: называйте города, имена или любые слова на последнюю букву предыдущего. Буквы ь, ъ, ы пропускаются.')}
    <div className={card}><div className="flex flex-wrap gap-2">{(['cities','names','words'] as const).map(m=><button key={m} className={`${btn} ${gameMode===m?'border-cyan-400/40 bg-cyan-400/10':''}`} onClick={()=>{setGameMode(m);setGameWords([]);setGameMessage('Начните новую цепочку.')}}>{m==='cities'?'Города':m==='names'?'Имена':'Слова'}</button>)}<button className={`${btn} ml-auto`} onClick={()=>{setGameWords([]);setGameMessage('Новая цепочка. Начинайте!')}}>Новая игра</button></div><form className="mt-4 flex gap-2" onSubmit={e=>{e.preventDefault();gameAdd()}}><input className={field} value={gameEntry} onChange={e=>setGameEntry(e.target.value)} placeholder={gameMode==='cities'?'Введите город':gameMode==='names'?'Введите имя':'Введите слово'}/><button className={btn}>Ход</button></form><div className="mt-3 rounded-lg bg-slate-950 p-3 text-sm text-cyan-100">{gameMessage}</div><div className="mt-4 flex flex-wrap gap-2">{gameWords.map((w,i)=><span key={`${w}${i}`} className="rounded-lg border border-white/10 bg-white/[.04] px-3 py-1.5 text-sm">{i+1}. {w}</span>)}</div></div>
  </div>;

  if (selected('music_keyboard')||selected('music_guitar')||selected('music_drums')) {
    const mode = instrument;
    const noteNames = ['До','Ре','Ми','Фа','Соль','Ля','Си','До⁵'];
    const freqs = [261.63,293.66,329.63,349.23,392,440,493.88,523.25];
    const drumNames=['Бочка','Малый','Закрытый хэт','Открытый хэт','Том','Крэш'];
    const drumFreq=[65,180,5500,9000,125,3200];
    const chords=[['C','До–Ми–Соль'],['Am','Ля–До–Ми'],['F','Фа–Ля–До'],['G','Соль–Си–Ре'],['Dm','Ре–Фа–Ля'],['Em','Ми–Соль–Си']];
    return <div className="space-y-4">{header('ИНСТРУМЕНТЫ · WEB AUDIO',mode==='piano'?'Экранное пианино':mode==='guitar'?'Гитара: аккорды и струны':'Экранные барабаны','Звуки синтезируются в браузере и требуют первого нажатия для включения аудио. Экранная версия предназначена для обучения и игры, не заменяет физический инструмент.')}
      <div className={card}><div className="mb-4 flex flex-wrap gap-2">{[['piano','Пианино'],['guitar','Гитара'],['drums','Барабаны']].map(([key,label])=><button key={key} className={`${btn} ${mode===key?'border-cyan-400/40 bg-cyan-400/10':''}`} onClick={()=>{setInstrument(key as any);if(key==='piano')void onToast('Выбрано пианино');else if(key==='guitar')void onToast('Выбрана гитара');else void onToast('Выбраны барабаны')}}>{label}</button>)}</div>
      {mode==='piano'&&<div className="grid grid-cols-4 gap-1 sm:grid-cols-8">{noteNames.map((n,i)=><button key={n+i} className={`h-36 rounded-b-xl border border-slate-300/20 bg-gradient-to-b from-white to-slate-200 text-slate-900 shadow-lg transition active:scale-[.98] ${activeNotes.includes(n)?'ring-4 ring-cyan-300':''}`} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);playTone(freqs[i]);setActiveNotes(v=>[...v,n])}} onPointerUp={()=>setActiveNotes(v=>v.filter(x=>x!==n))} onPointerCancel={()=>setActiveNotes(v=>v.filter(x=>x!==n))} onPointerLeave={()=>setActiveNotes(v=>v.filter(x=>x!==n))}><span className="mt-24 block text-xs font-bold">{n}</span></button>)}</div>}
      {mode==='guitar'&&<><div className="grid gap-2 sm:grid-cols-3">{chords.map(([name,notes],idx)=><button key={name} className={`${btn} flex-col py-4`} onClick={()=>{[freqs[idx%7],freqs[(idx+2)%7],freqs[(idx+4)%7]].forEach((f,j)=>window.setTimeout(()=>playTone(f,.8,'sawtooth'),j*28))}}><b className="text-2xl text-cyan-200">{name}</b><span className="text-xs text-slate-400">{notes}</span><span className="mt-1 text-[10px] text-slate-500">Играть аккорд</span></button>)}</div><div className="mt-4 space-y-2 rounded-xl bg-slate-950 p-4">{[82.41,110,146.83,196,246.94,329.63].map((f,i)=><button key={i} className="block w-full rounded-lg border border-amber-100/10 bg-gradient-to-r from-amber-950/90 to-yellow-900/60 p-2 text-left text-xs text-amber-100" onClick={()=>playTone(f,.55,'triangle')}>Струна {6-i} · {['Ми','Ля','Ре','Соль','Си','Ми'][i]} — нажмите, чтобы сыграть</button>)}</div></>}
      {mode==='drums'&&<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{drumNames.map((n,i)=><button key={n} className={`${btn} min-h-28 flex-col rounded-2xl border-white/10 bg-gradient-to-br from-violet-500/20 to-slate-950 text-lg`} onClick={()=>playTone(drumFreq[i],i===2?0.05:.18,i<2?'sine':'square')}><Volume2 className="h-6 w-6 text-violet-200"/>{n}<span className="text-[10px] text-slate-500">Играть</span></button>)}</div>}
      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Music2 className="h-4 w-4"/>Web Audio · Ноты звучат после действия пользователя</div></div>
    </div>;
  }

  if (selected('flower_bouquet_calc')) return <div className="space-y-4">
    {header('ФЛОРИСТИКА · СМЕТА','Калькулятор букета','Составьте смету из своих закупочных цен. Введите валюту и все прямые расходы; наценка считается от себестоимости, не является обещанием чистой прибыли.')}
    <section className={card}>
      <div className="hidden gap-2 px-1 pb-2 text-[11px] text-slate-500 sm:grid sm:grid-cols-[minmax(0,1fr)_90px_130px_auto]"><span>Цветок / материал</span><span>Стеблей</span><span>Цена за штуку</span><span /></div>
      <div className="space-y-2">{bouquetRows.map((row,index)=><div className="grid grid-cols-[minmax(0,1fr)_64px_86px_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_90px_130px_auto]" key={index}>
        <input className={field} value={row.name} maxLength={40} aria-label={`Название позиции ${index+1}`} placeholder="Роза, зелень…" onChange={e=>{setBouquet(null);setBouquetRows(items=>items.map((item,i)=>i===index?{...item,name:e.target.value}:item))}} />
        <input className={field} type="number" min="0" max="300" step="1" value={row.count} aria-label={`Количество стеблей, строка ${index+1}`} onChange={e=>{const count=Number(e.target.value);if(!Number.isFinite(count))return;setBouquet(null);setBouquetRows(items=>items.map((item,i)=>i===index?{...item,count:Math.max(0,Math.min(300,Math.trunc(count)))}:item))}} />
        <input className={field} type="number" min="0" max="100000" step="0.01" value={row.price} aria-label={`Закупочная цена за штуку, строка ${index+1}`} onChange={e=>{const price=Number(e.target.value);if(!Number.isFinite(price))return;setBouquet(null);setBouquetRows(items=>items.map((item,i)=>i===index?{...item,price:Math.max(0,Math.min(100000,price))}:item))}} />
        <button type="button" className={`${btn} !px-2`} aria-label={`Удалить позицию ${index+1}`} disabled={bouquetRows.length<=1} onClick={()=>{setBouquet(null);setBouquetRows(items=>items.filter((_,i)=>i!==index))}}>×</button>
      </div>)}</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-slate-400">Упаковка и расходники<input className={`${field} mt-1`} type="number" min="0" max="100000" step="0.01" value={bouquetWrap} onChange={e=>{setBouquetWrap(Math.max(0,Math.min(100000,Number(e.target.value)||0)));setBouquet(null)}}/></label>
        <label className="text-xs text-slate-400">Работа / сборка<input className={`${field} mt-1`} type="number" min="0" max="100000" step="0.01" value={bouquetLabor} onChange={e=>{setBouquetLabor(Math.max(0,Math.min(100000,Number(e.target.value)||0)));setBouquet(null)}}/></label>
        <label className="text-xs text-slate-400">Наценка, %<input className={`${field} mt-1`} type="number" min="0" max="300" step="0.5" value={bouquetMarkup} onChange={e=>{setBouquetMarkup(Math.max(0,Math.min(300,Number(e.target.value)||0)));setBouquet(null)}}/></label>
        <label className="text-xs text-slate-400">Валюта введённых цен<select className={`${field} mt-1`} value={bouquetCurrency} onChange={e=>{setBouquetCurrency(e.target.value as typeof bouquetCurrency);setBouquet(null)}}>{[['RUB','Российский рубль'],['EUR','Евро'],['USD','Доллар США'],['GBP','Фунт стерлингов'],['KZT','Казахстанский тенге']].map(([code,name])=><option key={code} value={code}>{name} ({code})</option>)}</select></label>
      </div>
      <p className="mt-3 text-xs text-slate-500">Стартовые цены равны нулю: внесите свои фактические закупочные значения. Пересчёта валют по курсу нет — все суммы считаются в выбранной валюте.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={btn} disabled={bouquetRows.length>=30} onClick={()=>{setBouquet(null);setBouquetRows(items=>items.length<30?[...items,{name:'',count:1,price:0}]:items)}}>＋ Добавить позицию ({bouquetRows.length}/30)</button>
        <button type="button" className={`${btn} border-emerald-400/30 bg-emerald-500/10`} onClick={runBouquet}><Flower2 className="h-4 w-4"/>Рассчитать смету</button>
        <button type="button" className={btn} onClick={()=>{setBouquetRows([{name:'Роза',count:1,price:0}]);setBouquetWrap(0);setBouquetLabor(0);setBouquetMarkup(0);setBouquetCurrency('RUB');setBouquet(null)}}>Сбросить форму</button>
      </div>
    </section>
    {bouquet&&<section className={card}>
      <h3 className="font-bold text-white">Результат · {bouquet.currency}</h3>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="pb-2">Позиция</th><th className="pb-2 text-right">Кол-во</th><th className="pb-2 text-right">За штуку</th><th className="pb-2 text-right">Сумма</th></tr></thead><tbody>{bouquet.items.map((item:any,index:number)=><tr key={`${item.name}-${index}`} className="border-t border-white/5"><td className="py-2 text-slate-200">{item.name}</td><td className="py-2 text-right text-slate-400">{item.count}</td><td className="py-2 text-right text-slate-400">{new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(item.unit_price)}</td><td className="py-2 text-right text-white">{new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(item.line_total)}</td></tr>)}</tbody></table></div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">{[['Цветы',bouquet.flowers],['Упаковка',bouquet.wrapping],['Работа',bouquet.labor],['Прямые расходы',bouquet.subtotal],['Сумма наценки',bouquet.markup_amount],['Цена с наценкой',bouquet.suggested_price]].map(([label,amount])=><div className="rounded-xl bg-slate-950 p-3" key={label}><span className="text-xs text-slate-500">{label}</span><b className="mt-1 block text-base text-white">{new Intl.NumberFormat('ru-RU',{style:'currency',currency:bouquet.currency,maximumFractionDigits:2}).format(Number(amount))}</b></div>)}</div>
      <p className="mt-3 text-xs leading-relaxed text-slate-400">{bouquet.note}</p>
    </section>}
  </div>;

  if (selected('unit_alphabet_catalog')) return <UnitConverter units={catalog.units||[]} onToast={onToast}/>;

  if (selected('world_socket_guide')||selected('connector_port_encyclopedia')) {
    const rows = selected('world_socket_guide')?catalog.sockets||[]:catalog.ports||[];
    return <div className="space-y-4">{header('СПРАВОЧНИК · ТЕХНИЧЕСКИЕ СТАНДАРТЫ',selected('world_socket_guide')?'Типы розеток мира':'Разъёмы и порты','Справочная подборка. Проверяйте маркировку конкретного устройства, стандарт страны и паспорт оборудования перед подключением.')}
      <div className="grid gap-3 sm:grid-cols-2">{rows.map((x:any,i:number)=><article className={card} key={x.type||x.name}><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-500/10 text-lg">{selected('world_socket_guide')?'🔌':'🔗'}</span><h3 className="font-bold text-white">{x.type||x.name} {x.symbol&&<span className="font-mono text-cyan-200">{x.symbol}</span>}</h3></div><p className="mt-2 text-sm text-slate-400">{x.regions||x.shape||x.note}</p><p className="mt-2 text-xs leading-relaxed text-slate-500">{x.earth||x.warning||x.note}</p></article>)}</div>
      {selected('world_socket_guide')&&safe('Неправильное напряжение может повредить устройство или вызвать пожар. Переходник меняет только форму контакта, если в нём нет отдельного преобразователя.')}</div>;
  }

  if (selected('welding_safety_guide')||selected('welding_process_selector')) return <div className="space-y-4">{header('ПРАКТИЧЕСКИЙ СПРАВОЧНИК · СВАРКА','Сварка: процессы и безопасность','Краткий вводный справочник. Параметры шва выбирают по утверждённой WPS, материалу, толщине, положению и квалификации; это не руководство к опасной работе без обучения.')}
    <div className="grid gap-3 sm:grid-cols-2">{(catalog.welding||[]).map((x:any)=><article key={x.topic} className={card}><h3 className="font-bold text-cyan-100">{x.topic}</h3><p className="mt-2 text-sm leading-relaxed text-slate-400">{x.details}</p></article>)}</div>{safe('Сварочная дуга, пары, пожар и электричество создают риск тяжёлых травм. Нужны обучение, СИЗ, вытяжка, допуск и надзор компетентного специалиста.')}</div>;

  if (selected('appliance_anatomy')) return <div className="space-y-4">{header('БЫТОВАЯ ТЕХНИКА · ПРИНЦИП РАБОТЫ','Как устроены бытовые приборы','Понятные схемы принципов действия и основные меры безопасного использования. Внутренний ремонт — только после обесточивания и для квалифицированных специалистов.')}
    <div className="grid gap-3 sm:grid-cols-2">{APPLIANCES.map(([name,details,safety])=><article className={card} key={name}><h3 className="font-bold text-white">{name}</h3><p className="mt-2 text-sm text-slate-300">{details}</p><p className="mt-3 border-t border-white/5 pt-3 text-xs text-amber-200/80">{safety}</p></article>)}</div></div>;

  if (selected('utility_bill_guide')) return <div className="space-y-4">{header('ДОМ · ПЛАТЕЖИ','Как проверить и оплатить коммунальные услуги','Алгоритм для многоквартирного дома и частного жилья. Состав начислений, сроки, льготы и способы передачи показаний зависят от региона и договора.')}
    <div className="grid gap-3 sm:grid-cols-2">{[['Квартира · подготовка','Сверьте адрес, лицевой счёт, период и предыдущий баланс в квитанции. Проверьте площади и число проживающих, если они влияют на начисление.'],['Квартира · счётчики','Снимите показания воды, электричества и газа в срок, указанный исполнителем; передайте их через официальный кабинет/ГИС ЖКХ/поставщика. Не передавайте коды из SMS.'],['Частный дом','Проверьте отдельные договоры на электричество, газ, воду/скважину, вывоз отходов, отопление и водоотведение. Сверьте тариф, показания и период каждого поставщика.'],['Оплата и спор','Оплачивайте по реквизитам из официальной квитанции или приложения поставщика. Сохраните чек. При несогласии запросите детализацию и акт сверки у исполнителя.'],['Безопасность','Не переходите по платёжным ссылкам из случайных сообщений. Сверьте получателя, ИНН/реквизиты и сумму до подтверждения.'],['Льготы','Субсидии и компенсации зависят от страны, региона, дохода и состава семьи. Проверяйте условия на официальном портале соцзащиты/МФЦ.']].map(([title,text])=><article className={card} key={title}><h3 className="font-bold text-cyan-100">{title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-400">{text}</p></article>)}</div></div>;

  if (selected('sleep_hygiene')) return <div className="space-y-4">{header('ЗДОРОВЬЕ · СОН','Гигиена сна','Общие рекомендации и причины обратиться к специалисту. Они не заменяют диагностику апноэ, бессонницы или других нарушений.')}
    <div className={card}>{SLEEP_TIPS.map((x,i)=><div className="flex gap-3 border-b border-white/5 py-3 last:border-0" key={x}><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-500/15 text-xs text-indigo-200">{i+1}</span><p className="text-sm text-slate-300">{x}</p></div>)}</div>{safe('Если человек внезапно засыпает за рулём или в опасных ситуациях, не водите автомобиль и обратитесь за медицинской помощью.')}</div>;

  if (selected('habit_change_guide')) return <div className="space-y-4">{header('ЗДОРОВЬЕ · ПОВЕДЕНИЕ','Изменение привычек и никотин','Нейтральные практические идеи без стыда. Зависимость, тревога и компульсивное поведение поддаются поддержке; при необходимости обратитесь к специалисту.')}
    <div className="grid gap-3 sm:grid-cols-2">{HABITS.map(([title,text,help])=><article className={card} key={title}><h3 className="font-bold text-white">{title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-300">{text}</p><p className="mt-3 border-t border-white/5 pt-3 text-xs leading-relaxed text-cyan-100/70">{help}</p></article>)}</div>{safe('При тяжёлой депрессии, риске самоповреждения или острой интоксикации обращайтесь в местную экстренную службу.')}</div>;

  if (selected('pregnancy_test_guide')||selected('medicine_safety_guide')) return <div className="space-y-4">{header('МЕДИЦИНСКАЯ ИНФОРМАЦИЯ · НЕ ДИАГНОЗ',selected('pregnancy_test_guide')?'Домашний тест на беременность':'Лекарства и получение медицинской помощи','Только общая информация. Индивидуальное назначение, противопоказания и рецептурный статус проверяйте у лицензированного врача или фармацевта.')}
    <div className="grid gap-3 sm:grid-cols-2">{(selected('pregnancy_test_guide')?[["Когда тестировать","Следуйте инструкции конкретного теста. Многие тесты наиболее надёжны с первого дня задержки; при раннем отрицательном результате повторите через несколько дней."],["Как использовать","Проверьте срок годности, время считывания и способ сбора образца по инструкции. Не интерпретируйте результат после указанного окна."],["Результат","Положительный домашний тест обычно требует планового подтверждения и обсуждения дальнейших действий с медицинским специалистом."],["Срочно","Сильная односторонняя боль, обморок, выраженное кровотечение или слабость требуют срочной медицинской оценки независимо от теста."]]:[["Рецептурный статус","Проверяйте актуальную классификацию препарата в официальном реестре своей страны. Одинаковое действующее вещество может иметь разные формы и правила отпуска."],["Назначение","Не используйте чужие рецептурные препараты и не начинайте/не прекращайте лечение без консультации. Уточните действующее вещество, дозу и взаимодействия."],["Где получить","Лицензированная аптека или медицинская организация. Покупка из непроверенных сайтов повышает риск подделки; не помогаем обходить рецепт."],["Перед приёмом","Читайте официальную инструкцию, учитывайте аллергию, беременность, болезни и другие лекарства. При тяжёлой реакции — экстренная помощь."]]).map(([title,text])=><article className={card} key={title}><h3 className="font-bold text-amber-100">{title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-300">{text}</p></article>)}</div>{safe('Информация не диагностирует беременность и не назначает лекарства. При срочных симптомах обратитесь в неотложную службу.')}</div>;

  if (selected('anatomy_reference')||selected('bone_skeleton_guide')||selected('hormone_encyclopedia')||selected('vitamin_reference')) {
    const kind=selected('hormone_encyclopedia')?'hormones':selected('vitamin_reference')?'nutrients':selected('bone_skeleton_guide')?'bones':'anatomy';
    const rows=kind==='hormones'?catalog.hormones||[]:kind==='bones'?catalog.bones||[]:kind==='anatomy'?catalog.anatomy||[]:[...(catalog.vitamins||[]).map((x:any)=>({...x,category:'Витамин'})),...(catalog.minerals||[]).map((x:any)=>({...x,category:'Минерал'}))];
    const title=kind==='hormones'?'Гормоны и железы':kind==='nutrients'?'Витамины и минералы':kind==='bones'?'Скелет: кости и отделы':'Анатомические системы человека';
    return <div className="space-y-4">{header('БИОЛОГИЯ · СПРАВОЧНИК',title,'Учебные карточки с поиском и раскрываемыми пояснениями. Биологические вариации велики; справочник не предназначен для самодиагностики.')}
      <AnatomyReference rows={rows} kind={kind}/>{kind==='hormones'&&safe('Симптомы нельзя достоверно интерпретировать по списку гормонов. Референсные интервалы и время взятия анализа зависят от лаборатории, возраста, пола и клинической ситуации.')}{kind==='nutrients'&&safe('Добавки в больших дозах могут быть вредны и взаимодействовать с лекарствами. Не заменяйте ими лечение и не принимайте высокие дозы без специалиста.')}</div>;
  }

  if (selected('world_calendar_clock')) return <WorldCalendarClock />;

  if (selected('solar_moons_catalog')) return <div className="space-y-4">{header('АСТРОНОМИЯ · СОЛНЕЧНАЯ СИСТЕМА','Крупные спутники и Церера','Подборка хорошо изученных спутников. Точные количества открытых и подтверждённых малых спутников меняются; список не является каталогом каждого известного объекта.')}
    <div className="grid gap-3 sm:grid-cols-2">{(catalog.moons||[]).map((x:any)=><article className={card} key={x.planet}><h3 className="font-bold text-cyan-100">{x.planet}</h3><p className="mt-2 text-sm text-slate-300">{x.moons}</p><p className="mt-2 text-xs text-slate-500">{x.count}</p></article>)}</div></div>;

  if (selected('religion_symbols_atlas')) return <div className="space-y-4">{header('КУЛЬТУРА · СИМВОЛЫ','Символы религиозных традиций','Эта выборка не исчерпывающая. Значение зависит от сообщества, периода и контекста; один знак может встречаться в нескольких традициях.')}
    <div className="grid gap-3 sm:grid-cols-2">{(catalog.religion_symbols||[]).map((x:any,i:number)=><article className={card} key={`${x.symbol}${i}`}><div className="flex items-center gap-3"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/15 to-cyan-500/10 text-3xl text-white">{x.symbol}</span><div><h3 className="font-bold text-white">{x.name}</h3><span className="text-xs text-violet-200">{x.traditions}</span></div></div><p className="mt-3 text-sm text-slate-400">{x.context}</p></article>)}</div></div>;

  if (selected('light_refraction_lab')) return <div className="space-y-4">{header('ОПТИКА · ЗАКОН СНЕЛЛИУСА','Преломление света','Угол измеряется от нормали к границе. Для n₁ sin θ₁ = n₂ sin θ₂. Полное внутреннее отражение возможно при переходе из оптически более плотной среды.')}
    <div className={`${card} grid gap-3 sm:grid-cols-3`}><label className="text-xs text-slate-400">Показатель n₁<input className={`${field} mt-1`} type="number" min="1" max="3" step=".01" value={snell.n1} onChange={e=>setSnell({...snell,n1:Number(e.target.value)})}/></label><label className="text-xs text-slate-400">Показатель n₂<input className={`${field} mt-1`} type="number" min="1" max="3" step=".01" value={snell.n2} onChange={e=>setSnell({...snell,n2:Number(e.target.value)})}/></label><label className="text-xs text-slate-400">Падение θ₁: {snell.angle}°<input className="mt-3 w-full accent-cyan-400" type="range" min="0" max="89" value={snell.angle} onChange={e=>setSnell({...snell,angle:+e.target.value})}/></label><div className="sm:col-span-3 rounded-xl bg-slate-950 p-4 text-center"><span className="text-sm text-slate-400">{refracted===null?'Полное внутреннее отражение':'Угол преломления'}</span><div className="mt-1 text-3xl font-black text-cyan-200">{refracted===null?'TIR':`${refracted.toFixed(2)}°`}</div><svg viewBox="0 0 300 140" className="mx-auto mt-3 h-36 w-full max-w-md"><path d="M20 70H280" stroke="#64748b" strokeWidth="2"/><path d="M150 12V128" stroke="#fbbf24" strokeDasharray="5 4"/><path d={`M${150-120*Math.sin(snell.angle*Math.PI/180)} ${70-120*Math.cos(snell.angle*Math.PI/180)} L150 70`} stroke="#22d3ee" strokeWidth="3"/>{refracted!==null&&<path d={`M150 70 L${150+110*Math.sin(refracted*Math.PI/180)} ${70+110*Math.cos(refracted*Math.PI/180)}`} stroke="#c084fc" strokeWidth="3"/>}</svg></div></div></div>;

  if (selected('film_episode_ratings')) return <EpisodeRatings />;
  if (selected('mahjong_solitaire')) return <MahjongSolitaire />;
  if (selected('anime_comic_tournament')) return <Tournament16 />;
  if (selected('matter_phase_lab')) return <MatterPhaseLab />;
  if (selected('optics_eyewear_tools')) return <OpticsCalculator />;
  if (selected('cooking_recipe_guide')) return <CookingGuide recipes={catalog.recipes || []} onToast={onToast} />;
  if (selected('citizenship_guide')) return <CitizenshipGuide />;
  if (selected('lifetime_human_statistics')) return <LifetimeStatistics />;
  if (selected('appearance_wellbeing_guide')) return <AppearanceGuide />;
  if (selected('semen_health_guide')) return <SemenHealthGuide />;
  if (selected('body_hair_growth')) return <div className="space-y-4">{header('СПРАВОЧНИК · ВОЛОСЫ','Скорость роста волос','Волосы головы обычно удлиняются примерно на 1 см в месяц, но скорость и цикл варьируют. Это усреднённый ориентир, не индивидуальный прогноз.')}
    <div className={`${card} grid grid-cols-2 gap-3 sm:grid-cols-4`}>{[['1 месяц','около 1 см'],['6 месяцев','около 6 см'],['1 год','около 12 см'],['Фаза роста','анаген длится годы']].map(([a,b])=><div className="rounded-xl bg-slate-950 p-4" key={a}><span className="text-xs text-slate-500">{a}</span><b className="mt-2 block text-lg text-white">{b}</b></div>)}</div>{safe('Внезапное выпадение, очаги, зуд/воспаление кожи головы или быстрое изменение волос обсудите с врачом. Биотин без установленного дефицита не гарантирует рост и может искажать лабораторные анализы.')}</div>;

  return <div className="space-y-4">{header('MULTI_TG_TOOL · СПРАВОЧНЫЙ РАЗДЕЛ','Инструмент готовится','Выберите инструмент из списка раздела. Справочная информация не заменяет профессиональную консультацию.')}
    <div className={`${card} grid gap-3 sm:grid-cols-3`}><div className="rounded-xl bg-slate-950 p-4"><Sparkles className="h-5 w-5 text-cyan-200"/><b className="mt-3 block text-white">Информация по делу</b><p className="mt-1 text-xs text-slate-500">Проверяйте границы данных и источники.</p></div><div className="rounded-xl bg-slate-950 p-4"><ShieldCheck className="h-5 w-5 text-emerald-200"/><b className="mt-3 block text-white">Без ложных обещаний</b><p className="mt-1 text-xs text-slate-500">Прогнозы обозначены как ориентировочные.</p></div><div className="rounded-xl bg-slate-950 p-4"><CircleHelp className="h-5 w-5 text-violet-200"/><b className="mt-3 block text-white">Доступность</b><p className="mt-1 text-xs text-slate-500">Аудио и уведомления зависят от настроек браузера.</p></div></div></div>;
};

function MatterPhaseLab() {
  type Material={name:string;melting:number;boiling:number;minimum:number;maximum:number;detail:string;special?:string};
  const materials:Record<string,Material>={
    water:{name:'Вода (1 атм)',melting:0,boiling:100,minimum:-100,maximum:1000,detail:'При обычном давлении лёд плавится около 0 °C, а вода кипит около 100 °C. Растворённые вещества и давление меняют точки перехода.'},
    nitrogen:{name:'Азот (1 атм)',melting:-210,boiling:-195.8,minimum:-260,maximum:500,detail:'Криогенная жидкость существует лишь в узком интервале около 14 °C между плавлением и кипением при 1 атм.'},
    oxygen:{name:'Кислород (1 атм)',melting:-218.79,boiling:-182.96,minimum:-260,maximum:500,detail:'Жидкий кислород — криогенная жидкость; обращаться с ним можно только в оснащённой профессиональной среде.'},
    ethanol:{name:'Этанол (1 атм)',melting:-114.1,boiling:78.37,minimum:-180,maximum:700,detail:'Точки перехода приведены для чистого этанола около 1 атм. Смеси воды и этанола имеют иное поведение.'},
    mercury:{name:'Ртуть (1 атм)',melting:-38.83,boiling:356.73,minimum:-100,maximum:1000,detail:'Ртуть токсична при контакте и вдыхании паров. Значения здесь — справочные; не нагревать и не использовать в опытах.'},
    iron:{name:'Железо (1 атм, ориентир)',melting:1538,boiling:2862,minimum:0,maximum:4000,detail:'Для металлов реальные свойства зависят от чистоты, сплава и атмосферы. Не использовать диаграмму для проектирования плавильных работ.'},
    copper:{name:'Медь (1 атм)',melting:1084.6,boiling:2562,minimum:0,maximum:4000,detail:'Ориентировочные температуры чистой меди при нормальном давлении; сплавы ведут себя иначе.'},
    carbon_dioxide:{name:'Углекислый газ (1 атм)',melting:0,boiling:0,minimum:-200,maximum:100,detail:'При 1 атм CO₂ не имеет устойчивой жидкой фазы: сухой лёд сублимирует примерно при −78.5 °C.',special:'sublimation'},
  };
  const [material,setMaterial]=useState('water');
  const [temp,setTemp]=useState(24);
  const selectedMaterial=materials[material];
  const state=selectedMaterial.special==='sublimation'
    ? (temp < -78.5 ? 'solid' : 'gas')
    : temp < selectedMaterial.melting ? 'solid' : temp < selectedMaterial.boiling ? 'liquid' : 'gas';
  const phaseText={solid:'Твёрдая фаза',liquid:'Жидкая фаза',gas:'Газовая фаза'}[state];
  const phaseTiles=[['solid','Твёрдое','🧊'],['liquid','Жидкое','💧'],['gas','Газ','💨'],['plasma','Плазма','⚡']] as const;
  const formatTemp=(value:number)=>`${new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value)} °C`;
  return <div className="space-y-4">
    <header><div className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-cyan-300">ФИЗИКА · ФАЗОВЫЕ СОСТОЯНИЯ</div><h2 className="text-xl font-black text-white">Как меняется состояние вещества</h2><p className="mt-2 text-sm text-slate-400">Интерактивная справочная модель для выбранных чистых веществ около 1 атм. Она показывает твёрдую, жидкую и газовую фазы по приближённым точкам перехода; не моделирует давление, примеси, кинетику или долю ионизации.</p></header>
    <section className={card}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-400">Вещество<select className={`${field} mt-1`} value={material} onChange={e=>{const next=e.target.value;setMaterial(next);setTemp(value=>Math.max(materials[next].minimum,Math.min(materials[next].maximum,value)))}}>{Object.entries(materials).map(([id,item])=><option value={id} key={id}>{item.name}</option>)}</select></label>
        <label className="text-xs text-slate-400">Температура<input className={`${field} mt-1`} type="number" min={selectedMaterial.minimum} max={selectedMaterial.maximum} step="any" value={temp} onChange={e=>{const value=Number(e.target.value);if(Number.isFinite(value))setTemp(Math.max(selectedMaterial.minimum,Math.min(selectedMaterial.maximum,value)))}}/><input aria-label="Температура в градусах Цельсия" className="mt-3 w-full accent-cyan-400" type="range" min={selectedMaterial.minimum} max={selectedMaterial.maximum} step={selectedMaterial.maximum-selectedMaterial.minimum>500?1:0.1} value={temp} onChange={e=>setTemp(Number(e.target.value))}/><span className="mt-1 block text-[11px] text-slate-500">{formatTemp(temp)}</span></label>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{phaseTiles.map(([key,label,icon])=><div key={key} className={`rounded-xl border p-3 text-center ${key===state?'border-cyan-300/40 bg-cyan-500/10':'border-white/5 bg-slate-950/60'} ${key==='plasma'?'opacity-60':''}`} aria-current={key===state?'true':undefined}><div className="text-xl">{icon}</div><div className="mt-1 text-[10px] text-slate-300">{label}</div>{key==='plasma'&&<div className="mt-1 text-[9px] text-slate-500">не вычисляется</div>}</div>)}</div>
      <div className="mt-4 rounded-xl bg-slate-950 p-4"><div className="text-xs text-slate-500">Состояние в модели</div><b className="mt-1 block text-lg text-cyan-100">{selectedMaterial.special==='sublimation'?'Твёрдая фаза — сублимация — газ':phaseText}</b><p className="mt-2 text-sm leading-relaxed text-slate-300">{selectedMaterial.detail}</p>{selectedMaterial.special==='sublimation'?<p className="mt-2 text-xs text-slate-400">При температуре ниже −78,5 °C модель показывает твёрдый CO₂, выше — газообразный; жидкую фазу при 1 атм не показывает.</p>:<div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400"><span>Плавление: {formatTemp(selectedMaterial.melting)}</span><span>Кипение: {formatTemp(selectedMaterial.boiling)}</span></div>}<p className="mt-3 border-t border-white/5 pt-3 text-xs leading-relaxed text-amber-100/70">Плазма — ионизованный газ, а не просто четвёртый температурный интервал с универсальной границей. Одной температуры недостаточно, чтобы определить степень ионизации; эта модель её не предсказывает. Не проводить опасные опыты с криогенными веществами, ртутью или расплавами.</p></div>
    </section>
  </div>;
}

function OpticsCalculator() {
  const [mode,setMode]=useState<'lens'|'telescope'>('lens');
  const [power,setPower]=useState(2);
  const [objectDistance,setObjectDistance]=useState(50);
  const [objectiveFocal,setObjectiveFocal]=useState(500);
  const [eyepieceFocal,setEyepieceFocal]=useState(10);
  const [aperture,setAperture]=useState(80);
  const [apparentField,setApparentField]=useState(50);
  const focalCm=power===0?null:100/power;
  const denominator=focalCm===null?null:objectDistance-focalCm;
  const atFocus=denominator!==null&&Math.abs(denominator)<1e-9;
  const imageDistance=atFocus?null:focalCm===null?-objectDistance:(focalCm*objectDistance)/(denominator as number);
  const magnification=imageDistance===null?null:-imageDistance/objectDistance;
  const telescopeMagnification=objectiveFocal/eyepieceFocal;
  const exitPupil=aperture/telescopeMagnification;
  const trueField=apparentField/telescopeMagnification;
  const resolutionArcsec=116/aperture;
  const bounded=(value:string,min:number,max:number,current:number)=>{
    if(value.trim()==='')return current;
    const number=Number(value);
    return Number.isFinite(number)?Math.max(min,Math.min(max,number)):current;
  };
  const numberField=(label:string,value:number,min:number,max:number,step:number,onChange:(n:number)=>void,unit:string)=><label className="block text-xs text-slate-400">{label}<div className="mt-1 flex items-center gap-2"><input className={field} type="number" min={min} max={max} step={step} value={value} onChange={e=>onChange(bounded(e.target.value,min,max,value))}/><span className="shrink-0 text-slate-500">{unit}</span></div></label>;
  const format=(value:number,digits=2)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:digits}).format(value);
  return <div className="space-y-4">
    <header><div className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-cyan-300">ОПТИКА · ИНТЕРАКТИВНЫЕ МОДЕЛИ</div><h2 className="text-xl font-black text-white">Тонкая линза и телескоп</h2><p className="mt-2 text-sm text-slate-400">Два раздельных расчёта из введённых параметров: знак оптической силы важен для линзы, а увеличение телескопа задаётся фокусными расстояниями. Это учебная оптика, не подбор очков и не гарантия качества изображения.</p></header>
    <div className="flex flex-wrap gap-2"><button type="button" className={`${btn} ${mode==='lens'?'border-cyan-300/40 bg-cyan-500/10 text-cyan-100':''}`} onClick={()=>setMode('lens')}>Тонкая линза</button><button type="button" className={`${btn} ${mode==='telescope'?'border-cyan-300/40 bg-cyan-500/10 text-cyan-100':''}`} onClick={()=>setMode('telescope')}>Телескоп</button></div>
    {mode==='lens'?<section className={card}>
      <h3 className="font-bold text-white">Формула тонкой линзы</h3><p className="mt-1 text-xs text-slate-500">1/f = 1/u + 1/v; диоптрия D = 1/f(м). u — положительное расстояние до реального объекта, v сохраняет знак для реального или мнимого изображения.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{numberField('Оптическая сила',power,-20,20,0.25,setPower,'дптр')}{numberField('Расстояние до объекта',objectDistance,1,10000,1,setObjectDistance,'см')}</div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-slate-950 p-3"><span className="text-[10px] text-slate-500">Фокусное расстояние f</span><b className="mt-1 block text-lg text-white">{focalCm===null?'∞ (0 дптр)':`${format(focalCm)} см`}</b></div>
        <div className="rounded-xl bg-slate-950 p-3"><span className="text-[10px] text-slate-500">Положение изображения v</span><b className="mt-1 block text-lg text-white">{atFocus?'на бесконечности':`${format(imageDistance as number)} см`}</b></div>
        <div className="rounded-xl bg-slate-950 p-3"><span className="text-[10px] text-slate-500">Тип изображения</span><b className="mt-1 block text-lg text-white">{atFocus?'уходит в бесконечность':(imageDistance as number)>0?'действительное':'мнимое'}</b></div>
        <div className="rounded-xl bg-slate-950 p-3"><span className="text-[10px] text-slate-500">Поперечное увеличение</span><b className="mt-1 block text-lg text-white">{magnification===null?'—':`${format(Math.abs(magnification),3)}× · ${magnification<0?'перевёрнутое':'прямое'}`}</b></div>
      </div>
      {focalCm!==null&&<p className="mt-3 text-xs text-slate-400">Знак f: {focalCm>0?'положительный — собирающая линза': 'отрицательный — рассеивающая линза'}. Знак v: {atFocus?'предельный случай':(imageDistance as number)>0?'положительный — действительное изображение':'отрицательный — мнимое изображение'}.</p>}
    </section>:<section className={card}>
      <h3 className="font-bold text-white">Угловое увеличение телескопа</h3><p className="mt-1 text-xs text-slate-500">Приближение для системы Кеплера: увеличение ≈ f объектива / f окуляра. Реальная резкость, поле и контраст зависят от оптики, коллимации и атмосферы.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{numberField('Фокус объектива',objectiveFocal,50,5000,10,setObjectiveFocal,'мм')}{numberField('Фокус окуляра',eyepieceFocal,2,100,0.5,setEyepieceFocal,'мм')}{numberField('Диаметр апертуры',aperture,20,1000,5,setAperture,'мм')}{numberField('Видимое поле окуляра',apparentField,30,110,1,setApparentField,'°')}</div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{[['Угловое увеличение',`${format(telescopeMagnification,1)}×`],['Выходной зрачок',`${format(exitPupil,2)} мм`],['Истинное поле (грубая оценка)',`${format(trueField,2)}°`],['Предел Доуза (идеальные условия)',`${format(resolutionArcsec,2)}″`]].map(([label,value])=><div key={label} className="rounded-xl bg-slate-950 p-3"><span className="text-[10px] text-slate-500">{label}</span><b className="mt-1 block text-lg text-white">{value}</b></div>)}</div>
      <p className="mt-3 text-xs leading-relaxed text-slate-400">Поле рассчитано приближённо как видимое поле / увеличение; для широкоугольной оптики это упрощение. Предел Доуза — теоретический ориентир для разрешения двух близких точечных объектов, не обещание наблюдаемой детализации. Слишком высокое увеличение не добавляет объективу разрешения.</p>
    </section>}
    <p className="rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-3 text-xs leading-relaxed text-amber-100/70">Не используйте этот калькулятор для назначения очков, контактных линз или медицинской оценки зрения. Рецепт на коррекцию подбирает специалист после обследования.</p>
  </div>;
}

function AnatomyReference({rows,kind}:{rows:any[];kind:string}) {
  const [query,setQuery]=useState(''); const [region,setRegion]=useState('');
  const regions=Array.from(new Set(rows.map((x:any)=>x.region||x.category).filter(Boolean)));
  const visible=rows.filter((x:any)=>{const label=x.region||x.category||'';const text=Object.values(x).join(' ').toLocaleLowerCase('ru');return (!region||label===region)&&(!query||text.includes(query.toLocaleLowerCase('ru')))});
  return <section className={card}><div className="grid gap-2 sm:grid-cols-[1fr_220px]"><input className={field} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по названию, функции или составу…"/><select className={field} value={region} onChange={e=>setRegion(e.target.value)}><option value="">Все отделы</option>{regions.map((x:any)=><option key={x}>{x}</option>)}</select></div><p className="mt-3 text-xs text-slate-500">Показано {visible.length} из {rows.length}</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{visible.map((x:any,i:number)=>{const name=x.name||x.region||x.system;const detail=x.what||x.function||x.organs||x.bones||'';const secondary=x.where||x.sources||x.role||'';return <details className="group rounded-xl border border-white/5 bg-slate-950/70 p-3" key={`${name}-${i}`}><summary className="cursor-pointer list-none"><span className="flex items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-rose-500/10">{kind==='hormones'?'🧬':kind==='nutrients'?'🥗':kind==='bones'?'🦴':'🫀'}</span><span className="min-w-0"><b className="block text-sm text-white">{name}</b>{(x.category||x.region)&&<small className="text-[10px] text-cyan-200">{x.category||x.region}</small>}</span><ChevronRight className="ml-auto h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-90"/></span></summary><p className="mt-3 text-sm leading-relaxed text-slate-300">{detail}</p>{secondary&&<p className="mt-2 text-xs leading-relaxed text-slate-400">{secondary}</p>}{x.note&&<p className="mt-2 border-t border-white/5 pt-2 text-xs leading-relaxed text-amber-200/70">{x.note}</p>}</details>})}</div></section>;
}

function UnitConverter({units,onToast}:{units:any[];onToast:(s:string)=>void}) {
  const [query,setQuery]=useState(''); const [group,setGroup]=useState(''); const [from,setFrom]=useState('km'); const [to,setTo]=useState('mi'); const [value,setValue]=useState('1'); const [result,setResult]=useState<any>(null);
  const groups=Array.from(new Set(units.map((u:any)=>u.group))).sort((a:any,b:any)=>a.localeCompare(b,'ru'));
  const visible=units.filter((u:any)=>(!group||u.group===group)&&(!query||`${u.name} ${u.symbol} ${u.group}`.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')))).sort((a:any,b:any)=>a.name.localeCompare(b.name,'ru'));
  const compatible=units.filter((u:any)=>u.group===units.find((x:any)=>x.id===from)?.group);
  useEffect(()=>{if(units.length&&!units.some((u:any)=>u.id===from)){setFrom(units[0].id);setTo(units[0].id)}},[units,from]);
  const convert=async()=>{const numeric=value.trim()===''?NaN:Number(value);if(!Number.isFinite(numeric)){setResult(null);onToast('Введите конечное числовое значение');return}try{setResult(await apiPost('/api/life/convert',{value:numeric,from_unit:from,to_unit:to}))}catch(e:any){setResult(null);onToast(e.message)}};
  return <div className="space-y-4"><header><div className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-cyan-300">СПРАВОЧНИК · ЕДИНИЦЫ</div><h2 className="text-xl font-black text-white">Единицы измерения и конвертер</h2><p className="mt-2 text-sm text-slate-400">Каталог сгруппирован по физической величине. SI и двоичные единицы данных не смешиваются.</p></header>
    <section className={card}><h3 className="mb-3 font-bold text-white">Перевести значение</h3><div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]"><label className="text-xs text-slate-400">Значение<input className={`${field} mt-1`} type="number" step="any" value={value} onChange={e=>{setValue(e.target.value);setResult(null)}}/></label><label className="text-xs text-slate-400">Из<select className={`${field} mt-1`} value={from} onChange={e=>{setFrom(e.target.value);setResult(null);const u=units.find((x:any)=>x.id===e.target.value);if(u&&!units.some((x:any)=>x.id===to&&x.group===u.group))setTo(e.target.value)}}>{units.map((u:any)=><option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>)}</select></label><label className="text-xs text-slate-400">В<select className={`${field} mt-1`} value={to} onChange={e=>{setTo(e.target.value);setResult(null)}}>{compatible.map((u:any)=><option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>)}</select></label><button className={`${btn} self-end`} onClick={convert}>Перевести</button></div>{result&&<div className="mt-4 rounded-xl bg-slate-950 p-4"><div className="text-xs text-slate-500">{result.value} {result.from.symbol} =</div><div className="mt-1 break-all text-2xl font-black text-cyan-200">{Number(result.result).toPrecision(9)} {result.to.symbol}</div><button className={`${btn} mt-3`} onClick={()=>{setFrom(to);setTo(from);setResult(null)}}>Поменять местами</button></div>}<p className="mt-3 text-[11px] text-slate-500">Температурные шкалы включают абсолютный ноль. Конверсия доступна только внутри одной физической величины.</p></section>
    <section className={card}><div className="grid gap-2 sm:grid-cols-[1fr_220px]"><input className={field} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск: миля, давление, MiB…"/><select className={field} value={group} onChange={e=>setGroup(e.target.value)}><option value="">Все группы</option>{groups.map((g:any)=><option key={g}>{g}</option>)}</select></div><p className="mt-3 text-xs text-slate-500">Найдено: {visible.length} из {units.length} единиц</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{visible.map((u:any)=><article key={u.id} className="rounded-xl border border-white/5 bg-slate-950/70 p-3"><div className="flex items-baseline justify-between gap-2"><b className="text-sm text-white">{u.name}</b><code className="text-xs text-cyan-200">{u.symbol}</code></div><div className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{u.group}</div><button className="mt-2 text-[11px] text-cyan-300 hover:text-cyan-100" onClick={()=>{setFrom(u.id);const match=units.find((x:any)=>x.group===u.group&&x.id!==u.id);if(match)setTo(match.id);setResult(null)}}>Использовать в конвертере</button></article>)}</div></section></div>;
}

function CookingGuide({recipes,onToast}:{recipes:any[];onToast:(s:string)=>void}) {
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('');
  const [servings,setServings]=useState<Record<string,number>>({});
  const [expanded,setExpanded]=useState<string>('');
  const [scaled,setScaled]=useState<Record<string,any>>({});
  const [mealPlan,setMealPlan]=useState<Record<string,number>>({});
  const [planLoaded,setPlanLoaded]=useState(false);
  const [planCanPersist,setPlanCanPersist]=useState(false);
  const [planStorageError,setPlanStorageError]=useState(false);
  const detailRequestRef=React.useRef<Record<string,number>>({});
  const categories=Array.from(new Set(recipes.map((r:any)=>r.category))).sort((a:any,b:any)=>a.localeCompare(b,'ru'));

  useEffect(()=>{
    if(!recipes.length)return;
    try{
      const raw=localStorage.getItem('multi-recipe-meal-plan-v1');
      const parsed:unknown=raw?JSON.parse(raw):{};
      if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('Invalid meal plan');
      const restored:Record<string,number>={};
      for(const [id,amount] of Object.entries(parsed as Record<string,unknown>)){
        const recipe=recipes.find((item:any)=>item.id===id);
        if(recipe&&typeof amount==='number'&&Number.isFinite(amount)&&amount>=0.25&&amount<=20)restored[id]=amount;
      }
      setMealPlan(restored);setPlanCanPersist(true);
    }catch{setPlanStorageError(true)}
    finally{setPlanLoaded(true)}
  },[recipes]);

  useEffect(()=>{
    if(!planLoaded||!planCanPersist)return;
    try{localStorage.setItem('multi-recipe-meal-plan-v1',JSON.stringify(mealPlan));setPlanStorageError(false)}
    catch{setPlanStorageError(true)}
  },[mealPlan,planLoaded,planCanPersist]);

  const visible=recipes.filter((r:any)=>
    (!category||r.category===category)
    &&(!query||`${r.name} ${r.tags.join(' ')} ${r.category} ${r.ingredients.map((i:any)=>i.name).join(' ')}`.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')))
  );
  const shoppingList=useMemo(()=>{
    const aggregate=new Map<string,{name:string;grams:number;recipes:Set<string>}>();
    for(const recipe of recipes){
      const portions=mealPlan[recipe.id];
      if(!Number.isFinite(portions)||portions<0.25||portions>20)continue;
      const factor=portions/Number(recipe.servings||1);
      for(const ingredient of recipe.ingredients||[]){
        const name=String(ingredient.name||'').trim();
        const grams=Number(ingredient.grams)*factor;
        if(!name||!Number.isFinite(grams)||grams<=0)continue;
        const key=name.toLocaleLowerCase('ru');
        const row=aggregate.get(key)||{name,grams:0,recipes:new Set<string>()};
        row.grams+=grams;row.recipes.add(recipe.name);aggregate.set(key,row);
      }
    }
    return [...aggregate.values()].sort((a,b)=>a.name.localeCompare(b.name,'ru')).map(row=>({...row,grams:Math.round(row.grams*10)/10,usedIn:[...row.recipes]}));
  },[recipes,mealPlan]);
  const plannedRecipes=recipes.filter((recipe:any)=>mealPlan[recipe.id]!==undefined);
  const plannedPortions=plannedRecipes.reduce((sum:number,recipe:any)=>sum+mealPlan[recipe.id],0);

  const setRecipePortions=(recipe:any,amount:number)=>{
    if(!Number.isFinite(amount))return;
    const safe=Math.round(Math.max(0.25,Math.min(20,amount))*4)/4;
    setServings((current)=>({...current,[recipe.id]:safe}));
    if(mealPlan[recipe.id]!==undefined)setMealPlan((current)=>({...current,[recipe.id]:safe}));
  };
  const fetchDetail=async(recipe:any,amount:number)=>{
    const requestId=(detailRequestRef.current[recipe.id]||0)+1;
    detailRequestRef.current[recipe.id]=requestId;
    try{
      const detail=await apiGet(`/api/life/recipes/${recipe.id}?servings=${amount}`);
      if(detailRequestRef.current[recipe.id]===requestId)setScaled((current)=>({...current,[recipe.id]:detail}));
    }catch(e:any){if(detailRequestRef.current[recipe.id]===requestId)onToast(e.message)}
  };
  const toggleRecipe=(recipe:any)=>{
    if(expanded===recipe.id){setExpanded('');return}
    setExpanded(recipe.id);
    void fetchDetail(recipe,servings[recipe.id]??recipe.servings);
  };
  const toggleMealPlan=(recipe:any)=>{
    if(mealPlan[recipe.id]!==undefined){setMealPlan((current)=>{const next={...current};delete next[recipe.id];return next});return}
    const amount=servings[recipe.id]??recipe.servings;
    setServings((current)=>({...current,[recipe.id]:amount}));
    setMealPlan((current)=>({...current,[recipe.id]:amount}));
  };
  const changePlannedPortions=(recipe:any,raw:string)=>{
    const amount=Number(raw);
    if(!Number.isFinite(amount)||amount<0.25||amount>20)return;
    const safe=Math.round(amount*4)/4;
    setMealPlan((current)=>({...current,[recipe.id]:safe}));
    setServings((current)=>({...current,[recipe.id]:safe}));
  };
  const clearMealPlan=()=>{
    if(!plannedRecipes.length||!window.confirm('Очистить весь сохранённый план блюд на этом устройстве?'))return;
    setMealPlan({});
  };
  const exportShoppingList=()=>{
    if(!shoppingList.length)return;
    const cell=(value:string|number)=>{
      let text=String(value).replace(/[\r\n]+/g,' ');
      if(/^[\s]*[=+\-@]/.test(text))text=`'${text}`;
      return `"${text.replaceAll('"','""')}"`;
    };
    const rows=[['Продукт','Количество, г','В каких блюдах'],...shoppingList.map((row)=>[row.name,row.grams,row.usedIn.join(', ')])];
    const content=`\uFEFF${rows.map((row)=>row.map(cell).join(';')).join('\r\n')}`;
    const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='shopping-list.csv';document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),0);
  };

  return <div className="space-y-4">
    <header><div className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-orange-300">КУЛИНАРИЯ · РЕЦЕПТЫ</div><h2 className="text-xl font-black text-white">Рецепты, план блюд и список покупок</h2><p className="mt-2 text-sm text-slate-400">Ищите рецепты и масштабируйте порции. Добавьте несколько блюд в план: повторяющиеся ингредиенты объединятся по названию, а список покупок можно сохранить в CSV. Пищевая ценность ориентировочная; учитывайте маркировку аллергенов и безопасное приготовление.</p></header>

    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold text-white">План и список покупок</h3><p className="mt-1 text-xs text-slate-500">Сохраняется локально в этом браузере · ингредиенты объединяются по названию и указаны в граммах</p></div><div className="flex flex-wrap gap-2"><button type="button" className={btn} onClick={exportShoppingList} disabled={!shoppingList.length}>Экспорт списка CSV</button><button type="button" className={`${btn} border-rose-300/15 text-rose-200`} onClick={clearMealPlan} disabled={!plannedRecipes.length}>Очистить план</button></div></div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400"><span>Блюд: {plannedRecipes.length}</span><span>Плановых порций: {plannedPortions.toLocaleString('ru-RU',{maximumFractionDigits:2})}</span><span>Ингредиентов: {shoppingList.length}</span></div>
      {plannedRecipes.length===0?<p className="mt-3 rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-slate-500">План пуст. Нажмите «Добавить в план» у нужных рецептов.</p>:<div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-2">{plannedRecipes.map((recipe:any)=><div key={recipe.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-950 p-3"><span className="min-w-0 flex-1 text-sm font-medium text-white">{recipe.name}</span><label className="flex items-center gap-2 text-xs text-slate-400">Порций<input className={`${field} w-24`} type="number" min="0.25" max="20" step="0.25" value={mealPlan[recipe.id]} onChange={e=>changePlannedPortions(recipe,e.target.value)}/></label><button type="button" className="rounded-lg px-2 py-1 text-xs text-rose-200 hover:bg-rose-400/10" aria-label={`Убрать ${recipe.name} из плана`} onClick={()=>toggleMealPlan(recipe)}>Убрать</button></div>)}</div>
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl bg-slate-950 p-3">{shoppingList.map((row)=><div key={row.name} className="flex items-start justify-between gap-3 border-b border-white/5 py-2 last:border-0"><div className="min-w-0"><b className="text-sm text-slate-200">{row.name}</b><div className="mt-0.5 text-[10px] text-slate-500">{row.usedIn.join(' · ')}</div></div><span className="shrink-0 font-mono text-sm text-amber-200">{row.grams} г</span></div>)}</div>
      </div>}
      {planStorageError&&<p role="status" className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/[.06] p-3 text-xs text-amber-100">Не удалось открыть или сохранить план в браузере. Не перезаписываю повреждённые данные автоматически; список можно выгрузить в CSV, если он виден на экране.</p>}
    </section>

    <section className={card}><div className="grid gap-2 sm:grid-cols-[1fr_220px]"><input className={field} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск рецепта, ингредиента или метки…" aria-label="Поиск рецептов"/><select className={field} value={category} onChange={e=>setCategory(e.target.value)}><option value="">Все категории</option>{categories.map((item:any)=><option key={item} value={item}>{item}</option>)}</select></div><p className="mt-3 text-xs text-slate-500">Найдено {visible.length} из {recipes.length}</p></section>

    {!recipes.length?<p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-400">Загружаю локальный каталог рецептов…</p>:visible.length===0?<p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-400">Ничего не найдено. Измените запрос или категорию.</p>:<div className="grid gap-3 sm:grid-cols-2">{visible.map((recipe:any)=><article className={card} key={recipe.id}>
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="text-[10px] uppercase tracking-wider text-orange-200">{recipe.category} · {recipe.time_min} мин · базово {recipe.servings} порц.</span><h3 className="mt-1 font-bold text-white">{recipe.name}</h3></div><button type="button" className={btn} onClick={()=>toggleRecipe(recipe)}>{expanded===recipe.id?'Свернуть':'Рецепт'}</button></div>
      <div className="mt-2 flex flex-wrap gap-1">{(recipe.tags||[]).map((tag:string)=><span className="rounded-full bg-white/[.06] px-2 py-1 text-[10px] text-slate-400" key={tag}>{tag}</span>)}</div>
      <div className="mt-3 flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 text-xs text-slate-400">Порций<input className={`${field} w-24`} type="number" min="0.25" max="20" step="0.25" value={servings[recipe.id]??recipe.servings} onChange={e=>{const amount=Number(e.target.value);if(Number.isFinite(amount)&&amount>=0.25&&amount<=20)setRecipePortions(recipe,amount)}}/></label><button type="button" disabled={!planLoaded} className={`${btn} ${mealPlan[recipe.id]!==undefined?'border-emerald-400/30 bg-emerald-500/10 text-emerald-100':''}`} onClick={()=>toggleMealPlan(recipe)}>{mealPlan[recipe.id]!==undefined?'✓ В плане · убрать':'＋ Добавить в план'}</button>{expanded===recipe.id&&<button type="button" className={btn} onClick={()=>void fetchDetail(recipe,servings[recipe.id]??recipe.servings)}>Пересчитать БЖУ</button>}</div>
      {expanded===recipe.id&&<div className="mt-4 border-t border-white/5 pt-3"><h4 className="text-xs font-bold text-amber-100">Ингредиенты на {servings[recipe.id]??recipe.servings} порций</h4><ul className="mt-1 space-y-1">{recipe.ingredients.map((ingredient:any)=>{const grams=ingredient.grams*(servings[recipe.id]??recipe.servings)/recipe.servings;return <li className="text-sm text-slate-300" key={ingredient.name}>• {ingredient.name} — {Math.round(grams*10)/10} г</li>})}</ul><h4 className="mt-4 text-xs font-bold text-cyan-100">Приготовление</h4><ol className="mt-1 list-inside list-decimal space-y-1">{recipe.steps.map((step:string,index:number)=><li className="text-sm leading-relaxed text-slate-400" key={`${recipe.id}-step-${index}`}>{step}</li>)}</ol>{scaled[recipe.id]?.servings===(servings[recipe.id]??recipe.servings)&&scaled[recipe.id]?.nutrition&&<div className="mt-4 rounded-xl bg-slate-950 p-3"><b className="text-sm text-white">Ориентировочно на выбранный объём</b><div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300 sm:grid-cols-4"><span>{scaled[recipe.id].nutrition.kcal} ккал</span><span>Б {scaled[recipe.id].nutrition.protein_g} г</span><span>Ж {scaled[recipe.id].nutrition.fat_g} г</span><span>У {scaled[recipe.id].nutrition.carbs_g} г</span></div><p className="mt-2 text-[10px] text-slate-500">{scaled[recipe.id].note}</p></div>}<p className="mt-3 text-xs text-amber-100/70">{recipe.note}</p></div>}
    </article>)}</div>}
  </div>;
}

function CitizenshipGuide() {
  const rows=[['Германия','BAMF (bamf.de) и портал Make it in Germany','Натурализация обычно требует законного проживания, языка и проверки условий; нормы и исключения обновляются.'],['США','USCIS (uscis.gov)','Пути включают натурализацию после установленного статуса и срока; проверяйте eligibility и действующие требования.'],['Канада','IRCC (canada.ca/immigration)','Гражданство обычно требует статуса постоянного резидента, физического присутствия и выполнения языковых/экзаменационных условий.'],['Великобритания','GOV.UK — British citizenship','Проверяйте применимый путь, сроки проживания, статус и требования к тесту Life in the UK.'],['Россия','МВД России — вопросы гражданства','Пути, основания, документы и порядок подачи зависят от ситуации; сверяйте актуальные правила в официальных ресурсах МВД.'],['Любая другая страна','Официальный сайт органа гражданства/иммиграции и консульство','Проверьте натурализацию, происхождение, брак, инвестиционные ограничения, двойное гражданство, пошлины, срок, налоги и обязанности.']];
  return <div className="space-y-4"><header><div className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-cyan-300">ПРАВО · ИММИГРАЦИЯ</div><h2 className="text-xl font-black text-white">Проверка пути к гражданству</h2><p className="mt-2 text-sm text-slate-400">Условия нельзя надёжно свести к неизменной таблице: законы меняются и зависят от личных обстоятельств. Ниже — официальные точки входа, а не полный каталог всех стран и не юридическая консультация.</p></header><div className="grid gap-3 sm:grid-cols-2">{rows.map(([country,source,detail])=><article className={card} key={country}><h3 className="font-bold text-white">{country}</h3><p className="mt-1 text-xs text-cyan-200">{source}</p><p className="mt-2 text-sm leading-relaxed text-slate-400">{detail}</p></article>)}</div><p className="text-xs text-slate-500">Перед оплатой услуг проверьте, что консультант лицензирован/аккредитован, а платежи вносятся через официальный канал.</p></div>;
}

function LifetimeStatistics() {
  const [age,setAge]=useState(30);const [steps,setSteps]=useState(6000);const [pulse,setPulse]=useState(70);const [sleep,setSleep]=useState(8);
  const years=Math.max(0,Math.min(110,age));const days=years*365.2425;const km=Math.round(days*steps*.00075);const beats=Math.round(days*24*60*pulse);const sleepHours=Math.round(days*sleep);
  return <div className="space-y-4"><header><div className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-violet-300">СТАТИСТИКА · МОДЕЛЬ С ДОПУЩЕНИЯМИ</div><h2 className="text-xl font-black text-white">Человеческая жизнь в числах</h2><p className="mt-2 text-sm text-slate-400">Сценарная экстраполяция ваших средних значений на выбранное число лет, а не измеренная история и не медицинская оценка.</p></header><section className={card}><div className="grid gap-3 sm:grid-cols-2">{[['Возраст',age,0,110,1,setAge,'лет'],['Шагов в день',steps,0,30000,500,setSteps,'шаг/день'],['Пульс покоя',pulse,35,120,1,setPulse,'уд/мин'],['Сон',sleep,3,12,.5,setSleep,'ч/сут']].map(([label,value,min,max,step,update,unit]:any)=><label className="text-xs text-slate-400" key={label}>{label}: {value} {unit}<input className="mt-2 w-full accent-violet-400" type="range" min={min} max={max} step={step} value={value} onChange={e=>update(+e.target.value)}/></label>)}</div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{[['Путь пешком',`${km.toLocaleString()} км`],['Сердечных сокращений',`${beats.toLocaleString()}`],['Времени сна',`${sleepHours.toLocaleString()} ч`]].map(([a,b])=><div className="rounded-xl bg-slate-950 p-3" key={a}><span className="text-[10px] text-slate-500">{a}</span><b className="mt-1 block text-lg text-white">{b}</b></div>)}</div><p className="mt-3 text-xs text-slate-500">Шаги переведены в километры по условной длине шага 0.75 м. Реальная длина шага, пульс и сон меняются ежедневно; это арифметическая модель.</p></section></div>;
}

function AppearanceGuide() {
  const rows=[['Softmaxxing','Сон, базовый уход за кожей, гигиена полости рта, подходящая одежда, осанка и привычная физическая активность. Результат индивидуален; «совершенства» не существует.'],['Hardmaxxing','Инвазивные вмешательства и операции имеют риски, стоимость и период восстановления. Обсуждать их следует только с лицензированным профильным врачом; не покупайте препараты и устройства из сомнительных каналов.'],['Moneymaxxing','Бюджет, навыки, образование, трудовые права, резерв и проверка финансовых рисков. Не является инвестсоветом; обещания гарантированной доходности — красный флаг.'],['Powermaxxing','Сила и физическая форма: постепенная нагрузка, техника, восстановление и достаточное питание. Избегайте анаболических препаратов без медицинских показаний.'],['Loadmaxxing / объём эякулята','Нет доказанного безопасного способа резко «максимизировать» объём по желанию. Объём и фертильность — разные показатели; для анализа соблюдают инструкцию лаборатории (часто 2–7 дней воздержания). Добавки и «курсы» могут навредить.']];
  return <div className="space-y-4"><header><div className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-pink-300">САМОУХОД · КРИТИЧЕСКИЙ СПРАВОЧНИК</div><h2 className="text-xl font-black text-white">Looksmaxxing, soft/hardmaxxing и смежные практики</h2><p className="mt-2 text-sm text-slate-400">Интернет-ярлыки не являются медицинскими терминами. Здесь они переведены в безопасные понятные направления без обещаний результата.</p></header><div className="grid gap-3 sm:grid-cols-2">{rows.map(([name,desc])=><article className={card} key={name}><h3 className="font-bold text-white">{name}</h3><p className="mt-2 text-sm leading-relaxed text-slate-400">{desc}</p></article>)}</div><p className="text-xs text-slate-500">Если забота о внешности занимает большую часть дня, вызывает страдание или ведёт к опасным практикам, поговорите со специалистом по психическому здоровью.</p></div>;
}

function SemenHealthGuide() {
  return <div className="space-y-4"><header><div className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-cyan-300">АНДРОЛОГИЯ · ИНФОРМИРОВАНИЕ</div><h2 className="text-xl font-black text-white">Сперма, фертильность и факты</h2><p className="mt-2 text-sm text-slate-400">Внешний вид и объём эякулята не позволяют определить фертильность. Для оценки применяют лабораторную спермограмму и клинический контекст.</p></header><section className={card}><h3 className="font-bold text-white">WHO Laboratory Manual, 6-е издание (2021)</h3><p className="mt-2 text-sm leading-relaxed text-slate-300">Нижние референсные пятые перцентили в группе мужчин, чьи партнёрши зачали в течение 12 месяцев: объём 1.4 мл, общее число сперматозоидов 39 млн на эякулят, концентрация 16 млн/мл, общая подвижность 42%, прогрессивная 30%, нормальные формы 4%.</p><p className="mt-3 rounded-lg bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100/80">Это не граница «фертилен/бесплоден»: значения вне порога не устанавливают диагноз, значения выше не гарантируют зачатие. Результат оценивает врач и часто повторяют анализ.</p></section><div className="grid gap-3 sm:grid-cols-2">{[['Подготовка к анализу','Следуйте инструкции лаборатории. Для стандартизованной спермограммы WHO обычно указывает сбор после 2–7 дней воздержания; длительное воздержание не улучшает показатели бесконечно.'],['Объём эякулята','Меняется между днями и зависит от сбора, интервала, гидратации и других факторов. По объёму нельзя оценить количество сперматозоидов или вероятность зачатия.'],['Добавки и «максимизация»','Убедительных универсальных схем увеличения объёма нет; гормоны, анаболики и сомнительные добавки могут нарушать сперматогенез и иметь побочные эффекты.'],['Когда обратиться','При трудностях с зачатием, боли, крови в эякуляте, заметном устойчивом изменении или вопросах о фертильности — к урологу-андрологу.']].map(([a,b])=><article className={card} key={a}><h3 className="font-bold text-cyan-100">{a}</h3><p className="mt-2 text-sm text-slate-400">{b}</p></article>)}</div></div>;
}

function WorldCalendarClock() {
  const [now,setNow]=useState(new Date());
  useEffect(()=>{const timer=window.setInterval(()=>setNow(new Date()),1000);return()=>window.clearInterval(timer)},[]);
  const calendars=[['Gregorian','en-GB-u-ca-gregory'],['Исламский (умм аль-кура)','ru-RU-u-ca-islamic-umalqura'],['Еврейский','ru-RU-u-ca-hebrew'],['Персидский','fa-IR-u-ca-persian'],['Буддийский','th-TH-u-ca-buddhist'],['Японский','ja-JP-u-ca-japanese'],['Китайский','zh-CN-u-ca-chinese']];
  const formatted=(locale:string)=>{try{return new Intl.DateTimeFormat(locale,{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(now)}catch{return 'Календарь не поддерживается в этом браузере'}};
  const jd=Math.floor(now.getTime()/86400000+2440587.5);
  const date=now.toISOString().slice(0,10);
  return <div className="space-y-4"><header><div className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-cyan-300">ВРЕМЯ · КАЛЕНДАРИ</div><h2 className="text-xl font-black text-white">Дата и часы</h2><p className="mt-2 text-sm text-slate-400">Время устройства обновляется каждую секунду. Даты других календарей форматирует Intl API браузера; возможны различия в локалях.</p></header><section className="rounded-2xl border border-white/10 bg-slate-900/75 p-5"><div className="font-mono text-4xl font-black tabular-nums text-cyan-200">{now.toLocaleTimeString()}</div><div className="mt-1 text-sm text-slate-400">{now.toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div><div className="mt-2 text-xs text-slate-500">ISO: {date} · Unix: {Math.floor(now.getTime()/1000)} · Юлианский день: {jd}</div><div className="mt-4 grid gap-2 sm:grid-cols-2">{calendars.map(([name,locale])=><div key={name} className="rounded-xl bg-slate-950 p-3"><span className="text-[10px] uppercase tracking-wider text-slate-500">{name}</span><b className="mt-1 block text-sm text-white">{formatted(locale)}</b></div>)}</div></section><p className="text-xs text-slate-500">Возраст Вселенной оценивается примерно в 13.8 млрд лет по современной космологии, а не выражается как точное число календарных дней с момента «рождения». Эта дата — модельная оценка.</p></div>;
}

function MahjongSolitaire() {
  const makeTiles = (): { id: string; icon: string; removed?: boolean }[] => {
    const icons = ['🀄','🀅','🀆','🀇','🀈','🀉','🀊','🀋','🀌','🀍','🀎','🀏','🀐','🀑','🀒','🀓'];
    const deck = [...icons, ...icons].map((icon, i) => ({ id: `${i}-${Math.random().toString(16).slice(2,6)}`, icon }));
    for (let i=deck.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [deck[i],deck[j]]=[deck[j],deck[i]]; }
    return deck;
  };
  const [tiles,setTiles]=useState(makeTiles); const [first,setFirst]=useState<string|null>(null); const [moves,setMoves]=useState(0); const [hint,setHint]=useState('Выбирайте пары одинаковых плиток. В этой мини-версии свободная плитка находится на открытом краю ряда.');
  const free=(i:number)=>!tiles[i]?.removed&&((i%8===0)||!tiles[i-1]?.removed||(i%8===7)||!tiles[i+1]?.removed);
  const click=(i:number)=>{if(!free(i))return; const tile=tiles[i]; if(!first){setFirst(tile.id);return;} if(first===tile.id){setFirst(null);return;} const fi=tiles.findIndex(t=>t.id===first); setMoves(m=>m+1); if(tiles[fi]?.icon===tile.icon){setTiles(v=>v.map((t,j)=>(j===fi||j===i)?{...t,removed:true}:t));setHint('Пара снята. Ищите следующие совпадения.');}else{setHint('Плитки разные — попробуйте другую пару.');}setFirst(null);};
  const left=tiles.filter(t=>!t.removed).length;
  return <div className="space-y-4"><header><div className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-amber-300">ИГРА · МАДЖОНГ-ПАСЬЯНС</div><h2 className="text-xl font-black text-white">Снимите пары плиток</h2><p className="mt-2 text-sm text-slate-400">Облегчённый вариант: плитки удаляются одинаковыми парами, свободны края непрерывного ряда. Классические раскладки маджонга имеют иные правила свободы.</p></header><section className="rounded-2xl border border-white/10 bg-slate-900/75 p-3 sm:p-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400"><span>Осталось плиток: {left}</span><span>Ходы: {moves}</span><button className="rounded-lg border border-white/10 px-3 py-1.5 text-white" onClick={()=>{setTiles(makeTiles());setFirst(null);setMoves(0);setHint('Новая раскладка.')}}>Новая игра</button></div><div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8 sm:gap-2">{tiles.map((t,i)=>t.removed?<div key={t.id} className="aspect-square"/>:<button key={t.id} disabled={!free(i)} onClick={()=>click(i)} className={`aspect-square rounded-xl border text-2xl shadow transition sm:text-3xl ${free(i)?'border-amber-200/25 bg-gradient-to-br from-amber-100 to-amber-300 text-slate-900 hover:-translate-y-0.5':'border-white/5 bg-slate-950 text-slate-600 opacity-50'} ${first===t.id?'ring-4 ring-cyan-400':''}`}>{t.icon}</button>)}</div><div className="mt-3 rounded-lg bg-slate-950 p-3 text-xs text-cyan-100">{left===0?'Победа — поле очищено!':hint}</div></section></div>;
}

type PersonalEpisode = { id:string; title:string; rating:number|null; note:string };
type PersonalSeason = { id:string; title:string; episodes:PersonalEpisode[] };
type PersonalShow = { id:string; title:string; seasons:PersonalSeason[] };
const RATINGS_STORAGE_KEY='multi-personal-episode-ratings-v1';
const newLocalId=()=>`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

function EpisodeRatings() {
  const [shows,setShows]=useState<PersonalShow[]>([]); const [loaded,setLoaded]=useState(false); const [saveError,setSaveError]=useState(false);
  const [showId,setShowId]=useState(''); const [seasonId,setSeasonId]=useState('');
  const [draftTitle,setDraftTitle]=useState(''); const [seasonDraft,setSeasonDraft]=useState('');
  useEffect(()=>{try{const raw=localStorage.getItem(RATINGS_STORAGE_KEY);const parsed=raw?JSON.parse(raw):[];if(Array.isArray(parsed)){const safe=parsed.slice(0,50).filter((x:any)=>x&&typeof x.id==='string'&&typeof x.title==='string'&&Array.isArray(x.seasons)).map((show:any)=>({...show,seasons:show.seasons.slice(0,100).filter((se:any)=>se&&typeof se.id==='string'&&typeof se.title==='string'&&Array.isArray(se.episodes)).map((se:any)=>({...se,episodes:se.episodes.slice(0,1000).filter((ep:any)=>ep&&typeof ep.id==='string').map((ep:any)=>({id:ep.id,title:typeof ep.title==='string'?ep.title.slice(0,100):'Серия',rating:Number.isInteger(ep.rating)&&ep.rating>=1&&ep.rating<=10?ep.rating:null,note:typeof ep.note==='string'?ep.note.slice(0,300):''}))}))}));setShows(safe)}}catch{setShows([]);setSaveError(true)}finally{setLoaded(true)}},[]);
  useEffect(()=>{if(loaded){try{localStorage.setItem(RATINGS_STORAGE_KEY,JSON.stringify(shows));setSaveError(false)}catch{setSaveError(true)}}},[shows,loaded]);
  const current=shows.find(s=>s.id===showId)||shows[0]; const season=current?.seasons.find(s=>s.id===seasonId)||current?.seasons[0];
  const totalEpisodes=shows.reduce((sum,show)=>sum+show.seasons.reduce((n,se)=>n+se.episodes.length,0),0);
  const rated=season?.episodes.filter(e=>Number.isFinite(e.rating))||[];
  const average=rated.length? rated.reduce((sum,e)=>sum+(e.rating||0),0)/rated.length:null;
  const addShow=(ev:React.FormEvent)=>{ev.preventDefault();const title=draftTitle.trim().slice(0,100);if(!title||shows.length>=50)return;const id=newLocalId();const fresh:PersonalShow={id,title,seasons:[]};setShows(v=>[...v,fresh]);setShowId(id);setSeasonId('');setDraftTitle('');};
  const addSeason=(ev:React.FormEvent)=>{ev.preventDefault();if(!current||current.seasons.length>=100)return;const title=(seasonDraft.trim()||`Сезон ${current.seasons.length+1}`).slice(0,60);const id=newLocalId();setShows(v=>v.map(s=>s.id===current.id?{...s,seasons:[...s.seasons,{id,title,episodes:[]}]}:s));setSeasonId(id);setSeasonDraft('');};
  const addEpisode=()=>{if(!current||!season||season.episodes.length>=1000||totalEpisodes>=2000)return;const id=newLocalId();const ep:PersonalEpisode={id,title:`Серия ${season.episodes.length+1}`,rating:null,note:''};setShows(v=>v.map(s=>s.id===current.id?{...s,seasons:s.seasons.map(se=>se.id===season.id?{...se,episodes:[...se.episodes,ep]}:se)}:s));};
  const updateEpisode=(episodeId:string,patch:Partial<PersonalEpisode>)=>{if(!current||!season)return;setShows(v=>v.map(s=>s.id===current.id?{...s,seasons:s.seasons.map(se=>se.id===season.id?{...se,episodes:se.episodes.map(ep=>ep.id===episodeId?{...ep,...patch}:ep)}:se)}:s))};
  const deleteEpisode=(episodeId:string)=>{if(!current||!season)return;setShows(v=>v.map(s=>s.id===current.id?{...s,seasons:s.seasons.map(se=>se.id===season.id?{...se,episodes:se.episodes.filter(ep=>ep.id!==episodeId)}:se)}:s))};
  const deleteShow=()=>{if(!current||!window.confirm(`Удалить «${current.title}» и все его оценки с этого устройства?`))return;const remaining=shows.filter(s=>s.id!==current.id);setShows(remaining);setShowId(remaining[0]?.id||'');setSeasonId('');};
  return <div className="space-y-4"><header><div className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-cyan-300">КИНО · ЛИЧНЫЕ ОЦЕНКИ</div><h2 className="text-xl font-black text-white sm:text-2xl">Ваш рейтинг серий</h2><p className="mt-2 text-sm text-slate-400">Создайте собственный список сериалов и сезонов, добавляйте серии и выставляйте оценки. Данные сохраняются только в localStorage этого браузера; готовых или выдуманных рейтингов здесь нет.</p></header>
    <section className={card}><form onSubmit={addShow} className="grid gap-2 sm:grid-cols-[1fr_auto]"><label className="text-xs text-slate-400">Название сериала<input className={`${field} mt-1`} value={draftTitle} onChange={e=>setDraftTitle(e.target.value)} maxLength={100} placeholder="Например, название вашего сериала"/></label><button className={`${btn} self-end`} disabled={!draftTitle.trim()||shows.length>=50}>＋ Добавить список</button></form>
      {shows.length>0&&<div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]"><label className="text-xs text-slate-400">Сериал<select className={`${field} mt-1`} value={current?.id||''} onChange={e=>{setShowId(e.target.value);setSeasonId('')}}>{shows.map(s=><option value={s.id} key={s.id}>{s.title}</option>)}</select></label><button className={`${btn} self-end border-rose-400/20 text-rose-200`} onClick={deleteShow}>Удалить список</button></div>}
      {current&&current.seasons.length<100&&<form onSubmit={addSeason} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"><label className="text-xs text-slate-400">Новый сезон (имя необязательно)<input className={`${field} mt-1`} value={seasonDraft} onChange={e=>setSeasonDraft(e.target.value)} maxLength={60} placeholder={`Сезон ${current.seasons.length+1}`}/></label><button className={`${btn} self-end`}>＋ Добавить сезон</button></form>}
    </section>
    {current&&season&&<section className={card}><div className="flex flex-wrap items-center gap-2"><label className="min-w-48 flex-1 text-xs text-slate-400">Сезон<select className={`${field} mt-1`} value={season.id} onChange={e=>setSeasonId(e.target.value)}>{current.seasons.map(s=><option value={s.id} key={s.id}>{s.title}</option>)}</select></label><button className={`${btn} self-end`} onClick={addEpisode} disabled={season.episodes.length>=1000||totalEpisodes>=2000}>＋ Добавить серию</button></div><div className="mt-3 flex flex-wrap gap-3 rounded-xl bg-slate-950 p-3 text-xs text-slate-400"><span>Серий: {season.episodes.length}</span><span>Оценено: {rated.length}</span><span>Средняя оценка: {average===null?'—':`${average.toFixed(1)} / 10`}</span></div>
      {season.episodes.length===0?<p className="mt-4 rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">В этом сезоне пока нет серий. Нажмите «Добавить серию», чтобы начать список.</p>:<div className="mt-3 grid gap-2 sm:grid-cols-2">{season.episodes.map((ep,index)=><article className="rounded-xl border border-white/5 bg-slate-950/70 p-3" key={ep.id}><div className="flex items-start gap-2"><label className="min-w-0 flex-1 text-[10px] text-slate-500">Название серии<input className={`${field} mt-1`} value={ep.title} maxLength={100} onChange={e=>updateEpisode(ep.id,{title:e.target.value})}/></label><button className="mt-5 rounded-lg border border-rose-300/10 px-2 py-1 text-xs text-rose-200" onClick={()=>deleteEpisode(ep.id)} aria-label={`Удалить серию ${index+1}`}>Удалить</button></div><label className="mt-3 block text-[10px] text-slate-500">Ваша оценка<select className={`${field} mt-1`} value={ep.rating??''} onChange={e=>updateEpisode(ep.id,{rating:e.target.value===''?null:Number(e.target.value)})}><option value="">Без оценки</option>{Array.from({length:10},(_,i)=>i+1).map(n=><option key={n} value={n}>{n} / 10</option>)}</select></label><label className="mt-3 block text-[10px] text-slate-500">Заметка<input className={`${field} mt-1`} value={ep.note} maxLength={300} onChange={e=>updateEpisode(ep.id,{note:e.target.value})} placeholder="Необязательно"/></label></article>)}</div>}
    </section>}
    {current&&current.seasons.length===0&&<p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">Список создан. Добавьте сезон, чтобы заносить серии.</p>}
    {!current&&<p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">Пока нет списков. Создайте сериал выше — оценки останутся на этом устройстве.</p>}
    <p className="text-[11px] text-slate-500">Удаление списка необратимо после перезагрузки страницы. Очистка данных сайта также удаляет сохранённые оценки.</p>{saveError&&<p className="rounded-lg border border-amber-300/20 bg-amber-300/[.06] p-3 text-xs text-amber-100">Браузер не разрешил доступ к локальному хранилищу. Пока страница открыта, оценки доступны в памяти, но не переживут её закрытие.</p>}</div>;
}

function Tournament16() {
  const baseNames=()=>Array.from({length:16},(_,i)=>`Участник ${i+1}`);
  const [names,setNames]=useState(baseNames); const [winner,setWinner]=useState(''); const [round,setRound]=useState(0); const [roundWinners,setRoundWinners]=useState<Record<number,string>>({});
  const roundNames=['1/8 финала','Четвертьфинал','Полуфинал','Финал']; const matches=Math.ceil(names.length/2);
  const choose=(match:number,name:string)=>{if(roundWinners[match]||!name.trim())return;const updated={...roundWinners,[match]:name.trim()};setRoundWinners(updated);if(Object.keys(updated).length===matches){const advancing=Array.from({length:matches},(_,i)=>updated[i]).filter(Boolean);if(advancing.length===1){setWinner(advancing[0]);return;}setNames(advancing);setRound(v=>v+1);setRoundWinners({});}};
  const reset=()=>{setNames(baseNames());setWinner('');setRound(0);setRoundWinners({});};
  return <div className="space-y-4"><header><div className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-violet-300">ТУРНИР · СЕТКА НА 16 УЧАСТНИКОВ</div><h2 className="text-xl font-black text-white">Турнир на выбывание</h2><p className="mt-2 text-sm text-slate-400">Редактируйте названия участников и вручную выбирайте победителя каждого матча. Результат определяется вашим выбором, это не автоматический рейтинг или оценка персонажей.</p></header><section className={card}>{winner?<div className="py-8 text-center"><div className="text-sm text-slate-400">Победитель по вашим выборам</div><div className="mt-2 text-3xl font-black text-amber-200">🏆 {winner}</div><button className={`${btn} mt-4`} onClick={reset}>Начать заново</button></div>:<><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs uppercase tracking-wider text-violet-200">{roundNames[round]||`Раунд ${round+1}`}</span><span className="text-xs text-slate-500">Выбрано победителей: {Object.keys(roundWinners).length} / {matches}</span></div><div className="grid gap-2 sm:grid-cols-2">{Array.from({length:matches},(_,pair)=>{const a=names[pair*2],b=names[pair*2+1],selected=roundWinners[pair];return <div key={`${round}-${pair}`} className="rounded-xl bg-slate-950 p-3"><div className="mb-2 text-[10px] text-slate-500">Матч {pair+1}</div><button disabled={!a||!!selected} className={`${btn} w-full justify-start ${selected===a?'border-emerald-400/40 bg-emerald-500/10':''}`} onClick={()=>choose(pair,a)}><span className="mr-2 text-slate-500">#{pair*2+1}</span>{a}{selected===a?' · Победитель':''}</button>{b&&<button disabled={!!selected} className={`${btn} mt-2 w-full justify-start ${selected===b?'border-emerald-400/40 bg-emerald-500/10':''}`} onClick={()=>choose(pair,b)}><span className="mr-2 text-slate-500">#{pair*2+2}</span>{b}{selected===b?' · Победитель':''}</button>}</div>})}</div>{round===0&&Object.keys(roundWinners).length===0&&<details className="mt-4"><summary className="cursor-pointer text-xs text-slate-400">Изменить имена 16 участников</summary><div className="mt-2 grid gap-2 sm:grid-cols-2">{names.map((n,i)=><label key={i} className="text-[10px] text-slate-500">Участник {i+1}<input className={`${field} mt-1`} value={n} maxLength={60} onChange={e=>setNames(v=>v.map((x,j)=>j===i?e.target.value:x))}/></label>)}</div></details>}<button className={`${btn} mt-3`} onClick={reset}>Сбросить сетку</button></>}</section></div>;
}
