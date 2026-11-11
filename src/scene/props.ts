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
  const trunk = mesh(new CylinderGeometry(0.05, 0.085, 0.95, 6), WOOD, 0, 0.47, 0);
  trunk.rotation.z = 0.05;
  g.add(trunk);
  const crown = new Group();
  crown.position.y = 1.15;
  const blobs: [number, number, number, number, MeshStandardMaterial][] = [
    [0, 0.05, 0, 0.42, LEAF], [0.28, -0.08, 0.1, 0.3, LEAF_LIGHT], [-0.26, -0.05, -0.06, 0.32, LEAF],
    [0.05, 0.3, -0.05, 0.3, LEAF_LIGHT], [-0.08, -0.12, 0.28, 0.26, LEAF_LIGHT],
  ];
  for (const [x, y, z, r, m] of blobs) crown.add(mesh(new IcosahedronGeometry(r, 1), m, x, y, z));
  g.add(crown);
  g.userData.crown = crown;
  return g;
}

function garden(): Group {
  const g = new Group();
  const side = new BoxGeometry(0.8, 0.12, 0.05);
  for (let i = 0; i < 4; i++) {
    const m = mesh(side, WOOD, 0, 0.06, 0);
    const a = (i * Math.PI) / 2;
    m.position.set(Math.sin(a) * 0.38, 0.06, Math.cos(a) * 0.38);
    m.rotation.y = a;
    g.add(m);
  }
  g.add(mesh(new BoxGeometry(0.72, 0.08, 0.72), std('#3d2c20', { roughness: 1 }), 0, 0.05, 0, false));
  const sprout = new ConeGeometry(0.03, 0.12, 4);
  const cabbage = new IcosahedronGeometry(0.08, 1);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const x = -0.24 + c * 0.16, z = -0.22 + r * 0.22;
      if (r === 1 && (c === 1 || c === 2)) {
        g.add(mesh(cabbage, LEAF_LIGHT, x, 0.15, z));
      } else {
        g.add(mesh(sprout, LEAF_LIGHT, x, 0.14, z, false));
      }
    }
  }
  return g;
}

function hutFrame(): Group {
  const g = new Group();
  g.add(mesh(new BoxGeometry(0.86, 0.06, 0.9), WOOD_DARK, 0, 0.03, 0));
  const beam = new BoxGeometry(0.05, 1.05, 0.05);
  for (const z of [-0.4, 0.4]) {
    for (const s of [-1, 1]) {
      const m = mesh(beam, WOOD, s * 0.21, 0.5, z);
      m.rotation.z = s * 0.42;
      g.add(m);
    }
  }
  g.add(mesh(new BoxGeometry(0.05, 0.05, 0.9), WOOD, 0, 0.98, 0));
  return g;
}

function hut(): Group {
  const g = new Group();
  g.add(mesh(new BoxGeometry(0.9, 0.07, 0.94), WOOD_DARK, 0, 0.035, 0));
  const tri = (door: boolean) => {
    const s = new Shape();
    s.moveTo(-0.4, 0);
    s.lineTo(0.4, 0);
    s.lineTo(0, 0.92);
    s.lineTo(-0.4, 0);
    if (door) {
      const hole = new Shape();
      hole.moveTo(-0.12, 0);
      hole.lineTo(0.12, 0);
      hole.lineTo(0.12, 0.36);
      hole.absarc(0, 0.36, 0.12, 0, Math.PI, false);
      hole.lineTo(-0.12, 0);
      s.holes.push(hole);
    }
    return new ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false });
  };
  const front = mesh(tri(true), WOOD, 0, 0.07, 0.38);
  const back = mesh(tri(false), WOOD, 0, 0.07, -0.42);
  g.add(front, back);
  // Inside, a warm dark room; after dusk the doorway glows.
  const inside = new MeshBasicMaterial({ color: '#1a1410' });
  g.add(mesh(new BoxGeometry(0.5, 0.5, 0.7), inside, 0, 0.32, 0, false));
  const glow = new MeshBasicMaterial({ color: '#ffb35c', transparent: true, opacity: 0 });
  const door = new Mesh(new PlaneGeometry(0.22, 0.46), glow);
  door.position.set(0, 0.3, 0.355);
  g.add(door);
  const roofMat = std('#3b2f28', { flatShading: true });
  const roofGeo = new BoxGeometry(0.06, 1.12, 1.04);
  for (const s of [-1, 1]) {
    const r = mesh(roofGeo, roofMat, s * 0.24, 0.55, 0);
    r.rotation.z = s * 0.43;
    g.add(r);
  }
  g.add(mesh(new BoxGeometry(0.08, 0.06, 1.08), WOOD_DARK, 0, 1.03, 0));
  g.userData.glow = glow;
  return g;
}

