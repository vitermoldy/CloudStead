import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, Group, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Object3D, Quaternion, Vector3, type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { rng, clamp } from '../core/emitter';
import { cellKey, type Cell } from '../sim/milestones';

/** Cells with bare earth: the clearing round the resident and the path east and south. */
const DIRT = new Set(['0,0', '0,1', '1,0', '0,2', '2,0', '0,3', '3,0']);

const hash = (c: Cell) => ((c[0] + 11) * 73856093) ^ ((c[1] + 7) * 19349663);

function tint(hex: string, rand: () => number, spread: number): Color {
  const c = new Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h + (rand() - 0.5) * spread * 0.1, clamp(hsl.s + (rand() - 0.5) * spread * 0.2, 0, 1), clamp(hsl.l + (rand() - 0.5) * spread * 0.12, 0, 1));
  return c;
}

/** The rock under one cell: a tapered, faceted column whose top is the cell's exact square. */
function rockGeometry(cell: Cell, depth: number): BufferGeometry {
  const rand = rng(hash(cell));
  const rings = 6;
  const sides = 12;
  const pts: Vector3[][] = [];
  const tipX = (rand() - 0.5) * 0.5, tipZ = (rand() - 0.5) * 0.5;
  for (let r = 0; r <= rings; r++) {
    const k = r / rings;
    const y = -0.4 - k * depth;
    const ring: Vector3[] = [];
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2 + Math.PI / sides;
      // The top ring follows the square exactly so neighbouring cells meet without a seam.
      const sq = 0.5 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
      if (r === 0) {
        ring.push(new Vector3(Math.cos(a) * sq, y, Math.sin(a) * sq));
        continue;
      }
      const taper = Math.pow(1 - k, 0.9);
      const bulge = r === 1 ? 1.06 + rand() * 0.06 : 1;
      const jitter = 0.85 + rand() * 0.3;
      const rad = sq * taper * bulge * jitter;
      ring.push(new Vector3(Math.cos(a) * rad + tipX * k * k, y + (rand() - 0.5) * 0.18 * (r < rings ? 1 : 0), Math.sin(a) * rad + tipZ * k * k));
    }
    pts.push(ring);
  }
  const strata = ['#6f5e4e', '#5b4c40', '#7d6b57', '#4b4038', '#685a4c', '#56483d'];
  const positions: number[] = [];
  const colors: number[] = [];
  const bandColor = (y: number) => {
    const band = Math.floor((-y + Math.sin(y * 3 + cell[0]) * 0.12) / 0.38);
    const c = new Color(strata[((band % strata.length) + strata.length) % strata.length]);
    return c.multiplyScalar(0.85 + rand() * 0.25);
  };
  const tri = (a: Vector3, b: Vector3, c: Vector3) => {
    const col = bandColor((a.y + b.y + c.y) / 3);
    for (const p of [a, b, c]) {
      positions.push(p.x, p.y, p.z);
      colors.push(col.r, col.g, col.b);
    }
  };
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < sides; s++) {
      const a = pts[r][s], b = pts[r][(s + 1) % sides], c = pts[r + 1][s], d = pts[r + 1][(s + 1) % sides];
      tri(a, b, c);
      tri(b, d, c);
    }
  }
  const bottom = pts[rings];
  const tip = new Vector3(tipX, -0.4 - depth - 0.35, tipZ);
  for (let s = 0; s < sides; s++) tri(bottom[s], bottom[(s + 1) % sides], tip);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  g.computeVertexNormals();
  return g;
}

/** A thin blade, root at the origin, normals straight up so the lawn reads as one surface. */
function bladeGeometry(): BufferGeometry {
  const h = 1;
  const pos = [-0.5, 0, 0, 0.5, 0, 0, -0.32, 0.45 * h, 0, 0.32, 0.45 * h, 0, -0.12, 0.8 * h, 0, 0.12, 0.8 * h, 0, 0, h, 0];
  const idx = [0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6];
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  const normals = new Float32Array(pos.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  g.setAttribute('normal', new BufferAttribute(normals, 3));
  const cols: number[] = [];
  const root = new Color('#4f5c27'), tip = new Color('#d9d27a');
  for (let i = 0; i < pos.length; i += 3) {
    const c = root.clone().lerp(tip, Math.pow(pos[i + 1], 1.2));
