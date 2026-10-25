import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Atom, BookOpen, CalendarClock, Infinity as InfinityIcon, Orbit, Search } from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api';
import { project3D, rotateEuler, syncHiDPICanvas, useCanvasVisibility } from '../../lib/engine3d';
import { Mini3DSceneBadge } from '../three/Interactive3DScenes';

// Compact 118 IUPAC Periodic Table Dataset (Symbol, RU Name, Mass, Group, Period, Category)
const ELEMENTS_118: Array<[number, string, string, number, number, number, string]> = [
  [1, 'H', 'Водород', 1.008, 1, 1, 'nonmetal'], [2, 'He', 'Гелий', 4.0026, 18, 1, 'noble'],
  [3, 'Li', 'Литий', 6.94, 1, 2, 'alkali'], [4, 'Be', 'Бериллий', 9.0122, 2, 2, 'alkaline'],
  [5, 'B', 'Бор', 10.81, 13, 2, 'metalloid'], [6, 'C', 'Углерод', 12.011, 14, 2, 'nonmetal'],
  [7, 'N', 'Азот', 14.007, 15, 2, 'nonmetal'], [8, 'O', 'Кислород', 15.999, 16, 2, 'nonmetal'],
  [9, 'F', 'Фтор', 18.998, 17, 2, 'halogen'], [10, 'Ne', 'Неон', 20.18, 18, 2, 'noble'],
  [11, 'Na', 'Натрий', 22.99, 1, 3, 'alkali'], [12, 'Mg', 'Магний', 24.305, 2, 3, 'alkaline'],
  [13, 'Al', 'Алюминий', 26.982, 13, 3, 'post'], [14, 'Si', 'Кремний', 28.085, 14, 3, 'metalloid'],
  [15, 'P', 'Фосфор', 30.974, 15, 3, 'nonmetal'], [16, 'S', 'Сера', 32.06, 16, 3, 'nonmetal'],
  [17, 'Cl', 'Хлор', 35.45, 17, 3, 'halogen'], [18, 'Ar', 'Аргон', 39.948, 18, 3, 'noble'],
  [19, 'K', 'Калий', 39.098, 1, 4, 'alkali'], [20, 'Ca', 'Кальций', 40.078, 2, 4, 'alkaline'],
  [21, 'Sc', 'Скандий', 44.956, 3, 4, 'transition'], [22, 'Ti', 'Титан', 47.867, 4, 4, 'transition'],
  [23, 'V', 'Ванадий', 50.942, 5, 4, 'transition'], [24, 'Cr', 'Хром', 51.996, 6, 4, 'transition'],
  [25, 'Mn', 'Марганец', 54.938, 7, 4, 'transition'], [26, 'Fe', 'Железо', 55.845, 8, 4, 'transition'],
  [27, 'Co', 'Кобальт', 58.933, 9, 4, 'transition'], [28, 'Ni', 'Никель', 58.693, 10, 4, 'transition'],
  [29, 'Cu', 'Медь', 63.546, 11, 4, 'transition'], [30, 'Zn', 'Цинк', 65.38, 12, 4, 'transition'],
  [31, 'Ga', 'Галлий', 69.723, 13, 4, 'post'], [32, 'Ge', 'Германий', 72.63, 14, 4, 'metalloid'],
  [33, 'As', 'Мышьяк', 74.922, 15, 4, 'metalloid'], [34, 'Se', 'Селен', 78.971, 16, 4, 'nonmetal'],
  [35, 'Br', 'Бром', 79.904, 17, 4, 'halogen'], [36, 'Kr', 'Криптон', 83.798, 18, 4, 'noble'],
  [37, 'Rb', 'Рубидий', 85.468, 1, 5, 'alkali'], [38, 'Sr', 'Стронций', 87.62, 2, 5, 'alkaline'],
  [39, 'Y', 'Иттрий', 88.906, 3, 5, 'transition'], [40, 'Zr', 'Цирконий', 91.224, 4, 5, 'transition'],
  [41, 'Nb', 'Ниобий', 92.906, 5, 5, 'transition'], [42, 'Mo', 'Молибден', 95.95, 6, 5, 'transition'],
  [43, 'Tc', 'Технеций', 98, 7, 5, 'transition'], [44, 'Ru', 'Рутений', 101.07, 8, 5, 'transition'],
  [45, 'Rh', 'Родий', 102.91, 9, 5, 'transition'], [46, 'Pd', 'Палладий', 106.42, 10, 5, 'transition'],
  [47, 'Ag', 'Серебро', 107.87, 11, 5, 'transition'], [48, 'Cd', 'Кадмий', 112.41, 12, 5, 'transition'],
  [49, 'In', 'Индий', 114.82, 13, 5, 'post'], [50, 'Sn', 'Олово', 118.71, 14, 5, 'post'],
  [51, 'Sb', 'Сурьма', 121.76, 15, 5, 'metalloid'], [52, 'Te', 'Теллур', 127.6, 16, 5, 'metalloid'],
  [53, 'I', 'Йод', 126.9, 17, 5, 'halogen'], [54, 'Xe', 'Ксенон', 131.29, 18, 5, 'noble'],
  [55, 'Cs', 'Цезий', 132.91, 1, 6, 'alkali'], [56, 'Ba', 'Барий', 137.33, 2, 6, 'alkaline'],
  [57, 'La', 'Лантан', 138.91, 3, 9, 'lanth'], [58, 'Ce', 'Церий', 140.12, 4, 9, 'lanth'],
  [59, 'Pr', 'Празеодим', 140.91, 5, 9, 'lanth'], [60, 'Nd', 'Неодим', 144.24, 6, 9, 'lanth'],
  [61, 'Pm', 'Прометий', 145, 7, 9, 'lanth'], [62, 'Sm', 'Самарий', 150.36, 8, 9, 'lanth'],
  [63, 'Eu', 'Европий', 151.96, 9, 9, 'lanth'], [64, 'Gd', 'Гадолиний', 157.25, 10, 9, 'lanth'],
  [65, 'Tb', 'Тербий', 158.93, 11, 9, 'lanth'], [66, 'Dy', 'Диспрозий', 162.5, 12, 9, 'lanth'],
  [67, 'Ho', 'Гольмий', 164.93, 13, 9, 'lanth'], [68, 'Er', 'Эрбий', 167.26, 14, 9, 'lanth'],
  [69, 'Tm', 'Тулий', 168.93, 15, 9, 'lanth'], [70, 'Yb', 'Иттербий', 173.05, 16, 9, 'lanth'],
  [71, 'Lu', 'Лютеций', 174.97, 17, 9, 'lanth'], [72, 'Hf', 'Гафний', 178.49, 4, 6, 'transition'],
  [73, 'Ta', 'Тантал', 180.95, 5, 6, 'transition'], [74, 'W', 'Вольфрам', 183.84, 6, 6, 'transition'],
  [75, 'Re', 'Рений', 186.21, 7, 6, 'transition'], [76, 'Os', 'Осмий', 190.23, 8, 6, 'transition'],
  [77, 'Ir', 'Иридий', 192.22, 9, 6, 'transition'], [78, 'Pt', 'Платина', 195.08, 10, 6, 'transition'],
  [79, 'Au', 'Золото', 196.97, 11, 6, 'transition'], [80, 'Hg', 'Ртуть', 200.59, 12, 6, 'transition'],
  [81, 'Tl', 'Таллий', 204.38, 13, 6, 'post'], [82, 'Pb', 'Свинец', 207.2, 14, 6, 'post'],
  [83, 'Bi', 'Висмут', 208.98, 15, 6, 'post'], [84, 'Po', 'Полоний', 209, 16, 6, 'post'],
  [85, 'At', 'Астат', 210, 17, 6, 'halogen'], [86, 'Rn', 'Радон', 222, 18, 6, 'noble'],
  [87, 'Fr', 'Франций', 223, 1, 7, 'alkali'], [88, 'Ra', 'Радий', 226, 2, 7, 'alkaline'],
  [89, 'Ac', 'Актиний', 227, 3, 10, 'actin'], [90, 'Th', 'Торий', 232.04, 4, 10, 'actin'],
  [91, 'Pa', 'Протактиний', 231.04, 5, 10, 'actin'], [92, 'U', 'Уран', 238.03, 6, 10, 'actin'],
  [93, 'Np', 'Нептуний', 237, 7, 10, 'actin'], [94, 'Pu', 'Плутоний', 244, 8, 10, 'actin'],
  [95, 'Am', 'Америций', 243, 9, 10, 'actin'], [96, 'Cm', 'Кюрий', 247, 10, 10, 'actin'],
  [97, 'Bk', 'Берклий', 247, 11, 10, 'actin'], [98, 'Cf', 'Калифорний', 251, 12, 10, 'actin'],
  [99, 'Es', 'Эйнштейний', 252, 13, 10, 'actin'], [100, 'Fm', 'Фермий', 257, 14, 10, 'actin'],
  [101, 'Md', 'Менделевий', 258, 15, 10, 'actin'], [102, 'No', 'Нобелий', 259, 16, 10, 'actin'],
  [103, 'Lr', 'Лоуренсий', 266, 17, 10, 'actin'], [104, 'Rf', 'Резерфордий', 267, 4, 7, 'transition'],
  [105, 'Db', 'Дубний', 268, 5, 7, 'transition'], [106, 'Sg', 'Сиборгий', 269, 6, 7, 'transition'],
  [107, 'Bh', 'Борий', 270, 7, 7, 'transition'], [108, 'Hs', 'Хассий', 277, 8, 7, 'transition'],
  [109, 'Mt', 'Мейтнерий', 278, 9, 7, 'transition'], [110, 'Ds', 'Дармштадтий', 281, 10, 7, 'transition'],
  [111, 'Rg', 'Рентгений', 282, 11, 7, 'transition'], [112, 'Cn', 'Коперниций', 285, 12, 7, 'transition'],
  [113, 'Nh', 'Нихоний', 286, 13, 7, 'post'], [114, 'Fl', 'Флеровий', 289, 14, 7, 'post'],
  [115, 'Mc', 'Московий', 290, 15, 7, 'post'], [116, 'Lv', 'Ливерморий', 293, 16, 7, 'post'],
  [117, 'Ts', 'Теннессин', 294, 17, 7, 'halogen'], [118, 'Og', 'Оганесон', 294, 18, 7, 'noble'],
];

