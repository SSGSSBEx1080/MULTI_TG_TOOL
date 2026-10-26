import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Crosshair, Pickaxe, Search, Shield } from 'lucide-react';
import { apiGet } from '../../lib/api';
import { Mini3DSceneBadge } from '../three/Interactive3DScenes';

const GAME_WIKI_QUERY_MAP: Record<string, string> = {
  dota2: 'Dota 2',
  elden_ring: 'Elden Ring',
  minecraft: 'Minecraft',
  fortnite: 'Fortnite',
  cs2: 'Counter-Strike 2',
  bg3_terraria_cyberpunk: "Baldur's Gate 3",
  genshin_honkai: 'Genshin Impact',
  gta_valorant: 'Grand Theft Auto V',
};

const MINECRAFT_ORES = [
  { ore: 'Изумруды (Горы)', peakY: 236, range: 'Y = −16 … 320', color: '#10b981' },
  { ore: 'Железо (Высокие пики)', peakY: 232, range: 'Y = 80 … 320', color: '#e2e8f0' },
  { ore: 'Уголь', peakY: 96, range: 'Y = 0 … 320', color: '#94a3b8' },
  { ore: 'Медь (Карстовые пещеры)', peakY: 48, range: 'Y = −16 … 112', color: '#f97316' },
  { ore: 'Железо (Шахтный слой)', peakY: 15, range: 'Y = −24 … 56', color: '#cbd5e1' },
  { ore: 'Лазурит', peakY: 0, range: 'Y = −64 … 64', color: '#3b82f6' },
  { ore: 'Золото (Обычный мир)', peakY: -16, range: 'Y = −64 … 32', color: '#facc15' },
  { ore: 'Алмазы + Редстоун', peakY: -59, range: 'Y = −64 … 16 (лава на −54)', color: '#22d3ee' },
  { ore: 'Древние обломки (Незер)', peakY: 15, range: 'Незер Y = 8 … 22', color: '#a855f7' },
];

// Yaw degrees per count at sensitivity 1.0
const GAME_YAW: Record<string, { label: string; yaw: number }> = {
  cs2: { label: 'Counter-Strike 2 / Apex', yaw: 0.022 },
  valorant: { label: 'Valorant', yaw: 0.07 },
  overwatch2: { label: 'Overwatch 2', yaw: 0.0066 },
  fortnite: { label: 'Fortnite (в %)', yaw: 0.005555 },
  r6: { label: 'Rainbow Six Siege', yaw: 0.0057296 },
};

