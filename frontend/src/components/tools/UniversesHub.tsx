import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Dices,
  Download,
  ExternalLink,
  Film,
  Search,
  Sparkles,
  Trophy,
  Tv,
  Upload,
  X,
} from 'lucide-react';
import { apiGet, apiPost, copyText, openExternalLink, triggerHaptic } from '../../lib/api';

const Universes3DScene = lazy(() =>
  import('../three/Interactive3DScenes').then((m) => ({ default: m.Universes3DScene }))
);

interface Props {
  activeTool: string;
  onSelectTool: (toolId: string) => void;
  onSync: () => void;
  onToast: (msg: string) => void;
}

interface MarvelItem {
  id: string;
  title: string;
  year: number | null;
  type: 'film' | 'series' | 'special' | string;
  director: string;
  duration: string;
  seasons?: number | null;
  episodes?: number | null;
  poster_url: string;
  short_desc: string;
  description: string;
  tags: string[];
}

interface MarvelGroup {
  id: string;
  title: string;
  years?: string;
  items: MarvelItem[];
}

interface DcProject {
  id: string;
  title: string;
  original: string;
  year: number | null;
  release_date: string;
  era: string;
  era_name: string;
  type: string;
  duration: string;
  minutes: number;
  imdb: string;
  release_order: number;
  chrono_order: number;
  overview: string;
  credits: string;
}

interface ZmAdvancement {
  uid: string;
  key: string;
  title: string;
  desc: string;
  how: string;
  color: string;
  frame: 'task' | 'goal' | 'challenge' | string;
  xp: number;
  parent: string | null;
  hidden: boolean;
  icon_url: string;
}

interface ZmBranch {
  id: string;
  n: number;
  guest: boolean;
  letter: string | null;
  title: string;
  tone: string;
  store: string;
  page_url: string;
  icon_url: string;
  advancements: ZmAdvancement[];
}

interface ZmPoint {
  n: number;
  code: string;
  title: string;
  date: string;
  confirmed: boolean;
  tone: string;
  page_url: string;
  icon_url: string;
}

interface ZmGuestPoint {
  id: string;
  letter: string;
  title: string;
  from: string;
  tone: string;
  page_url: string;
}

interface CatalogData {
  marvel: {
    site_url: string;
    mcu_phases: MarvelGroup[];
    other_groups: MarvelGroup[];
    upcoming: MarvelItem[];
  };
  dc: {
    site_url: string;
    eras: { id: string; short: string; title: string; color: string }[];
    projects: DcProject[];
  };
  zitraks: {
    site_url: string;
    play_url: string;
    mod_version: string;
    splashes: string[];
    ranks: [number, string][];
    points: ZmPoint[];
    guest_points: ZmGuestPoint[];
    branches: ZmBranch[];
  };
}

