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
  g.add(face);
  g.rotation.x = -0.05;
  g.userData.draw = draw;
  g.userData.drawn = -1;
  return g;
}

function pondShape(): Shape {
  const s = new Shape();
  const rand = rng(31);
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 0.36 + rand() * 0.06;
    const p = new Vector2(Math.cos(a) * r, Math.sin(a) * r);
    if (i === 0) s.moveTo(p.x, p.y);
    else s.lineTo(p.x, p.y);
  }
  return s;
}

function pond(): Group {
  const g = new Group();
  const water = new Mesh(
    new ExtrudeGeometry(pondShape(), { depth: 0.02, bevelEnabled: false }),
    new MeshStandardMaterial({ color: '#3d6e77', roughness: 0.12, metalness: 0.15 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.0;
  water.receiveShadow = true;
  g.add(water);
  const rand = rng(57);
  const stone = new DodecahedronGeometry(0.06, 0);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rand() * 0.2;
    const r = 0.42 + rand() * 0.04;
    const s = mesh(stone, STONE, Math.cos(a) * r, 0.02, Math.sin(a) * r);
    s.scale.setScalar(0.7 + rand() * 0.7);
    g.add(s);
  }
  const pad = new CircleGeometry(0.06, 7);
  for (const [x, z] of [[0.1, -0.08], [-0.15, 0.1], [0.05, 0.18]]) {
    const p = mesh(pad, LEAF_LIGHT, x, 0.026, z, false);
    p.rotation.x = -Math.PI / 2;
    g.add(p);
  }
  const rings: Mesh[] = [];
  const ringGeo = new TorusGeometry(1, 0.012, 4, 32);
  for (let i = 0; i < 4; i++) {
    const r = new Mesh(ringGeo, new MeshBasicMaterial({ color: '#d9ecee', transparent: true, opacity: 0 }));
    r.rotation.x = -Math.PI / 2;
    r.position.y = 0.03;
    r.userData.age = 9;
    g.add(r);
    rings.push(r);
  }
  g.userData.rings = rings;
  return g;
}

function windmill(): Group {
  const g = new Group();
  g.add(mesh(new CylinderGeometry(0.13, 0.23, 1.45, 6), std('#d8cbb0', { flatShading: true }), 0, 0.72, 0));
  g.add(mesh(new ConeGeometry(0.19, 0.3, 6), std('#4a3a30', { flatShading: true }), 0, 1.6, 0));
  g.add(mesh(new BoxGeometry(0.1, 0.18, 0.02), WOOD_DARK, 0, 0.12, 0.2, false));
  const hub = new Group();
  hub.position.set(0, 1.38, 0.2);
  hub.add(mesh(new CylinderGeometry(0.04, 0.04, 0.08, 8), WOOD_DARK, 0, 0, 0).rotateX(Math.PI / 2));
  const blade = new BoxGeometry(0.11, 0.62, 0.015);
  for (let i = 0; i < 4; i++) {
    const arm = new Group();
    arm.rotation.z = (i * Math.PI) / 2;
    arm.add(mesh(blade, std('#efe7d2'), 0.03, 0.36, 0.03));
    arm.add(mesh(new BoxGeometry(0.02, 0.66, 0.02), WOOD_DARK, 0, 0.34, 0.02));
    hub.add(arm);
  }
  g.add(hub);
  g.userData.hub = hub;
  g.userData.spin = 0;
  return g;
}

function bench(): Group {
  const g = new Group();
  for (const z of [-0.06, 0.06]) g.add(mesh(new BoxGeometry(0.66, 0.03, 0.1), WOOD, 0, 0.24, z));
  g.add(mesh(new BoxGeometry(0.66, 0.12, 0.03), WOOD, 0, 0.38, -0.13));
  for (const x of [-0.27, 0.27]) {
    for (const z of [-0.09, 0.09]) g.add(mesh(new BoxGeometry(0.035, 0.24, 0.035), WOOD_DARK, x, 0.12, z));
    g.add(mesh(new BoxGeometry(0.035, 0.2, 0.035), WOOD_DARK, x, 0.33, -0.13));
  }
  return g;
}

function pine(): Group {
  const g = new Group();
  g.add(mesh(new CylinderGeometry(0.04, 0.07, 0.5, 6), WOOD_DARK, 0, 0.25, 0));
  const tiers: [number, number, number][] = [[0.42, 0.62, 0.62], [0.33, 0.55, 0.98], [0.22, 0.45, 1.3]];
  for (const [r, h, y] of tiers) g.add(mesh(new ConeGeometry(r, h, 7), PINE, 0, y, 0));
  return g;
}

function telescope(): Group {
  const g = new Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = mesh(new CylinderGeometry(0.012, 0.012, 0.55, 4), IRON, Math.cos(a) * 0.1, 0.26, Math.sin(a) * 0.1);
    leg.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
    g.add(leg);
  }
  const tube = new Group();
  tube.position.y = 0.55;
  tube.rotation.set(-0.75, 0.5, 0);
  tube.add(mesh(new CylinderGeometry(0.045, 0.055, 0.5, 10), std('#b08a52', { metalness: 0.5, roughness: 0.4 }), 0, 0.1, 0).rotateX(Math.PI / 2));
  tube.add(mesh(new CylinderGeometry(0.06, 0.06, 0.06, 10), IRON, 0, 0.1, -0.24).rotateX(Math.PI / 2));
  g.add(tube);
  return g;
}

function balloon(): Group {
  const g = new Group();
  g.add(mesh(new CylinderGeometry(0.02, 0.03, 0.18, 5), WOOD_DARK, 0, 0.09, 0));
  const float = new Group();
  float.position.y = 1.6;
  const profile: Vector2[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const y = -0.85 + t * 1.75;
    const r = Math.sin(Math.min(Math.PI, t * Math.PI * 1.05)) * (0.72 - (1 - t) * 0.2) + (t < 0.08 ? 0.12 : 0);
    profile.push(new Vector2(Math.max(0.06, r), y));
  }
  const env = new LatheGeometry(profile, 16);
  const cols: number[] = [];
  const cream = new Color('#ece2c6'), warm = new Color('#d9733a');
  const pos = env.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const a = Math.atan2(pos.getZ(i), pos.getX(i));
    const stripe = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 16 + 0.5) % 2;
    const c = stripe ? warm : cream;
    cols.push(c.r, c.g, c.b);
  }
  env.setAttribute('color', new Float32BufferAttribute(cols, 3));
  float.add(mesh(env, new MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: DoubleSide })));
  const basket = mesh(new BoxGeometry(0.26, 0.2, 0.26), WOOD, 0, -1.3, 0);
  float.add(basket);
  const rope = new LineBasicMaterial({ color: '#3a2f25' });
  for (const [x, z] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) {
    float.add(new Line(new BufferGeometry().setFromPoints([new Vector3(x, -1.2, z), new Vector3(x * 1.6, -0.82, z * 1.6)]), rope));
  }
  g.add(float);
  const tether = new Line(new BufferGeometry().setFromPoints([new Vector3(0, 0.18, 0), new Vector3(0, 1.5, 0)]), rope);
  g.add(tether);
  g.userData.float = float;
  g.userData.tether = tether;
  return g;
}

