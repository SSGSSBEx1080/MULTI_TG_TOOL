import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Box, Dices, Flame, Globe, Search, Star, X } from 'lucide-react';
import {
  HabitItem,
  NoteItem,
  TodoItem,
  ToolCategory,
  UserProfile,
  apiGet,
  apiPost,
  copyText,
} from '../lib/api';
import { Tilt3DCard } from './three/Tilt3DCard';

const CorePolyhedron3D = lazy(() =>
  import('./three/Interactive3DScenes').then((m) => ({ default: m.CorePolyhedron3D }))
);
const Mini3DSceneBadge = lazy(() =>
  import('./three/Interactive3DScenes').then((m) => ({ default: m.Mini3DSceneBadge }))
);

const VisualMediaHub = lazy(() => import('./tools/VisualMediaHub').then((m) => ({ default: m.VisualMediaHub })));
const CyberDevHub = lazy(() => import('./tools/CyberDevHub').then((m) => ({ default: m.CyberDevHub })));
const CalcTextWorkspaceHub = lazy(() =>
  import('./tools/CalcTextWorkspaceHub').then((m) => ({ default: m.CalcTextWorkspaceHub }))
);
const PartyFunHub = lazy(() => import('./tools/PartyFunHub').then((m) => ({ default: m.PartyFunHub })));
const EverydayLifeHub = lazy(() => import('./tools/EverydayLifeHub').then((m) => ({ default: m.EverydayLifeHub })));
const KnowledgeMegaHub = lazy(() =>
  import('./tools/KnowledgeMegaHub').then((m) => ({ default: m.KnowledgeMegaHub }))
);
const ArcadeGamesHub = lazy(() => import('./tools/ArcadeGamesHub').then((m) => ({ default: m.ArcadeGamesHub })));
const SocialDatingHub = lazy(() =>
  import('./tools/SocialDatingHub').then((m) => ({ default: m.SocialDatingHub }))
);
const HoroscopeHub = lazy(() => import('./tools/HoroscopeHub').then((m) => ({ default: m.HoroscopeHub })));
const PhysicsHub = lazy(() => import('./tools/PhysicsHub').then((m) => ({ default: m.PhysicsHub })));
const UniversesHub = lazy(() => import('./tools/UniversesHub').then((m) => ({ default: m.UniversesHub })));
const AudioDeviceLabHub = lazy(() =>
  import('./tools/AudioDeviceLabHub').then((m) => ({ default: m.AudioDeviceLabHub }))
);
const BrainReflexHub = lazy(() => import('./tools/BrainReflexHub').then((m) => ({ default: m.BrainReflexHub })));
const HealthWellnessHub = lazy(() =>
  import('./tools/HealthWellnessHub').then((m) => ({ default: m.HealthWellnessHub }))
);
const AutoTravelHub = lazy(() => import('./tools/AutoTravelHub').then((m) => ({ default: m.AutoTravelHub })));
const CreatorDesignHub = lazy(() =>
  import('./tools/CreatorDesignHub').then((m) => ({ default: m.CreatorDesignHub }))
);
const PeriodicTableStudio = lazy(() =>
  import('./tools/SubToolsExpansionV5').then((m) => ({ default: m.PeriodicTableStudio }))
);
const BillSplitterStudio = lazy(() =>
  import('./tools/SubToolsExpansionV5').then((m) => ({ default: m.BillSplitterStudio }))
);
const HttpChmodStudio = lazy(() =>
  import('./tools/SubToolsExpansionV5').then((m) => ({ default: m.HttpChmodStudio }))
);
const MarkdownTableStudio = lazy(() =>
  import('./tools/SubToolsExpansionV5').then((m) => ({ default: m.MarkdownTableStudio }))
);
const TournamentBracketStudio = lazy(() =>
  import('./tools/SubToolsExpansionV5').then((m) => ({ default: m.TournamentBracketStudio }))
);
const MinesweeperProStudio = lazy(() =>
  import('./tools/SubToolsExpansionV5').then((m) => ({ default: m.MinesweeperProStudio }))
);
const AiAssistantHub = lazy(() =>
  import('./tools/AiAssistantHub').then((m) => ({ default: m.AiAssistantHub }))
);
const EmbeddedAiHelperBar = lazy(() =>
  import('./tools/AiAssistantHub').then((m) => ({ default: m.EmbeddedAiHelperBar }))
);
const JojoAndAdult18Hub = lazy(() =>
  import('./tools/JojoAndAdult18Hub').then((m) => ({ default: m.JojoAndAdult18Hub }))
);
const BreastSizeCalcStudio = lazy(() =>
  import('./tools/JojoAndAdult18Hub').then((m) => ({ default: m.BreastSizeCalcStudio }))
);
const NealFunSuiteHub = lazy(() =>
  import('./tools/NealFunSuiteHub').then((m) => ({ default: m.NealFunSuiteHub }))
);
const PcMaterialsStyleHub = lazy(() =>
  import('./tools/PcMaterialsStyleHub').then((m) => ({ default: m.PcMaterialsStyleHub }))
);
const CarSpecsStudio = lazy(() =>
  import('./tools/PcMaterialsStyleHub').then((m) => ({ default: m.CarSpecsStudio }))
);
const RoutePlannerStudio = lazy(() =>
  import('./tools/PcMaterialsStyleHub').then((m) => ({ default: m.RoutePlannerStudio }))
);
const ColorMatchingProStudio = lazy(() =>
  import('./tools/PcMaterialsStyleHub').then((m) => ({ default: m.ColorMatchingProStudio }))
);
const GamingWikisHub = lazy(() =>
  import('./tools/GamingWikisHub').then((m) => ({ default: m.GamingWikisHub }))
);
const SportsPhysicsSimHub = lazy(() =>
  import('./tools/SportsPhysicsSimHub').then((m) => ({ default: m.SportsPhysicsSimHub }))
);
const CosmosMicroMathHub = lazy(() =>
  import('./tools/CosmosMicroMathHub').then((m) => ({ default: m.CosmosMicroMathHub }))
);
const CultureStatsBuildersHub = lazy(() =>
  import('./tools/CultureStatsBuildersHub').then((m) => ({ default: m.CultureStatsBuildersHub }))
);

