import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Crown,
  Edit3,
  ExternalLink,
  Eye,
  Flame,
  Heart,
  MessageCircle,
  Send,
  Sparkles,
  Star,
  UserCheck,
  Youtube,
} from 'lucide-react';
import { apiGet, apiPost, copyText, openExternalLink } from '../../lib/api';
import { Tilt3DCard } from '../three/Tilt3DCard';

interface Props {
  activeTool: string;
  onSelectTool: (t: string) => void;
  onSync: () => void;
  onToast: (msg: string) => void;
}

const toolToSocialTab = (tool: string): 'top' | 'altushka' | 'bibinto' | 'turing' | 'anon' | 'author' => {
  if (tool === 'altushka_chat') return 'altushka';
  if (tool === 'bibinto_rate') return 'bibinto';
  if (tool === 'turing_game') return 'turing';
  if (tool === 'anon_chat') return 'anon';
  if (tool === 'author_links') return 'author';
  return 'top';
};

const GAME_LABELS: Record<string, string> = {
  arcade_wolf: '🐺 Ну, погоди!',
  wolf: '🐺 Ну, погоди!',
  wolf_eggs: '🐺 Ну, погоди!',
  arcade_doodle: '🚀 Doodle Jump',
  doodle: '🚀 Doodle Jump',
  doodle_jump: '🚀 Doodle Jump',
  arcade_tetris: '🧱 Тетрис',
  tetris: '🧱 Тетрис',
  arcade_clicker: '⚡ Кликер',
  clicker: '⚡ Кликер',
  chess_ai: '♟️ Шахматы ИИ',
  chess_puzzles: '🧩 Шахматные задачи',
  reaction_cps_lab: '⚡ Реакция / CPS',
  aim_trainer_3d: '🎯 Аим-тренажёр',
  schulte_stroop: '🔢 Таблицы Шульте',
  nonogram_15: '🧩 Кроссворд / Пятнашки',
  turing_game: '🤖 Человек или ИИ',
};

const PERSONA_AVATARS: Record<string, string> = {
  ksyusha: '/art/persona_ksyusha.gif',
  alisa: '/art/persona_alisa.gif',
  milana: '/art/persona_milana.gif',
  rita: '/art/persona_rita.gif',
};

