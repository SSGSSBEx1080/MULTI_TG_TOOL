import { RefObject, useEffect, useState } from 'react';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Vec4 {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface ProjectedPoint {
  sx: number;
  sy: number;
  z: number;
  scale: number;
  visible: boolean;
}

export interface Mesh3D {
  vertices: Vec3[];
  faces: number[][];
  edges: [number, number][];
}

export const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export const add3 = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub3 = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale3 = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const dot3 = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

export const cross3 = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

export const len3 = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);

export const norm3 = (a: Vec3): Vec3 => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};

export const rotX = (p: Vec3, a: number): Vec3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
};

export const rotY = (p: Vec3, a: number): Vec3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
};

export const rotZ = (p: Vec3, a: number): Vec3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
};

export const rotateEuler = (p: Vec3, rx: number, ry: number, rz = 0): Vec3 => {
  let out = rotY(p, ry);
  out = rotX(out, rx);
  if (rz !== 0) out = rotZ(out, rz);
  return out;
};

export const project3D = (
  p: Vec3,
  width: number,
  height: number,
  fov = 340,
  camDist = 4.2
): ProjectedPoint => {
  const dz = camDist - p.z;
  if (dz <= 0.15) {
    return { sx: width / 2, sy: height / 2, z: p.z, scale: 0, visible: false };
  }
  const scale = fov / dz;
  return {
    sx: width * 0.5 + p.x * scale,
    sy: height * 0.5 - p.y * scale,
    z: p.z,
    scale,
    visible: true,
  };
};

export const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = parseInt(full || '38bdf8', 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
};

/**
 * Blinn-Phong face shading (ambient + Lambert diffuse + specular highlight + rim)
 */
export const shadeBlinnPhong = (
  normal: Vec3,
  center: Vec3,
  baseRgb: [number, number, number],
  lightDir: Vec3 = norm3({ x: 0.45, y: 0.72, z: 0.85 }),
  alpha = 0.88
): string => {
  const n = norm3(normal);
  const viewDir = norm3({ x: -center.x, y: -center.y, z: 4.2 - center.z });
  const diff = Math.max(0, dot3(n, lightDir));
  const halfVec = norm3(add3(lightDir, viewDir));
  const spec = Math.pow(Math.max(0, dot3(n, halfVec)), 28);
  const rim = Math.pow(1 - Math.max(0, dot3(n, viewDir)), 2.4) * 0.28;

  const ambient = 0.24;
  const lum = ambient + diff * 0.74 + rim;
  const r = Math.min(255, Math.round(baseRgb[0] * lum + spec * 195));
  const g = Math.min(255, Math.round(baseRgb[1] * lum + spec * 215));
  const b = Math.min(255, Math.round(baseRgb[2] * lum + spec * 255));
  return `rgba(${r},${g},${b},${alpha})`;
};

export const latLonToVec3 = (latDeg: number, lonDeg: number, radius = 1): Vec3 => {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return {
    x: radius * Math.cos(lat) * Math.sin(lon),
    y: radius * Math.sin(lat),
    z: radius * Math.cos(lat) * Math.cos(lon),
  };
};

const uniqueEdgesFromFaces = (faces: number[][]): [number, number][] => {
  const seen = new Set<string>();
  const edges: [number, number][] = [];
  for (const f of faces) {
    for (let i = 0; i < f.length; i++) {
      const a = f[i];
      const b = f[(i + 1) % f.length];
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push([a, b]);
      }
    }
  }
  return edges;
};

// ============================================================================
// PLATONIC & ARCHIMEDEAN 3D MESH GENERATORS (D4, D6, D8, D12, D20, TORUS)
// ============================================================================
export const createTetrahedron = (r = 1.25): Mesh3D => {
  const raw = [v3(1, 1, 1), v3(-1, -1, 1), v3(-1, 1, -1), v3(1, -1, -1)];
  const vertices = raw.map((p) => scale3(norm3(p), r));
  const faces = [
    [0, 1, 2],
    [0, 3, 1],
    [0, 2, 3],
    [1, 3, 2],
  ];
  return { vertices, faces, edges: uniqueEdgesFromFaces(faces) };
};

