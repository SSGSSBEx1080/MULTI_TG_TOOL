import React, { useCallback, useEffect, useState } from 'react';
import {
  Columns2,
  LayoutGrid,
  MessageSquareCode,
  Search,
  Settings2,
} from 'lucide-react';
import {
  NoteItem,
  TodoItem,
  ToolCategory,
  UserProfile,
  apiGet,
  apiPost,
} from './lib/api';
import { TelegramSimulator } from './components/TelegramSimulator';
import { MiniAppStudio } from './components/MiniAppStudio';
import { AdminControlHub } from './components/AdminControlHub';
import { CommandPalette } from './components/CommandPalette';

type ViewMode = 'split' | 'bot' | 'miniapp' | 'admin';

export const App: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const isNativeTma = Boolean(
    params.get('tma') === '1' ||
      (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData
  );

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (isNativeTma) return 'miniapp';
    return window.innerWidth >= 1280 ? 'split' : 'bot';
  });

  const [categories, setCategories] = useState<ToolCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>(params.get('tool') || 'party');
  const [activeTool, setActiveTool] = useState<string>('vodka_calc');

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);

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
    } catch {
      // ignore initial transient
    }
  }, []);

  useEffect(() => {
    try {
      const tg = (window as unknown as { Telegram?: { WebApp?: { ready: () => void; expand: () => void } } }).Telegram?.WebApp;
      tg?.ready?.();
      tg?.expand?.();
    } catch {
      // ignore
    }
    apiGet('/api/tools/catalog')
      .then((res) => setCategories(res.categories || []))
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
      showToast(res.added ? '★ Добавлено в избранное!' : 'Удалено из избранного');
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const handleSelectTool = (catId: string, toolId: string) => {
    setActiveCategory(catId);
    setActiveTool(toolId);
    if (viewMode === 'bot' || viewMode === 'admin') {
      setViewMode('miniapp');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#080c16] text-slate-100">
      {/* Top Navigation Shell (Hidden when opened inside native Telegram WebApp iframe) */}
      {!isNativeTma && (
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a101f]/90 backdrop-blur-xl">
          <div className="max-w-[1680px] mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src="/avatar.png"
                alt="MULTI_TG_TOOL"
                className="w-10 h-10 rounded-full object-cover border border-amber-400/50 shadow-lg shadow-purple-600/30"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm tracking-wide text-white">MULTI_TG_TOOL</span>
                  <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-amber-300 border border-amber-400/30 font-medium">
                    @multi_tg_bot
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 hidden sm:block">
                  50+ утилит • Аркады • Знания • Соцсеть & Рейтинг
                </div>
              </div>
            </div>

            {/* Segmented Mode Switcher */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950/90 border border-white/10">
              <button
                onClick={() => setViewMode('split')}
                className={`hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  viewMode === 'split'
                    ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Columns2 className="w-3.5 h-3.5" />
                Split (Бот + Студия)
              </button>
              <button
                onClick={() => setViewMode('bot')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  viewMode === 'bot'
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <MessageSquareCode className="w-3.5 h-3.5" />
                Telegram-Бот
              </button>
              <button
                onClick={() => setViewMode('miniapp')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  viewMode === 'miniapp'
                    ? 'bg-purple-500 text-white font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Mini App (50+ фич & Игры)
              </button>
              <button
                onClick={() => setViewMode('admin')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  viewMode === 'admin'
                    ? 'bg-emerald-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Settings2 className="w-3.5 h-3.5" />
                Статистика
              </button>
            </div>

            {/* Right XP + Quick Search */}
            <div className="flex items-center gap-2">
              {profile && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
                  <span>{profile.rank.title}</span>
                  <span className="font-mono text-sky-300 font-semibold">{profile.xp} XP</span>
                </div>
              )}
              <button
                onClick={() => setPaletteOpen(true)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition"
                title="Быстрый поиск (⌘K)"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1680px] w-full mx-auto px-4 py-4">
        {viewMode === 'split' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            <div className="xl:col-span-5">
              <TelegramSimulator
                onOpenMiniAppTool={(catId) => {
                  if (catId) setActiveCategory(catId);
                }}
                onWorkspaceSync={loadWorkspace}
                onToast={showToast}
              />
            </div>
            <div className="xl:col-span-7 max-h-[calc(100vh-145px)] overflow-y-auto pr-1">
              <MiniAppStudio
                categories={categories}
                activeCategory={activeCategory}
                activeTool={activeTool}
                onSelectCategory={(c) => {
                  setActiveCategory(c);
                  const found = categories.find((x) => x.id === c);
                  if (found?.tools?.[0]) setActiveTool(found.tools[0].id);
                }}
                onSelectTool={handleSelectTool}
                profile={profile}
                favorites={favorites}
                notes={notes}
                todos={todos}
                onToggleFav={handleToggleFav}
                onOpenSearch={() => setPaletteOpen(true)}
                onRefreshWorkspace={loadWorkspace}
                onToast={showToast}
              />
            </div>
          </div>
        )}

        {viewMode === 'bot' && (
          <TelegramSimulator
            onOpenMiniAppTool={(catId) => {
              if (catId) setActiveCategory(catId);
              setViewMode('miniapp');
            }}
            onWorkspaceSync={loadWorkspace}
            onToast={showToast}
          />
        )}

        {viewMode === 'miniapp' && (
          <MiniAppStudio
            categories={categories}
            activeCategory={activeCategory}
            activeTool={activeTool}
            onSelectCategory={(c) => {
              setActiveCategory(c);
              const found = categories.find((x) => x.id === c);
              if (found?.tools?.[0]) setActiveTool(found.tools[0].id);
            }}
            onSelectTool={handleSelectTool}
            profile={profile}
            favorites={favorites}
            notes={notes}
            todos={todos}
            onToggleFav={handleToggleFav}
            onOpenSearch={() => setPaletteOpen(true)}
            onRefreshWorkspace={loadWorkspace}
            onToast={showToast}
          />
        )}

        {viewMode === 'admin' && <AdminControlHub onToast={showToast} />}
      </main>

      {/* Command Palette Modal */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        categories={categories}
        onSelectTool={handleSelectTool}
      />

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-2xl bg-slate-900/95 border border-sky-400/40 text-xs font-medium text-sky-100 shadow-2xl backdrop-blur-md">
          {toast}
        </div>
      )}
    </div>
  );
};