export const SocialDatingHub: React.FC<Props> = ({ activeTool, onSelectTool, onSync, onToast }) => {
  const [subTab, setSubTab] = useState<'top' | 'altushka' | 'bibinto' | 'turing' | 'anon' | 'author'>(() =>
    toolToSocialTab(activeTool)
  );
  const profileInspectorRef = useRef<HTMLDivElement | null>(null);
  const altChatEndRef = useRef<HTMLDivElement | null>(null);

  // --- Leaderboard & Public Profile ---
  const [sortBy, setSortBy] = useState<'xp' | 'games' | 'views' | 'respects' | 'tools'>('xp');
  const [leaders, setLeaders] = useState<any[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialLoadError, setSocialLoadError] = useState('');
  const [socialRetry, setSocialRetry] = useState(0);
  const socialRequestId = useRef(0);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [myBio, setMyBio] = useState('');
  const [myEmoji, setMyEmoji] = useState('⚡');
  const [showEditMe, setShowEditMe] = useState(false);

  // --- Altushka 18+ Chat ---
  const [personas, setPersonas] = useState<any[]>([]);
  const [activePersona, setActivePersona] = useState<any>(null);
  const [affection, setAffection] = useState(30);
  const [statusTitle, setStatusTitle] = useState('Знакомство в сети 💬');
  const [altMessages, setAltMessages] = useState<{ from: 'girl' | 'me'; text: string; mood?: string }[]>([]);
  const [altInput, setAltInput] = useState('');

  // --- Bibinto 1..10 ---
  const [bibintoProfiles, setBibintoProfiles] = useState<any[]>([]);
  const [bibIdx, setBibIdx] = useState(0);
  const [showCreateBib, setShowCreateBib] = useState(false);
  const [newBibName, setNewBibName] = useState('');
  const [newBibAge, setNewBibAge] = useState(20);
  const [newBibCity, setNewBibCity] = useState('Москва');
  const [newBibVibe, setNewBibVibe] = useState('Киберпанк & Музыка');
  const [newBibBio, setNewBibBio] = useState('');

  // --- Turing Human vs AI ---
  const [turingRound, setTuringRound] = useState<any>(null);
  const [turingVerdict, setTuringVerdict] = useState<any>(null);
  const [turingScore, setTuringScore] = useState({ right: 0, total: 0 });
  const [seenRounds, setSeenRounds] = useState<number[]>([]);

  // --- Anonymous Chat ---
  const [anonRoom, setAnonRoom] = useState('global');
  const [anonMsgs, setAnonMsgs] = useState<any[]>([]);
  const [anonInput, setAnonInput] = useState('');
  const [anonRoomLoading, setAnonRoomLoading] = useState(false);
  const [anonSending, setAnonSending] = useState(false);
  const anonRoomRequestId = useRef(0);
  const anonSendRequestId = useRef(0);

  // --- Author Links (QLS) ---
  const [authorInfo, setAuthorInfo] = useState<any>(null);

  useEffect(() => {
    setSubTab(toolToSocialTab(activeTool));
  }, [activeTool]);

  const loadLeaders = async (s = sortBy) => {
    const id = ++socialRequestId.current;
    setSocialLoading(true); setSocialLoadError('');
    try {
      const r = await apiGet(`/api/v2/social/leaderboard?sort_by=${s}`);
      if (id === socialRequestId.current) setLeaders(r.users || []);
    } catch (error: any) {
      if (id === socialRequestId.current) setSocialLoadError(error?.message || 'Не удалось загрузить рейтинг игроков');
    } finally {
      if (id === socialRequestId.current) setSocialLoading(false);
    }
  };

  const openUserProfile = async (uid: number) => {
    try {
      const p = await apiGet(`/api/v2/social/profile/${uid}`);
      setSelectedProfile(p);
      loadLeaders(sortBy);
      setTimeout(() => {
        if (window.innerWidth < 1024) {
          profileInspectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 60);
    } catch (e: any) {
      onToast(e.message);
    }
  };

  const sendRespect = async (uid: number) => {
    try {
      const r = await apiPost('/api/v2/social/respect', { target_user_id: uid });
      setSelectedProfile(r.profile);
      loadLeaders(sortBy);
      onToast('🔥 Респект отправлен (+15 XP игроку)!');
    } catch (e: any) {
      onToast(e.message);
    }
  };

  const saveMyProfile = async () => {
    try {
      await apiPost('/api/v2/social/profile/update', { bio: myBio, avatar_emoji: myEmoji });
      setShowEditMe(false);
      loadLeaders(sortBy);
      onSync();
      onToast('Ваш профиль обновлён ✨');
    } catch (e: any) {
      onToast(e.message);
    }
  };

  // Load only the active social view, and expose failed requests with an explicit retry.
  useEffect(() => {
    if (subTab === 'top') {
      void loadLeaders(sortBy);
      return () => { socialRequestId.current += 1; };
    }
    const id = ++socialRequestId.current;
    let request: Promise<any> | null = null;
    if (subTab === 'altushka' && personas.length === 0) request = apiGet('/api/v2/social/altushka');
    else if (subTab === 'bibinto' && bibintoProfiles.length === 0) request = apiGet('/api/v2/social/bibinto');
    else if (subTab === 'turing' && !turingRound) request = apiGet('/api/v2/social/turing');
    else if (subTab === 'anon' && anonMsgs.length === 0) request = apiGet(`/api/v2/social/anon?room=${encodeURIComponent(anonRoom)}`);
    else if (subTab === 'author' && !authorInfo) request = apiGet('/api/v2/author');
    if (!request) { setSocialLoading(false); setSocialLoadError(''); return () => { socialRequestId.current += 1; }; }

    setSocialLoading(true); setSocialLoadError('');
    request.then((r) => {
      if (id !== socialRequestId.current) return;
      if (subTab === 'altushka') {
        const list = r.personas || [];
        setPersonas(list);
        if (list[0]) { setActivePersona(list[0]); setAltMessages([{ from: 'girl', text: list[0].greeting, mood: 'онлайн 🖤' }]); }
      } else if (subTab === 'bibinto') setBibintoProfiles(r.profiles || []);
      else if (subTab === 'turing') setTuringRound(r);
      else if (subTab === 'anon') setAnonMsgs(r.messages || []);
      else if (subTab === 'author') setAuthorInfo(r);
    }).catch((error: any) => {
      if (id === socialRequestId.current) setSocialLoadError(error?.message || 'Не удалось загрузить данные этого раздела');
    }).finally(() => {
      if (id === socialRequestId.current) setSocialLoading(false);
    });
    return () => { socialRequestId.current += 1; };
  }, [subTab, socialRetry]);

  const selectPersona = (p: any) => {
    setActivePersona(p);
    setAffection(30);
    setStatusTitle('Знакомство в сети 💬');
    setAltMessages([{ from: 'girl', text: p.greeting, mood: 'рада знакомству ✨' }]);
  };

  const sendAltMessage = async (textOverride?: string) => {
    const txt = (textOverride ?? altInput).trim();
    if (!txt || !activePersona) return;
    setAltInput('');
    setAltMessages((prev) => [...prev, { from: 'me', text: txt }]);
    try {
      const r = await apiPost('/api/v2/social/altushka', {
        persona_id: activePersona.id,
        message: txt,
        affection,
      });
      setAffection(r.affection);
      setStatusTitle(r.status_title);
      setAltMessages((prev) => [...prev, { from: 'girl', text: r.reply, mood: r.mood }]);
      onSync();
    } catch (e: any) {
      onToast(e.message);
    }
  };

  const rateBibinto = async (profileId: number, score: number) => {
    try {
      const r = await apiPost('/api/v2/social/bibinto/rate', { profile_id: profileId, score });
      setBibintoProfiles(r.profiles || []);
      onToast(`Оценка ${score}/10 засчитана! Средний балл анкеты: ${r.rated.avg_rating} ⭐`);
      setBibIdx((i) => (i + 1) % Math.max(1, (r.profiles || []).length));
      onSync();
    } catch (e: any) {
      onToast(e.message);
    }
  };

  useEffect(() => {
    altChatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [altMessages.length]);

  const createBibintoCard = async () => {
    if (!newBibName.trim()) {
      onToast('Введите имя или ник для анкеты');
      return;
    }
    try {
      const r = await apiPost('/api/v2/social/bibinto/create', {
        display_name: newBibName,
        age: newBibAge,
        city: newBibCity,
        vibe: newBibVibe,
        bio: newBibBio || 'Участник MULTI_TG_TOOL',
        avatar_style: '⚡',
      });
      setBibintoProfiles(r.profiles || []);
      setShowCreateBib(false);
      setNewBibName('');
      setNewBibBio('');
      setBibIdx(0);
      onToast('Ваша карточка опубликована в Bibinto! 💎');
    } catch (e: any) {
      onToast(e.message);
    }
  };

  const guessTuring = async (guess: 'human' | 'ai') => {
    if (!turingRound || turingVerdict) return;
    try {
      const r = await apiPost('/api/v2/social/turing', { round_id: turingRound.id, guess });
      setTuringVerdict(r);
      setTuringScore((s) => ({ right: s.right + (r.correct ? 1 : 0), total: s.total + 1 }));
      setSeenRounds((prev) => [...prev.slice(-8), turingRound.id]);
      onSync();
    } catch (e: any) {
      onToast(e.message || 'Ошибка проверки ответа');
    }
  };

  const nextTuring = async () => {
    try {
      setTuringVerdict(null);
      const r = await apiGet(`/api/v2/social/turing?exclude=${seenRounds.join(',')}`);
      setTuringRound(r);
    } catch (e: any) {
      onToast(e.message || 'Ошибка загрузки раунда');
    }
  };

  const switchAnonRoom = async (room: string) => {
    if (room === anonRoom && !anonRoomLoading) return;
    const currentRequest = ++anonRoomRequestId.current;
    anonSendRequestId.current += 1;
    socialRequestId.current += 1;
    setAnonRoom(room);
    setAnonMsgs([]);
    setAnonSending(false);
    setAnonRoomLoading(true);
    setSocialLoadError('');
    try {
      const r = await apiGet(`/api/v2/social/anon?room=${encodeURIComponent(room)}`);
      if (currentRequest !== anonRoomRequestId.current) return;
      setAnonMsgs(r.messages || []);
    } catch (e: any) {
      if (currentRequest !== anonRoomRequestId.current) return;
      const message = e.message || 'Ошибка переключения комнаты';
      setSocialLoadError(message);
      onToast(message);
    } finally {
      if (currentRequest === anonRoomRequestId.current) setAnonRoomLoading(false);
    }
  };

  const sendAnon = async () => {
    const text = anonInput.trim();
    if (!text || anonRoomLoading || anonSending) return;
    const room = anonRoom;
    const currentRequest = ++anonSendRequestId.current;
    setAnonSending(true);
    try {
      const r = await apiPost('/api/v2/social/anon', { text, room });
      if (currentRequest !== anonSendRequestId.current || room !== anonRoom) return;
      setAnonMsgs(r.messages || []);
      setAnonInput('');
      onSync();
    } catch (e: any) {
      if (currentRequest === anonSendRequestId.current && room === anonRoom) onToast(e.message || 'Ошибка отправки');
    } finally {
      if (currentRequest === anonSendRequestId.current) setAnonSending(false);
    }
  };

  const currentBib = bibintoProfiles[bibIdx % Math.max(1, bibintoProfiles.length)];

  return (
    <div className="space-y-5 min-w-0">
      {socialLoading && <p role="status" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-400">Загружаю данные раздела…</p>}
      {socialLoadError && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2"><p role="alert" className="text-xs text-rose-100">{socialLoadError}</p><button type="button" onClick={() => setSocialRetry((value) => value + 1)} className="rounded-lg border border-rose-300/25 bg-rose-400/10 px-3 py-1.5 text-[10px] text-rose-100 hover:bg-rose-400/20">Повторить</button></div>}

      {/* 1. LEADERBOARD & CLICKABLE USER PROFILES */}
      {subTab === 'top' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-slate-900/75 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-400" /> Глобальный Рейтинг Игроков по Всем Параметрам
                </h3>
                <p className="text-xs text-slate-400">
                  Нажмите на любого игрока, чтобы зайти в его профиль (счётчик заходов 👁 увеличится в реальном времени!)
                </p>
              </div>
              <button
                onClick={() => setShowEditMe(!showEditMe)}
                className="px-3 py-1.5 rounded-xl bg-sky-500/20 text-sky-200 border border-sky-400/40 text-xs flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" /> Настроить свой профиль
              </button>
            </div>

            {showEditMe && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-sky-400/40 space-y-2.5 text-xs">
                <div className="flex flex-wrap sm:flex-nowrap gap-2">
                  <input
                    value={myEmoji}
                    onChange={(e) => setMyEmoji(e.target.value)}
                    maxLength={4}
                    placeholder="⚡"
                    className="w-16 shrink-0 rounded-lg bg-slate-900 border border-white/10 px-2.5 py-1.5 text-center text-base"
                  />
                  <input
                    value={myBio}
                    onChange={(e) => setMyBio(e.target.value)}
                    placeholder="Напишите статус / биографию своего профиля..."
                    className="min-w-[150px] flex-1 rounded-lg bg-slate-900 border border-white/10 px-3 py-1.5 text-white"
                  />
                  <button
                    type="button"
                    onClick={saveMyProfile}
                    className="w-full sm:w-auto shrink-0 px-4 py-1.5 rounded-lg bg-sky-500 text-slate-950 font-bold"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            )}

            {/* Multi-metric sort pills */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'xp', label: '✨ По Опыту (XP)' },
                { id: 'games', label: '🎮 По Рекорду Игр' },
                { id: 'views', label: '👁 По Заходам на Профиль' },
                { id: 'respects', label: '🔥 По Респектам' },
                { id: 'tools', label: '🛠 По Инструментам' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSortBy(s.id as any);
                    loadLeaders(s.id as any);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs border transition ${
                    sortBy === s.id
                      ? 'bg-amber-500/25 border-amber-400/50 text-amber-200 font-semibold'
                      : 'bg-slate-950 border-white/10 text-slate-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {leaders.length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-950/80 border border-white/10 text-center text-xs text-slate-400">
                  В рейтинге отображаются только реальные пользователи Telegram. Откройте любой инструмент в Telegram, чтобы появиться в списке.
                </div>
              ) : (
                leaders.map((u) => (
                  <button
                    key={u.user_id}
                    onClick={() => openUserProfile(u.user_id)}
                    className={`w-full p-3 rounded-xl border text-left transition flex items-center justify-between gap-3 ${
                      selectedProfile?.user_id === u.user_id
                        ? 'bg-sky-500/15 border-sky-400/50'
                        : 'bg-slate-950/90 border-white/10 hover:border-amber-400/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center font-mono text-xs font-bold text-amber-300 shrink-0">
                        #{u.position}
                      </div>
                      <div className="text-xl shrink-0">{u.avatar_emoji || '👤'}</div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-white truncate">
                          {u.first_name} {u.username ? <span className="text-slate-500 font-normal">@{u.username}</span> : null}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{u.rank_title}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-mono shrink-0">
                      <span className="text-sky-300" title="Опыт XP">{u.xp} XP</span>
                      <span className="text-emerald-300 hidden sm:inline" title="Рекорд в играх">🎮 {u.best_game_score}</span>
                      <span className="text-purple-300 flex items-center gap-1" title="Просмотры профиля">
                        <Eye className="w-3.5 h-3.5" /> {u.profile_views}
                      </span>
                      <span className="text-orange-300" title="Респекты">👍 {u.respects}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Detailed Profile Inspector */}
          <div ref={profileInspectorRef} className="lg:col-span-5 min-w-0">
            <Tilt3DCard
              accentColor="#38bdf8"
              maxTilt={6}
              className="h-full rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 flex flex-col justify-between"
            >
            {selectedProfile ? (
              <div className="space-y-4">
                <div className="flex flex-wrap sm:flex-nowrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-sky-500/30 to-purple-600/30 border border-white/15 flex items-center justify-center text-3xl">
                      {selectedProfile.avatar_emoji || '⚡'}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-base text-white truncate">{selectedProfile.first_name}</h4>
                      <div className="text-xs text-slate-400 truncate">
                        {selectedProfile.username ? `@${selectedProfile.username}` : `ID ${selectedProfile.user_id}`}
                      </div>
                      <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                        {selectedProfile.rank_title}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => sendRespect(selectedProfile.user_id)}
                    className="shrink-0 px-3 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-lg"
                  >
                    <Flame className="w-4 h-4" /> Респект ({selectedProfile.respects})
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/90 border border-white/10 text-xs text-slate-200 italic">
                  «{selectedProfile.bio || 'Участник MULTI_TG_TOOL'}»
                </div>

                {/* Stats Matrix including Profile Visits */}
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950 border border-purple-400/35">
                    <div className="text-slate-400 flex items-center gap-1"><Eye className="w-3.5 h-3.5 text-purple-400" /> Заходов на профиль</div>
                    <div className="text-xl font-black text-purple-300 mt-0.5">{selectedProfile.profile_views}</div>
                    <div className="text-[10px] text-slate-500">Уникальных гостей: {selectedProfile.unique_visitors}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-sky-400/35">
                    <div className="text-slate-400">Опыт и Прогресс</div>
                    <div className="text-xl font-black text-sky-300 mt-0.5">{selectedProfile.xp} XP</div>
                    <div className="text-[10px] text-slate-500">Запусков утилит: {selectedProfile.tools_used}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-emerald-400/30">
                    <div className="text-slate-400">Рекорд Аркады</div>
                    <div className="text-xl font-black text-emerald-300 mt-0.5">🎮 {selectedProfile.best_game_score}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-orange-400/30">
                    <div className="text-slate-400">Респекты комьюнити</div>
                    <div className="text-xl font-black text-orange-300 mt-0.5">🔥 {selectedProfile.respects}</div>
                  </div>
                </div>

                {selectedProfile.game_records?.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-slate-400">Лучшие дисциплины игрока:</div>
                    {selectedProfile.game_records.map((g: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-xs p-2 rounded-lg bg-slate-950/70">
                        <span className="text-slate-300">{GAME_LABELS[g.game_id] || g.game_id}</span>
                        <span className="font-mono text-emerald-300 font-bold">{g.score}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-20 text-center space-y-2 text-slate-400 text-xs">
                <Eye className="w-8 h-8 text-purple-400 mx-auto opacity-75" />
                <div className="font-semibold text-white">Инспектор Профилей Игроков</div>
                <p>Кликните на любого участника слева, чтобы посмотреть его детальную статистику и засчитать визит в его профиль!</p>
              </div>
            )}
            </Tilt3DCard>
          </div>
        </div>
      )}

      {/* 2. ALTUSHKA 18+ DATING CHAT */}
      {subTab === 'altushka' && activePersona && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
          <div className="lg:col-span-4 rounded-2xl border border-white/10 bg-slate-900/75 p-3.5 sm:p-4 space-y-2.5 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">🖤 Персонажи (18+)</h3>
              <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-400/30">18+</span>
            </div>
            {/* Compact horizontal strip on mobile, vertical list on desktop */}
            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0 no-scrollbar">
              {personas.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPersona(p)}
                  className={`shrink-0 w-52 lg:w-full p-2.5 sm:p-3 rounded-xl border text-left transition ${
                    activePersona.id === p.id
                      ? 'bg-rose-500/20 border-rose-400/60'
                      : 'bg-slate-950/80 border-white/10 hover:bg-slate-950'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {PERSONA_AVATARS[p.id] && (
                      <img
                        src={PERSONA_AVATARS[p.id]}
                        alt={p.name}
                        loading="lazy"
                        className="w-10 h-10 rounded-full border border-rose-400/50 object-cover shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs sm:text-sm text-white truncate">{p.emoji} {p.name}, {p.age}</span>
                        <span className="text-[10px] text-rose-300 shrink-0">Онлайн</span>
                      </div>
                      <div className="text-[11px] text-purple-300 mt-0.5 truncate">{p.archetype}</div>
                    </div>
                  </div>
                  <div className="hidden lg:block text-[11px] text-slate-400 mt-1 line-clamp-2">{p.style}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 rounded-2xl border border-rose-400/30 bg-slate-900/80 p-5 flex flex-col justify-between space-y-4">
            {/* Affection Bar */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-white/10 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2.5 font-bold text-white">
                  {PERSONA_AVATARS[activePersona.id] && (
                    <img
                      src={PERSONA_AVATARS[activePersona.id]}
                      alt={activePersona.name}
                      className="w-9 h-9 rounded-full border border-rose-400/60 object-cover shrink-0"
                    />
                  )}
                  <span>
                    {activePersona.emoji} {activePersona.name} ({activePersona.age} лет) — <span className="text-rose-300">{statusTitle}</span>
                  </span>
                </div>
                <span className="font-mono font-bold text-rose-400">❤️ Симпатия: {affection} / 100</span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pink-500 via-rose-500 to-amber-400 transition-all duration-300"
                  style={{ width: `${affection}%` }}
                />
              </div>
            </div>

            {/* Chat Feed */}
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {altMessages.map((m, idx) => (
                <div key={idx} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[82%] p-3 rounded-2xl text-xs leading-relaxed ${
                      m.from === 'me'
                        ? 'bg-gradient-to-r from-rose-500 to-purple-600 text-white rounded-br-sm'
                        : 'bg-slate-950 border border-rose-400/25 text-slate-100 rounded-bl-sm'
                    }`}
                  >
                    {m.mood && <div className="text-[10px] text-rose-300 mb-1 font-medium">{activePersona.name} • {m.mood}</div>}
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={altChatEndRef} />
            </div>

            {/* Quick Flirt Prompts + Input */}
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {(activePersona.quick_prompts || []).map((qp: string) => (
                  <button
                    key={qp}
                    onClick={() => sendAltMessage(qp)}
                    className="px-2.5 py-1 rounded-full bg-rose-500/15 hover:bg-rose-500/30 border border-rose-400/30 text-[11px] text-rose-200 transition"
                  >
                    {qp}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={altInput}
                  onChange={(e) => setAltInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendAltMessage()}
                  placeholder={`Напишите сообщение для ${activePersona.name}...`}
                  className="flex-1 rounded-xl bg-slate-950 border border-white/10 px-4 py-2.5 text-xs sm:text-sm text-white"
                />
                <button
                  onClick={() => sendAltMessage()}
                  className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs flex items-center gap-1.5"
                >
                  <Heart className="w-4 h-4 fill-white" /> Отправить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. BIBINTO 1..10 RATING */}
      {subTab === 'bibinto' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white">💎 Оценка анкет от 1 до 10</h3>
              <p className="text-xs text-slate-400">Ставьте честные баллы от 1 до 10 и добавляйте собственную карточку в рейтинг!</p>
            </div>
            <button
              onClick={() => setShowCreateBib(!showCreateBib)}
              className="px-3.5 py-2 rounded-xl bg-purple-500/20 border border-purple-400/40 text-purple-200 text-xs font-semibold"
            >
              ➕ Разместить свою анкету (18+)
            </button>
          </div>

          {showCreateBib && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-purple-400/40 grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
              <input value={newBibName} onChange={(e) => setNewBibName(e.target.value)} placeholder="Имя / Ник" className="rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-white" />
              <input type="number" min={18} max={99} value={newBibAge} onChange={(e) => setNewBibAge(Number(e.target.value))} placeholder="Возраст (18+)" className="rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-white" />
              <input value={newBibCity} onChange={(e) => setNewBibCity(e.target.value)} placeholder="Город" className="rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-white" />
              <input value={newBibVibe} onChange={(e) => setNewBibVibe(e.target.value)} placeholder="Ваш вайб / стиль" className="rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-white" />
              <input value={newBibBio} onChange={(e) => setNewBibBio(e.target.value)} placeholder="Коротко о себе..." className="sm:col-span-3 rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-white" />
              <button onClick={createBibintoCard} className="rounded-xl bg-purple-500 text-slate-950 font-bold py-2">Опубликовать</button>
            </div>
          )}

          {currentBib && (
            <div className="max-w-xl mx-auto p-6 rounded-2xl bg-gradient-to-br from-slate-950 via-[#13182e] to-[#1e1330] border border-pink-400/35 text-center space-y-4 shadow-2xl">
              <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/15 flex items-center justify-center text-4xl mx-auto">
                {currentBib.avatar_style || '✨'}
              </div>
              <div>
                <h4 className="text-xl font-black text-white">
                  {currentBib.display_name}, {currentBib.age}
                </h4>
                <div className="text-xs text-pink-300 mt-0.5">📍 {currentBib.city} • {currentBib.vibe}</div>
              </div>
              <p className="text-sm text-slate-200 max-w-md mx-auto">«{currentBib.bio}»</p>

              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold">
                ⭐ Средний рейтинг: {currentBib.avg_rating} / 10 ({currentBib.votes_count} оценок)
              </div>

              <div className="pt-2">
                <div className="text-[11px] text-slate-400 mb-2">Ваша оценка по 10-балльной шкале:</div>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => rateBibinto(currentBib.id, num)}
                      className={`py-2.5 rounded-xl font-bold text-xs border transition ${
                        num >= 8
                          ? 'bg-rose-500/20 hover:bg-rose-500 text-rose-200 hover:text-white border-rose-400/40'
                          : 'bg-slate-900 hover:bg-sky-500/30 text-white border-white/10'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                {bibintoProfiles.length > 1 && (
                  <div className="flex items-center justify-between pt-3 text-xs text-slate-400">
                    <button
                      type="button"
                      onClick={() =>
                        setBibIdx((i) => (i - 1 + bibintoProfiles.length) % bibintoProfiles.length)
                      }
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
                    >
                      ← Предыдущая
                    </button>
                    <span>
                      {(bibIdx % bibintoProfiles.length) + 1} / {bibintoProfiles.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setBibIdx((i) => (i + 1) % bibintoProfiles.length)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
                    >
                      Следующая →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. TURING GAME: HUMAN OR AI */}
      {subTab === 'turing' && turingRound && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-6 max-w-2xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Bot className="w-5 h-5 text-sky-400" /> Игра Тьюринга: Человек или Нейросеть?
            </h3>
            <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-mono">
              Угадано: {turingScore.right} / {turingScore.total}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-sky-400/25 space-y-2">
            <div className="text-xs text-sky-300 font-semibold">Тема: {turingRound.topic}</div>
            <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">«{turingRound.text}»</p>
          </div>

          {!turingVerdict ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => guessTuring('human')}
                className="py-3.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/50 text-emerald-200 font-bold text-sm transition"
              >
                🧑 Написал Живой Человек
              </button>
              <button
                onClick={() => guessTuring('ai')}
                className="py-3.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/35 border border-purple-400/50 text-purple-200 font-bold text-sm transition"
              >
                🤖 Сгенерировал ИИ
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-950 border border-amber-400/40 space-y-3 text-xs">
              <div className={`text-sm font-bold ${turingVerdict.correct ? 'text-emerald-300' : 'text-rose-300'}`}>
                {turingVerdict.correct ? '✅ Вы раскусили автора! (+20 XP)' : '❌ Нейро-маскировка сработала! (+5 XP)'} — Это {turingVerdict.actual_label}
              </div>
              <p className="text-slate-200">🔍 <b>Лингвистический разбор:</b> {turingVerdict.clue}</p>
              <button
                onClick={nextTuring}
                className="px-4 py-2 rounded-xl bg-sky-500 text-slate-950 font-bold text-xs"
              >
                Следующий раунд →
              </button>
            </div>
          )}
        </div>
      )}

      {/* 5. ANONYMOUS CHAT */}
      {subTab === 'anon' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-white">🎭 Анонимный Крипто-Чат</h3>
              <p className="text-xs text-slate-400">Никаких имён и юзернеймов — только временная крипто-маска комнаты</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'global', label: '🌙 Ночной эфир' },
                { id: 'gaming', label: '🎮 Игры & Дота' },
                { id: 'confess', label: '🔥 Откровения 18+' },
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => switchAnonRoom(r.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs border ${
                    anonRoom === r.id ? 'bg-purple-500/25 border-purple-400 text-purple-200' : 'bg-slate-950 border-white/10 text-slate-300'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div aria-live="polite" className="space-y-2.5 max-h-80 overflow-y-auto p-3 rounded-xl bg-slate-950 border border-white/10">
            {anonRoomLoading && <p role="status" className="text-xs text-slate-400">Загружаем выбранную комнату…</p>}
            {!anonRoomLoading && anonMsgs.length === 0 && <p className="text-xs text-slate-500">В комнате пока нет сообщений.</p>}
            {anonMsgs.map((m) => (
              <div key={m.id} className="p-2.5 rounded-xl bg-slate-900/90 border border-white/5 text-xs">
                <span className="font-mono font-bold text-purple-300">{m.alias}:</span>{' '}
                <span className="text-slate-100">{m.text}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={anonInput}
              onChange={(e) => setAnonInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendAnon()}
              placeholder="Написать анонимное сообщение..."
              className="min-w-0 flex-1 rounded-xl bg-slate-950 border border-white/10 px-3.5 py-2.5 text-xs sm:text-sm text-white"
            />
            <button
              type="button"
              onClick={sendAnon}
              disabled={anonRoomLoading || anonSending || !anonInput.trim()}
              className="shrink-0 px-3.5 sm:px-4 py-2.5 rounded-xl bg-purple-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" /> {anonSending ? 'Отправка…' : 'В эфир'}
            </button>
          </div>
        </div>
      )}

      {/* 6. AUTHOR SHOWCASE: MINIMAL SHADOW STYLE */}
      {subTab === 'author' && authorInfo && (
        <Tilt3DCard
          accentColor="#f59e0b"
          maxTilt={8}
          className="max-w-xl mx-auto rounded-3xl border border-amber-400/30 bg-gradient-to-br from-[#0c0916] via-[#120d24] to-[#1a0e17] p-6 shadow-2xl space-y-5"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-700 via-rose-600 to-amber-500 flex items-center justify-center text-2xl shadow-lg border border-amber-300/30">
              🕶️
            </div>
            <div>
              <h3 className="text-lg font-black tracking-wide text-white">{authorInfo.title || 'QLS • MULTI_TG_TOOL'}</h3>
              <div className="text-xs text-amber-300/90 font-medium">{authorInfo.tagline || 'В тени 🕶️'}</div>
            </div>
          </div>

          <div className="space-y-2.5">
            {(authorInfo.links || []).map((lnk: any, i: number) => (
              <button
                key={i}
                type="button"
                onClick={() => openExternalLink(lnk.url)}
                className="w-full p-3.5 rounded-2xl bg-black/60 hover:bg-black/80 border border-white/10 hover:border-amber-400/50 flex items-center justify-between transition group text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl shrink-0">{lnk.emoji || '🔗'}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white group-hover:text-amber-300 transition truncate">{lnk.label}</div>
                    <div className="text-[11px] text-slate-400 font-mono truncate">{lnk.url}</div>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-amber-300 shrink-0 ml-2" />
              </button>
            ))}
          </div>
        </Tilt3DCard>
      )}
    </div>
  );
};
