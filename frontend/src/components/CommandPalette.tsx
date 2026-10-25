import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Search, Sparkles, X } from 'lucide-react';
import { ToolCategory, apiGet } from '../lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  categories: ToolCategory[];
  onSelectTool: (categoryId: string, toolId: string) => void;
}

export const CommandPalette: React.FC<Props> = ({ open, onClose, categories, onSelectTool }) => {
  const [query, setQuery] = useState('');
  const [remoteRes, setRemoteRes] = useState<any | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setRemoteRes(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !query.trim()) {
      setRemoteRes(null);
      return;
    }
    const timer = setTimeout(() => {
      apiGet(`/api/v2/search/intuitive?q=${encodeURIComponent(query.trim())}`)
        .then((r) => setRemoteRes(r))
        .catch(() => {});
    }, 170);
    return () => clearTimeout(timer);
  }, [open, query]);

  const flatTools = useMemo(() => {
    const items: Array<{
      categoryId: string;
      categoryTitle: string;
      id: string;
      title: string;
      emoji: string;
      desc: string;
    }> = [];
    for (const cat of categories) {
      for (const t of cat.tools) {
        items.push({
          categoryId: cat.id,
          categoryTitle: cat.title,
          ...t,
        });
      }
    }
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.desc.toLowerCase().includes(q) ||
        i.categoryTitle.toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q)
    );
  }, [categories, query]);

  if (!open) return null;

  const articles: any[] = remoteRes?.articles || [];
  const instant = remoteRes?.instant || null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 backdrop-blur-md pt-3 sm:pt-16 px-3 sm:px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-white/15 glass-surface shadow-2xl overflow-hidden animate-view-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-3.5 sm:px-4 py-3 border-b border-white/10">
          <Search className="w-5 h-5 text-sky-400 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (flatTools[0]) {
                  onSelectTool(flatTools[0].categoryId, flatTools[0].id);
                  onClose();
                } else if (articles[0]) {
                  onSelectTool(articles[0].target_category || 'knowledge', articles[0].target_tool || 'religions_hub');
                  onClose();
                }
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
            placeholder="Умный поиск всего: шахматы, шпион, статьи, ислам, конституции, 256*14..."
            className="w-full min-w-0 bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[68vh] sm:max-h-[440px] overflow-y-auto p-2.5 space-y-2">
          {instant && (
            <div className="p-3 rounded-xl bg-indigo-500/15 border border-indigo-400/35 text-xs">
              <span className="text-indigo-300 font-semibold">{instant.title}: </span>
              <span className="font-mono text-white">{instant.output}</span>
            </div>
          )}

          {flatTools.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTool(item.categoryId, item.id);
                onClose();
              }}
              className="w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-left hover:bg-sky-500/15 border border-transparent hover:border-sky-500/30 transition"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="text-xl shrink-0">{item.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-medium text-slate-100 truncate">
                    {item.title}
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-400 truncate">{item.desc}</div>
                </div>
              </div>
              <span className="shrink-0 max-w-[115px] sm:max-w-[175px] truncate text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-sky-300 border border-white/10">
                {item.categoryTitle}
              </span>
            </button>
          ))}

          {articles.length > 0 && (
            <div className="pt-1 space-y-2">
              <div className="px-2 text-[10px] font-mono uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> Статьи энциклопедии и конституции (RU + Оригинал)
              </div>
              {articles.map((art: any) => (
                <button
                  key={art.id}
                  type="button"
                  onClick={() => {
                    onSelectTool(art.target_category || 'knowledge', art.target_tool || 'religions_hub');
                    onClose();
                  }}
                  className="w-full p-3 rounded-xl bg-slate-900/90 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-400/40 text-left transition space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-bold text-white">{art.title}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 text-[10px] font-mono shrink-0">
                      {art.orig_lang || 'RU'}
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-300/90">{art.subtitle}</div>
                  <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">{art.ru_text}</p>
                  {art.orig_text && (
                    <p className="text-[11px] text-amber-200/85 line-clamp-2 font-mono">{art.orig_text}</p>
                  )}
                </button>
              ))}
            </div>
          )}

          {flatTools.length === 0 && articles.length === 0 && !instant && (
            <div className="py-8 text-center text-sm text-slate-400">
              Ищем статьи и инструменты по запросу «{query}»...
            </div>
          )}
        </div>

        <div className="px-3.5 sm:px-4 py-2 bg-slate-950/70 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5 truncate">
            <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            Универсальный поиск: инструменты, вычисления, конституции и энциклопедия
          </span>
          <span className="hidden sm:inline shrink-0">Enter — открыть • ESC — закрыть</span>
        </div>
      </div>
    </div>
  );
};
