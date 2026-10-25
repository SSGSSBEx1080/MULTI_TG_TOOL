import React, { useState } from 'react';
import { Search, Sparkles, Star, Wand2 } from 'lucide-react';
import {
  NoteItem,
  TodoItem,
  ToolCategory,
  UserProfile,
  apiPost,
  copyText,
} from '../lib/api';
import { VisualMediaHub } from './tools/VisualMediaHub';
import { CyberDevHub } from './tools/CyberDevHub';
import { CalcTextWorkspaceHub } from './tools/CalcTextWorkspaceHub';
import { PartyFunHub } from './tools/PartyFunHub';
import { KnowledgeMegaHub } from './tools/KnowledgeMegaHub';
import { ArcadeGamesHub } from './tools/ArcadeGamesHub';
import { SocialDatingHub } from './tools/SocialDatingHub';

interface Props {
  categories: ToolCategory[];
  activeCategory: string;
  activeTool: string;
  onSelectCategory: (catId: string) => void;
  onSelectTool: (catId: string, toolId: string) => void;
  profile: UserProfile | null;
  favorites: string[];
  notes: NoteItem[];
  todos: TodoItem[];
  onToggleFav: (toolId: string) => void;
  onOpenSearch: () => void;
  onRefreshWorkspace: () => void;
  onToast: (msg: string) => void;
}

