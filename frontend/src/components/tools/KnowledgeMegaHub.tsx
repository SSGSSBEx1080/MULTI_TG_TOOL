import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Compass,
  Copy,
  Globe2,
  GraduationCap,
  Languages,
  Scale,
  Search,
  Sparkles,
} from 'lucide-react';
import { apiGet, apiPost, copyText } from '../../lib/api';
import { Mini3DSceneBadge, WorldGlobeAndMath3D } from '../three/Interactive3DScenes';
import { EarthWebcams3D } from './EarthWebcams3D';

interface Props {
  activeTool: string;
  onSelectTool: (t: string) => void;
  onSync: () => void;
  onToast: (msg: string) => void;
  searchSeed?: string;
}

const toolToKnowledgeTab = (tool: string): 'earth' | 'const' | 'religions' | 'wiki' | 'ege' | 'pop' => {
  if (tool === 'earth_3d_cams' || tool === 'world_time_sun') return 'earth';
  if (tool === 'religions_hub' || tool === 'religions_compare') return 'religions';
  if (tool === 'multi_wiki') return 'wiki';
  if (tool === 'ege_formulas') return 'ege';
  if (tool === 'population_hub') return 'pop';
  return 'const';
};

export const KnowledgeMegaHub: React.FC<Props> = ({
  activeTool,
  onSelectTool,
  onSync,
  onToast,
  searchSeed = '',
}) => {
  const [subTab, setSubTab] = useState<'earth' | 'const' | 'religions' | 'wiki' | 'ege' | 'pop'>(() =>
    toolToKnowledgeTab(activeTool)
  );

  const [constQuery, setConstQuery] = useState('');
  const [constItems, setConstItems] = useState<any[]>([]);
  const [langMode, setLangMode] = useState<'both' | 'ru' | 'orig'>('both');
  const [expandedConst, setExpandedConst] = useState<Record<string, boolean>>({ RU: true, US: true });

  const [relQuery, setRelQuery] = useState('');
  const [relItems, setRelItems] = useState<any[]>([]);
  const [expandedRel, setExpandedRel] = useState<Record<string, boolean>>({ islam: true, christianity: true });

  const [wikiSection, setWikiSection] = useState<'all' | 'jojo' | 'concepts' | 'prog'>('all');
  const [wikiQuery, setWikiQuery] = useState('');
  const [wikiData, setWikiData] = useState<any>({ jojo_stands: [], concepts: [], prog_langs: [] });
  const [wikiPhotos, setWikiPhotos] = useState<Array<{ title: string; extract: string; thumb: string; url: string }>>([]);
  const wikiPhotoRequestRef = useRef(0);
  const [wikiPhotosStatus, setWikiPhotosStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [standUser, setStandUser] = useState('');
  const [rolledStand, setRolledStand] = useState<any>(null);

  const [egeSubj, setEgeSubj] = useState('all');
  const [egeQuery, setEgeQuery] = useState('');
  const [egeItems, setEgeItems] = useState<any[]>([]);

  const [popQuery, setPopQuery] = useState('');
  const [popData, setPopData] = useState<any>(null);
  const [panelStatus, setPanelStatus] = useState<Record<string, { loading: boolean; error: string }>>({});
  const [panelRetries, setPanelRetries] = useState<Record<string, number>>({});
  const popRequestId = useRef(0);
  const retryPanel = (key: string) => setPanelRetries((current) => ({ ...current, [key]: (current[key] || 0) + 1 }));
  const setPanelState = (key: string, loading: boolean, error?: string) => {
    setPanelStatus((current) => ({ ...current, [key]: { loading, error: error ?? current[key]?.error ?? '' } }));
  };

  const loadWikiPhotos = async () => {
    const searchPhrase = wikiQuery.trim();
    if (!searchPhrase) return;
    const requestId = ++wikiPhotoRequestRef.current;
    setWikiPhotos([]);
    setWikiPhotosStatus('loading');
    try {
      const response = await fetch(
        `https://ru.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(searchPhrase)}&gsrlimit=6&prop=pageimages|extracts&exintro=1&explaintext=1&exchars=240&pithumbsize=560&format=json&origin=*`,
        {referrerPolicy: 'no-referrer'}
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const pages = Object.values((data?.query?.pages || {}) as Record<string, any>);
      const illustrated = pages
        .filter((page: any) => page?.thumbnail?.source && page?.extract)
        .map((page: any) => ({
          title: String(page.title),
          extract: String(page.extract),
          thumb: String(page.thumbnail.source),
          url: `https://ru.wikipedia.org/wiki/${encodeURIComponent(String(page.title).replace(/ /g, '_'))}`,
        }));
      if (requestId !== wikiPhotoRequestRef.current) return;
      setWikiPhotos(illustrated);
      setWikiPhotosStatus('done');
    } catch {
      if (requestId === wikiPhotoRequestRef.current) setWikiPhotosStatus('error');
    }
  };

  useEffect(() => {
    setSubTab(toolToKnowledgeTab(activeTool));
  }, [activeTool]);

  useEffect(() => {
    if (!searchSeed) return;
    const tab = toolToKnowledgeTab(activeTool);
    if (tab === 'religions') setRelQuery(searchSeed);
    else if (tab === 'const') setConstQuery(searchSeed);
    else if (tab === 'wiki') setWikiQuery(searchSeed);
    else if (tab === 'ege') setEgeQuery(searchSeed);
  }, [searchSeed, activeTool]);

  useEffect(() => {
    if (subTab !== 'const') return;
    let active = true;
    setPanelState('const', true, '');
    setConstItems([]);
    const timer = window.setTimeout(() => {
      apiGet(`/api/v2/knowledge/constitutions?q=${encodeURIComponent(constQuery)}`)
        .then((r) => { if (active) setConstItems(r.items || []); })
        .catch((error: any) => { if (active) setPanelState('const', false, error?.message || 'Не удалось загрузить конституции'); })
        .finally(() => { if (active) setPanelState('const', false); });
    }, 140);
    return () => { active = false; window.clearTimeout(timer); };
  }, [subTab, constQuery, panelRetries.const]);

  useEffect(() => {
    if (subTab !== 'religions') return;
    let active = true;
    setPanelState('religions', true, '');
    setRelItems([]);
    const timer = window.setTimeout(() => {
      apiGet(`/api/v2/knowledge/religions?q=${encodeURIComponent(relQuery)}`)
        .then((r) => { if (active) setRelItems(r.items || []); })
        .catch((error: any) => { if (active) setPanelState('religions', false, error?.message || 'Не удалось загрузить статьи'); })
        .finally(() => { if (active) setPanelState('religions', false); });
    }, 140);
    return () => { active = false; window.clearTimeout(timer); };
  }, [subTab, relQuery, panelRetries.religions]);

  useEffect(() => {
    if (subTab !== 'wiki') return;
    let active = true;
    setPanelState('wiki', true, '');
    setWikiData({ jojo_stands: [], concepts: [], prog_langs: [] });
    const timer = window.setTimeout(() => {
      apiGet(`/api/v2/knowledge/wiki?section=${wikiSection}&q=${encodeURIComponent(wikiQuery)}`)
        .then((r) => { if (active) setWikiData(r); })
        .catch((error: any) => { if (active) setPanelState('wiki', false, error?.message || 'Не удалось загрузить энциклопедию'); })
        .finally(() => { if (active) setPanelState('wiki', false); });
    }, 140);
    return () => { active = false; window.clearTimeout(timer); };
  }, [subTab, wikiSection, wikiQuery, panelRetries.wiki]);

  useEffect(() => {
    if (subTab !== 'ege') return;
    let active = true;
    setPanelState('ege', true, '');
    setEgeItems([]);
    const timer = window.setTimeout(() => {
      apiGet(`/api/v2/knowledge/formulas?subject=${encodeURIComponent(egeSubj)}&q=${encodeURIComponent(egeQuery)}`)
        .then((r) => { if (active) setEgeItems(r.items || []); })
        .catch((error: any) => { if (active) setPanelState('ege', false, error?.message || 'Не удалось загрузить формулы'); })
        .finally(() => { if (active) setPanelState('ege', false); });
    }, 140);
    return () => { active = false; window.clearTimeout(timer); };
  }, [subTab, egeSubj, egeQuery, panelRetries.ege]);

  const loadPop = (q = popQuery) => {
    const currentRequest = ++popRequestId.current;
    setPanelState('pop', true, '');
    setPopData(null);
    apiGet(`/api/v2/knowledge/population?q=${encodeURIComponent(q)}`)
      .then((r) => { if (currentRequest === popRequestId.current) setPopData(r); })
      .catch((error: any) => {
        if (currentRequest === popRequestId.current) setPanelState('pop', false, error?.message || 'Не удалось загрузить данные о населении');
      })
      .finally(() => { if (currentRequest === popRequestId.current) setPanelState('pop', false); });
  };

  useEffect(() => {
    if (subTab === 'pop' && !popData) {
      loadPop(popQuery);
    }
  }, [subTab]);

  const rollStand = async () => {
    try {
      const r = await apiPost('/api/v2/knowledge/roll-stand', { name: standUser });
      setRolledStand(r.stand);
      onSync();
    } catch (e: any) {
      onToast(e.message || 'Ошибка расчёта Стенда');
    }
  };

  return (
    <div className="space-y-4 min-w-0">
      {/* 0. GOOGLE EARTH 3D + PUBLIC LIVE WEBCAMS + SOLAR TERMINATOR */}
      {subTab === 'earth' && (
        <EarthWebcams3D initialSearch={searchSeed} focusSunTime={activeTool === 'world_time_sun'} />
      )}

      {/* Interactive 3D Earth Globe & Lorenz Chaotic Attractor for Reference Tabs */}
      {subTab !== 'earth' && (
        <WorldGlobeAndMath3D
          mode={subTab === 'ege' || subTab === 'wiki' ? 'math' : 'globe'}
          onPickQuery={(countryName) => {
            if (subTab === 'const') {
              setConstQuery(countryName);
            } else if (subTab === 'pop') {
              setPopQuery(countryName);
              loadPop(countryName);
            } else if (subTab === 'religions') {
              setRelQuery(countryName);
            } else {
              setSubTab('pop');
              onSelectTool('population_hub');
              setPopQuery(countryName);
            }
            onToast(`🌍 Выбрано на 3D-глобусе: ${countryName}`);
          }}
        />
      )}

      {/* 1. BILINGUAL CONSTITUTIONS (RUSSIAN + ORIGINAL LANGUAGE) */}
      {subTab === 'const' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Mini3DSceneBadge seed="constitutions_hub" color="#eab308" size={38} />
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Scale className="w-5 h-5 text-amber-400" /> Конституции Стран Мира (Русский + Оригинал)
                </h3>
                <p className="text-xs text-slate-400">
                  Полные тексты преамбул и фундаментальных статей на русском и языке подлинника
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <div className="flex rounded-xl bg-slate-950 p-1 border border-white/10 text-[11px]">
                {(
                  [
                    { id: 'both', label: 'RU + Оригинал' },
                    { id: 'ru', label: 'Русский' },
                    { id: 'orig', label: 'Оригинал' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setLangMode(m.id)}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                      langMode === m.id
                        ? 'bg-amber-500/25 text-amber-200 border border-amber-400/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  value={constQuery}
                  onChange={(e) => setConstQuery(e.target.value)}
                  placeholder="Поиск по странам и статьям (РФ, США, ФРГ, We the People)..."
                  className="w-full rounded-xl bg-slate-950 border border-white/10 pl-9 pr-3 py-2 text-xs text-white"
                />
              </div>
            </div>
          </div>

          {panelStatus.const?.loading && <p role="status" className="text-xs text-amber-200">Поиск по конституциям…</p>}
          {panelStatus.const?.error && <div className="flex flex-wrap items-center gap-2"><p role="alert" className="text-xs text-rose-200">{panelStatus.const.error}</p><button type="button" onClick={() => retryPanel('const')} className="rounded-lg border border-rose-300/20 px-2.5 py-1 text-[10px] text-rose-100">Повторить</button></div>}
          <div className="space-y-3.5">
            {constItems.map((c, idx) => {
              const isOpen = expandedConst[c.code] ?? idx === 0;
              return (
                <div
                  key={c.code}
                  className="p-4 rounded-2xl bg-slate-950/90 border border-white/10 space-y-3 transition hover:border-amber-400/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                      <span className="text-xl">{c.flag}</span> {c.country}
                      {c.orig_lang && (
                        <span className="text-[11px] font-normal px-2 py-0.5 rounded-md bg-white/5 text-slate-300 border border-white/10 flex items-center gap-1">
                          <Languages className="w-3 h-3 text-sky-400" /> {c.orig_lang}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30">
                        {c.year} (ред. {c.updated})
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedConst((prev) => ({ ...prev, [c.code]: !isOpen }))
                        }
                        className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-amber-200 flex items-center gap-1"
                      >
                        {isOpen ? (
                          <>
                            Свернуть статьи <ChevronUp className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <>
                            Читать полный текст <ChevronDown className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-sky-300 font-medium">
                    {c.gov_form} • <span className="text-slate-400">{c.structure}</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">{c.key_principles}</p>

                  {isOpen && (
                    <div className="space-y-3 pt-2 border-t border-white/10">
                      {(c.preamble_ru || c.preamble_orig) && (
                        <div className="p-3 rounded-xl bg-slate-900/90 border border-indigo-500/25 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                              Преамбула (Preamble)
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                copyText(
                                  `${c.country} — Преамбула\n\nRU: ${c.preamble_ru}\n\nORIG: ${c.preamble_orig}`,
                                  onToast
                                )
                              }
                              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                            >
                              <Copy className="w-3 h-3" /> Копировать
                            </button>
                          </div>
                          <div
                            className={`grid gap-3 ${
                              langMode === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
                            }`}
                          >
                            {langMode !== 'orig' && c.preamble_ru && (
                              <div className="text-xs text-slate-100 leading-relaxed bg-slate-950/70 p-2.5 rounded-lg border border-white/5">
                                <div className="text-[10px] font-bold text-amber-300 mb-1">🇷🇺 На русском языке:</div>
                                {c.preamble_ru}
                              </div>
                            )}
                            {langMode !== 'ru' && c.preamble_orig && (
                              <div className="text-xs text-sky-100 leading-relaxed bg-slate-950/70 p-2.5 rounded-lg border border-sky-500/15 font-serif">
                                <div className="text-[10px] font-sans font-bold text-sky-300 mb-1">
                                  📜 Текст оригинала ({c.orig_lang}):
                                </div>
                                {c.preamble_orig}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {Array.isArray(c.articles) &&
                        c.articles.map((art: any, aIdx: number) => (
                          <div
                            key={aIdx}
                            className="p-3 rounded-xl bg-slate-900/75 border border-white/10 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-amber-300">
                                {art.num} — <span className="text-white">{art.title}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  copyText(`${c.country} ${art.num}\n${art.ru}\n\n${art.orig}`, onToast)
                                }
                                className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 shrink-0"
                              >
                                <Copy className="w-3 h-3" /> Копия
                              </button>
                            </div>
                            <div
                              className={`grid gap-3 ${
                                langMode === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
                              }`}
                            >
                              {langMode !== 'orig' && (
                                <div className="text-xs text-slate-200 whitespace-pre-line leading-relaxed bg-slate-950/60 p-2.5 rounded-lg border border-white/5">
                                  {art.ru}
                                </div>
                              )}
                              {langMode !== 'ru' && (
                                <div className="text-xs text-sky-100/95 whitespace-pre-line leading-relaxed bg-slate-950/60 p-2.5 rounded-lg border border-sky-500/15">
                                  {art.orig}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-400/20 text-[11px] text-amber-200">
                    💡 <b>Особенность конституции:</b> {c.unique_fact}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. WORLD RELIGIONS (FULL ARTICLES + ORIGINAL QUOTES) */}
      {subTab === 'religions' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Mini3DSceneBadge seed="religions_hub" color="#a855f7" size={38} />
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Compass className="w-5 h-5 text-amber-400" /> Энциклопедия Мировых Религий и Первоисточников
                </h3>
                <p className="text-xs text-slate-400">
                  Полные статьи, история, столпы вероучения и ключевые тексты на языке оригинала и на русском
                </p>
              </div>
            </div>
            <input
              value={relQuery}
              onChange={(e) => setRelQuery(e.target.value)}
              placeholder="Поиск (Ислам, Коран, Христианство, Буддизм, Тора...)"
              className="w-full sm:w-72 rounded-xl bg-slate-950 border border-white/10 px-3.5 py-2 text-xs text-white"
            />
          </div>

          {panelStatus.religions?.loading && <p role="status" className="text-xs text-purple-200">Ищем статьи…</p>}
          {panelStatus.religions?.error && <div className="flex flex-wrap items-center gap-2"><p role="alert" className="text-xs text-rose-200">{panelStatus.religions.error}</p><button type="button" onClick={() => retryPanel('religions')} className="rounded-lg border border-rose-300/20 px-2.5 py-1 text-[10px] text-rose-100">Повторить</button></div>}
          <div className="grid grid-cols-1 gap-3.5">
            {relItems.map((r) => {
              const isOpen = expandedRel[r.id] ?? true;
              return (
                <div
                  key={r.id}
                  className="p-4 rounded-2xl bg-slate-950/90 border border-white/10 space-y-2.5 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-base font-bold text-white flex flex-wrap items-center gap-2">
                      <span className="text-xl">{r.emoji}</span> {r.name}
                      {r.orig_script && (
                        <span className="text-xs font-normal text-amber-300/90 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-400/20">
                          {r.orig_script}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-400/30">
                        {r.followers}
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpandedRel((p) => ({ ...p, [r.id]: !isOpen }))}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10"
                      >
                        {isOpen ? 'Свернуть' : 'Полная статья'}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                    <div className="p-2 rounded-lg bg-slate-900/80 border border-white/5 text-slate-400">
                      🏛 Возникновение: <span className="text-slate-200">{r.origin}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/80 border border-white/5 text-slate-400">
                      📖 Писание: <span className="text-amber-300 font-medium">{r.scripture}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/80 border border-white/5 text-slate-400">
                      🌿 Направления: <span className="text-sky-300">{r.branches}</span>
                    </div>
                  </div>

                  {isOpen && r.full_article_ru && (
                    <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 text-xs text-slate-100 whitespace-pre-line leading-relaxed">
                      {r.full_article_ru}
                    </div>
                  )}

                  {isOpen && (r.primary_quote_orig || r.primary_quote_ru) && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 p-3 rounded-xl bg-indigo-950/30 border border-indigo-400/25">
                      <div>
                        <div className="text-[10px] font-bold text-sky-300 mb-1">📜 Первоисточник (оригинал):</div>
                        <div className="text-xs text-sky-100 leading-relaxed">{r.primary_quote_orig}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-amber-300 mb-1">🇷🇺 Перевод на русский:</div>
                        <div className="text-xs text-slate-200 leading-relaxed">{r.primary_quote_ru}</div>
                      </div>
                    </div>
                  )}

                  <div className="p-2 rounded-lg bg-white/5 text-slate-300">
                    🕯 <b>Традиции и практика:</b> {r.practices}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. MULTI-WIKI (JOJO STANDS + CONCEPTS + PROG LANGS) */}
      {subTab === 'wiki' && (
        <div className="space-y-4">
          {/* Stand Awakener Banner */}
          <div className="rounded-2xl border border-purple-400/35 bg-gradient-to-r from-purple-950/70 via-slate-900 to-indigo-950/70 p-4 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-sm font-bold text-purple-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" /> Стрела Реквиема: узнай свой Стенд из JoJo (Части 3–9)!
              </div>
              <p className="text-xs text-slate-300">Введите своё имя/ник для персонального расчёта или оставьте пустым для случайного Стенда:</p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <input
                value={standUser}
                onChange={(e) => setStandUser(e.target.value)}
                placeholder="Ваше имя или пусто..."
                className="flex-1 md:w-48 rounded-xl bg-slate-950/90 border border-white/15 px-3 py-2 text-xs text-white"
              />
              <button
                onClick={rollStand}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-pink-500 text-slate-950 font-bold text-xs shrink-0"
              >
                🃏 Пробудить Стенд!
              </button>
            </div>
          </div>

          {rolledStand && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-amber-400/50 space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-black text-amber-300">🌟 Ваш Стенд: {rolledStand.name} ({rolledStand.part})</div>
                <button
                  type="button"
                  onClick={() => copyText(`${rolledStand.name} (${rolledStand.part}) — ${rolledStand.ability}`, onToast)}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] text-white shrink-0"
                >
                  Копировать
                </button>
              </div>
              <div className="text-purple-300">Каноничный владелец: <b>{rolledStand.user}</b> • Статы: <code>{rolledStand.stats}</code></div>
              <p className="text-slate-200">{rolledStand.ability}</p>
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-5 space-y-4">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: '📚 Вся Мульти-Вики' },
                  { id: 'jojo', label: '🃏 Стенды JoJo (ч. 3–9)' },
                  { id: 'concepts', label: '🧠 Умные понятия & Лор' },
                  { id: 'prog', label: '💻 Языки Программирования' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setWikiSection(s.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs border transition ${
                      wikiSection === s.id
                        ? 'bg-purple-500/25 border-purple-400/50 text-purple-200 font-semibold'
                        : 'bg-slate-950 border-white/10 text-slate-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  value={wikiQuery}
                  onChange={(e) => { wikiPhotoRequestRef.current += 1; setWikiQuery(e.target.value); setWikiPhotos([]); setWikiPhotosStatus('idle'); }}
                  placeholder="Поиск в локальной базе: Wonder of U, Rust…"
                  className="w-full min-w-0 rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                  aria-label="Поиск по встроенной энциклопедии"
                />
                <button
                  type="button"
                  onClick={loadWikiPhotos}
                  disabled={!wikiQuery.trim() || wikiPhotosStatus === 'loading'}
                  className="px-3 py-2 rounded-xl border border-amber-300/20 bg-amber-400/10 text-xs font-semibold text-amber-100 disabled:opacity-50"
                >
                  {wikiPhotosStatus === 'loading' ? 'Загрузка…' : 'Иллюстрации из Wikipedia'}
                </button>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">Локальный каталог работает без внешнего поиска. Только по нажатию кнопки введённая фраза отправляется в Wikipedia; после ответа браузер загружает выбранные миниатюры с её серверов.</p>
              {wikiPhotosStatus === 'error' && <p role="status" className="text-xs text-rose-200">Внешний поиск Wikipedia не удался. Каталог на этой странице продолжает работать.</p>}
              {wikiPhotosStatus === 'done' && wikiPhotos.length === 0 && <p role="status" className="text-xs text-slate-400">Wikipedia не вернула статей с изображениями для этого запроса.</p>}
            </div>

            <div className="space-y-5 max-h-[680px] overflow-y-auto pr-1">
              {panelStatus.wiki?.loading && <p role="status" className="text-xs text-purple-200">Поиск по встроенной энциклопедии…</p>}
              {panelStatus.wiki?.error && <div className="flex flex-wrap items-center gap-2"><p role="alert" className="text-xs text-rose-200">{panelStatus.wiki.error}</p><button type="button" onClick={() => retryPanel('wiki')} className="rounded-lg border border-rose-300/20 px-2.5 py-1 text-[10px] text-rose-100">Повторить</button></div>}
              {wikiPhotos.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    🖼️ Иллюстрированные статьи Wikipedia · запрос «{wikiQuery.trim()}»
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {wikiPhotos.map((art) => (
                      <a
                        key={art.title}
                        href={art.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        referrerPolicy="no-referrer"
                        className="rounded-xl bg-slate-950/90 border border-white/10 hover:border-amber-400/45 overflow-hidden flex flex-col transition group"
                      >
                        <img
                          src={art.thumb}
                          alt={art.title}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="w-full h-36 object-cover group-hover:scale-[1.03] transition"
                        />
                        <div className="p-3 space-y-1 text-xs">
                          <div className="font-bold text-white group-hover:text-amber-200">{art.title}</div>
                          <p className="text-slate-300 line-clamp-3 leading-relaxed">{art.extract}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {wikiData.jojo_stands?.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300">🃏 Энциклопедия Стендов JoJo's Bizarre Adventure</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {wikiData.jojo_stands.map((s: any) => {
                      const rankToVal = (ch: string): number => {
                        if (ch.includes('∞') || ch.includes('S')) return 1.0;
                        if (ch.includes('A')) return 0.88;
                        if (ch.includes('B')) return 0.72;
                        if (ch.includes('C')) return 0.56;
                        if (ch.includes('D')) return 0.38;
                        if (ch.includes('E')) return 0.22;
                        return 0.6;
                      };
                      const rawParts = String(s.stats || '').split('|');
                      const vals =
                        rawParts.length >= 5
                          ? [0, 1, 2, 3, 4, 5].map((k) => rankToVal(rawParts[k] || 'B'))
                          : [0.85, 0.78, 0.6, 0.72, 0.68, 0.82];
                      const labels = ['PWR', 'SPD', 'RNG', 'DUR', 'PRC', 'POT'];
                      const cx = 44;
                      const cy = 44;
                      const maxR = 28;
                      const polyPts = vals
                        .map((v, idx) => {
                          const a = -Math.PI / 2 + (idx * Math.PI * 2) / 6;
                          return `${(cx + Math.cos(a) * maxR * v).toFixed(1)},${(cy + Math.sin(a) * maxR * v).toFixed(1)}`;
                        })
                        .join(' ');
                      const outerPts = [0, 1, 2, 3, 4, 5]
                        .map((idx) => {
                          const a = -Math.PI / 2 + (idx * Math.PI * 2) / 6;
                          return `${(cx + Math.cos(a) * maxR).toFixed(1)},${(cy + Math.sin(a) * maxR).toFixed(1)}`;
                        })
                        .join(' ');

                      return (
                        <div key={s.name} className="p-3.5 rounded-xl bg-slate-950/90 border border-purple-400/20 flex items-start gap-3 text-xs">
                          <svg viewBox="0 0 88 88" className="w-20 h-20 shrink-0">
                            <circle cx={cx} cy={cy} r={maxR} fill="rgba(88,28,135,0.22)" stroke="rgba(192,132,252,0.35)" strokeWidth="1" />
                            <polygon points={outerPts} fill="none" stroke="rgba(148,163,184,0.28)" strokeWidth="0.8" />
                            {[0, 1, 2, 3, 4, 5].map((idx) => {
                              const a = -Math.PI / 2 + (idx * Math.PI * 2) / 6;
                              const lx = cx + Math.cos(a) * (maxR + 10);
                              const ly = cy + Math.sin(a) * (maxR + 10);
                              return (
                                <g key={idx}>
                                  <line
                                    x1={cx}
                                    y1={cy}
                                    x2={cx + Math.cos(a) * maxR}
                                    y2={cy + Math.sin(a) * maxR}
                                    stroke="rgba(148,163,184,0.22)"
                                    strokeWidth="0.7"
                                  />
                                  <text
                                    x={lx}
                                    y={ly + 2.5}
                                    textAnchor="middle"
                                    fontSize="6.5"
                                    fontWeight="700"
                                    fill="#e9d5ff"
                                  >
                                    {labels[idx]}
                                  </text>
                                </g>
                              );
                            })}
                            <polygon points={polyPts} fill="rgba(232,121,249,0.38)" stroke="#facc15" strokeWidth="1.4" />
                          </svg>
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex justify-between gap-2">
                              <span className="font-bold text-white truncate">{s.name}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-200 shrink-0">{s.part}</span>
                            </div>
                            <div className="text-amber-300 text-[11px]">Владелец: {s.user}</div>
                            <div className="font-mono text-[10px] text-sky-300">{s.stats}</div>
                            <p className="text-slate-300 pt-1">{s.ability}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {wikiData.concepts?.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300">🧠 Научные, Психологические Понятия & Интернет-Лор</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {wikiData.concepts.map((c: any) => (
                      <div key={c.term} className="p-3.5 rounded-xl bg-slate-950/90 border border-emerald-400/20 space-y-1 text-xs">
                        <div className="flex justify-between gap-2">
                          <span className="font-bold text-white">{c.term}</span>
                          <span className="text-[10px] text-emerald-300">{c.cat}</span>
                        </div>
                        <p className="text-slate-300 leading-relaxed">{c.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {wikiData.prog_langs?.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-sky-300">💻 Справочник Языков Программирования</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {wikiData.prog_langs.map((l: any) => (
                      <div key={l.lang} className="p-3.5 rounded-xl bg-slate-950/90 border border-sky-400/20 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="font-bold text-white">{l.lang} ({l.year})</span>
                          <span className="text-[11px] text-sky-300">{l.typing}</span>
                        </div>
                        <div className="text-slate-400">⚡ Скорость: <span className="text-slate-200">{l.speed}</span></div>
                        <div className="text-slate-300">🎯 Где топ: {l.best_for}</div>
                        <code className="block p-2 rounded-lg bg-slate-900 text-emerald-300 font-mono text-[11px] overflow-x-auto">{l.snippet}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. EGE FORMULAS */}
      {subTab === 'ege' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-sky-400" /> Полная Шпаргалка Формул ЕГЭ / ОГЭ
              </h3>
              <p className="text-xs text-slate-400">Нажмите на любую карточку, чтобы мгновенно скопировать формулу в буфер обмена</p>
            </div>
            <input
              value={egeQuery}
              onChange={(e) => setEgeQuery(e.target.value)}
              placeholder="Поиск (Ома, логарифм, пирамида, КПД, Бернулли...)"
              className="w-full sm:w-72 rounded-xl bg-slate-950 border border-white/10 px-3.5 py-2 text-xs text-white"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {['all', 'Физика', 'Алгебра', 'Геометрия', 'Информатика', 'Химия'].map((s) => (
              <button
                key={s}
                onClick={() => setEgeSubj(s)}
                className={`px-3 py-1.5 rounded-xl text-xs border transition ${
                  egeSubj === s
                    ? 'bg-sky-500/20 border-sky-400/50 text-sky-200 font-semibold'
                    : 'bg-slate-950 border-white/10 text-slate-300'
                }`}
              >
                {s === 'all' ? '🌟 Все предметы' : s}
              </button>
            ))}
          </div>

          {panelStatus.ege?.loading && <p role="status" className="text-xs text-sky-200">Подбираем формулы…</p>}
          {panelStatus.ege?.error && <div className="flex flex-wrap items-center gap-2"><p role="alert" className="text-xs text-rose-200">{panelStatus.ege.error}</p><button type="button" onClick={() => retryPanel('ege')} className="rounded-lg border border-rose-300/20 px-2.5 py-1 text-[10px] text-rose-100">Повторить</button></div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {egeItems.map((f, idx) => (
              <div
                key={idx}
                onClick={() => copyText(`${f.name}: ${f.formula}`, onToast)}
                className="p-3.5 rounded-xl bg-slate-950/90 hover:bg-slate-950 border border-white/10 hover:border-sky-400/40 cursor-pointer transition space-y-1.5"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 font-semibold">{f.subj} • {f.topic}</span>
                  <span className="text-slate-500">Копировать</span>
                </div>
                <div className="text-xs font-semibold text-white">{f.name}</div>
                <div className="p-2.5 rounded-lg bg-slate-900 font-mono text-xs text-amber-200 overflow-x-auto">
                  {f.formula}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. POPULATION ATLAS */}
      {subTab === 'pop' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/70 to-sky-950/70 border border-emerald-400/30">
            <div className="min-w-0">
              <div className="text-xs text-emerald-300 uppercase tracking-wider font-semibold">🌍 Офлайн-справочник населения</div>
              <p className="text-sm text-slate-200 mt-1 max-w-3xl">
                Здесь нет проверенного live-счётчика. Значения в каталоге — ориентиры без единого года и определения границ; для актуальных цифр сверяйтесь с национальными статистическими службами.
              </p>
            </div>
            <Globe2 className="w-10 h-10 text-emerald-400/70 hidden sm:block shrink-0" />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {['Россия', 'Москва', 'Токио', 'Чунцин', 'Франкфурт', 'Мурино', 'Иннополис', 'Оймякон', 'Териберка', 'Шушенское', 'Моноуи'].map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPopQuery(p);
                  loadPop(p);
                }}
                className="px-2.5 py-1 rounded-full bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-400/30 text-[11px] text-emerald-200"
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => {
                setPopQuery('');
                loadPop('');
              }}
              className="px-2.5 py-1 rounded-full bg-white/10 text-[11px] text-white"
            >
              Показать все
            </button>
          </div>

          <div className="flex gap-2">
            <input
              value={popQuery}
              onChange={(e) => setPopQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadPop(popQuery)}
              placeholder="Поиск по встроенному каталогу (например: Россия, Москва, Оймякон)..."
              className="flex-1 rounded-xl bg-slate-950 border border-white/10 px-4 py-2.5 text-xs sm:text-sm text-white"
            />
            <button
              onClick={() => loadPop(popQuery)}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs shrink-0"
            >
              Найти
            </button>
          </div>

          {panelStatus.pop?.loading && <p role="status" className="text-xs text-emerald-200">Загружаем данные о населении…</p>}
          {panelStatus.pop?.error && <div className="flex flex-wrap items-center gap-2"><p role="alert" className="text-xs text-rose-200">{panelStatus.pop.error}</p><button type="button" onClick={() => loadPop(popQuery)} className="rounded-lg border border-rose-300/20 px-2.5 py-1 text-[10px] text-rose-100">Повторить</button></div>}
          {popData?.count === 0 && (
            <p role="status" className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100">
              Встроенный каталог не содержит совпадений. Мы не генерируем оценку для неизвестного населённого пункта.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(popData?.places || []).map((p: any) => (
              <div key={p.name} className="p-4 rounded-xl bg-slate-950/90 border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm text-white">{p.name}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 shrink-0">{p.type}</span>
                </div>
                <div className="text-xl font-mono font-extrabold text-amber-300">
                  {p.pop == null ? 'Нет проверенного значения' : `${p.formatted_pop} чел. (ориентир)`}
                </div>
                <div className="text-[11px] text-slate-400">{p.country}</div>
                <p className="text-xs text-slate-300">{p.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
