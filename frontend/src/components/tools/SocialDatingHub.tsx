import React, { useEffect, useState } from 'react';
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
import { apiGet, apiPost, copyText } from '../../lib/api';

interface Props {
  activeTool: string;
  onSelectTool: (t: string) => void;
  onSync: () => void;
  onToast: (msg: string) => void;
}

export const SocialDatingHub: React.FC<Props> = ({ activeTool, onSelectTool, onSync, onToast }) => {
  const [subTab, setSubTab] = useState<'top' | 'altushka' | 'bibinto' | 'turing' | 'anon' | 'author'>('top');

  // --- Leaderboard & Public Profile ---
  const [sortBy, setSortBy] = useState<'xp' | 'games' | 'views' | 'respects' | 'tools'>('xp');
  const [leaders, setLeaders] = useState<any[]>([]);
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

  // --- Author Links (QLS СЕНЯ) ---
  const [authorInfo, setAuthorInfo] = useState<any>(null);
  const [editingAuthor, setEditingAuthor] = useState(false);

  useEffect(() => {
    if (activeTool === 'leaderboard_hub') setSubTab('top');
    else if (activeTool === 'altushka_chat') setSubTab('altushka');
    else if (activeTool === 'bibinto_rate') setSubTab('bibinto');
    else if (activeTool === 'turing_game') setSubTab('turing');
    else if (activeTool === 'anon_chat') setSubTab('anon');
    else if (activeTool === 'author_links') setSubTab('author');
  }, [activeTool]);

  const loadLeaders = (s = sortBy) => {
    apiGet(`/api/v2/social/leaderboard?sort_by=${s}`).then((r) => setLeaders(r.users || []));
  };

  const openUserProfile = async (uid: number) => {
    try {
      const p = await apiGet(`/api/v2/social/profile/${uid}`);
      setSelectedProfile(p);
      loadLeaders(sortBy);
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

  // Load initial data
  useEffect(() => {
    loadLeaders('xp');
    apiGet('/api/v2/social/altushka').then((r) => {
      const list = r.personas || [];
      setPersonas(list);
      if (list[0]) {
        setActivePersona(list[0]);
        setAltMessages([{ from: 'girl', text: list[0].greeting, mood: 'онлайн 🖤' }]);
      }
    });
    apiGet('/api/v2/social/bibinto').then((r) => setBibintoProfiles(r.profiles || []));
    apiGet('/api/v2/social/turing').then(setTuringRound);
    apiGet('/api/v2/social/anon?room=global').then((r) => setAnonMsgs(r.messages || []));
    apiGet('/api/v2/author').then(setAuthorInfo);
  }, []);

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

  const createBibintoCard = async () => {
    if (!newBibName.trim()) return;
    try {
      const r = await apiPost('/api/v2/social/bibinto/create', {
        display_name: newBibName,
        age: newBibAge,
        city: newBibCity,
        vibe: newBibVibe,
        bio: newBibBio || 'Участник NEXUS Studio',
        avatar_style: '⚡',
      });
      setBibintoProfiles(r.profiles || []);
      setShowCreateBib(false);
      setBibIdx(0);
      onToast('Ваша карточка опубликована в Bibinto! 💎');
    } catch (e: any) {
      onToast(e.message);
    }
  };

  const guessTuring = async (guess: 'human' | 'ai') => {
    if (!turingRound || turingVerdict) return;
    const r = await apiPost('/api/v2/social/turing', { round_id: turingRound.id, guess });
    setTuringVerdict(r);
    setTuringScore((s) => ({ right: s.right + (r.correct ? 1 : 0), total: s.total + 1 }));
    setSeenRounds((prev) => [...prev.slice(-8), turingRound.id]);
    onSync();
  };

  const nextTuring = async () => {
    setTuringVerdict(null);
    const r = await apiGet(`/api/v2/social/turing?exclude=${seenRounds.join(',')}`);
    setTuringRound(r);
  };

  const switchAnonRoom = async (room: string) => {
    setAnonRoom(room);
    const r = await apiGet(`/api/v2/social/anon?room=${room}`);
    setAnonMsgs(r.messages || []);
  };

  const sendAnon = async () => {
    if (!anonInput.trim()) return;
    const r = await apiPost('/api/v2/social/anon', { text: anonInput, room: anonRoom });
    setAnonMsgs(r.messages || []);
    setAnonInput('');
    onSync();
  };

  const saveAuthor = async () => {
    if (!authorInfo) return;
    const saved = await apiPost('/api/v2/author', authorInfo);
    setAuthorInfo(saved);
    setEditingAuthor(false);
    onToast('Витрина автора сохранена! 🎬');
  };

  const currentBib = bibintoProfiles[bibIdx % Math.max(1, bibintoProfiles.length)];

  return (
    <div className="space-y-5">
      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'top', tool: 'leaderboard_hub', label: '🏆 Топ Игроков & Визиты Профилей' },
          { id: 'altushka', tool: 'altushka_chat', label: '🖤 Альтушки 18+ (Дейтинг-Чат)' },
          { id: 'bibinto', tool: 'bibinto_rate', label: '💎 Bibinto (Оцени 1–10)' },
          { id: 'turing', tool: 'turing_game', label: '🤖 Человек или ИИ?' },
          { id: 'anon', tool: 'anon_chat', label: '🎭 Анонимный Чат' },
          { id: 'author', tool: 'author_links', label: '🎬 Автор: QLS СЕНЯ' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setSubTab(t.id as any);
              onSelectTool(t.tool);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
              subTab === t.id
                ? 'bg-rose-500/25 border-rose-400/60 text-rose-200 shadow-lg shadow-rose-500/10'
                : 'bg-slate-900/60 border-white/10 text-slate-300 hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

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
                <div className="flex gap-2">
                  <input
                    value={myEmoji}
                    onChange={(e) => setMyEmoji(e.target.value)}
                    maxLength={4}
                    placeholder="⚡"
                    className="w-16 rounded-lg bg-slate-900 border border-white/10 px-2.5 py-1.5 text-center text-base"
                  />
                  <input
                    value={myBio}
                    onChange={(e) => setMyBio(e.target.value)}
                    placeholder="Напишите статус / биографию своего профиля..."
                    className="flex-1 rounded-lg bg-slate-900 border border-white/10 px-3 py-1.5 text-white"
                  />
                  <button onClick={saveMyProfile} className="px-4 py-1.5 rounded-lg bg-sky-500 text-slate-950 font-bold">
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
              {leaders.map((u) => (
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
                    <div className="text-xl shrink-0">{u.avatar_emoji || '⚡'}</div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-white truncate">
                        {u.first_name} <span className="text-slate-500 font-normal">@{u.username}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">{u.rank_title}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono shrink-0">
                    <span className="text-sky-300" title="Опыт XP">{u.xp} XP</span>
                    <span className="text-emerald-300 hidden sm:inline" title="Рекорд в аркаде">🎮 {u.best_game_score}</span>
                    <span className="text-purple-300 flex items-center gap-1" title="Заходов на профиль">
                      <Eye className="w-3.5 h-3.5" /> {u.profile_views}
                    </span>
                    <span className="text-orange-300" title="Респекты">🔥 {u.respects}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Detailed Profile Inspector */}
          <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-slate-900/75 p-5 flex flex-col justify-between">
            {selectedProfile ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500/30 to-purple-600/30 border border-white/15 flex items-center justify-center text-3xl">
                      {selectedProfile.avatar_emoji || '⚡'}
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-white">{selectedProfile.first_name}</h4>
                      <div className="text-xs text-slate-400">@{selectedProfile.username}</div>
                      <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                        {selectedProfile.rank_title}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => sendRespect(selectedProfile.user_id)}
                    className="px-3 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-lg"
                  >
                    <Flame className="w-4 h-4" /> Респект ({selectedProfile.respects})
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/90 border border-white/10 text-xs text-slate-200 italic">
                  «{selectedProfile.bio || 'Исследователь мульти-инструментов NEXUS'}»
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
                        <span className="text-slate-300">{g.game_id}</span>
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
          </div>
        </div>
      )}

      {/* 2. ALTUSHKA 18+ DATING CHAT */}
      {subTab === 'altushka' && activePersona && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 rounded-2xl border border-white/10 bg-slate-900/75 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">🖤 Выбери Альтушку (18+)</h3>
              <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-400/30">18+ Roleplay</span>
            </div>
            <div className="space-y-2">
              {personas.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectPersona(p)}
                  className={`w-full p-3 rounded-xl border text-left transition ${
                    activePersona.id === p.id
                      ? 'bg-rose-500/20 border-rose-400/60'
                      : 'bg-slate-950/80 border-white/10 hover:bg-slate-950'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">{p.emoji} {p.name}, {p.age}</span>
                    <span className="text-[10px] text-rose-300">Онлайн</span>
                  </div>
                  <div className="text-[11px] text-purple-300 mt-0.5">{p.archetype}</div>
                  <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">{p.style}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 rounded-2xl border border-rose-400/30 bg-slate-900/80 p-5 flex flex-col justify-between space-y-4">
            {/* Affection Bar */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-white/10 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="font-bold text-white">
                  {activePersona.emoji} {activePersona.name} ({activePersona.age} лет) — <span className="text-rose-300">{statusTitle}</span>
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
              <h3 className="text-base font-bold text-white">💎 Bibinto NEXUS — Оцени Анкету и Вайб от 1 до 10</h3>
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

          <div className="space-y-2.5 max-h-80 overflow-y-auto p-3 rounded-xl bg-slate-950 border border-white/10">
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
              placeholder="Написать анонимное сообщение под крипто-маской..."
              className="flex-1 rounded-xl bg-slate-950 border border-white/10 px-4 py-2.5 text-xs sm:text-sm text-white"
            />
            <button onClick={sendAnon} className="px-4 py-2.5 rounded-xl bg-purple-500 text-slate-950 font-bold text-xs flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5" /> В эфир
            </button>
          </div>
        </div>
      )}

      {/* 6. AUTHOR SHOWCASE: QLS СЕНЯ */}
      {subTab === 'author' && authorInfo && (
        <div className="max-w-2xl mx-auto rounded-3xl border border-amber-400/35 bg-gradient-to-br from-[#171226] via-[#0e1526] to-[#1a1122] p-6 shadow-2xl space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-rose-500 to-purple-600 flex items-center justify-center text-3xl shadow-lg">
                🎬
              </div>
              <div>
                <h3 className="text-xl font-black text-white">{authorInfo.title}</h3>
                <div className="text-xs text-amber-300 font-medium">{authorInfo.tagline}</div>
              </div>
            </div>
            <button
              onClick={() => setEditingAuthor(!editingAuthor)}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-slate-200"
            >
              {editingAuthor ? 'Отмена' : '✏️ Изменить ссылки'}
            </button>
          </div>

          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">{authorInfo.bio}</p>

          {!editingAuthor ? (
            <div className="space-y-2.5">
              {(authorInfo.links || []).map((lnk: any, i: number) => (
                <a
                  key={i}
                  href={lnk.url}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full p-3.5 rounded-2xl bg-slate-950/90 hover:bg-slate-950 border border-white/10 hover:border-amber-400/50 flex items-center justify-between transition group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{lnk.emoji || '🔗'}</span>
                    <div>
                      <div className="text-sm font-bold text-white group-hover:text-amber-300 transition">{lnk.label}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{lnk.url}</div>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-amber-300" />
                </a>
              ))}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-400/25 text-xs text-amber-200 text-center">
                💎 {authorInfo.donation_note}
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-xs p-4 rounded-2xl bg-slate-950 border border-white/10">
              <input
                value={authorInfo.title}
                onChange={(e) => setAuthorInfo({ ...authorInfo, title: e.target.value })}
                className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-white font-bold"
              />
              <textarea
                rows={2}
                value={authorInfo.bio}
                onChange={(e) => setAuthorInfo({ ...authorInfo, bio: e.target.value })}
                className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-white"
              />
              {(authorInfo.links || []).map((lnk: any, idx: number) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    value={lnk.label}
                    onChange={(e) => {
                      const next = [...authorInfo.links];
                      next[idx] = { ...next[idx], label: e.target.value };
                      setAuthorInfo({ ...authorInfo, links: next });
                    }}
                    className="rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-white"
                  />
                  <input
                    value={lnk.url}
                    onChange={(e) => {
                      const next = [...authorInfo.links];
                      next[idx] = { ...next[idx], url: e.target.value };
                      setAuthorInfo({ ...authorInfo, links: next });
                    }}
                    className="rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-sky-300 font-mono"
                  />
                </div>
              ))}
              <button onClick={saveAuthor} className="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold">
                💾 Сохранить ссылки автора
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