export const MiniAppStudio: React.FC<Props> = ({
  categories,
  activeCategory,
  activeTool,
  onSelectCategory,
  onSelectTool,
  profile,
  favorites,
  notes,
  todos,
  onToggleFav,
  onOpenSearch,
  onRefreshWorkspace,
  onToast,
}) => {
  const [omniInput, setOmniInput] = useState('');
  const [omniResult, setOmniResult] = useState<any>(null);

  const runOmni = async () => {
    if (!omniInput.trim()) return;
    try {
      const res = await apiPost('/api/tools/omni', { text: omniInput });
      setOmniResult(res);
      onRefreshWorkspace();
    } catch (e: any) {
      onToast(e.message);
    }
  };

  const allToolsById: Record<string, { catId: string; title: string; emoji: string }> = {};
  categories.forEach((c) => {
    c.tools.forEach((t) => {
      allToolsById[t.id] = { catId: c.id, title: t.title, emoji: t.emoji };
    });
  });

  const renderOmniSummary = () => {
    if (!omniResult || omniResult.kind === 'empty') return null;
    const r = omniResult.result;
    if (omniResult.kind === 'smart_unit' && r?.conversions) {
      return r.conversions
        .slice(0, 4)
        .map((c: any) => `${c.formatted} ${c.label}`)
        .join('  •  ');
    }
    if (omniResult.kind === 'rhyme' && r?.exact_rhymes) {
      return `Точные: ${(r.exact_rhymes || []).slice(0, 8).join(', ')}`;
    }
    if (omniResult.kind === 'population' && r?.places?.[0]) {
      return `${r.places[0].name}: ${r.places[0].formatted_pop} чел.`;
    }
    return (
      r?.fixed ||
      r?.formatted ||
      r?.human_ru ||
      r?.network_address ||
      JSON.stringify(r).slice(0, 180)
    );
  };

  return (
    <div className="space-y-5">
      {/* Operator Status + Smart Omni-Input Bar */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#121a2f] via-[#0f1628] to-[#16132b] p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-400 via-purple-500 to-rose-500 flex items-center justify-center text-xl shadow-lg shadow-sky-500/20">
              🌌
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-base text-white">NEXUS v2 Mega-Studio</h2>
                {profile && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-400/30">
                    {profile.rank.title} • {profile.xp} XP
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                50+ инструментов, Мини-Игры, База Знаний, 105+ Идей, Соцсеть & Дейтинг
              </p>
            </div>
          </div>

          <button
            onClick={onOpenSearch}
            className="px-3.5 py-2 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-white/10 text-xs text-slate-300 flex items-center gap-2 transition"
          >
            <Search className="w-3.5 h-3.5 text-sky-400" />
            <span>Быстрый поиск всех утилит…</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-slate-300 font-mono">⌘K</kbd>
          </button>
        </div>

        {/* Smart Omni-Input */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Wand2 className="w-4 h-4 text-purple-400 absolute left-3.5 top-3" />
            <input
              value={omniInput}
              onChange={(e) => setOmniInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runOmni();
              }}
              placeholder="Smart Omni-Bar: напишите «6 дюймов», «рифма к любовь», «население Токио», Ghbdtn, (1450*1.2)/3…"
              className="w-full rounded-xl bg-slate-950/90 border border-white/10 pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-purple-400"
            />
          </div>
          <button
            onClick={runOmni}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-sky-500 hover:from-purple-400 hover:to-sky-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 shrink-0"
          >
            <Sparkles className="w-4 h-4" /> Распознать
          </button>
        </div>

        {omniResult && omniResult.kind !== 'empty' && (
          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-purple-400/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1 min-w-0">
              <div className="font-semibold text-purple-300">{omniResult.title}</div>
              <div className="text-slate-200 font-mono break-all">{renderOmniSummary()}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {omniResult.result?.fixed && (
                <button
                  onClick={() => copyText(omniResult.result.fixed, onToast)}
                  className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-200 border border-purple-400/40"
                >
                  Копировать
                </button>
              )}
              <button
                onClick={() => setOmniResult(null)}
                className="text-slate-400 hover:text-white px-2"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Favorites Strip */}
        {favorites.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
            <span className="text-[11px] text-amber-300 flex items-center gap-1 shrink-0 mr-1">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> Избранное:
            </span>
            {favorites.map((fid) => {
              const meta = allToolsById[fid];
              if (!meta) return null;
              return (
                <button
                  key={fid}
                  onClick={() => onSelectTool(meta.catId, fid)}
                  className="shrink-0 px-2.5 py-1 rounded-full bg-white/5 hover:bg-amber-500/20 border border-white/10 text-[11px] text-slate-200 transition"
                >
                  {meta.emoji} {meta.title}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 12 Category Navigation Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2">
        {categories.map((cat) => {
          const active = cat.id === activeCategory;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`p-3 rounded-2xl border text-left transition ${
                active
                  ? 'bg-sky-500/20 border-sky-400/60 shadow-lg shadow-sky-500/10'
                  : 'bg-slate-900/60 border-white/10 hover:bg-slate-800/70'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xl">{cat.emoji}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400">{cat.tools.length}</span>
              </div>
              <div className={`text-xs font-semibold truncate ${active ? 'text-white' : 'text-slate-200'}`}>
                {cat.title}
              </div>
              <div className="text-[10px] text-slate-400 truncate mt-0.5">{cat.short}</div>
            </button>
          );
        })}
      </div>

      {/* v2 Mega Hubs */}
      {activeCategory === 'party' && (
        <PartyFunHub
          activeTool={activeTool}
          onSelectTool={(t) => onSelectTool('party', t)}
          onSync={onRefreshWorkspace}
          onToast={onToast}
        />
      )}

      {activeCategory === 'knowledge' && (
        <KnowledgeMegaHub
          activeTool={activeTool}
          onSelectTool={(t) => onSelectTool('knowledge', t)}
          onSync={onRefreshWorkspace}
          onToast={onToast}
        />
      )}

      {activeCategory === 'arcade' && (
        <ArcadeGamesHub
          activeTool={activeTool}
          onSelectTool={(t) => onSelectTool('arcade', t)}
          onSync={onRefreshWorkspace}
          onToast={onToast}
        />
      )}

      {activeCategory === 'social' && (
        <SocialDatingHub
          activeTool={activeTool}
          onSelectTool={(t) => onSelectTool('social', t)}
          onSync={onRefreshWorkspace}
          onToast={onToast}
        />
      )}

      {/* v1 + Extended Hubs */}
      {(activeCategory === 'qr' || activeCategory === 'image' || activeCategory === 'pdf') && (
        <VisualMediaHub
          activeCategory={activeCategory}
          activeTool={activeTool}
          onSelectTool={(t) => onSelectTool(activeCategory, t)}
          favorites={favorites}
          onToggleFav={onToggleFav}
          onSync={onRefreshWorkspace}
          onToast={onToast}
        />
      )}

      {(activeCategory === 'security' || activeCategory === 'dev') && (
        <CyberDevHub
          activeCategory={activeCategory}
          activeTool={activeTool}
          onSelectTool={(t) => onSelectTool(activeCategory, t)}
          onSync={onRefreshWorkspace}
          onToast={onToast}
        />
      )}

      {(activeCategory === 'calc' || activeCategory === 'text' || activeCategory === 'workspace') && (
        <CalcTextWorkspaceHub
          activeCategory={activeCategory}
          activeTool={activeTool}
          onSelectTool={(t) => onSelectTool(activeCategory, t)}
          notes={notes}
          todos={todos}
          onRefreshWorkspace={onRefreshWorkspace}
          onToast={onToast}
        />
      )}
    </div>
  );
};