export const GamingWikisHub: React.FC<{
  activeTool: string;
  onSelectTool: (t: string) => void;
}> = ({ activeTool, onSelectTool }) => {
  const [games, setGames] = useState<any[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>(() => {
    if (activeTool === 'elden_ring_guide') return 'elden_ring';
    if (activeTool === 'minecraft_guide') return 'minecraft';
    if (activeTool === 'fortnite_cs2_guides') return 'fortnite';
    if (activeTool === 'gta_genshin_roblox_guides') return 'genshin_honkai';
    return 'dota2';
  });
  const [searchQ, setSearchQ] = useState('');
  const [wikiThumb, setWikiThumb] = useState<string | null>(null);
  const [wikiThumbLoading, setWikiThumbLoading] = useState(false);
  const [wikiThumbError, setWikiThumbError] = useState('');
  const wikiThumbRequestId = useRef(0);
  const [mcDepthY, setMcDepthY] = useState<number>(-58);

  // Esports Mouse Sensitivity & cm/360° Converter
  const [dpi, setDpi] = useState<number>(800);
  const [srcShooter, setSrcShooter] = useState<string>('cs2');
  const [srcSens, setSrcSens] = useState<number>(1.05);

  // Dota 2 Match Minute Helper
  const [dotaMin, setDotaMin] = useState<number>(7);

  // Elden Ring Equip Load Calculator
  const [erMaxLoad, setErMaxLoad] = useState<number>(72.0);
  const [erCurWeight, setErCurWeight] = useState<number>(48.5);

  useEffect(() => {
    apiGet('/api/v6/gaming/wikis')
      .then((r) => setGames(r.games || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTool === 'dota2_guide') setSelectedGameId('dota2');
    else if (activeTool === 'elden_ring_guide') setSelectedGameId('elden_ring');
    else if (activeTool === 'minecraft_guide') setSelectedGameId('minecraft');
    else if (activeTool === 'fortnite_cs2_guides' && !['fortnite', 'cs2', 'bg3_terraria_cyberpunk'].includes(selectedGameId)) {
      setSelectedGameId('fortnite');
    } else if (activeTool === 'gta_genshin_roblox_guides' && !['genshin_honkai', 'gta_valorant'].includes(selectedGameId)) {
      setSelectedGameId('genshin_honkai');
    }
  }, [activeTool]);

  useEffect(() => {
    wikiThumbRequestId.current += 1;
    setWikiThumb(null);
    setWikiThumbError('');
    setWikiThumbLoading(false);
  }, [selectedGameId]);

  const loadWikiThumb = async () => {
    const id = ++wikiThumbRequestId.current;
    const title = GAME_WIKI_QUERY_MAP[selectedGameId] || 'Dota 2';
    setWikiThumbLoading(true);
    setWikiThumbError('');
    try {
      // Remote Wikimedia access is deliberately user-triggered, never automatic on tab open.
      const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
      if (!response.ok) throw new Error(`Wikipedia вернула HTTP ${response.status}`);
      const data = await response.json();
      if (id !== wikiThumbRequestId.current) return;
      if (!data?.thumbnail?.source) {
        setWikiThumbError('Для этой статьи не удалось найти иллюстрацию. Содержание справки доступно без неё.');
        return;
      }
      setWikiThumb(data.thumbnail.source);
    } catch (error: any) {
      if (id === wikiThumbRequestId.current) setWikiThumbError(error?.message || 'Не удалось получить изображение из Wikipedia');
    } finally {
      if (id === wikiThumbRequestId.current) setWikiThumbLoading(false);
    }
  };

  const current = games.find((g) => g.id === selectedGameId) || games[0];

  const sensCalc = useMemo(() => {
    const safeDpi = Math.max(100, dpi || 800);
    const safeSens = Math.max(0.01, srcSens || 1);
    const baseYaw = GAME_YAW[srcShooter]?.yaw || 0.022;
    const countsPer360 = 360 / (safeSens * baseYaw);
    const cm360 = (countsPer360 / safeDpi) * 2.54;
    const conversions = Object.entries(GAME_YAW).map(([id, meta]) => ({
      id,
      label: meta.label,
      sens: 360 / (countsPer360 * meta.yaw),
      edpi: safeDpi * (360 / (countsPer360 * meta.yaw)),
    }));
    return { cm360, edpi: safeDpi * safeSens, conversions };
  }, [dpi, srcShooter, srcSens]);

  const filteredSections = useMemo(() => {
    if (!current) return [];
    const q = searchQ.trim().toLowerCase();
    if (!q) return current.sections || [];
    return (current.sections || []).filter(
      (s: any) => s.title.toLowerCase().includes(q) || s.body.toLowerCase().includes(q)
    );
  }, [current, searchQ]);

  const erRatio = erMaxLoad > 0 ? (erCurWeight / erMaxLoad) * 100 : 0;
  const erRollType =
    erRatio < 30 ? 'Лёгкий перекат (Light Roll < 30%)' : erRatio < 70 ? 'Средний перекат (Med Roll < 70%)' : erRatio < 100 ? 'Тяжёлый перекат (Fat Roll ≥ 70%)' : 'Перегруз (нет переката)';

  return (
    <div className="space-y-4 min-w-0">
      {/* Game Tabs + Search */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {games.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                setSelectedGameId(g.id);
                if (g.id === 'dota2') onSelectTool('dota2_guide');
                else if (g.id === 'elden_ring') onSelectTool('elden_ring_guide');
                else if (g.id === 'minecraft') onSelectTool('minecraft_guide');
                else if (g.id === 'genshin_honkai' || g.id === 'gta_valorant') onSelectTool('gta_genshin_roblox_guides');
                else onSelectTool('fortnite_cs2_guides');
              }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                selectedGameId === g.id
                  ? 'bg-rose-500/25 border-rose-400 text-rose-100'
                  : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              {g.emoji} {g.game}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-56">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Фильтр внутри гайда..."
            className="w-full rounded-xl bg-slate-950 border border-white/10 pl-8 pr-3 py-1.5 text-xs text-white"
          />
        </div>
      </div>

      {current && (
        <div className="rounded-2xl bg-slate-900/80 border border-rose-500/25 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {wikiThumb ? (
                <img
                  src={wikiThumb}
                  alt={current.game}
                  className="w-16 h-16 rounded-xl object-cover border border-white/15 shrink-0"
                />
              ) : (
                <Mini3DSceneBadge seed={current.id} color="#ef4444" size={44} />
              )}
              <div className="min-w-0">
                <h3 className="text-base font-bold text-white">{current.emoji} {current.game}</h3>
                <p className="text-xs text-slate-400">{current.genre}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => { if (wikiThumb) { setWikiThumb(null); setWikiThumbError(''); } else { void loadWikiThumb(); } }} disabled={wikiThumbLoading} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] text-slate-300 hover:bg-white/10 disabled:opacity-50">
                    {wikiThumbLoading ? 'Запрашиваю изображение…' : wikiThumb ? 'Скрыть изображение' : 'Загрузить иллюстрацию из Wikipedia (по запросу)'}
                  </button>
                  {wikiThumbError && <span role="status" className="text-[10px] text-amber-200">{wikiThumbError}</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {filteredSections.map((sec: any, idx: number) => (
              <div key={idx} className="p-4 rounded-xl bg-slate-950/90 border border-white/10 space-y-1.5 text-xs">
                <div className="text-sm font-bold text-amber-300">{sec.title}</div>
                <div className="text-slate-200 whitespace-pre-line leading-relaxed">{sec.body}</div>
              </div>
            ))}
          </div>

          {/* Interactive Dota 2 Match Timing Radar */}
          {current.id === 'dota2' && (
            <div className="p-4 rounded-xl bg-slate-950 border border-amber-400/35 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> Шпаргалка таймингов карты по минуте матча
                </span>
                <span className="font-mono font-black text-base text-white">{dotaMin}:00</span>
              </div>
              <input
                type="range"
                min={0}
                max={42}
                value={dotaMin}
                onChange={(e) => setDotaMin(Number(e.target.value))}
                className="w-full accent-amber-400"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg bg-slate-900 border border-white/10">
                  <div className="text-slate-400">Время суток и Рошан</div>
                  <div className="font-bold text-white mt-0.5">
                    {Math.floor(dotaMin / 5) % 2 === 0 ? '☀️ День — Рошан в нижнем логове' : '🌙 Ночь — Рошан в верхнем логове'}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-white/10">
                  <div className="text-slate-400">Руны на {dotaMin}:00</div>
                  <div className="font-bold text-sky-300 mt-0.5">
                    {[
                      dotaMin % 7 === 0 && dotaMin > 0 ? 'Руна Мудрости!' : null,
                      dotaMin % 3 === 0 ? 'Богатство + Лотос' : null,
                      dotaMin === 2 || dotaMin === 4 ? 'Руны Воды' : null,
                      dotaMin >= 6 && dotaMin % 2 === 0 ? 'Активная руна реки' : null,
                    ]
                      .filter(Boolean)
                      .join(' • ') || 'Стаки кемпов (:53–:55)'}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-white/10">
                  <div className="text-slate-400">Объекты карты</div>
                  <div className="font-bold text-emerald-300 mt-0.5">
                    {dotaMin >= 20
                      ? 'Терзатель активен (бесплатный Shard)'
                      : dotaMin >= 15
                      ? 'Shard доступен в лавке (1400 золота)'
                      : `До Терзателя: ${20 - dotaMin} мин`}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Elden Ring Equip Load & Roll Calculator */}
          {current.id === 'elden_ring' && (
            <div className="p-4 rounded-xl bg-slate-950 border border-amber-400/35 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Shield className="w-4 h-4" /> Калькулятор веса снаряжения и перекатов (Equip Load)
                </span>
                <span className={`font-mono font-bold ${erRatio < 70 ? 'text-emerald-300' : 'text-rose-400'}`}>
                  {erRatio.toFixed(1)}% — {erRollType}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="space-y-1">
                  <span className="text-slate-400">Макс. нагрузка (от Стойкости):</span>
                  <input
                    type="number"
                    step="0.5"
                    value={erMaxLoad}
                    onChange={(e) => setErMaxLoad(Number(e.target.value))}
                    className="w-full rounded-lg bg-slate-900 border border-white/15 px-3 py-1.5 font-mono text-white"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400">Текущий вес брони и оружия:</span>
                  <input
                    type="number"
                    step="0.5"
                    value={erCurWeight}
                    onChange={(e) => setErCurWeight(Number(e.target.value))}
                    className="w-full rounded-lg bg-slate-900 border border-white/15 px-3 py-1.5 font-mono text-white"
                  />
                </label>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-white/10 flex flex-col justify-center">
                  <div className="text-slate-400">Порог Med Roll (69.9%):</div>
                  <div className="font-mono font-bold text-sky-300">
                    макс. {(erMaxLoad * 0.699).toFixed(1)} ед. (Light: {(erMaxLoad * 0.299).toFixed(1)})
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Minecraft Ore Y-Level Scanner */}
          {current.id === 'minecraft' && (
            <div className="p-4 rounded-xl bg-slate-950 border border-emerald-400/35 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <Pickaxe className="w-4 h-4" /> Интерактивный сканер высоты шахты Y (−64 … +256)
                </span>
                <span className="font-mono font-black text-base text-white">Y = {mcDepthY}</span>
              </div>
              <input
                type="range"
                min={-64}
                max={256}
                value={mcDepthY}
                onChange={(e) => setMcDepthY(Number(e.target.value))}
                className="w-full accent-emerald-400"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {MINECRAFT_ORES.map((o) => {
                  const near = Math.abs(o.peakY - mcDepthY) <= 18;
                  return (
                    <div
                      key={o.ore}
                      onClick={() => setMcDepthY(o.peakY)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition ${
                        near ? 'bg-emerald-500/20 border-emerald-400' : 'bg-slate-900 border-white/5'
                      }`}
                    >
                      <div className="font-bold" style={{ color: o.color }}>
                        {o.ore}
                      </div>
                      <div className="font-mono text-[11px] text-slate-300">
                        Пик: Y = {o.peakY} ({o.range})
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Universal Esports eDPI & cm/360° Mouse Sensitivity Converter */}
      <div className="rounded-2xl bg-slate-900/80 border border-sky-500/25 p-4 sm:p-5 space-y-3.5 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-bold text-sm text-white flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-sky-400" /> Киберспортивный Конвертер Чувствительности Мыши (eDPI и см/360°)
          </div>
          <span className="font-mono text-sky-300 font-bold">
            Оборот 360°: {sensCalc.cm360.toFixed(2)} см • Исходный eDPI: {Math.round(sensCalc.edpi)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <label className="space-y-1">
            <span className="text-slate-400">DPI сенсора мыши:</span>
            <input
              type="number"
              min={100}
              max={16000}
              step={50}
              value={dpi}
              onChange={(e) => setDpi(Number(e.target.value))}
              className="w-full rounded-xl bg-slate-950 border border-white/15 px-3 py-2 font-mono text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">Исходная игра:</span>
            <select
              value={srcShooter}
              onChange={(e) => setSrcShooter(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-white/15 px-3 py-2 text-white"
            >
              {Object.entries(GAME_YAW).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">Чувствительность (Sens):</span>
            <input
              type="number"
              min={0.01}
              max={50}
              step={0.05}
              value={srcSens}
              onChange={(e) => setSrcSens(Number(e.target.value))}
              className="w-full rounded-xl bg-slate-950 border border-white/15 px-3 py-2 font-mono text-white"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {sensCalc.conversions.map((c) => (
            <div key={c.id} className="p-2.5 rounded-xl bg-slate-950 border border-white/10">
              <div className="text-[11px] text-slate-400 truncate">{c.label}</div>
              <div className="font-mono font-black text-sm text-amber-300 mt-0.5">{c.sens.toFixed(3)}</div>
              <div className="font-mono text-[10px] text-slate-500">eDPI: {Math.round(c.edpi)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
