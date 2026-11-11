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