const CAT_COLORS: Record<string, string> = {
  alkali: '#ef4444',
  alkaline: '#f97316',
  transition: '#38bdf8',
  post: '#10b981',
  metalloid: '#14b8a6',
  nonmetal: '#84cc16',
  halogen: '#eab308',
  noble: '#a855f7',
  lanth: '#ec4899',
  actin: '#f43f5e',
};

function safeMathEval(expr: string, x: number, y = 0): number {
  const sanitized = expr
    .toLowerCase()
    .replace(/\^/g, '**')
    .replace(/\bsin\b/g, 'Math.sin')
    .replace(/\bcos\b/g, 'Math.cos')
    .replace(/\btan\b/g, 'Math.tan')
    .replace(/\bsqrt\b/g, 'Math.sqrt')
    .replace(/\babs\b/g, 'Math.abs')
    .replace(/\bexp\b/g, 'Math.exp')
    .replace(/\blog\b/g, 'Math.log')
    .replace(/\bpi\b/g, 'Math.PI');
  if (/[^0-9xyMath\.sincotaqrbexplgPI\+\-\*\/\(\)\,\s]/.test(sanitized)) return 0;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('x', 'y', `return Number(${sanitized});`);
    const v = fn(x, y);
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

export const CosmosMicroMathHub: React.FC<{
  activeTool: string;
  onSelectTool: (t: string) => void;
  onSync: () => void;
}> = ({ activeTool, onSelectTool, onSync }) => {
  const tab = (
    [
      'solar_system_3d',
      'eclipse_comet_tracker',
      'cell_atom_quarks_3d',
      'periodic_table_v6',
      'graph_plotter_2d_3d',
      'irrational_numbers_inf',
      'library_of_babel',
    ] as const
  ).includes(activeTool as any)
    ? activeTool
    : 'solar_system_3d';

  const { wrapRef, visible } = useCanvasVisibility();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Solar System & Eclipses & Micro
  const [bodies, setBodies] = useState<any[]>([]);
  const [selectedPlanet, setSelectedPlanet] = useState<string>('earth');
  const [timeSpeed, setTimeSpeed] = useState<number>(1.0);
  const [eclipses, setEclipses] = useState<any>(null);
  const [microData, setMicroData] = useState<any>(null);
  const [microLayer, setMicroLayer] = useState<'cell' | 'atom' | 'quarks'>('quarks');

  // Periodic Table
  const [selectedZ, setSelectedZ] = useState<number>(79); // Gold Au
  const [elemFilter, setElemFilter] = useState<string>('');

  // 2D / 3D Graph Plotter
  const [plotDim, setPlotDim] = useState<'3d' | '2d'>('3d');
  const [expr2D, setExpr2D] = useState<string>('sin(x) * 2 + 0.3 * x');
  const [expr3D, setExpr3D] = useState<string>('sin(sqrt(x^2 + y^2) * 1.6) * 1.4');

  // Irrational Numbers & Babel
  const [irrConst, setIrrConst] = useState<string>('pi');
  const [irrDigitsCount, setIrrDigitsCount] = useState<number>(900);
  const [irrFind, setIrrFind] = useState<string>('2510');
  const [irrRes, setIrrRes] = useState<any>(null);
  const [babelPage, setBabelPage] = useState<any>(null);
  const [babelQuery, setBabelQuery] = useState<string>('смысл вселенной скрыт в шестигранной библиотеке');
  const [babelHex, setBabelHex] = useState<string>('cosmos-2026-hex-777');
  const [babelPageNum, setBabelPageNum] = useState<number>(42);

  useEffect(() => {
    if (tab === 'solar_system_3d' && bodies.length === 0) {
      apiGet('/api/v6/science/solar-system').then((r) => setBodies(r.bodies || [])).catch(() => {});
    }
    if (tab === 'eclipse_comet_tracker' && !eclipses) {
      apiGet('/api/v6/science/eclipses-comets').then(setEclipses).catch(() => {});
    }
    if (tab === 'cell_atom_quarks_3d' && !microData) {
      apiGet('/api/v6/science/cell-atom-quarks').then(setMicroData).catch(() => {});
    }
  }, [tab]);

  useEffect(() => {
    if (tab === 'irrational_numbers_inf') {
      apiGet(
        `/api/v6/math/irrational?constant=${irrConst}&digits=${irrDigitsCount}&search=${encodeURIComponent(irrFind)}`
      )
        .then(setIrrRes)
        .catch(() => {});
    }
  }, [tab, irrConst, irrDigitsCount, irrFind]);

  useEffect(() => {
    if (tab === 'library_of_babel' && !babelPage) {
      apiGet(`/api/v6/babel/browse?hex_id=${encodeURIComponent(babelHex)}&wall=2&shelf=3&volume=12&page=${babelPageNum}`)
        .then(setBabelPage)
        .catch(() => {});
    }
  }, [tab]);

  // Unified 3D Canvas for Solar System / Bohr Atom / Quarks / 2D & 3D Function Plotter
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs || !visible) return;
    if (!['solar_system_3d', 'periodic_table_v6', 'cell_atom_quarks_3d', 'graph_plotter_2d_3d'].includes(tab)) return;
    let raf = 0;
    let t = 0;

    const render = () => {
      const { ctx, W, H } = syncHiDPICanvas(cvs);
      if (!ctx || W < 40) {
        raf = requestAnimationFrame(render);
        return;
      }
      t += 0.018 * timeSpeed;
      ctx.fillStyle = '#030612';
      ctx.fillRect(0, 0, W, H);
      const fov = Math.min(W, H) * 0.92;
      const cam = 3.4;

      if (tab === 'solar_system_3d') {
        const sunP = project3D({ x: 0, y: 0, z: 0 }, W, H, fov, cam);
        const sg = ctx.createRadialGradient(sunP.sx, sunP.sy, 2, sunP.sx, sunP.sy, 22);
        sg.addColorStop(0, '#fffbeb');
        sg.addColorStop(0.5, '#facc15');
        sg.addColorStop(1, 'rgba(249,115,22,0)');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(sunP.sx, sunP.sy, 22, 0, Math.PI * 2);
        ctx.fill();

        const planets = bodies.filter((b) => b.id !== 'sun');
        planets.forEach((p, idx) => {
          const orbitR = 0.24 + idx * 0.165;
          // Orbit ellipse
          ctx.beginPath();
          for (let s = 0; s <= 48; s++) {
            const ang = (s / 48) * Math.PI * 2;
            const v3 = rotateEuler({ x: Math.cos(ang) * orbitR, y: 0, z: Math.sin(ang) * orbitR }, 0.56, 0.2);
            const pp = project3D(v3, W, H, fov, cam);
            if (s === 0) ctx.moveTo(pp.sx, pp.sy);
            else ctx.lineTo(pp.sx, pp.sy);
          }
          ctx.strokeStyle = p.id === selectedPlanet ? 'rgba(56,189,248,0.65)' : 'rgba(148,163,184,0.18)';
          ctx.lineWidth = p.id === selectedPlanet ? 1.5 : 1;
          ctx.stroke();

          const ang = t * (1.8 / Math.sqrt(idx + 1)) + idx * 1.1;
          const b3 = rotateEuler({ x: Math.cos(ang) * orbitR, y: 0, z: Math.sin(ang) * orbitR }, 0.56, 0.2);
          const bp = project3D(b3, W, H, fov, cam);
          const radPx = Math.max(3.5, Math.min(11, Math.log2((p.radius_km || 2000) / 800 + 2) * 2.4));
          ctx.beginPath();
          ctx.arc(bp.sx, bp.sy, radPx, 0, Math.PI * 2);
          ctx.fillStyle = p.color || '#38bdf8';
          ctx.fill();
          if (p.id === 'saturn') {
            ctx.strokeStyle = 'rgba(253,230,138,0.8)';
            ctx.beginPath();
            ctx.ellipse(bp.sx, bp.sy, radPx * 1.9, radPx * 0.65, 0.3, 0, Math.PI * 2);
            ctx.stroke();
          }
        });
      } else if (tab === 'periodic_table_v6') {
        // 3D Bohr shells for element Z = selectedZ
        const shells: number[] = [];
        let rem = selectedZ;
        for (const cap of [2, 8, 18, 32, 32, 18, 8]) {
          if (rem <= 0) break;
          const take = Math.min(rem, cap);
          shells.push(take);
          rem -= take;
        }
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, 13, 0, Math.PI * 2);
        ctx.fillStyle = '#f43f5e';
        ctx.fill();

        shells.forEach((elCount, sIdx) => {
          const r = 0.26 + sIdx * 0.16;
          for (let e = 0; e < elCount; e++) {
            const ang = (e / elCount) * Math.PI * 2 + t * (1.5 - sIdx * 0.15);
            const v3 = rotateEuler({ x: Math.cos(ang) * r, y: Math.sin(ang) * r, z: 0 }, sIdx * 0.42, t * 0.25);
            const pp = project3D(v3, W, H, fov, cam);
            ctx.beginPath();
            ctx.arc(pp.sx, pp.sy, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#38bdf8';
            ctx.fill();
          }
        });
      } else if (tab === 'cell_atom_quarks_3d') {
        if (microLayer === 'quarks') {
          // Proton uud + Gluon color flux tubes
          const qPos = [
            { label: 'u (+2/3)', c: '#ef4444', ang: t },
            { label: 'u (+2/3)', c: '#10b981', ang: t + (Math.PI * 2) / 3 },
            { label: 'd (−1/3)', c: '#3b82f6', ang: t + (Math.PI * 4) / 3 },
          ].map((q) => {
            const p = project3D(
              rotateEuler({ x: Math.cos(q.ang) * 0.62, y: Math.sin(q.ang) * 0.62, z: Math.sin(q.ang * 2) * 0.2 }, 0.35, 0.25),
              W,
              H,
              fov,
              cam
            );
            return { ...q, ...p };
          });
          // Gluon springs
          ctx.strokeStyle = 'rgba(250,204,21,0.75)';
          ctx.lineWidth = 2.2;
          for (let i = 0; i < 3; i++) {
            const a = qPos[i];
            const b = qPos[(i + 1) % 3];
            ctx.beginPath();
            ctx.moveTo(a.sx, a.sy);
            ctx.lineTo(b.sx, b.sy);
            ctx.stroke();
          }
          for (const q of qPos) {
            ctx.beginPath();
            ctx.arc(q.sx, q.sy, 18, 0, Math.PI * 2);
            ctx.fillStyle = q.c;
            ctx.fill();
            ctx.font = '700 10px "JetBrains Mono", monospace';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(q.label, q.sx - 20, q.sy - 24);
          }
        } else {
          // 3D Cell / Atom cross-section spheres
          for (let ring = 0; ring < 4; ring++) {
            const rad = 0.28 + ring * 0.24;
            ctx.beginPath();
            for (let s = 0; s <= 40; s++) {
              const a = (s / 40) * Math.PI * 2;
              const p = project3D(
                rotateEuler({ x: Math.cos(a) * rad, y: Math.sin(a) * rad, z: 0 }, ring * 0.5 + t * 0.3, t * 0.4),
                W,
                H,
                fov,
                cam
              );
              if (s === 0) ctx.moveTo(p.sx, p.sy);
              else ctx.lineTo(p.sx, p.sy);
            }
            ctx.strokeStyle = microLayer === 'cell' ? 'rgba(52,211,153,0.65)' : 'rgba(56,189,248,0.65)';
            ctx.stroke();
          }
        }
      } else if (tab === 'graph_plotter_2d_3d') {
        if (plotDim === '2d') {
          const scalePx = Math.min(W, H) / 14;
          ctx.strokeStyle = 'rgba(148,163,184,0.2)';
          ctx.lineWidth = 1;
          for (let g = -10; g <= 10; g++) {
            ctx.beginPath();
            ctx.moveTo(W / 2 + g * scalePx, 0);
            ctx.lineTo(W / 2 + g * scalePx, H);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, H / 2 + g * scalePx);
            ctx.lineTo(W, H / 2 + g * scalePx);
            ctx.stroke();
          }
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.beginPath();
          ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2);
          ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H);
          ctx.stroke();

          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          let started = false;
          for (let px = 0; px <= W; px += 2) {
            const x = (px - W / 2) / scalePx;
            const y = safeMathEval(expr2D, x, 0);
            const py = H / 2 - y * scalePx;
            if (py >= -200 && py <= H + 200) {
              if (!started) { ctx.moveTo(px, py); started = true; }
              else ctx.lineTo(px, py);
            } else {
              started = false;
            }
          }
          ctx.stroke();
        } else {
          // 3D Surface z = f(x, y) mesh
          const N = 22;
          const span = 4.0;
          const ry = t * 0.25;
          const rx = 0.58;
          for (let i = 0; i < N; i++) {
            ctx.beginPath();
            for (let j = 0; j <= N; j++) {
              const x = -span + (i / N) * span * 2;
              const y = -span + (j / N) * span * 2;
              const z = Math.max(-2.5, Math.min(2.5, safeMathEval(expr3D, x, y)));
              const p = project3D(rotateEuler({ x: x * 0.28, y: -z * 0.28, z: y * 0.28 }, rx, ry), W, H, fov, cam);
              if (j === 0) ctx.moveTo(p.sx, p.sy);
              else ctx.lineTo(p.sx, p.sy);
            }
            const hue = Math.round(185 + (i / N) * 110);
            ctx.strokeStyle = `hsla(${hue}, 88%, 62%, 0.78)`;
            ctx.lineWidth = 1.3;
            ctx.stroke();
          }
        }
      }

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [visible, tab, bodies, selectedPlanet, timeSpeed, selectedZ, microLayer, plotDim, expr2D, expr3D]);

  const currentElem = useMemo(
    () => ELEMENTS_118.find((e) => e[0] === selectedZ) || ELEMENTS_118[78],
    [selectedZ]
  );

  return (
    <div ref={wrapRef} className="space-y-4 min-w-0">
      <div className="flex flex-wrap gap-1.5">
        {[
          { id: 'solar_system_3d', label: '🪐 3D Солнечная Система' },
          { id: 'eclipse_comet_tracker', label: '🌒 Затмения и Кометы' },
          { id: 'cell_atom_quarks_3d', label: '🧬 Клетка, Атом и Кварки' },
          { id: 'periodic_table_v6', label: '⚛️ Таблица Менделеева (118)' },
          { id: 'graph_plotter_2d_3d', label: '📈 2D и 3D Графики Функций' },
          { id: 'irrational_numbers_inf', label: '♾️ Числа π, φ, e (до 5000 знаков)' },
          { id: 'library_of_babel', label: '🏛️ Вавилонская Библиотека' },
        ].map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => onSelectTool(b.id)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
              tab === b.id
                ? 'bg-cyan-500/25 border-cyan-400 text-cyan-100'
                : 'bg-slate-900 border-white/10 text-slate-300'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* 1. SOLAR SYSTEM 3D */}
      {tab === 'solar_system_3d' && (
        <div className="rounded-2xl bg-slate-900/80 border border-cyan-500/25 p-4 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm sm:text-base font-bold text-white">🪐 3D Симулятор Солнечной Системы и Параметры Планет</h3>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Скорость орбит:</span>
              <input type="range" min={0} max={4} step={0.2} value={timeSpeed} onChange={(e) => setTimeSpeed(Number(e.target.value))} className="w-28 accent-cyan-400" />
            </div>
          </div>
          <canvas ref={canvasRef} style={{ height: 270 }} className="w-full rounded-2xl bg-[#030612] border border-white/10 block" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {bodies.map((b) => (
              <div
                key={b.id}
                onClick={() => setSelectedPlanet(b.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition space-y-1 ${
                  selectedPlanet === b.id ? 'bg-cyan-950/45 border-cyan-400' : 'bg-slate-950/90 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-white">{b.name}</span>
                  <span className="text-[10px] font-mono text-cyan-300">{b.type}</span>
                </div>
                <div className="font-mono text-[11px] text-amber-300">
                  R = {b.radius_km.toLocaleString('ru-RU')} км • g = {b.gravity_ms2} м/с² • Спутников: {b.moons}
                </div>
                <div className="text-slate-400 text-[11px]">Орбита: {b.dist_au} а.е. ({b.temp_c} °C)</div>
                <p className="text-slate-300 leading-relaxed pt-0.5">{b.fact}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. ECLIPSE & COMET TRACKER */}
      {tab === 'eclipse_comet_tracker' && eclipses && (
        <div className="rounded-2xl bg-slate-900/80 border border-indigo-500/25 p-4 space-y-4 text-xs">
          <h3 className="text-sm sm:text-base font-bold text-white">
            🌒 Обратный Отсчёт до Затмений, Комет и Потоков (от 25.10.2026)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(eclipses.events || []).map((ev: any) => (
              <div key={ev.id} className="p-4 rounded-xl bg-slate-950/90 border border-indigo-400/25 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-white text-sm">{ev.title}</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200 font-mono font-bold shrink-0">
                    {ev.countdown_label}
                  </span>
                </div>
                <div className="font-mono text-indigo-300">{ev.kind} • {ev.date_utc.slice(0, 10)}</div>
                <div className="text-sky-300">Видимость: {ev.visibility}</div>
                <p className="text-slate-300 leading-relaxed">{ev.details}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. CELL, ATOM & QUARKS */}
      {tab === 'cell_atom_quarks_3d' && microData && (
        <div className="rounded-2xl bg-slate-900/80 border border-emerald-500/25 p-4 space-y-4 text-xs">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'cell', label: '🦠 Строение Эукариотической Клетки' },
              { id: 'atom', label: '⚛️ Строение Атома и Ядра' },
              { id: 'quarks', label: '✨ Кварки и Бозоны Стандартной Модели' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMicroLayer(m.id as any)}
                className={`px-3 py-1.5 rounded-xl font-semibold border ${
                  microLayer === m.id ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100' : 'bg-slate-950 border-white/10 text-slate-300'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <canvas ref={canvasRef} style={{ height: 220 }} className="w-full rounded-2xl bg-[#030612] border border-white/10 block" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(microData[microLayer] || []).map((item: any) => (
              <div key={item.name} className="p-3.5 rounded-xl bg-slate-950 border border-white/10 space-y-1">
                <div className="font-bold text-white flex justify-between gap-2">
                  <span>{item.name}</span>
                  <span className="font-mono text-emerald-300 shrink-0">{item.scale}</span>
                </div>
                <p className="text-slate-300 leading-relaxed">{item.role}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. PERIODIC TABLE OF ALL 118 ELEMENTS */}
      {tab === 'periodic_table_v6' && (
        <div className="rounded-2xl bg-slate-900/80 border border-sky-500/25 p-4 space-y-4 text-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-7 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-2xl font-black text-white mr-2">
                    {currentElem[0]} • {currentElem[1]} — {currentElem[2]}
                  </span>
                  <span className="font-mono text-amber-300">Атомная масса: {currentElem[3]} а.е.м.</span>
                </div>
                <input
                  value={elemFilter}
                  onChange={(e) => setElemFilter(e.target.value)}
                  placeholder="Поиск элемента (Au, Золото, 79)..."
                  className="rounded-xl bg-slate-950 border border-white/15 px-3 py-1.5 text-white"
                />
              </div>
              <p className="text-slate-300">
                Группа: <b>{currentElem[4]}</b> • Период: <b>{currentElem[5] > 7 ? (currentElem[5] === 9 ? '6 (Лантаноид)' : '7 (Актиноид)') : currentElem[5]}</b> • Нажмите на любую ячейку ниже для 3D-разбора электронных оболочек Бора!
              </p>
            </div>
            <div className="lg:col-span-5">
              <canvas ref={canvasRef} style={{ height: 155 }} className="w-full rounded-xl bg-[#030612] border border-white/10 block" />
            </div>
          </div>

          <div className="overflow-x-auto pb-2">
            <div
              className="grid gap-1 min-w-[780px]"
              style={{ gridTemplateColumns: 'repeat(18, minmax(38px, 1fr))' }}
            >
              {Array.from({ length: 10 }).map((_, rIdx) => {
                const period = rIdx + 1;
                if (period === 8) return <div key="gap" className="col-span-18 h-2" />;
                return Array.from({ length: 18 }).map((__, cIdx) => {
                  const group = cIdx + 1;
                  const el = ELEMENTS_118.find((x) => x[5] === period && x[4] === group);
                  if (!el) return <div key={`${period}-${group}`} />;
                  const matches =
                    !elemFilter.trim() ||
                    `${el[0]} ${el[1]} ${el[2]}`.toLowerCase().includes(elemFilter.trim().toLowerCase());
                  const col = CAT_COLORS[el[6]] || '#38bdf8';
                  return (
                    <button
                      key={el[0]}
                      type="button"
                      onClick={() => setSelectedZ(el[0])}
                      style={{
                        borderColor: selectedZ === el[0] ? '#ffffff' : `${col}66`,
                        backgroundColor: selectedZ === el[0] ? `${col}44` : 'rgba(2,6,23,0.9)',
                        opacity: matches ? 1 : 0.22,
                      }}
                      className="p-1 rounded-lg border text-left transition hover:scale-105"
                      title={`${el[0]} ${el[2]} (${el[3]})`}
                    >
                      <div className="text-[8px] font-mono text-slate-400 leading-none">{el[0]}</div>
                      <div className="text-xs font-black leading-tight" style={{ color: col }}>
                        {el[1]}
                      </div>
                      <div className="text-[7.5px] text-slate-300 truncate leading-none">{el[2]}</div>
                    </button>
                  );
                });
              })}
            </div>
          </div>
        </div>
      )}

      {/* 5. 2D & 3D GRAPH PLOTTER */}
      {tab === 'graph_plotter_2d_3d' && (
        <div className="rounded-2xl bg-slate-900/80 border border-sky-500/25 p-4 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setPlotDim('3d')}
                className={`px-3 py-1.5 rounded-xl font-bold border ${
                  plotDim === '3d' ? 'bg-sky-500/25 border-sky-400 text-sky-100' : 'bg-slate-950 border-white/10 text-slate-300'
                }`}
              >
                🧊 3D Поверхность z = f(x, y)
              </button>
              <button
                type="button"
                onClick={() => setPlotDim('2d')}
                className={`px-3 py-1.5 rounded-xl font-bold border ${
                  plotDim === '2d' ? 'bg-sky-500/25 border-sky-400 text-sky-100' : 'bg-slate-950 border-white/10 text-slate-300'
                }`}
              >
                📐 2D Система Координат y = f(x)
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {plotDim === '3d' ? (
                <>
                  <button type="button" onClick={() => setExpr3D('sin(sqrt(x^2 + y^2) * 1.6) * 1.4')} className="px-2.5 py-1 rounded bg-white/5 text-slate-300">Круговая волна</button>
                  <button type="button" onClick={() => setExpr3D('0.18 * (x^2 - y^2)')} className="px-2.5 py-1 rounded bg-white/5 text-slate-300">Гиперболическое седло</button>
                  <button type="button" onClick={() => setExpr3D('sin(x) * cos(y) * 1.5')} className="px-2.5 py-1 rounded bg-white/5 text-slate-300">Решётка sin·cos</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setExpr2D('sin(x) * 2 + 0.3 * x')} className="px-2.5 py-1 rounded bg-white/5 text-slate-300">Волна + тренд</button>
                  <button type="button" onClick={() => setExpr2D('0.25 * x^2 - 2')} className="px-2.5 py-1 rounded bg-white/5 text-slate-300">Парабола</button>
                  <button type="button" onClick={() => setExpr2D('sin(x * 3) / (abs(x) + 0.4) * 3')} className="px-2.5 py-1 rounded bg-white/5 text-slate-300">Пакет sinc</button>
                </>
              )}
            </div>
          </div>

          <input
            value={plotDim === '3d' ? expr3D : expr2D}
            onChange={(e) => (plotDim === '3d' ? setExpr3D(e.target.value) : setExpr2D(e.target.value))}
            className="w-full rounded-xl bg-slate-950 border border-white/15 px-3.5 py-2 font-mono text-sm text-emerald-300"
          />

          <canvas ref={canvasRef} style={{ height: 320 }} className="w-full rounded-2xl bg-[#030612] border border-white/10 block" />
        </div>
      )}

      {/* 6. INFINITE IRRATIONAL NUMBERS */}
      {tab === 'irrational_numbers_inf' && (
        <div className="rounded-2xl bg-slate-900/80 border border-purple-500/25 p-4 space-y-4 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'pi', label: 'π (Пи)' },
              { id: 'phi', label: 'φ (Золотое сечение)' },
              { id: 'e', label: 'e (Эйлера)' },
              { id: 'sqrt2', label: '√2 (Пифагора)' },
              { id: 'sqrt3', label: '√3 (Феодора)' },
              { id: 'ln2', label: 'ln(2)' },
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setIrrConst(c.id)}
                className={`px-3 py-1.5 rounded-xl font-bold border ${
                  irrConst === c.id ? 'bg-purple-500/25 border-purple-400 text-purple-100' : 'bg-slate-950 border-white/10 text-slate-300'
                }`}
              >
                {c.label}
              </button>
            ))}
            <select
              value={irrDigitsCount}
              onChange={(e) => setIrrDigitsCount(Number(e.target.value))}
              className="rounded-xl bg-slate-950 border border-white/15 px-3 py-1.5 text-white"
            >
              <option value={500}>500 знаков</option>
              <option value={1500}>1 500 знаков</option>
              <option value={3000}>3 000 знаков</option>
              <option value={5000}>5 000 знаков</option>
            </select>
            <input
              value={irrFind}
              onChange={(e) => setIrrFind(e.target.value.replace(/\D/g, ''))}
              placeholder="Найти дату/число внутри знаков..."
              className="rounded-xl bg-slate-950 border border-white/15 px-3 py-1.5 text-white font-mono"
            />
          </div>

          {irrRes && (
            <>
              <div className="p-3 rounded-xl bg-slate-950 border border-white/10 flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-white">{irrRes.title} • {irrRes.continued_fraction}</span>
                {irrFind && (
                  <span className="font-mono text-amber-300">
                    {irrRes.found_at_decimal_place
                      ? `Последовательность «${irrFind}» найдена на позиции #${irrRes.found_at_decimal_place}!`
                      : `Не встретилась в первых ${irrRes.digits_count} знаках — увеличьте глубину!`}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 text-center font-mono">
                {Object.entries(irrRes.digit_distribution || {}).map(([d, cnt]: any) => (
                  <div key={d} className="p-2 rounded-lg bg-slate-950 border border-white/10">
                    <div className="text-purple-300 font-bold">Цифра {d}</div>
                    <div className="text-white">{cnt}</div>
                  </div>
                ))}
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-white/10 font-mono text-[11px] leading-relaxed break-all max-h-72 overflow-y-auto text-slate-300">
                <b className="text-amber-300 text-sm">{irrRes.integer_part}.</b>
                {irrRes.fractional_digits}
              </div>
            </>
          )}
        </div>
      )}

      {/* 7. LIBRARY OF BABEL */}
      {tab === 'library_of_babel' && (
        <div className="rounded-2xl bg-slate-900/80 border border-amber-500/25 p-4 space-y-4 text-xs">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white">🏛️ Вавилонская Библиотека Хорхе Луиса Борхеса</h3>
            <p className="text-xs text-slate-400">
              Введите любую мысль, имя или фразу — алгоритм мгновенно вычислит точный шестигранный зал, стену, полку, том и страницу, на которой этот текст покоился вечно
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={babelQuery}
              onChange={(e) => setBabelQuery(e.target.value)}
              placeholder="Искать точную фразу в бесконечных томах..."
              className="flex-1 rounded-xl bg-slate-950 border border-white/15 px-3.5 py-2 text-white"
            />
            <button
              type="button"
              onClick={() => {
                apiPost('/api/v6/babel/search', { phrase: babelQuery })
                  .then((r) => {
                    setBabelPage(r);
                    setBabelHex(r.hex_id);
                    setBabelPageNum(r.page);
                    onSync();
                  })
                  .catch(() => {});
              }}
              className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-black"
            >
              Найти том и страницу
            </button>
          </div>

          {babelPage && (
            <div className="p-4 rounded-xl bg-[#0c0a07] border border-amber-500/35 space-y-2">
              <div className="font-mono text-[11px] text-amber-300 break-all">
                Гексагон: {babelPage.hex_id} • Стена {babelPage.wall} • Полка {babelPage.shelf} • Том {babelPage.volume} • Стр. {babelPage.page}/410
              </div>
              <div className="font-mono text-xs leading-relaxed text-amber-100/90 break-all whitespace-pre-wrap">
                {babelPage.text}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
