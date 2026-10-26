import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import {
  Mesh3D,
  TESSERACT_EDGES,
  Vec3,
  createBox,
  createCube,
  createCylinder,
  createDodecahedron,
  createIcosahedron,
  createOctahedron,
  createTetrahedron,
  createTorus,
  cross3,
  generateLorenzPoints,
  hexToRgb,
  latLonToVec3,
  project3D,
  projectTesseract4DTo3D,
  rotX,
  rotY,
  rotateEuler,
  scale3,
  shadeBlinnPhong,
  sub3,
  syncHiDPICanvas,
  useViewportActive,
  v3,
} from '../../lib/engine3d';
import { ToolCategory } from '../../lib/api';

// Shared helper to render a solid shaded 3D mesh with Painter's Z-sorting
function drawShadedMesh(
  ctx: CanvasRenderingContext2D,
  mesh: Mesh3D,
  rx: number,
  ry: number,
  rz: number,
  w: number,
  h: number,
  fov: number,
  camDist: number,
  hexColor: string,
  faceAlpha = 0.78,
  wireStroke = 'rgba(255,255,255,0.38)'
) {
  const rgb = hexToRgb(hexColor);
  const transformed = mesh.vertices.map((vt) => rotateEuler(vt, rx, ry, rz));
  const projected = transformed.map((vt) => project3D(vt, w, h, fov, camDist));

  const faceOrder = mesh.faces
    .map((f, idx) => {
      let cx = 0;
      let cy = 0;
      let cz = 0;
      for (const vi of f) {
        cx += transformed[vi].x;
        cy += transformed[vi].y;
        cz += transformed[vi].z;
      }
      const inv = 1 / f.length;
      const center = { x: cx * inv, y: cy * inv, z: cz * inv };
      const e1 = sub3(transformed[f[1]], transformed[f[0]]);
      const e2 = sub3(transformed[f[2]], transformed[f[0]]);
      let normal = cross3(e1, e2);
      // Ensure outward normal for convex/torus-like shapes
      if (
        normal.x * center.x + normal.y * center.y + normal.z * center.z < 0 &&
        mesh.faces.length <= 24
      ) {
        normal = scale3(normal, -1);
      }
      return { idx, f, center, normal, depth: center.z };
    })
    .sort((a, b) => a.depth - b.depth);

  for (const item of faceOrder) {
    const pts = item.f.map((vi) => projected[vi]);
    if (pts.some((p) => !p.visible)) continue;

    ctx.beginPath();
    ctx.moveTo(pts[0].sx, pts[0].sy);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].sx, pts[i].sy);
    }
    ctx.closePath();
    ctx.fillStyle = shadeBlinnPhong(item.normal, item.center, rgb, undefined, faceAlpha);
    ctx.fill();
    ctx.strokeStyle = wireStroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// ============================================================================
// 1. STUDIO NAVIGATION 3D / 4D CORE POLYHEDRON + ORBITAL CATEGORY NODES
// ============================================================================
interface Core3DProps {
  categories: ToolCategory[];
  activeCategory: string;
  onSelectCategory: (catId: string) => void;
  compact?: boolean;
}

