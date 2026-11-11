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
    for (let i = 0; i < count; i++) {
      const p = this.take(kind);
      p.sprite.position.copy(at).add(new Vector3((Math.random() - 0.5) * 0.12, Math.random() * 0.05, (Math.random() - 0.5) * 0.12));
      p.life = 0;
      p.spin = 0;
      switch (kind) {
        case 'heart':
          p.vel.set((Math.random() - 0.5) * 0.25, 0.45 + Math.random() * 0.25, (Math.random() - 0.5) * 0.25);
          p.max = 1.3; p.size = 0.07 + Math.random() * 0.03; p.grow = 0.03; p.gravity = -0.15;
          break;
        case 'dust':
          p.vel.set((Math.random() - 0.5) * 0.9, 0.15 + Math.random() * 0.3, (Math.random() - 0.5) * 0.9);
          p.max = 0.9 + Math.random() * 0.4; p.size = 0.12 + Math.random() * 0.1; p.grow = 0.35; p.gravity = 0.05;
          break;
        case 'note':
          p.vel.set((Math.random() - 0.5) * 0.12, 0.28, (Math.random() - 0.5) * 0.12);
          p.max = 2.4; p.size = 0.06; p.grow = 0.01; p.gravity = 0;
          p.spin = (Math.random() - 0.5) * 1.2;
          break;
        case 'z':
          p.vel.set(0.08, 0.16, 0.02);
          p.max = 2.6; p.size = 0.04; p.grow = 0.035; p.gravity = 0;
          break;
        case 'leaf':
          p.vel.set((Math.random() - 0.5) * 0.6, 0.2 + Math.random() * 0.3, (Math.random() - 0.5) * 0.6);
          p.max = 1.6; p.size = 0.05; p.grow = 0; p.gravity = 0.55;
          p.spin = (Math.random() - 0.5) * 6;
          break;
        case 'drop':
          p.vel.set((Math.random() - 0.5) * 0.12, -0.15, (Math.random() - 0.5) * 0.12);
          p.max = 0.7; p.size = 0.025; p.grow = 0; p.gravity = 2.2;
          break;
        case 'steam':
          p.vel.set((Math.random() - 0.5) * 0.03, 0.09, (Math.random() - 0.5) * 0.03);
          p.max = 1.8; p.size = 0.03; p.grow = 0.04; p.gravity = 0;
          break;
      }
    }
  }

  /** A flock crossing the sky now and then, by day only. */
  private flyBirds(dt: number, night: number): void {
    if (this.birdT < 0) {
      this.birdClock -= dt;
      if (this.birdClock <= 0 && night < 0.6) {
        this.birdT = 0;
        this.birdDir = Math.random() < 0.5 ? 1 : -1;
        this.birds.position.set(-26 * this.birdDir, 5 + Math.random() * 3, -10 - Math.random() * 8);
        this.birds.visible = true;
      }
      return;
    }
    this.birdT += dt;
    this.birds.position.x += dt * 2.1 * this.birdDir;
    this.birds.position.y += Math.sin(this.birdT * 0.5) * dt * 0.1;
    this.birds.scale.x = this.birdDir;
    for (const b of this.birds.children) {
      const o = b.userData.offset as Vector3;
      b.position.copy(o);
      const flap = Math.sin(this.birdT * 9 + (b.userData.phase as number));
      const pos = (b as Line).geometry.getAttribute('position') as BufferAttribute;
      pos.setY(0, 0.06 + flap * 0.07);
      pos.setY(2, 0.06 + flap * 0.07);
      pos.needsUpdate = true;
    }
    if (Math.abs(this.birds.position.x) > 28) {
      this.birdT = -1;
      this.birds.visible = false;
      this.birdClock = 35 + Math.random() * 50;
    }
  }

  update(dt: number, time: number, night: number, reach: number): void {
    for (const pool of this.pools.values()) {
      for (const p of pool) {
        if (!p.active) continue;
        p.life += dt;
        const k = p.life / p.max;
        if (k >= 1) {
          p.active = false;
          p.sprite.visible = false;
          continue;
        }
        p.vel.y -= p.gravity * dt;
        p.sprite.position.addScaledVector(p.vel, dt);
        p.vel.multiplyScalar(1 - dt * 0.8);
        const s = p.size + p.grow * p.life;
        p.sprite.scale.set(s, s, s);
        const m = p.sprite.material as SpriteMaterial;