export const createCube = (r = 1.15): Mesh3D => {
  const s = r / Math.sqrt(3);
  const vertices = [
    v3(-s, -s, -s),
    v3(s, -s, -s),
    v3(s, s, -s),
    v3(-s, s, -s),
    v3(-s, -s, s),
    v3(s, -s, s),
    v3(s, s, s),
    v3(-s, s, s),
  ];
  const faces = [
    [4, 5, 6, 7], // front
    [1, 0, 3, 2], // back
    [3, 7, 6, 2], // top
    [0, 1, 5, 4], // bottom
    [5, 1, 2, 6], // right
    [0, 4, 7, 3], // left
  ];
  return { vertices, faces, edges: uniqueEdgesFromFaces(faces) };
};

export const createOctahedron = (r = 1.25): Mesh3D => {
  const vertices = [
    v3(0, r, 0),
    v3(0, -r, 0),
    v3(r, 0, 0),
    v3(-r, 0, 0),
    v3(0, 0, r),
    v3(0, 0, -r),
  ];
  const faces = [
    [0, 4, 2],
    [0, 2, 5],
    [0, 5, 3],
    [0, 3, 4],
    [1, 2, 4],
    [1, 5, 2],
    [1, 3, 5],
    [1, 4, 3],
  ];
  return { vertices, faces, edges: uniqueEdgesFromFaces(faces) };
};

export const createIcosahedron = (r = 1.22): Mesh3D => {
  const phi = (1 + Math.sqrt(5)) / 2;
  const raw = [
    v3(-1, phi, 0),
    v3(1, phi, 0),
    v3(-1, -phi, 0),
    v3(1, -phi, 0),
    v3(0, -1, phi),
    v3(0, 1, phi),
    v3(0, -1, -phi),
    v3(0, 1, -phi),
    v3(phi, 0, -1),
    v3(phi, 0, 1),
    v3(-phi, 0, -1),
    v3(-phi, 0, 1),
  ];
  const vertices = raw.map((p) => scale3(norm3(p), r));
  const faces = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];
  return { vertices, faces, edges: uniqueEdgesFromFaces(faces) };
};

/**
 * Dual of icosahedron -> exact 12-pentagon regular Dodecahedron
 */
export const createDodecahedron = (r = 1.22): Mesh3D => {
  const ico = createIcosahedron(1);
  const vertices = ico.faces.map((f) => {
    const sum = add3(add3(ico.vertices[f[0]], ico.vertices[f[1]]), ico.vertices[f[2]]);
    return scale3(norm3(sum), r);
  });
  const faces: number[][] = [];
  for (let vi = 0; vi < ico.vertices.length; vi++) {
    const incident: number[] = [];
    ico.faces.forEach((f, fi) => {
      if (f.includes(vi)) incident.push(fi);
    });
    const center = ico.vertices[vi];
    const n = norm3(center);
    const ref = Math.abs(n.y) < 0.9 ? v3(0, 1, 0) : v3(1, 0, 0);
    const u = norm3(cross3(ref, n));
    const w = cross3(n, u);
    incident.sort((a, b) => {
      const pa = sub3(vertices[a], center);
      const pb = sub3(vertices[b], center);
      return Math.atan2(dot3(pa, w), dot3(pa, u)) - Math.atan2(dot3(pb, w), dot3(pb, u));
    });
    faces.push(incident);
  }
  return { vertices, faces, edges: uniqueEdgesFromFaces(faces) };
};

