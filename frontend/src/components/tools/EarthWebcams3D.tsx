import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Compass,
  ExternalLink,
  Globe,
  MapPin,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Search,
  Video,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { apiGet } from '../../lib/api';
import {
  latLonToVec3,
  project3D,
  rotateEuler,
  syncHiDPICanvas,
  useViewportActive,
} from '../../lib/engine3d';
import { Mini3DSceneBadge } from '../three/Interactive3DScenes';

interface WebcamItem {
  id: string;
  title: string;
  city: string;
  country: string;
  flag: string;
  lat: number;
  lon: number;
  tz: string;
  category: string;
  youtube_embed: string;
  external_cam_url: string;
  earth_3d_url: string;
  desc: string;
}

// Accurate continental outlines [lat, lon] for crisp 3D filled landmass rendering
const CONTINENT_POLYGONS: { name: string; biome: string; pts: [number, number][] }[] = [
  {
    name: 'Eurasia',
    biome: '#1f7a54',
    pts: [
      [36, -9], [43, -9], [48, -4], [54, 8], [58, 10], [64, 14], [70, 26], [71, 55],
      [73, 85], [72, 125], [66, 170], [60, 163], [52, 142], [43, 132], [35, 129], [31, 121],
      [22, 114], [14, 108], [2, 103], [16, 96], [22, 88], [8, 77], [24, 67], [25, 56],
      [13, 45], [29, 34], [36, 36], [41, 29], [38, 23], [44, 12], [41, 15], [37, -2],
    ],
  },
  {
    name: 'Africa',
    biome: '#3a8f52',
    pts: [
      [37, 10], [32, 32], [12, 51], [-2, 41], [-15, 40], [-26, 33], [-34, 25], [-34, 18],
      [-22, 14], [-6, 12], [4, 9], [5, -4], [11, -16], [21, -17], [35, -6],
    ],
  },
  {
    name: 'NorthAmerica',
    biome: '#257d57',
    pts: [
      [70, -162], [71, -130], [62, -94], [60, -65], [47, -53], [44, -66], [39, -75],
      [25, -80], [29, -90], [26, -97], [19, -96], [15, -85], [9, -79], [16, -99],
      [23, -106], [32, -117], [40, -124], [55, -133], [60, -148], [62, -165],
    ],
  },
  {
    name: 'SouthAmerica',
    biome: '#208853',
    pts: [
      [11, -74], [8, -61], [0, -50], [-6, -35], [-16, -39], [-24, -46], [-35, -54],
      [-54, -68], [-50, -75], [-33, -72], [-18, -71], [-5, -81], [4, -77],
    ],
  },
  {
    name: 'Australia',
    biome: '#84743b',
    pts: [
      [-12, 131], [-12, 142], [-20, 149], [-28, 153], [-38, 146], [-35, 136],
      [-32, 124], [-34, 115], [-22, 114], [-15, 124],
    ],
  },
  {
    name: 'Greenland',
    biome: '#cbd5e1',
    pts: [
      [60, -44], [68, -32], [77, -19], [82, -35], [78, -68], [69, -53],
    ],
  },
  {
    name: 'Japan',
    biome: '#34d399',
    pts: [
      [31, 130], [35, 140], [41, 141], [44, 145], [39, 139], [34, 132],
    ],
  },
  {
    name: 'UK',
    biome: '#2d9364',
    pts: [
      [50, -5], [51, 1], [58, -3], [56, -6],
    ],
  },
  {
    name: 'Antarctica',
    biome: '#e2e8f0',
    pts: [
      [-68, -170], [-70, -110], [-65, -60], [-71, 0], [-68, 60], [-67, 120], [-72, 175],
    ],
  },
];

