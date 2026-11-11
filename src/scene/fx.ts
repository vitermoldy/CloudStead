import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Group, Line, LineBasicMaterial, Points,
  PointsMaterial, SRGBColorSpace, Sprite, SpriteMaterial, Vector3,
} from 'three';

export type FxKind = 'heart' | 'dust' | 'note' | 'z' | 'leaf' | 'steam' | 'drop';

function glyphTexture(draw: (ctx: CanvasRenderingContext2D) => void): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  draw(ctx);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

const TEXTURES: Record<FxKind, () => CanvasTexture> = {
  heart: () => glyphTexture((ctx) => {
    ctx.fillStyle = '#ef6a45';
    ctx.beginPath();
    ctx.moveTo(32, 54);
    ctx.bezierCurveTo(6, 36, 6, 12, 22, 12);
    ctx.bezierCurveTo(28, 12, 32, 18, 32, 22);
    ctx.bezierCurveTo(32, 18, 36, 12, 42, 12);
    ctx.bezierCurveTo(58, 12, 58, 36, 32, 54);
    ctx.fill();
  }),
  dust: () => glyphTexture((ctx) => {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(236, 222, 196, 0.9)');
    g.addColorStop(1, 'rgba(236, 222, 196, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }),
  steam: () => glyphTexture((ctx) => {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }),
  note: () => glyphTexture((ctx) => {
    ctx.fillStyle = '#f3efd9';
    ctx.font = '700 52px "Funnel Sans Variable", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♪', 32, 34);
  }),
  z: () => glyphTexture((ctx) => {
    ctx.fillStyle = '#f3efd9';
    ctx.font = '600 46px "Funnel Display Variable", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('z', 32, 32);
  }),
  drop: () => glyphTexture((ctx) => {
    ctx.fillStyle = '#9fd0de';
    ctx.beginPath();
    ctx.moveTo(32, 10);
    ctx.bezierCurveTo(44, 30, 46, 40, 32, 52);
    ctx.bezierCurveTo(18, 40, 20, 30, 32, 10);
    ctx.fill();
  }),
  leaf: () => glyphTexture((ctx) => {
    ctx.fillStyle = '#86a046';
    ctx.beginPath();
    ctx.ellipse(32, 32, 10, 22, 0.6, 0, Math.PI * 2);
    ctx.fill();
  }),
};

interface Particle {
  sprite: Sprite;
  vel: Vector3;
  life: number;
  max: number;
  size: number;
  grow: number;
  gravity: number;
  spin: number;
  active: boolean;
}

export class Fx {
  readonly group = new Group();
  private pools = new Map<FxKind, Particle[]>();
  private mats = new Map<FxKind, SpriteMaterial>();
  private fireflies: Points;
  private flyBase: Float32Array;
  private birds = new Group();
  private birdClock = 12;
  private birdT = -1;
  private birdDir = 1;

  constructor() {
    for (const k of Object.keys(TEXTURES) as FxKind[]) {
      this.mats.set(k, new SpriteMaterial({ map: TEXTURES[k](), transparent: true, depthWrite: false, opacity: 0 }));
      this.pools.set(k, []);
    }
    const n = 28;
    const pos = new Float32Array(n * 3);
    this.flyBase = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      this.flyBase.set([(Math.random() - 0.5) * 6, 0.25 + Math.random() * 1.1, (Math.random() - 0.5) * 6, Math.random() * 100], i * 4);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    this.fireflies = new Points(geo, new PointsMaterial({ color: '#ffd77a', size: 0.06, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
    this.fireflies.frustumCulled = false;
    this.group.add(this.fireflies);

    const wing = new LineBasicMaterial({ color: '#1c1a19', transparent: true, opacity: 0.75 });
    for (let i = 0; i < 5; i++) {
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array([-0.22, 0.06, 0, 0, 0, 0, 0.22, 0.06, 0]), 3));
      const b = new Line(g, wing);
      b.userData.offset = new Vector3(-i * 0.5 * (i % 2 ? 1 : -1) * 0.6 - i * 0.45, -i * 0.12, i * 0.35 * (i % 2 ? 1 : -1));
      b.userData.phase = Math.random() * 6;
      this.birds.add(b);
    }
    this.birds.visible = false;
    this.group.add(this.birds);
  }

  private take(kind: FxKind): Particle {
    const pool = this.pools.get(kind)!;
    let p = pool.find((q) => !q.active);
    if (!p) {
      const sprite = new Sprite(this.mats.get(kind)!.clone());
      sprite.renderOrder = 15;
      this.group.add(sprite);
      p = { sprite, vel: new Vector3(), life: 0, max: 1, size: 0.1, grow: 0, gravity: 0, spin: 0, active: false };
      pool.push(p);
    }
    p.active = true;
    p.sprite.visible = true;
    return p;
  }

  spawn(kind: FxKind, at: Vector3, count = 1): void {
