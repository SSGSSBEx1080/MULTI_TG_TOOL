import React, { useEffect, useState } from 'react';
import { BookOpen, Compass, Globe2, GraduationCap, Scale, Search, Sparkles } from 'lucide-react';
import { apiGet, apiPost, copyText } from '../../lib/api';

interface Props {
  activeTool: string;
  onSelectTool: (t: string) => void;
  onSync: () => void;
  onToast: (msg: string) => void;
}

export const KnowledgeMegaHub: React.FC<Props> = ({ activeTool, onSelectTool, onSync, onToast }) => {
  const [subTab, setSubTab] = useState<'const' | 'religions' | 'wiki' | 'ege' | 'pop'>('const');

  const [constQuery, setConstQuery] = useState('');
  const [constItems, setConstItems] = useState<any[]>([]);

  const [relQuery, setRelQuery] = useState('');
  const [relItems, setRelItems] = useState<any[]>([]);

  const [wikiSection, setWikiSection] = useState<'all' | 'jojo' | 'concepts' | 'prog'>('all');
  const [wikiQuery, setWikiQuery] = useState('');
  const [wikiData, setWikiData] = useState<any>({ jojo_stands: [], concepts: [], prog_langs: [] });
  const [standUser, setStandUser] = useState('');
  const [rolledStand, setRolledStand] = useState<any>(null);

  const [egeSubj, setEgeSubj] = useState('all');
  const [egeQuery, setEgeQuery] = useState('');
  const [egeItems, setEgeItems] = useState<any[]>([]);

  const [popQuery, setPopQuery] = useState('');
  const [popData, setPopData] = useState<any>(null);

  useEffect(() => {
    if (activeTool === 'constitutions_hub') setSubTab('const');
    else if (activeTool === 'religions_hub') setSubTab('religions');
    else if (activeTool === 'multi_wiki') setSubTab('wiki');
    else if (activeTool === 'ege_formulas') setSubTab('ege');
    else if (activeTool === 'population_hub') setSubTab('pop');
  }, [activeTool]);

  useEffect(() => {
    apiGet(`/api/v2/knowledge/constitutions?q=${encodeURIComponent(constQuery)}`).then((r) => setConstItems(r.items));
  }, [constQuery]);

  useEffect(() => {
    apiGet(`/api/v2/knowledge/religions?q=${encodeURIComponent(relQuery)}`).then((r) => setRelItems(r.items));
  }, [relQuery]);

  useEffect(() => {
    apiGet(`/api/v2/knowledge/wiki?section=${wikiSection}&q=${encodeURIComponent(wikiQuery)}`).then(setWikiData);
  }, [wikiSection, wikiQuery]);

  useEffect(() => {
    apiGet(`/api/v2/knowledge/formulas?subject=${encodeURIComponent(egeSubj)}&q=${encodeURIComponent(egeQuery)}`).then((r) =>
      setEgeItems(r.items)
    );
  }, [egeSubj, egeQuery]);

  const loadPop = (q = popQuery) => {
    apiGet(`/api/v2/knowledge/population?q=${encodeURIComponent(q)}`).then(setPopData);
  };

  useEffect(() => {
    loadPop('');
  }, []);

  const rollStand = async () => {
    const r = await apiPost('/api/v2/knowledge/roll-stand', { name: standUser });
    setRolledStand(r.stand);
    onSync();
  };

  return (
    <div className="space-y-5">
      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'const', tool: 'constitutions_hub', label: '⚖️ Конституции Стран Мира' },
          { id: 'religions', tool: 'religions_hub', label: '🕉️ Мировые Религии' },
          { id: 'wiki', tool: 'multi_wiki', label: '🌟 Мульти-Вики (JoJo, Понятия, ЯП)' },
          { id: 'ege', tool: 'ege_formulas', label: '📐 Справочник Формул ЕГЭ' },
          { id: 'pop', tool: 'population_hub', label: '🌍 Население: от Земли до Деревень' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setSubTab(t.id as any);
              onSelectTool(t.tool);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
              subTab === t.id
                ? 'bg-amber-500/20 border-amber-400/60 text-amber-200 shadow-lg shadow-amber-500/10'
                : 'bg-slate-900/60 border-white/10 text-slate-300 hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 1. CONSTITUTIONS */}
      {subTab === 'const' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-400" /> Сборник Конституций Государств Мира
              </h3>
              <p className="text-xs text-slate-400">Форма правления, структура статей, ключевые права и уникальные конституционные нормы</p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                value={constQuery}
                onChange={(e) => setConstQuery(e.target.value)}
                placeholder="Поиск страны (Япония, США, РФ, ФРГ...)"
                className="w-full rounded-xl bg-slate-950 border border-white/10 pl-9 pr-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[560px] overflow-y-auto pr-1">
            {constItems.map((c) => (
              <div key={c.code} className="p-4 rounded-2xl bg-slate-950/90 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-white flex items-center gap-2">
                    <span className="text-xl">{c.flag}</span> {c.country}
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30">
                    Принята: {c.year} (ред. {c.updated})
                  </span>
                </div>
                <div className="text-xs text-sky-300 font-medium">{c.gov_form}</div>
                <div className="text-xs text-slate-400">📜 Структура: <span className="text-slate-200">{c.structure}</span></div>
                <p className="text-xs text-slate-200 leading-relaxed">{c.key_principles}</p>
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-400/20 text-[11px] text-amber-200">
                  💡 <b>Уникальный факт:</b> {c.unique_fact}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. WORLD RELIGIONS */}
      {subTab === 'religions' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Compass className="w-5 h-5 text-amber-400" /> Энциклопедия и Сравнение Мировых Религий
              </h3>
              <p className="text-xs text-slate-400">Священные книги (Библия, Коран, Тора, Трипитака, Веды, Дао Дэ Цзин), течения и философия</p>
            </div>
            <input
              value={relQuery}
              onChange={(e) => setRelQuery(e.target.value)}
              placeholder="Фильтр (Коран, Буддизм, Карма, Тора...)"
              className="w-full sm:w-72 rounded-xl bg-slate-950 border border-white/10 px-3.5 py-2 text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {relItems.map((r) => (
              <div key={r.id} className="p-4 rounded-2xl bg-slate-950/90 border border-white/10 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="text-base font-bold text-white flex items-center gap-2">
                    <span className="text-xl">{r.emoji}</span> {r.name}
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-400/30">
                    {r.followers}
                  </span>
                </div>
                <div className="text-slate-400">🏛 Возникновение: <span className="text-slate-200">{r.origin}</span></div>
                <div className="text-slate-400">📖 Священное Писание: <span className="text-amber-300 font-medium">{r.scripture}</span></div>
                <div className="text-slate-400">🌿 Направления: <span className="text-sky-300">{r.branches}</span></div>
                <p className="text-slate-200 leading-relaxed pt-1">{r.core_beliefs}</p>
                <div className="p-2 rounded-lg bg-white/5 text-slate-300">🕯 <b>Традиции и практика:</b> {r.practices}</div>
              </div>
            ))}
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
              <div className="text-sm font-black text-amber-300">🌟 Ваш Стенд: {rolledStand.name} ({rolledStand.part})</div>
              <div className="text-purple-300">Каноничный владелец: <b>{rolledStand.user}</b> • Статы: <code>{rolledStand.stats}</code></div>
              <p className="text-slate-200">{rolledStand.ability}</p>
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: '📚 Вся Мульти-Вики' },
                  { id: 'jojo', label: '🃏 Стенды JoJo (ч. 3–9)' },
                  { id: 'concepts', label: '🧠 Умные понятия & Лор' },
                  { id: 'prog', label: '💻 Языки Программирования' },
                ].map((s) => (
                  <button
                    key={s.id}
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
              <input
                value={wikiQuery}
                onChange={(e) => setWikiQuery(e.target.value)}
                placeholder="Поиск: промискуитет, Wonder of U, Rust, Гамаз..."
                className="w-full sm:w-72 rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="space-y-5 max-h-[560px] overflow-y-auto pr-1">
              {wikiData.jojo_stands?.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300">🃏 Энциклопедия Стендов JoJo's Bizarre Adventure</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {wikiData.jojo_stands.map((s: any) => (
                      <div key={s.name} className="p-3.5 rounded-xl bg-slate-950/90 border border-purple-400/20 space-y-1 text-xs">
                        <div className="flex justify-between gap-2">
                          <span className="font-bold text-white">{s.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-200 shrink-0">{s.part}</span>
                        </div>
                        <div className="text-amber-300 text-[11px]">Владелец: {s.user}</div>
                        <div className="font-mono text-[10px] text-sky-300">{s.stats}</div>
                        <p className="text-slate-300 pt-1">{s.ability}</p>
                      </div>
                    ))}
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
                        <code className="block p-2 rounded-lg bg-slate-900 text-emerald-300 font-mono text-[11px]">{l.snippet}</code>
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
            <div>
              <div className="text-xs text-emerald-300 uppercase tracking-wider font-semibold">🌍 Живой демографический счётчик Планеты Земля</div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-white mt-0.5">
                {popData?.live_earth_population || '8 185 400 000'} <span className="text-sm font-normal text-slate-300">человек</span>
              </div>
            </div>
            <Globe2 className="w-10 h-10 text-emerald-400/70 hidden sm:block" />
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
              placeholder="Введите страну, мегаполис, город, ПГТ или деревню (например: село Оймякон)..."
              className="flex-1 rounded-xl bg-slate-950 border border-white/10 px-4 py-2.5 text-xs sm:text-sm text-white"
            />
            <button
              onClick={() => loadPop(popQuery)}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs shrink-0"
            >
              Найти
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(popData?.places || []).map((p: any) => (
              <div key={p.name} className="p-4 rounded-xl bg-slate-950/90 border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm text-white">{p.name}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 shrink-0">{p.type}</span>
                </div>
                <div className="text-xl font-mono font-extrabold text-amber-300">{p.formatted_pop} чел.</div>
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
