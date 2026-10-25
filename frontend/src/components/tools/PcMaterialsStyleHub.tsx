import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  Cpu,
  Layers,
  MapPin,
  Palette,
  Search,
  Sparkles,
  Upload,
  Wrench,
} from 'lucide-react';
import { apiGet, apiPost, copyText } from '../../lib/api';
import { project3D, rotateEuler, syncHiDPICanvas, useCanvasVisibility } from '../../lib/engine3d';
import { Mini3DSceneBadge } from '../three/Interactive3DScenes';

// ============================================================================
// 1. PC BUILDER + ENGINEERING MATERIALS + OUTFIT STYLES & LOOKSMAXXING HUB
// ============================================================================

export const PcMaterialsStyleHub: React.FC<{
  activeTool: string;
  onSelectTool: (t: string) => void;
  onSync: () => void;
  onToast: (msg: string) => void;
}> = ({ activeTool, onSelectTool, onSync, onToast }) => {
  const tab =
    activeTool === 'materials_fasteners_encyc'
      ? 'materials'
      : activeTool === 'outfit_looksmax_hub'
      ? 'style'
      : 'pc';

  // PC Builder State
  const [catalog, setCatalog] = useState<any>(null);
  const [cpuId, setCpuId] = useState('r7_9800x3d');
  const [gpuId, setGpuId] = useState('rtx_5070ti');
  const [mbId, setMbId] = useState('b650_aorus');
  const [ramId, setRamId] = useState('ddr5_32_6000');
  const [coolerId, setCoolerId] = useState('ak620');
  const [ssdId, setSsdId] = useState('990pro_2tb');
  const [psuId, setPsuId] = useState('psu_850');
  const [caseId, setCaseId] = useState('lancool_216');
  const [evalRes, setEvalRes] = useState<any>(null);

  // Materials State
  const [matData, setMatData] = useState<any>(null);
  const [matSec, setMatSec] = useState<'fasteners' | 'metals' | 'plastics' | 'glass'>('fasteners');

  // Style & Looksmax State
  const [styleData, setStyleData] = useState<any>({ outfits: [], looksmaxxing: [] });

  const { wrapRef, visible } = useCanvasVisibility();
  const pcCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    apiGet('/api/v6/pc/catalog').then(setCatalog).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab !== 'pc') return;
    apiPost('/api/v6/pc/evaluate', {
      cpu_id: cpuId,
      gpu_id: gpuId,
      mb_id: mbId,
      ram_id: ramId,
      cooler_id: coolerId,
      ssd_id: ssdId,
      psu_id: psuId,
      case_id: caseId,
    })
      .then((r) => {
        setEvalRes(r);
        onSync();
      })
      .catch(() => {});
  }, [tab, cpuId, gpuId, mbId, ramId, coolerId, ssdId, psuId, caseId]);

  useEffect(() => {
    if (tab === 'materials' && !matData) {
      apiGet('/api/v6/materials/catalog').then(setMatData).catch(() => {});
    }
    if (tab === 'style' && styleData.outfits.length === 0) {
      apiGet('/api/v6/style/looksmax').then(setStyleData).catch(() => {});
    }
  }, [tab]);

  // 3D PC Chassis Wireframe + Spinning ARGB Fans
  useEffect(() => {
    const cvs = pcCanvasRef.current;
    if (!cvs || !visible || tab !== 'pc') return;
    let raf = 0;
    let t = 0;
    const boxVerts = [
      { x: -0.45, y: -0.95, z: -0.85 },
      { x: 0.45, y: -0.95, z: -0.85 },
      { x: 0.45, y: 0.95, z: -0.85 },
      { x: -0.45, y: 0.95, z: -0.85 },
      { x: -0.45, y: -0.95, z: 0.85 },
      { x: 0.45, y: -0.95, z: 0.85 },
      { x: 0.45, y: 0.95, z: 0.85 },
      { x: -0.45, y: 0.95, z: 0.85 },
    ];
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];

    const render = () => {
      const { ctx, W, H } = syncHiDPICanvas(cvs);
      if (!ctx || W < 20) {
        raf = requestAnimationFrame(render);
        return;
      }
      t += 0.035;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#050814';
      ctx.fillRect(0, 0, W, H);

      const ry = -0.58 + Math.sin(t * 0.28) * 0.22;
      const rx = 0.2;
      const fov = Math.min(W, H) * 0.95;
      const cam = 3.2;

      const proj = boxVerts.map((v) => project3D(rotateEuler(v, rx, ry), W, H, fov, cam));
      const ok = evalRes?.compatible !== false;
      ctx.strokeStyle = ok ? 'rgba(56,189,248,0.75)' : 'rgba(244,63,94,0.85)';
      ctx.lineWidth = 1.6;
      for (const [a, b] of edges) {
        ctx.beginPath();
        ctx.moveTo(proj[a].sx, proj[a].sy);
        ctx.lineTo(proj[b].sx, proj[b].sy);
        ctx.stroke();
      }

      // 3 Front ARGB Fans spinning
      for (let f = -1; f <= 1; f++) {
        const fy = f * 0.52;
        ctx.beginPath();
        for (let s = 0; s <= 24; s++) {
          const ang = (s / 24) * Math.PI * 2;
          const p3 = rotateEuler({ x: Math.cos(ang) * 0.22, y: fy + Math.sin(ang) * 0.22, z: 0.85 }, rx, ry);
          const pp = project3D(p3, W, H, fov, cam);
          if (s === 0) ctx.moveTo(pp.sx, pp.sy);
          else ctx.lineTo(pp.sx, pp.sy);
        }
        const hue = Math.round((t * 45 + f * 60) % 360);
        ctx.strokeStyle = `hsla(${hue}, 90%, 65%, 0.85)`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // GPU Horizontal Brick inside chassis
      const gpuLen = Math.min(0.75, ((evalRes?.selected?.gpu?.length_mm || 300) / 420) * 0.72);
      const gA = project3D(rotateEuler({ x: -0.32, y: 0.12, z: -gpuLen }, rx, ry), W, H, fov, cam);
      const gB = project3D(rotateEuler({ x: 0.28, y: 0.12, z: gpuLen }, rx, ry), W, H, fov, cam);
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(gA.sx, gA.sy);
      ctx.lineTo(gB.sx, gB.sy);
      ctx.stroke();

      ctx.font = '600 10.5px "JetBrains Mono", monospace';
      ctx.fillStyle = ok ? '#7dd3fc' : '#fda4af';
      ctx.fillText(
        ok
          ? `3D СБОРКА СОВМЕСТИМА • ПИК ~${evalRes?.est_peak_draw_w || 0} Вт`
          : 'ОБНАРУЖЕН КОНФЛИКТ КОМПЛЕКТУЮЩИХ!',
        12,
        H - 10
      );

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [visible, tab, evalRes]);

  return (
    <div ref={wrapRef} className="space-y-4 min-w-0">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onSelectTool('pc_builder_pro')}
          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
            tab === 'pc' ? 'bg-indigo-500/25 border-indigo-400 text-indigo-100' : 'bg-slate-900 border-white/10 text-slate-300'
          }`}
        >
          🖥️ Конструктор ПК и Совместимость
        </button>
        <button
          type="button"
          onClick={() => onSelectTool('materials_fasteners_encyc')}
          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
            tab === 'materials' ? 'bg-amber-500/25 border-amber-400 text-amber-100' : 'bg-slate-900 border-white/10 text-slate-300'
          }`}
        >
          🔩 Гвозди, Металлы, Пластики и Стекло
        </button>
        <button
          type="button"
          onClick={() => onSelectTool('outfit_looksmax_hub')}
          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
            tab === 'style' ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100' : 'bg-slate-900 border-white/10 text-slate-300'
          }`}
        >
          🧥 Стили Одежды и Все Виды Луксмаксинга
        </button>
      </div>

      {/* 1. PC BUILDER PRO */}
      {tab === 'pc' && catalog && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-7 rounded-2xl bg-slate-900/80 border border-indigo-500/25 p-4 space-y-3 text-xs">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" /> Подбор Комплектующих ПК (Проверка сокета, ОЗУ, мм и БП)
            </h3>

            {[
              { label: 'Процессор (CPU)', val: cpuId, set: setCpuId, list: catalog.cpus, extra: (x: any) => `${x.socket} • ${x.tdp_w}W` },
              { label: 'Материнская плата', val: mbId, set: setMbId, list: catalog.motherboards, extra: (x: any) => `${x.socket} • ${x.ram_type} • ${x.form_factor}` },
              { label: 'Видеокарта (GPU)', val: gpuId, set: setGpuId, list: catalog.gpus, extra: (x: any) => `${x.length_mm} мм • ${x.tdp_w}W` },
              { label: 'Оперативная память (RAM)', val: ramId, set: setRamId, list: catalog.rams, extra: (x: any) => x.ram_type },
              { label: 'Охлаждение CPU', val: coolerId, set: setCoolerId, list: catalog.coolers, extra: (x: any) => `до ${x.max_tdp_w}W` },
              { label: 'Накопитель NVMe SSD', val: ssdId, set: setSsdId, list: catalog.ssds, extra: () => 'M.2' },
              { label: 'Блок питания (PSU)', val: psuId, set: setPsuId, list: catalog.psus, extra: (x: any) => `${x.watts}W` },
              { label: 'Корпус ПК', val: caseId, set: setCaseId, list: catalog.cases, extra: (x: any) => `GPU до ${x.max_gpu_mm} мм` },
            ].map((row) => (
              <div key={row.label} className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-300">{row.label}</div>
                <select
                  value={row.val}
                  onChange={(e) => row.set(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-white/15 px-3 py-2 text-white"
                >
                  {(row.list || []).map((item: any) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({row.extra(item)} • {item.price_rub.toLocaleString('ru-RU')} ₽)
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="xl:col-span-5 rounded-2xl bg-slate-950/95 border border-white/10 p-4 space-y-3 text-xs">
            <canvas ref={pcCanvasRef} style={{ height: 195 }} className="w-full rounded-xl bg-[#050814] border border-white/10 block" />

            {evalRes && (
              <>
                <div
                  className={`p-3 rounded-xl border ${
                    evalRes.compatible
                      ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                      : 'bg-rose-500/15 border-rose-400/45 text-rose-200'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    {evalRes.compatible ? (
                      <><CheckCircle2 className="w-4 h-4" /> Все узлы на 100% совместимы</>
                    ) : (
                      <><AlertTriangle className="w-4 h-4" /> Несовместимость комплектующих:</>
                    )}
                  </div>
                  {(evalRes.errors || []).map((err: string, i: number) => (
                    <div key={i} className="mt-1">• {err}</div>
                  ))}
                  {(evalRes.warnings || []).map((w: string, i: number) => (
                    <div key={i} className="mt-1 text-amber-300">⚠️ {w}</div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-white/10">
                    <div className="text-slate-400 text-[10px]">Ориентировочная цена</div>
                    <div className="text-base font-mono font-black text-amber-300">
                      {evalRes.total_price_rub.toLocaleString('ru-RU')} ₽
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-white/10">
                    <div className="text-slate-400 text-[10px]">Баланс CPU / GPU</div>
                    <div className="text-xs font-bold text-sky-300">{evalRes.bottleneck_verdict}</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="font-bold text-slate-200">Прогноз среднего FPS (1080p / 1440p / 4K):</div>
                  {(evalRes.fps_benchmarks || []).map((g: any) => (
                    <div key={g.game} className="p-2 rounded-lg bg-slate-900 border border-white/5 flex items-center justify-between gap-2">
                      <span className="text-slate-300 truncate">{g.game}</span>
                      <span className="font-mono font-bold text-emerald-300 shrink-0">
                        {g.fps_1080p} / {g.fps_1440p} / {g.fps_4k}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 2. ENGINEERING CLASSIFICATION: NAILS, METALS, PLASTICS & GLASS */}
      {tab === 'materials' && matData && (
        <div className="rounded-2xl bg-slate-900/80 border border-amber-500/25 p-4 space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'fasteners', label: '🔩 Гвозди, Саморезы и Болты' },
                { id: 'metals', label: '⚙️ Металлы и Сплавы' },
                { id: 'plastics', label: '♻️ Пластики и Полимеры (1–7)' },
                { id: 'glass', label: '🪟 Виды Стекла' },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setMatSec(s.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  matSec === s.id
                    ? 'bg-amber-500/25 border-amber-400 text-amber-100'
                    : 'bg-slate-950 border-white/10 text-slate-300'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(matData[matSec] || []).map((item: any, idx: number) => (
              <div key={idx} className="p-4 rounded-xl bg-slate-950/90 border border-white/10 space-y-1.5 text-xs">
                <div className="text-sm font-bold text-white">{item.name}</div>
                <div className="font-mono text-[11px] text-amber-300">{item.spec}</div>
                <div className="text-sky-300">Состав / основа: {item.material}</div>
                <p className="text-slate-300 leading-relaxed">{item.use}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. OUTFIT MATCHING BY AESTHETICS & ALL TYPES OF LOOKSMAXXING */}
      {tab === 'style' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-900/80 border border-emerald-500/25 p-4 space-y-3">
            <h3 className="text-sm sm:text-base font-bold text-white">
              🧥 Капсульный Подбор Одежды по Стилям и Цветовым Сочетаниям
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(styleData.outfits || []).map((o: any) => (
                <div key={o.id} className="p-4 rounded-xl bg-slate-950/90 border border-white/10 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-white">{o.style}</span>
                    <div className="flex gap-1">
                      {(o.palette || []).map((hex: string) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => copyText(hex, onToast)}
                          style={{ backgroundColor: hex }}
                          title={`Скопировать ${hex}`}
                          className="w-5 h-5 rounded-md border border-white/25"
                        />
                      ))}
                    </div>
                  </div>
                  <div className="text-emerald-300 text-[11px]">{o.vibe}</div>
                  <div className="text-slate-300"><b>Верх:</b> {o.top}</div>
                  <div className="text-slate-300"><b>Низ:</b> {o.bottom}</div>
                  <div className="text-slate-300"><b>Обувь:</b> {o.shoes}</div>
                  <div className="text-slate-400"><b>Детали:</b> {o.acc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900/80 border border-sky-500/25 p-4 space-y-3">
            <h3 className="text-sm sm:text-base font-bold text-white">
              🧬 Полная Систематика Всех Направлений Looksmaxxing (Доказательный разбор)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(styleData.looksmaxxing || []).map((l: any, i: number) => (
                <div key={i} className="p-4 rounded-xl bg-slate-950/90 border border-white/10 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-white">{l.category}</span>
                    <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 text-[10px] shrink-0">
                      {l.science_level}
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{l.protocol}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2. CAR MAKES & MODELS SPECS STUDIO + SIDE-BY-SIDE COMPARISON
// ============================================================================

export const CarSpecsStudio: React.FC<{ onToast: (m: string) => void }> = () => {
  const [q, setQ] = useState('');
  const [cars, setCars] = useState<any[]>([]);
  const [cmpA, setCmpA] = useState('car_1');
  const [cmpB, setCmpB] = useState('car_16');

  useEffect(() => {
    apiGet(`/api/v6/cars/catalog?q=${encodeURIComponent(q)}`)
      .then((r) => setCars(r.items || []))
      .catch(() => {});
  }, [q]);

  const carA = cars.find((c) => c.id === cmpA) || cars[0];
  const carB = cars.find((c) => c.id === cmpB) || cars[1];

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-sky-500/25 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Mini3DSceneBadge seed="car_specs_catalog" color="#38bdf8" size={38} />
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white">
              🏎️ Каталог Марок и Моделей Автомобилей с Характеристиками
            </h3>
            <p className="text-xs text-slate-400">
              Двигатели, мощность, крутящий момент, разгон 0–100 км/ч, масса и удельная мощность
            </p>
          </div>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Марка, модель или мотор (BMW, Porsche, Supra, 2JZ, V8, LADA)..."
          className="w-full sm:w-72 rounded-xl bg-slate-950 border border-white/15 px-3.5 py-2 text-xs text-white"
        />
      </div>

      {carA && carB && (
        <div className="p-3.5 rounded-xl bg-slate-950 border border-amber-400/30 space-y-2 text-xs">
          <div className="font-bold text-amber-300">🏁 Сравнение динамики двух автомобилей:</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select value={carA.id} onChange={(e) => setCmpA(e.target.value)} className="rounded-lg bg-slate-900 border border-white/10 p-2 text-white">
              {cars.map((c) => (
                <option key={c.id} value={c.id}>{c.make} {c.model} ({c.hp} л.с. • {c.zero_to_100_s} с)</option>
              ))}
            </select>
            <select value={carB.id} onChange={(e) => setCmpB(e.target.value)} className="rounded-lg bg-slate-900 border border-white/10 p-2 text-white">
              {cars.map((c) => (
                <option key={c.id} value={c.id}>{c.make} {c.model} ({c.hp} л.с. • {c.zero_to_100_s} с)</option>
              ))}
            </select>
          </div>
          <div className="font-mono text-[11px] text-slate-300">
            Разница 0–100 км/ч: <b className="text-emerald-300">{Math.abs(carA.zero_to_100_s - carB.zero_to_100_s).toFixed(2)} с</b> • Удельная мощность: <b>{carA.power_to_weight}</b> vs <b>{carB.power_to_weight} л.с./т</b>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[560px] overflow-y-auto pr-1">
        {cars.map((c) => (
          <div key={c.id} className="p-3.5 rounded-xl bg-slate-950/90 border border-white/10 space-y-2 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-bold text-sm text-white">{c.make} {c.model}</div>
                <div className="text-[11px] text-slate-400">{c.origin} • {c.years} • {c.body_class}</div>
              </div>
              <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-200 font-mono font-bold">
                {c.zero_to_100_s} с
              </span>
            </div>
            <div className="text-amber-300 font-mono text-[11px]">{c.engine} • {c.drivetrain}</div>
            <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[11px]">
              <div className="p-1.5 rounded bg-slate-900"><b>{c.hp}</b> л.с. / {c.torque_nm} Н·м</div>
              <div className="p-1.5 rounded bg-slate-900">Макс. <b>{c.top_speed_kmh}</b> км/ч</div>
              <div className="p-1.5 rounded bg-slate-900">{c.weight_kg} кг ({c.power_to_weight} л.с./т)</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 3. ROUTE PLANNER & DISTANCE / FUEL CALCULATOR
// ============================================================================

export const RoutePlannerStudio: React.FC<{ onSync: () => void; onToast: (m: string) => void }> = ({ onSync, onToast }) => {
  const [origin, setOrigin] = useState('Москва');
  const [dest, setDest] = useState('Санкт-Петербург');
  const [via, setVia] = useState('');
  const [transport, setTransport] = useState('car');
  const [fuelL, setFuelL] = useState(8.2);
  const [fuelRub, setFuelRub] = useState(61.5);
  const [res, setRes] = useState<any>(null);

  const calc = async () => {
    try {
      const r = await apiPost('/api/v6/route/plan', {
        origin,
        destination: dest,
        via,
        transport,
        fuel_l_per_100km: fuelL,
        fuel_price_rub: fuelRub,
      });
      setRes(r);
      onSync();
    } catch (e: any) {
      onToast(e.message || 'Ошибка маршрута');
    }
  };

  useEffect(() => {
    calc();
  }, []);

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-emerald-500/25 p-4 space-y-4 text-xs">
      <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
        <MapPin className="w-4 h-4 text-emerald-400" /> Калькулятор Маршрутов, Времени в Пути и Топлива
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Откуда (город или lat,lon)" className="rounded-xl bg-slate-950 border border-white/15 px-3 py-2 text-white" />
        <input value={via} onChange={(e) => setVia(e.target.value)} placeholder="Через (необязательно, через ;)" className="rounded-xl bg-slate-950 border border-white/15 px-3 py-2 text-white" />
        <input value={dest} onChange={(e) => setDest(e.target.value)} placeholder="Куда (город или lat,lon)" className="rounded-xl bg-slate-950 border border-white/15 px-3 py-2 text-white" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: 'car', label: '🚗 Автомобиль' },
          { id: 'train', label: '🚆 Поезд' },
          { id: 'plane', label: '✈️ Самолёт' },
          { id: 'bike', label: '🚴 Велосипед' },
          { id: 'walk', label: '🚶 Пешком' },
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setTransport(m.id)}
            className={`px-3 py-1.5 rounded-xl border ${
              transport === m.id ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100 font-bold' : 'bg-slate-950 border-white/10 text-slate-300'
            }`}
          >
            {m.label}
          </button>
        ))}
        <button type="button" onClick={calc} className="px-4 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold">
          Рассчитать маршрут
        </button>
      </div>

      {res && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-xl bg-slate-950 border border-white/10">
            <div className="text-slate-400">Дистанция маршрута</div>
            <div className="text-lg font-mono font-bold text-white">{res.route_distance_km} км</div>
            <div className="text-[10px] text-slate-500">По прямой: {res.air_distance_km} км</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-white/10">
            <div className="text-slate-400">Расчётное время</div>
            <div className="text-lg font-mono font-bold text-emerald-300">{res.duration_formatted}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-white/10">
            <div className="text-slate-400">Расход топлива</div>
            <div className="text-lg font-mono font-bold text-amber-300">{res.fuel_liters} л</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-white/10">
            <div className="text-slate-400">Бюджет на топливо</div>
            <div className="text-lg font-mono font-bold text-sky-300">{res.fuel_cost_rub.toLocaleString('ru-RU')} ₽</div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 4. COLOR MATCHING PRO STUDIO + PHOTO PALETTE EXTRACTOR + DALTONISM SIM
// ============================================================================

function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
}

export const ColorMatchingProStudio: React.FC<{ onToast: (m: string) => void }> = ({ onToast }) => {
  const [hue, setHue] = useState(202);
  const [sat, setSat] = useState(86);
  const [light, setLight] = useState(56);
  const [photoColors, setPhotoColors] = useState<string[]>([]);

  const harmonies = useMemo(() => {
    return [
      { name: 'Базовый + Комплементарный (контраст Иттена 180°)', colors: [hslToHex(hue, sat, light), hslToHex((hue + 180) % 360, sat, light), hslToHex(hue, 20, 94), hslToHex((hue + 180) % 360, 30, 14)] },
      { name: 'Раздельно-комплементарная триада (+150° / +210°)', colors: [hslToHex(hue, sat, light), hslToHex((hue + 150) % 360, sat, light), hslToHex((hue + 210) % 360, sat, light)] },
      { name: 'Классическая триада Иттена (120°)', colors: [hslToHex(hue, sat, light), hslToHex((hue + 120) % 360, sat, light), hslToHex((hue + 240) % 360, sat, light)] },
      { name: 'Мягкая аналоговая гармония (±28°)', colors: [hslToHex((hue + 332) % 360, sat, light), hslToHex(hue, sat, light), hslToHex((hue + 28) % 360, sat, light)] },
      { name: 'Правило 60–30–10 для интерьера и UI', colors: [hslToHex(hue, 16, 12), hslToHex(hue, 28, 24), hslToHex((hue + 165) % 360, 88, 58)] },
    ];
  }, [hue, sat, light]);

  const handleImageUpload = (file?: File | null) => {
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const cvs = document.createElement('canvas');
      cvs.width = 64;
      cvs.height = 64;
      const ctx = cvs.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 64, 64);
      const data = ctx.getImageData(0, 0, 64, 64).data;
      const buckets: Record<string, { r: number; g: number; b: number; n: number }> = {};
      for (let i = 0; i < data.length; i += 16) {
        if (data[i + 3] < 128) continue;
        const key = `${data[i] >> 5}-${data[i + 1] >> 5}-${data[i + 2] >> 5}`;
        if (!buckets[key]) buckets[key] = { r: 0, g: 0, b: 0, n: 0 };
        buckets[key].r += data[i];
        buckets[key].g += data[i + 1];
        buckets[key].b += data[i + 2];
        buckets[key].n += 1;
      }
      const top = Object.values(buckets)
        .sort((a, b) => b.n - a.n)
        .slice(0, 8)
        .map((b) => {
          const toH = (v: number) => Math.round(v / b.n).toString(16).padStart(2, '0');
          return `#${toH(b.r)}${toH(b.g)}${toH(b.b)}`.toUpperCase();
        });
      setPhotoColors(top);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-purple-500/25 p-4 sm:p-5 space-y-4 text-xs">
      <div className="flex items-center gap-2.5">
        <Mini3DSceneBadge seed="color_matching_studio" color="#c084fc" size={38} />
        <div>
          <h3 className="text-sm sm:text-base font-bold text-white">
            🌈 Студия Подбора и Сочетания Цветов + Извлечение Палитры с Фото
          </h3>
          <p className="text-xs text-slate-400">
            Цветовой круг Иттена, правило 60–30–10 для одежды/UI и мгновенная выжимка доминирующих цветов из любой картинки
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-950 border border-white/10">
        <div>
          <div className="flex justify-between mb-1"><span>Тон (Hue)</span><span className="font-mono text-purple-300">{hue}°</span></div>
          <input type="range" min={0} max={359} value={hue} onChange={(e) => setHue(Number(e.target.value))} className="w-full accent-purple-400" />
        </div>
        <div>
          <div className="flex justify-between mb-1"><span>Насыщенность</span><span className="font-mono text-purple-300">{sat}%</span></div>
          <input type="range" min={10} max={100} value={sat} onChange={(e) => setSat(Number(e.target.value))} className="w-full accent-purple-400" />
        </div>
        <div>
          <div className="flex justify-between mb-1"><span>Светлота</span><span className="font-mono text-purple-300">{light}%</span></div>
          <input type="range" min={15} max={88} value={light} onChange={(e) => setLight(Number(e.target.value))} className="w-full accent-purple-400" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {harmonies.map((h) => (
          <div key={h.name} className="p-3.5 rounded-xl bg-slate-950 border border-white/10 space-y-2">
            <div className="font-bold text-slate-200">{h.name}</div>
            <div className="flex gap-2">
              {h.colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => copyText(c, onToast)}
                  className="flex-1 rounded-xl p-2 border border-white/15 flex flex-col items-center justify-end h-16 transition hover:scale-[1.02]"
                  style={{ backgroundColor: c }}
                >
                  <span className="px-1.5 py-0.5 rounded bg-slate-950/80 font-mono text-[10px] text-white">{c}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-xl bg-slate-950 border border-purple-400/30 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-bold text-white">📷 Извлечь готовую палитру из вашей фотографии:</div>
          <label className="px-3.5 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold cursor-pointer flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Выбрать фото
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e.target.files?.[0])} />
          </label>
        </div>
        {photoColors.length > 0 && (
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {photoColors.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => copyText(hex, onToast)}
                style={{ backgroundColor: hex }}
                className="h-16 rounded-xl border border-white/20 flex items-end justify-center p-1"
              >
                <span className="px-1 rounded bg-slate-950/85 font-mono text-[9px] text-white">{hex}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
