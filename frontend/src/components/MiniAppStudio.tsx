import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Box, Search, Star, X } from 'lucide-react';
import {
  HabitItem,
  NoteItem,
  TodoItem,
  ToolCategory,
  UserProfile,
  apiPost,
  copyText,
} from '../lib/api';
import { Tilt3DCard } from './three/Tilt3DCard';

const CorePolyhedron3D = lazy(() =>
  import('./three/Interactive3DScenes').then((m) => ({ default: m.CorePolyhedron3D }))
);

const VisualMediaHub = lazy(() => import('./tools/VisualMediaHub').then((m) => ({ default: m.VisualMediaHub })));
const CyberDevHub = lazy(() => import('./tools/CyberDevHub').then((m) => ({ default: m.CyberDevHub })));
const CalcTextWorkspaceHub = lazy(() =>
  import('./tools/CalcTextWorkspaceHub').then((m) => ({ default: m.CalcTextWorkspaceHub }))
);
const PartyFunHub = lazy(() => import('./tools/PartyFunHub').then((m) => ({ default: m.PartyFunHub })));
const KnowledgeMegaHub = lazy(() =>
  import('./tools/KnowledgeMegaHub').then((m) => ({ default: m.KnowledgeMegaHub }))
);
const ArcadeGamesHub = lazy(() => import('./tools/ArcadeGamesHub').then((m) => ({ default: m.ArcadeGamesHub })));
const SocialDatingHub = lazy(() =>
  import('./tools/SocialDatingHub').then((m) => ({ default: m.SocialDatingHub }))
);
const HoroscopeHub = lazy(() => import('./tools/HoroscopeHub').then((m) => ({ default: m.HoroscopeHub })));
const PhysicsHub = lazy(() => import('./tools/PhysicsHub').then((m) => ({ default: m.PhysicsHub })));

interface Props {
  isNativeTma?: boolean;
  categories: ToolCategory[];
  activeCategory: string;
  activeTool: string;
  mobileDrillOpen: boolean;
  onSelectCategory: (catId: string) => void;
  onSelectTool: (catId: string, toolId: string) => void;
  onBackToCategories: () => void;
  profile: UserProfile | null;
  favorites: string[];
  onToggleFav: (toolId: string) => void;
  notes: NoteItem[];
  todos: TodoItem[];
  habits: HabitItem[];
  onRefreshWorkspace: () => void;
  onOpenPalette: () => void;
  onToast: (msg: string) => void;
}

