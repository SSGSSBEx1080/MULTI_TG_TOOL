import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
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
import { MiniAppStudio } from './components/MiniAppStudio';
import { CommandPalette } from './components/CommandPalette';

const TelegramSimulator = lazy(() =>
  import('./components/TelegramSimulator').then((m) => ({ default: m.TelegramSimulator }))
);
const AdminControlHub = lazy(() =>
  import('./components/AdminControlHub').then((m) => ({ default: m.AdminControlHub }))
);

type ViewMode = 'miniapp' | 'split' | 'bot' | 'admin';

export const App: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const initialToolParam = params.get('tool') || '';
  const isNativeTma = Boolean(params.get('tma') === '1' || isInsideTelegram());

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const modeParam = params.get('mode');
    if (modeParam === 'bot' || modeParam === 'split' || modeParam === 'admin') {
      return modeParam;
    }
    return 'miniapp';
  });

  const [categories, setCategories] = useState<ToolCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>(initialToolParam || 'horoscope');
  const [activeTool, setActiveTool] = useState<string>('daily_horoscope');
  // On mobile: open directly into section only if deep-linked via ?tool=..., otherwise show clean section grid
  const [mobileDrillOpen, setMobileDrillOpen] = useState<boolean>(Boolean(initialToolParam));

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [habits, setHabits] = useState<HabitItem[]>([]);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const loadWorkspace = useCallback(async () => {
    try {
      const ws = await apiGet('/api/workspace/state');
      setProfile(ws.profile);
      setFavorites(ws.favorites || []);
      setNotes(ws.notes || []);
      setTodos(ws.todos || []);
      setHabits(ws.habits || []);
    } catch {
      // ignore transient startup
    }
  }, []);

  useEffect(() => {
    try {
      const tg = getTelegramWebApp();
      tg?.ready?.();
      tg?.expand?.();
    } catch {
      // ignore
    }
    apiGet('/api/tools/catalog')
      .then((res) => {
        const cats: ToolCategory[] = res.categories || [];
        setCategories(cats);
        if (cats.length > 0) {
          const targetCat = cats.find((c) => c.id === (initialToolParam || activeCategory)) || cats[0];
          setActiveCategory(targetCat.id);
          if (targetCat.tools[0]) {
            setActiveTool(targetCat.tools[0].id);
          }
        }
      })
      .catch(() => {});
    loadWorkspace();
  }, [loadWorkspace]);

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
    setMobileDrillOpen(true);
    if (viewMode === 'bot' || viewMode === 'admin') {
      setViewMode('miniapp');
    }
  };

  const handleOpenMiniAppFromSim = (tab?: string) => {
    if (tab) {
      const found = categories.find((c) => c.id === tab);
      if (found) {
        setActiveCategory(found.id);
        if (found.tools[0]) setActiveTool(found.tools[0].id);
        setMobileDrillOpen(true);
      }
    }
    if (viewMode === 'bot') {
      setViewMode('miniapp');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#080c16] text-slate-100">
      {/* Top Browser Shell (Hidden inside native Telegram WebApp) */}
      {!isNativeTma && (
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a101f]/95 backdrop-blur-xl">
          <div className="max-w-[1680px] mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => {
                setViewMode('miniapp');
                setMobileDrillOpen(false);
              }}
              className="flex items-center gap-2.5 text-left"
            >
              <img
                src="/avatar.png"
                alt="MULTI_TG_TOOL"
                className="w-8 h-8 rounded-xl object-cover border border-white/15"
              />
              <div>
                <div className="font-bold text-sm text-white leading-none">MULTI_TG_TOOL</div>
                <div className="text-[11px] text-slate-400 mt-0.5">@multi_tg_bot</div>
              </div>
            </button>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950/90 border border-white/10">
              {[
                { id: 'miniapp', label: 'Приложение', icon: LayoutGrid, hideMobile: false },
                { id: 'bot', label: 'Чат-бот', icon: MessageSquareCode, hideMobile: false },
                { id: 'split', label: '2 экрана', icon: Columns2, hideMobile: true },
                { id: 'admin', label: 'Статус', icon: Settings2, hideMobile: false },
              ].map((m) => {
                const Icon = m.icon;
                const active = viewMode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setViewMode(m.id as ViewMode)}
                    className={`${m.hideMobile ? 'hidden xl:flex' : 'flex'} items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      active
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs text-slate-300 transition"
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
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="max-w-xl mx-auto mt-10 p-8 rounded-2xl bg-slate-900/60 border border-white/10 text-center text-sm text-slate-400">
              Загрузка...
            </div>
          }
        >
        {viewMode === 'split' && (
          <div className="max-w-[1680px] mx-auto px-4 py-4 grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            <div className="xl:col-span-4 xl:sticky xl:top-16 h-[calc(100vh-5.5rem)] min-h-[600px]">
              <TelegramSimulator
                onOpenMiniAppTool={handleOpenMiniAppFromSim}
                onWorkspaceSync={loadWorkspace}
                onToast={showToast}
              />
            </div>
            <div className="xl:col-span-8">
              <MiniAppStudio
                categories={categories}
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
          <div className="max-w-lg mx-auto px-3 py-4 h-[calc(100vh-4.5rem)] min-h-[580px]">
            <TelegramSimulator
              onOpenMiniAppTool={handleOpenMiniAppFromSim}
              onWorkspaceSync={loadWorkspace}
              onToast={showToast}
            />
          </div>
        )}

        {viewMode === 'miniapp' && (
          <MiniAppStudio
            categories={categories}
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
          <div className="max-w-6xl mx-auto px-4 py-5">
            <AdminControlHub onToast={showToast} />
          </div>
        )}
        </Suspense>
      </main>

      {/* Command Palette */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        categories={categories}
        onSelectTool={(c, t) => {
          handleSelectTool(c, t);
          setPaletteOpen(false);
        }}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-16 lg:bottom-5 right-4 left-4 sm:left-auto z-50 px-4 py-2.5 rounded-xl bg-slate-900/95 border border-indigo-400/40 text-xs text-white shadow-2xl flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
};