export const UniversesHub: React.FC<Props> = ({
  activeTool,
  onSelectTool,
  onSync,
  onToast,
}) => {
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(true);

  const [marvelChecked, setMarvelChecked] = useState<string[]>([]);
  const [dcChecked, setDcChecked] = useState<string[]>([]);
  const [zmChecked, setZmChecked] = useState<string[]>([]);

  const [marvelSummary, setMarvelSummary] = useState<any>(null);
  const [dcSummary, setDcSummary] = useState<any>(null);
  const [zmSummary, setZmSummary] = useState<any>(null);
  const [zmSaveCode, setZmSaveCode] = useState<string>('');

  // Marvel local UI state
  const [marvelSection, setMarvelSection] = useState<'mcu' | 'other' | 'upcoming'>('mcu');
  const [marvelFilter, setMarvelFilter] = useState<'all' | 'unwatched' | 'watched' | 'film' | 'series'>('all');
  const [marvelQuery, setMarvelQuery] = useState('');
  const [expandedMarvelId, setExpandedMarvelId] = useState<string | null>(null);

  // DC local UI state
  const [dcEra, setDcEra] = useState<string>('all');
  const [dcOrder, setDcOrder] = useState<'release' | 'chrono'>('release');
  const [dcStatus, setDcStatus] = useState<'all' | 'unwatched' | 'watched'>('all');
  const [dcQuery, setDcQuery] = useState('');
  const [expandedDcId, setExpandedDcId] = useState<string | null>(null);

  // ZitraksMode local UI state
  const [zmTab, setZmTab] = useState<'points' | 'tree' | 'save'>('points');
  const [splashIdx, setSplashIdx] = useState(0);
  const [zmQuery, setZmQuery] = useState('');
  const [zmAdvFilter, setZmAdvFilter] = useState<'all' | 'todo' | 'done'>('all');
  const [focusBranchId, setFocusBranchId] = useState<string>('all');
  const [importInput, setImportInput] = useState('');
  const [mcToast, setMcToast] = useState<{ title: string; frame: string; xp: number } | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([apiGet('/api/v2/universes/catalog'), apiGet('/api/v2/universes/state')])
      .then(([catRes, stRes]) => {
        if (!alive) return;
        setCatalog(catRes);
        setMarvelChecked(stRes.checked?.marvel || []);
        setDcChecked(stRes.checked?.dc || []);
        setZmChecked(stRes.checked?.zitraks || []);
        setMarvelSummary(stRes.summaries?.marvel || null);
        setDcSummary(stRes.summaries?.dc || null);
        setZmSummary(stRes.summaries?.zitraks || null);
        setZmSaveCode(stRes.zmsave_code || '');
        if (catRes?.zitraks?.splashes?.length) {
          setSplashIdx(Math.floor(Math.random() * catRes.zitraks.splashes.length));
        }
      })
      .catch((e) => onToast(e.message || 'Ошибка загрузки каталога'))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [onToast]);

  useEffect(() => {
    if (!mcToast) return;
    const tm = setTimeout(() => setMcToast(null), 2600);
    return () => clearTimeout(tm);
  }, [mcToast]);

  const marvelSet = useMemo(() => new Set(marvelChecked), [marvelChecked]);
  const dcSet = useMemo(() => new Set(dcChecked), [dcChecked]);
  const zmSet = useMemo(() => new Set(zmChecked), [zmChecked]);

  const handleToggleItem = async (
    scope: 'marvel' | 'dc' | 'zitraks',
    itemId: string,
    advMeta?: ZmAdvancement
  ) => {
    triggerHaptic('light');
    try {
      const res = await apiPost('/api/v2/universes/toggle', { scope, item_id: itemId });
      if (scope === 'marvel') {
        setMarvelChecked(res.checked || []);
        setMarvelSummary(res.summary || null);
      } else if (scope === 'dc') {
        setDcChecked(res.checked || []);
        setDcSummary(res.summary || null);
      } else {
        setZmChecked(res.checked || []);
        setZmSummary(res.summary || null);
        if (res.zmsave_code) setZmSaveCode(res.zmsave_code);
        if (res.checked_now && advMeta) {
          setMcToast({ title: advMeta.title, frame: advMeta.frame, xp: advMeta.xp });
        }
      }
      if (res.checked_now) onSync();
    } catch (err: any) {
      onToast(err.message || 'Не удалось сохранить отметку');
    }
  };

  const handleBulkGroup = async (
    scope: 'marvel' | 'dc' | 'zitraks',
    itemIds: string[],
    mode: 'add' | 'remove' | 'replace',
    doneLabel: string
  ) => {
    triggerHaptic('medium');
    try {
      const res = await apiPost('/api/v2/universes/bulk', {
        scope,
        item_ids: itemIds,
        mode,
      });
      if (scope === 'marvel') {
        setMarvelChecked(res.checked || []);
        setMarvelSummary(res.summary || null);
      } else if (scope === 'dc') {
        setDcChecked(res.checked || []);
        setDcSummary(res.summary || null);
      } else {
        setZmChecked(res.checked || []);
        setZmSummary(res.summary || null);
        if (res.zmsave_code) setZmSaveCode(res.zmsave_code);
      }
      onSync();
      onToast(doneLabel);
    } catch (err: any) {
      onToast(err.message || 'Ошибка массового обновления');
    }
  };

  const handleImportZmSave = async (merge: boolean) => {
    const code = importInput.trim();
    if (!code) {
      onToast('Вставьте код ZM1.... или содержимое .zmsave');
      return;
    }
    try {
      const res = await apiPost('/api/v2/universes/zmsave/import', { code, merge });
      setZmChecked(res.checked || []);
      setZmSummary(res.summary || null);
      if (res.zmsave_code) setZmSaveCode(res.zmsave_code);
      setImportInput('');
      onSync();
      onToast(`Импортировано достижений: ${res.imported_count}`);
    } catch (err: any) {
      onToast(err.message || 'Ошибка импорта сохранения');
    }
  };

  const handleDownloadZmSave = () => {
    if (!zmSaveCode.startsWith('ZM1.')) return;
    try {
      const b64 = zmSaveCode.slice(4);
      const bin = atob(b64);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      const jsonText = new TextDecoder('utf-8').decode(bytes);
      const blob = new Blob([jsonText], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'zitraksmode-multi-tg-tool.zmsave';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 400);
      onToast('Файл .zmsave скачан');
    } catch {
      copyText(zmSaveCode, onToast);
    }
  };

  if (loading || !catalog) {
    return (
      <div className="p-8 rounded-2xl glass-surface border border-white/10 text-center text-sm text-slate-400">
        Загрузка каталога вселенных и древа достижений...
      </div>
    );
  }

  const currentMode: 'marvel' | 'dc' | 'zitraks' =
    activeTool === 'dc_checklist' ? 'dc' : activeTool === 'zitraksmode_wiki' ? 'zitraks' : 'marvel';

  // =========================================================================
  // 1. MARVEL CHECKLIST VIEW
  // =========================================================================
  if (currentMode === 'marvel') {
    const mCat = catalog.marvel;
    const rawGroups: MarvelGroup[] =
      marvelSection === 'mcu'
        ? mCat.mcu_phases
        : marvelSection === 'other'
        ? mCat.other_groups
        : [{ id: 'upcoming', title: 'Анонсы и будущие релизы', items: mCat.upcoming }];

    const q = marvelQuery.trim().toLowerCase();
    const filteredGroups = rawGroups
      .map((grp) => {
        const items = grp.items.filter((it) => {
          const isWatched = marvelSet.has(it.id);
          if (marvelFilter === 'watched' && !isWatched) return false;
          if (marvelFilter === 'unwatched' && isWatched) return false;
          if (marvelFilter === 'film' && it.type !== 'film') return false;
          if (marvelFilter === 'series' && it.type !== 'series') return false;
          if (q) {
            const hay = `${it.title} ${it.director} ${it.year || ''} ${it.tags.join(' ')}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        });
        return { ...grp, filteredItems: items };
      })
      .filter((g) => g.filteredItems.length > 0);

    return (
      <div className="space-y-4 animate-view-in min-w-0">
        {/* 3D Stark Arc Reactor + Summary Header */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5 items-stretch">
          <div className="xl:col-span-5">
            <Suspense fallback={<div className="h-[220px] rounded-2xl bg-slate-950/80 border border-white/10 animate-pulse" />}>
              <Universes3DScene
                mode="marvel"
                progressPct={marvelSummary?.mcu_pct || 0}
                subtitle={`MCU: ${marvelSummary?.mcu_done || 0}/${marvelSummary?.mcu_total || 0} (${marvelSummary?.mcu_pct || 0}%)`}
              />
            </Suspense>
          </div>

          <div className="xl:col-span-7 rounded-2xl border border-red-500/30 bg-gradient-to-br from-[#1f0910]/95 via-slate-950/95 to-[#090d18]/95 p-4 flex flex-col justify-between gap-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-400/40 text-[11px] font-semibold text-red-200">
                  🛡️ MARVEL STUDIOS & MULTIVERSE
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white mt-1.5">
                  Чек-лист киновселенной Marvel
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Все 6 фаз MCU, фильмы о Человеке-пауке, Людях Икс, Дэдпуле и будущие анонсы.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openExternalLink(mCat.site_url)}
                className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-lg shadow-red-900/40 transition"
              >
                <span>Сайт Marvel</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {marvelSummary && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-xl bg-black/35 border border-white/10">
                    <div className="text-[11px] text-slate-400">MCU (Фазы 1–6)</div>
                    <div className="text-sm sm:text-base font-bold font-mono text-red-300 mt-0.5">
                      {marvelSummary.mcu_done}/{marvelSummary.mcu_total}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/35 border border-white/10">
                    <div className="text-[11px] text-slate-400">Другие фильмы</div>
                    <div className="text-sm sm:text-base font-bold font-mono text-amber-300 mt-0.5">
                      {marvelSummary.other_done}/{marvelSummary.other_total}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/35 border border-white/10">
                    <div className="text-[11px] text-slate-400">Всего отмечено</div>
                    <div className="text-sm sm:text-base font-bold font-mono text-white mt-0.5">
                      {marvelSummary.total_done}/{marvelSummary.total_items}
                    </div>
                  </div>
                </div>

                {/* Phase mini progress bars */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {marvelSummary.phases.map((ph: any, idx: number) => (
                    <div key={ph.id} className="p-1.5 rounded-lg bg-black/30 border border-white/5">
                      <div className="flex items-center justify-between text-[10px] text-slate-300">
                        <span>Ф{idx + 1}</span>
                        <span className="font-mono text-red-300">{ph.pct}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-white/10 mt-1 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 to-amber-400 transition-all duration-300"
                          style={{ width: `${ph.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section Tabs + Search + Filter Chips */}
        <div className="rounded-2xl glass-surface border border-white/10 p-3 space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'mcu', label: '🛡️ Киновселенная MCU (Фазы 1–6)' },
              { id: 'other', label: '🕷️ Другие фильмы Marvel' },
              { id: 'upcoming', label: '🚀 Анонсы' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMarvelSection(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  marvelSection === tab.id
                    ? 'bg-red-600 border-red-400 text-white'
                    : 'bg-slate-950/70 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={marvelQuery}
                onChange={(e) => setMarvelQuery(e.target.value)}
                placeholder="Поиск по фильму, режиссёру, герою (Тони Старк, Локи, Паук)..."
                className="w-full rounded-xl bg-slate-950 border border-white/10 pl-9 pr-8 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-red-400"
              />
              {marvelQuery && (
                <button
                  type="button"
                  onClick={() => setMarvelQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex gap-1 overflow-x-auto pb-0.5 no-scrollbar">
              {[
                { id: 'all', label: 'Все' },
                { id: 'unwatched', label: 'Не просмотрено' },
                { id: 'watched', label: 'Просмотрено' },
                { id: 'film', label: 'Фильмы' },
                { id: 'series', label: 'Сериалы' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setMarvelFilter(f.id as any)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap border transition shrink-0 ${
                    marvelFilter === f.id
                      ? 'bg-red-500/25 border-red-400/60 text-red-200'
                      : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Phase / Franchise Groups */}
        {filteredGroups.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 text-center text-xs text-slate-400">
            По выбранному фильтру ничего не найдено.
          </div>
        ) : (
          filteredGroups.map((grp) => {
            const allGroupIds = grp.items.map((x) => x.id);
            const doneCount = grp.items.filter((x) => marvelSet.has(x.id)).length;
            const allDone = doneCount === grp.items.length && grp.items.length > 0;
            return (
              <div
                key={grp.id}
                className="rounded-2xl glass-surface border border-white/10 p-3.5 sm:p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm sm:text-base font-bold text-white">{grp.title}</h4>
                      {grp.years && (
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 text-slate-400 font-mono">
                          {grp.years}
                        </span>
                      )}
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-red-500/15 text-red-300 font-mono">
                        {doneCount}/{grp.items.length}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleBulkGroup(
                        'marvel',
                        allGroupIds,
                        allDone ? 'remove' : 'add',
                        allDone ? `Сняты отметки: ${grp.title}` : `Отмечена группа: ${grp.title}`
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-slate-200 shrink-0"
                  >
                    {allDone ? 'Снять группу' : '✓ Отметить группу'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {grp.filteredItems.map((it) => {
                    const checked = marvelSet.has(it.id);
                    const expanded = expandedMarvelId === it.id;
                    return (
                      <div
                        key={it.id}
                        className={`rounded-xl border p-3 transition min-w-0 ${
                          checked
                            ? 'bg-emerald-950/25 border-emerald-500/35'
                            : 'bg-slate-950/75 border-white/10 hover:border-red-400/35'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleItem('marvel', it.id)}
                            className={`mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition ${
                              checked
                                ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                                : 'bg-slate-900 border-white/20 text-transparent hover:border-red-400'
                            }`}
                            title={checked ? 'Снять отметку' : 'Отметить просмотренным'}
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => setExpandedMarvelId(expanded ? null : it.id)}
                                className="text-left min-w-0 flex-1"
                              >
                                <div
                                  className={`text-xs sm:text-sm font-bold leading-snug break-words ${
                                    checked ? 'text-emerald-200 line-through decoration-emerald-500/50' : 'text-white'
                                  }`}
                                >
                                  {it.title}
                                </div>
                              </button>
                              <button
                                type="button"
                                onClick={() => setExpandedMarvelId(expanded ? null : it.id)}
                                className="p-1 rounded-md text-slate-400 hover:text-white shrink-0"
                                title="Подробности"
                              >
                                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-400">
                              <span className="font-mono text-slate-300">{it.year || 'TBA'}</span>
                              <span>•</span>
                              <span className="inline-flex items-center gap-1">
                                {it.type === 'series' ? (
                                  <>
                                    <Tv className="w-3 h-3 text-sky-400" /> Сериал
                                    {it.episodes ? ` (${it.episodes} эп.)` : ''}
                                  </>
                                ) : it.type === 'special' ? (
                                  <>
                                    <Sparkles className="w-3 h-3 text-amber-400" /> Спецвыпуск
                                  </>
                                ) : (
                                  <>
                                    <Film className="w-3 h-3 text-red-400" /> Фильм
                                  </>
                                )}
                              </span>
                              {it.duration && (
                                <>
                                  <span>•</span>
                                  <span>{it.duration}</span>
                                </>
                              )}
                            </div>

                            <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                              {it.short_desc}
                            </p>

                            {expanded && (
                              <div className="mt-2.5 pt-2.5 border-t border-white/10 space-y-2 text-xs text-slate-300">
                                {it.director && (
                                  <div>
                                    <span className="text-slate-400">Режиссёр / шоураннер: </span>
                                    <span className="text-white font-medium">{it.director}</span>
                                  </div>
                                )}
                                <p className="text-[11px] leading-relaxed text-slate-300">{it.description}</p>
                                {it.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {it.tags.map((tg) => (
                                      <span
                                        key={tg}
                                        className="px-2 py-0.5 rounded-md bg-red-500/15 border border-red-400/25 text-[10px] text-red-200"
                                      >
                                        {tg}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  }

  // =========================================================================
  // 2. DC UNIVERSE CHECKLIST VIEW
  // =========================================================================
  if (currentMode === 'dc') {
    const dcCat = catalog.dc;
    const q = dcQuery.trim().toLowerCase();

    const sortedProjects = [...dcCat.projects]
      .sort((a, b) =>
        dcOrder === 'chrono' ? a.chrono_order - b.chrono_order : a.release_order - b.release_order
      )
      .filter((p) => {
        if (dcEra !== 'all' && p.era !== dcEra) return false;
        const w = dcSet.has(p.id);
        if (dcStatus === 'watched' && !w) return false;
        if (dcStatus === 'unwatched' && w) return false;
        if (q) {
          const hay = `${p.title} ${p.original} ${p.era_name} ${p.overview}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

    const pickRandomUnwatchedDc = () => {
      const pool = dcCat.projects.filter((p) => !dcSet.has(p.id));
      if (pool.length === 0) {
        onToast('Все 19 проектов DC уже просмотрены!');
        return;
      }
      const chosen = pool[Math.floor(Math.random() * pool.length)];
      setDcEra('all');
      setDcStatus('all');
      setDcQuery('');
      setExpandedDcId(chosen.id);
      onToast(`Случайный выбор: ${chosen.title} (${chosen.year || 'TBA'})`);
    };

    return (
      <div className="space-y-4 animate-view-in min-w-0">
        {/* 3D DC Crystal + Telemetry Header */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5 items-stretch">
          <div className="xl:col-span-5">
            <Suspense fallback={<div className="h-[220px] rounded-2xl bg-slate-950/80 border border-white/10 animate-pulse" />}>
              <Universes3DScene
                mode="dc"
                progressPct={dcSummary?.pct || 0}
                subtitle={`DC: ${dcSummary?.done || 0}/${dcSummary?.total || 0} • ${dcSummary?.watched_hours || 0} ч`}
              />
            </Suspense>
          </div>

          <div className="xl:col-span-7 rounded-2xl border border-sky-500/35 bg-gradient-to-br from-[#071c38]/95 via-slate-950/95 to-[#090d1a]/95 p-4 flex flex-col justify-between gap-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/40 text-[11px] font-tech text-sky-200">
                  🦇 DC STUDIOS • MULTIVERSE TRACKER
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white mt-1.5">
                  Чек-лист вселенной DC
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  DCU Джеймса Ганна, Лига Справедливости Снайдера, Elseworlds («Бэтмен», «Джокер») и анонсы.
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={pickRandomUnwatchedDc}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-200 text-xs font-medium flex items-center gap-1"
                  title="Случайный непросмотренный проект"
                >
                  <Dices className="w-3.5 h-3.5" /> Случайный
                </button>
                <button
                  type="button"
                  onClick={() => openExternalLink(dcCat.site_url)}
                  className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-sky-900/40 transition"
                >
                  <span>Сайт DC</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {dcSummary && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 rounded-xl bg-black/35 border border-white/10">
                    <div className="text-[11px] text-slate-400">Просмотрено</div>
                    <div className="text-sm sm:text-base font-bold font-mono text-sky-300 mt-0.5">
                      {dcSummary.done}/{dcSummary.total} ({dcSummary.pct}%)
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/35 border border-white/10">
                    <div className="text-[11px] text-slate-400">Хронометраж</div>
                    <div className="text-sm sm:text-base font-bold font-mono text-amber-300 mt-0.5">
                      {dcSummary.watched_hours} ч
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/35 border border-white/10">
                    <div className="text-[11px] text-slate-400">Средний IMDb</div>
                    <div className="text-sm sm:text-base font-bold font-mono text-emerald-300 mt-0.5">
                      {dcSummary.avg_imdb ? `★ ${dcSummary.avg_imdb}` : '—'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/35 border border-white/10">
                    <div className="text-[11px] text-slate-400">Всего в базе</div>
                    <div className="text-sm sm:text-base font-bold font-mono text-white mt-0.5">
                      {Math.round(dcSummary.total_minutes / 60)} ч
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {dcSummary.eras.map((er: any) => (
                    <div key={er.id} className="p-2 rounded-lg bg-black/30 border border-white/5">
                      <div className="flex items-center justify-between text-[11px] text-slate-300">
                        <span className="font-tech">{er.short}</span>
                        <span className="font-mono text-sky-300">
                          {er.done}/{er.total}
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-white/10 mt-1 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-sky-400 to-amber-300 transition-all duration-300"
                          style={{ width: `${er.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Era & Order Controls */}
        <div className="rounded-2xl glass-surface border border-white/10 p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              <button
                type="button"
                onClick={() => setDcEra('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition shrink-0 ${
                  dcEra === 'all'
                    ? 'bg-sky-600 border-sky-400 text-white'
                    : 'bg-slate-950 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                Все эры ({dcCat.projects.length})
              </button>
              {dcCat.eras.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setDcEra(e.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition shrink-0 ${
                    dcEra === e.id
                      ? 'bg-sky-600 border-sky-400 text-white'
                      : 'bg-slate-950 border-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  {e.short}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-white/10">
              <button
                type="button"
                onClick={() => setDcOrder('release')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                  dcOrder === 'release' ? 'bg-sky-500/25 text-sky-200' : 'text-slate-400 hover:text-white'
                }`}
              >
                По дате выхода
              </button>
              <button
                type="button"
                onClick={() => setDcOrder('chrono')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                  dcOrder === 'chrono' ? 'bg-amber-400/20 text-amber-200' : 'text-slate-400 hover:text-white'
                }`}
              >
                По хронологии
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={dcQuery}
                onChange={(e) => setDcQuery(e.target.value)}
                placeholder="Поиск: Супермен, Бэтмен, Миротворец, Пингвин..."
                className="w-full rounded-xl bg-slate-950 border border-white/10 pl-9 pr-8 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
              />
              {dcQuery && (
                <button
                  type="button"
                  onClick={() => setDcQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex gap-1">
              {[
                { id: 'all', label: 'Все' },
                { id: 'unwatched', label: 'Не просмотрено' },
                { id: 'watched', label: 'Просмотрено' },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setDcStatus(st.id as any)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition ${
                    dcStatus === st.id
                      ? 'bg-sky-500/25 border-sky-400/60 text-sky-200'
                      : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* DC Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sortedProjects.map((p) => {
            const checked = dcSet.has(p.id);
            const expanded = expandedDcId === p.id;
            const orderNum = dcOrder === 'chrono' ? p.chrono_order : p.release_order;
            return (
              <div
                key={p.id}
                className={`rounded-2xl border p-3.5 transition min-w-0 ${
                  checked
                    ? 'bg-emerald-950/25 border-emerald-500/40'
                    : 'glass-surface border-white/10 hover:border-sky-400/45'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleToggleItem('dc', p.id)}
                    className={`mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition ${
                      checked
                        ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                        : 'bg-slate-900 border-white/20 text-transparent hover:border-sky-400'
                    }`}
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 text-[10px] font-mono">
                            #{orderNum}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-white/5 text-slate-300 text-[10px] font-tech">
                            {p.era.toUpperCase()}
                          </span>
                          {p.imdb && p.imdb !== '—' && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-300 text-[10px] font-mono">
                              ★ IMDb {p.imdb}
                            </span>
                          )}
                        </div>
                        <h4
                          className={`text-sm font-bold mt-1 leading-snug break-words ${
                            checked ? 'text-emerald-200 line-through decoration-emerald-500/50' : 'text-white'
                          }`}
                        >
                          {p.title}
                        </h4>
                        <div className="text-[11px] text-slate-400">
                          {p.original} • {p.release_date || p.year || 'TBA'}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedDcId(expanded ? null : p.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-white shrink-0"
                      >
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-300">
                      <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span>{p.duration}</span>
                    </div>

                    <p className="text-xs text-slate-300/90 mt-2 leading-relaxed">{p.overview}</p>

                    {(expanded || p.credits) && (
                      <div className="mt-2.5 p-2 rounded-xl bg-amber-500/10 border border-amber-400/25 text-[11px] text-amber-200">
                        <span className="font-semibold">🎬 После титров: </span>
                        <span>{p.credits}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. MINECRAFT MOD ZITRAKSMODE WIKI & ADVANCEMENT TREE (Forge 1.19.2)
  // =========================================================================
  const zmCat = catalog.zitraks;
  const currentSplash =
    zmCat.splashes[splashIdx % Math.max(1, zmCat.splashes.length)] || 'Forge 1.19.2!';

  const branchStatsByN: Record<number, { done: number; total: number; branchId: string }> = {};
  for (const br of zmCat.branches) {
    if (!br.guest) {
      const done = br.advancements.filter((a) => zmSet.has(a.uid)).length;
      branchStatsByN[br.n] = { done, total: br.advancements.length, branchId: br.id };
    }
  }

  const zq = zmQuery.trim().toLowerCase();
  const visibleBranches = zmCat.branches
    .filter((br) => (focusBranchId === 'all' ? true : br.id === focusBranchId))
    .map((br) => {
      const advs = br.advancements.filter((a) => {
        const isDone = zmSet.has(a.uid);
        if (zmAdvFilter === 'done' && !isDone) return false;
        if (zmAdvFilter === 'todo' && isDone) return false;
        if (zq) {
          const hay = `${br.title} ${a.title} ${a.desc} ${a.how}`.toLowerCase();
          if (!hay.includes(zq)) return false;
        }
        return true;
      });
      return { ...br, filteredAdvs: advs };
    })
    .filter((b) => b.filteredAdvs.length > 0);

  const openRandomPoint = () => {
    const pick = zmCat.points[Math.floor(Math.random() * zmCat.points.length)];
    if (pick) {
      onToast(`Случайный пункт №${pick.code}: ${pick.title}`);
      openExternalLink(pick.page_url);
    }
  };

  return (
    <div className="space-y-4 animate-view-in min-w-0">
      {/* Authentic Minecraft Advancement Toast */}
      {mcToast && (
        <div className="fixed top-16 right-3 z-50 mc-box rounded-xl px-4 py-3 flex items-center gap-3 max-w-xs animate-view-in pointer-events-none">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-lg shrink-0">
            🏆
          </div>
          <div className="min-w-0 font-pixel">
            <div
              className="text-xs leading-tight"
              style={{
                color:
                  mcToast.frame === 'challenge'
                    ? '#ff55ff'
                    : mcToast.frame === 'goal'
                    ? '#55ffff'
                    : '#ffff55',
              }}
            >
              {mcToast.frame === 'challenge'
                ? 'Испытание выполнено!'
                : mcToast.frame === 'goal'
                ? 'Цель достигнута!'
                : 'Достижение получено!'}
            </div>
            <div className="text-sm text-white truncate">{mcToast.title}</div>
            <div className="text-[11px] text-lime-300">+{mcToast.xp} XP</div>
          </div>
        </div>
      )}

      {/* 3D Minecraft Voxel Block + ZitraksMode Header & XP Level Bar */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5 items-stretch">
        <div className="xl:col-span-5">
          <Suspense fallback={<div className="h-[235px] rounded-2xl bg-slate-950/80 border border-white/10 animate-pulse" />}>
            <Universes3DScene
              mode="zitraks"
              progressPct={zmSummary?.pct || 0}
              subtitle={`Ур. ${zmSummary?.level || 0} • ${zmSummary?.got || 0}/${zmSummary?.total || 169} ачивок`}
            />
          </Suspense>
        </div>

        <div className="xl:col-span-7 rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-[#0e2216]/95 via-slate-950/95 to-[#090d14]/95 p-4 flex flex-col justify-between gap-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-[11px] font-pixel text-emerald-300">
                  ⛏️ MINECRAFT {zmCat.mod_version}
                </span>
                <button
                  type="button"
                  onClick={() => setSplashIdx((i) => i + 1)}
                  className="px-2.5 py-0.5 rounded-md bg-amber-400/15 border border-amber-300/35 text-xs font-pixel text-yellow-300 hover:bg-amber-400/25 transition"
                  title="Нажмите для следующей сплеш-фразы"
                >
                  ✦ {currentSplash}
                </button>
              </div>

              <h3 className="text-base sm:text-xl font-bold text-white mt-2 tracking-wide">
                ZITRAKSMODE WIKI
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Все 29 основных и 4 гостевых пункта мода, интерактивное древо из 169 достижений и совместимость с .zmsave.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={openRandomPoint}
                className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium text-white flex items-center gap-1"
              >
                <Dices className="w-3.5 h-3.5 text-emerald-300" /> Случайный
              </button>
              <button
                type="button"
                onClick={() => openExternalLink(zmCat.play_url)}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-xs font-pixel text-amber-200 flex items-center gap-1"
              >
                🎮 Играть
              </button>
              <button
                type="button"
                onClick={() => openExternalLink(zmCat.site_url)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-900/40 transition"
              >
                <span>Вики мода</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {zmSummary && (
            <div className="space-y-2.5">
              {/* Minecraft Authentic XP Level Bar */}
              <div className="p-3 rounded-xl bg-black/45 border border-emerald-500/25 space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="font-pixel text-sm text-lime-300">
                    Уровень {zmSummary.level} • {zmSummary.rank}
                  </div>
                  <div className="font-mono text-[11px] text-slate-300">
                    {zmSummary.xp} / {zmSummary.xp_total} XP
                  </div>
                </div>
                <div className="h-2.5 rounded-md bg-slate-900 border border-lime-500/30 overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-sm bg-gradient-to-r from-lime-400 via-emerald-400 to-yellow-300 transition-all duration-300"
                    style={{ width: `${zmSummary.level_pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>
                    Ачивок: <b className="text-white">{zmSummary.got}/{zmSummary.total}</b> ({zmSummary.pct}%)
                  </span>
                  <span>
                    Закрыто веток: <b className="text-emerald-300">{zmSummary.completed_branches}/{zmSummary.total_branches}</b>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mode Switcher: Points / Advancement Tree / .zmsave Sync */}
      <div className="rounded-2xl glass-surface border border-white/10 p-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'points', label: '📦 Все пункты мода (29 + 4)' },
            { id: 'tree', label: `🏆 Древо достижений (${zmSummary?.got || 0}/${zmSummary?.total || 169})` },
            { id: 'save', label: '💾 Сохранение .zmsave' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setZmTab(t.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                zmTab === t.id
                  ? 'bg-emerald-600 border-emerald-400 text-white'
                  : 'bg-slate-950 border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Quick cross-switch to Marvel / DC inside Universes category */}
        <div className="hidden sm:flex items-center gap-1 text-[11px]">
          <button
            type="button"
            onClick={() => onSelectTool('marvel_checklist')}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
          >
            🛡️ Marvel
          </button>
          <button
            type="button"
            onClick={() => onSelectTool('dc_checklist')}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
          >
            🦇 DC
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: ALL 29 MAIN + 4 GUEST POINTS */}
      {zmTab === 'points' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={zmQuery}
              onChange={(e) => setZmQuery(e.target.value)}
              placeholder="Поиск пункта: Цифроблоки, ТНТ-броня, Лабубу, Катана, Махорага, Сандевистан..."
              className="w-full rounded-xl bg-slate-950 border border-white/10 pl-9 pr-8 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
            />
            {zmQuery && (
              <button
                type="button"
                onClick={() => setZmQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {zmCat.points
              .filter((p) => !zq || `${p.code} ${p.title} ${p.date}`.toLowerCase().includes(zq))
              .map((p) => {
                const st = branchStatsByN[p.n];
                const full = st && st.total > 0 && st.done === st.total;
                return (
                  <div
                    key={p.n}
                    className="rounded-2xl glass-surface border border-white/10 p-3 flex flex-col justify-between gap-2.5 hover:border-white/25 transition min-w-0"
                    style={{ boxShadow: `inset 3px 0 0 ${p.tone}` }}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-950 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {p.icon_url ? (
                          <img
                            src={p.icon_url}
                            alt={p.title}
                            loading="lazy"
                            className="w-7 h-7 object-contain pixel"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className="font-pixel text-sm" style={{ color: p.tone }}>
                            №{p.code}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-pixel text-xs" style={{ color: p.tone }}>
                            №{p.code}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">{p.date}</span>
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-white leading-snug truncate mt-0.5">
                          {p.title}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                      {st ? (
                        <button
                          type="button"
                          onClick={() => {
                            setFocusBranchId(st.branchId);
                            setZmTab('tree');
                          }}
                          className={`px-2 py-1 rounded-lg text-[11px] font-mono flex items-center gap-1 transition ${
                            full
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                              : 'bg-white/5 hover:bg-white/10 text-slate-300'
                          }`}
                        >
                          <Trophy className="w-3 h-3 text-amber-400" />
                          <span>
                            {st.done}/{st.total}
                          </span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500">—</span>
                      )}

                      <button
                        type="button"
                        onClick={() => openExternalLink(p.page_url)}
                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-semibold text-white flex items-center gap-1 shrink-0"
                      >
                        <span>Стенд</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Guest Points Block */}
          <div className="rounded-2xl glass-surface border border-white/10 p-3.5 space-y-2.5">
            <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <span>🎁 Гостевые пункты (4)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {zmCat.guest_points.map((gp) => (
                <div
                  key={gp.id}
                  className="p-3 rounded-xl bg-slate-950/80 border border-white/10 flex items-center justify-between gap-2"
                  style={{ boxShadow: `inset 3px 0 0 ${gp.tone}` }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-pixel text-xs" style={{ color: gp.tone }}>
                        G-{gp.letter}
                      </span>
                      <span className="text-xs font-bold text-white truncate">{gp.title}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">{gp.from}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openExternalLink(gp.page_url)}
                    className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-semibold text-white flex items-center gap-1 shrink-0"
                  >
                    <span>Открыть</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: FULL ADVANCEMENT TREE (169 ADVANCEMENTS) */}
      {zmTab === 'tree' && (
        <div className="space-y-3.5">
          <div className="rounded-2xl glass-surface border border-white/10 p-3 space-y-2.5">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={zmQuery}
                  onChange={(e) => setZmQuery(e.target.value)}
                  placeholder="Поиск ачивки по названию, описанию или условию в коде..."
                  className="w-full rounded-xl bg-slate-950 border border-white/10 pl-9 pr-8 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
                />
                {zmQuery && (
                  <button
                    type="button"
                    onClick={() => setZmQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <select
                value={focusBranchId}
                onChange={(e) => setFocusBranchId(e.target.value)}
                className="rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
              >
                <option value="all">Все ветки ({zmCat.branches.length})</option>
                {zmCat.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.guest ? `G-${b.letter}` : `№${String(b.n).padStart(2, '0')}`} • {b.title}
                  </option>
                ))}
              </select>

              <div className="flex gap-1">
                {[
                  { id: 'all', label: 'Все' },
                  { id: 'todo', label: 'Не получено' },
                  { id: 'done', label: 'Получено' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setZmAdvFilter(f.id as any)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition ${
                      zmAdvFilter === f.id
                        ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-200'
                        : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {visibleBranches.map((br) => {
            const allUids = br.advancements.map((a) => a.uid);
            const doneCount = br.advancements.filter((a) => zmSet.has(a.uid)).length;
            const branchFull = doneCount === br.advancements.length && br.advancements.length > 0;
            return (
              <div
                key={br.id}
                className="rounded-2xl glass-surface border border-white/10 p-3.5 space-y-3"
                style={{ boxShadow: `inset 3px 0 0 ${br.tone}` }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-pixel text-xs px-2 py-0.5 rounded bg-black/40" style={{ color: br.tone }}>
                      {br.guest ? `G-${br.letter}` : `№${String(br.n).padStart(2, '0')}`}
                    </span>
                    <h4 className="text-sm font-bold text-white truncate">{br.title}</h4>
                    <span className="text-[11px] font-mono text-emerald-300">
                      {doneCount}/{br.advancements.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        handleBulkGroup(
                          'zitraks',
                          allUids,
                          branchFull ? 'remove' : 'add',
                          branchFull ? `Сброшена ветка: ${br.title}` : `Закрыта ветка: ${br.title}`
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-slate-200"
                    >
                      {branchFull ? 'Сбросить ветку' : '✓ Все ачивки'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openExternalLink(br.page_url)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
                      title="Открыть страницу пункта на Вики"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {br.filteredAdvs.map((adv) => {
                    const got = zmSet.has(adv.uid);
                    const frameBadge =
                      adv.frame === 'challenge'
                        ? { label: 'Испытание', cls: 'border-fuchsia-400/50 text-fuchsia-300 bg-fuchsia-500/15' }
                        : adv.frame === 'goal'
                        ? { label: 'Цель', cls: 'border-cyan-400/50 text-cyan-300 bg-cyan-500/15' }
                        : { label: 'Задача', cls: 'border-lime-400/40 text-lime-300 bg-lime-500/15' };
                    return (
                      <div
                        key={adv.uid}
                        onClick={() => handleToggleItem('zitraks', adv.uid, adv)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleToggleItem('zitraks', adv.uid, adv);
                          }
                        }}
                        className={`rounded-xl border p-3 transition text-left min-w-0 ${
                          got
                            ? 'bg-emerald-950/35 border-emerald-400/50'
                            : 'bg-slate-950/80 border-white/10 hover:border-emerald-400/35'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center shrink-0 relative ${
                              got
                                ? adv.frame === 'challenge'
                                  ? 'border-fuchsia-400 bg-fuchsia-950/50'
                                  : adv.frame === 'goal'
                                  ? 'border-cyan-400 bg-cyan-950/50'
                                  : 'border-lime-400 bg-lime-950/50'
                                : 'border-slate-700 bg-slate-900 opacity-75'
                            }`}
                          >
                            {adv.icon_url ? (
                              <img
                                src={adv.icon_url}
                                alt=""
                                loading="lazy"
                                className="w-6 h-6 object-contain pixel"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <Trophy className="w-4 h-4 text-amber-300" />
                            )}
                            {got && (
                              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-400 text-slate-950 flex items-center justify-center">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1.5 flex-wrap">
                              <span
                                className="font-pixel text-sm leading-tight break-words"
                                style={{ color: got ? adv.color : '#e2e8f0' }}
                              >
                                {adv.title}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className={`px-1.5 py-0.5 rounded border text-[10px] font-pixel ${frameBadge.cls}`}>
                                  {frameBadge.label}
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-300 text-[10px] font-mono">
                                  +{adv.xp} XP
                                </span>
                              </div>
                            </div>

                            <p className="text-xs text-slate-300 mt-1 leading-snug">{adv.desc}</p>
                            {adv.how && (
                              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                                <span className="text-slate-500">Как получить: </span>
                                {adv.how}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SUB-TAB 3: .ZMSAVE / ZM1. PROFILE SYNC */}
      {zmTab === 'save' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div className="rounded-2xl glass-surface border border-white/10 p-4 space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-400" />
              Экспорт сохранения (совместимо с ZitraksMode Wiki)
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Код формата <code className="text-emerald-300">ZM1....</code> и файл{' '}
              <code className="text-emerald-300">.zmsave</code> полностью совместимы с разделом «Профиль → Сохранения» на сайте{' '}
              <span className="text-slate-200">ssgssbex1080.github.io</span>.
            </p>
            <textarea
              readOnly
              value={zmSaveCode}
              rows={4}
              className="w-full rounded-xl bg-slate-950 border border-white/10 p-2.5 text-[11px] font-mono text-emerald-200 focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copyText(zmSaveCode, onToast)}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" /> Скопировать код ZM1
              </button>
              <button
                type="button"
                onClick={handleDownloadZmSave}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Скачать .zmsave
              </button>
            </div>
          </div>

          <div className="rounded-2xl glass-surface border border-white/10 p-4 space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-sky-400" />
              Импорт кода ZM1 или файла .zmsave
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Вставьте скопированный с сайта код <code className="text-sky-300">ZM1....</code> или JSON из файла{' '}
              <code className="text-sky-300">.zmsave</code>, чтобы перенести открытые достижения в Telegram-профиль.
            </p>
            <textarea
              value={importInput}
              onChange={(e) => setImportInput(e.target.value)}
              placeholder="ZM1.eyJ2IjoxLCJwIjp7..."
              rows={4}
              className="w-full rounded-xl bg-slate-950 border border-white/10 p-2.5 text-[11px] font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-400"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleImportZmSave(true)}
                className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
              >
                Объединить с текущими
              </button>
              <button
                type="button"
                onClick={() => handleImportZmSave(false)}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-medium"
              >
                Заменить полностью
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