export const MiniAppStudio: React.FC<Props> = ({
  isNativeTma = false,
  categories,
  activeCategory,
  activeTool,
  mobileDrillOpen,
  onSelectCategory,
  onSelectTool,
  onBackToCategories,
  profile,
  favorites,
  onToggleFav,
  notes,
  todos,
  habits,
  onRefreshWorkspace,
  onOpenPalette,
  onToast,
}) => {
  const [quickInput, setQuickInput] = useState('');
  const [quickRes, setQuickRes] = useState<{ kind: string; title: string; output: string } | null>(null);
  const [quickBusy, setQuickBusy] = useState(false);
  const [showMobile3D, setShowMobile3D] = useState(true);
  const topAnchorRef = useRef<HTMLDivElement>(null);

  const currentCat = categories.find((c) => c.id === activeCategory) || categories[0];

  // Scroll to top immediately when switching category or entering a section on mobile
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    topAnchorRef.current?.scrollIntoView({ block: 'start' });
  }, [activeCategory, mobileDrillOpen]);

  const runQuickBar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = quickInput.trim();
    if (!q) return;
    setQuickBusy(true);
    try {
      try {
        const u = await apiPost('/api/v2/units/smart', { query: q });
        const topConv = (u.conversions || [])
          .slice(0, 3)
          .map((c: any) => `${c.formatted} ${c.unit}`)
          .join(' • ');
        setQuickRes({
          kind: 'Конвертер величин',
          title: `${u.value} ${u.from_label}`,
          output: topConv + (u.fun_comparison ? ` (${u.fun_comparison})` : ''),
        });
        onRefreshWorkspace();
        return;
      } catch {
        // fallback to omni
      }

      const r = await apiPost('/api/tools/omni', { text: q });
      setQuickRes({ kind: r.kind, title: r.title, output: r.output });
      onRefreshWorkspace();
    } catch (err: any) {
      onToast(err.message || 'Запрос не распознан');
    } finally {
      setQuickBusy(false);
    }
  };

  const renderActiveHubInner = () => {
    if (activeCategory === 'horoscope') {
      return (
        <HoroscopeHub
          activeTool={activeTool}
          onSelectTool={(t) => onSelectTool('horoscope', t)}
          onSync={onRefreshWorkspace}
          onToast={onToast}
        />
      );
    }
    if (activeCategory === 'physics') {
      return (
        <PhysicsHub
          activeTool={activeTool}
          onSelectTool={(t) => onSelectTool('physics', t)}
          onSync={onRefreshWorkspace}
          onToast={onToast}
        />
      );
    }
    if (activeCategory === 'qr' || activeCategory === 'image' || activeCategory === 'pdf') {
      return (
        <VisualMediaHub
          activeCategory={activeCategory}
          activeTool={activeTool}
          onSelectTool={(t) => onSelectTool(activeCategory, t)}
          favorites={favorites}
          onToggleFav={onToggleFav}
          onSync={onRefreshWorkspace}
          onToast={onToast}
        />
      );
    }
    if (activeCategory === 'security' || activeCategory === 'dev') {
      return (
        <CyberDevHub
          activeCategory={activeCategory}
          activeTool={activeTool}
          onSelectTool={(t) => onSelectTool(activeCategory, t)}
          onSync={onRefreshWorkspace}
          onToast={onToast}
        />
      );
    }
    if (activeCategory === 'party') {
      return (
        <PartyFunHub
          activeTool={activeTool}
          onSelectTool={(t) => onSelectTool('party', t)}
          onSync={onRefreshWorkspace}
          onToast={onToast}
        />
      );
    }
    if (activeCategory === 'knowledge') {
      return (
        <KnowledgeMegaHub
          activeTool={activeTool}
          onSelectTool={(t) => onSelectTool('knowledge', t)}
          onSync={onRefreshWorkspace}
          onToast={onToast}
        />
      );
    }
    if (activeCategory === 'arcade') {
      return (
        <ArcadeGamesHub
          activeTool={activeTool}
          onSelectTool={(t) => onSelectTool('arcade', t)}
          onSync={onRefreshWorkspace}
          onToast={onToast}
        />
      );
    }
    if (activeCategory === 'social') {
      return (
        <SocialDatingHub
          activeTool={activeTool}
          onSelectTool={(t) => onSelectTool('social', t)}
          onSync={onRefreshWorkspace}
          onToast={onToast}
        />
      );
    }
    return (
      <CalcTextWorkspaceHub
        activeCategory={activeCategory}
        activeTool={activeTool}
        onSelectTool={(t) => onSelectTool(activeCategory, t)}
        notes={notes}
        todos={todos}
        habits={habits}
        onRefreshWorkspace={onRefreshWorkspace}
        onToast={onToast}
      />
    );
  };

  const renderActiveHub = () => (
    <Suspense
      fallback={
        <div className="p-8 rounded-2xl bg-slate-900/60 border border-white/10 text-center text-sm text-slate-400">
          Загрузка раздела...
        </div>
      }
    >
      {renderActiveHubInner()}
    </Suspense>
  );

  // Resolve favorite tool items for quick strip
  const favoriteItems = favorites
    .map((fid) => {
      for (const cat of categories) {
        const found = cat.tools.find((t) => t.id === fid);
        if (found) return { ...found, catId: cat.id };
      }
      return null;
    })
    .filter(Boolean) as { id: string; title: string; emoji: string; catId: string }[];

  return (
    <div ref={topAnchorRef} className="w-full max-w-[1440px] mx-auto px-3 sm:px-5 pt-3 pb-24 lg:pb-8 min-w-0">
      {/* =====================================================================
          DESKTOP LAYOUT (>= 1024px): Sidebar + Immediate Workspace (No Scroll)
          ===================================================================== */}
      <div className="hidden lg:grid lg:grid-cols-12 lg:gap-5 items-start">
        {/* Left Sidebar */}
        <aside className={`col-span-3 sticky ${isNativeTma ? 'top-3 max-h-[calc(100vh-1.5rem)]' : 'top-16 max-h-[calc(100vh-5rem)]'} rounded-2xl bg-slate-900/85 border border-white/10 p-3 space-y-3 overflow-y-auto`}>
          {profile && (
            <div className="px-2.5 py-2 rounded-xl bg-slate-950/80 border border-white/5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <img src="/avatar.png" alt="Logo" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">{profile.first_name}</div>
                  <div className="text-[11px] text-slate-400 truncate">
                    Ур. {profile.rank.level} • {profile.rank.xp} XP
                  </div>
                </div>
              </div>
              <button
                onClick={onOpenPalette}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
                title="Поиск по всем инструментам (Ctrl+K)"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          )}

          {categories.length > 0 && (
            <Suspense fallback={<div className="h-[235px] rounded-2xl bg-slate-950/60 border border-white/5 animate-pulse" />}>
              <CorePolyhedron3D
                categories={categories}
                activeCategory={activeCategory}
                onSelectCategory={onSelectCategory}
              />
            </Suspense>
          )}

          <div className="space-y-1">
            <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Разделы ({categories.length})
            </div>
            {categories.map((cat) => {
              const active = cat.id === activeCategory;
              return (
                <button
                  key={cat.id}
                  onClick={() => onSelectCategory(cat.id)}
                  className={`w-full px-3 py-2.5 rounded-xl text-left transition flex items-center gap-2.5 ${
                    active
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="text-base shrink-0">{cat.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs leading-snug truncate">{cat.title}</div>
                  </div>
                  <span className={`text-[10px] ${active ? 'text-indigo-200' : 'text-slate-500'}`}>
                    {cat.tools.length}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Main Content */}
        <section className="col-span-9 space-y-4 min-w-0">
          {/* Quick Bar */}
          <form
            onSubmit={runQuickBar}
            className="rounded-2xl bg-slate-900/80 border border-white/10 p-2.5 flex items-center gap-2"
          >
            <Search className="w-4 h-4 text-slate-400 ml-2 shrink-0" />
            <input
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder="Быстрый расчёт или конвертация: 75 кг в фунты, (1450 * 1.2) / 3, Ghbdtn..."
              className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
            />
            {quickInput && (
              <button
                type="button"
                onClick={() => {
                  setQuickInput('');
                  setQuickRes(null);
                }}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              disabled={quickBusy}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shrink-0"
            >
              {quickBusy ? '...' : 'Выполнить'}
            </button>
          </form>

          {quickRes && (
            <div className="p-3.5 rounded-xl bg-slate-900 border border-indigo-500/30 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <span className="text-xs text-indigo-300 font-medium">{quickRes.title}: </span>
                <span className="font-mono text-white break-all">{quickRes.output}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => copyText(quickRes.output, onToast)}
                  className="px-2.5 py-1 rounded-lg bg-white/10 text-xs text-white"
                >
                  Копировать
                </button>
                <button onClick={() => setQuickRes(null)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Active Category Header + Sub-tools */}
          {currentCat && (
            <div className="rounded-2xl bg-slate-900/80 border border-white/10 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{currentCat.emoji}</span>
                  <div>
                    <h2 className="text-lg font-bold text-white leading-tight">{currentCat.title}</h2>
                    <p className="text-xs text-slate-400">{currentCat.short}</p>
                  </div>
                </div>
                <button
                  onClick={() => onToggleFav(activeTool)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition ${
                    favorites.includes(activeTool)
                      ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  <Star className="w-3.5 h-3.5" />
                  {favorites.includes(activeTool) ? 'В избранном' : 'В избранное'}
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {currentCat.tools.map((t) => {
                  const isAct = t.id === activeTool;
                  return (
                    <button
                      key={t.id}
                      onClick={() => onSelectTool(currentCat.id, t.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition flex items-center gap-1.5 ${
                        isAct
                          ? 'bg-indigo-600 border-indigo-400 text-white'
                          : 'bg-slate-950/70 border-white/10 text-slate-300 hover:border-white/25 hover:text-white'
                      }`}
                    >
                      <span>{t.emoji}</span>
                      <span>{t.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Tool Workspace */}
          <div>{renderActiveHub()}</div>
        </section>
      </div>

      {/* =====================================================================
          MOBILE & TABLET LAYOUT (< 1024px): 2-Level Drill-Down (Zero Scroll Confusion!)
          ===================================================================== */}
      <div className="lg:hidden space-y-3">
        {!mobileDrillOpen ? (
          /* LEVEL 1: CLEAN CATEGORY DIRECTORY */
          <>
            {/* Compact Mobile Top Bar */}
            <div className="rounded-2xl bg-slate-900/90 border border-white/10 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img src="/avatar.png" alt="Logo" className="w-9 h-9 rounded-xl object-cover border border-white/15 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">MULTI_TG_TOOL</div>
                    {profile && (
                      <div className="text-[11px] text-slate-400 truncate">
                        {profile.first_name} • Ур. {profile.rank.level} ({profile.rank.xp} XP)
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowMobile3D((s) => !s)}
                    className={`px-2.5 py-2 rounded-xl border text-xs flex items-center gap-1 transition ${
                      showMobile3D
                        ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-200'
                        : 'bg-white/5 border-white/10 text-slate-300'
                    }`}
                    title="Переключить 3D-навигатор"
                  >
                    <Box className="w-3.5 h-3.5" /> 3D
                  </button>
                  <button
                    onClick={onOpenPalette}
                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200 flex items-center gap-1.5"
                  >
                    <Search className="w-3.5 h-3.5 text-indigo-400" /> Поиск
                  </button>
                </div>
              </div>

              {/* Instant Converter / Calc Bar */}
              <form onSubmit={runQuickBar} className="flex gap-1.5">
                <input
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  placeholder="Пример, величина (75 кг в фунты) или текст..."
                  className="flex-1 rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-400"
                />
                <button
                  type="submit"
                  disabled={quickBusy}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold shrink-0"
                >
                  {quickBusy ? '...' : 'ОК'}
                </button>
              </form>

              {quickRes && (
                <div className="p-2.5 rounded-xl bg-slate-950 border border-indigo-500/30 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <span className="text-indigo-300 font-medium">{quickRes.title}: </span>
                    <span className="text-white font-mono break-all">{quickRes.output}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => copyText(quickRes.output, onToast)}
                      className="px-2 py-1 rounded bg-white/10 text-white"
                    >
                      Коп.
                    </button>
                    <button onClick={() => setQuickRes(null)} className="p-1 text-slate-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Favorites Quick Strip (if any) */}
            {favoriteItems.length > 0 && (
              <div className="space-y-1.5">
                <div className="px-1 text-[11px] font-semibold text-slate-400">⭐ Избранное</div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {favoriteItems.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => onSelectTool(f.catId, f.id)}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 border border-amber-400/30 text-xs text-slate-100 whitespace-nowrap flex items-center gap-1.5 shrink-0"
                    >
                      <span>{f.emoji}</span>
                      <span>{f.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Interactive 3D / 4D Orbital Navigator */}
            {showMobile3D && categories.length > 0 && (
              <Suspense fallback={<div className="h-[215px] rounded-2xl bg-slate-950/60 border border-white/5 animate-pulse" />}>
                <CorePolyhedron3D
                  categories={categories}
                  activeCategory={activeCategory}
                  onSelectCategory={onSelectCategory}
                  compact
                />
              </Suspense>
            )}

            {/* 2-Column Category Grid with 3D Specular Tilt */}
            <div className="grid grid-cols-2 gap-2.5">
              {categories.map((cat) => (
                <Tilt3DCard
                  key={cat.id}
                  accentColor={cat.color || '#6366f1'}
                  maxTilt={9}
                  onClick={() => onSelectCategory(cat.id)}
                  className="p-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 active:scale-[0.99] border border-white/10 text-left transition flex flex-col justify-between min-h-[104px] cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-2xl">{cat.emoji}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-slate-400">
                      {cat.tools.length}
                    </span>
                  </div>
                  <div className="mt-2">
                    <div className="text-xs sm:text-sm font-bold text-white leading-snug">{cat.title}</div>
                    <div className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-tight">
                      {cat.short}
                    </div>
                  </div>
                </Tilt3DCard>
              ))}
            </div>
          </>
        ) : (
          /* LEVEL 2: IMMEDIATE TOOL VIEW AT TOP OF SCREEN */
          <div className="space-y-3 min-w-0">
            {/* Sticky Back Header + Horizontal Tool Switcher */}
            <div
              className={`sticky ${isNativeTma ? 'top-0' : 'top-12'} z-20 -mx-3 px-3 py-2.5 bg-[#080c16]/95 backdrop-blur-md border-b border-white/10 space-y-2`}
            >
              <div className="flex items-center justify-between gap-2 min-w-0">
                <button
                  type="button"
                  onClick={onBackToCategories}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white flex items-center gap-1.5 shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" /> Разделы
                </button>
                {currentCat && (
                  <div className="text-xs sm:text-sm font-bold text-white truncate min-w-0">
                    {currentCat.emoji} {currentCat.title}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onToggleFav(activeTool)}
                  className={`p-2 rounded-xl border transition shrink-0 ${
                    favorites.includes(activeTool)
                      ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                      : 'bg-white/5 border-white/10 text-slate-400'
                  }`}
                  title="В избранное"
                >
                  <Star className="w-4 h-4" />
                </button>
              </div>

              {currentCat && currentCat.tools.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                  {currentCat.tools.map((t) => {
                    const isAct = t.id === activeTool;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onSelectTool(currentCat.id, t.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition shrink-0 ${
                          isAct
                            ? 'bg-indigo-600 border-indigo-400 text-white'
                            : 'bg-slate-900 border-white/10 text-slate-300'
                        }`}
                      >
                        {t.emoji} {t.title}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Active Tool Immediately Visible */}
            <div className="min-w-0">{renderActiveHub()}</div>
          </div>
        )}

        {/* Mobile Bottom Navigation Bar */}
        <nav className="fixed bottom-0 inset-x-0 z-30 bg-[#0a101f]/95 backdrop-blur-lg border-t border-white/10 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] grid grid-cols-5 gap-1">
          <button
            onClick={onBackToCategories}
            className={`py-1 rounded-xl flex flex-col items-center justify-center text-[10px] font-medium transition ${
              !mobileDrillOpen ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400'
            }`}
          >
            <span className="text-base leading-none">🗂️</span>
            <span className="mt-0.5">Разделы</span>
          </button>
          <button
            onClick={() => onSelectCategory('horoscope')}
            className={`py-1 rounded-xl flex flex-col items-center justify-center text-[10px] font-medium transition ${
              mobileDrillOpen && activeCategory === 'horoscope' ? 'text-purple-300 bg-purple-500/15' : 'text-slate-400'
            }`}
          >
            <span className="text-base leading-none">🌟</span>
            <span className="mt-0.5">Гороскоп</span>
          </button>
          <button
            onClick={() => onSelectCategory('physics')}
            className={`py-1 rounded-xl flex flex-col items-center justify-center text-[10px] font-medium transition ${
              mobileDrillOpen && activeCategory === 'physics' ? 'text-sky-300 bg-sky-500/15' : 'text-slate-400'
            }`}
          >
            <span className="text-base leading-none">⚛️</span>
            <span className="mt-0.5">Физика</span>
          </button>
          <button
            onClick={() => onSelectCategory('workspace')}
            className={`py-1 rounded-xl flex flex-col items-center justify-center text-[10px] font-medium transition ${
              mobileDrillOpen && activeCategory === 'workspace' ? 'text-emerald-300 bg-emerald-500/15' : 'text-slate-400'
            }`}
          >
            <span className="text-base leading-none">✅</span>
            <span className="mt-0.5">Привычки</span>
          </button>
          <button
            onClick={onOpenPalette}
            className="py-1 rounded-xl flex flex-col items-center justify-center text-[10px] font-medium text-slate-400 active:text-white"
          >
            <span className="text-base leading-none">🔍</span>
            <span className="mt-0.5">Поиск</span>
          </button>
        </nav>
      </div>
    </div>
  );
};
