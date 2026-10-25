import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  LogOut,
  Play,
  RefreshCw,
  Ruler,
  ShieldAlert,
  Trophy,
  UserPlus,
  Users,
  Vote,
} from 'lucide-react';
import { apiGet, apiPost, copyText } from '../../lib/api';
import { Mini3DSceneBadge, RealScaleComparison3D } from '../three/Interactive3DScenes';

// ==============================================================================
// 1. БАЗА РАУНДОВ ИГРЫ «GUESS SIZE (УГАДАЙ РЕАЛЬНЫЙ РАЗМЕР)»
// ==============================================================================
interface GuessChallenge {
  id: string;
  targetName: string;
  unitLabel: string;
  trueCm: number;
  minCm: number;
  maxCm: number;
  stepCm: number;
  refName: string;
  refCm: number;
  targetShape: 'box' | 'cylinder' | 'sphere' | 'card' | 'phone';
  refShape: 'box' | 'cylinder' | 'sphere' | 'card' | 'phone';
  fact: string;
}

const GUESS_CHALLENGES: GuessChallenge[] = [
  {
    id: 'microsd',
    targetName: 'Карта памяти microSD (длина)',
    unitLabel: 'см',
    trueCm: 1.5,
    minCm: 0.5,
    maxCm: 4.5,
    stepCm: 0.1,
    refName: 'Монета 1 рубль',
    refCm: 2.05,
    targetShape: 'card',
    refShape: 'cylinder',
    fact: 'Стандарт microSD — ровно 15 × 11 × 1 мм (площадь меньше ногтя мизинца).',
  },
  {
    id: 'golf_ball',
    targetName: 'Мяч для гольфа (диаметр)',
    unitLabel: 'см',
    trueCm: 4.27,
    minCm: 2.0,
    maxCm: 10.0,
    stepCm: 0.1,
    refName: 'Теннисный мяч',
    refCm: 6.7,
    targetShape: 'sphere',
    refShape: 'sphere',
    fact: 'По правилам USGA диаметр мяча для гольфа не может быть меньше 42.67 мм.',
  },
  {
    id: 'nhl_puck',
    targetName: 'Хоккейная шайба НХЛ/КХЛ (диаметр)',
    unitLabel: 'см',
    trueCm: 7.62,
    minCm: 4.0,
    maxCm: 16.0,
    stepCm: 0.1,
    refName: 'Банка 0.33 л (высота)',
    refCm: 11.5,
    targetShape: 'cylinder',
    refShape: 'cylinder',
    fact: 'Ровно 3 дюйма (7.62 см) в диаметре и 2.54 см толщиной, вес 170 г.',
  },
  {
    id: 'bee_hummingbird',
    targetName: 'Колибри-пчёлка (самая маленькая птица)',
    unitLabel: 'см',
    trueCm: 5.5,
    minCm: 2.0,
    maxCm: 15.0,
    stepCm: 0.1,
    refName: 'Спичечный коробок',
    refCm: 5.0,
    targetShape: 'sphere',
    refShape: 'box',
    fact: 'Обитает на Кубе, весит всего 1.8 грамма и чуть длиннее спичечного коробка!',
  },
  {
    id: 'oscar_statuette',
    targetName: 'Статуэтка премии «Оскар» (высота)',
    unitLabel: 'см',
    trueCm: 34.3,
    minCm: 15.0,
    maxCm: 65.0,
    stepCm: 0.5,
    refName: 'Лист бумаги А4',
    refCm: 29.7,
    targetShape: 'cylinder',
    refShape: 'card',
    fact: 'Позолоченный рыцарь выше листа А4 (34.3 см) и весит внушительные 3.85 кг!',
  },
  {
    id: 'fifa_trophy',
    targetName: 'Кубок мира ФИФА по футболу (высота)',
    unitLabel: 'см',
    trueCm: 36.8,
    minCm: 18.0,
    maxCm: 80.0,
    stepCm: 0.5,
    refName: 'Футбольный мяч №5',
    refCm: 22.0,
    targetShape: 'cylinder',
    refShape: 'sphere',
    fact: 'По телевизору Кубок мира кажется гигантским, но его высота всего 36.8 см (зато 6.17 кг золота 750 пробы).',
  },
  {
    id: 'mona_lisa',
    targetName: 'Картина «Мона Лиза» в Лувре (высота)',
    unitLabel: 'см',
    trueCm: 77.0,
    minCm: 35.0,
    maxCm: 190.0,
    stepCm: 1.0,
    refName: 'Монитор 27 дюймов (ширина)',
    refCm: 61.0,
    targetShape: 'card',
    refShape: 'card',
    fact: 'Посетители Лувра часто удивляются компактности шедевра Леонардо: 77 × 53 см.',
  },
  {
    id: 'bowling_pin',
    targetName: 'Кегля для боулинга (высота)',
    unitLabel: 'см',
    trueCm: 38.1,
    minCm: 18.0,
    maxCm: 70.0,
    stepCm: 0.5,
    refName: 'Баскетбольный мяч',
    refCm: 24.0,
    targetShape: 'cylinder',
    refShape: 'sphere',
    fact: 'Вблизи с дорожки кегля оказывается неожиданно высокой — ровно 15 дюймов (38.1 см).',
  },
  {
    id: 'albatross_wingspan',
    targetName: 'Размах крыльев странствующего альбатроса',
    unitLabel: 'м',
    trueCm: 350.0,
    minCm: 120.0,
    maxCm: 600.0,
    stepCm: 5.0,
    refName: 'Рост человека',
    refCm: 178.0,
    targetShape: 'box',
    refShape: 'cylinder',
    fact: 'Рекорд среди всех живых птиц планеты — до 3.5–3.7 метра (почти два человеческих роста!).',
  },
  {
    id: 'belaz_tire',
    targetName: 'Колесо карьерного самосвала БелАЗ-75710',
    unitLabel: 'м',
    trueCm: 403.0,
    minCm: 150.0,
    maxCm: 700.0,
    stepCm: 5.0,
    refName: 'Легковой кроссовер (высота)',
    refCm: 168.0,
    targetShape: 'cylinder',
    refShape: 'box',
    fact: 'Каждая шина Michelin 59/80R63 на БелАЗе имеет диаметр 4.03 метра и весит более 5.3 тонны!',
  },
  {
    id: 'traffic_light',
    targetName: 'Дорожный трёхсекционный светофор (высота корпуса)',
    unitLabel: 'см',
    trueCm: 105.0,
    minCm: 40.0,
    maxCm: 200.0,
    stepCm: 2.0,
    refName: 'Рост человека',
    refCm: 178.0,
    targetShape: 'box',
    refShape: 'cylinder',
    fact: 'На столбе светофор кажется крошечным, но стандартный корпус с линзами 200–300 мм выше метра!',
  },
  {
    id: 'hollywood_letter',
    targetName: 'Одна буква надписи HOLLYWOOD на холмах',
    unitLabel: 'м',
    trueCm: 1370.0,
    minCm: 400.0,
    maxCm: 3000.0,
    stepCm: 25.0,
    refName: 'Пятиэтажный дом',
    refCm: 1500.0,
    targetShape: 'card',
    refShape: 'box',
    fact: 'Каждая буква знака HOLLYWOOD достигает 13.7 метра в высоту — почти с пятиэтажку!',
  },
];

