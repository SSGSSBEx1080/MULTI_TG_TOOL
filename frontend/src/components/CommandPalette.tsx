import React, { useEffect, useMemo, useState } from 'react';
import { Search, Sparkles, X } from 'lucide-react';
import { ToolCategory } from '../lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  categories: ToolCategory[];
  onSelectTool: (categoryId: string, toolId: string) => void;
}

export const CommandPalette: React.FC<Props> = ({ open, onClose, categories, onSelectTool }) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 backdrop-blur-md pt-3 sm:pt-16 px-3 sm:px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-white/15 glass-surface shadow-2xl overflow-hidden animate-view-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-3.5 sm:px-4 py-3 border-b border-white/10">
          <Search className="w-5 h-5 text-sky-400 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && flatTools[0]) {
                onSelectTool(flatTools[0].categoryId, flatTools[0].id);
                onClose();
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
            placeholder="Поиск по инструментам (Marvel, DC, ZitraksMode, QR, физика, PDF)..."
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

        <div className="max-h-[60vh] sm:max-h-96 overflow-y-auto p-2 space-y-1">
          {flatTools.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              Ничего не найдено по запросу «{query}»
            </div>
          ) : (
            flatTools.map((item) => (
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
                <span className="shrink-0 max-w-[105px] sm:max-w-[175px] truncate text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-sky-300 border border-white/10">
                  {item.categoryTitle}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="px-3.5 sm:px-4 py-2 bg-slate-950/70 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5 truncate">
            <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            Быстрый переход по инструментам
          </span>
          <span className="hidden sm:inline shrink-0">Enter — открыть • ESC — закрыть</span>
        </div>
      </div>
    </div>
  );
};