export const CorePolyhedron3D: React.FC<Core3DProps> = ({
  categories,
  activeCategory,
  onSelectCategory,
  compact = false,
}) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const active = useViewportActive(wrapRef);

  const [geoMode, setGeoMode] = useState<'tesseract' | 'gyro' | 'icosa' | 'torus'>('tesseract');
  const [autoSpin, setAutoSpin] = useState(true);

  const rotRef = useRef({ rx: 0.32, ry: 0.58, vx: 0, vy: 0.0018, t4d: 0 });
  const dragRef = useRef({ down: false, x: 0, y: 0, moved: false, hovered: false });
  const hitNodesRef = useRef<{ id: string; sx: number; sy: number; r: number; z: number }[]>([]);

  const meshes = useMemo(
    () => ({
      icosa: createIcosahedron(0.96),
      dodeca: createDodecahedron(1.06),
      octa: createOctahedron(0.66),
      torus: createTorus(0.8, 0.27, 24, 12),
    }),
    []
  );

  const starField = useMemo(
    () =>
      Array.from({ length: 38 }, (_, i) => {
        const phi = i * 2.39996;
        const r = 1.9 + (i % 7) * 0.22;
        return {
          x: Math.cos(phi) * r,
          y: (((i * 37) % 100) / 50 - 1) * 1.45,
          z: Math.sin(phi) * r,
          s: 0.8 + (i % 3) * 0.45,
        };
      }),
    []
  );

  const activeCatObj = categories.find((c) => c.id === activeCategory) || categories[0];
  const accentColor = activeCatObj?.color || '#6366f1';

  useEffect(() => {
    if (!active) return;
    let raf = 0;

    const render = () => {
      const cvs = canvasRef.current;
      if (!cvs) return;
      const { ctx, W, H } = syncHiDPICanvas(cvs, compact ? 320 : 284, compact ? 186 : 210);
      if (!ctx) return;

      const st = rotRef.current;

      if (!dragRef.current.down) {
        if (autoSpin) {
          const speedMult = dragRef.current.hovered ? 0.14 : 1.0;
          st.ry += 0.00115 * speedMult;
          st.t4d += 0.0028 * speedMult;
        }
        st.rx += st.vx;
        st.ry += st.vy;
        st.vx *= 0.9;
        st.vy *= 0.9;
        st.rx = Math.max(-1.35, Math.min(1.35, st.rx));
      } else {
        st.t4d += 0.002;
      }

      ctx.clearRect(0, 0, W, H);

      const [cr, cg, cb] = hexToRgb(accentColor);
      const pulse = 0.5 + 0.5 * Math.sin(st.t4d * 2.2);

      // Deep volumetric nebula core glow
      const grad = ctx.createRadialGradient(W * 0.5, H * 0.5, 4, W * 0.5, H * 0.5, W * 0.52);
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},${0.32 + pulse * 0.08})`);
      grad.addColorStop(0.45, 'rgba(30,41,82,0.18)');
      grad.addColorStop(1, 'rgba(5,8,18,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      const fov = compact ? 228 : 252;
      const camDist = 4.35;

      // 3D Starfield parallax layer
      for (const star of starField) {
        const sp = rotateEuler(star, st.rx * 0.45, st.ry * 0.45);
        const pp = project3D(sp, W, H, fov, camDist + 0.8);
        if (!pp.visible) continue;
        const alpha = Math.max(0.12, Math.min(0.65, (sp.z + 2.5) / 5));
        ctx.fillStyle = `rgba(226,232,240,${alpha})`;
        ctx.beginPath();
        ctx.arc(pp.sx, pp.sy, star.s, 0, Math.PI * 2);
        ctx.fill();
      }

      // Dual inclined orbital rings
      for (let ringIdx = 0; ringIdx < 2; ringIdx++) {
        ctx.beginPath();
        const tilt = ringIdx === 0 ? 0.34 : -0.42;
        const rad = ringIdx === 0 ? 1.72 : 1.44;
        for (let i = 0; i <= 72; i++) {
          const ang = (i / 72) * Math.PI * 2;
          const rp = rotateEuler(
            { x: Math.cos(ang) * rad, y: Math.sin(ang) * tilt, z: Math.sin(ang) * rad },
            st.rx,
            st.ry + ringIdx * 0.6
          );
          const pp = project3D(rp, W, H, fov, camDist);
          if (i === 0) ctx.moveTo(pp.sx, pp.sy);
          else ctx.lineTo(pp.sx, pp.sy);
        }
        ctx.strokeStyle =
          ringIdx === 0 ? `rgba(${cr},${cg},${cb},0.28)` : 'rgba(56,189,248,0.16)';
        ctx.lineWidth = ringIdx === 0 ? 1.15 : 0.9;
        ctx.stroke();
      }

      // Central 3D / 4D Reactor Geometry
      if (geoMode === 'tesseract') {
        // Outer translucent dodecahedral containment cage
        const cageProj = meshes.dodeca.vertices
          .map((p) => rotateEuler(p, st.rx * 0.7, -st.ry * 0.6, st.t4d * 0.2))
          .map((p) => project3D(p, W, H, fov, camDist));
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.16)`;
        ctx.lineWidth = 0.8;
        for (const [a, b] of meshes.dodeca.edges) {
          if (!cageProj[a].visible || !cageProj[b].visible) continue;
          ctx.beginPath();
          ctx.moveTo(cageProj[a].sx, cageProj[a].sy);
          ctx.lineTo(cageProj[b].sx, cageProj[b].sy);
          ctx.stroke();
        }

        const verts3d = projectTesseract4DTo3D(st.t4d, st.t4d * 0.72, st.t4d * 0.48, 0.62).map((p) =>
          rotateEuler(p, st.rx, st.ry)
        );
        const proj = verts3d.map((p) => project3D(p, W, H, fov, camDist));

        for (const [a, b] of TESSERACT_EDGES) {
          const pa = proj[a];
          const pb = proj[b];
          if (!pa.visible || !pb.visible) continue;
          const isInner = (a & 8) === 0 && (b & 8) === 0;
          ctx.beginPath();
          ctx.moveTo(pa.sx, pa.sy);
          ctx.lineTo(pb.sx, pb.sy);
          ctx.strokeStyle = isInner
            ? 'rgba(56,189,248,0.92)'
            : `rgba(${cr},${cg},${cb},0.72)`;
          ctx.lineWidth = isInner ? 1.55 : 1.15;
          ctx.stroke();
        }
        proj.forEach((p, idx) => {
          if (!p.visible) return;
          ctx.fillStyle = idx & 8 ? '#f8fafc' : '#38bdf8';
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, Math.max(1.8, p.scale * 0.03), 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (geoMode === 'gyro') {
        // 3-Axis Astrolabe Gyroscope + Octahedron Singularity Core
        drawShadedMesh(ctx, meshes.octa, -st.rx, st.ry * 1.4, st.t4d * 0.8, W, H, fov, camDist, accentColor, 0.85);
        const gyroSpecs = [
          { r: 0.92, ax: st.t4d * 1.3, ay: st.ry, az: 0.2, col: `rgba(${cr},${cg},${cb},0.85)` },
          { r: 1.12, ax: st.rx + 1.1, ay: -st.t4d * 1.05, az: 0.7, col: 'rgba(56,189,248,0.8)' },
          { r: 1.28, ax: 0.5, ay: st.ry * 0.8, az: st.t4d * 0.9, col: 'rgba(244,114,182,0.72)' },
        ];
        gyroSpecs.forEach((g, gi) => {
          ctx.beginPath();
          for (let i = 0; i <= 60; i++) {
            const a = (i / 60) * Math.PI * 2;
            const gp = rotateEuler({ x: Math.cos(a) * g.r, y: Math.sin(a) * g.r, z: 0 }, g.ax, g.ay, g.az);
            const pp = project3D(gp, W, H, fov, camDist);
            if (i === 0) ctx.moveTo(pp.sx, pp.sy);
            else ctx.lineTo(pp.sx, pp.sy);
          }
          ctx.strokeStyle = g.col;
          ctx.lineWidth = 1.65;
          ctx.stroke();

          // Photon bead racing on gyroscope ring
          const beadAngle = st.t4d * (2.2 + gi * 0.6);
          const bp = rotateEuler(
            { x: Math.cos(beadAngle) * g.r, y: Math.sin(beadAngle) * g.r, z: 0 },
            g.ax,
            g.ay,
            g.az
          );
          const bProj = project3D(bp, W, H, fov, camDist);
          if (bProj.visible) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(bProj.sx, bProj.sy, 2.8, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      } else if (geoMode === 'icosa') {
        drawShadedMesh(ctx, meshes.icosa, st.rx, st.ry, st.t4d * 0.35, W, H, fov, camDist, accentColor, 0.82);
      } else {
        drawShadedMesh(ctx, meshes.torus, st.rx + 0.52, st.ry, st.t4d * 0.45, W, H, fov, camDist, accentColor, 0.78);
      }

      // Interactive Orbital Category Satellites (all 15 categories)
      const hits: { id: string; sx: number; sy: number; r: number; z: number }[] = [];
      const count = categories.length;
      const satList = categories
        .map((cat, idx) => {
          const phi = (idx / Math.max(1, count)) * Math.PI * 2;
          const yWave = Math.sin(phi * 2 + st.t4d * 0.55) * 0.54;
          const base = {
            x: Math.cos(phi) * 1.72,
            y: yWave,
            z: Math.sin(phi) * 1.72,
          };
          const wp = rotateEuler(base, st.rx, st.ry);
          const pp = project3D(wp, W, H, fov, camDist);
          return { cat, wp, pp };
        })
        .sort((a, b) => a.wp.z - b.wp.z);

      for (const s of satList) {
        if (!s.pp.visible) continue;
        const isCurrent = s.cat.id === activeCategory;
        const nodeR = Math.max(9.5, s.pp.scale * (isCurrent ? 0.195 : 0.142));
        const [nr, ng, nb] = hexToRgb(s.cat.color || '#38bdf8');

        if (isCurrent) {
          // Curved plasma arc from core to active satellite
          ctx.beginPath();
          ctx.moveTo(W * 0.5, H * 0.5);
          ctx.quadraticCurveTo(
            (W * 0.5 + s.pp.sx) * 0.5,
            (H * 0.5 + s.pp.sy) * 0.5 - 14,
            s.pp.sx,
            s.pp.sy
          );
          ctx.strokeStyle = `rgba(${nr},${ng},${nb},0.72)`;
          ctx.lineWidth = 1.8;
          ctx.stroke();

          // Outer Saturn halo on active category
          ctx.beginPath();
          ctx.arc(s.pp.sx, s.pp.sy, nodeR + 3.5 + pulse * 1.8, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${nr},${ng},${nb},0.48)`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        // 3D sphere shading on node
        const sphereGrad = ctx.createRadialGradient(
          s.pp.sx - nodeR * 0.3,
          s.pp.sy - nodeR * 0.3,
          nodeR * 0.12,
          s.pp.sx,
          s.pp.sy,
          nodeR
        );
        if (isCurrent) {
          sphereGrad.addColorStop(0, '#ffffff');
          sphereGrad.addColorStop(0.35, `rgba(${nr},${ng},${nb},0.98)`);
          sphereGrad.addColorStop(1, `rgba(${Math.round(nr * 0.45)},${Math.round(ng * 0.45)},${Math.round(nb * 0.45)},0.96)`);
        } else {
          const depthAlpha = s.wp.z > 0 ? 0.92 : 0.64;
          sphereGrad.addColorStop(0, `rgba(${nr},${ng},${nb},${depthAlpha * 0.45})`);
          sphereGrad.addColorStop(1, `rgba(10,15,30,${depthAlpha})`);
        }

        ctx.beginPath();
        ctx.arc(s.pp.sx, s.pp.sy, nodeR, 0, Math.PI * 2);
        ctx.fillStyle = sphereGrad;
        ctx.fill();
        ctx.lineWidth = isCurrent ? 1.8 : 1;
        ctx.strokeStyle = isCurrent ? '#ffffff' : `rgba(${nr},${ng},${nb},0.65)`;
        ctx.stroke();

        ctx.font = `${Math.round(nodeR * 0.92)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.cat.emoji, s.pp.sx, s.pp.sy + 0.5);

        hits.push({ id: s.cat.id, sx: s.pp.sx, sy: s.pp.sy, r: nodeR + 10, z: s.wp.z });
      }
      hitNodesRef.current = hits;

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [active, autoSpin, geoMode, categories, activeCategory, accentColor, compact, meshes, starField]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { ...dragRef.current, down: true, x: e.clientX, y: e.clientY, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.down) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) dragRef.current.moved = true;
    dragRef.current.x = e.clientX;
    dragRef.current.y = e.clientY;
    rotRef.current.ry += dx * 0.0085;
    rotRef.current.rx = Math.max(-1.35, Math.min(1.35, rotRef.current.rx + dy * 0.0085));
    rotRef.current.vy = dx * 0.0012;
    rotRef.current.vx = dy * 0.0012;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const wasTap = !dragRef.current.moved;
    dragRef.current.down = false;
    if (!wasTap || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    // Pick front-most hit satellite
    const candidates = hitNodesRef.current
      .filter((n) => Math.hypot(cx - n.sx, cy - n.sy) <= n.r)
      .sort((a, b) => b.z - a.z);
    if (candidates[0]) {
      onSelectCategory(candidates[0].id);
    }
  };

  return (
    <div
      ref={wrapRef}
      className="rounded-2xl bg-slate-950/90 border border-indigo-500/25 p-2.5 space-y-2 select-none shadow-[0_12px_34px_rgba(2,6,23,0.65)]"
    >
      <div className="flex items-center justify-between gap-1 px-0.5">
        <div className="flex items-center gap-1 flex-wrap">
          {(
            [
              { id: 'tesseract', label: '4D Куб' },
              { id: 'gyro', label: 'Гироскоп' },
              { id: 'icosa', label: 'Кристалл' },
              { id: 'torus', label: 'Тор' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setGeoMode(m.id)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition ${
                geoMode === m.id
                  ? 'bg-indigo-500/30 border-indigo-400/60 text-indigo-100 shadow-sm'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setAutoSpin((s) => !s)}
          className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 shrink-0"
          title={autoSpin ? 'Пауза вращения' : 'Авто-вращение'}
        >
          {autoSpin ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
        </button>
      </div>

      <canvas
        ref={canvasRef}
        style={{ height: compact ? 184 : 208 }}
        onPointerEnter={() => {
          dragRef.current.hovered = true;
        }}
        onPointerLeave={() => {
          dragRef.current.hovered = false;
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          dragRef.current.down = false;
          dragRef.current.hovered = false;
        }}
        className="w-full rounded-xl bg-[#050813] cursor-grab active:cursor-grabbing touch-none block border border-white/[0.05]"
      />

      <div className="flex items-center justify-between px-1 text-[10px] text-slate-400">
        <span className="truncate">{activeCatObj ? `${activeCatObj.emoji} ${activeCatObj.title}` : 'Вращайте 3D-ядро'}</span>
        {activeCatObj && (
          <span className="text-indigo-300 font-mono font-semibold shrink-0 ml-1">
            {activeCatObj.tools.length} инстр.
          </span>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 2. ZODIAC 3D ARMILLARY CELESTIAL SPHERE (ECLIPTIC + SYNASTRY ARC)
// ============================================================================
const ZODIAC_ORDER = [
  { id: 'aries', symbol: '♈', name: 'Овен', elem: 'fire' },
  { id: 'taurus', symbol: '♉', name: 'Телец', elem: 'earth' },
  { id: 'gemini', symbol: '♊', name: 'Близнецы', elem: 'air' },
  { id: 'cancer', symbol: '♋', name: 'Рак', elem: 'water' },
  { id: 'leo', symbol: '♌', name: 'Лев', elem: 'fire' },
  { id: 'virgo', symbol: '♍', name: 'Дева', elem: 'earth' },
  { id: 'libra', symbol: '♎', name: 'Весы', elem: 'air' },
  { id: 'scorpio', symbol: '♏', name: 'Скорпион', elem: 'water' },
  { id: 'sagittarius', symbol: '♐', name: 'Стрелец', elem: 'fire' },
  { id: 'capricorn', symbol: '♑', name: 'Козерог', elem: 'earth' },
  { id: 'aquarius', symbol: '♒', name: 'Водолей', elem: 'air' },
  { id: 'pisces', symbol: '♓', name: 'Рыбы', elem: 'water' },
];

const ELEM_COLORS: Record<string, string> = {
  fire: '#fb923c',
  earth: '#34d399',
  air: '#38bdf8',
  water: '#a855f7',
};

interface Zodiac3DProps {
  selectedSign: string;
  secondSign?: string;
  compatPct?: number;
  onSelectSign: (signId: string) => void;
}

export const ZodiacCelestial3D: React.FC<Zodiac3DProps> = ({
  selectedSign,
  secondSign,
  compatPct,
  onSelectSign,
}) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const active = useViewportActive(wrapRef);

  const camRef = useRef({ rx: 0.34, ry: 0, targetRy: 0, dragging: false, lx: 0, ly: 0, moved: false });
  const hitSignsRef = useRef<{ id: string; sx: number; sy: number; r: number; z: number }[]>([]);

  const stars = useMemo(
    () =>
      Array.from({ length: 65 }, (_, i) => {
        const u = ((i * 73) % 100) / 100;
        const v = ((i * 41) % 100) / 100;
        const theta = u * Math.PI * 2;
        const phi = Math.acos(2 * v - 1);
        return {
          x: 2.35 * Math.sin(phi) * Math.cos(theta),
          y: 2.35 * Math.cos(phi),
          z: 2.35 * Math.sin(phi) * Math.sin(theta),
          size: (i % 3) * 0.5 + 0.8,
        };
      }),
    []
  );

  // Smoothly orient camera toward selected sign
  useEffect(() => {
    const idx = ZODIAC_ORDER.findIndex((z) => z.id === selectedSign);
    if (idx >= 0) {
      const lon = (idx / 12) * Math.PI * 2;
      camRef.current.targetRy = -lon + Math.PI * 0.5;
    }
  }, [selectedSign]);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let pulse = 0;

    const tilt = (23.4 * Math.PI) / 180;

    const render = () => {
      const cvs = canvasRef.current;
      if (!cvs) return;
      const { ctx, W, H } = syncHiDPICanvas(cvs, 560, 235);
      if (!ctx) return;
      pulse += 0.035;

      const cam = camRef.current;
      if (!cam.dragging) {
        let diff = cam.targetRy - cam.ry;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        cam.ry += diff * 0.06 + 0.0018;
        cam.targetRy += 0.0018;
      }

      ctx.fillStyle = '#070b16';
      ctx.fillRect(0, 0, W, H);

      const fov = 265;
      const camDist = 4.4;

      // Deep starfield
      for (const st of stars) {
        const rp = rotateEuler(st, cam.rx * 0.5, cam.ry * 0.4);
        const pp = project3D(rp, W, H, fov, camDist);
        if (!pp.visible) continue;
        ctx.fillStyle = 'rgba(226,232,240,0.42)';
        ctx.fillRect(pp.sx, pp.sy, st.size, st.size);
      }

      // Celestial meridians & equator
      const drawRing = (transformPt: (ang: number) => Vec3, stroke: string, width = 1) => {
        ctx.beginPath();
        for (let i = 0; i <= 64; i++) {
          const ang = (i / 64) * Math.PI * 2;
          const p = rotateEuler(transformPt(ang), cam.rx, cam.ry);
          const pp = project3D(p, W, H, fov, camDist);
          if (i === 0) ctx.moveTo(pp.sx, pp.sy);
          else ctx.lineTo(pp.sx, pp.sy);
        }
        ctx.strokeStyle = stroke;
        ctx.lineWidth = width;
        ctx.stroke();
      };

      drawRing((a) => ({ x: Math.cos(a) * 1.58, y: 0, z: Math.sin(a) * 1.58 }), 'rgba(148,163,184,0.16)');
      drawRing((a) => ({ x: 0, y: Math.sin(a) * 1.58, z: Math.cos(a) * 1.58 }), 'rgba(148,163,184,0.12)');
      drawRing(
        (a) => rotX({ x: Math.cos(a) * 1.65, y: 0, z: Math.sin(a) * 1.65 }, tilt),
        'rgba(168,85,247,0.48)',
        1.6
      );

      // Central Sun / Astral Core
      const centerSun = project3D({ x: 0, y: 0, z: 0 }, W, H, fov, camDist);
      const sunGrad = ctx.createRadialGradient(
        centerSun.sx,
        centerSun.sy,
        2,
        centerSun.sx,
        centerSun.sy,
        34 + Math.sin(pulse) * 4
      );
      sunGrad.addColorStop(0, '#fef08a');
      sunGrad.addColorStop(0.35, 'rgba(251,146,60,0.65)');
      sunGrad.addColorStop(1, 'rgba(168,85,247,0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(centerSun.sx, centerSun.sy, 38, 0, Math.PI * 2);
      ctx.fill();

      // Compute 3D positions of all 12 constellations along the tilted ecliptic
      const nodes = ZODIAC_ORDER.map((z, idx) => {
        const ang = (idx / 12) * Math.PI * 2;
        const ecl = rotX({ x: Math.cos(ang) * 1.65, y: 0, z: Math.sin(ang) * 1.65 }, tilt);
        const wp = rotateEuler(ecl, cam.rx, cam.ry);
        const pp = project3D(wp, W, H, fov, camDist);
        return { z, wp, pp };
      });

      // If compatibility mode: draw glowing 3D Bezier synastry arc between sign1 and sign2
      if (secondSign) {
        const n1 = nodes.find((n) => n.z.id === selectedSign);
        const n2 = nodes.find((n) => n.z.id === secondSign);
        if (n1 && n2) {
          ctx.beginPath();
          for (let s = 0; s <= 28; s++) {
            const t = s / 28;
            const inv = 1 - t;
            // Arc elevated toward celestial north pole
            const ctrl = rotateEuler({ x: 0, y: 0.85, z: 0 }, cam.rx, cam.ry);
            const pt: Vec3 = {
              x: inv * inv * n1.wp.x + 2 * inv * t * ctrl.x + t * t * n2.wp.x,
              y: inv * inv * n1.wp.y + 2 * inv * t * ctrl.y + t * t * n2.wp.y,
              z: inv * inv * n1.wp.z + 2 * inv * t * ctrl.z + t * t * n2.wp.z,
            };
            const pp = project3D(pt, W, H, fov, camDist);
            if (s === 0) ctx.moveTo(pp.sx, pp.sy);
            else ctx.lineTo(pp.sx, pp.sy);
          }
          ctx.strokeStyle = 'rgba(244,114,182,0.9)';
          ctx.lineWidth = 2.4;
          ctx.stroke();

          if (compatPct !== undefined) {
            ctx.fillStyle = '#fbcfe8';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`💞 ${compatPct}%`, W * 0.5, 22);
          }
        }
      }

      // Sort and draw constellation spheres
      const sorted = [...nodes].sort((a, b) => a.wp.z - b.wp.z);
      const hits: { id: string; sx: number; sy: number; r: number; z: number }[] = [];

      for (const item of sorted) {
        if (!item.pp.visible) continue;
        const isPrimary = item.z.id === selectedSign;
        const isSecondary = secondSign === item.z.id;
        const highlighted = isPrimary || isSecondary;
        const col = ELEM_COLORS[item.z.elem] || '#a855f7';
        const [r, g, b] = hexToRgb(col);
        const rad = Math.max(11, item.pp.scale * (highlighted ? 0.23 : 0.165));

        if (highlighted) {
          ctx.beginPath();
          ctx.moveTo(centerSun.sx, centerSun.sy);
          ctx.lineTo(item.pp.sx, item.pp.sy);
          ctx.strokeStyle = `rgba(${r},${g},${b},0.45)`;
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(item.pp.sx, item.pp.sy, rad, 0, Math.PI * 2);
        ctx.fillStyle = highlighted
          ? `rgba(${r},${g},${b},0.92)`
          : `rgba(15,23,42,${item.wp.z > 0 ? 0.92 : 0.58})`;
        ctx.fill();
        ctx.lineWidth = highlighted ? 2.2 : 1.1;
        ctx.strokeStyle = highlighted ? '#ffffff' : `rgba(${r},${g},${b},0.65)`;
        ctx.stroke();

        ctx.fillStyle = highlighted ? '#090d16' : '#f8fafc';
        ctx.font = `bold ${Math.round(rad * 0.95)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.z.symbol, item.pp.sx, item.pp.sy + 0.5);

        if (highlighted || item.wp.z > 0.35) {
          ctx.fillStyle = highlighted ? '#ffffff' : 'rgba(203,213,225,0.78)';
          ctx.font = `${highlighted ? 'bold ' : ''}10px sans-serif`;
          ctx.fillText(item.z.name, item.pp.sx, item.pp.sy + rad + 10);
        }

        hits.push({ id: item.z.id, sx: item.pp.sx, sy: item.pp.sy, r: rad + 6, z: item.wp.z });
      }
      hitSignsRef.current = hits;

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [active, selectedSign, secondSign, compatPct, stars]);

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    camRef.current.dragging = true;
    camRef.current.lx = e.clientX;
    camRef.current.ly = e.clientY;
    camRef.current.moved = false;
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!camRef.current.dragging) return;
    const dx = e.clientX - camRef.current.lx;
    const dy = e.clientY - camRef.current.ly;
    if (Math.abs(dx) + Math.abs(dy) > 4) camRef.current.moved = true;
    camRef.current.lx = e.clientX;
    camRef.current.ly = e.clientY;
    camRef.current.ry += dx * 0.011;
    camRef.current.targetRy = camRef.current.ry;
    camRef.current.rx = Math.max(-1.1, Math.min(1.1, camRef.current.rx + dy * 0.011));
  };

  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const wasTap = !camRef.current.moved;
    camRef.current.dragging = false;
    if (!wasTap || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const hit = hitSignsRef.current
      .filter((h) => Math.hypot(cx - h.sx, cy - h.sy) <= h.r)
      .sort((a, b) => b.z - a.z)[0];
    if (hit) onSelectSign(hit.id);
  };

  return (
    <div
      ref={wrapRef}
      className="rounded-2xl border border-purple-500/30 bg-slate-900/80 p-3 sm:p-4 space-y-2 select-none"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-purple-200">
          🪐 3D Небесная сфера эклиптики (23.4°) — выберите созвездие касанием
        </span>
        <button
          type="button"
          onClick={() => {
            camRef.current.rx = 0.34;
          }}
          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" /> Центрировать
        </button>
      </div>
      <canvas
        ref={canvasRef}
        style={{ height: 235 }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => {
          camRef.current.dragging = false;
        }}
        className="w-full rounded-xl bg-[#070b16] border border-white/5 cursor-grab active:cursor-grabbing touch-none block"
      />
    </div>
  );
};

// ============================================================================
// 3. REAL-TIME 3D PHYSICS LABORATORY SIMULATOR (ALL 8 CALCULATORS)
// ============================================================================
interface Physics3DProps {
  calcId: string;
  values: Record<string, string>;
  result?: any;
}

function draw3DArrow(
  ctx: CanvasRenderingContext2D,
  from: Vec3,
  to: Vec3,
  rx: number,
  ry: number,
  W: number,
  H: number,
  fov: number,
  camDist: number,
  color: string,
  label: string
) {
  const p1 = project3D(rotateEuler(from, rx, ry), W, H, fov, camDist);
  const p2 = project3D(rotateEuler(to, rx, ry), W, H, fov, camDist);
  if (!p1.visible || !p2.visible) return;

  ctx.beginPath();
  ctx.moveTo(p1.sx, p1.sy);
  ctx.lineTo(p2.sx, p2.sy);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  const ang = Math.atan2(p2.sy - p1.sy, p2.sx - p1.sx);
  ctx.beginPath();
  ctx.moveTo(p2.sx, p2.sy);
  ctx.lineTo(p2.sx - 8 * Math.cos(ang - 0.45), p2.sy - 8 * Math.sin(ang - 0.45));
  ctx.lineTo(p2.sx - 8 * Math.cos(ang + 0.45), p2.sy - 8 * Math.sin(ang + 0.45));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  if (label) {
    ctx.fillStyle = color;
    ctx.font = 'bold 11px monospace';
    ctx.fillText(label, p2.sx + 6, p2.sy - 4);
  }
}

export const PhysicsLab3D: React.FC<Physics3DProps> = ({ calcId, values }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const active = useViewportActive(wrapRef);

  const [paused, setPaused] = useState(false);
  const [zoom, setZoom] = useState(255);
  const camRef = useRef({ rx: 0.42, ry: -0.58, down: false, lx: 0, ly: 0 });
  const cubeMesh = useMemo(() => createCube(0.65), []);

  const num = (k: string, def: number) => {
    const raw = Number((values[k] ?? '').replace(',', '.'));
    return Number.isFinite(raw) && values[k] !== undefined && values[k] !== '' ? raw : def;
  };

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let tSim = 0;

    // Pre-init 36 3D gas/liquid molecules for heat/pressure scenes
    const molecules = Array.from({ length: 36 }, (_, i) => ({
      x: ((i % 6) / 2.5 - 1) * 0.75,
      y: ((Math.floor(i / 6) % 6) / 2.5 - 1) * 0.65,
      z: (((i * 7) % 11) / 5 - 1) * 0.75,
      vx: Math.cos(i * 1.7),
      vy: Math.sin(i * 2.3),
      vz: Math.cos(i * 3.1),
    }));

    const render = () => {
      const cvs = canvasRef.current;
      if (!cvs) return;
      const { ctx, W, H } = syncHiDPICanvas(cvs, 560, 220);
      if (!ctx) return;
      if (!paused) tSim += 0.025;

      const { rx, ry } = camRef.current;
      const fov = zoom;
      const camDist = 4.6;

      ctx.fillStyle = '#070c18';
      ctx.fillRect(0, 0, W, H);

      // 3D Perspective Floor Grid (y = -0.95)
      ctx.lineWidth = 1;
      for (let g = -4; g <= 4; g++) {
        const a1 = project3D(rotateEuler(v3(g * 0.48, -0.95, -1.92), rx, ry), W, H, fov, camDist);
        const a2 = project3D(rotateEuler(v3(g * 0.48, -0.95, 1.92), rx, ry), W, H, fov, camDist);
        if (a1.visible && a2.visible) {
          ctx.strokeStyle = g === 0 ? 'rgba(56,189,248,0.32)' : 'rgba(148,163,184,0.11)';
          ctx.beginPath();
          ctx.moveTo(a1.sx, a1.sy);
          ctx.lineTo(a2.sx, a2.sy);
          ctx.stroke();
        }
        const b1 = project3D(rotateEuler(v3(-1.92, -0.95, g * 0.48), rx, ry), W, H, fov, camDist);
        const b2 = project3D(rotateEuler(v3(1.92, -0.95, g * 0.48), rx, ry), W, H, fov, camDist);
        if (b1.visible && b2.visible) {
          ctx.strokeStyle = g === 0 ? 'rgba(99,102,241,0.32)' : 'rgba(148,163,184,0.11)';
          ctx.beginPath();
          ctx.moveTo(b1.sx, b1.sy);
          ctx.lineTo(b2.sx, b2.sy);
          ctx.stroke();
        }
      }

      // SCENE A: Kinematics (Uniform / Accelerated)
      if (calcId === 'kinematics_uniform' || calcId === 'kinematics_accel') {
        const vVal = Math.max(1, Math.min(200, Math.abs(num('v', num('v1', 60)))));
        const aVal = calcId === 'kinematics_accel' ? num('a', 3) : 0;
        const speedNorm = 0.5 + (vVal / 200) * 2.2;
        const xPos = -1.55 + (((tSim * speedNorm) % 3.1));

        // 3D Moving Vehicle Block
        const shiftedCube: Mesh3D = {
          ...cubeMesh,
          vertices: cubeMesh.vertices.map((vt) => ({
            x: vt.x * 1.15 + xPos,
            y: vt.y * 0.65 - 0.68,
            z: vt.z * 0.75,
          })),
        };
        drawShadedMesh(ctx, shiftedCube, rx, ry, 0, W, H, fov, camDist, '#38bdf8', 0.85);

        draw3DArrow(
          ctx,
          v3(xPos, -0.45, 0),
          v3(xPos + Math.min(1.15, 0.35 + vVal / 140), -0.45, 0),
          rx,
          ry,
          W,
          H,
          fov,
          camDist,
          '#38bdf8',
          `v⃗ = ${vVal}`
        );
        if (calcId === 'kinematics_accel') {
          draw3DArrow(
            ctx,
            v3(xPos, -0.2, 0),
            v3(xPos + Math.sign(aVal || 1) * 0.65, -0.2, 0),
            rx,
            ry,
            W,
            H,
            fov,
            camDist,
            '#34d399',
            `a⃗ = ${aVal}`
          );
        }
      }

      // SCENE B: Free Fall under Gravity
      else if (calcId === 'free_fall') {
        const hVal = Math.max(1, num('h', 45));
        const gVal = Math.max(1, num('g', 9.81));
        const tTotal = Math.sqrt((2 * hVal) / gVal);
        const phase = (tSim * 0.75) % 1;
        const yBall = 1.05 - phase * phase * 1.85;

        // 3D Tower Pillar
        draw3DArrow(ctx, v3(-0.65, -0.95, 0), v3(-0.65, 1.1, 0), rx, ry, W, H, fov, camDist, '#64748b', `h=${hVal}м`);

        // Stroboscopic trail positions
        for (let k = 0; k < 6; k++) {
          const pk = k / 6;
          if (pk <= phase) {
            const tp = project3D(rotateEuler(v3(0.15, 1.05 - pk * pk * 1.85, 0), rx, ry), W, H, fov, camDist);
            if (tp.visible) {
              ctx.fillStyle = 'rgba(56,189,248,0.28)';
              ctx.beginPath();
              ctx.arc(tp.sx, tp.sy, 4, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }

        const bp = project3D(rotateEuler(v3(0.15, yBall, 0), rx, ry), W, H, fov, camDist);
        if (bp.visible) {
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(bp.sx, bp.sy, Math.max(8, bp.scale * 0.16), 0, Math.PI * 2);
          ctx.fill();
        }
        draw3DArrow(ctx, v3(0.15, yBall, 0), v3(0.15, yBall - 0.55, 0), rx, ry, W, H, fov, camDist, '#fb7185', `g⃗ (${tTotal.toFixed(2)}с)`);
      }

      // SCENE C: Newton Force & Friction 3D Vector Body Diagram
      else if (calcId === 'newton_force') {
        const mVal = Math.max(0.5, num('m', 10));
        const aVal = num('a', 2.5);
        const muVal = num('mu', 0.2);

        const body: Mesh3D = {
          ...cubeMesh,
          vertices: cubeMesh.vertices.map((vt) => ({ x: vt.x, y: vt.y - 0.55, z: vt.z })),
        };
        drawShadedMesh(ctx, body, rx, ry, 0, W, H, fov, camDist, '#6366f1', 0.84);

        const c = v3(0, -0.55, 0);
        draw3DArrow(ctx, c, v3(1.15, -0.55, 0), rx, ry, W, H, fov, camDist, '#34d399', `F⃗ (a=${aVal})`);
        draw3DArrow(ctx, c, v3(-0.75, -0.55, 0), rx, ry, W, H, fov, camDist, '#fb923c', `Fтр (μ=${muVal})`);
        draw3DArrow(ctx, c, v3(0, 0.42, 0), rx, ry, W, H, fov, camDist, '#38bdf8', 'N⃗');
        draw3DArrow(ctx, c, v3(0, -1.42, 0), rx, ry, W, H, fov, camDist, '#f43f5e', `m·g⃗ (${mVal}кг)`);
      }

      // SCENE D: Work, Power & Efficiency 3D Turbine
      else if (calcId === 'work_power_eff') {
        const aUseful = Math.max(0, num('A_useful', 800));
        const aTotal = Math.max(1, num('A_total', 1000));
        const eta = Math.min(100, Math.max(5, Math.round((aUseful / aTotal) * 100)));

        const torus = createTorus(0.75, 0.18, 16, 8);
        drawShadedMesh(ctx, torus, rx + Math.PI * 0.5, ry, tSim * (0.8 + eta * 0.02), W, H, fov, camDist, '#10b981', 0.78);

        draw3DArrow(ctx, v3(-1.55, 0, 0), v3(-0.85, 0, 0), rx, ry, W, H, fov, camDist, '#38bdf8', 'Pвх 100%');
        draw3DArrow(ctx, v3(0.85, 0.12, 0), v3(1.65, 0.12, 0), rx, ry, W, H, fov, camDist, '#34d399', `Полезн. ${eta}%`);
        draw3DArrow(ctx, v3(0, -0.5, 0), v3(0.55, -1.1, 0.4), rx, ry, W, H, fov, camDist, '#fb923c', `Потери ${100 - eta}%`);
      }

      // SCENE E: Ohm's Law 3D Circuit + Flowing Electrons + Glowing Coil
      else if (calcId === 'ohm_electric') {
        const uVal = Math.max(1, num('U', 220));
        const rVal = Math.max(0.5, num('R', 44));
        const iVal = num('I', +(uVal / rVal).toFixed(2));
        const power = uVal * iVal;

        const loopPts: Vec3[] = [
          v3(-1.35, -0.55, -0.85),
          v3(1.35, -0.55, -0.85),
          v3(1.35, -0.55, 0.85),
          v3(-1.35, -0.55, 0.85),
        ];

        // Draw circuit rails
        ctx.beginPath();
        for (let k = 0; k <= 4; k++) {
          const p = project3D(rotateEuler(loopPts[k % 4], rx, ry), W, H, fov, camDist);
          if (k === 0) ctx.moveTo(p.sx, p.sy);
          else ctx.lineTo(p.sx, p.sy);
        }
        ctx.strokeStyle = 'rgba(148,163,184,0.65)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // 3D Helical Resistor Coil along top rail (z = -0.85)
        const heatRatio = Math.min(1, power / 2500);
        const coilColor = `rgb(${Math.round(56 + 199 * heatRatio)},${Math.round(189 - 90 * heatRatio)},${Math.round(
          248 - 200 * heatRatio
        )})`;
        ctx.beginPath();
        for (let s = 0; s <= 48; s++) {
          const u = s / 48;
          const ang = u * Math.PI * 12;
          const cp = v3(-0.65 + u * 1.3, -0.55 + Math.sin(ang) * 0.18, -0.85 + Math.cos(ang) * 0.18);
          const pp = project3D(rotateEuler(cp, rx, ry), W, H, fov, camDist);
          if (s === 0) ctx.moveTo(pp.sx, pp.sy);
          else ctx.lineTo(pp.sx, pp.sy);
        }
        ctx.strokeStyle = coilColor;
        ctx.lineWidth = 2.6;
        ctx.stroke();

        // Flowing 3D electrons around the perimeter
        const eSpeed = Math.min(3.5, 0.35 + Math.abs(iVal) * 0.18);
        for (let e = 0; e < 14; e++) {
          const pos = ((e / 14) + tSim * eSpeed * 0.15) % 1;
          const seg = pos * 4;
          const idx = Math.floor(seg);
          const frac = seg - idx;
          const a = loopPts[idx % 4];
          const b = loopPts[(idx + 1) % 4];
          const ep = v3(a.x + (b.x - a.x) * frac, a.y + (b.y - a.y) * frac, a.z + (b.z - a.z) * frac);
          const pp = project3D(rotateEuler(ep, rx, ry), W, H, fov, camDist);
          if (pp.visible) {
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.arc(pp.sx, pp.sy, 4.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`U=${uVal}В • R=${rVal}Ом • I≈${iVal}А`, 14, 22);
      }

      // SCENE F: Thermal Molecular agitation / Hydrostatic Pressure
      else {
        const isHeat = calcId === 'heat_boiling';
        const tempEnd = num('t2', 100);
        const speedMul = isHeat ? 0.4 + Math.min(2.4, Math.max(0.2, tempEnd / 60)) : 0.55;

        // Wireframe 3D Vessel Box
        const vessel = createCube(1.45);
        const vProj = vessel.vertices.map((vt) => project3D(rotateEuler(vt, rx, ry), W, H, fov, camDist));
        ctx.strokeStyle = 'rgba(56,189,248,0.35)';
        ctx.lineWidth = 1.2;
        for (const [a, b] of vessel.edges) {
          if (vProj[a].visible && vProj[b].visible) {
            ctx.beginPath();
            ctx.moveTo(vProj[a].sx, vProj[a].sy);
            ctx.lineTo(vProj[b].sx, vProj[b].sy);
            ctx.stroke();
          }
        }

        for (const m of molecules) {
          if (!paused) {
            m.x += m.vx * 0.015 * speedMul;
            m.y += m.vy * 0.015 * speedMul;
            m.z += m.vz * 0.015 * speedMul;
            if (Math.abs(m.x) > 0.75) m.vx *= -1;
            if (Math.abs(m.y) > 0.72) m.vy *= -1;
            if (Math.abs(m.z) > 0.75) m.vz *= -1;
          }
          const mp = project3D(rotateEuler(m, rx, ry), W, H, fov, camDist);
          if (!mp.visible) continue;
          const depthRatio = (0.75 - m.y) / 1.5;
          ctx.fillStyle = isHeat
            ? tempEnd >= 80
              ? '#fb7185'
              : '#38bdf8'
            : `rgba(56,189,248,${0.35 + depthRatio * 0.65})`;
          ctx.beginPath();
          ctx.arc(mp.sx, mp.sy, Math.max(3.2, mp.scale * 0.07), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [active, calcId, values, paused, zoom, cubeMesh]);

  return (
    <div
      ref={wrapRef}
      className="rounded-2xl border border-sky-500/30 bg-slate-900/80 p-3.5 sm:p-4 space-y-2.5 select-none"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-sky-200">
          🧊 3D Физический стенд — вращение камеры на 360°
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 flex items-center gap-1"
          >
            {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            <span>{paused ? 'Пуск' : 'Пауза'}</span>
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(340, z + 25))}
            className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
            title="Приблизить"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(180, z - 25))}
            className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
            title="Отдалить"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              camRef.current.rx = 0.42;
              camRef.current.ry = -0.58;
              setZoom(255);
            }}
            className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
            title="Сброс камеры"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        style={{ height: 220 }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          camRef.current.down = true;
          camRef.current.lx = e.clientX;
          camRef.current.ly = e.clientY;
        }}
        onPointerMove={(e) => {
          if (!camRef.current.down) return;
          const dx = e.clientX - camRef.current.lx;
          const dy = e.clientY - camRef.current.ly;
          camRef.current.lx = e.clientX;
          camRef.current.ly = e.clientY;
          camRef.current.ry += dx * 0.011;
          camRef.current.rx = Math.max(-1.25, Math.min(1.25, camRef.current.rx + dy * 0.011));
        }}
        onPointerUp={() => {
          camRef.current.down = false;
        }}
        onPointerCancel={() => {
          camRef.current.down = false;
        }}
        className="w-full rounded-xl bg-[#070c18] border border-white/5 cursor-grab active:cursor-grabbing touch-none block"
      />
    </div>
  );
};

// ============================================================================
// 4. INTERACTIVE 3D EARTH GLOBE & CHAOTIC LORENZ ATTRACTOR (KNOWLEDGE HUB)
// ============================================================================
const WORLD_BEACONS = [
  { name: 'Россия', city: 'Москва', lat: 55.75, lon: 37.62, color: '#38bdf8' },
  { name: 'Китай', city: 'Пекин', lat: 39.9, lon: 116.4, color: '#fb7185' },
  { name: 'Индия', city: 'Дели', lat: 28.61, lon: 77.21, color: '#fb923c' },
  { name: 'США', city: 'Нью-Йорк', lat: 40.71, lon: -74.0, color: '#60a5fa' },
  { name: 'Япония', city: 'Токио', lat: 35.68, lon: 139.69, color: '#f472b6' },
  { name: 'Германия', city: 'Берлин', lat: 52.52, lon: 13.4, color: '#facc15' },
  { name: 'Франция', city: 'Париж', lat: 48.85, lon: 2.35, color: '#a78bfa' },
  { name: 'Великобритания', city: 'Лондон', lat: 51.5, lon: -0.12, color: '#38bdf8' },
  { name: 'Бразилия', city: 'Сан-Паулу', lat: -23.55, lon: -46.63, color: '#34d399' },
  { name: 'Египет', city: 'Каир', lat: 30.04, lon: 31.23, color: '#fbbf24' },
  { name: 'Турция', city: 'Стамбул', lat: 41.0, lon: 28.97, color: '#f87171' },
  { name: 'Индонезия', city: 'Джакарта', lat: -6.2, lon: 106.84, color: '#2dd4bf' },
  { name: 'Нигерия', city: 'Лагос', lat: 6.52, lon: 3.37, color: '#4ade80' },
  { name: 'Мексика', city: 'Мехико', lat: 19.43, lon: -99.13, color: '#fb923c' },
  { name: 'Австралия', city: 'Сидней', lat: -33.86, lon: 151.2, color: '#38bdf8' },
  { name: 'Казахстан', city: 'Астана', lat: 51.16, lon: 71.47, color: '#22d3ee' },
];

interface GlobeProps {
  mode: 'globe' | 'math';
  onPickQuery?: (query: string) => void;
}

export const WorldGlobeAndMath3D: React.FC<GlobeProps> = ({ mode, onPickQuery }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const active = useViewportActive(wrapRef);

  const [scene, setScene] = useState<'globe' | 'lorenz' | 'dodeca'>(mode === 'math' ? 'lorenz' : 'globe');
  const camRef = useRef({ rx: 0.36, ry: -0.65, down: false, lx: 0, ly: 0, moved: false });
  const hitBeaconsRef = useRef<{ q: string; sx: number; sy: number; r: number; z: number }[]>([]);

  useEffect(() => {
    setScene(mode === 'math' ? 'lorenz' : 'globe');
  }, [mode]);

  const lorenzPts = useMemo(() => generateLorenzPoints(620), []);
  const dodeca = useMemo(() => createDodecahedron(1.22), []);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let tick = 0;

    const render = () => {
      const cvs = canvasRef.current;
      if (!cvs) return;
      const { ctx, W, H } = syncHiDPICanvas(cvs, 560, 215);
      if (!ctx) return;
      tick += 1;

      const cam = camRef.current;
      if (!cam.down) {
        cam.ry += 0.0045;
      }

      ctx.fillStyle = '#070b15';
      ctx.fillRect(0, 0, W, H);

      const fov = 260;
      const camDist = 4.2;

      if (scene === 'globe') {
        const R = 1.38;
        const zLimb = (R * R) / camDist;
        const rLimb = Math.sqrt(Math.max(1e-4, R * R - zLimb * zLimb));
        const c0 = project3D(v3(0, 0, 0), W, H, fov, camDist);
        const edge0 = project3D(v3(rLimb, 0, zLimb), W, H, fov, camDist);
        const screenR = Math.max(30, Math.abs(edge0.sx - c0.sx));

        // Atmosphere halo
        const halo = ctx.createRadialGradient(c0.sx, c0.sy, screenR * 0.72, c0.sx, c0.sy, screenR * 1.24);
        halo.addColorStop(0, 'rgba(14,165,233,0.22)');
        halo.addColorStop(0.75, 'rgba(56,189,248,0.14)');
        halo.addColorStop(1, 'rgba(8,12,22,0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(c0.sx, c0.sy, screenR * 1.24, 0, Math.PI * 2);
        ctx.fill();

        // Ocean sphere fill
        const oceanG = ctx.createRadialGradient(
          c0.sx - screenR * 0.28,
          c0.sy - screenR * 0.28,
          screenR * 0.08,
          c0.sx,
          c0.sy,
          screenR
        );
        oceanG.addColorStop(0, '#0369a1');
        oceanG.addColorStop(0.65, '#0c4a6e');
        oceanG.addColorStop(1, '#082f49');
        ctx.fillStyle = oceanG;
        ctx.beginPath();
        ctx.arc(c0.sx, c0.sy, screenR, 0, Math.PI * 2);
        ctx.fill();

        // Compact continent silhouettes (North UP, South DOWN)
        const miniConts: [number, number][][] = [
          [[70, -162], [72, -95], [52, -56], [26, -80], [18, -96], [9, -80], [23, -108], [38, -123], [58, -138], [62, -164]],
          [[11, -74], [5, -52], [-6, -35], [-23, -43], [-38, -58], [-54, -69], [-42, -74], [-18, -71], [-4, -80]],
          [[36, -8], [48, -4], [58, 8], [70, 26], [69, 58], [46, 50], [41, 29], [38, 15], [41, 2]],
          [[69, 58], [75, 102], [68, 172], [53, 158], [43, 134], [31, 121], [12, 108], [8, 77], [24, 67], [22, 40], [36, 36], [46, 50]],
          [[35, -6], [32, 32], [12, 50], [-12, 40], [-34, 24], [-34, 18], [-16, 12], [5, 8], [5, -7], [16, -17], [30, -11]],
          [[-12, 131], [-12, 142], [-26, 153], [-38, 147], [-34, 115], [-21, 114]],
        ];

        ctx.save();
        ctx.beginPath();
        ctx.arc(c0.sx, c0.sy, screenR, 0, Math.PI * 2);
        ctx.clip();

        for (const poly of miniConts) {
          const wps = poly.map(([la, lo]) => rotateEuler(latLonToVec3(la, lo, R * 1.003), cam.rx, cam.ry));
          if (wps.filter((w) => w.z > zLimb).length < 2) continue;
          ctx.beginPath();
          wps.forEach((wp, idx) => {
            const clamped =
              wp.z >= zLimb
                ? wp
                : {
                    x: (wp.x / (Math.hypot(wp.x, wp.y) || 1e-4)) * rLimb,
                    y: (wp.y / (Math.hypot(wp.x, wp.y) || 1e-4)) * rLimb,
                    z: zLimb,
                  };
            const pp = project3D(clamped, W, H, fov, camDist);
            if (idx === 0) ctx.moveTo(pp.sx, pp.sy);
            else ctx.lineTo(pp.sx, pp.sy);
          });
          ctx.closePath();
          ctx.fillStyle = 'rgba(34,165,102,0.58)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(167,243,208,0.45)';
          ctx.lineWidth = 0.85;
          ctx.stroke();
        }

        // Front-hemisphere Latitude parallels
        for (const lat of [-60, -30, 0, 30, 60]) {
          ctx.beginPath();
          let pen = false;
          for (let lon = -180; lon <= 180; lon += 6) {
            const p = rotateEuler(latLonToVec3(lat, lon, R), cam.rx, cam.ry);
            if (p.z < zLimb) {
              pen = false;
              continue;
            }
            const pp = project3D(p, W, H, fov, camDist);
            if (!pen) {
              ctx.moveTo(pp.sx, pp.sy);
              pen = true;
            } else {
              ctx.lineTo(pp.sx, pp.sy);
            }
          }
          ctx.strokeStyle = lat === 0 ? 'rgba(125,211,252,0.44)' : 'rgba(148,163,184,0.16)';
          ctx.lineWidth = lat === 0 ? 1.3 : 0.85;
          ctx.stroke();
        }

        // Front-hemisphere Longitude meridians
        for (let lon = -150; lon <= 180; lon += 30) {
          ctx.beginPath();
          let pen = false;
          for (let lat = -85; lat <= 85; lat += 6) {
            const p = rotateEuler(latLonToVec3(lat, lon, R), cam.rx, cam.ry);
            if (p.z < zLimb) {
              pen = false;
              continue;
            }
            const pp = project3D(p, W, H, fov, camDist);
            if (!pen) {
              ctx.moveTo(pp.sx, pp.sy);
              pen = true;
            } else {
              ctx.lineTo(pp.sx, pp.sy);
            }
          }
          ctx.strokeStyle = 'rgba(148,163,184,0.14)';
          ctx.lineWidth = 0.85;
          ctx.stroke();
        }

        ctx.restore();

        ctx.beginPath();
        ctx.arc(c0.sx, c0.sy, screenR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(125,211,252,0.5)';
        ctx.lineWidth = 1.1;
        ctx.stroke();

        // North & South Pole markers
        const np = rotateEuler(latLonToVec3(90, 0, R * 1.08), cam.rx, cam.ry);
        if (np.z > -0.2) {
          const npp = project3D(np, W, H, fov, camDist);
          ctx.fillStyle = '#7dd3fc';
          ctx.font = '700 9px monospace';
          ctx.fillText('N↑', npp.sx - 6, npp.sy - 2);
        }

        // Country markers (pin size is not population data)
        const hits: { q: string; sx: number; sy: number; r: number; z: number }[] = [];
        for (const b of WORLD_BEACONS) {
          const base = rotateEuler(latLonToVec3(b.lat, b.lon, R), cam.rx, cam.ry);
          if (base.z < -0.15) continue; // occluded behind Earth
          const tip = rotateEuler(latLonToVec3(b.lat, b.lon, R + 0.24), cam.rx, cam.ry);
          const pb = project3D(base, W, H, fov, camDist);
          const pt = project3D(tip, W, H, fov, camDist);

          ctx.beginPath();
          ctx.moveTo(pb.sx, pb.sy);
          ctx.lineTo(pt.sx, pt.sy);
          ctx.strokeStyle = b.color;
          ctx.lineWidth = 2.2;
          ctx.stroke();

          ctx.fillStyle = b.color;
          ctx.beginPath();
          ctx.arc(pt.sx, pt.sy, 3.6, 0, Math.PI * 2);
          ctx.fill();

          if (base.z > 0.35) {
            ctx.fillStyle = 'rgba(241,245,249,0.88)';
            ctx.font = '10px sans-serif';
            ctx.fillText(b.name, pt.sx + 5, pt.sy + 3);
          }
          hits.push({ q: b.name, sx: pt.sx, sy: pt.sy, r: 14, z: base.z });
        }
        hitBeaconsRef.current = hits;
      } else if (scene === 'lorenz') {
        hitBeaconsRef.current = [];
        for (let i = 1; i < lorenzPts.length; i++) {
          const p0 = project3D(rotateEuler(lorenzPts[i - 1], cam.rx, cam.ry), W, H, fov, camDist);
          const p1 = project3D(rotateEuler(lorenzPts[i], cam.rx, cam.ry), W, H, fov, camDist);
          if (!p0.visible || !p1.visible) continue;
          const hue = 185 + Math.round((i / lorenzPts.length) * 120);
          ctx.beginPath();
          ctx.moveTo(p0.sx, p0.sy);
          ctx.lineTo(p1.sx, p1.sy);
          ctx.strokeStyle = `hsla(${hue}, 90%, 65%, 0.78)`;
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
        const tracerIdx = (tick * 3) % lorenzPts.length;
        const tp = project3D(rotateEuler(lorenzPts[tracerIdx], cam.rx, cam.ry), W, H, fov, camDist);
        if (tp.visible) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(tp.sx, tp.sy, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        hitBeaconsRef.current = [];
        drawShadedMesh(ctx, dodeca, cam.rx, cam.ry, tick * 0.005, W, H, fov, camDist, '#34d399', 0.8);
      }

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [active, scene, lorenzPts, dodeca]);

  const handleUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const wasTap = !camRef.current.moved;
    camRef.current.down = false;
    if (!wasTap || scene !== 'globe' || !onPickQuery || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const hit = hitBeaconsRef.current
      .filter((b) => Math.hypot(cx - b.sx, cy - b.sy) <= b.r)
      .sort((a, b) => b.z - a.z)[0];
    if (hit) onPickQuery(hit.q);
  };

  return (
    <div
      ref={wrapRef}
      className="rounded-2xl border border-emerald-500/25 bg-slate-900/75 p-3.5 space-y-2 select-none"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'globe', label: '🌍 3D Глобус стран' },
            { id: 'lorenz', label: '🌀 3D Аттрактор Лоренца' },
            { id: 'dodeca', label: '🔷 3D Додекаэдр' },
          ].map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setScene(b.id as any)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
                scene === b.id
                  ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-200'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
        {scene === 'globe' && (
          <span className="text-[11px] text-slate-400">Тап по маяку на глобусе — фильтр страны</span>
        )}
      </div>

      <canvas
        ref={canvasRef}
        style={{ height: 215 }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          camRef.current.down = true;
          camRef.current.moved = false;
          camRef.current.lx = e.clientX;
          camRef.current.ly = e.clientY;
        }}
        onPointerMove={(e) => {
          if (!camRef.current.down) return;
          const dx = e.clientX - camRef.current.lx;
          const dy = e.clientY - camRef.current.ly;
          if (Math.abs(dx) + Math.abs(dy) > 4) camRef.current.moved = true;
          camRef.current.lx = e.clientX;
          camRef.current.ly = e.clientY;
          camRef.current.ry += dx * 0.011;
          camRef.current.rx = Math.max(-1.2, Math.min(1.2, camRef.current.rx + dy * 0.011));
        }}
        onPointerUp={handleUp}
        onPointerCancel={() => {
          camRef.current.down = false;
        }}
        className="w-full rounded-xl bg-[#070b15] border border-white/5 cursor-grab active:cursor-grabbing touch-none block"
      />
    </div>
  );
};

// ============================================================================
// 5. 3D POLYHEDRAL RPG DICE TUMBLER (D4 / D6 / D8 / D12 / D20)
// ============================================================================
interface Dice3DProps {
  onRollResult?: (sides: number, value: number) => void;
}

export const PolyhedralDice3D: React.FC<Dice3DProps> = ({ onRollResult }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const active = useViewportActive(wrapRef);

  const [sides, setSides] = useState<4 | 6 | 8 | 12 | 20>(20);
  const [rolledValue, setRolledValue] = useState<number>(20);
  const physRef = useRef({
    rx: 0.5,
    ry: 0.7,
    rz: 0.2,
    vx: 0.01,
    vy: 0.014,
    vz: 0.005,
    bounceT: 0,
    rolling: false,
  });

  const diceMeshes = useMemo(
    () => ({
      4: createTetrahedron(1.28),
      6: createCube(1.25),
      8: createOctahedron(1.28),
      12: createDodecahedron(1.24),
      20: createIcosahedron(1.26),
    }),
    []
  );

  const triggerRoll = (targetSides = sides) => {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    const val = (arr[0] % targetSides) + 1;
    physRef.current.vx = 0.28 + (arr[0] % 9) * 0.02;
    physRef.current.vy = 0.34 + ((arr[0] >> 4) % 9) * 0.02;
    physRef.current.vz = 0.22;
    physRef.current.bounceT = 1.0;
    physRef.current.rolling = true;
    setRolledValue(val);
    onRollResult?.(targetSides, val);
  };

  useEffect(() => {
    if (!active) return;
    let raf = 0;

    const render = () => {
      const cvs = canvasRef.current;
      if (!cvs) return;
      const { ctx, W, H } = syncHiDPICanvas(cvs, 420, 185);
      if (!ctx) return;
      const p = physRef.current;

      p.rx += p.vx;
      p.ry += p.vy;
      p.rz += p.vz;

      if (p.rolling) {
        p.vx *= 0.945;
        p.vy *= 0.945;
        p.vz *= 0.945;
        p.bounceT = Math.max(0, p.bounceT - 0.025);
        if (Math.hypot(p.vx, p.vy) < 0.012) {
          p.rolling = false;
          p.vx = 0.004;
          p.vy = 0.008;
          p.vz = 0.002;
        }
      }

      ctx.fillStyle = '#080c17';
      ctx.fillRect(0, 0, W, H);

      const jumpOffset = Math.sin(p.bounceT * Math.PI) * 0.38;
      const baseMesh = diceMeshes[sides];
      const jumpedMesh: Mesh3D = {
        ...baseMesh,
        vertices: baseMesh.vertices.map((vt) => ({ x: vt.x, y: vt.y + jumpOffset, z: vt.z })),
      };

      const colorMap: Record<number, string> = {
        4: '#38bdf8',
        6: '#ec4899',
        8: '#a855f7',
        12: '#10b981',
        20: '#f59e0b',
      };
      drawShadedMesh(ctx, jumpedMesh, p.rx, p.ry, p.rz, W, H, 235, 4.1, colorMap[sides], 0.88);

      // Crisp number readout badge on front of die
      const centerProj = project3D(v3(0, jumpOffset, 0.9), W, H, 235, 4.1);
      ctx.fillStyle = 'rgba(9,13,24,0.82)';
      ctx.beginPath();
      ctx.arc(centerProj.sx, centerProj.sy, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 17px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(rolledValue), centerProj.sx, centerProj.sy + 1);

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [active, sides, rolledValue, diceMeshes]);

  return (
    <div
      ref={wrapRef}
      className="rounded-2xl border border-pink-500/30 bg-slate-950/90 p-3.5 space-y-2.5 select-none"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {([4, 6, 8, 12, 20] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                setSides(d);
                triggerRoll(d);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition ${
                sides === d
                  ? 'bg-pink-500 text-slate-950 border-pink-300'
                  : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              D{d}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => triggerRoll(sides)}
          className="px-3 py-1 rounded-lg bg-pink-500/20 hover:bg-pink-500/35 border border-pink-400/40 text-pink-200 text-xs font-semibold"
        >
          🎲 Бросить D{sides} в 3D
        </button>
      </div>

      <canvas
        ref={canvasRef}
        style={{ height: 185 }}
        onClick={() => triggerRoll(sides)}
        className="w-full rounded-xl bg-[#080c17] cursor-pointer touch-manipulation block"
      />
    </div>
  );
};

// ============================================================================
// 6. AES-256 3D CRYPTOGRAPHIC STATE LATTICE (4x4x4 ROUND MATRIX)
// ============================================================================
interface CryptoCubeProps {
  entropyBits: number;
}

export const CryptoStateCube3D: React.FC<CryptoCubeProps> = ({ entropyBits }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const active = useViewportActive(wrapRef);

  const camRef = useRef({ rx: 0.48, ry: 0.62, down: false, lx: 0, ly: 0, scramble: 0 });

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let phase = 0;

    const render = () => {
      const cvs = canvasRef.current;
      if (!cvs) return;
      const { ctx, W, H } = syncHiDPICanvas(cvs, 340, 165);
      if (!ctx) return;

      const strength = Math.min(1, Math.max(0.15, entropyBits / 128));
      phase += 0.012 + strength * 0.018;
      if (!camRef.current.down) {
        camRef.current.ry += 0.006;
      }
      if (camRef.current.scramble > 0) {
        camRef.current.scramble = Math.max(0, camRef.current.scramble - 0.03);
      }

      ctx.fillStyle = '#070d16';
      ctx.fillRect(0, 0, W, H);

      const fov = 230;
      const camDist = 4.3;
      const baseHex = entropyBits >= 100 ? '#10b981' : entropyBits >= 65 ? '#38bdf8' : '#f59e0b';
      const [cr, cg, cb] = hexToRgb(baseHex);

      // 4x4x4 AES State Matrix Nodes with layer ShiftRows rotation
      const pts: { wp: Vec3; pp: ReturnType<typeof project3D>; layer: number }[] = [];
      for (let ix = 0; ix < 4; ix++) {
        for (let iy = 0; iy < 4; iy++) {
          const layerTwist = Math.sin(phase + iy * 0.9) * (0.18 + camRef.current.scramble * 0.9);
          for (let iz = 0; iz < 4; iz++) {
            const local = v3((ix - 1.5) * 0.52, (iy - 1.5) * 0.52, (iz - 1.5) * 0.52);
            const shifted = rotY(local, layerTwist);
            const wp = rotateEuler(shifted, camRef.current.rx, camRef.current.ry);
            const pp = project3D(wp, W, H, fov, camDist);
            pts.push({ wp, pp, layer: iy });
          }
        }
      }

      // Connect adjacent state columns
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.22)`;
      ctx.lineWidth = 1;
      for (let i = 0; i < pts.length; i++) {
        if (i % 4 < 3 && pts[i].pp.visible && pts[i + 1].pp.visible) {
          ctx.beginPath();
          ctx.moveTo(pts[i].pp.sx, pts[i].pp.sy);
          ctx.lineTo(pts[i + 1].pp.sx, pts[i + 1].pp.sy);
          ctx.stroke();
        }
      }

      pts.sort((a, b) => a.wp.z - b.wp.z);
      for (const n of pts) {
        if (!n.pp.visible) continue;
        const r = Math.max(2.5, n.pp.scale * 0.055);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${n.wp.z > 0 ? 0.95 : 0.48})`;
        ctx.beginPath();
        ctx.arc(n.pp.sx, n.pp.sy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [active, entropyBits]);

  return (
    <div
      ref={wrapRef}
      className="rounded-2xl border border-emerald-500/25 bg-slate-950/90 p-3 space-y-2 select-none"
    >
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-emerald-300">
          🧊 3D Решётка состояния AES (4×4×4) • {Math.round(entropyBits)} бит
        </span>
        <button
          type="button"
          onClick={() => {
            camRef.current.scramble = 1.2;
          }}
          className="px-2 py-0.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-400/30"
        >
          ShiftRows
        </button>
      </div>
      <canvas
        ref={canvasRef}
        style={{ height: 165 }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          camRef.current.down = true;
          camRef.current.lx = e.clientX;
          camRef.current.ly = e.clientY;
        }}
        onPointerMove={(e) => {
          if (!camRef.current.down) return;
          const dx = e.clientX - camRef.current.lx;
          const dy = e.clientY - camRef.current.ly;
          camRef.current.lx = e.clientX;
          camRef.current.ly = e.clientY;
          camRef.current.ry += dx * 0.012;
          camRef.current.rx = Math.max(-1.2, Math.min(1.2, camRef.current.rx + dy * 0.012));
        }}
        onPointerUp={() => {
          camRef.current.down = false;
        }}
        onPointerCancel={() => {
          camRef.current.down = false;
        }}
        className="w-full rounded-xl bg-[#070d16] cursor-grab active:cursor-grabbing touch-none block"
      />
    </div>
  );
};

// ============================================================================
// 7. 3D LIQUID GLASS VESSEL WITH WAVE SLOSHING & BUBBLES (PARTY HUB)
// ============================================================================
interface PartyGlassProps {
  fillRatio: number; // 0..1
  label: string;
}

export const PartyGlass3D: React.FC<PartyGlassProps> = ({ fillRatio, label }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const active = useViewportActive(wrapRef);

  const camRef = useRef({ rx: 0.32, ry: 0.4, slosh: 0, down: false, lx: 0, ly: 0 });

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let t = 0;
    const bubbles = Array.from({ length: 18 }, (_, i) => ({
      ang: (i * 2.1) % (Math.PI * 2),
      rad: 0.15 + ((i * 17) % 60) / 100,
      y: -0.9 + ((i * 23) % 100) / 70,
      sp: 0.008 + (i % 5) * 0.003,
    }));

    const render = () => {
      const cvs = canvasRef.current;
      if (!cvs) return;
      const { ctx, W, H } = syncHiDPICanvas(cvs, 340, 165);
      if (!ctx) return;
      t += 0.05;

      const cam = camRef.current;
      if (!cam.down) cam.ry += 0.006;
      cam.slosh *= 0.94;

      ctx.fillStyle = '#080c16';
      ctx.fillRect(0, 0, W, H);

      const fov = 230;
      const camDist = 4.2;
      const clampedFill = Math.max(0.08, Math.min(0.95, fillRatio));
      const yBottom = -0.95;
      const yTop = 0.95;
      const yLiq = yBottom + (yTop - yBottom) * clampedFill;

      const liqColor =
        clampedFill < 0.32
          ? '#34d399'
          : clampedFill < 0.62
            ? '#f59e0b'
            : clampedFill < 0.82
              ? '#fb923c'
              : '#f43f5e';
      const [lr, lg, lb] = hexToRgb(liqColor);

      const radiusAt = (y: number) => 0.58 + ((y - yBottom) / (yTop - yBottom)) * 0.34;

      // Draw glass cylinder rings
      for (const yRing of [yBottom, 0, yTop]) {
        const rad = radiusAt(yRing);
        ctx.beginPath();
        for (let s = 0; s <= 40; s++) {
          const a = (s / 40) * Math.PI * 2;
          const p = rotateEuler(v3(Math.cos(a) * rad, yRing, Math.sin(a) * rad), cam.rx, cam.ry);
          const pp = project3D(p, W, H, fov, camDist);
          if (s === 0) ctx.moveTo(pp.sx, pp.sy);
          else ctx.lineTo(pp.sx, pp.sy);
        }
        ctx.strokeStyle = yRing === yTop ? 'rgba(226,232,240,0.5)' : 'rgba(148,163,184,0.22)';
        ctx.lineWidth = yRing === yTop ? 1.6 : 1;
        ctx.stroke();
      }

      // Glass vertical ribs
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const p1 = project3D(rotateEuler(v3(Math.cos(a) * radiusAt(yBottom), yBottom, Math.sin(a) * radiusAt(yBottom)), cam.rx, cam.ry), W, H, fov, camDist);
        const p2 = project3D(rotateEuler(v3(Math.cos(a) * radiusAt(yTop), yTop, Math.sin(a) * radiusAt(yTop)), cam.rx, cam.ry), W, H, fov, camDist);
        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.strokeStyle = 'rgba(226,232,240,0.16)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 3D Sloshing Liquid Meniscus Surface
      const radLiq = radiusAt(yLiq);
      ctx.beginPath();
      for (let s = 0; s <= 44; s++) {
        const a = (s / 44) * Math.PI * 2;
        const wave = Math.sin(a * 2 + t) * (0.03 + cam.slosh * 0.14);
        const p = rotateEuler(v3(Math.cos(a) * radLiq, yLiq + wave, Math.sin(a) * radLiq), cam.rx, cam.ry);
        const pp = project3D(p, W, H, fov, camDist);
        if (s === 0) ctx.moveTo(pp.sx, pp.sy);
        else ctx.lineTo(pp.sx, pp.sy);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(${lr},${lg},${lb},0.42)`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${lr},${lg},${lb},0.95)`;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Rising 3D Bubbles inside liquid volume
      for (const b of bubbles) {
        b.y += b.sp;
        if (b.y > yLiq - 0.04) b.y = yBottom + 0.05;
        const rMax = radiusAt(b.y) * 0.82;
        const rr = Math.min(rMax, b.rad * rMax);
        const bp = project3D(rotateEuler(v3(Math.cos(b.ang + t * 0.2) * rr, b.y, Math.sin(b.ang + t * 0.2) * rr), cam.rx, cam.ry), W, H, fov, camDist);
        if (bp.visible) {
          ctx.fillStyle = `rgba(${lr},${lg},${lb},0.85)`;
          ctx.beginPath();
          ctx.arc(bp.sx, bp.sy, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [active, fillRatio]);

  return (
    <div
      ref={wrapRef}
      className="rounded-2xl border border-orange-400/25 bg-slate-950/85 p-3 space-y-1.5 select-none"
    >
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-orange-200">🥃 3D Сосуд дозировки</span>
        <span className="font-mono text-slate-300">{label}</span>
      </div>
      <canvas
        ref={canvasRef}
        style={{ height: 165 }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          camRef.current.down = true;
          camRef.current.lx = e.clientX;
          camRef.current.ly = e.clientY;
        }}
        onPointerMove={(e) => {
          if (!camRef.current.down) return;
          const dx = e.clientX - camRef.current.lx;
          const dy = e.clientY - camRef.current.ly;
          camRef.current.lx = e.clientX;
          camRef.current.ly = e.clientY;
          camRef.current.ry += dx * 0.012;
          camRef.current.rx = Math.max(-1.0, Math.min(1.0, camRef.current.rx + dy * 0.012));
          camRef.current.slosh = Math.min(1.2, camRef.current.slosh + Math.abs(dx) * 0.02);
        }}
        onPointerUp={() => {
          camRef.current.down = false;
        }}
        onPointerCancel={() => {
          camRef.current.down = false;
        }}
        className="w-full rounded-xl bg-[#080c16] cursor-grab active:cursor-grabbing touch-none block"
      />
    </div>
  );
};

// ============================================================================
// 8. 3D CIDR NETWORK TOPOLOGY SPHERE (SUBNET CALCULATOR)
// ============================================================================
export const NetworkTopology3D: React.FC<{ cidr: string; usableHosts?: number }> = ({
  cidr,
  usableHosts,
}) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const active = useViewportActive(wrapRef);
  const camRef = useRef({ rx: 0.35, ry: 0.25, down: false, lx: 0, ly: 0 });

  const prefix = useMemo(() => {
    const m = cidr.match(/\/(\d+)/);
    return m ? Math.min(32, Math.max(8, Number(m[1]))) : 24;
  }, [cidr]);

  const nodeCount = useMemo(() => Math.min(42, Math.max(6, (32 - prefix) * 4)), [prefix]);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let pulse = 0;

    const nodes = Array.from({ length: nodeCount }, (_, i) => {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / nodeCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      return {
        x: 1.32 * Math.sin(phi) * Math.cos(theta),
        y: 1.32 * Math.cos(phi),
        z: 1.32 * Math.sin(phi) * Math.sin(theta),
      };
    });

    const render = () => {
      const cvs = canvasRef.current;
      if (!cvs) return;
      const { ctx, W, H } = syncHiDPICanvas(cvs, 460, 165);
      if (!ctx) return;
      pulse += 0.04;
      if (!camRef.current.down) camRef.current.ry += 0.006;

      ctx.fillStyle = '#070b16';
      ctx.fillRect(0, 0, W, H);

      const fov = 235;
      const camDist = 4.2;
      const center = project3D(v3(0, 0, 0), W, H, fov, camDist);

      for (let i = 0; i < nodes.length; i++) {
        const wp = rotateEuler(nodes[i], camRef.current.rx, camRef.current.ry);
        const pp = project3D(wp, W, H, fov, camDist);
        if (!pp.visible) continue;

        ctx.beginPath();
        ctx.moveTo(center.sx, center.sy);
        ctx.lineTo(pp.sx, pp.sy);
        ctx.strokeStyle = i === Math.floor(pulse * 3) % nodes.length
          ? 'rgba(56,189,248,0.85)'
          : 'rgba(99,102,241,0.22)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.fillStyle = wp.z > 0 ? '#818cf8' : 'rgba(129,140,248,0.45)';
        ctx.beginPath();
        ctx.arc(pp.sx, pp.sy, Math.max(2.5, pp.scale * 0.048), 0, Math.PI * 2);
        ctx.fill();
      }

      // Gateway Core Router
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(center.sx, center.sy, 8, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [active, nodeCount]);

  return (
    <div ref={wrapRef} className="rounded-xl border border-indigo-500/25 bg-slate-950/90 p-3 space-y-1.5 select-none">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-indigo-300">🌐 3D Топология подсети /{prefix}</span>
        {usableHosts !== undefined && (
          <span className="font-mono text-emerald-300">Хостов: {usableHosts}</span>
        )}
      </div>
      <canvas
        ref={canvasRef}
        style={{ height: 165 }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          camRef.current.down = true;
          camRef.current.lx = e.clientX;
          camRef.current.ly = e.clientY;
        }}
        onPointerMove={(e) => {
          if (!camRef.current.down) return;
          const dx = e.clientX - camRef.current.lx;
          const dy = e.clientY - camRef.current.ly;
          camRef.current.lx = e.clientX;
          camRef.current.ly = e.clientY;
          camRef.current.ry += dx * 0.012;
          camRef.current.rx = Math.max(-1.2, Math.min(1.2, camRef.current.rx + dy * 0.012));
        }}
        onPointerUp={() => {
          camRef.current.down = false;
        }}
        onPointerCancel={() => {
          camRef.current.down = false;
        }}
        className="w-full rounded-lg bg-[#070b16] cursor-grab active:cursor-grabbing touch-none block"
      />
    </div>
  );
};

// ============================================================================
// 9. 3D TOROIDAL HABIT STREAK REACTOR (WORKSPACE HABITS)
// ============================================================================
export const HabitRing3D: React.FC<{ doneCount: number; totalCount: number }> = ({
  doneCount,
  totalCount,
}) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const active = useViewportActive(wrapRef);
  const torus = useMemo(() => createTorus(0.92, 0.28, 18, 10), []);
  const camRef = useRef({ rx: 0.68, ry: 0.3, down: false, lx: 0, ly: 0 });

  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let spin = 0;

    const render = () => {
      const cvs = canvasRef.current;
      if (!cvs) return;
      const { ctx, W, H } = syncHiDPICanvas(cvs, 460, 145);
      if (!ctx) return;
      spin += 0.01;
      if (!camRef.current.down) camRef.current.ry += 0.005;

      ctx.fillStyle = '#070d16';
      ctx.fillRect(0, 0, W, H);

      const col = pct >= 80 ? '#10b981' : pct >= 40 ? '#38bdf8' : '#6366f1';
      drawShadedMesh(ctx, torus, camRef.current.rx, camRef.current.ry, spin, W, H, 220, 4.2, col, 0.8);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${pct}%`, W / 2, H / 2);

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [active, pct, torus]);

  return (
    <div ref={wrapRef} className="rounded-xl border border-emerald-500/25 bg-slate-950/85 p-3 space-y-1 select-none">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-emerald-300">💍 3D Кольцо выполнения на сегодня</span>
        <span className="font-mono text-slate-300">
          {doneCount} / {totalCount} привычек
        </span>
      </div>
      <canvas
        ref={canvasRef}
        style={{ height: 145 }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          camRef.current.down = true;
          camRef.current.lx = e.clientX;
          camRef.current.ly = e.clientY;
        }}
        onPointerMove={(e) => {
          if (!camRef.current.down) return;
          const dx = e.clientX - camRef.current.lx;
          const dy = e.clientY - camRef.current.ly;
          camRef.current.lx = e.clientX;
          camRef.current.ly = e.clientY;
          camRef.current.ry += dx * 0.012;
          camRef.current.rx = Math.max(-1.2, Math.min(1.2, camRef.current.rx + dy * 0.012));
        }}
        onPointerUp={() => {
          camRef.current.down = false;
        }}
        onPointerCancel={() => {
          camRef.current.down = false;
        }}
        className="w-full rounded-lg bg-[#070d16] cursor-grab active:cursor-grabbing touch-none block"
      />
    </div>
  );
};

// ============================================================================
// 10. UNIVERSES 3D SCENE: MARVEL ARC REACTOR / DC CRYSTAL / ZITRAKS VOXEL BLOCK
// ============================================================================
export interface Universes3DProps {
  mode: 'marvel' | 'dc' | 'zitraks';
  progressPct?: number;
  subtitle?: string;
}

const ZITRAKS_BLOCK_THEMES = [
  { id: 'num', label: '№01 Цифроблок', top: '#ffffff', side: '#cbd5e1', accent: '#38bdf8', mark: '1' },
  { id: 'tnt', label: '№02 ТНТ-броня', top: '#ef4444', side: '#dc2626', accent: '#fef08a', mark: 'TNT' },
  { id: 'labubu', label: '№06 Лабубу', top: '#f472b6', side: '#ec4899', accent: '#fde047', mark: '★' },
  { id: 'ender', label: '№07 Эндер-сейф', top: '#8b5cf6', side: '#4c1d95', accent: '#34d399', mark: '◈' },
  { id: 'sand', label: '№29 Сандевистан', top: '#eef638', side: '#84cc16', accent: '#22d3ee', mark: '⚡' },
];

export const Universes3DScene: React.FC<Universes3DProps> = ({
  mode,
  progressPct = 0,
  subtitle = '',
}) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const active = useViewportActive(wrapRef);

  const [zmBlockIdx, setZmBlockIdx] = useState(1);
  const [paused, setPaused] = useState(false);

  const camRef = useRef({ rx: 0.46, ry: 0.62, zoom: 1, down: false, lx: 0, ly: 0 });

  const meshes = useMemo(
    () => ({
      outerRing: createTorus(1.18, 0.14, 22, 9),
      innerRing: createTorus(0.74, 0.1, 18, 8),
      coreIcosa: createIcosahedron(0.42),
      dcOcta: createOctahedron(1.08),
      dcInner: createDodecahedron(0.52),
      mcCube: createCube(0.88),
      miniCube: createCube(0.22),
    }),
    []
  );

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let t = 0;

    const stones = [
      { name: 'Space', col: '#38bdf8' },
      { name: 'Mind', col: '#facc15' },
      { name: 'Reality', col: '#ef4444' },
      { name: 'Power', col: '#a855f7' },
      { name: 'Time', col: '#22c55e' },
      { name: 'Soul', col: '#fb923c' },
    ];

    const render = () => {
      const cvs = canvasRef.current;
      if (!cvs) return;
      const { ctx, W, H } = syncHiDPICanvas(cvs, 560, 195);
      if (!ctx) return;

      const speedBoost = 1 + (progressPct / 100) * 0.85;
      if (!paused) {
        t += 0.018 * speedBoost;
        if (!camRef.current.down) {
          camRef.current.ry += 0.0065;
        }
      }

      // Deep themed background gradient
      const bg = ctx.createRadialGradient(W * 0.5, H * 0.5, 10, W * 0.5, H * 0.5, W * 0.62);
      if (mode === 'marvel') {
        bg.addColorStop(0, '#2a0912');
        bg.addColorStop(0.55, '#110710');
        bg.addColorStop(1, '#070912');
      } else if (mode === 'dc') {
        bg.addColorStop(0, '#09203f');
        bg.addColorStop(0.55, '#081226');
        bg.addColorStop(1, '#060913');
      } else {
        bg.addColorStop(0, '#132417');
        bg.addColorStop(0.55, '#0d1512');
        bg.addColorStop(1, '#070a0d');
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const fov = 265 * camRef.current.zoom;
      const camDist = 4.3;
      const { rx, ry } = camRef.current;

      if (mode === 'marvel') {
        // Stark Arc Reactor + 6 Orbiting Infinity Stones
        drawShadedMesh(ctx, meshes.outerRing, rx, ry, t * 0.6, W, H, fov, camDist, '#e23636', 0.82, 'rgba(254,202,202,0.45)');
        drawShadedMesh(ctx, meshes.innerRing, rx + Math.PI * 0.35, ry - t * 0.9, -t * 0.7, W, H, fov, camDist, '#38bdf8', 0.84, 'rgba(186,230,253,0.6)');
        drawShadedMesh(ctx, meshes.coreIcosa, rx + t, ry + t * 1.1, 0, W, H, fov, camDist, '#7dd3fc', 0.92, 'rgba(255,255,255,0.75)');

        stones.forEach((st, idx) => {
          const ang = t * 0.9 + (idx * Math.PI * 2) / stones.length;
          const pos = v3(Math.cos(ang) * 1.58, Math.sin(ang * 1.5) * 0.36, Math.sin(ang) * 1.58);
          const pr = project3D(rotateEuler(pos, rx, ry, 0), W, H, fov, camDist);
          if (pr.visible) {
            const r = Math.max(4.5, pr.scale * 0.11);
            const g = ctx.createRadialGradient(pr.sx, pr.sy, 1, pr.sx, pr.sy, r * 2.5);
            g.addColorStop(0, '#ffffff');
            g.addColorStop(0.35, st.col);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(pr.sx, pr.sy, r * 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      } else if (mode === 'dc') {
        // DC Kryptonian Multiverse Crystal + Golden & Elseworlds Orbits
        drawShadedMesh(ctx, meshes.dcInner, -rx, -ry * 1.3, t, W, H, fov, camDist, '#f7c948', 0.88, 'rgba(254,240,138,0.65)');
        drawShadedMesh(ctx, meshes.dcOcta, rx, ry, t * 0.35, W, H, fov, camDist, '#198cff', 0.58, 'rgba(147,197,253,0.65)');

        const orbitColors = ['#198cff', '#f7c948', '#c084fc'];
        orbitColors.forEach((col, oi) => {
          ctx.beginPath();
          for (let s = 0; s <= 52; s++) {
            const a = (s / 52) * Math.PI * 2;
            const rad = 1.48 + oi * 0.14;
            const p0 = v3(
              Math.cos(a) * rad,
              Math.sin(a) * Math.sin(0.55 + oi * 0.8) * 0.65,
              Math.sin(a) * rad
            );
            const pr = project3D(rotateEuler(p0, rx, ry + t * 0.25 * (oi % 2 ? -1 : 1), oi * 0.6), W, H, fov, camDist);
            if (s === 0) ctx.moveTo(pr.sx, pr.sy);
            else ctx.lineTo(pr.sx, pr.sy);
          }
          ctx.strokeStyle = col;
          ctx.globalAlpha = 0.62;
          ctx.lineWidth = 1.6;
          ctx.stroke();
          ctx.globalAlpha = 1;
        });
      } else {
        // ZitraksMode 3D Minecraft Voxel Block + Floating XP Orbs
        const blk = ZITRAKS_BLOCK_THEMES[zmBlockIdx % ZITRAKS_BLOCK_THEMES.length];
        const cube = meshes.mcCube;
        const transformed = cube.vertices.map((vt) => rotateEuler(vt, rx, ry, 0));
        const projected = transformed.map((vt) => project3D(vt, W, H, fov, camDist));

        const sortedFaces = cube.faces
          .map((f, fIdx) => {
            let cx = 0;
            let cy = 0;
            let cz = 0;
            for (const vi of f) {
              cx += transformed[vi].x;
              cy += transformed[vi].y;
              cz += transformed[vi].z;
            }
            const center = { x: cx / 4, y: cy / 4, z: cz / 4 };
            const e1 = sub3(transformed[f[1]], transformed[f[0]]);
            const e2 = sub3(transformed[f[2]], transformed[f[0]]);
            let normal = cross3(e1, e2);
            if (normal.x * center.x + normal.y * center.y + normal.z * center.z < 0) {
              normal = scale3(normal, -1);
            }
            // Face 2/3 in cube: distinguish top/bottom vs side faces
            const hex = fIdx === 3 ? blk.top : fIdx === 2 ? '#1e293b' : blk.side;
            return { f, fIdx, center, normal, depth: center.z, hex };
          })
          .sort((a, b) => a.depth - b.depth);

        for (const item of sortedFaces) {
          const pts = item.f.map((vi) => projected[vi]);
          if (pts.some((p) => !p.visible)) continue;
          ctx.beginPath();
          ctx.moveTo(pts[0].sx, pts[0].sy);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
          ctx.closePath();
          ctx.fillStyle = shadeBlinnPhong(item.normal, item.center, hexToRgb(item.hex), undefined, 0.96);
          ctx.fill();
          ctx.strokeStyle = 'rgba(15,23,42,0.85)';
          ctx.lineWidth = 2.2;
          ctx.stroke();

          // Pixel stripe / emblem on side faces
          if (item.fIdx !== 2 && item.fIdx !== 3 && item.depth > 0) {
            const midX = (pts[0].sx + pts[1].sx + pts[2].sx + pts[3].sx) * 0.25;
            const midY = (pts[0].sy + pts[1].sy + pts[2].sy + pts[3].sy) * 0.25;
            ctx.fillStyle = blk.accent;
            ctx.font = 'bold 16px "Tiny5", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(blk.mark, midX, midY);
          }
        }

        // Floating Minecraft XP orbs around the block
        for (let i = 0; i < 10; i++) {
          const a = t * 1.05 + (i * Math.PI * 2) / 10;
          const pos = v3(Math.cos(a) * 1.52, Math.sin(t * 2 + i) * 0.45, Math.sin(a) * 1.52);
          const pr = project3D(rotateEuler(pos, rx, ry, 0), W, H, fov, camDist);
          if (pr.visible) {
            const orbCol = i % 2 === 0 ? '#84cc16' : '#facc15';
            const r = Math.max(3.5, pr.scale * 0.085);
            const g = ctx.createRadialGradient(pr.sx, pr.sy, 0.5, pr.sx, pr.sy, r * 2.2);
            g.addColorStop(0, '#ffffff');
            g.addColorStop(0.45, orbCol);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(pr.sx, pr.sy, r * 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // HUD Overlay in corner
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      if (subtitle) {
        ctx.fillText(subtitle, 12, H - 10);
      }

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [active, meshes, mode, paused, progressPct, subtitle, zmBlockIdx]);

  const titleLabel =
    mode === 'marvel'
      ? '🛡️ 3D Дуговой Реактор и Камни Бесконечности'
      : mode === 'dc'
      ? '🦇 3D Кристалл Мультивселенной DC'
      : '⛏️ 3D Блок ZitraksMode и Сферы XP';

  return (
    <div ref={wrapRef} className="rounded-2xl border border-white/10 bg-slate-950/90 p-3 space-y-2 select-none">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-white">{titleLabel}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
            title={paused ? 'Продолжить вращение' : 'Пауза'}
          >
            {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => {
              camRef.current.zoom = Math.min(1.45, camRef.current.zoom + 0.12);
            }}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
            title="Приблизить"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              camRef.current.zoom = Math.max(0.7, camRef.current.zoom - 0.12);
            }}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
            title="Отдалить"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              camRef.current.rx = 0.46;
              camRef.current.ry = 0.62;
              camRef.current.zoom = 1;
            }}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
            title="Сброс ракурса"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {mode === 'zitraks' && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {ZITRAKS_BLOCK_THEMES.map((b, idx) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setZmBlockIdx(idx)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-pixel whitespace-nowrap border transition shrink-0 ${
                zmBlockIdx === idx
                  ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                  : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}

      <canvas
        ref={canvasRef}
        style={{ height: 195 }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          camRef.current.down = true;
          camRef.current.lx = e.clientX;
          camRef.current.ly = e.clientY;
        }}
        onPointerMove={(e) => {
          if (!camRef.current.down) return;
          const dx = e.clientX - camRef.current.lx;
          const dy = e.clientY - camRef.current.ly;
          camRef.current.lx = e.clientX;
          camRef.current.ly = e.clientY;
          camRef.current.ry += dx * 0.011;
          camRef.current.rx = Math.max(-1.35, Math.min(1.35, camRef.current.rx + dy * 0.011));
        }}
        onPointerUp={() => {
          camRef.current.down = false;
        }}
        onPointerCancel={() => {
          camRef.current.down = false;
        }}
        className="w-full rounded-xl cursor-grab active:cursor-grabbing touch-none block"
      />
    </div>
  );
};

// ============================================================================
// 11. UBIQUITOUS MINI 3D HOLOGRAPHIC BADGE FOR EVERY SUB-TOOL & CARD
// ============================================================================
export const Mini3DSceneBadge: React.FC<{
  seed: string;
  color?: string;
  size?: number;
}> = ({ seed, color = '#6366f1', size = 40 }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const active = useViewportActive(wrapRef);
  const boostRef = useRef(0);

  const variant = useMemo(() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const shapes = ['icosa', 'octa', 'torus', 'cube', 'tesseract', 'tetra'] as const;
    return {
      shape: shapes[h % shapes.length],
      phase: (h % 360) * (Math.PI / 180),
      speed: 0.014 + (h % 7) * 0.002,
    };
  }, [seed]);

  const mesh = useMemo(() => {
    switch (variant.shape) {
      case 'octa':
        return createOctahedron(1.22);
      case 'torus':
        return createTorus(0.92, 0.34, 14, 8);
      case 'cube':
        return createCube(1.18);
      case 'tetra':
        return createTetrahedron(1.28);
      default:
        return createIcosahedron(1.18);
    }
  }, [variant.shape]);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let t = variant.phase;

    const render = () => {
      const cvs = canvasRef.current;
      if (!cvs) return;
      const { ctx, W, H } = syncHiDPICanvas(cvs, size, size);
      if (!ctx) return;

      const motionScale = variant.shape === 'tesseract' ? 0.18 : 1;
      t += (variant.speed + boostRef.current) * motionScale;
      boostRef.current *= 0.92;

      ctx.clearRect(0, 0, W, H);
      const [r, g, b] = hexToRgb(color);
      const grad = ctx.createRadialGradient(W * 0.5, H * 0.5, 2, W * 0.5, H * 0.5, W * 0.5);
      grad.addColorStop(0, `rgba(${r},${g},${b},0.28)`);
      grad.addColorStop(1, 'rgba(6,10,22,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      if (variant.shape === 'tesseract') {
        const pts = projectTesseract4DTo3D(t, t * 0.7, t * 0.4, 0.72).map((p) =>
          project3D(rotateEuler(p, 0.45, t * 0.8), W, H, size * 1.45, 4.1)
        );
        ctx.strokeStyle = `rgba(${r},${g},${b},0.88)`;
        ctx.lineWidth = 1.05;
        for (const [a, c] of TESSERACT_EDGES) {
          if (!pts[a].visible || !pts[c].visible) continue;
          ctx.beginPath();
          ctx.moveTo(pts[a].sx, pts[a].sy);
          ctx.lineTo(pts[c].sx, pts[c].sy);
          ctx.stroke();
        }
      } else {
        drawShadedMesh(
          ctx,
          mesh,
          0.48 + Math.sin(t * 0.6) * 0.25,
          t,
          t * 0.35,
          W,
          H,
          size * 1.38,
          4.1,
          color,
          0.84,
          'rgba(255,255,255,0.42)'
        );
      }

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [active, color, mesh, size, variant]);

  return (
    <div
      ref={wrapRef}
      onPointerEnter={() => {
        boostRef.current = 0.085;
      }}
      onClick={() => {
        boostRef.current = 0.14;
      }}
      style={{ width: size, height: size }}
      className="rounded-xl bg-slate-950/85 border border-white/10 shrink-0 overflow-hidden shadow-inner cursor-pointer"
      title="Интерактивная 3D-проекция"
    >
      <canvas ref={canvasRef} style={{ width: size, height: size }} className="block" />
    </div>
  );
};

// ============================================================================
// 12. 3D REAL-SCALE OBJECT COMPARATOR (FOR ANATOMICAL CALC & GUESS SIZE GAME)
// ============================================================================
export interface ScaleObjectSpec {
  label: string;
  sizeCm: number;
  widthCm?: number;
  shape?: 'anatomical' | 'cylinder' | 'box' | 'card' | 'phone' | 'sphere';
  color: string;
  hideValue?: boolean;
}

export const RealScaleComparison3D: React.FC<{
  leftObj: ScaleObjectSpec;
  rightObj: ScaleObjectSpec;
  title?: string;
  heightPx?: number;
}> = ({ leftObj, rightObj, title = '3D-стенд сравнения в реальном масштабе 1:1', heightPx = 228 }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const active = useViewportActive(wrapRef);
  const camRef = useRef({ rx: 0.28, ry: -0.36, down: false, lx: 0, ly: 0 });

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let spin = 0;

    const buildShapedMesh = (spec: ScaleObjectSpec, normScale: number): Mesh3D[] => {
      const h = Math.max(0.22, spec.sizeCm * normScale);
      const w = Math.max(0.16, (spec.widthCm || spec.sizeCm * 0.28) * normScale);

      if (spec.shape === 'anatomical') {
        // Stylized humorous 3D rocket-totem sculpture (base spheres + column + dome)
        const shaft = createCylinder(w * 0.44, w * 0.48, h * 0.78, 16);
        const tip = createCylinder(w * 0.14, w * 0.52, h * 0.26, 16);
        const shiftShaft: Mesh3D = {
          ...shaft,
          vertices: shaft.vertices.map((v) => ({ x: v.x, y: v.y - h * 0.08, z: v.z })),
        };
        const shiftTip: Mesh3D = {
          ...tip,
          vertices: tip.vertices.map((v) => ({ x: v.x, y: v.y + h * 0.42, z: v.z })),
        };
        const baseL = createIcosahedron(w * 0.46);
        const baseR = createIcosahedron(w * 0.46);
        return [
          {
            ...baseL,
            vertices: baseL.vertices.map((v) => ({ x: v.x - w * 0.36, y: v.y - h * 0.42, z: v.z + w * 0.12 })),
          },
          {
            ...baseR,
            vertices: baseR.vertices.map((v) => ({ x: v.x + w * 0.36, y: v.y - h * 0.42, z: v.z + w * 0.12 })),
          },
          shiftShaft,
          shiftTip,
        ];
      }
      if (spec.shape === 'cylinder') {
        return [createCylinder(w * 0.5, w * 0.5, h, 18)];
      }
      if (spec.shape === 'sphere') {
        return [createIcosahedron(h * 0.5)];
      }
      if (spec.shape === 'card' || spec.shape === 'phone') {
        return [createBox(w, h, Math.max(0.06, w * 0.12))];
      }
      return [createBox(w, h, w * 0.65)];
    };

    const render = () => {
      const cvs = canvasRef.current;
      if (!cvs) return;
      const { ctx, W, H } = syncHiDPICanvas(cvs, 540, heightPx);
      if (!ctx) return;

      spin += 0.008;
      const ry = camRef.current.down ? camRef.current.ry : camRef.current.ry + Math.sin(spin) * 0.24;
      const rx = camRef.current.rx;

      ctx.fillStyle = '#060a15';
      ctx.fillRect(0, 0, W, H);

      const fov = 250;
      const camDist = 4.6;
      const floorY = -1.02;

      // 3D metric calibration grid on floor
      ctx.strokeStyle = 'rgba(56,189,248,0.14)';
      ctx.lineWidth = 1;
      for (let gx = -2.2; gx <= 2.21; gx += 0.44) {
        const p1 = project3D(rotateEuler(v3(gx, floorY, -1.4), rx, ry), W, H, fov, camDist);
        const p2 = project3D(rotateEuler(v3(gx, floorY, 1.4), rx, ry), W, H, fov, camDist);
        if (p1.visible && p2.visible) {
          ctx.beginPath();
          ctx.moveTo(p1.sx, p1.sy);
          ctx.lineTo(p2.sx, p2.sy);
          ctx.stroke();
        }
      }
      for (let gz = -1.4; gz <= 1.41; gz += 0.46) {
        const p1 = project3D(rotateEuler(v3(-2.2, floorY, gz), rx, ry), W, H, fov, camDist);
        const p2 = project3D(rotateEuler(v3(2.2, floorY, gz), rx, ry), W, H, fov, camDist);
        if (p1.visible && p2.visible) {
          ctx.beginPath();
          ctx.moveTo(p1.sx, p1.sy);
          ctx.lineTo(p2.sx, p2.sy);
          ctx.stroke();
        }
      }

      const maxCm = Math.max(leftObj.sizeCm, rightObj.sizeCm, 1);
      const normScale = 1.75 / maxCm;

      const drawSpecAt = (spec: ScaleObjectSpec, offsetX: number) => {
        const parts = buildShapedMesh(spec, normScale);
        const h3d = Math.max(0.22, spec.sizeCm * normScale);
        const centerY = floorY + h3d * 0.5;

        for (const part of parts) {
          const shifted: Mesh3D = {
            ...part,
            vertices: part.vertices.map((v) => ({
              x: v.x + offsetX,
              y: v.y + centerY,
              z: v.z,
            })),
          };
          drawShadedMesh(ctx, shifted, rx, ry, 0, W, H, fov, camDist, spec.color, 0.88);
        }

        // Laser height ruler bracket & crisp label
        const topP = project3D(rotateEuler(v3(offsetX, floorY + h3d + 0.12, 0), rx, ry), W, H, fov, camDist);
        const botP = project3D(rotateEuler(v3(offsetX, floorY - 0.14, 0), rx, ry), W, H, fov, camDist);
        if (topP.visible) {
          ctx.font = '700 11px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#f8fafc';
          const sizeTxt = spec.hideValue
            ? '? см'
            : spec.sizeCm >= 100
            ? `${(spec.sizeCm / 100).toFixed(2)} м`
            : `${spec.sizeCm.toFixed(1)} см`;
          ctx.fillText(sizeTxt, topP.sx, Math.max(16, topP.sy - 6));
        }
        if (botP.visible) {
          ctx.font = '600 11px "Rubik", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#cbd5e1';
          ctx.fillText(spec.label.slice(0, 26), botP.sx, Math.min(H - 8, botP.sy + 12));
        }
      };

      drawSpecAt(leftObj, -0.95);
      drawSpecAt(rightObj, 0.95);

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [active, leftObj, rightObj, heightPx]);

  return (
    <div
      ref={wrapRef}
      className="rounded-2xl border border-indigo-500/25 bg-slate-950/90 p-3 space-y-2 select-none"
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-indigo-200">{title}</span>
        <span className="text-[10px] text-slate-400">Вращайте мышью / пальцем</span>
      </div>
      <canvas
        ref={canvasRef}
        style={{ height: heightPx }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          camRef.current.down = true;
          camRef.current.lx = e.clientX;
          camRef.current.ly = e.clientY;
        }}
        onPointerMove={(e) => {
          if (!camRef.current.down) return;
          const dx = e.clientX - camRef.current.lx;
          const dy = e.clientY - camRef.current.ly;
          camRef.current.lx = e.clientX;
          camRef.current.ly = e.clientY;
          camRef.current.ry += dx * 0.012;
          camRef.current.rx = Math.max(-0.85, Math.min(1.05, camRef.current.rx + dy * 0.011));
        }}
        onPointerUp={() => {
          camRef.current.down = false;
        }}
        onPointerCancel={() => {
          camRef.current.down = false;
        }}
        className="w-full rounded-xl bg-[#060a15] border border-white/[0.06] cursor-grab active:cursor-grabbing touch-none block"
      />
    </div>
  );
};




