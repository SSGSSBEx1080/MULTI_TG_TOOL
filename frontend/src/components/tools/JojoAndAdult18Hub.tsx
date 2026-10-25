import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Copy, Filter, Search, ShieldAlert, Sparkles, Swords } from 'lucide-react';
import { apiGet, apiPost, copyText } from '../../lib/api';
import { project3D, rotateEuler, syncHiDPICanvas, useCanvasVisibility } from '../../lib/engine3d';
import { Mini3DSceneBadge } from '../three/Interactive3DScenes';

function rankToScore(ch: string): number {
  const s = (ch || '').toUpperCase();
  if (s.includes('∞') || s.includes('S')) return 1.0;
  if (s.includes('A')) return 0.88;
  if (s.includes('B')) return 0.72;
  if (s.includes('C')) return 0.56;
  if (s.includes('D')) return 0.38;
  if (s.includes('E')) return 0.22;
  return 0.52;
}

const StandRadarSvg: React.FC<{ statsRaw: string; compareRaw?: string }> = ({ statsRaw, compareRaw }) => {
  const labels = ['PWR', 'SPD', 'RNG', 'DUR', 'PRC', 'POT'];
  const cx = 48;
  const cy = 48;
  const maxR = 31;
  const toPoly = (raw: string) => {
    const parts = (raw || 'B|B|C|B|C|B').split('|');
    return [0, 1, 2, 3, 4, 5]
      .map((i) => {
        const v = rankToScore(parts[i] || 'C');
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 6;
        return `${(cx + Math.cos(a) * maxR * v).toFixed(1)},${(cy + Math.sin(a) * maxR * v).toFixed(1)}`;
      })
      .join(' ');
  };
  const outer = [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 6;
      return `${(cx + Math.cos(a) * maxR).toFixed(1)},${(cy + Math.sin(a) * maxR).toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 96 96" className="w-24 h-24 shrink-0">
      <circle cx={cx} cy={cy} r={maxR} fill="rgba(88,28,135,0.22)" stroke="rgba(192,132,252,0.35)" strokeWidth="1" />
      <polygon points={outer} fill="none" stroke="rgba(148,163,184,0.28)" strokeWidth="0.8" />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 6;
        return (
          <g key={i}>
            <line
              x1={cx}
              y1={cy}
              x2={cx + Math.cos(a) * maxR}
              y2={cy + Math.sin(a) * maxR}
              stroke="rgba(148,163,184,0.2)"
              strokeWidth="0.7"
            />
            <text
              x={cx + Math.cos(a) * (maxR + 10)}
              y={cy + Math.sin(a) * (maxR + 10) + 2.2}
              textAnchor="middle"
              fontSize="6.5"
              fontWeight="700"
              fill="#f5d0fe"
            >
              {labels[i]}
            </text>
          </g>
        );
      })}
      {compareRaw && (
        <polygon points={toPoly(compareRaw)} fill="rgba(56,189,248,0.28)" stroke="#38bdf8" strokeWidth="1.4" />
      )}
      <polygon points={toPoly(statsRaw)} fill="rgba(232,121,249,0.38)" stroke="#facc15" strokeWidth="1.4" />
    </svg>
  );
};

// ============================================================================
// 1. JOJO STANDS (PARTS 3–9) + 18+ ACTRESSES DB + 18+ HENTAI TAGS DICTIONARY
// ============================================================================

export const JojoAndAdult18Hub: React.FC<{
  activeTool: string;
  onSelectTool: (t: string) => void;
  onSync: () => void;
  onToast: (msg: string) => void;
}> = ({ activeTool, onSelectTool, onSync, onToast }) => {
  const tab =
    activeTool === 'adult_actresses_db'
      ? 'actresses'
      : activeTool === 'hentai_tags_dict'
      ? 'tags'
      : 'jojo';

  // 18+ age gate (persisted in sessionStorage)
  const [adultConfirmed, setAdultConfirmed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('mt_adult18_ok') === '1';
    } catch {
      return false;
    }
  });

  // JoJo State
  const [jojoPart, setJojoPart] = useState<number>(0);
  const [jojoQuery, setJojoQuery] = useState('');
  const [jojoData, setJojoData] = useState<any>({ items: [], total_catalog: 0, part_counts: {} });
  const [awakenName, setAwakenName] = useState('');
  const [awakenedStand, setAwakenedStand] = useState<any>(null);
  const [duelA, setDuelA] = useState<string>('Star Platinum');
  const [duelB, setDuelB] = useState<string>('Wonder of U');

  // Actresses 18+ State
  const [actQuery, setActQuery] = useState('');
  const [actHair, setActHair] = useState('');
  const [actCup, setActCup] = useState('');
  const [actNatural, setActNatural] = useState(false);
  const [actMinH, setActMinH] = useState(145);
  const [actMaxH, setActMaxH] = useState(185);
  const [actItems, setActItems] = useState<any[]>([]);

  // Hentai Tags 18+ State
  const [tagQuery, setTagQuery] = useState('');
  const [tagCat, setTagCat] = useState('all');
  const [tagTier, setTagTier] = useState('all');
  const [tagData, setTagData] = useState<any>({ items: [], categories: [] });

  useEffect(() => {
    if (tab !== 'jojo') return;
    apiGet(`/api/v6/jojo/stands?part=${jojoPart}&q=${encodeURIComponent(jojoQuery)}`)
      .then(setJojoData)
      .catch(() => {});
  }, [tab, jojoPart, jojoQuery]);

  useEffect(() => {
    if (tab !== 'actresses' || !adultConfirmed) return;
    const p = new URLSearchParams({
      q: actQuery,
      hair: actHair,
      cup: actCup,
      natural_only: String(actNatural),
      min_height: String(actMinH),
      max_height: String(actMaxH),
    });
    apiGet(`/api/v6/adult/actresses?${p.toString()}`)
      .then((r) => setActItems(r.items || []))
      .catch(() => {});
  }, [tab, adultConfirmed, actQuery, actHair, actCup, actNatural, actMinH, actMaxH]);

  useEffect(() => {
    if (tab !== 'tags' || !adultConfirmed) return;
    const p = new URLSearchParams({ q: tagQuery, category: tagCat, tier: tagTier });
    apiGet(`/api/v6/adult/hentai-tags?${p.toString()}`)
      .then(setTagData)
      .catch(() => {});
  }, [tab, adultConfirmed, tagQuery, tagCat, tagTier]);

  const confirm18 = () => {
    setAdultConfirmed(true);
    try {
      sessionStorage.setItem('mt_adult18_ok', '1');
    } catch {}
  };

  const standAObj = useMemo(
    () => (jojoData.items || []).find((s: any) => s.name === duelA) || jojoData.items?.[0],
    [jojoData.items, duelA]
  );
  const standBObj = useMemo(
    () => (jojoData.items || []).find((s: any) => s.name === duelB) || jojoData.items?.[1],
    [jojoData.items, duelB]
  );

  return (
    <div className="space-y-4 min-w-0">
      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onSelectTool('jojo_stands_all')}
          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
            tab === 'jojo'
              ? 'bg-fuchsia-500/25 border-fuchsia-400 text-fuchsia-100'
              : 'bg-slate-900 border-white/10 text-slate-300'
          }`}
        >
          🃏 Все Стенды JoJo (Части 3–9)
        </button>
        <button
          type="button"
          onClick={() => onSelectTool('adult_actresses_db')}
          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
            tab === 'actresses'
              ? 'bg-rose-500/25 border-rose-400 text-rose-100'
              : 'bg-slate-900 border-white/10 text-slate-300'
          }`}
        >
          🔞 База актрис 18+ с параметрами
        </button>
        <button
          type="button"
          onClick={() => onSelectTool('hentai_tags_dict')}
          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
            tab === 'tags'
              ? 'bg-amber-500/25 border-amber-400 text-amber-100'
              : 'bg-slate-900 border-white/10 text-slate-300'
          }`}
        >
          📕 Словарь тегов хентай-манги (18+)
        </button>
      </div>

      {/* TAB 1: ALL JOJO STANDS PARTS 3–9 */}
      {tab === 'jojo' && (
        <div className="space-y-4">
          {/* Stand Awakener */}
          <div className="rounded-2xl bg-gradient-to-r from-fuchsia-950/70 via-slate-900 to-indigo-950/70 border border-fuchsia-400/35 p-4 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Mini3DSceneBadge seed="jojo_stands_all" color="#d946ef" size={40} />
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" /> Полная Энциклопедия Стендов JoJo: Части 3–9 ({jojoData.total_catalog || 104} Стендов)
                </h3>
                <p className="text-xs text-slate-300">
                  Stardust Crusaders • Diamond is Unbreakable • Golden Wind • Stone Ocean • Steel Ball Run • JoJolion • The JoJolands
                </p>
              </div>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <input
                value={awakenName}
                onChange={(e) => setAwakenName(e.target.value)}
                placeholder="Ваше имя для Стрелы..."
                className="flex-1 md:w-44 rounded-xl bg-slate-950 border border-white/15 px-3 py-2 text-xs text-white"
              />
              <button
                type="button"
                onClick={async () => {
                  const r = await apiPost('/api/v6/jojo/awaken', { name: awakenName });
                  setAwakenedStand(r.stand);
                  onSync();
                }}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-fuchsia-500 text-slate-950 font-bold text-xs shrink-0"
              >
                🃏 Пробудить!
              </button>
            </div>
          </div>

          {awakenedStand && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-amber-400/50 flex items-center gap-3 text-xs">
              <StandRadarSvg statsRaw={awakenedStand.stats_raw} />
              <div className="space-y-1 min-w-0 flex-1">
                <div className="text-sm font-black text-amber-300">
                  🌟 Ваш Стенд: {awakenedStand.name} ({awakenedStand.part})
                </div>
                <div className="text-fuchsia-200">
                  Владелец: <b>{awakenedStand.user}</b> • Тип: {awakenedStand.stand_type}
                </div>
                <div className="font-mono text-[11px] text-sky-300">{awakenedStand.stats}</div>
                <p className="text-slate-200">{awakenedStand.ability}</p>
              </div>
            </div>
          )}

          {/* Stand vs Stand Radar Comparison */}
          {standAObj && standBObj && (
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-2.5">
              <div className="text-xs font-bold text-fuchsia-300 flex items-center gap-1.5">
                <Swords className="w-4 h-4" /> Сравнение параметров двух Стендов (Жёлтый vs Голубой контур)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <div className="md:col-span-5 space-y-1">
                  <select
                    value={standAObj.name}
                    onChange={(e) => setDuelA(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-amber-400/40 px-3 py-2 text-xs text-amber-200"
                  >
                    {(jojoData.items || []).map((s: any) => (
                      <option key={s.id} value={s.name}>
                        {s.name} (Ч.{s.part_num} — {s.user})
                      </option>
                    ))}
                  </select>
                  <div className="text-[11px] text-slate-400">{standAObj.stats}</div>
                </div>
                <div className="md:col-span-2 flex justify-center">
                  <StandRadarSvg statsRaw={standAObj.stats_raw} compareRaw={standBObj.stats_raw} />
                </div>
                <div className="md:col-span-5 space-y-1">
                  <select
                    value={standBObj.name}
                    onChange={(e) => setDuelB(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-sky-400/40 px-3 py-2 text-xs text-sky-200"
                  >
                    {(jojoData.items || []).map((s: any) => (
                      <option key={s.id} value={s.name}>
                        {s.name} (Ч.{s.part_num} — {s.user})
                      </option>
                    ))}
                  </select>
                  <div className="text-[11px] text-slate-400">{standBObj.stats}</div>
                </div>
              </div>
            </div>
          )}

          {/* Filter by Part 3..9 + Search */}
          <div className="rounded-2xl bg-slate-900/80 border border-white/10 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { p: 0, label: 'Все части (3–9)' },
                  { p: 3, label: 'Ч.3 Stardust' },
                  { p: 4, label: 'Ч.4 Diamond' },
                  { p: 5, label: 'Ч.5 Golden Wind' },
                  { p: 6, label: 'Ч.6 Stone Ocean' },
                  { p: 7, label: 'Ч.7 Steel Ball Run' },
                  { p: 8, label: 'Ч.8 JoJolion' },
                  { p: 9, label: 'Ч.9 The JoJolands' },
                ].map((b) => (
                  <button
                    key={b.p}
                    type="button"
                    onClick={() => setJojoPart(b.p)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs border transition ${
                      jojoPart === b.p
                        ? 'bg-fuchsia-500/25 border-fuchsia-400 text-fuchsia-100 font-bold'
                        : 'bg-slate-950 border-white/10 text-slate-300 hover:text-white'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={jojoQuery}
                  onChange={(e) => setJojoQuery(e.target.value)}
                  placeholder="Стенд, владелец или способность..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[620px] overflow-y-auto pr-1">
              {(jojoData.items || []).map((s: any) => (
                <div
                  key={s.id}
                  className="p-3.5 rounded-xl bg-slate-950/90 border border-fuchsia-400/20 flex items-start gap-3 text-xs"
                >
                  <StandRadarSvg statsRaw={s.stats_raw} />
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-white text-sm leading-snug">{s.name}</span>
                      <span className="px-2 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-200 text-[10px] shrink-0">
                        Ч.{s.part_num}
                      </span>
                    </div>
                    <div className="text-amber-300 text-[11px]">
                      Владелец: <b>{s.user}</b> • <span className="text-slate-400">{s.stand_type}</span>
                    </div>
                    <div className="font-mono text-[10px] text-sky-300">{s.stats}</div>
                    <p className="text-slate-300 leading-relaxed pt-0.5">{s.ability}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 18+ CONFIRMATION GATE FOR ADULT REFERENCE TABS */}
      {(tab === 'actresses' || tab === 'tags') && !adultConfirmed && (
        <div className="rounded-2xl bg-slate-950 border border-rose-500/40 p-6 text-center space-y-3">
          <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto" />
          <h3 className="text-base font-bold text-white">Справочный раздел строго 18+</h3>
          <p className="text-xs text-slate-300 max-w-md mx-auto">
            Раздел содержит текстовые энциклопедические и антропометрические метаданные для совершеннолетней аудитории (без откровенных фото- и видеоматериалов).
          </p>
          <button
            type="button"
            onClick={confirm18}
            className="px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs transition"
          >
            Мне исполнилось 18 лет — Открыть справочник
          </button>
        </div>
      )}

      {/* TAB 2: 18+ ADULT ACTRESSES PARAMETERS DATABASE */}
      {tab === 'actresses' && adultConfirmed && (
        <div className="rounded-2xl bg-slate-900/80 border border-rose-500/25 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                🔞 Антропометрическая База Актрис Индустрии 18+ ({actItems.length} анкет)
              </h3>
              <p className="text-xs text-slate-400">
                Рост, вес, ИМТ, пропорции Грудь–Талия–Бёдра (см / дюймы), чашка, тип, цвет волос/глаз и награды
              </p>
            </div>
          </div>

          {/* Multi-parameter Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 p-3 rounded-xl bg-slate-950 border border-white/10 text-xs">
            <input
              value={actQuery}
              onChange={(e) => setActQuery(e.target.value)}
              placeholder="Имя, страна или награда..."
              className="rounded-lg bg-slate-900 border border-white/10 px-3 py-1.5 text-white"
            />
            <select
              value={actHair}
              onChange={(e) => setActHair(e.target.value)}
              className="rounded-lg bg-slate-900 border border-white/10 px-2.5 py-1.5 text-white"
            >
              <option value="">Любой цвет волос</option>
              <option value="Блондинка">Блондинка</option>
              <option value="Брюнетка">Брюнетка</option>
              <option value="Шатенка">Шатенка</option>
              <option value="Рыжая">Рыжая</option>
            </select>
            <select
              value={actCup}
              onChange={(e) => setActCup(e.target.value)}
              className="rounded-lg bg-slate-900 border border-white/10 px-2.5 py-1.5 text-white"
            >
              <option value="">Любая чашка</option>
              {['A', 'B', 'C', 'D', 'DD', 'E', 'F', 'G'].map((c) => (
                <option key={c} value={c}>
                  Чашка {c}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
              <span>Рост:</span>
              <input
                type="number"
                value={actMinH}
                onChange={(e) => setActMinH(Number(e.target.value) || 140)}
                className="w-14 rounded bg-slate-900 border border-white/10 px-1.5 py-1 text-white"
              />
              <span>–</span>
              <input
                type="number"
                value={actMaxH}
                onChange={(e) => setActMaxH(Number(e.target.value) || 195)}
                className="w-14 rounded bg-slate-900 border border-white/10 px-1.5 py-1 text-white"
              />
            </div>
            <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={actNatural}
                onChange={(e) => setActNatural(e.target.checked)}
                className="accent-rose-500"
              />
              <span>Только натуральная</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-1">
            {actItems.map((a) => (
              <div key={a.id} className="p-3.5 rounded-xl bg-slate-950/90 border border-white/10 space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-sm text-white">
                      {a.flag} {a.name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {a.country} • {a.birth_year} г.р. ({a.age_2026} лет) • {a.active_years}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg bg-rose-500/20 border border-rose-400/35 text-rose-200 font-mono font-bold">
                    Чашка {a.cup}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[11px]">
                  <div className="p-1.5 rounded-lg bg-slate-900 border border-white/5">
                    <div className="text-slate-400 text-[10px]">Рост / Вес</div>
                    <div className="text-white font-bold">
                      {a.height_cm} см / {a.weight_kg} кг
                    </div>
                  </div>
                  <div className="p-1.5 rounded-lg bg-slate-900 border border-white/5">
                    <div className="text-slate-400 text-[10px]">Параметры</div>
                    <div className="text-amber-300 font-bold">{a.measurements_cm}</div>
                  </div>
                  <div className="p-1.5 rounded-lg bg-slate-900 border border-white/5">
                    <div className="text-slate-400 text-[10px]">ИМТ / WHR</div>
                    <div className="text-sky-300 font-bold">
                      {a.bmi} / {a.waist_hip_ratio}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-white/5 text-slate-200">Волосы: {a.hair}</span>
                  <span className="px-2 py-0.5 rounded bg-white/5 text-slate-200">Глаза: {a.eyes}</span>
                  <span
                    className={`px-2 py-0.5 rounded ${
                      a.natural ? 'bg-emerald-500/15 text-emerald-300' : 'bg-purple-500/15 text-purple-300'
                    }`}
                  >
                    {a.breast_type}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">{a.awards}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: 18+ HENTAI MANGA TAGS DICTIONARY */}
      {tab === 'tags' && adultConfirmed && (
        <div className="rounded-2xl bg-slate-900/80 border border-amber-500/25 p-4 space-y-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-400" /> Энциклопедический Словарь Тегов Хентай-Манги и Додзинси ({tagData.total_catalog || 60} терминов)
            </h3>
            <p className="text-xs text-slate-400">
              Перевод английских и японских каталожных тегов (Romaji / Kanji), категория и точное значение тропа
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={tagQuery}
              onChange={(e) => setTagQuery(e.target.value)}
              placeholder="Поиск тега (Vanilla, Tsundere, NTR, Gyaru, Kemonomimi, Doujinshi)..."
              className="flex-1 min-w-[210px] rounded-xl bg-slate-950 border border-white/10 px-3.5 py-2 text-xs text-white"
            />
            <select
              value={tagCat}
              onChange={(e) => setTagCat(e.target.value)}
              className="rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
            >
              <option value="all">Все категории</option>
              {(tagData.categories || []).map((c: string) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={tagTier}
              onChange={(e) => setTagTier(e.target.value)}
              className="rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
            >
              <option value="all">Любой уровень</option>
              <option value="Soft">Soft (Мягкие / Эстетика)</option>
              <option value="Standard">Standard</option>
              <option value="Hard">Hard</option>
              <option value="Dark">Dark (Драма / Тёмные тропы)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[580px] overflow-y-auto pr-1">
            {(tagData.items || []).map((t: any) => (
              <div key={t.id} className="p-3.5 rounded-xl bg-slate-950/90 border border-white/10 space-y-1.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-white text-sm">{t.tag_en}</span>
                    <span className="ml-2 text-amber-300 font-mono text-[11px]">{t.jp_romaji}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                      t.tier === 'Soft'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : t.tier === 'Dark'
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'bg-sky-500/20 text-sky-300'
                    }`}
                  >
                    {t.tier}
                  </span>
                </div>
                <div className="text-fuchsia-200 font-semibold">
                  {t.title_ru} <span className="text-slate-500 font-normal">• {t.category}</span>
                </div>
                <p className="text-slate-300 leading-relaxed">{t.definition}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2. FEMALE BREAST SIZE 10-FACTOR CALCULATOR + 3DPAIRED VOLUME COMPARISON
// ============================================================================

export const BreastSizeCalcStudio: React.FC<{
  onSync: () => void;
  onToast: (msg: string) => void;
}> = ({ onSync, onToast }) => {
  const [age, setAge] = useState(22);
  const [heightCm, setHeightCm] = useState(166);
  const [underbustCm, setUnderbustCm] = useState(74);
  const [hipCm, setHipCm] = useState(95);
  const [hairCm, setHairCm] = useState(42);
  const [matchaWeek, setMatchaWeek] = useState(4);
  const [pins, setPins] = useState(650);
  const [jars, setJars] = useState(9);
  const [showerC, setShowerC] = useState(41);
  const [gamesH, setGamesH] = useState(280);
  const [res, setRes] = useState<any>(null);
  const [selectedRefId, setSelectedRefId] = useState<string>('peach');

  const { wrapRef, visible } = useCanvasVisibility();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotRef = useRef({ rx: 0.25, ry: -0.35, down: false, lx: 0, ly: 0 });

  const runCalc = async () => {
    try {
      const r = await apiPost('/api/v6/party/breast-calc', {
        age,
        height_cm: heightCm,
        underbust_cm: underbustCm,
        hip_cm: hipCm,
        hair_length_cm: hairCm,
        matcha_latte_per_week: matchaWeek,
        pinterest_pins: pins,
        skincare_jars: jars,
        shower_temp_c: showerC,
        sims_genshin_hours: gamesH,
      });
      setRes(r);
      if (r.closest_object?.id) setSelectedRefId(r.closest_object.id);
      onSync();
    } catch (e: any) {
      onToast(e.message || 'Ошибка расчёта');
    }
  };

  useEffect(() => {
    runCalc();
  }, []);

  // 3D Paired Hemisphere + Reference Fruit Scale Renderer
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs || !visible || !res) return;
    let raf = 0;
    let tick = 0;

    const render = () => {
      const { ctx, W, H } = syncHiDPICanvas(cvs);
      if (!ctx || W < 20) {
        raf = requestAnimationFrame(render);
        return;
      }
      tick += 0.015;
      const st = rotRef.current;
      if (!st.down) st.ry = Math.sin(tick * 0.6) * 0.38;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#050814';
      ctx.fillRect(0, 0, W, H);

      const volMl = Number(res.single_volume_ml || 280);
      // Radius of hemisphere V = (2/3)*pi*R^3 -> R in cm
      const radCm = Math.pow((3 * volMl) / (2 * Math.PI), 1 / 3);
      const refObj =
        (res.comparisons || []).find((c: any) => c.id === selectedRefId) || res.closest_object || { diameter_cm: 10, color: '#f472b6', name: 'Эталон' };
      const refRadCm = (refObj.diameter_cm || 10) / 2;

      const scale = 0.085;
      const r3d = radCm * scale;
      const refR3d = refRadCm * scale;
      const fov = Math.min(W, H) * 0.95;
      const camDist = 3.2;

      const drawWireHemisphere = (cxOff: number, rad: number, strokeCol: string, fullSphere: boolean) => {
        for (let lat = 0; lat <= (fullSphere ? 180 : 90); lat += 18) {
          ctx.beginPath();
          let started = false;
          const th = (lat * Math.PI) / 180;
          for (let lon = 0; lon <= 360; lon += 15) {
            const ph = (lon * Math.PI) / 180;
            const local = {
              x: cxOff + rad * Math.sin(th) * Math.cos(ph),
              y: rad * Math.sin(th) * Math.sin(ph),
              z: rad * Math.cos(th),
            };
            const wp = rotateEuler(local, st.rx, st.ry);
            const pp = project3D(wp, W, H, fov, camDist);
            if (!started) {
              ctx.moveTo(pp.sx, pp.sy);
              started = true;
            } else {
              ctx.lineTo(pp.sx, pp.sy);
            }
          }
          ctx.strokeStyle = strokeCol;
          ctx.lineWidth = 1.15;
          ctx.stroke();
        }
      };

      // Left & Right anatomical 3D contours
      drawWireHemisphere(-r3d * 1.18, r3d, 'rgba(244,114,182,0.85)', false);
      drawWireHemisphere(r3d * 1.18, r3d, 'rgba(244,114,182,0.85)', false);
      // Reference fruit/object sphere on the right side for 1:1 comparison
      drawWireHemisphere(r3d * 2.95 + refR3d, refR3d, refObj.color || '#facc15', true);

      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#f9a8d4';
      ctx.fillText(
        `Масштаб 1:1 • ${res.eu_size} (${volMl} мл × 2)  vs  ${refObj.name} (${refObj.volume_ml} мл)`,
        12,
        H - 12
      );

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [visible, res, selectedRefId]);

  const sliders = [
    { label: 'Возраст (тонус связок Купера)', val: age, set: setAge, min: 18, max: 65, step: 1, unit: 'лет' },
    { label: 'Рост (торакальная пропорция)', val: heightCm, set: setHeightCm, min: 145, max: 195, step: 1, unit: 'см' },
    { label: 'Обхват под грудью (ОПГ)', val: underbustCm, set: setUnderbustCm, min: 63, max: 102, step: 1, unit: 'см' },
    { label: 'Обхват бёдер (гиноидное депо)', val: hipCm, set: setHipCm, min: 80, max: 128, step: 1, unit: 'см' },
    { label: 'Длина волос (индекс ER-β)', val: hairCm, set: setHairCm, min: 5, max: 100, step: 1, unit: 'см' },
    { label: 'Чашек матчи / рафа на кокосовом в нед.', val: matchaWeek, set: setMatchaWeek, min: 0, max: 21, step: 1, unit: 'шт' },
    { label: 'Сохранённых пинов на досках Pinterest', val: pins, set: setPins, min: 0, max: 8000, step: 100, unit: 'пинов' },
    { label: 'Баночек ухода на полке в ванной', val: jars, set: setJars, min: 1, max: 45, step: 1, unit: 'шт' },
    { label: 'Температура воды в душе', val: showerC, set: setShowerC, min: 34, max: 48, step: 1, unit: '°C' },
    { label: 'Часы в Sims 4 / Genshin / Клубе Романтики', val: gamesH, set: setGamesH, min: 0, max: 5000, step: 50, unit: 'ч' },
  ];

  return (
    <div ref={wrapRef} className="rounded-2xl bg-slate-900/80 border border-pink-500/25 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Mini3DSceneBadge seed="breast_size_calc" color="#ec4899" size={40} />
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white">
              👙 Десятифакторный Маммометрический Калькулятор Размера Груди
            </h3>
            <p className="text-xs text-slate-400">
              Расчёт пояса и чашки по стандарту EN 13402, объёма в миллилитрах и 3D-сравнение в масштабе 1:1
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={runCalc}
          className="px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-400 text-slate-950 font-bold text-xs"
        >
          Пересчитать матрицу
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sliders.map((s, idx) => (
          <div key={idx} className="p-3 rounded-xl bg-slate-950/90 border border-white/10 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">{s.label}</span>
              <span className="font-mono font-bold text-pink-300">
                {s.val} {s.unit}
              </span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={s.val}
              onChange={(e) => s.set(Number(e.target.value))}
              onMouseUp={runCalc}
              onTouchEnd={runCalc}
              className="w-full accent-pink-400"
            />
          </div>
        ))}
      </div>

      {res && (
        <div className="space-y-4 pt-2 border-t border-white/10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-950 border border-pink-400/40 text-center">
              <div className="text-[11px] text-slate-400">Размер EU / RU</div>
              <div className="text-2xl font-black font-mono text-pink-300">{res.eu_size}</div>
              <div className="text-[11px] text-slate-400">US/UK: {res.us_uk_size}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-white/10 text-center">
              <div className="text-[11px] text-slate-400">Обхват груди (ОГ)</div>
              <div className="text-xl font-bold font-mono text-white">{res.bust_cm} см</div>
              <div className="text-[11px] text-emerald-300">Δ = +{res.delta_cm} см к ОПГ</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-white/10 text-center">
              <div className="text-[11px] text-slate-400">Объём (1 / пара)</div>
              <div className="text-xl font-bold font-mono text-amber-300">
                {res.single_volume_ml} / {res.pair_volume_ml} мл
              </div>
              <div className="text-[11px] text-slate-400">Перцентиль: P{res.percentile}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-white/10 text-center">
              <div className="text-[11px] text-slate-400">Масса пары и нагрузка</div>
              <div className="text-xl font-bold font-mono text-sky-300">{res.pair_weight_g} г</div>
              <div className="text-[11px] text-slate-400">{res.spine_load_newtons} Н на Th4–Th7</div>
            </div>
          </div>

          {/* 3D Scale Viewport */}
          <div className="space-y-2">
            <canvas
              ref={canvasRef}
              style={{ height: 220 }}
              onPointerDown={(e) => {
                rotRef.current.down = true;
                rotRef.current.lx = e.clientX;
                rotRef.current.ly = e.clientY;
              }}
              onPointerMove={(e) => {
                if (!rotRef.current.down) return;
                rotRef.current.ry += (e.clientX - rotRef.current.lx) * 0.01;
                rotRef.current.rx += (e.clientY - rotRef.current.ly) * 0.01;
                rotRef.current.lx = e.clientX;
                rotRef.current.ly = e.clientY;
              }}
              onPointerUp={() => {
                rotRef.current.down = false;
              }}
              className="w-full rounded-xl bg-[#050814] border border-pink-500/25 cursor-grab touch-none block"
            />
            <div className="flex flex-wrap gap-1.5">
              {(res.comparisons || []).map((c: any) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedRefId(c.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] border transition ${
                    selectedRefId === c.id
                      ? 'bg-pink-500/25 border-pink-400 text-pink-100 font-semibold'
                      : 'bg-slate-950 border-white/10 text-slate-300'
                  }`}
                >
                  {c.name} ({c.volume_ml} мл)
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {(res.factors || []).map((f: any, i: number) => (
              <div key={i} className="p-2.5 rounded-xl bg-slate-950/80 border border-white/5 flex justify-between gap-2">
                <span className="text-slate-300">{f.label}</span>
                <span className="font-mono text-pink-300 shrink-0">{f.impact}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400">{res.methodology}</p>
        </div>
      )}
    </div>
  );
};