export const createTorus = (R = 0.95, r = 0.36, segU = 22, segV = 12): Mesh3D => {
  const vertices: Vec3[] = [];
  const faces: number[][] = [];
  for (let i = 0; i < segU; i++) {
    const u = (i / segU) * Math.PI * 2;
    const cu = Math.cos(u);
    const su = Math.sin(u);
    for (let j = 0; j < segV; j++) {
      const v = (j / segV) * Math.PI * 2;
      const cv = Math.cos(v);
      const sv = Math.sin(v);
      vertices.push({
        x: (R + r * cv) * cu,
        y: r * sv,
        z: (R + r * cv) * su,
      });
    }
  }
  for (let i = 0; i < segU; i++) {
    const ni = (i + 1) % segU;
    for (let j = 0; j < segV; j++) {
      const nj = (j + 1) % segV;
      faces.push([i * segV + j, ni * segV + j, ni * segV + nj, i * segV + nj]);
    }
  }
  return { vertices, faces, edges: uniqueEdgesFromFaces(faces) };
};

// ============================================================================
// 4D TESSERACT (HYPERCUBE) -> 3D PERSPECTIVE PROJECTION
// ============================================================================
const TESSERACT_VERTS_4D: Vec4[] = Array.from({ length: 16 }, (_, i) => ({
  x: i & 1 ? 1 : -1,
  y: i & 2 ? 1 : -1,
  z: i & 4 ? 1 : -1,
  w: i & 8 ? 1 : -1,
}));

export const TESSERACT_EDGES: [number, number][] = [];
for (let i = 0; i < 16; i++) {
  for (let bit = 0; bit < 4; bit++) {
    const j = i ^ (1 << bit);
    if (i < j) TESSERACT_EDGES.push([i, j]);
  }
}

export const projectTesseract4DTo3D = (angleXW: number, angleYW: number, angleZW: number, scale = 0.9): Vec3[] => {
  const cxw = Math.cos(angleXW);
  const sxw = Math.sin(angleXW);
  const cyw = Math.cos(angleYW);
  const syw = Math.sin(angleYW);
  const czw = Math.cos(angleZW);
  const szw = Math.sin(angleZW);

  return TESSERACT_VERTS_4D.map((v) => {
    // XW rotation
    let x = v.x * cxw - v.w * sxw;
    let w = v.x * sxw + v.w * cxw;
    let y = v.y;
    let z = v.z;
    // YW rotation
    const y2 = y * cyw - w * syw;
    const w2 = y * syw + w * cyw;
    y = y2;
    w = w2;
    // ZW rotation
    const z2 = z * czw - w * szw;
    const w3 = z * szw + w * czw;
    z = z2;
    w = w3;

    const dist4D = 2.85;
    const factor = (dist4D / (dist4D - w)) * scale;
    return { x: x * factor, y: y * factor, z: z * factor };
  });
};

/**
 * RK4 Chaotic Lorenz Attractor 3D curve
 */
export const generateLorenzPoints = (steps = 650): Vec3[] => {
  const pts: Vec3[] = [];
  let x = 0.1;
  let y = 0;
  let z = 0;
  const sigma = 10;
  const rho = 28;
  const beta = 8 / 3;
  const dt = 0.009;
  for (let i = 0; i < steps; i++) {
    const dx = sigma * (y - x);
    const dy = x * (rho - z) - y;
    const dz = x * y - beta * z;
    x += dx * dt;
    y += dy * dt;
    z += dz * dt;
    pts.push({ x: x * 0.052, y: (z - 25) * 0.052, z: y * 0.052 });
  }
  return pts;
};

/**
 * Zero-battery-drain visibility hook: pauses 3D rAF loops when offscreen or tab hidden
 */
export const useViewportActive = (ref: RefObject<HTMLElement | null>): boolean => {
  const [inView, setInView] = useState(true);
  const [docVisible, setDocVisible] = useState(
    typeof document !== 'undefined' ? document.visibilityState !== 'hidden' : true
  );

  useEffect(() => {
    const onVis = () => setDocVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]) setInView(entries[0].isIntersecting);
      },
      { threshold: 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);

  return inView && docVisible;
};