interface Props {
  isNativeTma?: boolean;
  categories: ToolCategory[];
  categoryUsage?: Record<string, number>;
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

interface IntuitiveSearchResult {
  query: string;
  tools: { id: string; title: string; emoji: string; category_id: string }[];
  articles: {
    id: string;
    kind: string;
    title: string;
    subtitle: string;
    ru_text: string;
    orig_text: string;
    orig_lang: string;
    target_category: string;
    target_tool: string;
  }[];
  instant?: { kind: string; title: string; output: string } | null;
}

const CATEGORY_COVERS: Record<string, string> = {
  ai_assistant: '/art/category-science.webp',
  jojo_adult_encyc: '/art/category-play.webp',
  neal_fun_lab: '/art/category-play.webp',
  pc_materials_style: '/art/category-engineering.webp',
  gaming_wikis: '/art/category-play.webp',
  sports_physics_3d: '/art/category-play.webp',
  cosmos_micro_math: '/art/category-science.webp',
  tests_builders_lore: '/art/category-science.webp',
  horoscope: '/art/category-life.webp',
  physics: '/art/category-science.webp',
  universes: '/art/category-play.webp',
  workspace: '/art/category-life.webp',
  calc: '/art/category-engineering.webp',
  qr: '/art/category-creative.webp',
  image: '/art/category-creative.webp',
  pdf: '/art/category-creative.webp',
  text: '/art/category-creative.webp',
  security: '/art/category-engineering.webp',
  dev: '/art/category-engineering.webp',
  knowledge: '/art/category-science.webp',
  party: '/art/category-play.webp',
  arcade: '/art/category-play.webp',
  audio_device: '/art/category-engineering.webp',
  brain_reflex: '/art/category-life.webp',
  health: '/art/category-life.webp',
  auto_travel: '/art/category-engineering.webp',
  creator_design: '/art/category-creative.webp',
  social: '/art/category-play.webp',
  health_reference: '/art/category-life.webp',
  daily_planning: '/art/category-life.webp',
  home_engineering: '/art/category-engineering.webp',
  culture_games: '/art/category-play.webp',
};

const getCategoryCover = (categoryId: string) =>
  CATEGORY_COVERS[categoryId] || '/art/tool-discovery-hero.webp';

const CategoryCoverImage: React.FC<{ categoryId: string; className: string }> = ({ categoryId, className }) => (
  <img
    src={getCategoryCover(categoryId)}
    alt=""
    aria-hidden="true"
    loading="lazy"
    decoding="async"
    onError={(event) => {
      const image = event.currentTarget;
      if (!image.src.endsWith('/art/tool-discovery-hero.webp')) {
        image.src = '/art/tool-discovery-hero.webp';
      }
    }}
    className={className}
  />
);

const CATEGORY_FAVORITES_KEY = 'mtt_favorite_categories_v1';

function readCategoryFavorites(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(CATEGORY_FAVORITES_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function formatCategoryVisits(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  const noun = last === 1 && lastTwo !== 11
    ? 'раз'
    : last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)
      ? 'раза'
      : 'раз';
  return `Открывали ${count} ${noun}`;
}

const ToolDiscoveryBanner: React.FC<{
  categories: ToolCategory[];
  onOpenPalette: () => void;
  onRandomCategory: () => void;
}> = ({ categories, onOpenPalette, onRandomCategory }) => {
  const toolCount = categories.reduce((total, category) => total + category.tools.length, 0);

  return (
    <section className="group relative isolate min-h-[168px] overflow-hidden rounded-2xl border border-indigo-300/15 bg-[#080d1c] shadow-[0_18px_60px_-34px_rgba(99,102,241,.55)] sm:min-h-[184px]">
      <img
        src="/art/tool-discovery-hero.webp"
        alt=""
        aria-hidden="true"
        loading="eager"
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover object-[center_52%] transition-transform duration-700 group-hover:scale-[1.025]"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#070b18] via-[#070b18]/95 via-50% to-[#070b18]/15" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#070b18]/55 via-transparent to-[#070b18]/10" />
      <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5" />
      <div className="relative flex min-h-[168px] max-w-[88%] flex-col justify-center p-4 sm:min-h-[184px] sm:max-w-[72%] sm:p-6">
        <div className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-indigo-300/20 bg-indigo-950/60 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.18em] text-indigo-200 sm:text-[10px]">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_#67e8f9]" />
          Цифровая мастерская
        </div>
        <h2 className="max-w-xl font-display text-lg font-bold leading-tight tracking-tight text-white sm:text-2xl">
          Найди инструмент для своей идеи
        </h2>
        <p className="mt-1.5 max-w-lg text-[11px] leading-relaxed text-slate-300 sm:text-sm">
          Учись, создавай, считай и исследуй — всё в одном пространстве.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2.5 sm:mt-4">
          <button
            type="button"
            onClick={onOpenPalette}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-indigo-300/25 bg-indigo-500/20 px-3 py-2 text-[11px] font-semibold text-white shadow-lg shadow-indigo-950/30 transition hover:border-indigo-200/50 hover:bg-indigo-500/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 sm:text-xs"
          >
            <Search className="h-3.5 w-3.5" />
            Найти инструмент
          </button>
          <button
            type="button"
            onClick={onRandomCategory}
            aria-label="Открыть случайный раздел"
            title="Открыть случайный раздел"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-[11px] font-semibold text-slate-200 transition hover:border-cyan-200/30 hover:bg-cyan-950/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 sm:text-xs"
          >
            <Dices className="h-3.5 w-3.5 text-cyan-200" />
            <span className="hidden sm:inline">Сюрприз</span>
          </button>
          <span className="text-[10px] font-mono text-slate-300 sm:text-xs">
            <b className="text-white">{categories.length}</b> разделов
            <span className="mx-1.5 text-slate-500">·</span>
            <b className="text-white">{toolCount}</b> инструментов
          </span>
        </div>
      </div>
    </section>
  );
};

export const MiniAppStudio: React.FC<Props> = ({
  isNativeTma = false,
  categories,
  categoryUsage = {},
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
  const [intuitiveRes, setIntuitiveRes] = useState<IntuitiveSearchResult | null>(null);
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null);
  const [knowledgeSearchSeed, setKnowledgeSearchSeed] = useState<string>('');
  const [quickBusy, setQuickBusy] = useState(false);
  const [showMobile3D, setShowMobile3D] = useState(true);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [categoryView, setCategoryView] = useState<'all' | 'favorites' | 'popular'>('all');
  const [categoryFavorites, setCategoryFavorites] = useState<string[]>(readCategoryFavorites);
  const topAnchorRef = useRef<HTMLDivElement>(null);

  const currentCat = categories.find((c) => c.id === activeCategory) || categories[0];
  const currentToolObj = currentCat?.tools.find((t) => t.id === activeTool) || currentCat?.tools[0];

  useEffect(() => {
    try {
      localStorage.setItem(CATEGORY_FAVORITES_KEY, JSON.stringify(categoryFavorites));
    } catch {
      // Keep the directory usable if browser storage is unavailable.
    }
  }, [categoryFavorites]);

  const toggleCategoryFavorite = (categoryId: string) => {
    setCategoryFavorites((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId]
    );
  };

  const openRandomCategory = () => {
    const candidates = visibleCategories.filter((category) => category.id !== activeCategory);
    const choices = candidates.length > 0 ? candidates : categories;
    if (choices.length === 0) return;
    const picked = choices[Math.floor(Math.random() * choices.length)];
    onSelectCategory(picked.id);
  };

  const normalizedCategoryQuery = categoryQuery.trim().toLocaleLowerCase('ru');
  const isCategoryFilterActive = categoryView !== 'all' || Boolean(normalizedCategoryQuery);
  const visibleCategories = categories
    .filter((category) => {
      if (categoryView === 'favorites' && !categoryFavorites.includes(category.id)) return false;
      if (!normalizedCategoryQuery) return true;
      const searchableText = [category.title, category.short, ...category.tools.flatMap((tool) => [tool.title, tool.desc])]
        .join(' ')
        .toLocaleLowerCase('ru');
      return searchableText.includes(normalizedCategoryQuery);
    })
    .sort((a, b) => {
      if (categoryView !== 'popular') return categories.indexOf(a) - categories.indexOf(b);
      return (categoryUsage[b.id] || 0) - (categoryUsage[a.id] || 0)
        || b.tools.length - a.tools.length
        || a.title.localeCompare(b.title, 'ru');
    });

  // Scroll to top immediately when switching category or entering a section on mobile
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    topAnchorRef.current?.scrollIntoView({ block: 'start' });
  }, [activeCategory, mobileDrillOpen]);

  // Live debounced Intuitive Omni-Search (tools + bilingual encyclopedia + slang routing)
  useEffect(() => {
    const q = quickInput.trim();
    if (!q) {
      setIntuitiveRes(null);
      setExpandedArticleId(null);
      return;
    }
    const timer = setTimeout(() => {
      apiGet(`/api/v2/search/intuitive?q=${encodeURIComponent(q)}`)
        .then((res) => {
          setIntuitiveRes(res);
          if (res?.instant) {
            setQuickRes(res.instant);
          }
        })
        .catch(() => {});
    }, 180);
    return () => clearTimeout(timer);
  }, [quickInput]);

  const runQuickBar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = quickInput.trim();
    if (!q) return;
    setQuickBusy(true);
    try {
      if (/^[+-]?\d/.test(q)) {
        try {
          const u = await apiPost('/api/v2/units/smart', { query: q });
          const topConv = (u.conversions || [])
            .slice(0, 3)
            .map((c: any) => `${c.formatted} ${c.unit}`)
            .join(' • ');
          const disp = u.parsed_display || u.recognized_input || `${u.value ?? ''} ${u.from_label ?? ''}`.trim() || q;
          const hint = u.real_world_hint || u.fun_comparison || '';
          setQuickRes({
            kind: 'Конвертер величин',
            title: disp,
            output: topConv + (hint ? ` (${hint})` : ''),
          });
          onRefreshWorkspace();
          return;
        } catch {
          // Not a unit phrase (e.g. math expression or IP/subnet) — continue cleanly
        }
      }

      try {
        const r = await apiPost('/api/tools/omni', { text: q });
        if (r && r.kind && r.kind !== 'text' && r.kind !== 'empty' && r.output) {
          setQuickRes({ kind: r.kind, title: r.title, output: r.output });
          onRefreshWorkspace();
          return;
        }
      } catch {
        // fallback to intuitive encyclopedia search
      }

      const ir = await apiGet(`/api/v2/search/intuitive?q=${encodeURIComponent(q)}`);
      setIntuitiveRes(ir);
      if (ir?.instant?.output) {
        setQuickRes(ir.instant);
      } else if (ir?.articles?.length) {
        setQuickRes({
          kind: ir.articles[0].kind || 'Энциклопедия',
          title: ir.articles[0].title,
          output: ir.articles[0].snippet || '',
        });
      }
    } catch (err: any) {
      onToast(err.message || 'Запрос обработан');
    } finally {
      setQuickBusy(false);
    }
  };

  const openArticleInHub = (art: IntuitiveSearchResult['articles'][number]) => {
    const seedKeyword = art.title.split('—')[0].replace(/[^\p{L}\p{N}\s-]/gu, '').trim();
    setKnowledgeSearchSeed(seedKeyword);
    onSelectTool(art.target_category || 'knowledge', art.target_tool || 'religions_hub');
    setQuickInput('');
    setIntuitiveRes(null);
  };

  const renderIntuitivePanel = () => {
    if (!quickInput.trim() && !quickRes) return null;
    const hasTools = (intuitiveRes?.tools?.length || 0) > 0;
    const hasArticles = (intuitiveRes?.articles?.length || 0) > 0;
    if (!quickRes && !hasTools && !hasArticles) return null;

    return (
      <div className="p-3.5 rounded-2xl bg-slate-950/95 border border-indigo-500/35 shadow-2xl space-y-3 animate-view-in">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" /> Интуитивный поиск и вычисления
          </div>
          <button
            type="button"
            onClick={() => {
              setQuickInput('');
              setQuickRes(null);
              setIntuitiveRes(null);
              setExpandedArticleId(null);
            }}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Instant calculation / unit conversion */}
        {quickRes && (
          <div className="p-3 rounded-xl bg-indigo-500/12 border border-indigo-400/35 flex items-center justify-between gap-2 text-xs sm:text-sm">
            <div className="min-w-0">
              <span className="text-indigo-300 font-semibold">{quickRes.title}: </span>
              <span className="font-mono text-white break-all">{quickRes.output}</span>
            </div>
            <button
              type="button"
              onClick={() => copyText(quickRes.output, onToast)}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white shrink-0"
            >
              Копировать
            </button>
          </div>
        )}

        {/* Matching tools */}
        {hasTools && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono uppercase text-slate-400">Инструменты по запросу</div>
            <div className="flex flex-wrap gap-1.5">
              {intuitiveRes!.tools.map((t) => (
                <button
                  key={`${t.category_id}:${t.id}`}
                  type="button"
                  onClick={() => {
                    onSelectTool(t.category_id, t.id);
                    setQuickInput('');
                    setIntuitiveRes(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-indigo-500/20 border border-white/15 hover:border-indigo-400/50 text-xs text-white transition flex items-center gap-1.5"
                >
                  <span>{t.emoji}</span>
                  <span>{t.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Encyclopedia / Constitutions / World Religions (RU + Original) */}
        {hasArticles && (
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase text-emerald-300 flex items-center gap-1">
              <BookOpen className="w-3 h-3" /> Энциклопедия, статьи и первоисточники (RU + Оригинал)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {intuitiveRes!.articles.map((art) => {
                const isExp = expandedArticleId === art.id;
                return (
                  <div
                    key={art.id}
                    className="p-3 rounded-xl bg-slate-900/90 border border-white/10 hover:border-emerald-400/40 transition space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white leading-snug">{art.title}</div>
                        <div className="text-[10px] text-emerald-300/90 mt-0.5">{art.subtitle}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-200 text-[10px] font-mono shrink-0">
                        {art.orig_lang || 'RU'}
                      </span>
                    </div>

                    <p className={`text-[11px] text-slate-300 leading-relaxed ${isExp ? '' : 'line-clamp-3'}`}>
                      {art.ru_text}
                    </p>

                    {isExp && art.orig_text && (
                      <div className="p-2.5 rounded-lg bg-slate-950/90 border border-amber-400/25 space-y-1">
                        <div className="text-[10px] font-mono text-amber-300">Оригинал ({art.orig_lang}):</div>
                        <p className="text-[11px] text-amber-100/95 leading-relaxed whitespace-pre-line">
                          {art.orig_text}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setExpandedArticleId(isExp ? null : art.id)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-slate-200 transition"
                      >
                        {isExp ? 'Свернуть текст' : 'Читать RU + Оригинал'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openArticleInHub(art)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-[11px] text-emerald-200 font-semibold transition"
                      >
                        Открыть раздел →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderActiveHubInner = () => {
    // Standalone v6 tool overrides inside existing categories
    if (activeTool === 'breast_size_calc') {
      return <BreastSizeCalcStudio onSync={onRefreshWorkspace} onToast={onToast} />;
    }
    if (activeTool === 'car_specs_catalog') {
      return <CarSpecsStudio onToast={onToast} />;
    }
    if (activeTool === 'route_planner_calc') {
      return <RoutePlannerStudio onSync={onRefreshWorkspace} onToast={onToast} />;
    }
    if (activeTool === 'color_matching_studio') {
      return <ColorMatchingProStudio onToast={onToast} />;
    }

    if (['health_reference', 'daily_planning', 'home_engineering', 'culture_games'].includes(activeCategory)) {
      return <EverydayLifeHub activeTool={activeTool} onToast={onToast} />;
    }

    // 8 Mega-Expansion v6 Categories
    if (activeCategory === 'ai_assistant') {
      return (
        <AiAssistantHub
          activeTool={activeTool}
          onSelectTool={(t) => onSelectTool('ai_assistant', t)}
          onSync={onRefreshWorkspace}
          onToast={onToast}
        />
      );
    }
    if (activeCategory === 'jojo_adult_encyc') {
      return (
        <JojoAndAdult18Hub
          activeTool={activeTool}
          onSelectTool={(t) => onSelectTool('jojo_adult_encyc', t)}
          onSync={onRefreshWorkspace}
          onToast={onToast}
        />
      );
    }
    if (activeCategory === 'neal_fun_lab') {
      return (
        <NealFunSuiteHub
          activeTool={activeTool}
          onSelectTool={(t) => onSelectTool('neal_fun_lab', t)}
          onSync={onRefreshWorkspace}
          onToast={onToast}
        />
      );
    }
    if (activeCategory === 'pc_materials_style') {
      return (
        <PcMaterialsStyleHub
          activeTool={activeTool}
          onSelectTool={(t) => onSelectTool('pc_materials_style', t)}
          onSync={onRefreshWorkspace}
          onToast={onToast}
        />
      );
    }
    if (activeCategory === 'gaming_wikis') {
      return (
        <GamingWikisHub
          activeTool={activeTool}
          onSelectTool={(t) => onSelectTool('gaming_wikis', t)}
        />
      );
    }
    if (activeCategory === 'sports_physics_3d') {
      return (
        <SportsPhysicsSimHub
          activeTool={activeTool}
          onSelectTool={(t) => onSelectTool('sports_physics_3d', t)}
          onSync={onRefreshWorkspace}
        />
      );
    }
    if (activeCategory === 'cosmos_micro_math') {
      return (
        <CosmosMicroMathHub
          activeTool={activeTool}
          onSelectTool={(t) => onSelectTool('cosmos_micro_math', t)}
          onSync={onRefreshWorkspace}
        />
      );
    }
    if (activeCategory === 'tests_builders_lore') {
      return (
        <CultureStatsBuildersHub
          activeTool={activeTool}
          onSelectTool={(t) => onSelectTool('tests_builders_lore', t)}
          onSync={onRefreshWorkspace}
          onToast={onToast}
        />
      );
    }

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
    if (activeCategory === 'universes') {
      return (
        <UniversesHub
          activeTool={activeTool}
          onSelectTool={(t) => onSelectTool('universes', t)}
          onSync={onRefreshWorkspace}
          onToast={onToast}
        />
      );
    }
    if (activeCategory === 'audio_device') {
      return <AudioDeviceLabHub activeTool={activeTool} onToast={onToast} />;
    }
    if (activeCategory === 'brain_reflex') {
      return <BrainReflexHub activeTool={activeTool} onSync={onRefreshWorkspace} onToast={onToast} />;
    }
    if (activeCategory === 'health') {
      return (
        <HealthWellnessHub
          activeTool={activeTool}
          onSelectTool={(t) => onSelectTool('health', t)}
          favorites={favorites}
          onToggleFav={onToggleFav}
          onSync={onRefreshWorkspace}
          onToast={onToast}
        />
      );
    }
    if (activeCategory === 'auto_travel') {
      return (
        <AutoTravelHub
          activeTool={activeTool}
          onSelectTool={(t) => onSelectTool('auto_travel', t)}
          favorites={favorites}
          onToggleFav={onToggleFav}
          onSync={onRefreshWorkspace}
          onToast={onToast}
        />
      );
    }
    if (activeCategory === 'creator_design') {
      return (
        <CreatorDesignHub
          activeTool={activeTool}
          onSelectTool={(t) => onSelectTool('creator_design', t)}
          favorites={favorites}
          onToggleFav={onToggleFav}
          onSync={onRefreshWorkspace}
          onToast={onToast}
        />
      );
    }
    if (activeTool === 'periodic_table') {
      return <PeriodicTableStudio onToast={onToast} />;
    }
    if (activeTool === 'bill_splitter') {
      return <BillSplitterStudio onSync={onRefreshWorkspace} onToast={onToast} />;
    }
    if (activeTool === 'http_chmod_lab') {
      return <HttpChmodStudio onToast={onToast} />;
    }
    if (activeTool === 'markdown_table_fmt') {
      return <MarkdownTableStudio onToast={onToast} />;
    }
    if (activeTool === 'tournament_bracket') {
      return <TournamentBracketStudio />;
    }
    if (activeTool === 'minesweeper_pro') {
      return <MinesweeperProStudio onToast={onToast} />;
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
          searchSeed={knowledgeSearchSeed}
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
      <div className="space-y-4">
        {renderActiveHubInner()}
        {activeCategory !== 'ai_assistant' && (
          <EmbeddedAiHelperBar
            pageTitle={currentToolObj?.title || currentCat?.title || 'MULTI_TG_TOOL'}
            onOpenFullAi={() => onSelectTool('ai_assistant', 'ai_web_chat')}
            onToast={onToast}
          />
        )}
      </div>
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
          DESKTOP LAYOUT (>= 1024px): Adaptive Sidebar + Immediate Workspace
          ===================================================================== */}
      <div className="hidden lg:grid lg:grid-cols-12 lg:gap-5 items-start">
        {/* Left Sidebar */}
        <aside
          className={`col-span-3 sticky ${
            isNativeTma ? 'top-3 max-h-[calc(100vh-1.5rem)]' : 'top-16 max-h-[calc(100vh-5rem)]'
          } rounded-2xl glass-surface border border-white/10 p-3 space-y-3 overflow-y-auto`}
        >
          {profile && (
            <div className="px-2.5 py-2 rounded-xl bg-slate-950/80 border border-white/10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src="/avatar.png"
                  alt="Logo"
                  className="w-8 h-8 rounded-lg object-cover shrink-0 border border-white/15"
                />
                <div className="min-w-0">
                  <div className="text-xs font-display font-bold text-white truncate">{profile.first_name}</div>
                  <div className="text-[11px] font-mono text-slate-400 truncate">
                    Ур. {profile.rank.level} • {profile.rank.xp} XP
                  </div>
                </div>
              </div>
              <button
                onClick={onOpenPalette}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition"
                title="Палитра всех инструментов (Ctrl+K)"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          )}

          {categories.length > 0 && categoryView === 'all' && !normalizedCategoryQuery && (
            <Suspense
              fallback={<div className="h-[235px] rounded-2xl bg-slate-950/60 border border-white/5 animate-pulse" />}
            >
              <CorePolyhedron3D
                categories={categories}
                activeCategory={activeCategory}
                onSelectCategory={onSelectCategory}
              />
            </Suspense>
          )}

          <div className="space-y-1">
            <div className="px-2 flex items-center justify-between text-[11px] font-tech uppercase tracking-wider text-slate-400">
              <span>Разделы ({visibleCategories.length}/{categories.length})</span>
              <span className="text-[10px] font-mono text-indigo-300/80" title="Часто используемые разделы автоматически поднимаются выше">
                авто-топ ↑
              </span>
            </div>
            <div className="space-y-1.5 px-1">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input value={categoryQuery} onChange={(event) => setCategoryQuery(event.target.value)} placeholder="Найти раздел или инструмент" aria-label="Поиск разделов" className="w-full rounded-lg border border-white/10 bg-slate-950/80 py-2 pl-8 pr-7 text-[11px] text-white placeholder:text-slate-500 focus:border-indigo-400/60 focus:outline-none" />
                {categoryQuery && <button type="button" onClick={() => setCategoryQuery('')} aria-label="Очистить поиск" className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"><X className="h-3.5 w-3.5" /></button>}
              </div>
              <div className="grid grid-cols-3 gap-1" role="group" aria-label="Фильтр разделов">
                {([
                  ['all', 'Все'], ['favorites', `★ ${categoryFavorites.length}`], ['popular', 'Топ'],
                ] as const).map(([mode, label]) => <button key={mode} type="button" aria-pressed={categoryView === mode} onClick={() => setCategoryView(mode)} className={`rounded-md border px-1 py-1.5 text-[9px] font-semibold transition ${categoryView === mode ? 'border-indigo-300/35 bg-indigo-500/15 text-indigo-100' : 'border-white/5 bg-white/[.02] text-slate-500 hover:text-white'}`}>{label}</button>)}
              </div>
            </div>
            {visibleCategories.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/60 p-3 text-center text-[11px] text-slate-400">
                Разделы не найдены.
                <button type="button" onClick={() => { setCategoryQuery(''); setCategoryView('all'); }} className="ml-1 text-indigo-200 underline underline-offset-2">Сбросить</button>
              </div>
            ) : visibleCategories.map((cat, idx) => {
              const active = cat.id === activeCategory;
              const usageCount = categoryUsage[cat.id] || 0;
              const isHot = usageCount >= 2 && idx < 3;
              const isCategoryFavorite = categoryFavorites.includes(cat.id);
              return (
                <div key={cat.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSelectCategory(cat.id)}
                    style={active ? { boxShadow: `inset 3px 0 0 ${cat.color || '#6366f1'}, 0 6px 18px -6px ${cat.color || '#6366f1'}66` } : undefined}
                    className={`group min-w-0 flex-1 rounded-xl border px-2 py-2 text-left transition-all duration-300 flex items-center gap-2 ${active ? 'bg-slate-800/95 border-white/15 text-white font-semibold translate-x-0.5' : 'text-slate-300 hover:bg-white/5 hover:text-white border-transparent'}`}
                  >
                    <span className="relative h-9 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-slate-950">
                      <CategoryCoverImage categoryId={cat.id} className="h-full w-full object-cover opacity-75 transition duration-300 group-hover:scale-110" />
                      <span className="absolute inset-0 grid place-items-center bg-gradient-to-t from-slate-950/60 to-transparent text-lg drop-shadow">{cat.emoji}</span>
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs leading-snug">{cat.title}</span>
                    {isHot && <Flame className="h-3 w-3 shrink-0 text-amber-400" />}
                    <span className={`shrink-0 text-[10px] font-mono ${active ? 'text-sky-300' : 'text-slate-500'}`}>{cat.tools.length}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={isCategoryFavorite ? `Убрать ${cat.title} из избранных разделов` : `Добавить ${cat.title} в избранные разделы`}
                    aria-pressed={isCategoryFavorite}
                    title={isCategoryFavorite ? 'Убрать из избранных разделов' : 'Добавить в избранные разделы'}
                    onClick={() => toggleCategoryFavorite(cat.id)}
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 ${isCategoryFavorite ? 'border-amber-300/30 bg-amber-950/50 text-amber-200' : 'border-transparent text-slate-600 hover:border-white/10 hover:text-amber-100'}`}
                  ><Star className={`h-3.5 w-3.5 ${isCategoryFavorite ? 'fill-current' : ''}`} /></button>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Right Main Content */}
        <section className="col-span-9 space-y-4 min-w-0">
          <ToolDiscoveryBanner categories={categories} onOpenPalette={onOpenPalette} onRandomCategory={openRandomCategory} />
          {/* Universal Intuitive Search + Calculator Top Bar */}
          <form
            onSubmit={runQuickBar}
            className="rounded-2xl glass-surface border border-white/10 p-2.5 flex items-center gap-2 focus-within:border-indigo-400/50 transition"
          >
            <Search className="w-4 h-4 text-indigo-400 ml-2 shrink-0" />
            <input
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder="Умный поиск всего: статьи, конституции, религии, утилиты, 75 кг в фунты, (1450*1.2)/3..."
              className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
            />
            {quickInput && (
              <button
                type="button"
                onClick={() => {
                  setQuickInput('');
                  setQuickRes(null);
                  setIntuitiveRes(null);
                }}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              disabled={quickBusy}
              className="px-4 py-1.5 rounded-xl glow-btn text-white text-xs font-semibold shrink-0"
            >
              {quickBusy ? '...' : 'Найти'}
            </button>
          </form>

          {renderIntuitivePanel()}

          {/* Active Category Header + Mini 3D Hologram for Active Sub-tool */}
          {currentCat && (
            <div
              className="rounded-2xl glass-surface border border-white/10 p-4 space-y-3"
              style={{ boxShadow: `inset 0 2px 0 ${currentCat.color || '#6366f1'}` }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative h-12 w-14 shrink-0 overflow-hidden rounded-xl border border-white/15 shadow-lg">
                    <CategoryCoverImage categoryId={currentCat.id} className="h-full w-full object-cover" />
                    <span className="absolute inset-0 grid place-items-center bg-gradient-to-t from-slate-950/70 to-transparent text-2xl drop-shadow">{currentCat.emoji}</span>
                  </div>
                  <Suspense fallback={<div className="w-12 h-12 rounded-xl bg-slate-950/80 border border-white/10 shrink-0" />}>
                    <Mini3DSceneBadge
                      seed={`${currentCat.id}:${activeTool}`}
                      color={currentCat.color || '#6366f1'}
                      size={50}
                    />
                  </Suspense>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base sm:text-lg font-display font-bold text-white leading-tight truncate">
                        {currentCat.emoji} {currentCat.title}
                      </h2>
                      {currentToolObj && (
                        <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono text-sky-300">
                          {currentToolObj.emoji} {currentToolObj.title}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {currentToolObj?.desc || currentCat.short}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onToggleFav(activeTool)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition shrink-0 ${
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
                          ? 'glow-btn border-white/25 text-white font-semibold'
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

          {/* Active Tool Workspace with Choreographed 3D Stage Transition */}
          <div key={`${activeCategory}:${activeTool}`} className="animate-view-in">
            {renderActiveHub()}
          </div>
        </section>
      </div>

      {/* =====================================================================
          MOBILE & TABLET LAYOUT (< 1024px): 2-Level Drill-Down (Zero Scroll Confusion!)
          ===================================================================== */}
      <div className="lg:hidden space-y-3">
        {!mobileDrillOpen ? (
          /* LEVEL 1: CLEAN ADAPTIVE CATEGORY DIRECTORY */
          <>
            {/* Compact Mobile Top Bar + Universal Intuitive Search */}
            <div className="rounded-2xl glass-surface border border-white/10 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src="/avatar.png"
                    alt="Logo"
                    className="w-9 h-9 rounded-xl object-cover border border-white/15 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-display font-bold text-white truncate">MULTI_TG_TOOL</div>
                    {profile && (
                      <div className="text-[11px] font-mono text-slate-400 truncate">
                        {profile.first_name} • Ур. {profile.rank.level} ({profile.rank.xp} XP)
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowMobile3D((s) => !s)}
                    disabled={isCategoryFilterActive}
                    aria-pressed={showMobile3D && !isCategoryFilterActive}
                    className={`px-2.5 py-2 rounded-xl border text-xs flex items-center gap-1 transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      showMobile3D && !isCategoryFilterActive
                        ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-200'
                        : 'bg-white/5 border-white/10 text-slate-300'
                    }`}
                    title={isCategoryFilterActive ? 'Сначала сбросьте фильтр каталога' : 'Переключить 3D-навигатор'}
                  >
                    <Box className="w-3.5 h-3.5" /> 3D
                  </button>
                  <button
                    onClick={onOpenPalette}
                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200 flex items-center gap-1.5"
                  >
                    <Search className="w-3.5 h-3.5 text-indigo-400" /> Меню
                  </button>
                </div>
              </div>

              {/* Universal Intuitive Search / Calc Bar */}
              <form onSubmit={runQuickBar} className="flex gap-1.5">
                <input
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  placeholder="Поиск всего: статьи, утилиты, конституции, 75 кг в фунты..."
                  className="flex-1 rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-400"
                />
                {quickInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuickInput('');
                      setQuickRes(null);
                      setIntuitiveRes(null);
                    }}
                    className="px-2 rounded-xl bg-slate-900 border border-white/10 text-slate-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={quickBusy}
                  className="px-3.5 py-2 rounded-xl glow-btn text-white text-xs font-semibold shrink-0"
                >
                  {quickBusy ? '...' : 'ОК'}
                </button>
              </form>
            </div>

            <ToolDiscoveryBanner categories={categories} onOpenPalette={onOpenPalette} onRandomCategory={openRandomCategory} />

            {renderIntuitivePanel()}

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

            <section className="space-y-2 rounded-2xl border border-white/10 bg-slate-950/55 p-3" aria-label="Поиск и фильтры разделов">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold text-white">Выбери направление</h2>
                <span className="text-[10px] font-mono text-slate-400">{visibleCategories.length} / {categories.length}</span>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input
                  value={categoryQuery}
                  onChange={(event) => setCategoryQuery(event.target.value)}
                  placeholder="Найти раздел или инструмент внутри него"
                  aria-label="Поиск разделов и инструментов"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 py-2.5 pl-9 pr-9 text-xs text-white placeholder:text-slate-500 focus:border-indigo-400/60 focus:outline-none"
                />
                {categoryQuery && <button type="button" onClick={() => setCategoryQuery('')} aria-label="Очистить поиск разделов" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-white"><X className="h-3.5 w-3.5" /></button>}
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar" role="group" aria-label="Фильтр каталога">
                {([
                  ['all', 'Все разделы'],
                  ['favorites', `Избранные (${categoryFavorites.length})`],
                  ['popular', 'Популярные'],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={categoryView === mode}
                    onClick={() => setCategoryView(mode)}
                    className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 ${categoryView === mode ? 'border-indigo-300/40 bg-indigo-500/20 text-indigo-100' : 'border-white/5 bg-white/[.03] text-slate-400 hover:text-white'}`}
                  >{label}</button>
                ))}
              </div>
            </section>

            {/* Interactive 3D / 4D Orbital Navigator */}
            {showMobile3D && categories.length > 0 && categoryView === 'all' && !normalizedCategoryQuery && (
              <Suspense
                fallback={<div className="h-[215px] rounded-2xl bg-slate-950/60 border border-white/5 animate-pulse" />}
              >
                <CorePolyhedron3D
                  categories={categories}
                  activeCategory={activeCategory}
                  onSelectCategory={onSelectCategory}
                  compact
                />
              </Suspense>
            )}

            {/* Image-led category gallery with persistent category bookmarks */}
            {visibleCategories.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/50 px-4 py-8 text-center">
                <div className="text-2xl" aria-hidden="true">🔎</div>
                <p className="mt-2 text-sm font-semibold text-slate-200">Разделы не найдены</p>
                <p className="mt-1 text-xs text-slate-500">Попробуйте другое слово или переключите фильтр.</p>
                <button type="button" onClick={() => { setCategoryQuery(''); setCategoryView('all'); }} className="mt-3 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-indigo-200 hover:bg-white/5">Сбросить фильтры</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 stagger-3d sm:gap-3">
                {visibleCategories.map((cat, idx) => {
                  const usageCount = categoryUsage[cat.id] || 0;
                  const isHot = usageCount >= 2 && idx < 3;
                  const isCategoryFavorite = categoryFavorites.includes(cat.id);
                  return (
                    <div key={cat.id} className="group relative min-w-0">
                      <Tilt3DCard
                        accentColor={cat.color || '#6366f1'}
                        maxTilt={7}
                        onClick={() => onSelectCategory(cat.id)}
                        className={`relative flex min-h-[154px] cursor-pointer flex-col justify-between rounded-2xl border p-3.5 text-left transition sm:min-h-[174px] sm:p-4 ${activeCategory === cat.id ? 'border-indigo-300/55 shadow-[0_0_24px_-12px_rgba(129,140,248,.7)]' : 'border-white/10 hover:border-white/25'}`}
                      >
                        <CategoryCoverImage categoryId={cat.id} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#050812] via-[#070b18]/75 to-[#070b18]/15" />
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[.06] via-transparent to-transparent" />
                        <div className="relative z-[1] flex items-start justify-between gap-2 pr-8">
                          <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-slate-950/65 text-xl shadow-lg backdrop-blur-sm" aria-hidden="true">{cat.emoji}</span>
                          <div className="flex items-center gap-1.5">
                            {isHot && <span className="rounded-full border border-amber-300/20 bg-amber-950/65 px-2 py-1 text-[9px] font-bold text-amber-200">Популярно</span>}
                            <span className="rounded-lg border border-white/15 bg-slate-950/65 px-2 py-1 text-[10px] font-mono text-white backdrop-blur-sm">{cat.tools.length}</span>
                          </div>
                        </div>
                        <div className="relative z-[1] mt-5">
                          <h3 className="text-xs font-display font-bold leading-snug text-white drop-shadow sm:text-sm">{cat.title}</h3>
                          <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-slate-200/85 sm:text-[11px]">{cat.short}</p>
                          <div className="mt-2 flex items-center gap-1.5 text-[9px] font-medium text-slate-300">
                            <span>{usageCount > 0 ? formatCategoryVisits(usageCount) : 'Откройте раздел'}</span>
                            <span aria-hidden="true">→</span>
                          </div>
                        </div>
                      </Tilt3DCard>
                      <button
                        type="button"
                        aria-label={isCategoryFavorite ? `Убрать ${cat.title} из избранных разделов` : `Добавить ${cat.title} в избранные разделы`}
                        aria-pressed={isCategoryFavorite}
                        title={isCategoryFavorite ? 'Убрать из избранных разделов' : 'Добавить в избранные разделы'}
                        onClick={() => toggleCategoryFavorite(cat.id)}
                        className={`absolute right-2 top-2 z-20 grid h-8 w-8 place-items-center rounded-xl border backdrop-blur-md transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 ${isCategoryFavorite ? 'border-amber-300/35 bg-amber-950/75 text-amber-200' : 'border-white/10 bg-slate-950/70 text-slate-300 hover:border-amber-200/30 hover:text-amber-100'}`}
                      >
                        <Star className={`h-3.5 w-3.5 ${isCategoryFavorite ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* LEVEL 2: IMMEDIATE TOOL VIEW AT TOP OF SCREEN */
          <div className="space-y-3 min-w-0 animate-view-in">
            {/* Sticky Back Header + Mini 3D Badge + Horizontal Tool Switcher */}
            <div
              className={`sticky ${
                isNativeTma ? 'top-0' : 'top-12'
              } z-20 -mx-3 px-3 py-2.5 bg-[#060913]/92 backdrop-blur-xl border-b border-white/10 space-y-2`}
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
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="relative h-9 w-10 shrink-0 overflow-hidden rounded-lg border border-white/15 shadow-md">
                      <CategoryCoverImage categoryId={currentCat.id} className="h-full w-full object-cover" />
                      <span className="absolute inset-0 grid place-items-center bg-gradient-to-t from-slate-950/65 to-transparent text-lg drop-shadow">{currentCat.emoji}</span>
                    </span>
                    <div className="text-xs sm:text-sm font-display font-bold text-white truncate min-w-0">
                      {currentCat.emoji} {currentCat.title}
                    </div>
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
                            ? 'glow-btn border-white/25 text-white font-semibold'
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
            <div key={`${activeCategory}:${activeTool}`} className="min-w-0 animate-view-in">
              {renderActiveHub()}
            </div>
          </div>
        )}

        {/* Mobile Bottom Navigation Bar */}
        <nav className="fixed bottom-0 inset-x-0 z-30 bg-[#070b17]/95 backdrop-blur-xl border-t border-white/10 px-1.5 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] grid grid-cols-6 gap-1">
          <button
            onClick={onBackToCategories}
            className={`py-1 rounded-xl flex flex-col items-center justify-center text-[10px] font-medium transition ${
              !mobileDrillOpen ? 'text-indigo-400 bg-indigo-500/15' : 'text-slate-400'
            }`}
          >
            <span className="text-base leading-none">🗂️</span>
            <span className="mt-0.5 truncate">Разделы</span>
          </button>
          <button
            onClick={() => onSelectCategory('ai_assistant')}
            className={`py-1 rounded-xl flex flex-col items-center justify-center text-[10px] font-medium transition ${
              mobileDrillOpen && activeCategory === 'ai_assistant' ? 'text-sky-300 bg-sky-500/15' : 'text-slate-400'
            }`}
          >
            <span className="text-base leading-none">🤖</span>
            <span className="mt-0.5 truncate">ИИ Сеть</span>
          </button>
          <button
            onClick={() => onSelectCategory('knowledge')}
            className={`py-1 rounded-xl flex flex-col items-center justify-center text-[10px] font-medium transition ${
              mobileDrillOpen && activeCategory === 'knowledge' ? 'text-amber-300 bg-amber-500/15' : 'text-slate-400'
            }`}
          >
            <span className="text-base leading-none">🌍</span>
            <span className="mt-0.5 truncate">3D Земля</span>
          </button>
          <button
            onClick={() => onSelectCategory('arcade')}
            className={`py-1 rounded-xl flex flex-col items-center justify-center text-[10px] font-medium transition ${
              mobileDrillOpen && activeCategory === 'arcade' ? 'text-emerald-300 bg-emerald-500/15' : 'text-slate-400'
            }`}
          >
            <span className="text-base leading-none">♟️</span>
            <span className="mt-0.5 truncate">Игры</span>
          </button>
          <button
            onClick={() => onSelectCategory('jojo_adult_encyc')}
            className={`py-1 rounded-xl flex flex-col items-center justify-center text-[10px] font-medium transition ${
              mobileDrillOpen && activeCategory === 'jojo_adult_encyc'
                ? 'text-fuchsia-300 bg-fuchsia-500/15'
                : 'text-slate-400'
            }`}
          >
            <span className="text-base leading-none">🃏</span>
            <span className="mt-0.5 truncate">JoJo/18+</span>
          </button>
          <button
            onClick={onOpenPalette}
            className="py-1 rounded-xl flex flex-col items-center justify-center text-[10px] font-medium text-slate-400 active:text-white"
          >
            <span className="text-base leading-none">🔍</span>
            <span className="mt-0.5 truncate">Поиск</span>
          </button>
        </nav>
      </div>
    </div>
  );
};
