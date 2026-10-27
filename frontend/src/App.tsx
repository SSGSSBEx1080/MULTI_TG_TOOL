import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Columns2,
  LayoutGrid,
  MessageSquareCode,
  Search,
  Settings2,
} from 'lucide-react';
import {
  HabitItem,
  NoteItem,
  TodoItem,
  ToolCategory,
  UserProfile,
  apiGet,
  apiPost,
  getTelegramWebApp,
  isInsideTelegram,
} from './lib/api';
import { GamepiadaPromoBanner, MiniAppStudio } from './components/MiniAppStudio';
import { CommandPalette } from './components/CommandPalette';

const TelegramSimulator = lazy(() =>
  import('./components/TelegramSimulator').then((m) => ({ default: m.TelegramSimulator }))
);
const AdminControlHub = lazy(() =>
  import('./components/AdminControlHub').then((m) => ({ default: m.AdminControlHub }))
);

type ViewMode = 'miniapp' | 'split' | 'bot' | 'admin';

const SIDEBAR_SEED_KEY = 'mtt_sidebar_seed_v1';
const LOCAL_CAT_USAGE_KEY = 'mtt_cat_usage_v1';

function getOrCreateSidebarSeed(): number {
  try {
    const raw = localStorage.getItem(SIDEBAR_SEED_KEY);
    if (raw) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    const created = Math.floor(Math.random() * 2147483640) + 17;
    localStorage.setItem(SIDEBAR_SEED_KEY, String(created));
    return created;
  } catch {
    return 94827163;
  }
}

