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
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new BufferAttribute(new Float32Array(cols), 3));
  g.setIndex(idx);
  return g;
}

interface Tile {
  cell: Cell;
  group: Group;
  /** Where the cell is on its way up from the clouds (0 hidden below, 1 in place), and where the work has got it to. */
  rise: number;
  target: number;
  landed: boolean;
  depth: number;
}

const BLADES_PER_TILE = 150;
const MAX_TILES = 40;

export interface GrassUniforms {
  uTime: { value: number };
  uCursor: { value: Vector3 };
  uWind: { value: number };
}

export class Island {
  readonly group = new Group();
  readonly tiles = new Map<string, Tile>();
  private ghosts = new Group();
  private highlight: Group;
  private highlightTarget = 0;
  private highlightAlpha = 0;
  private grass: InstancedMesh;
  readonly grassUniforms: GrassUniforms = { uTime: { value: 0 }, uCursor: { value: new Vector3(0, 0, 0) }, uWind: { value: 1 } };
  private slabGeo = new RoundedBoxGeometry(0.975, 0.16, 0.975, 2, 0.035);
  private dirtGeo = new BoxGeometry(1, 0.3, 1);
  private grassMat: MeshStandardMaterial;
  private dirtTopMat: MeshStandardMaterial;
  private earthMat: MeshStandardMaterial;
  private rockMat: MeshStandardMaterial;
  /** Cells whose lawn is kept short or bare because something stands on them. */
  private bare = new Map<string, 'none' | 'edges'>();
  onLanded: ((cell: Cell) => void) | null = null;