function waterfall(): Group {
  const g = new Group();
  // A channel from the pond to the south rim, then the drop.
  const channel = new Mesh(new PlaneGeometry(0.16, 0.42), new MeshStandardMaterial({ color: '#4c8590', roughness: 0.1, metalness: 0.1 }));
  channel.rotation.x = -Math.PI / 2;
  channel.position.set(0, 0.02, 0.3);
  g.add(channel);
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: { uTime: { value: 0 }, uNight: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        // The lip curls out, then the water falls almost straight.
        float t = 1.0 - uv.y;
        p.z += sqrt(t) * 0.55;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uNight;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      void main() {
        float streak = noise(vec2(vUv.x * 9.0, vUv.y * 3.0 + uTime * 2.2)) * 0.6 + noise(vec2(vUv.x * 23.0, vUv.y * 7.0 + uTime * 3.4)) * 0.4;
        float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        float fade = smoothstep(0.0, 0.45, vUv.y);
        vec3 col = mix(vec3(0.45, 0.66, 0.7), vec3(0.93, 0.97, 0.98), smoothstep(0.35, 0.8, streak));
        col *= mix(1.0, 0.45, uNight);
        float a = edge * fade * (0.55 + streak * 0.45);
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }
    `,
  });
  const fall = new Mesh(new PlaneGeometry(0.24, 6.5, 1, 24), mat);
  fall.position.set(0, -3.25, 0.5);
  g.add(fall);
  const mist = new Mesh(new SphereGeometry(0.5, 10, 8), new MeshBasicMaterial({ color: '#e8f0f0', transparent: true, opacity: 0.25, depthWrite: false, blending: AdditiveBlending }));
  mist.position.set(0, -6.3, 1.0);
  mist.scale.set(1.4, 0.6, 1.4);
  g.add(mist);
  g.userData.mat = mat;
  return g;
}

const BUILDERS: Record<PropKind, () => Group> = {
  rock, flowers, sapling, tree, garden, 'hut-frame': hutFrame, hut, pole, lamp, board, pond, windmill, bench, pine, telescope, balloon, waterfall,
};

/** Which way each piece faces (radians round y), so fronts meet the camera or the resident. */
const FACING: Partial<Record<PropKind, number>> = { hut: 0.45, 'hut-frame': 0.45, board: 0, bench: 0, windmill: 0.5, telescope: -0.6 };

/** What replaces what: the tree grows out of the sapling, the hut over its frame. */
const REPLACES: Partial<Record<PropKind, PropKind>> = { tree: 'sapling', hut: 'hut-frame' };

/** Things the resident walks round. Flowers, the waterfall and the balloon's stake are not in the way. */
const BLOCKING = new Set<PropKind>(['rock', 'sapling', 'tree', 'garden', 'hut-frame', 'hut', 'pole', 'lamp', 'board', 'pond', 'windmill', 'bench', 'pine', 'telescope']);

/** A fresh model of a piece, turned the way it stands (the construction site builds from these). */
export function buildProp(kind: PropKind): Group {
  const g = BUILDERS[kind]();
  g.rotation.y = FACING[kind] ?? 0;
  return g;
}

/** How a piece shows its progress while it is being made. */
export const REVEAL: Record<PropKind, 'rise' | 'parts' | 'pond' | 'fall'> = {
  rock: 'rise', flowers: 'parts', sapling: 'rise', tree: 'rise', garden: 'parts', 'hut-frame': 'rise', hut: 'rise',
  pole: 'rise', lamp: 'rise', board: 'rise', pond: 'pond', windmill: 'rise', bench: 'rise', pine: 'rise',
  telescope: 'rise', balloon: 'rise', waterfall: 'fall',
};

export class PropsLayer {
  readonly group = new Group();
  readonly entries: PropEntry[] = [];

  add(kind: PropKind, cell: Cell, animate: boolean): PropEntry {
    const replaced = REPLACES[kind];
    if (replaced) this.remove((e) => e.kind === replaced && cellKey(e.cell) === cellKey(cell));
    const group = BUILDERS[kind]();
    group.position.set(cell[0], 0, cell[1]);
    group.rotation.y = FACING[kind] ?? 0;
    const entry: PropEntry = {
      kind, cell, title: PROP_TITLE[kind], group, blocking: BLOCKING.has(kind), grow: animate ? 0 : 1, wiggle: 0,
    };
    this.wire(entry);
    group.traverse((o) => {
      o.userData.prop = entry;
    });
    if (animate) group.scale.setScalar(0.001);
    this.group.add(group);
    this.entries.push(entry);
    return entry;
  }

  private wire(e: PropEntry): void {
    const u = e.group.userData;
    switch (e.kind) {
      case 'tree':
        e.update = (_dt, ctx) => {
          const crown = u.crown as Group;
          crown.rotation.z = Math.sin(ctx.time * 0.9 + 1) * 0.025 + e.wiggle * Math.sin(ctx.time * 30) * 0.08;
          crown.rotation.x = Math.cos(ctx.time * 0.7) * 0.02;
        };
        break;
      case 'hut':
        e.update = (_dt, ctx) => {
          (u.glow as MeshBasicMaterial).opacity = Math.min(1, ctx.night * 1.1) * 0.9;
        };
        break;
      case 'lamp':
        e.update = (_dt, ctx) => {
          const on = Math.max(0, (ctx.night - 0.2) / 0.8);
          (u.bulb as MeshStandardMaterial).emissiveIntensity = on * 2.4;
          (u.light as PointLight).intensity = on * 2.2;
        };
        break;
      case 'board':
        e.update = (_dt, ctx) => {
          const key = Math.floor(ctx.todayMinutes) * 100000 + Math.floor(ctx.totalMinutes);
          if (u.drawn !== key) {
            u.drawn = key;
            (u.draw as (a: number, b: number) => void)(ctx.todayMinutes, ctx.totalMinutes);
          }
        };
        break;
      case 'windmill':
        e.update = (dt) => {
          u.spin = Math.max(0, (u.spin as number) - dt * 0.6);
          (u.hub as Group).rotation.z -= dt * (0.9 + (u.spin as number) * 5);
        };
        e.poke = () => {
          u.spin = 1.4;
        };
        break;
      case 'pond':
        e.update = (dt) => {
          for (const r of u.rings as Mesh[]) {
            r.userData.age += dt;
            const a = r.userData.age as number;
            const k = a / 1.8;
            (r.material as MeshBasicMaterial).opacity = k < 1 ? (1 - k) * 0.8 : 0;
            r.scale.setScalar(0.03 + k * 0.32);
          }
        };
        e.poke = (_self, point) => {
          const rings = u.rings as Mesh[];
          const free = rings.reduce((best, r) => (r.userData.age > best.userData.age ? r : best), rings[0]);
          const local = e.group.worldToLocal(point.clone());
          free.position.x = Math.max(-0.25, Math.min(0.25, local.x));
          free.position.z = Math.max(-0.25, Math.min(0.25, local.z));
          free.userData.age = 0;
        };
        break;
      case 'balloon':
        e.update = (_dt, ctx) => {
          const f = u.float as Group;
          f.position.y = 1.6 + Math.sin(ctx.time * 0.8) * 0.12 + e.wiggle * 0.2;
          f.position.x = Math.sin(ctx.time * 0.5) * 0.08;
          const tether = u.tether as Line;
          const p = tether.geometry.getAttribute('position');
          p.setXYZ(1, f.position.x, f.position.y - 1.4, 0);
          p.needsUpdate = true;
        };
        break;
      case 'waterfall':
        e.update = (_dt, ctx) => {
          const m = u.mat as ShaderMaterial;
          m.uniforms.uTime.value = ctx.time;
          m.uniforms.uNight.value = ctx.night;
        };
        break;
      default:
        break;
    }