const formatCmSmart = (cm: number): string => {
  if (cm >= 100) return `${(cm / 100).toFixed(2)} м`;
  return `${cm.toFixed(1)} см`;
};

export const GuessSizeGame: React.FC<{
  onScoreSubmit: (gameId: string, score: number) => void;
  onToast: (msg: string) => void;
}> = ({ onScoreSubmit, onToast }) => {
  const [deck, setDeck] = useState<GuessChallenge[]>(() =>
    [...GUESS_CHALLENGES].sort(() => Math.random() - 0.5).slice(0, 5)
  );
  const [roundIdx, setRoundIdx] = useState(0);
  const [guessCm, setGuessCm] = useState<number>(() => {
    const first = deck[0];
    return Math.round(((first.minCm + first.maxCm) / 2) * 10) / 10;
  });
  const [revealed, setRevealed] = useState(false);
  const [totalScore, setTotalScore] = useState(0);
  const [lastPoints, setLastPoints] = useState(0);
  const [finished, setFinished] = useState(false);

  const current = deck[roundIdx] || GUESS_CHALLENGES[0];

  const startNewMatch = () => {
    const shuffled = [...GUESS_CHALLENGES].sort(() => Math.random() - 0.5).slice(0, 5);
    setDeck(shuffled);
    setRoundIdx(0);
    setGuessCm(Number(((shuffled[0].minCm + shuffled[0].maxCm) / 2).toFixed(1)));
    setRevealed(false);
    setTotalScore(0);
    setLastPoints(0);
    setFinished(false);
  };

  const lockGuess = () => {
    if (revealed) return;
    const relErr = Math.abs(guessCm - current.trueCm) / current.trueCm;
    const pts = Math.max(0, Math.round(1000 * Math.exp(-relErr * 2.4)));
    setLastPoints(pts);
    setTotalScore((s) => s + pts);
    setRevealed(true);
  };

  const nextRound = () => {
    if (roundIdx + 1 >= deck.length) {
      setFinished(true);
      onScoreSubmit('guess_size', totalScore);
      onToast(`🏆 Серия Guess Size завершена: ${totalScore} / 5000 очков!`);
      return;
    }
    const nxt = deck[roundIdx + 1];
    setRoundIdx((i) => i + 1);
    setGuessCm(Number(((nxt.minCm + nxt.maxCm) / 2).toFixed(1)));
    setRevealed(false);
  };

  const errPct = useMemo(
    () => Math.round((Math.abs(guessCm - current.trueCm) / current.trueCm) * 100),
    [guessCm, current.trueCm]
  );

  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-slate-900/80 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Mini3DSceneBadge seed="guess_size" color="#10b981" size={38} />
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              📐 Guess Size — Угадай реальный размер объекта в 3D
            </h3>
            <p className="text-[11px] text-slate-400">
              Сопоставьте загаданный объект с известным эталоном на 3D-подиуме (5 раундов, макс. 5000 очков)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-white/10 text-slate-300">
            Раунд {roundIdx + 1}/{deck.length}
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold">
            {totalScore} очк.
          </span>
        </div>
      </div>

      {finished ? (
        <div className="p-6 rounded-2xl bg-slate-950/90 border border-emerald-400/40 text-center space-y-3">
          <Trophy className="w-10 h-10 text-amber-400 mx-auto" />
          <div className="text-xl font-black text-white">Итог серии: {totalScore} из 5000 очков</div>
          <p className="text-xs text-slate-300">
            {totalScore >= 4200
              ? 'Глазомер главного инженера! Рекорд отправлен в таблицу лидеров.'
              : totalScore >= 2800
              ? 'Отличное чувство масштаба! Попробуйте побить 4000+ очков.'
              : 'Реальные размеры объектов часто обманывают восприятие — сыграйте ещё партию!'}
          </p>
          <button
            type="button"
            onClick={startNewMatch}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" /> Новые 5 объектов
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7">
            <RealScaleComparison3D
              title={`🎯 Раунд ${roundIdx + 1}: ${current.targetName}`}
              leftObj={{
                label: revealed ? `Истина: ${current.targetName}` : 'Ваша 3D-оценка',
                sizeCm: revealed ? current.trueCm : guessCm,
                shape: current.targetShape,
                color: revealed ? '#10b981' : '#f59e0b',
              }}
              rightObj={{
                label: `Эталон: ${current.refName}`,
                sizeCm: current.refCm,
                shape: current.refShape,
                color: '#38bdf8',
              }}
              heightPx={250}
            />
          </div>

          <div className="lg:col-span-5 rounded-2xl bg-slate-950/90 border border-white/10 p-4 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-900 border border-white/10">
                <div className="text-[11px] text-slate-400">Загаданный объект:</div>
                <div className="text-sm font-bold text-white mt-0.5">{current.targetName}</div>
                <div className="text-[11px] text-sky-300 mt-1">
                  Известный эталон рядом: <b>{current.refName} ({formatCmSmart(current.refCm)})</b>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">Ваш ответ:</span>
                  <span className="text-lg font-mono font-black text-amber-300">
                    {formatCmSmart(guessCm)}
                  </span>
                </div>
                <input
                  type="range"
                  disabled={revealed}
                  min={current.minCm}
                  max={current.maxCm}
                  step={current.stepCm}
                  value={guessCm}
                  onChange={(e) => setGuessCm(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>{formatCmSmart(current.minCm)}</span>
                  <span>{formatCmSmart(current.maxCm)}</span>
                </div>
              </div>

              {revealed && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-400/35 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-emerald-200">
                      Реальный размер: {formatCmSmart(current.trueCm)}
                    </span>
                    <span className="font-mono text-amber-300">+{lastPoints} очк. (ошибка {errPct}%)</span>
                  </div>
                  <p className="text-[11px] text-slate-200 leading-relaxed">{current.fact}</p>
                </div>
              )}
            </div>

            {!revealed ? (
              <button
                type="button"
                onClick={lockGuess}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-emerald-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5"
              >
                <Ruler className="w-4 h-4" /> Зафиксировать размер
              </button>
            ) : (
              <button
                type="button"
                onClick={nextRound}
                className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs sm:text-sm"
              >
                {roundIdx + 1 >= deck.length ? '🏆 Завершить серию' : 'Следующий объект →'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ==============================================================================
// 2. ИГРА «🕵️ ШПИОН» (ОНЛАЙН-ЛОББИ ПО КОДУ + ИГРА НА ОДНОМ ТЕЛЕФОНЕ)
// ==============================================================================
const LOCAL_PASS_LOCATIONS = [
  { name: 'Аэропорт', roles: ['Пилот', 'Бортпроводник', 'Таможенник', 'Пассажир', 'Диспетчер', 'Авиамеханик'] },
  { name: 'Подводная лодка', roles: ['Капитан', 'Акустик', 'Кок', 'Штурман', 'Инженер реактора', 'Радист'] },
  { name: 'Больница', roles: ['Главврач', 'Хирург', 'Медсестра', 'Пациент', 'Анестезиолог', 'Рентгенолог'] },
  { name: 'Орбитальная станция МКС', roles: ['Командир МКС', 'Бортинженер', 'Биолог', 'Оператор стыковки', 'Врач'] },
  { name: 'Киностудия', roles: ['Режиссёр', 'Каскадёр', 'Оператор', 'Гримёр', 'Продюсер', 'Звукорежиссёр'] },
  { name: 'Банк', roles: ['Управляющий', 'Инкассатор', 'Кассир', 'Охранник', 'VIP-клиент', 'Аудитор'] },
  { name: 'Полярная станция', roles: ['Начальник станции', 'Метеоролог', 'Бурильщик льда', 'Радист', 'Повар'] },
  { name: 'Поезд дальнего следования', roles: ['Проводник', 'Машинист', 'Пассажир плацкарта', 'Повар вагона-ресторана'] },
];

export const SpyLobbyHub: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const [mode, setMode] = useState<'online' | 'local'>('online');

  // --- Online Lobby State ---
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('mtt_spy_name') || '');
  const [joinCode, setJoinCode] = useState('');
  const [pack, setPack] = useState('all');
  const [spyCount, setSpyCount] = useState(1);
  const [roundMinutes, setRoundMinutes] = useState(6);

  const [roomCode, setRoomCode] = useState(() => sessionStorage.getItem('mtt_spy_code') || '');
  const [playerToken, setPlayerToken] = useState(() => sessionStorage.getItem('mtt_spy_token') || '');
  const [lobby, setLobby] = useState<any>(null);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [spyGuessLoc, setSpyGuessLoc] = useState('');

  // --- Local Pass-and-Play State ---
  const [localPlayersCount, setLocalPlayersCount] = useState(4);
  const [localCards, setLocalCards] = useState<{ playerIdx: number; isSpy: boolean; location: string; role: string }[]>([]);
  const [localCurrentIdx, setLocalCurrentIdx] = useState(0);
  const [localOpen, setLocalOpen] = useState(false);
  const [localPhase, setLocalPhase] = useState<'setup' | 'dealing' | 'timer' | 'revealed'>('setup');
  const [localSeconds, setLocalSeconds] = useState(300);

  const persistSession = (code: string, token: string, name: string) => {
    setRoomCode(code);
    setPlayerToken(token);
    if (name) localStorage.setItem('mtt_spy_name', name);
    if (code) sessionStorage.setItem('mtt_spy_code', code);
    else sessionStorage.removeItem('mtt_spy_code');
    if (token) sessionStorage.setItem('mtt_spy_token', token);
    else sessionStorage.removeItem('mtt_spy_token');
  };

  // Poll active online lobby every 2.4s
  useEffect(() => {
    if (mode !== 'online' || !roomCode) return;
    let cancelled = false;
    const pull = async () => {
      try {
        const st = await apiGet(`/api/v2/spy/state?code=${encodeURIComponent(roomCode)}&token=${encodeURIComponent(playerToken)}`);
        if (!cancelled) setLobby(st);
      } catch {
        if (!cancelled) {
          setLobby(null);
          persistSession('', '', playerName);
        }
      }
    };
    pull();
    const id = window.setInterval(pull, 2400);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [mode, roomCode, playerToken]);

  // Local timer tick
  useEffect(() => {
    if (localPhase !== 'timer') return;
    const id = window.setInterval(() => {
      setLocalSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [localPhase]);

  const handleCreateLobby = async () => {
    const name = playerName.trim() || 'Ведущий';
    try {
      const res = await apiPost('/api/v2/spy/create', {
        host_name: name,
        pack,
        spy_count: spyCount,
        round_minutes: roundMinutes,
      });
      setLobby(res);
      setCardFlipped(false);
      persistSession(res.code, res.my_card?.token || '', name);
      onToast(`🕵️ Лобби ${res.code} создано! Отправьте код друзьям.`);
    } catch (e: any) {
      onToast(e.message || 'Ошибка создания лобби');
    }
  };

  const handleJoinLobby = async () => {
    if (!joinCode.trim()) {
      onToast('Введите 5-значный код комнаты');
      return;
    }
    const name = playerName.trim() || `Агент ${Math.floor(10 + Math.random() * 89)}`;
    try {
      const res = await apiPost('/api/v2/spy/join', {
        code: joinCode.trim().toUpperCase(),
        player_name: name,
        player_token: playerToken,
      });
      setLobby(res);
      setCardFlipped(false);
      persistSession(res.code, res.my_card?.token || '', name);
      onToast(`✅ Вы вошли в лобби ${res.code}`);
    } catch (e: any) {
      onToast(e.message || 'Комната не найдена');
    }
  };

  const handleStartRound = async () => {
    try {
      const res = await apiPost('/api/v2/spy/start', { code: roomCode, player_token: playerToken });
      setLobby(res);
      setCardFlipped(true);
      onToast('🎬 Раунд начался! Нажмите на 3D-карту, чтобы проверить роль.');
    } catch (e: any) {
      onToast(e.message);
    }
  };

  const handleVote = async (slotId: string) => {
    try {
      const res = await apiPost('/api/v2/spy/vote', {
        code: roomCode,
        player_token: playerToken,
        target_slot_id: slotId,
      });
      setLobby(res);
    } catch (e: any) {
      onToast(e.message);
    }
  };

  const handleSpyGuess = async () => {
    if (!spyGuessLoc) return;
    try {
      const res = await apiPost('/api/v2/spy/guess', {
        code: roomCode,
        player_token: playerToken,
        guessed_location: spyGuessLoc,
      });
      setLobby(res);
    } catch (e: any) {
      onToast(e.message);
    }
  };

  const handleHostFinish = async () => {
    try {
      const res = await apiPost('/api/v2/spy/finish', { code: roomCode, player_token: playerToken });
      setLobby(res);
    } catch (e: any) {
      onToast(e.message);
    }
  };

  const leaveLobby = () => {
    setLobby(null);
    persistSession('', '', playerName);
  };

  // --- Start Local Pass-and-Play ---
  const startLocalGame = () => {
    const loc = LOCAL_PASS_LOCATIONS[Math.floor(Math.random() * LOCAL_PASS_LOCATIONS.length)];
    const spyIdx = Math.floor(Math.random() * localPlayersCount);
    const dealt = Array.from({ length: localPlayersCount }, (_, i) => ({
      playerIdx: i + 1,
      isSpy: i === spyIdx,
      location: loc.name,
      role: i === spyIdx ? 'ШПИОН' : loc.roles[i % loc.roles.length],
    }));
    setLocalCards(dealt);
    setLocalCurrentIdx(0);
    setLocalOpen(false);
    setLocalSeconds(roundMinutes * 60);
    setLocalPhase('dealing');
  };

  const fmtTime = (sec: number) =>
    `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

  return (
    <div className="rounded-2xl border border-rose-500/25 bg-slate-900/80 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <Mini3DSceneBadge seed="spy_lobby" color="#f43f5e" size={38} />
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white">
              🕵️ Шпион — Онлайн-Лобби и Игра в компании
            </h3>
            <p className="text-[11px] text-slate-400">
              Создайте комнату по коду для игры с разных телефонов или раздайте роли на одном устройстве
            </p>
          </div>
        </div>

        <div className="flex rounded-xl bg-slate-950 p-1 border border-white/10 text-xs">
          <button
            type="button"
            onClick={() => setMode('online')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              mode === 'online' ? 'bg-rose-500/25 text-rose-200 border border-rose-400/40' : 'text-slate-400 hover:text-white'
            }`}
          >
            🌐 Онлайн-Лобби
          </button>
          <button
            type="button"
            onClick={() => setMode('local')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              mode === 'local' ? 'bg-indigo-500/25 text-indigo-200 border border-indigo-400/40' : 'text-slate-400 hover:text-white'
            }`}
          >
            📱 На 1 телефоне
          </button>
        </div>
      </div>

      {/* MODE 1: MULTIPLAYER ONLINE LOBBY */}
      {mode === 'online' && !lobby && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-white/10 space-y-3">
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-rose-400" /> Создать новое лобби
            </div>
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Ваше имя в комнате..."
              className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-xs text-white"
            />
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Набор локаций</label>
                <select
                  value={pack}
                  onChange={(e) => setPack(e.target.value)}
                  className="w-full rounded-xl bg-slate-900 border border-white/10 px-2 py-2 text-white"
                >
                  <option value="all">Все (22)</option>
                  <option value="classic">Классика</option>
                  <option value="world">Вокруг света</option>
                  <option value="science">Космос/Наука</option>
                  <option value="cinema">Кино/Арена</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Шпионов</label>
                <select
                  value={spyCount}
                  onChange={(e) => setSpyCount(Number(e.target.value))}
                  className="w-full rounded-xl bg-slate-900 border border-white/10 px-2 py-2 text-white"
                >
                  <option value={1}>1 шпион</option>
                  <option value={2}>2 шпиона</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Таймер (мин)</label>
                <select
                  value={roundMinutes}
                  onChange={(e) => setRoundMinutes(Number(e.target.value))}
                  className="w-full rounded-xl bg-slate-900 border border-white/10 px-2 py-2 text-white"
                >
                  <option value={4}>4 мин</option>
                  <option value={6}>6 мин</option>
                  <option value={8}>8 мин</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCreateLobby}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 text-slate-950 font-bold text-xs sm:text-sm"
            >
              Создать комнату и получить код
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/90 border border-white/10 flex flex-col justify-between space-y-3">
            <div className="space-y-3">
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-sky-400" /> Войти в лобби друга по коду
              </div>
              <input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Ваше имя..."
                className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-xs text-white"
              />
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="КОД КОМНАТЫ (например K7M4P)"
                className="w-full rounded-xl bg-slate-900 border border-sky-500/30 px-3 py-2.5 text-sm font-mono font-bold tracking-widest uppercase text-center text-sky-200"
              />
            </div>
            <button
              type="button"
              onClick={handleJoinLobby}
              className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs sm:text-sm"
            >
              Присоединиться к лобби
            </button>
          </div>
        </div>
      )}

      {/* ACTIVE ONLINE LOBBY ROOM */}
      {mode === 'online' && lobby && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-slate-950 border border-rose-500/30">
            <div className="flex items-center gap-3">
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Код лобби</div>
                <button
                  type="button"
                  onClick={() => copyText(lobby.code, onToast)}
                  className="text-lg font-mono font-black tracking-widest text-amber-300 flex items-center gap-1.5"
                >
                  {lobby.code} <Copy className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="text-xs">
                <div className="text-slate-300 font-semibold">
                  Игроков: {lobby.players?.length || 1} (мин. 3)
                </div>
                <div className="text-[11px] text-slate-400">
                  Статус:{' '}
                  {lobby.status === 'waiting'
                    ? 'Ожидание участников'
                    : lobby.status === 'playing'
                    ? `Идёт раунд • ⏱ ${fmtTime(lobby.seconds_left)}`
                    : 'Раунд завершён'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {lobby.my_card?.is_host && lobby.status !== 'playing' && (
                <button
                  type="button"
                  onClick={handleStartRound}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" /> {lobby.round_num > 0 ? 'Новый раунд' : 'Начать игру'}
                </button>
              )}
              {lobby.my_card?.is_host && lobby.status === 'playing' && (
                <button
                  type="button"
                  onClick={handleHostFinish}
                  className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 font-semibold text-xs"
                >
                  Вскрыть карты
                </button>
              )}
              <button
                type="button"
                onClick={leaveLobby}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300"
                title="Покинуть лобби"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 3D Secret Role Card + Players Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5">
              {lobby.status === 'waiting' ? (
                <div className="p-5 rounded-2xl bg-slate-950/90 border border-dashed border-white/15 text-center space-y-2">
                  <div className="text-sm font-bold text-white">Ждём подключения игроков...</div>
                  <p className="text-xs text-slate-400">
                    Отправьте друзьям код <b className="text-amber-300 font-mono">{lobby.code}</b>. Как только соберётся минимум 3 человека, ведущий запускает раунд!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Interactive 3D Perspective Role Card */}
                  <div
                    onClick={() => setCardFlipped((f) => !f)}
                    style={{
                      perspective: '1000px',
                    }}
                    className="cursor-pointer select-none"
                  >
                    <div
                      style={{
                        transformStyle: 'preserve-3d',
                        transition: 'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)',
                        transform: cardFlipped ? 'rotateY(0deg)' : 'rotateY(180deg)',
                      }}
                      className="rounded-2xl p-5 border min-h-[175px] flex flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-950 to-rose-950/40 border-rose-400/40 shadow-xl"
                    >
                      {cardFlipped ? (
                        <>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono text-slate-400">СЕКРЕТНОЕ ДОСЬЕ</span>
                            <span className="text-slate-400 flex items-center gap-1">
                              <EyeOff className="w-3.5 h-3.5" /> Скрыть
                            </span>
                          </div>
                          <div className="my-2 text-center">
                            {lobby.my_card?.is_spy ? (
                              <>
                                <div className="text-2xl font-black text-rose-400">🕵️ ВЫ — ШПИОН!</div>
                                <p className="text-xs text-slate-300 mt-1">
                                  Не выдайте себя и попробуйте понять локацию по вопросам остальных игроков.
                                </p>
                              </>
                            ) : (
                              <>
                                <div className="text-xs text-emerald-300 uppercase">Локация раунда</div>
                                <div className="text-lg font-black text-white mt-0.5">
                                  📍 {lobby.my_card?.location}
                                </div>
                                <div className="text-xs text-amber-300 mt-1.5">
                                  Ваша роль: <b>{lobby.my_card?.role}</b>
                                </div>
                              </>
                            )}
                          </div>
                          <div className="text-[10px] text-center text-slate-500">Нажмите на карту, чтобы перевернуть рубашкой вверх</div>
                        </>
                      ) : (
                        <div
                          style={{ transform: 'rotateY(180deg)' }}
                          className="h-full flex flex-col items-center justify-center text-center py-6 space-y-2"
                        >
                          <Eye className="w-7 h-7 text-indigo-400" />
                          <div className="text-sm font-bold text-white">Карта роли скрыта от чужих глаз</div>
                          <div className="text-xs text-slate-400">Нажмите, чтобы посмотреть свою роль</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Spy All-In Location Guess */}
                  {lobby.status === 'playing' && lobby.my_card?.is_spy && (
                    <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 space-y-2">
                      <div className="text-xs font-bold text-rose-200 flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4" /> Ход Шпиона ва-банк: назвать локацию
                      </div>
                      <div className="flex gap-2">
                        <select
                          value={spyGuessLoc}
                          onChange={(e) => setSpyGuessLoc(e.target.value)}
                          className="flex-1 rounded-xl bg-slate-950 border border-white/10 px-2.5 py-2 text-xs text-white"
                        >
                          <option value="">Выберите локацию...</option>
                          {(lobby.possible_locations || []).map((locName: string) => (
                            <option key={locName} value={locName}>
                              {locName}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleSpyGuess}
                          className="px-3 py-2 rounded-xl bg-rose-500 text-slate-950 font-bold text-xs shrink-0"
                        >
                          Рискнуть
                        </button>
                      </div>
                    </div>
                  )}

                  {lobby.status === 'finished' && (
                    <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-400/40 space-y-1 text-xs">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {lobby.win_reason}
                      </div>
                      <div className="text-amber-300">
                        Секретная локация раунда: <b>{lobby.revealed_location}</b>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Players List & Voting */}
            <div className="lg:col-span-7 space-y-2.5">
              <div className="text-xs font-semibold text-slate-300">
                Участники комнаты ({lobby.players?.length || 0}):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(lobby.players || []).map((p: any) => {
                  const isMyVote = lobby.my_card?.voted_for === p.slot_id;
                  return (
                    <div
                      key={p.slot_id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                        p.revealed_is_spy
                          ? 'bg-rose-500/20 border-rose-400'
                          : 'bg-slate-950/85 border-white/10'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                          {p.name}
                          {p.is_host && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                              Хост
                            </span>
                          )}
                        </div>
                        {lobby.status === 'finished' && (
                          <div className="text-[11px] text-slate-300 mt-0.5">
                            {p.revealed_is_spy ? '🕵️ ШПИОН' : `Роль: ${p.revealed_role}`}
                          </div>
                        )}
                      </div>

                      {lobby.status === 'playing' && (
                        <button
                          type="button"
                          onClick={() => handleVote(p.slot_id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 shrink-0 transition ${
                            isMyVote
                              ? 'bg-rose-500 text-slate-950 font-bold'
                              : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
                          }`}
                        >
                          <Vote className="w-3 h-3" /> Подозревать {p.votes_against > 0 ? `(${p.votes_against})` : ''}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: PASS-AND-PLAY ON ONE PHONE */}
      {mode === 'local' && (
        <div className="p-4 rounded-2xl bg-slate-950/90 border border-white/10 space-y-4">
          {localPhase === 'setup' && (
            <div className="space-y-3 max-w-md">
              <div className="text-sm font-bold text-white">Раздача карт ролей на одном телефоне</div>
              <div className="text-xs text-slate-300">
                Количество игроков за столом: <b className="text-indigo-300 font-mono">{localPlayersCount}</b>
              </div>
              <input
                type="range"
                min={3}
                max={12}
                value={localPlayersCount}
                onChange={(e) => setLocalPlayersCount(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
              <button
                type="button"
                onClick={startLocalGame}
                className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-bold text-xs"
              >
                Раздать секретные роли ({localPlayersCount} чел.)
              </button>
            </div>
          )}

          {localPhase === 'dealing' && localCards[localCurrentIdx] && (
            <div className="max-w-md mx-auto text-center space-y-3 py-2">
              <div className="text-xs font-mono text-indigo-300">
                ИГРОК {localCurrentIdx + 1} ИЗ {localCards.length}
              </div>
              {!localOpen ? (
                <button
                  type="button"
                  onClick={() => setLocalOpen(true)}
                  className="w-full py-10 rounded-2xl bg-slate-900 border border-indigo-400/40 hover:border-indigo-400 text-white font-bold text-sm space-y-2"
                >
                  <Eye className="w-7 h-7 text-indigo-400 mx-auto" />
                  <div>Передайте телефон Игроку №{localCurrentIdx + 1} и нажмите</div>
                </button>
              ) : (
                <div className="p-6 rounded-2xl bg-slate-900 border border-amber-400/50 space-y-3">
                  {localCards[localCurrentIdx].isSpy ? (
                    <div className="text-2xl font-black text-rose-400">🕵️ ВЫ — ШПИОН!</div>
                  ) : (
                    <>
                      <div className="text-xs text-slate-400">Локация:</div>
                      <div className="text-xl font-black text-emerald-300">
                        📍 {localCards[localCurrentIdx].location}
                      </div>
                      <div className="text-xs text-amber-200">
                        Ваша роль: <b>{localCards[localCurrentIdx].role}</b>
                      </div>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setLocalOpen(false);
                      if (localCurrentIdx + 1 < localCards.length) {
                        setLocalCurrentIdx((i) => i + 1);
                      } else {
                        setLocalPhase('timer');
                      }
                    }}
                    className="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
                  >
                    Запомнил — скрыть карту
                  </button>
                </div>
              )}
            </div>
          )}

          {localPhase === 'timer' && (
            <div className="text-center space-y-3 py-3">
              <div className="text-xs text-slate-400">Задавайте друг другу вопросы о локации!</div>
              <div className="text-4xl font-mono font-black text-amber-300">{fmtTime(localSeconds)}</div>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setLocalPhase('revealed')}
                  className="px-4 py-2 rounded-xl bg-rose-500 text-slate-950 font-bold text-xs"
                >
                  Вскрыть Шпиона и локацию
                </button>
                <button
                  type="button"
                  onClick={() => setLocalPhase('setup')}
                  className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs"
                >
                  Сброс
                </button>
              </div>
            </div>
          )}

          {localPhase === 'revealed' && (
            <div className="text-center space-y-2 py-2">
              <div className="text-base font-bold text-emerald-300">
                Локация: {localCards[0]?.location}
              </div>
              <div className="text-sm font-bold text-rose-400">
                Шпионом был: Игрок №{localCards.find((c) => c.isSpy)?.playerIdx}
              </div>
              <button
                type="button"
                onClick={startLocalGame}
                className="mt-2 px-4 py-2 rounded-xl bg-indigo-500 text-slate-950 font-bold text-xs"
              >
                Сыграть ещё раунд
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