const FALLBACK_CAMS: WebcamItem[] = [
  {
    id: 'iss_nasa',
    title: 'МКС — Земля из космоса (NASA Live)',
    city: 'Орбита Земли (408 км)',
    country: 'Космос • МКС',
    flag: '🛰️',
    lat: 28.57,
    lon: -80.65,
    tz: 'UTC',
    category: 'Космос',
    youtube_embed: 'https://www.youtube-nocookie.com/embed/xRPjKQtRXR8?autoplay=1&mute=1',
    external_cam_url: 'https://www.youtube.com/results?search_query=NASA+ISS+Live+Earth+From+Space',
    earth_3d_url: 'https://earth.google.com/web/@28.5728,-80.6490,10a,12000000d,35y,0h,0t,0r',
    desc: 'Прямой эфир с бортовых камер Международной космической станции.',
  },
];

export const EarthWebcams3D: React.FC<{ initialSearch?: string }> = ({ initialSearch = '' }) => {
  const [cams, setCams] = useState<WebcamItem[]>(FALLBACK_CAMS);
  const [query, setQuery] = useState(initialSearch);
  const [selectedId, setSelectedId] = useState<string>('tokyo_shibuya');
  const [viewMode, setViewMode] = useState<'globe3d' | 'satellite'>('globe3d');
  const [streamActive, setStreamActive] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [localClock, setLocalClock] = useState('');

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const active = useViewportActive(wrapRef);

  const cam3dRef = useRef({
    rx: 0.42,
    ry: -2.4,
    targetRx: 0.55,
    targetRy: -2.43,
    zoom: 1.32,
    down: false,
    moved: false,
    lx: 0,
    ly: 0,
  });
  const hitMarkersRef = useRef<{ id: string; sx: number; sy: number; r: number; z: number }[]>([]);

  useEffect(() => {
    apiGet(`/api/v2/knowledge/webcams?q=${encodeURIComponent(query)}`)
      .then((res: any) => {
        if (res?.items?.length) {
          setCams(res.items);
          if (!res.items.some((i: WebcamItem) => i.id === selectedId)) {
            setSelectedId(res.items[0].id);
          }
        }
      })
      .catch(() => {});
  }, [query]);

  const selectedCam = useMemo(
    () => cams.find((c) => c.id === selectedId) || cams[0] || FALLBACK_CAMS[0],
    [cams, selectedId]
  );

  // Smooth Fly-To camera target whenever user selects a new webcam/city!
  useEffect(() => {
    if (!selectedCam) return;
    const latRad = (selectedCam.lat * Math.PI) / 180;
    const lonRad = (selectedCam.lon * Math.PI) / 180;
    cam3dRef.current.targetRx = Math.max(-1.22, Math.min(1.22, latRad * 0.92));
    cam3dRef.current.targetRy = -lonRad;
  }, [selectedCam]);

  // Live local time in selected webcam's timezone
  useEffect(() => {
    const updateClock = () => {
      try {
        const fmt = new Intl.DateTimeFormat('ru-RU', {
          timeZone: selectedCam.tz || 'UTC',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          day: '2-digit',
          month: 'short',
        });
        setLocalClock(fmt.format(new Date()));
      } catch {
        setLocalClock(new Date().toUTCString().slice(17, 25) + ' UTC');
      }
    };
    updateClock();
    const id = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(id);
  }, [selectedCam]);

  // 3D Google-Earth-style Globe Renderer (HiDPI)
  useEffect(() => {
    if (!active || viewMode !== 'globe3d') return;
    let raf = 0;
    let tick = 0;

    const stars = Array.from({ length: 70 }, (_, i) => ({
      x: ((i * 73) % 100) / 100,
      y: ((i * 41) % 100) / 100,
      r: 0.6 + (i % 3) * 0.45,
      a: 0.25 + (i % 5) * 0.12,
    }));

    const render = () => {
      const cvs = canvasRef.current;
      if (!cvs) return;
      const { ctx, W, H } = syncHiDPICanvas(cvs, 640, 340);
      if (!ctx) return;

      tick += 0.015;
      const st = cam3dRef.current;

      if (!st.down) {
        if (autoRotate) {
          st.ry += 0.0045;
          st.targetRy = st.ry;
        } else {
          // Smooth Fly-To interpolation (shortest angular path on longitude)
          let diffY = st.targetRy - st.ry;
          while (diffY > Math.PI) diffY -= Math.PI * 2;
          while (diffY < -Math.PI) diffY += Math.PI * 2;
          st.ry += diffY * 0.085;
          st.rx += (st.targetRx - st.rx) * 0.085;
        }
      }

      // Space backdrop
      const bg = ctx.createRadialGradient(W * 0.5, H * 0.5, 20, W * 0.5, H * 0.5, Math.max(W, H) * 0.7);
      bg.addColorStop(0, '#091428');
      bg.addColorStop(0.6, '#040914');
      bg.addColorStop(1, '#02040a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      for (const s of stars) {
        ctx.fillStyle = `rgba(226,232,240,${s.a})`;
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      const radius = 1.24 * st.zoom;
      const fov = 260;
      const camDist = 4.5;
      const centerP = project3D({ x: 0, y: 0, z: 0 }, W, H, fov, camDist);
      const screenRadius = (radius * fov) / camDist;

      // Rayleigh blue atmospheric glow halo (Google Earth signature look!)
      const atmo = ctx.createRadialGradient(
        centerP.sx,
        centerP.sy,
        screenRadius * 0.88,
        centerP.sx,
        centerP.sy,
        screenRadius * 1.22
      );
      atmo.addColorStop(0, 'rgba(56,189,248,0.45)');
      atmo.addColorStop(0.45, 'rgba(14,165,233,0.18)');
      atmo.addColorStop(1, 'rgba(2,6,23,0)');
      ctx.fillStyle = atmo;
      ctx.beginPath();
      ctx.arc(centerP.sx, centerP.sy, screenRadius * 1.22, 0, Math.PI * 2);
      ctx.fill();

      // Deep ocean sphere with specular sunlight reflection
      const ocean = ctx.createRadialGradient(
        centerP.sx - screenRadius * 0.32,
        centerP.sy - screenRadius * 0.32,
        screenRadius * 0.08,
        centerP.sx,
        centerP.sy,
        screenRadius
      );
      ocean.addColorStop(0, '#1d6fa5');
      ocean.addColorStop(0.45, '#0b3b66');
      ocean.addColorStop(0.85, '#06203d');
      ocean.addColorStop(1, '#041226');
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerP.sx, centerP.sy, screenRadius, 0, Math.PI * 2);
      ctx.fillStyle = ocean;
      ctx.fill();
      ctx.clip();

      // Latitude / Longitude graticule grid
      ctx.strokeStyle = 'rgba(125,211,252,0.13)';
      ctx.lineWidth = 0.85;
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        let started = false;
        for (let lon = -180; lon <= 180; lon += 8) {
          const wp = rotateEuler(latLonToVec3(lat, lon, radius), st.rx, st.ry);
          if (wp.z < -0.05) {
            started = false;
            continue;
          }
          const pp = project3D(wp, W, H, fov, camDist);
          if (!started) {
            ctx.moveTo(pp.sx, pp.sy);
            started = true;
          } else {
            ctx.lineTo(pp.sx, pp.sy);
          }
        }
        ctx.stroke();
      }
      for (let lon = -180; lon < 180; lon += 30) {
        ctx.beginPath();
        let started = false;
        for (let lat = -80; lat <= 80; lat += 8) {
          const wp = rotateEuler(latLonToVec3(lat, lon, radius), st.rx, st.ry);
          if (wp.z < -0.05) {
            started = false;
            continue;
          }
          const pp = project3D(wp, W, H, fov, camDist);
          if (!started) {
            ctx.moveTo(pp.sx, pp.sy);
            started = true;
          } else {
            ctx.lineTo(pp.sx, pp.sy);
          }
        }
        ctx.stroke();
      }

      // Continents with biome fill & coastal shoreline highlight
      for (const cont of CONTINENT_POLYGONS) {
        const wPts = cont.pts.map(([la, lo]) => rotateEuler(latLonToVec3(la, lo, radius * 1.003), st.rx, st.ry));
        const visCount = wPts.filter((p) => p.z > -0.15).length;
        if (visCount < 3) continue;

        ctx.beginPath();
        let pen = false;
        for (const wp of wPts) {
          const clamped = wp.z < -0.08 ? { ...wp, z: -0.08 } : wp;
          const pp = project3D(clamped, W, H, fov, camDist);
          if (!pen) {
            ctx.moveTo(pp.sx, pp.sy);
            pen = true;
          } else {
            ctx.lineTo(pp.sx, pp.sy);
          }
        }
        ctx.closePath();
        ctx.fillStyle = cont.biome;
        ctx.fill();
        ctx.strokeStyle = 'rgba(167,243,208,0.48)';
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }

      // Subtle atmospheric cloud wisps
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2.4;
      for (let band = 0; band < 5; band++) {
        const cLat = -40 + band * 22;
        const cLonStart = ((band * 67 + tick * 6) % 360) - 180;
        ctx.beginPath();
        let pen = false;
        for (let step = 0; step < 12; step++) {
          const wp = rotateEuler(
            latLonToVec3(cLat + Math.sin(step + band) * 4, cLonStart + step * 5, radius * 1.02),
            st.rx,
            st.ry
          );
          if (wp.z <= 0.1) continue;
          const pp = project3D(wp, W, H, fov, camDist);
          if (!pen) {
            ctx.moveTo(pp.sx, pp.sy);
            pen = true;
          } else {
            ctx.lineTo(pp.sx, pp.sy);
          }
        }
        ctx.stroke();
      }

      // Day/Night terminator shading on eastern limb
      const nightGrad = ctx.createLinearGradient(
        centerP.sx - screenRadius,
        centerP.sy - screenRadius * 0.4,
        centerP.sx + screenRadius,
        centerP.sy + screenRadius * 0.5
      );
      nightGrad.addColorStop(0, 'rgba(255,255,255,0.06)');
      nightGrad.addColorStop(0.62, 'rgba(2,6,23,0)');
      nightGrad.addColorStop(1, 'rgba(2,6,23,0.62)');
      ctx.fillStyle = nightGrad;
      ctx.fillRect(centerP.sx - screenRadius, centerP.sy - screenRadius, screenRadius * 2, screenRadius * 2);

      ctx.restore();

      // Outer crisp planet rim
      ctx.beginPath();
      ctx.arc(centerP.sx, centerP.sy, screenRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(125,211,252,0.55)';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Interactive Public Live Webcam Pins on 3D Globe
      const hits: { id: string; sx: number; sy: number; r: number; z: number }[] = [];
      const sortedCams = cams
        .map((cam) => {
          const alt = cam.id === 'iss_nasa' ? radius * 1.14 : radius * 1.018;
          const wp = rotateEuler(latLonToVec3(cam.lat, cam.lon, alt), st.rx, st.ry);
          const pp = project3D(wp, W, H, fov, camDist);
          return { cam, wp, pp };
        })
        .sort((a, b) => a.wp.z - b.wp.z);

      for (const item of sortedCams) {
        if (item.wp.z < 0.04 || !item.pp.visible) continue;
        const isSel = item.cam.id === selectedCam.id;
        const pulseR = isSel ? 8 + Math.sin(tick * 4) * 3 : 5;

        if (isSel) {
          ctx.beginPath();
          ctx.arc(item.pp.sx, item.pp.sy, pulseR + 5, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(250,204,21,0.75)';
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(item.pp.sx, item.pp.sy, isSel ? 6 : 4.2, 0, Math.PI * 2);
        ctx.fillStyle = isSel ? '#facc15' : '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // Crisp City Label
        if (isSel || st.zoom >= 1.2) {
          ctx.font = isSel ? '700 11px "Rubik", sans-serif' : '500 10px "Rubik", sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          const text = `${item.cam.flag} ${item.cam.city}`;
          const tw = ctx.measureText(text).width;
          ctx.fillStyle = isSel ? 'rgba(15,23,42,0.92)' : 'rgba(15,23,42,0.72)';
          ctx.fillRect(item.pp.sx + 8, item.pp.sy - 8, tw + 8, 16);
          ctx.fillStyle = isSel ? '#fde047' : '#e2e8f0';
          ctx.fillText(text, item.pp.sx + 12, item.pp.sy);
        }

        hits.push({ id: item.cam.id, sx: item.pp.sx, sy: item.pp.sy, r: 16, z: item.wp.z });
      }
      hitMarkersRef.current = hits;

      // HUD telemetry overlay (Google Earth style bottom-left coords)
      ctx.font = '600 10.5px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(148,163,184,0.9)';
      ctx.textAlign = 'left';
      ctx.fillText(
        `LAT ${selectedCam.lat.toFixed(4)}°  LON ${selectedCam.lon.toFixed(4)}°  •  ZOOM ${st.zoom.toFixed(2)}x`,
        12,
        H - 10
      );

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [active, viewMode, cams, selectedCam, autoRotate]);

  const handleGlobeTap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const wasTap = !cam3dRef.current.moved;
    cam3dRef.current.down = false;
    if (!wasTap || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const hit = hitMarkersRef.current
      .filter((m) => Math.hypot(cx - m.sx, cy - m.sy) <= m.r)
      .sort((a, b) => b.z - a.z)[0];
    if (hit) {
      setSelectedId(hit.id);
    }
  };

  // Satellite 1:1 bbox around selected webcam coordinates
  const osmEmbedUrl = useMemo(() => {
    const d = 0.012;
    const bbox = `${selectedCam.lon - d},${selectedCam.lat - d},${selectedCam.lon + d},${selectedCam.lat + d}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${selectedCam.lat},${selectedCam.lon}`;
  }, [selectedCam]);

  return (
    <div ref={wrapRef} className="space-y-4">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-2xl bg-slate-900/80 border border-sky-500/25">
        <div className="flex items-center gap-2.5">
          <Mini3DSceneBadge seed="earth_3d_cams" color="#0ea5e9" size={38} />
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
              🌍 3D Планета Земля и Публичные Веб-камеры
            </h3>
            <p className="text-[11px] text-slate-400">
              Перелёт Fly-To по координатам, спутниковая карта и прямые трансляции со всего мира
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewMode('globe3d')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
              viewMode === 'globe3d'
                ? 'bg-sky-500/25 border-sky-400/60 text-sky-100'
                : 'bg-slate-950/70 border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" /> 3D Глобус Земли
          </button>
          <button
            type="button"
            onClick={() => setViewMode('satellite')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
              viewMode === 'satellite'
                ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-100'
                : 'bg-slate-950/70 border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" /> Карта улиц 1:1
          </button>
          <a
            href={selectedCam.earth_3d_url}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-indigo-600/25 hover:bg-indigo-600/40 border border-indigo-400/40 text-indigo-200 transition"
          >
            <Maximize2 className="w-3.5 h-3.5" /> Google Earth 3D
          </a>
        </div>
      </div>

      {/* Main Split: 3D Globe / Map on Left + Selected Public Live Webcam on Right */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-7 rounded-2xl bg-slate-950/90 border border-white/10 p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск камеры, страны или города (Токио, МКС, Венеция, Намибия)..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-sky-400"
              />
            </div>
            {viewMode === 'globe3d' && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    cam3dRef.current.zoom = Math.min(2.8, cam3dRef.current.zoom + 0.25);
                  }}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200"
                  title="Приблизить Землю"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    cam3dRef.current.zoom = Math.max(0.85, cam3dRef.current.zoom - 0.25);
                  }}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200"
                  title="Отдалить Землю"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setAutoRotate((r) => !r)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200"
                  title="Суточное вращение"
                >
                  {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    cam3dRef.current.zoom = 1.32;
                    setAutoRotate(false);
                  }}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200"
                  title="Сбросить ракурс"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {viewMode === 'globe3d' ? (
            <canvas
              ref={canvasRef}
              style={{ height: 330 }}
              onWheel={(e) => {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.14 : -0.14;
                cam3dRef.current.zoom = Math.max(0.85, Math.min(2.9, cam3dRef.current.zoom + delta));
              }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId);
                cam3dRef.current.down = true;
                cam3dRef.current.moved = false;
                cam3dRef.current.lx = e.clientX;
                cam3dRef.current.ly = e.clientY;
              }}
              onPointerMove={(e) => {
                if (!cam3dRef.current.down) return;
                const dx = e.clientX - cam3dRef.current.lx;
                const dy = e.clientY - cam3dRef.current.ly;
                if (Math.abs(dx) + Math.abs(dy) > 4) cam3dRef.current.moved = true;
                cam3dRef.current.lx = e.clientX;
                cam3dRef.current.ly = e.clientY;
                cam3dRef.current.ry += dx * 0.0085;
                cam3dRef.current.targetRy = cam3dRef.current.ry;
                cam3dRef.current.rx = Math.max(-1.25, Math.min(1.25, cam3dRef.current.rx + dy * 0.0085));
                cam3dRef.current.targetRx = cam3dRef.current.rx;
              }}
              onPointerUp={handleGlobeTap}
              onPointerCancel={() => {
                cam3dRef.current.down = false;
              }}
              className="w-full rounded-xl bg-[#030712] border border-sky-500/20 cursor-grab active:cursor-grabbing touch-none block"
            />
          ) : (
            <div className="rounded-xl overflow-hidden border border-emerald-500/30 bg-slate-900" style={{ height: 330 }}>
              <iframe
                title={selectedCam.title}
                src={osmEmbedUrl}
                className="w-full h-full border-0"
                loading="lazy"
              />
            </div>
          )}

          {/* Quick Horizontal Camera Switcher */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1">
            {cams.map((c) => {
              const activeCam = c.id === selectedCam.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(c.id);
                    setAutoRotate(false);
                  }}
                  className={`p-2 rounded-xl border text-left transition ${
                    activeCam
                      ? 'bg-sky-500/20 border-sky-400 text-white shadow-sm'
                      : 'bg-slate-900/80 border-white/5 text-slate-300 hover:border-white/20'
                  }`}
                >
                  <div className="text-xs font-bold truncate">
                    {c.flag} {c.city}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">{c.category}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Live Public Webcam Player & Telemetry */}
        <div className="xl:col-span-5 rounded-2xl bg-slate-950/90 border border-amber-500/25 p-3.5 flex flex-col justify-between space-y-3">
          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" /> ПУБЛИЧНАЯ КАМЕРА • LIVE
                </span>
                <h4 className="text-sm sm:text-base font-bold text-white mt-1.5">
                  {selectedCam.flag} {selectedCam.title}
                </h4>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] text-slate-400">Местное время</div>
                <div className="text-xs font-mono font-bold text-amber-300">{localClock}</div>
              </div>
            </div>

            {/* Live Video Embed or Instant Launch Preview */}
            <div className="rounded-xl overflow-hidden border border-white/10 bg-slate-900 relative" style={{ height: 225 }}>
              {streamActive ? (
                <iframe
                  key={selectedCam.id}
                  src={selectedCam.youtube_embed}
                  title={selectedCam.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-slate-900 via-sky-950/40 to-slate-950">
                  <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center mb-2.5 text-sky-300">
                    <Video className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-bold text-white mb-1">{selectedCam.city} — {selectedCam.country}</div>
                  <p className="text-[11px] text-slate-400 max-w-xs mb-3 line-clamp-2">{selectedCam.desc}</p>
                  <button
                    type="button"
                    onClick={() => setStreamActive(true)}
                    className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-sky-500/20"
                  >
                    <Camera className="w-4 h-4" /> Включить прямой эфир камеры
                  </button>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">{selectedCam.desc}</p>
          </div>

          <div className="space-y-2 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-sky-400" />
                {selectedCam.lat.toFixed(4)}°, {selectedCam.lon.toFixed(4)}°
              </span>
              <span>TZ: {selectedCam.tz}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <a
                href={selectedCam.external_cam_url}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition"
              >
                <ExternalLink className="w-3.5 h-3.5 text-amber-300" /> Источник камеры
              </a>
              <a
                href={selectedCam.earth_3d_url}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-xs font-semibold text-sky-200 flex items-center justify-center gap-1.5 transition"
              >
                <Globe className="w-3.5 h-3.5" /> В Google Earth 3D
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