function readLocalCatUsage(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LOCAL_CAT_USAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function hashCatSeed(seed: number, catId: string): number {
  let h = seed >>> 0;
  for (let i = 0; i < catId.length; i++) {
    h = Math.imul(h ^ catId.charCodeAt(i), 2654435761);
  }
  h ^= h >>> 16;
  return h >>> 0;
}

export const App: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const params = new URLSearchParams(window.location.search);
  const startParam =
    params.get('tool') ||
    params.get('tgWebAppStartParam') ||
    getTelegramWebApp()?.initDataUnsafe?.start_param ||
    '';
  const isNativeTma = Boolean(params.get('tma') === '1' || isInsideTelegram());

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const modeParam = params.get('mode');
    if (modeParam === 'bot' || modeParam === 'split' || modeParam === 'admin') {
      return modeParam;
    }
    return 'miniapp';
  });

  const [categories, setCategories] = useState<ToolCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>(startParam || 'horoscope');
  const [activeTool, setActiveTool] = useState<string>('daily_horoscope');
  // On mobile: open directly into section only if deep-linked via ?tool= / startapp, otherwise show clean section grid
  const [mobileDrillOpen, setMobileDrillOpen] = useState<boolean>(Boolean(startParam));

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [habits, setHabits] = useState<HabitItem[]>([]);
  const [sidebarSeed] = useState<number>(() => getOrCreateSidebarSeed());
  const [serverCatUsage, setServerCatUsage] = useState<Record<string, number>>({});
  const [localCatUsage, setLocalCatUsage] = useState<Record<string, number>>(() => readLocalCatUsage());

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const bumpCategoryUsage = useCallback((catId: string) => {
    setLocalCatUsage((prev) => {
      const next = { ...prev, [catId]: (prev[catId] || 0) + 1 };
      try {
        localStorage.setItem(LOCAL_CAT_USAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage quota
      }
      return next;
    });
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // Subtle GPU-only mouse 3D parallax (updates CSS vars without React re-renders)
  useEffect(() => {
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = rootRef.current;
        if (!el) return;
        const nx = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
        const ny = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
        el.style.setProperty('--px', nx.toFixed(3));
        el.style.setProperty('--py', ny.toFixed(3));
      });
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const loadWorkspace = useCallback(async () => {
    try {
      const ws = await apiGet('/api/workspace/state');
      setProfile(ws.profile);
      setFavorites(ws.favorites || []);
      setNotes(ws.notes || []);
      setTodos(ws.todos || []);
      setHabits(ws.habits || []);
      if (ws.category_usage && typeof ws.category_usage === 'object') {
        setServerCatUsage(ws.category_usage);
      }
    } catch {
      // ignore transient startup
    }
  }, []);

  const combinedCatUsage = useMemo(() => {
    const out: Record<string, number> = { ...serverCatUsage };
    for (const [k, v] of Object.entries(localCatUsage)) {
      out[k] = (out[k] || 0) + v;
    }
    return out;
  }, [serverCatUsage, localCatUsage]);

  // Per-user randomized sidebar order that rises upward the more a category is used
  const orderedCategories = useMemo(() => {
    if (categories.length === 0) return [];
    const uidSalt = (profile?.user_id || 0) ^ sidebarSeed;
    return [...categories].sort((a, b) => {
      const ua = combinedCatUsage[a.id] || 0;
      const ub = combinedCatUsage[b.id] || 0;
      if (ub !== ua) return ub - ua;
      return hashCatSeed(uidSalt, a.id) - hashCatSeed(uidSalt, b.id);
    });
  }, [categories, combinedCatUsage, profile?.user_id, sidebarSeed]);

  useEffect(() => {
    try {
      const tg = getTelegramWebApp();
      tg?.ready?.();
      tg?.expand?.();
      tg?.setHeaderColor?.('#060913');
      tg?.setBackgroundColor?.('#060913');
    } catch {
      // ignore
    }
    apiGet('/api/tools/catalog')
      .then((res) => {
        const cats: ToolCategory[] = res.categories || [];
        setCategories(cats);
        if (cats.length > 0) {
          if (startParam) {
            const byCat = cats.find((c) => c.id === startParam);
            if (byCat) {
              setActiveCategory(byCat.id);
              if (byCat.tools[0]) setActiveTool(byCat.tools[0].id);
              return;
            }
            for (const cat of cats) {
              const matchedTool = cat.tools.find((t) => t.id === startParam);
              if (matchedTool) {
                setActiveCategory(cat.id);
                setActiveTool(matchedTool.id);
                return;
              }
            }
          }
          // Default to user's top / personalized first category
          const localUsage = readLocalCatUsage();
          const sorted = [...cats].sort((a, b) => {
            const ua = localUsage[a.id] || 0;
            const ub = localUsage[b.id] || 0;
            if (ub !== ua) return ub - ua;
            return hashCatSeed(sidebarSeed, a.id) - hashCatSeed(sidebarSeed, b.id);
          });
          setActiveCategory(sorted[0].id);
          if (sorted[0].tools[0]) setActiveTool(sorted[0].tools[0].id);
        }
      })
      .catch(() => {});
    loadWorkspace();
  }, [loadWorkspace]);

  // Single unified native Telegram WebApp BackButton handler
  useEffect(() => {
    try {
      const tg = getTelegramWebApp();
      const backBtn = tg?.BackButton;
      if (!backBtn) return;

      const shouldShow =
        paletteOpen || viewMode !== 'miniapp' || (mobileDrillOpen && window.innerWidth < 1024);

      const onBack = () => {
        if (paletteOpen) {
          setPaletteOpen(false);
        } else if (viewMode !== 'miniapp') {
          setViewMode('miniapp');
        } else {
          setMobileDrillOpen(false);
        }
      };

      if (shouldShow) {
        backBtn.show?.();
        backBtn.onClick?.(onBack);
        return () => {
          try {
            backBtn.offClick?.(onBack);
          } catch {
            // ignore
          }
        };
      } else {
        backBtn.hide?.();
      }
    } catch {
      // ignore outside Telegram
    }
  }, [mobileDrillOpen, paletteOpen, viewMode]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((p) => !p);
      } else if (e.key === 'Escape') {
        setPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleToggleFav = async (toolId: string) => {
    try {
      const res = await apiPost('/api/workspace/favorites/toggle', { tool_id: toolId });
      setFavorites(res.favorites || []);
      showToast(res.added ? 'Добавлено в избранное' : 'Удалено из избранного');
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const handleSelectCategory = (catId: string) => {
    setActiveCategory(catId);
    bumpCategoryUsage(catId);
    const cat = categories.find((c) => c.id === catId);
    if (cat?.tools[0]) {
      setActiveTool(cat.tools[0].id);
    }
    setMobileDrillOpen(true);
    if (viewMode === 'bot' || viewMode === 'admin') {
      setViewMode('miniapp');
    }
  };

  const handleSelectTool = (catId: string, toolId: string) => {
    setActiveCategory(catId);
    setActiveTool(toolId);
    bumpCategoryUsage(catId);
    setMobileDrillOpen(true);
    if (viewMode === 'bot' || viewMode === 'admin') {
      setViewMode('miniapp');
    }
  };

  const handleOpenMiniAppFromSim = (tab?: string) => {
    if (tab) {
      const foundCat = categories.find((c) => c.id === tab);
      if (foundCat) {
        setActiveCategory(foundCat.id);
        if (foundCat.tools[0]) setActiveTool(foundCat.tools[0].id);
        setMobileDrillOpen(true);
      } else {
        for (const cat of categories) {
          const foundTool = cat.tools.find((t) => t.id === tab);
          if (foundTool) {
            setActiveCategory(cat.id);
            setActiveTool(foundTool.id);
            setMobileDrillOpen(true);
            break;
          }
        }
      }
    }
    if (viewMode === 'bot') {
      setViewMode('miniapp');
    }
  };

  // Dynamic ambient aurora colors matched to current category / universe tool
  const activeCatObj = categories.find((c) => c.id === activeCategory);
  const primaryGlow =
    activeCategory === 'universes'
      ? activeTool === 'dc_checklist'
        ? '#198cff'
        : activeTool === 'zitraksmode_wiki'
        ? '#22c55e'
        : '#e23636'
      : activeCatObj?.color || '#6366f1';
  const secondaryGlow =
    activeCategory === 'universes'
      ? activeTool === 'dc_checklist'
        ? '#f7c948'
        : activeTool === 'zitraksmode_wiki'
        ? '#eab308'
        : '#38bdf8'
      : '#38bdf8';

  return (
    <div
      ref={rootRef}
      className="relative min-h-screen flex flex-col bg-[#060913] text-slate-100 overflow-x-clip"
      style={
        {
          '--accent-primary': primaryGlow,
          '--accent-secondary': secondaryGlow,
        } as React.CSSProperties
      }
    >
      {/* Multi-layered GPU-accelerated 3D Parallax Ambient Aurora + Cyber-Grid Backdrop */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="parallax-layer-deep absolute inset-0">
          <div
            className="aurora-blob-a absolute -top-28 -left-24 w-[62vw] max-w-[680px] h-[52vh] max-h-[540px] rounded-full blur-[110px] opacity-25 transition-colors duration-700"
            style={{ backgroundColor: primaryGlow }}
          />
          <div
            className="aurora-blob-b absolute -bottom-32 -right-20 w-[58vw] max-w-[640px] h-[48vh] max-h-[500px] rounded-full blur-[120px] opacity-20 transition-colors duration-700"
            style={{ backgroundColor: secondaryGlow }}
          />
        </div>
        <div className="cyber-grid-bg parallax-layer-mid absolute inset-0" />
      </div>

      {/* Top Browser Shell (Hidden inside native Telegram WebApp) */}
      {!isNativeTma && (
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070b17]/88 backdrop-blur-xl">
          <div className="max-w-[1680px] mx-auto px-3 sm:px-4 h-12 sm:h-13 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setViewMode('miniapp');
                setMobileDrillOpen(false);
              }}
              className="flex items-center gap-2 text-left min-w-0 shrink-0 group"
            >
              <img
                src="/avatar.png"
                alt="MULTI_TG_TOOL"
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl object-cover border border-white/20 shrink-0 group-hover:scale-105 transition"
              />
              <div className="min-w-0">
                <div className="font-display font-bold text-xs sm:text-sm text-white leading-none truncate tracking-tight">
                  MULTI_TG_TOOL
                </div>
                <div className="hidden xs:block sm:block text-[10px] sm:text-[11px] font-mono text-slate-400 mt-0.5 truncate">
                  @multi_tg_bot
                </div>
              </div>
            </button>

            <div className="flex items-center gap-0.5 sm:gap-1 p-1 rounded-xl bg-slate-950/90 border border-white/10 shrink-0">
              {[
                { id: 'miniapp', label: 'Приложение', shortLabel: 'Утилиты', icon: LayoutGrid, hideMobile: false },
                { id: 'bot', label: 'Чат-бот', shortLabel: 'Бот', icon: MessageSquareCode, hideMobile: false },
                { id: 'split', label: '2 экрана', shortLabel: '2 экрана', icon: Columns2, hideMobile: true },
                { id: 'admin', label: 'Статус', shortLabel: 'Статус', icon: Settings2, hideMobile: false },
              ].map((m) => {
                const Icon = m.icon;
                const active = viewMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setViewMode(m.id as ViewMode)}
                    className={`${m.hideMobile ? 'hidden xl:flex' : 'flex'} items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition ${
                      active
                        ? 'glow-btn text-white font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">{m.label}</span>
                    <span className="sm:hidden">{m.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/85 hover:bg-slate-800 border border-white/10 text-xs text-slate-300 transition shrink-0"
            >
              <Search className="w-3.5 h-3.5 text-indigo-400" />
              <span>Поиск инструмента</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-950 border border-white/10 text-[10px] font-mono text-slate-400">
                Ctrl+K
              </kbd>
            </button>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="relative z-10 flex-1 min-w-0">
        {viewMode !== 'admin' && viewMode !== 'bot' && !mobileDrillOpen && (
          <div className="mx-auto max-w-[1440px] px-3 pt-3 sm:px-5 sm:pt-4">
            <GamepiadaPromoBanner />
          </div>
        )}
        <Suspense
          fallback={
            <div className="max-w-xl mx-auto mt-10 p-8 rounded-2xl bg-slate-900/60 border border-white/10 text-center text-sm text-slate-400">
              Загрузка...
            </div>
          }
        >
          {viewMode === 'split' && (
            <div className="max-w-[1680px] mx-auto px-4 py-4 grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
              <div className="xl:col-span-4 xl:sticky xl:top-16 h-[calc(100vh-5.5rem)] min-h-[600px] min-w-0">
                <TelegramSimulator
                  onOpenMiniAppTool={handleOpenMiniAppFromSim}
                  onWorkspaceSync={loadWorkspace}
                  onToast={showToast}
                />
              </div>
              <div className="xl:col-span-8 min-w-0">
                <MiniAppStudio
                  isNativeTma={isNativeTma}
                  categories={orderedCategories}
                  categoryUsage={combinedCatUsage}
                  activeCategory={activeCategory}
                  activeTool={activeTool}
                  mobileDrillOpen={mobileDrillOpen}
                  onSelectCategory={handleSelectCategory}
                  onSelectTool={handleSelectTool}
                  onBackToCategories={() => setMobileDrillOpen(false)}
                  profile={profile}
                  favorites={favorites}
                  onToggleFav={handleToggleFav}
                  notes={notes}
                  todos={todos}
                  habits={habits}
                  onRefreshWorkspace={loadWorkspace}
                  onOpenPalette={() => setPaletteOpen(true)}
                  onToast={showToast}
                />
              </div>
            </div>
          )}

          {viewMode === 'bot' && (
            <div className="max-w-lg mx-auto px-2.5 sm:px-3 py-3 sm:py-4 h-[calc(100vh-3.75rem)] min-h-[520px]">
              <TelegramSimulator
                onOpenMiniAppTool={handleOpenMiniAppFromSim}
                onWorkspaceSync={loadWorkspace}
                onToast={showToast}
              />
            </div>
          )}

          {viewMode === 'miniapp' && (
            <MiniAppStudio
              isNativeTma={isNativeTma}
              categories={orderedCategories}
              categoryUsage={combinedCatUsage}
              activeCategory={activeCategory}
              activeTool={activeTool}
              mobileDrillOpen={mobileDrillOpen}
              onSelectCategory={handleSelectCategory}
              onSelectTool={handleSelectTool}
              onBackToCategories={() => setMobileDrillOpen(false)}
              profile={profile}
              favorites={favorites}
              onToggleFav={handleToggleFav}
              notes={notes}
              todos={todos}
              habits={habits}
              onRefreshWorkspace={loadWorkspace}
              onOpenPalette={() => setPaletteOpen(true)}
              onToast={showToast}
            />
          )}

          {viewMode === 'admin' && (
            <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-5 pb-20 lg:pb-8">
              <AdminControlHub categories={orderedCategories} onToast={showToast} />
            </div>
          )}
        </Suspense>
      </main>

      {/* Command Palette */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        categories={orderedCategories}
        onSelectTool={(c, t) => {
          handleSelectTool(c, t);
          setPaletteOpen(false);
        }}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="pointer-events-none fixed bottom-20 lg:bottom-5 right-3 left-3 sm:left-auto z-50 px-4 py-2.5 rounded-xl bg-slate-900/95 border border-indigo-400/40 text-xs text-white shadow-2xl flex items-center gap-2 max-w-md">
          <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
          <span className="break-words">{toast}</span>
        </div>
      )}
    </div>
  );
};
