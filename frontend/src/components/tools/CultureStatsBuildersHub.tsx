import React, { useEffect, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { apiGet } from '../../lib/api';
import { syncHiDPICanvas, useCanvasVisibility } from '../../lib/engine3d';

const STAT_METRICS = [
  { id: 'penis_length_cm', label: 'Средняя длина пениса (см)' },
  { id: 'penis_girth_cm', label: 'Средний обхват пениса (см)' },
  { id: 'breast_cup_index', label: 'Индекс размера женской груди (1=A … 4=D)' },
  { id: 'iq_pisa_index', label: 'Индекс когнитивных тестов (IQ / PISA)' },
  { id: 'gdp_ppp_usd', label: 'ВВП на душу населения по ППС ($ 2026)' },
  { id: 'life_expectancy', label: 'Ожидаемая продолжительность жизни (лет)' },
  { id: 'male_height_cm', label: 'Средний рост мужчин (см)' },
  { id: 'female_height_cm', label: 'Средний рост женщин (см)' },
  { id: 'internet_mbps', label: 'Медианная скорость интернета (Мбит/с)' },
];

const TIER_RANKS = [
  { rank: 'S', bg: '#ef4444' },
  { rank: 'A', bg: '#f97316' },
  { rank: 'B', bg: '#facc15' },
  { rank: 'C', bg: '#22c55e' },
  { rank: 'D', bg: '#38bdf8' },
  { rank: 'F', bg: '#94a3b8' },
];

export const CultureStatsBuildersHub: React.FC<{
  activeTool: string;
  onSelectTool: (t: string) => void;
  onSync: () => void;
  onToast: (m: string) => void;
}> = ({ activeTool, onSelectTool, onSync, onToast }) => {
  const tab = (
    [
      'earth_stats_2026',
      'world_genres_tags',
      'cult_lore_encyc',
      'iq_eq_quizzes_hub',
      'tier_list_maker',
      'survey_cv_builder',
      'universal_file_converter',
    ] as const
  ).includes(activeTool as any)
    ? activeTool
    : 'earth_stats_2026';

  const { wrapRef, visible } = useCanvasVisibility();
  const chartRef = useRef<HTMLCanvasElement | null>(null);

  // 1. Earth Stats 2026
  const [metricX, setMetricX] = useState('penis_length_cm');
  const [metricY, setMetricY] = useState('penis_girth_cm');
  const [statsData, setStatsData] = useState<any>(null);

  // 2 & 3. Genres & Cult Lore
  const [genresCat, setGenresCat] = useState('all');
  const [genresQ, setGenresQ] = useState('');
  const [cultureBundle, setCultureBundle] = useState<{ genres: Record<string, any[]>; lore: any[] }>({
    genres: {},
    lore: [],
  });
  const [loreId, setLoreId] = useState('wh40k');

  // 4. IQ & EQ Quizzes
  const [quizData, setQuizData] = useState<any>(null);
  const [quizMode, setQuizMode] = useState<'iq' | 'eq'>('iq');
  const [iqAnswers, setIqAnswers] = useState<Record<number, number>>({});
  const [iqSubmitted, setIqSubmitted] = useState(false);
  const [eqAnswers, setEqAnswers] = useState<Record<number, number>>({});
  const [eqSubmitted, setEqSubmitted] = useState(false);

  // 5. Tier List Maker
  const [tierTitle, setTierTitle] = useState('Мой Тир-Лист 2026');
  const [tierItems, setTierItems] = useState<Array<{ id: string; text: string; tier: string }>>([
    { id: '1', text: '🔥 Elden Ring', tier: 'S' },
    { id: '2', text: '⚔️ Ведьмак 3', tier: 'S' },
    { id: '3', text: '⛏️ Minecraft', tier: 'A' },
    { id: '4', text: '🎲 Baldur’s Gate 3', tier: 'S' },
    { id: '5', text: '🛡️ Dota 2', tier: 'B' },
    { id: '6', text: '🔫 CS2', tier: 'A' },
  ]);
  const [newTierCard, setNewTierCard] = useState('');

  // 6. CV & Survey Builder
  const [cvName, setCvName] = useState('Алексей Соколов');
  const [cvRole, setCvRole] = useState('Full-Stack Python / TypeScript Инженер');
  const [cvContacts, setCvContacts] = useState('Telegram: @username • GitHub • Москва / Remote');
  const [cvSkills, setCvSkills] = useState('Python, FastAPI, PostgreSQL, React, TypeScript, Docker, Linux, Git');
  const [cvExp, setCvExp] = useState('2024–2026 — Разработка высоконагруженных Telegram Mini Apps и REST API сервисов.');
  const [pollQuestion, setPollQuestion] = useState('Какую функцию развивать следующей?');
  const [pollOpts, setPollOpts] = useState([
    { text: '3D Симуляторы и Физика', votes: 14 },
    { text: 'ИИ Ассистент с Веб-поиском', votes: 23 },
    { text: 'Игровые и научные энциклопедии', votes: 11 },
  ]);

  // 7. Universal File Converter
  const [targetFmt, setTargetFmt] = useState('csv');
  const [convText, setConvText] = useState('[\n  {"country": "Singapore", "year": 2026, "gdp_ppp": 153000},\n  {"country": "Switzerland", "year": 2026, "gdp_ppp": 95800}\n]');
  const [convPreview, setConvPreview] = useState<string>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [imgTargetFmt, setImgTargetFmt] = useState('webp');

  useEffect(() => {
    if (tab === 'earth_stats_2026') {
      apiGet(`/api/v6/stats/earth-2026?x_metric=${metricX}&y_metric=${metricY}`)
        .then(setStatsData)
        .catch(() => {});
    }
  }, [tab, metricX, metricY]);

  useEffect(() => {
    if ((tab === 'world_genres_tags' || tab === 'cult_lore_encyc') && cultureBundle.lore.length === 0) {
      apiGet('/api/v6/culture/genres-lore')
        .then((r) => setCultureBundle({ genres: r.genres || {}, lore: r.lore || [] }))
        .catch(() => {});
    }
    if (tab === 'iq_eq_quizzes_hub' && !quizData) {
      apiGet('/api/v6/tests/iq-eq').then(setQuizData).catch(() => {});
    }
  }, [tab]);

  // Scatter Correlation Chart + Least-Squares Regression Line
  useEffect(() => {
    const cvs = chartRef.current;
    if (!cvs || !visible || tab !== 'earth_stats_2026' || !statsData?.countries?.length) return;
    const { ctx, W, H } = syncHiDPICanvas(cvs);
    if (!ctx || W < 40) return;

    ctx.fillStyle = '#040816';
    ctx.fillRect(0, 0, W, H);

    const pts = statsData.countries.map((c: any) => ({
      x: Number(c[metricX]),
      y: Number(c[metricY]),
      label: `${c.flag || ''} ${c.country}`,
    }));
    const xs = pts.map((p: any) => p.x);
    const ys = pts.map((p: any) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs) || minX + 1;
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys) || minY + 1;

    const padL = 52;
    const padR = 28;
    const padT = 24;
    const padB = 34;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const sx = (v: number) => padL + ((v - minX) / (maxX - minX || 1)) * plotW;
    const sy = (v: number) => padT + plotH - ((v - minY) / (maxY - minY || 1)) * plotH;

    ctx.strokeStyle = 'rgba(148,163,184,0.16)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const gy = padT + (i / 4) * plotH;
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(W - padR, gy); ctx.stroke();
    }

    const slope = statsData.regression?.slope ?? 0;
    const intercept = statsData.regression?.intercept ?? 0;
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = 'rgba(250,204,21,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx(minX), sy(slope * minX + intercept));
    ctx.lineTo(sx(maxX), sy(slope * maxX + intercept));
    ctx.stroke();
    ctx.restore();

    for (const p of pts) {
      const px = sx(p.x);
      const py = sy(p.y);
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      ctx.font = '500 9.5px "Inter", sans-serif';
      ctx.fillStyle = 'rgba(226,232,240,0.88)';
      ctx.fillText(p.label, px + 7, py + 3);
    }
  }, [visible, tab, statsData, metricX, metricY]);

  const exportTierPng = () => {
    const cvs = document.createElement('canvas');
    cvs.width = 1000;
    cvs.height = 560;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, 1000, 560);
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(tierTitle, 24, 42);
    TIER_RANKS.forEach((r, idx) => {
      const y = 64 + idx * 78;
      ctx.fillStyle = r.bg;
      ctx.fillRect(24, y, 76, 66);
      ctx.fillStyle = '#090d16';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText(r.rank, 52, y + 44);
      ctx.fillStyle = '#111827';
      ctx.fillRect(108, y, 868, 66);
      const rowCards = tierItems.filter((it) => it.tier === r.rank);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '600 16px sans-serif';
      ctx.fillText(rowCards.map((c) => c.text).join('   •   ') || '—', 124, y + 40);
    });
    const a = document.createElement('a');
    a.href = cvs.toDataURL('image/png');
    a.download = 'tier_list_2026.png';
    a.click();
  };

  const runServerFileConvert = async (blob: Blob, filename: string, fmt: string, previewText: boolean) => {
    try {
      const fd = new FormData();
      fd.append('file', blob, filename);
      fd.append('target_format', fmt);
      const res = await fetch('/api/v6/files/convert', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Ошибка конвертации файла');
      const outBlob = await res.blob();
      if (previewText) {
        setConvPreview(await outBlob.text());
      }
      const url = URL.createObjectURL(outBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `converted.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
      onSync();
    } catch (e: any) {
      onToast(e.message || 'Ошибка конвертации');
    }
  };

  const currentLore = cultureBundle.lore.find((u) => u.id === loreId) || cultureBundle.lore[0];

  return (
    <div ref={wrapRef} className="space-y-4 min-w-0">
      <div className="flex flex-wrap gap-1.5">
        {[
          { id: 'earth_stats_2026', label: '🌍 Статистика Земли и Корреляции (25.10.2026)' },
          { id: 'world_genres_tags', label: '🎭 Все Жанры и Теги Мира' },
          { id: 'cult_lore_encyc', label: '⚔️ Лор WH40K, Dragon Ball, Дюны и SCP' },
          { id: 'iq_eq_quizzes_hub', label: '🧠 IQ-Тест и EQ-Тест' },
          { id: 'tier_list_maker', label: '🏆 Тир-Листы (PNG)' },
          { id: 'survey_cv_builder', label: '📄 Резюме (CV) и Опросы' },
          { id: 'universal_file_converter', label: '🔄 Универсальный Конвертер Файлов' },
        ].map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => onSelectTool(b.id)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
              tab === b.id
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100'
                : 'bg-slate-900 border-white/10 text-slate-300'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* 1. EARTH STATS & CORRELATIONS AS OF 2026-10-25 */}
      {tab === 'earth_stats_2026' && (
        <div className="rounded-2xl bg-slate-900/80 border border-emerald-500/25 p-4 space-y-4 text-xs">
          {statsData && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-950 border border-white/10">
                <div className="text-slate-400">Дата калибровки метрик</div>
                <div className="font-mono font-bold text-emerald-300 text-sm">{statsData.as_of_date}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-white/10">
                <div className="text-slate-400">Население Земли (25.10.2026)</div>
                <div className="font-mono font-bold text-white text-sm">
                  {Number(statsData.world_population_2026_10_25 || 0).toLocaleString('ru-RU')}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-amber-400/30">
                <div className="text-slate-400">Корреляция Пирсона (X ↔ Y)</div>
                <div className="font-mono font-bold text-amber-300 text-sm">r = {statsData.pearson_r}</div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => { setMetricX('penis_length_cm'); setMetricY('penis_girth_cm'); }} className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 border border-rose-400/30 text-rose-200">Длина пениса ↔ Обхват</button>
            <button type="button" onClick={() => { setMetricX('breast_cup_index'); setMetricY('female_height_cm'); }} className="px-2.5 py-1.5 rounded-lg bg-pink-500/15 border border-pink-400/30 text-pink-200">Размер груди по странам ↔ Рост</button>
            <button type="button" onClick={() => { setMetricX('iq_pisa_index'); setMetricY('gdp_ppp_usd'); }} className="px-2.5 py-1.5 rounded-lg bg-sky-500/15 border border-sky-400/30 text-sky-200">Интеллект (IQ/PISA) ↔ ВВП ППС</button>
            <button type="button" onClick={() => { setMetricX('gdp_ppp_usd'); setMetricY('life_expectancy'); }} className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-200">ВВП ППС ↔ Долголетие</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <select value={metricX} onChange={(e) => setMetricX(e.target.value)} className="rounded-xl bg-slate-950 border border-white/15 p-2.5 text-white">
              {STAT_METRICS.map((m) => <option key={m.id} value={m.id}>Ось X: {m.label}</option>)}
            </select>
            <select value={metricY} onChange={(e) => setMetricY(e.target.value)} className="rounded-xl bg-slate-950 border border-white/15 p-2.5 text-white">
              {STAT_METRICS.map((m) => <option key={m.id} value={m.id}>Ось Y: {m.label}</option>)}
            </select>
          </div>

          <canvas ref={chartRef} style={{ height: 290 }} className="w-full rounded-2xl bg-[#040816] border border-white/10 block" />

          {statsData?.countries && (
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="py-2 pr-3">Страна</th>
                    <th className="py-2 pr-3">Пенис (дл./обхв. см)</th>
                    <th className="py-2 pr-3">Грудь (чашка)</th>
                    <th className="py-2 pr-3">Индекс IQ/PISA</th>
                    <th className="py-2 pr-3">ВВП ППС ($)</th>
                    <th className="py-2">Жизнь (лет)</th>
                  </tr>
                </thead>
                <tbody>
                  {statsData.countries.map((c: any) => (
                    <tr key={c.code} className="border-b border-white/5 hover:bg-white/5 font-mono">
                      <td className="py-1.5 pr-3 font-sans font-semibold text-white">{c.flag} {c.country}</td>
                      <td className="py-1.5 pr-3 text-rose-300">{c.penis_length_cm} / {c.penis_girth_cm}</td>
                      <td className="py-1.5 pr-3 text-pink-300">{c.avg_breast_cup} ({c.breast_cup_index})</td>
                      <td className="py-1.5 pr-3 text-sky-300">{c.iq_pisa_index}</td>
                      <td className="py-1.5 pr-3 text-emerald-300">${Number(c.gdp_ppp_usd).toLocaleString('ru-RU')}</td>
                      <td className="py-1.5 text-amber-200">{c.life_expectancy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 2. ALL WORLD GENRES & TAGS */}
      {tab === 'world_genres_tags' && (
        <div className="rounded-2xl bg-slate-900/80 border border-purple-500/25 p-4 space-y-4 text-xs">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'Все сферы' },
              { id: 'music', label: '🎵 Музыка' },
              { id: 'movies_series', label: '🎬 Кино и Сериалы' },
              { id: 'books', label: '📚 Книги и Литература' },
              { id: 'anime', label: '⛩️ Аниме и Манга' },
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setGenresCat(c.id)}
                className={`px-3 py-1.5 rounded-xl font-semibold border ${
                  genresCat === c.id ? 'bg-purple-500/25 border-purple-400 text-purple-100' : 'bg-slate-950 border-white/10 text-slate-300'
                }`}
              >
                {c.label}
              </button>
            ))}
            <input
              value={genresQ}
              onChange={(e) => setGenresQ(e.target.value)}
              placeholder="Поиск жанра (Shoegaze, Нуар, Исекай, Магический реализм)..."
              className="flex-1 min-w-[220px] rounded-xl bg-slate-950 border border-white/15 px-3 py-1.5 text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(cultureBundle.genres)
              .filter(([cat]) => genresCat === 'all' || cat === genresCat)
              .flatMap(([cat, arr]) =>
                (arr || [])
                  .filter(
                    (g: any) =>
                      !genresQ.trim() ||
                      `${g.genre} ${g.roots} ${g.traits}`.toLowerCase().includes(genresQ.trim().toLowerCase())
                  )
                  .map((g: any, idx: number) => (
                    <div key={`${cat}-${idx}`} className="p-3.5 rounded-xl bg-slate-950 border border-white/10 space-y-1">
                      <div className="flex justify-between gap-2">
                        <span className="font-bold text-white text-sm">{g.genre}</span>
                        <span className="text-purple-300 font-mono text-[10.5px] shrink-0">{g.bpm}</span>
                      </div>
                      <div className="text-amber-200/90 text-[11px]">Классика: {g.roots}</div>
                      <p className="text-slate-300 leading-relaxed">{g.traits}</p>
                    </div>
                  ))
              )}
          </div>
        </div>
      )}

      {/* 3. CULT FRANCHISE LORE */}
      {tab === 'cult_lore_encyc' && (
        <div className="rounded-2xl bg-slate-900/80 border border-amber-500/25 p-4 space-y-4 text-xs">
          <div className="flex flex-wrap gap-2">
            {cultureBundle.lore.map((u: any) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setLoreId(u.id)}
                className={`px-3.5 py-2 rounded-xl font-bold border ${
                  loreId === u.id ? 'bg-amber-500/25 border-amber-400 text-amber-100' : 'bg-slate-950 border-white/10 text-slate-300'
                }`}
              >
                {u.emoji} {u.universe}
              </button>
            ))}
          </div>
          {currentLore && (
            <div className="space-y-3">
              <div>
                <h3 className="text-base font-bold text-white">{currentLore.emoji} {currentLore.universe}</h3>
                <p className="text-amber-300">{currentLore.tagline}</p>
              </div>
              {(currentLore.entries || []).map((ch: any, i: number) => (
                <div key={i} className="p-4 rounded-xl bg-slate-950 border border-white/10 space-y-1.5">
                  <div className="flex justify-between gap-2">
                    <span className="font-bold text-sm text-amber-200">{ch.title}</span>
                    <span className="text-[10px] font-mono text-sky-300">{ch.cat}</span>
                  </div>
                  <p className="text-slate-200 leading-relaxed">{ch.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. IQ & EQ TESTS */}
      {tab === 'iq_eq_quizzes_hub' && quizData && (
        <div className="rounded-2xl bg-slate-900/80 border border-sky-500/25 p-4 space-y-4 text-xs">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setQuizMode('iq')} className={`px-4 py-2 rounded-xl font-bold border ${quizMode === 'iq' ? 'bg-sky-500/25 border-sky-400 text-sky-100' : 'bg-slate-950 border-white/10 text-slate-300'}`}>
              🧠 Полный Тест IQ ({(quizData.iq_questions || []).length} логических задач)
            </button>
            <button type="button" onClick={() => setQuizMode('eq')} className={`px-4 py-2 rounded-xl font-bold border ${quizMode === 'eq' ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100' : 'bg-slate-950 border-white/10 text-slate-300'}`}>
              💚 Тест Эмоционального Интеллекта (EQ)
            </button>
          </div>

          {quizMode === 'iq' ? (
            <div className="space-y-3">
              {(quizData.iq_questions || []).map((q: any) => (
                <div key={q.id} className="p-3.5 rounded-xl bg-slate-950 border border-white/10 space-y-2">
                  <div className="font-bold text-white">{q.id}. {q.q}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {q.options.map((opt: string, idx: number) => {
                      const picked = iqAnswers[q.id] === idx;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setIqAnswers((p) => ({ ...p, [q.id]: idx }))}
                          className={`p-2 rounded-lg border text-left font-semibold ${
                            picked ? 'bg-sky-500/30 border-sky-400 text-white' : 'bg-slate-900 border-white/10 text-slate-300'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {iqSubmitted && (
                    <div className={iqAnswers[q.id] === q.correct ? 'text-emerald-300' : 'text-rose-300'}>
                      {iqAnswers[q.id] === q.correct ? '✅ Верно! ' : `❌ Правильный ответ: ${q.options[q.correct]}. `}
                      {q.explain}
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => { setIqSubmitted(true); onSync(); }}
                className="px-5 py-2.5 rounded-xl bg-sky-500 text-slate-950 font-black"
              >
                Подсчитать шкалированный балл IQ
              </button>
              {iqSubmitted && (() => {
                const totalQ = (quizData.iq_questions || []).length || 1;
                const correct = (quizData.iq_questions || []).filter((q: any) => iqAnswers[q.id] === q.correct).length;
                const scaledIq = Math.round(78 + (correct / totalQ) * 64);
                return (
                  <div className="p-4 rounded-xl bg-sky-500/20 border border-sky-400 text-white font-bold text-sm">
                    Ваш результат: {correct} / {totalQ} верных • Расчётный индекс IQ ≈ {scaledIq} (средняя норма популяции: 100, SD = 15)
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="space-y-3">
              {(quizData.eq_questions || []).map((q: any) => (
                <div key={q.id} className="p-3.5 rounded-xl bg-slate-950 border border-white/10 space-y-2">
                  <div className="font-bold text-white">{q.id}. {q.q}</div>
                  <div className="space-y-1.5">
                    {q.options.map((opt: string, idx: number) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setEqAnswers((p) => ({ ...p, [q.id]: idx }))}
                        className={`w-full p-2.5 rounded-lg border text-left ${
                          eqAnswers[q.id] === idx ? 'bg-emerald-500/30 border-emerald-400 text-white' : 'bg-slate-900 border-white/10 text-slate-300'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => { setEqSubmitted(true); onSync(); }}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black"
              >
                Оценить профиль EQ
              </button>
              {eqSubmitted && (() => {
                const totalQ = (quizData.eq_questions || []).length || 1;
                const hits = (quizData.eq_questions || []).filter((q: any) => eqAnswers[q.id] === q.best).length;
                return (
                  <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-400 text-emerald-100 font-bold text-sm">
                    Зрелых эмоциональных стратегий: {hits} / {totalQ} ({Math.round((hits / totalQ) * 100)}% индекс саморегуляции и эмпатии)
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* 5. TIER-LIST MAKER */}
      {tab === 'tier_list_maker' && (
        <div className="rounded-2xl bg-slate-900/80 border border-amber-500/25 p-4 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <input value={tierTitle} onChange={(e) => setTierTitle(e.target.value)} className="rounded-xl bg-slate-950 border border-white/15 px-3.5 py-2 text-sm font-bold text-white" />
            <div className="flex gap-2">
              <input value={newTierCard} onChange={(e) => setNewTierCard(e.target.value)} placeholder="Новая карточка..." className="rounded-xl bg-slate-950 border border-white/15 px-3 py-2 text-white" />
              <button
                type="button"
                onClick={() => {
                  if (!newTierCard.trim()) return;
                  setTierItems((p) => [...p, { id: String(Date.now()), text: newTierCard.trim(), tier: 'S' }]);
                  setNewTierCard('');
                }}
                className="px-3 py-2 rounded-xl bg-amber-400 text-slate-950 font-bold"
              >
                + Добавить
              </button>
              <button type="button" onClick={exportTierPng} className="px-3.5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold flex items-center gap-1">
                <Download className="w-3.5 h-3.5" /> PNG
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {TIER_RANKS.map((r) => (
              <div key={r.rank} className="flex rounded-xl overflow-hidden border border-white/10 bg-slate-950">
                <div style={{ backgroundColor: r.bg }} className="w-14 shrink-0 flex items-center justify-center text-xl font-black text-slate-950">
                  {r.rank}
                </div>
                <div className="flex-1 p-2.5 flex flex-wrap gap-2 min-h-[54px]">
                  {tierItems
                    .filter((it) => it.tier === r.rank)
                    .map((it) => (
                      <div key={it.id} className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/15 flex items-center gap-2">
                        <span className="font-semibold text-white">{it.text}</span>
                        <select
                          value={it.tier}
                          onChange={(e) =>
                            setTierItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, tier: e.target.value } : x)))
                          }
                          className="bg-slate-800 rounded px-1 py-0.5 text-[10px] text-amber-300"
                        >
                          {TIER_RANKS.map((tr) => <option key={tr.rank} value={tr.rank}>{tr.rank}</option>)}
                        </select>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. RESUME (CV) & SURVEY BUILDER */}
      {tab === 'survey_cv_builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
          <div className="rounded-2xl bg-slate-900/80 border border-sky-500/25 p-4 space-y-2.5">
            <h3 className="text-sm font-bold text-white">📄 Конструктор Резюме (CV) с Экспортом</h3>
            <input value={cvName} onChange={(e) => setCvName(e.target.value)} placeholder="ФИО" className="w-full rounded-xl bg-slate-950 border border-white/15 p-2 text-white" />
            <input value={cvRole} onChange={(e) => setCvRole(e.target.value)} placeholder="Желаемая должность" className="w-full rounded-xl bg-slate-950 border border-white/15 p-2 text-white" />
            <input value={cvContacts} onChange={(e) => setCvContacts(e.target.value)} placeholder="Контакты" className="w-full rounded-xl bg-slate-950 border border-white/15 p-2 text-white" />
            <input value={cvSkills} onChange={(e) => setCvSkills(e.target.value)} placeholder="Ключевые навыки" className="w-full rounded-xl bg-slate-950 border border-white/15 p-2 text-white" />
            <textarea rows={3} value={cvExp} onChange={(e) => setCvExp(e.target.value)} placeholder="Опыт работы и достижения" className="w-full rounded-xl bg-slate-950 border border-white/15 p-2 text-white" />
            <div className="p-4 rounded-xl bg-white text-slate-900 space-y-1.5">
              <div className="text-lg font-black">{cvName}</div>
              <div className="font-semibold text-indigo-700">{cvRole}</div>
              <div className="text-[11px] text-slate-500">{cvContacts}</div>
              <hr />
              <div><b>Навыки:</b> {cvSkills}</div>
              <div><b>Опыт:</b> {cvExp}</div>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900/80 border border-emerald-500/25 p-4 space-y-3">
            <h3 className="text-sm font-bold text-white">📊 Интерактивный Конструктор Опроса</h3>
            <input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} className="w-full rounded-xl bg-slate-950 border border-white/15 p-2 font-bold text-white" />
            {pollOpts.map((o, idx) => {
              const total = pollOpts.reduce((a, b) => a + b.votes, 0) || 1;
              const pct = Math.round((o.votes / total) * 100);
              return (
                <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-1.5">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold text-white">{o.text}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setPollOpts((prev) => prev.map((x, i) => (i === idx ? { ...x, votes: x.votes + 1 } : x)))
                      }
                      className="px-2.5 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold"
                    >
                      Голосовать ({o.votes} • {pct}%)
                    </button>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div style={{ width: `${pct}%` }} className="h-full bg-emerald-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. UNIVERSAL FILE & DATA CONVERTER */}
      {tab === 'universal_file_converter' && (
        <div className="space-y-4 text-xs">
          <div className="rounded-2xl bg-slate-900/80 border border-cyan-500/25 p-4 space-y-3">
            <h3 className="text-sm sm:text-base font-bold text-white">
              🖼️ Конвертер Любых Файлов и Изображений (PNG / JPG / WEBP / ICO / BMP / PDF / CSV / JSON / MD / HTML)
            </h3>
            <div className="flex flex-wrap items-center gap-2.5">
              <label className="px-4 py-2 rounded-xl bg-slate-950 border border-white/15 hover:border-cyan-400 cursor-pointer flex items-center gap-2 text-white font-semibold">
                <Upload className="w-4 h-4 text-cyan-400" />
                {uploadFile ? uploadFile.name : 'Выбрать файл (фото, JSON, CSV, текст)...'}
                <input type="file" className="hidden" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
              </label>
              <select value={imgTargetFmt} onChange={(e) => setImgTargetFmt(e.target.value)} className="rounded-xl bg-slate-950 border border-white/15 px-3 py-2 text-white">
                {['webp', 'png', 'jpg', 'ico', 'bmp', 'pdf', 'csv', 'json', 'md', 'html'].map((f) => (
                  <option key={f} value={f}>В формат: {f.toUpperCase()}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={!uploadFile}
                onClick={() => uploadFile && runServerFileConvert(uploadFile, uploadFile.name, imgTargetFmt, false)}
                className="px-4 py-2 rounded-xl bg-cyan-400 disabled:opacity-40 text-slate-950 font-black"
              >
                Скачать {imgTargetFmt.toUpperCase()}
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900/80 border border-emerald-500/25 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-white">📋 Мгновенная конвертация структурированного текста (JSON / CSV / TSV → любой формат):</span>
              <div className="flex items-center gap-2">
                <select value={targetFmt} onChange={(e) => setTargetFmt(e.target.value)} className="rounded-xl bg-slate-950 border border-white/15 px-3 py-1.5 text-white">
                  {['csv', 'json', 'md', 'html', 'tsv', 'pdf'].map((f) => (
                    <option key={f} value={f}>В {f.toUpperCase()}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => runServerFileConvert(new Blob([convText], { type: 'application/json' }), 'data.json', targetFmt, targetFmt !== 'pdf')}
                  className="px-4 py-1.5 rounded-xl bg-emerald-400 text-slate-950 font-black"
                >
                  Сконвертировать
                </button>
              </div>
            </div>
            <textarea
              rows={4}
              value={convText}
              onChange={(e) => setConvText(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-white/15 p-3 font-mono text-white"
            />
            {convPreview && (
              <pre className="p-3.5 rounded-xl bg-slate-950 border border-emerald-400/35 font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap">
                {convPreview}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
