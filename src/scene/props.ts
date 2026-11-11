import {
  AdditiveBlending, BoxGeometry, BufferGeometry, CanvasTexture, CircleGeometry, Color, ConeGeometry,
  CylinderGeometry, DodecahedronGeometry, DoubleSide, ExtrudeGeometry, Float32BufferAttribute, Group, IcosahedronGeometry,
  LatheGeometry, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry,
  PointLight, Shape, ShaderMaterial, SphereGeometry, SRGBColorSpace, TorusGeometry, Vector2, Vector3, type Raycaster,
} from 'three';
import { rng } from '../core/emitter';
import { cellKey, type Cell, type PropKind } from '../sim/milestones';

export interface PropContext {
  night: number;
  time: number;
  todayMinutes: number;
  totalMinutes: number;
}

export interface PropEntry {
  kind: PropKind;
  cell: Cell;
  title: string;
  group: Group;
  blocking: boolean;
  grow: number;
  wiggle: number;
  update?: (dt: number, ctx: PropContext, self: PropEntry) => void;
  poke?: (self: PropEntry, point: Vector3) => void;
}

export const PROP_TITLE: Record<PropKind, string> = {
  rock: 'Batu besar', flowers: 'Bunga liar', sapling: 'Pohon muda', tree: 'Pohon rindang', garden: 'Kebun kecil',
  'hut-frame': 'Rangka pondok', hut: 'Pondok kayu', pole: 'Tiang listrik', lamp: 'Lampu taman', board: 'Papan tulis',
  pond: 'Kolam', windmill: 'Kincir angin', bench: 'Bangku kayu', pine: 'Pohon cemara', telescope: 'Teleskop',
  balloon: 'Balon udara', waterfall: 'Air terjun',
};

const std = (color: string, extra: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]> = {}) =>
  new MeshStandardMaterial({ color, roughness: 0.85, ...extra });

const WOOD = std('#86603f');
const WOOD_DARK = std('#5c4029');
const LEAF = std('#5f7c34', { flatShading: true });
const LEAF_LIGHT = std('#7f9a40', { flatShading: true });
const PINE = std('#3d5a33', { flatShading: true });
const STONE = std('#857767', { flatShading: true });
const IRON = std('#2b2a28', { roughness: 0.6, metalness: 0.3 });

function mesh(geo: BufferGeometry, mat: MeshStandardMaterial | MeshBasicMaterial, x = 0, y = 0, z = 0, shadow = true): Mesh {
  const m = new Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

function rock(): Group {
  const g = new Group();
  const big = mesh(new DodecahedronGeometry(0.34, 0), STONE, 0.02, 0.2, -0.05);
  big.scale.set(1.25, 0.9, 1);
  big.rotation.set(0.3, 0.6, 0.1);
  const small = mesh(new DodecahedronGeometry(0.14, 0), STONE, 0.33, 0.07, 0.24);
  small.rotation.set(0.5, 0.2, 0.7);
  g.add(big, small);
  // A tuft of grass on the boulder's crown, as on the reference's rock.
  for (let i = 0; i < 6; i++) {
    const t = mesh(new ConeGeometry(0.035, 0.2, 4), LEAF_LIGHT, -0.05 + (i % 3) * 0.06, 0.48, -0.08 + Math.floor(i / 3) * 0.07);
    t.rotation.z = (i - 2.5) * 0.18;
    g.add(t);
  }
  return g;
}

function flowers(): Group {
  const g = new Group();
  const rand = rng(99);
  const heads = [std('#efe6c8'), std('#e8643c'), std('#f0bf48')];
  const stem = new CylinderGeometry(0.006, 0.006, 1, 3);
  const head = new IcosahedronGeometry(0.03, 0);
  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2;
    const r = 0.22 + rand() * 0.22;
    const h = 0.08 + rand() * 0.1;
    const s = mesh(stem, LEAF, Math.cos(a) * r, h / 2, Math.sin(a) * r, false);
    s.scale.y = h;
    const f = mesh(head, heads[i % 3], Math.cos(a) * r, h, Math.sin(a) * r, false);
    g.add(s, f);
  }
  return g;
}

function sapling(): Group {
  const g = new Group();
  const trunk = mesh(new CylinderGeometry(0.02, 0.03, 0.42, 5), WOOD, 0, 0.21, 0);
  const a = mesh(new IcosahedronGeometry(0.13, 0), LEAF_LIGHT, 0.02, 0.46, 0);
  const b = mesh(new IcosahedronGeometry(0.09, 0), LEAF, -0.07, 0.38, 0.04);
  g.add(trunk, a, b);
  return g;
}

function tree(): Group {
  const g = new Group();