  constructor() {
    this.grassMat = new MeshStandardMaterial({ color: '#6b7b36', roughness: 0.95 });
    this.dirtTopMat = new MeshStandardMaterial({ color: '#8a6a47', roughness: 1 });
    this.earthMat = new MeshStandardMaterial({ color: '#5a4230', roughness: 1 });
    this.rockMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true });
    this.group.add(this.ghosts);

    const bladeMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: 2 });
    bladeMat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.grassUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform vec3 uCursor;\nuniform float uWind;')
        .replace('#include <project_vertex>', /* glsl */ `
          vec4 wpos = instanceMatrix * vec4(transformed, 1.0);
          float k = position.y * position.y;
          float sway = sin(uTime * 1.6 + wpos.x * 1.7 + wpos.z * 1.1) + 0.5 * sin(uTime * 2.7 + wpos.z * 2.3);
          wpos.x += sway * 0.022 * k * uWind;
          wpos.z += cos(uTime * 1.2 + wpos.x * 0.8) * 0.012 * k * uWind;
          vec2 dv = wpos.xz - uCursor.xy;
          float dl = length(dv);
          float push = (1.0 - smoothstep(0.0, 0.42, dl)) * uCursor.z;
          wpos.xz += (dv / max(dl, 0.0001)) * push * 0.11 * k;
          wpos.y -= push * 0.06 * k;
          vec4 mvPosition = modelViewMatrix * wpos;
          gl_Position = projectionMatrix * mvPosition;
        `);
    };
    this.grass = new InstancedMesh(bladeGeometry(), bladeMat, BLADES_PER_TILE * MAX_TILES);
    this.grass.instanceMatrix.setUsage(DynamicDrawUsage);
    this.grass.count = 0;
    this.grass.receiveShadow = true;
    this.grass.frustumCulled = false;
    this.group.add(this.grass);

    this.highlight = this.frame(0.99, 0.022, new MeshBasicMaterial({ color: '#f3efd9', transparent: true, opacity: 0, depthTest: false }));
    this.highlight.renderOrder = 20;
    this.highlight.visible = false;
    this.group.add(this.highlight);
  }

  private frame(size: number, thick: number, mat: Material): Group {
    const g = new Group();
    const bar = new BoxGeometry(size, 0.01, thick);
    for (let i = 0; i < 4; i++) {
      const m = new Mesh(bar, mat);
      const a = (i * Math.PI) / 2;
      m.position.set(Math.sin(a) * (size / 2), 0.012, Math.cos(a) * (size / 2));
      m.rotation.y = a;
      m.renderOrder = 20;
      g.add(m);
    }
    return g;
  }

  /** True for a cell that is part of the island (one still being hauled up does not count). */
  has(cell: Cell): boolean {
    return this.tiles.get(cellKey(cell))?.landed === true;
  }

  cells(): Cell[] {
    return [...this.tiles.values()].filter((t) => t.landed).map((t) => t.cell);
  }

  /** How far the island reaches from its centre, for the camera. */
  reach(): number {
    let r = 1.5;
    for (const t of this.tiles.values()) if (t.landed) r = Math.max(r, Math.hypot(t.cell[0], t.cell[1]) + 0.9);
    return r;
  }

  /** Cells the resident is hauling up: they wait in the clouds and follow the work. */
  addPending(cells: Cell[]): void {
    for (const c of cells) {
      const key = cellKey(c);
      if (this.tiles.has(key)) continue;
      const t = this.buildTile(c);
      t.rise = 0;
      t.target = 0;
      t.landed = false;
      t.group.position.y = -11;
      this.tiles.set(key, t);
      this.group.add(t.group);
    }
  }

  setRise(cell: Cell, k: number): void {
    const t = this.tiles.get(cellKey(cell));
    if (t && !t.landed) t.target = Math.max(0, Math.min(1, k));
  }

  /** The top of a cell on its way up, in the world (where the rope ties on). */
  tileTop(cell: Cell, out = new Vector3()): Vector3 | null {
    const t = this.tiles.get(cellKey(cell));
    if (!t) return null;
    return out.set(cell[0], t.group.position.y + 0.02, cell[1]);
  }

  private buildTile(cell: Cell): Tile {
    const rand = rng(hash(cell) ^ 0x5bd1e995);
    const g = new Group();
    g.position.set(cell[0], 0, cell[1]);
    const dirt = DIRT.has(cellKey(cell));
    const slabMat = (dirt ? this.dirtTopMat : this.grassMat).clone();
    slabMat.color = tint(dirt ? '#8a6a47' : '#6b7b36', rand, dirt ? 0.35 : 1);
    const slab = new Mesh(this.slabGeo, slabMat);
    slab.position.y = -0.08;
    slab.receiveShadow = true;
    slab.castShadow = true;
    const earth = new Mesh(this.dirtGeo, this.earthMat);
    earth.position.y = -0.25;
    earth.receiveShadow = true;
    const dist = Math.hypot(cell[0], cell[1]);
    const depth = 1.1 + Math.max(0, 3.4 - dist * 0.95) + rand() * 0.9;
    const rock = new Mesh(rockGeometry(cell, depth), this.rockMat);
    rock.castShadow = true;
    rock.receiveShadow = true;
    g.add(slab, earth, rock);
    g.userData.cell = cell;
    return { cell, group: g, rise: 1, target: 1, landed: true, depth };
  }

  /** Brings the island to exactly these cells, all in place (a load, a reset, a preview). */
  setTiles(cells: Cell[], animate = false): Cell[] {
    const want = new Set(cells.map(cellKey));
    for (const [key, t] of this.tiles) {
      if (!want.has(key)) {
        this.group.remove(t.group);
        this.tiles.delete(key);
      }
    }
    const added: Cell[] = [];
    let order = 0;
    for (const c of cells) {
      const key = cellKey(c);
      if (this.tiles.has(key)) continue;
      const t = this.buildTile(c);
      if (animate) {
        t.rise = 0;
        t.target = 1;
        t.landed = false;
        t.group.position.y = -11 - order * 0.6;
        order++;
      }
      this.tiles.set(key, t);
      this.group.add(t.group);
      added.push(c);
    }
    this.layGrass();
    return added;
  }

  /** Dashed outlines where the next cells will rise. */
  setGhosts(cells: Cell[]): void {
    this.ghosts.clear();
    const mat = new MeshBasicMaterial({ color: '#f3efd9', transparent: true, opacity: 0.32, depthWrite: false });
    const dash = new BoxGeometry(0.16, 0.012, 0.022);
    for (const c of cells) {
      const g = new Group();
      g.position.set(c[0], 0.01, c[1]);
      for (let side = 0; side < 4; side++) {
        for (let i = 0; i < 3; i++) {
          const m = new Mesh(dash, mat);
          const along = -0.32 + i * 0.32;
          const a = (side * Math.PI) / 2;
          m.position.set(Math.cos(a) * along + Math.sin(a) * 0.47, 0, -Math.sin(a) * along + Math.cos(a) * 0.47);
          m.rotation.y = a;
          g.add(m);
        }
      }
      g.userData.ghost = c;
      this.ghosts.add(g);
    }
  }

  ghostCells(): Cell[] {
    return this.ghosts.children.map((g) => g.userData.ghost as Cell);
  }

  /** What grows on a cell: 'none' for water, 'edges' for a bed or a floor. */
  setBare(cell: Cell, how: 'none' | 'edges' | null): void {
    if (how) this.bare.set(cellKey(cell), how);
    else this.bare.delete(cellKey(cell));
    this.layGrass();
  }

  clearBare(): void {
    this.bare.clear();
  }

  private layGrass(): void {
    const m = new Matrix4();
    const q = new Quaternion();
    const s = new Vector3();
    const p = new Vector3();
    const up = new Vector3(0, 1, 0);
    let i = 0;
    for (const t of this.tiles.values()) {
      if (!t.landed) continue;
      const key = cellKey(t.cell);
      const dirt = DIRT.has(key);
      const bare = this.bare.get(key);
      if (bare === 'none') continue;
      const rand = rng(hash(t.cell) ^ 0x2f6b);
      const n = dirt ? 26 : BLADES_PER_TILE;
      for (let b = 0; b < n && i < this.grass.instanceMatrix.count; b++) {
        let x = rand() - 0.5, z = rand() - 0.5;
        // Bare earth keeps its grass to the rims; beds and floors too.
        if (dirt || bare === 'edges') {
          const side = Math.floor(rand() * 4);
          const along = rand() - 0.5;
          const inset = 0.44 + rand() * 0.04;
          [x, z] = side === 0 ? [along, -inset] : side === 1 ? [along, inset] : side === 2 ? [-inset, along] : [inset, along];
        } else {
          x *= 0.94;
          z *= 0.94;
        }
        p.set(t.cell[0] + x, 0, t.cell[1] + z);
        // Blades on an outer rim lean out over the cliff.
        const outward = new Vector3(x, 0, z);
        const rim = Math.max(Math.abs(x), Math.abs(z)) > 0.4;
        const lean = rim ? 0.5 : 0.18;
        const axis = new Vector3(outward.z, 0, -outward.x).normalize();
        q.setFromAxisAngle(up, rand() * Math.PI);
        if (axis.lengthSq() > 0) q.premultiply(new Quaternion().setFromAxisAngle(axis, lean * rand()));
        const tall = rand() < 0.12;
        const h = (dirt ? 0.05 : 0.06) + rand() * (tall ? 0.12 : 0.06);
        s.set(0.04 + rand() * 0.03, h, 1);
        m.compose(p, q, s);
        this.grass.setMatrixAt(i++, m);
      }
    }
    this.grass.count = i;
    this.grass.instanceMatrix.needsUpdate = true;
  }

  /** The cell under a point on the island's top, or null over the edge. */
  cellAt(x: number, z: number): Cell | null {
    const c: Cell = [Math.round(x), Math.round(z)];
    return this.has(c) ? c : null;
  }

  ghostAt(x: number, z: number): Cell | null {
    const c: Cell = [Math.round(x), Math.round(z)];
    return this.ghostCells().find((g) => g[0] === c[0] && g[1] === c[1]) ?? null;
  }

  showHighlight(cell: Cell | null): void {
    if (cell) {
      this.highlight.position.set(cell[0], 0, cell[1]);
      this.highlight.visible = true;
    }
    this.highlightTarget = cell ? 1 : 0;
  }

  get rising(): boolean {
    for (const t of this.tiles.values()) if (!t.landed && t.target > t.rise + 0.01) return true;
    return false;
  }

  update(dt: number, time: number): void {
    this.grassUniforms.uTime.value = time;
    let landed = false;
    for (const t of this.tiles.values()) {
      if (t.landed) continue;
      // Follow the work smoothly; a cell on the rope sways a little.
      t.rise += (t.target - t.rise) * Math.min(1, dt * 1.6);
      if (t.target >= 1 && t.rise > 0.995) t.rise = 1;
      const e = 1 - Math.pow(1 - t.rise, 2);
      const sway = (1 - t.rise) * (t.target > 0 ? 1 : 0);
      t.group.position.y = -11 * (1 - e);
      t.group.rotation.z = Math.sin(time * 1.3 + t.cell[0]) * 0.05 * sway;
      t.group.rotation.x = Math.cos(time * 1.1 + t.cell[1]) * 0.04 * sway;
      if (t.rise >= 1) {
        t.group.position.y = 0;
        t.group.rotation.set(0, 0, 0);
        t.landed = true;
        landed = true;
        this.onLanded?.(t.cell);
      }
    }