function catenary(a: Vector3, b: Vector3, sag: number, steps = 24): Vector3[] {
  const pts: Vector3[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = a.clone().lerp(b, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    pts.push(p);
  }
  return pts;
}

function pole(): Group {
  const g = new Group();
  const build = (parent: Group, h: number) => {
    parent.add(mesh(new CylinderGeometry(0.03, 0.045, h, 6), WOOD_DARK, 0, h / 2, 0));
    parent.add(mesh(new BoxGeometry(0.62, 0.04, 0.05), WOOD_DARK, 0, h - 0.14, 0));
    for (const x of [-0.26, 0, 0.26]) parent.add(mesh(new CylinderGeometry(0.018, 0.018, 0.07, 5), std('#9aa3a1'), x, h - 0.09, 0, false));
  };
  build(g, 2.3);
  // A second pole on a small rock farther out: the line runs on to other islands.
  const far = new Group();
  far.position.set(8.5, -5.2, -11);
  far.rotation.y = 0.5;
  const islet = mesh(new ConeGeometry(0.9, 2.6, 7), std('#5e5044', { flatShading: true }), 0, -1.3, 0);
  islet.rotation.x = Math.PI;
  const lawn = mesh(new CylinderGeometry(0.92, 0.9, 0.16, 7), std('#66763a', { flatShading: true }), 0, -0.04, 0);
  far.add(islet, lawn);
  build(far, 2.3);
  // The far pole and the wires go up last, once the near pole stands.
  far.userData.late = true;
  g.add(far);
  const wire = new LineBasicMaterial({ color: '#1d1b19', transparent: true, opacity: 0.85 });
  for (const x of [-0.26, 0, 0.26]) {
    const a = new Vector3(x, 2.21, 0);
    const b = new Vector3(8.5 + x * Math.cos(0.5), -5.2 + 2.21, -11 - x * Math.sin(0.5));
    const c = new Vector3(20 + x, -9, -34);
    const pts = [...catenary(a, b, 0.7), ...catenary(b, c, 1.5).slice(1)];
    const line = new Line(new BufferGeometry().setFromPoints(pts), wire);
    line.userData.late = true;
    g.add(line);
  }
  return g;
}

function lamp(): Group {
  const g = new Group();
  g.add(mesh(new CylinderGeometry(0.018, 0.03, 1.05, 6), IRON, 0.28, 0.52, 0.22));
  g.add(mesh(new BoxGeometry(0.14, 0.02, 0.14), IRON, 0.28, 1.06, 0.22));
  const bulbMat = new MeshStandardMaterial({ color: '#fff0d0', emissive: new Color('#ffb14f'), emissiveIntensity: 0 });
  g.add(mesh(new BoxGeometry(0.1, 0.13, 0.1), bulbMat, 0.28, 0.98, 0.22, false));
  g.add(mesh(new ConeGeometry(0.1, 0.07, 4), IRON, 0.28, 1.1, 0.22));
  const light = new PointLight('#ffb35a', 0, 3.6, 1.6);
  light.position.set(0.28, 0.95, 0.22);
  g.add(light);
  g.userData.bulb = bulbMat;
  g.userData.light = light;
  return g;
}

function boardTexture(): { tex: CanvasTexture; draw: (today: number, total: number) => void } {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  const fmt = (min: number) => {
    const m = Math.floor(min);
    const h = Math.floor(m / 60);
    return h ? `${h} j ${m % 60} m` : `${m} m`;
  };
  const draw = (today: number, total: number) => {
    ctx.fillStyle = '#26302a';
    ctx.fillRect(0, 0, 256, 160);
    ctx.fillStyle = 'rgba(235, 232, 214, 0.92)';
    ctx.font = '500 22px "Funnel Sans Variable", system-ui, sans-serif';
    ctx.fillText('Fokus hari ini', 18, 38);
    ctx.font = '500 52px "Funnel Display Variable", system-ui, sans-serif';
    ctx.fillText(fmt(today), 18, 98);
    ctx.font = '400 20px "Funnel Sans Variable", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(235, 232, 214, 0.7)';
    ctx.fillText(`Total ${fmt(total)}`, 18, 136);
    tex.needsUpdate = true;
  };
  return { tex, draw };
}

function board(): Group {
  const g = new Group();
  for (const x of [-0.3, 0.3]) {
    const leg = mesh(new BoxGeometry(0.04, 0.85, 0.04), WOOD, x, 0.42, 0);
    leg.rotation.x = -0.12;
    g.add(leg);
  }
  g.add(mesh(new BoxGeometry(0.72, 0.48, 0.05), WOOD, 0, 0.56, 0.02));
  const { tex, draw } = boardTexture();
  const face = new Mesh(new PlaneGeometry(0.64, 0.4), new MeshStandardMaterial({ map: tex, roughness: 1 }));
  face.position.set(0, 0.56, 0.05);
