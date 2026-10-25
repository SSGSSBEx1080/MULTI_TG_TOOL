import React, { useEffect, useState } from 'react';
import { Gamepad2, Pickaxe, Shield, Swords } from 'lucide-react';
import { apiGet } from '../../lib/api';
import { Mini3DSceneBadge } from '../three/Interactive3DScenes';

const GAME_WIKI_QUERY_MAP: Record<string, string> = {
  dota2: 'Dota 2',
  elden_ring: 'Elden Ring',
  minecraft: 'Minecraft',
  fortnite: 'Fortnite',
  cs2: 'Counter-Strike 2',
  bg3_terraria_cyberpunk: "Baldur's Gate 3",
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

export const GamingWikisHub: React.FC<{
  activeTool: string;
  onSelectTool: (t: string) => void;
}> = ({ activeTool, onSelectTool }) => {
  const [games, setGames] = useState<any[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>(() => {
    if (activeTool === 'elden_ring_guide') return 'elden_ring';
    if (activeTool === 'minecraft_guide') return 'minecraft';
    if (activeTool === 'fortnite_cs2_guides') return 'fortnite';
    return 'dota2';
  });
  const [wikiThumb, setWikiThumb] = useState<string | null>(null);
  const [mcDepthY, setMcDepthY] = useState<number>(-58);

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
    }
  }, [activeTool]);

  // Fetch official illustration/cover from Wikipedia REST summary
  useEffect(() => {
    setWikiThumb(null);
    const title = GAME_WIKI_QUERY_MAP[selectedGameId] || 'Dota 2';
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.thumbnail?.source) setWikiThumb(d.thumbnail.source);
      })
      .catch(() => {});
  }, [selectedGameId]);

  const current = games.find((g) => g.id === selectedGameId) || games[0];

  return (
    <div className="space-y-4 min-w-0">
      {/* Game Tabs */}
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
              <div>
                <h3 className="text-base font-bold text-white">
                  {current.emoji} {current.game}
                </h3>
                <p className="text-xs text-slate-400">{current.genre}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {(current.sections || []).map((sec: any, idx: number) => (
              <div key={idx} className="p-4 rounded-xl bg-slate-950/90 border border-white/10 space-y-1.5 text-xs">
                <div className="text-sm font-bold text-amber-300">{sec.title}</div>
                <div className="text-slate-200 whitespace-pre-line leading-relaxed">{sec.body}</div>
              </div>
            ))}
          </div>

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
    </div>
  );
};
