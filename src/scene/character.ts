import {
  BoxGeometry, CanvasTexture, CapsuleGeometry, CylinderGeometry, Euler, Group, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, PlaneGeometry, PointLight, Quaternion, SphereGeometry, SRGBColorSpace, TorusGeometry, Vector3,
  type Camera, type Raycaster,
} from 'three';
import { clamp, damp } from '../core/emitter';
import type { Gear } from '../sim/milestones';

/** Everything the resident can be doing; the seated ones happen at the seat. */
export type Act =
  | 'sitIdle' | 'type' | 'rest' | 'sleep' | 'craft'
  | 'stand' | 'walk' | 'carry' | 'hammer' | 'dig' | 'water' | 'haul' | 'cheer';

export type SeatAct = 'sitIdle' | 'type' | 'rest' | 'sleep' | 'craft';

const SEATED = new Set<Act>(['sitIdle', 'type', 'rest', 'sleep', 'craft']);

/** One thing to do. A plan is a list of these, done in order. */
export type Step =
  | { kind: 'walk'; to: Vector3; carry?: boolean }
  | { kind: 'do'; act: Act; seconds: number; face?: Vector3; beat?: number; onBeat?: (n: number) => void }
  | { kind: 'sit'; act: SeatAct; seconds: number }
  | { kind: 'call'; fn: () => void };

const UP = new Vector3(0, 1, 0);
const L_UPPER = 0.12, L_FORE = 0.11, L_THIGH = 0.14, L_SHIN = 0.135, L_TORSO = 0.17;
const WALK_SPEED = 0.62;

const SKIN = new MeshStandardMaterial({ color: '#d6a27c', roughness: 0.7 });
const HAIR = new MeshStandardMaterial({ color: '#2a211c', roughness: 0.9 });
const HOODIE = new MeshStandardMaterial({ color: '#4d6a39', roughness: 0.9 });
const PANTS = new MeshStandardMaterial({ color: '#363a45', roughness: 0.9 });
const SHOES = new MeshStandardMaterial({ color: '#2a2622', roughness: 0.8 });
const WOOD = new MeshStandardMaterial({ color: '#86603f', roughness: 0.85 });
const IRON = new MeshStandardMaterial({ color: '#55534f', roughness: 0.45, metalness: 0.5 });
const DARK = new MeshBasicMaterial({ color: '#1b1512' });

/** Two-bone reach: from a to the target, bending toward the pole. Writes the joint and the end. */
function reach(a: Vector3, target: Vector3, l1: number, l2: number, pole: Vector3, mid: Vector3, end: Vector3): void {
  const d = target.clone().sub(a);
  const dist = clamp(d.length(), Math.abs(l1 - l2) + 0.002, l1 + l2 - 0.0005);
  const dir = d.lengthSq() > 1e-8 ? d.normalize() : new Vector3(0, -1, 0);
  const cosA = clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  const bend = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)));
  if (bend.lengthSq() < 1e-6) bend.set(0, 0, 1);
  bend.normalize();
  mid.copy(a).addScaledVector(dir, l1 * cosA).addScaledVector(bend, l1 * sinA);
  end.copy(a).addScaledVector(dir, dist);
}

/** Places a capsule of fixed length between two points. */
function span(m: Mesh, p: Vector3, q: Vector3): void {
  const dir = q.clone().sub(p);
  const len = dir.length();
  m.position.copy(p).addScaledVector(dir, 0.5);
  if (len > 1e-6) m.quaternion.setFromUnitVectors(UP, dir.divideScalar(len));
}

function screenTexture(): { tex: CanvasTexture; draw: (lines: number, mode: 'code' | 'rest' | 'sleep' | 'away') => void } {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 84;
  const ctx = canvas.getContext('2d')!;
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  const widths = [0.62, 0.4, 0.75, 0.3, 0.55, 0.68, 0.22, 0.5, 0.8, 0.35, 0.6, 0.45];
  const indents = [0, 1, 1, 2, 2, 1, 0, 1, 2, 2, 1, 0];
  const draw = (lines: number, mode: 'code' | 'rest' | 'sleep' | 'away') => {
    ctx.fillStyle = mode === 'sleep' ? '#0c1016' : '#16202b';
    ctx.fillRect(0, 0, 128, 84);
    if (mode === 'sleep') {
      tex.needsUpdate = true;
      return;
    }
    if (mode === 'rest' || mode === 'away') {
      // Resting: a moon. Away at work: the island's plan, a grid of cells.
      if (mode === 'rest') {
        ctx.fillStyle = '#e9b46a';
        ctx.beginPath();
        ctx.arc(64, 42, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#16202b';
        ctx.beginPath();
        ctx.arc(70, 37, 11, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = '#9fc7a0';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) ctx.strokeRect(34 + i * 15, 18 + j * 15, 13, 13);
        ctx.fillStyle = '#e9b46a';
        ctx.fillRect(34 + 45 + 2, 18 + 30 + 2, 9, 9);
      }
      tex.needsUpdate = true;
      return;
    }
    const cols = ['#9fc7a0', '#e9b46a', '#b9c4d6', '#d98b6a'];
    for (let i = 0; i < 9; i++) {
      const k = (lines + i) % widths.length;
      ctx.fillStyle = cols[(k * 7 + i) % cols.length];
      ctx.globalAlpha = i === 8 ? 1 : 0.85;
      ctx.fillRect(8 + indents[k] * 9, 6 + i * 8.4, widths[k] * 90, 4);
    }
    ctx.globalAlpha = 1;
    tex.needsUpdate = true;
  };
  return { tex, draw };
}

type GeoMaker = BoxGeometry | CylinderGeometry | SphereGeometry | TorusGeometry;

/** A gear piece as a fresh model (used both for the finished piece and for the one in the making). */
export function makeGear(kind: Gear): Group {
  const g = new Group();
  const m = (geo: GeoMaker, color: string, rough = 0.85) => new Mesh(geo, new MeshStandardMaterial({ color, roughness: rough }));
  switch (kind) {
    case 'cushion': {
      const c = m(new BoxGeometry(0.34, 0.06, 0.3), '#a4553b');
      c.position.y = 0.03;
      const seam = m(new BoxGeometry(0.35, 0.012, 0.31), '#8a4430');
      seam.position.y = 0.03;
      g.add(c, seam);
      break;
    }
    case 'books': {
      ['#8c3b2e', '#2f4b5e', '#c9a75c'].forEach((col, i) => {
        const b = m(new BoxGeometry(0.15 - i * 0.012, 0.035, 0.11), col);
        b.position.set(0, 0.018 + i * 0.036, 0);
        b.rotation.y = (i - 1) * 0.18;
        g.add(b);
      });
      break;
    }
    case 'mug': {
      const cup = m(new CylinderGeometry(0.028, 0.025, 0.06, 12), '#efe8d6', 0.5);
      cup.position.y = 0.03;
      const handle = m(new TorusGeometry(0.016, 0.005, 5, 10), '#efe8d6', 0.5);
      handle.position.set(0.03, 0.032, 0);
      const tea = m(new CylinderGeometry(0.024, 0.024, 0.005, 12), '#7a4a2a', 0.3);
      tea.position.y = 0.058;
      g.add(cup, handle, tea);
      break;
    }
    case 'headphones': {
      const band = m(new TorusGeometry(0.093, 0.009, 5, 18, Math.PI), '#2b2b2e', 0.5);
      const cupGeo = new CylinderGeometry(0.03, 0.03, 0.025, 12);
      const l = m(cupGeo, '#2b2b2e', 0.5);
      const r = m(cupGeo, '#2b2b2e', 0.5);
      l.rotation.z = Math.PI / 2;
      r.rotation.z = Math.PI / 2;
      l.position.x = 0.093;
      r.position.x = -0.093;
      g.add(band, l, r);
      break;
    }
    case 'scarf': {
      const ring = m(new TorusGeometry(0.06, 0.024, 6, 14), '#c05a3c');
      ring.rotation.x = Math.PI / 2;
      const tail = m(new BoxGeometry(0.04, 0.11, 0.015), '#c05a3c');
      tail.position.set(0.03, -0.06, 0.06);
      tail.rotation.z = 0.15;
      g.add(ring, tail);
      break;
    }
    case 'beanie': {
      const cap = m(new SphereGeometry(0.094, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), '#d6ab45');
      const rim = m(new TorusGeometry(0.088, 0.016, 6, 18), '#c29835');
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.01;
      const pom = m(new SphereGeometry(0.025, 8, 6), '#efe6cf');
      pom.position.y = 0.1;
      g.add(cap, rim, pom);
      break;
    }
  }
  g.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return g;
}

/** Textiles are knitted or sewn; the rest is put together by hand. */
const KNITTED = new Set<Gear>(['cushion', 'scarf', 'beanie']);

export class Character {
  readonly root = new Group();
  /** What stays at the seat while the resident walks off: the laptop, the crate, the cushion, the books, the mug. */
  readonly seat = new Group();
  private rig = new Group();
  readonly home = new Vector3(0, 0, 0);
  heading = 0;
  act: Act = 'sitIdle';
  name = 'VMK';
  /** Called when a plan runs out, so the world can hand over the next one. */
  onPlanDone: (() => void) | null = null;

  private plan: Step[] = [];
  private stepT = 0;
  private beats = 0;
  private sit = 1;
  private hipY = 0.09;
  private spine = new Vector3(0, 1, 0.1).normalize();
  private hands = [new Vector3(0.1, 0.2, 0.12), new Vector3(-0.1, 0.2, 0.12)];
  private feet = [new Vector3(-0.08, 0.03, 0.13), new Vector3(0.08, 0.03, 0.11)];
  private headYaw = 0;
  private headPitch = 0.3;
  private headRoll = 0;
  private walkPhase = 0;
  private blink = 0;
  private nextBlink = 2;
  private screenTick = 0;
  private screenLines = 0;
  private waveT = 0;
  private pokeT = 0;
  private sipT = 0;
  private nextSip = 8;
  private stretchT = 0;
  private nextStretch = 3;
  private workT = 0;
  petting = false;
  private petAmount = 0;
  private happy = 0;
  /** What the pointer or the work asks the head to look at. */
  looking: Vector3 | null = null;
  private workPoint: Vector3 | null = null;
  private lookWander = new Vector3(0, 0.5, 3);
  private wanderClock = 0;
  musicOn = false;

  private torso: Mesh;
  private hood: Mesh;
  private head = new Group();
  private eyes: Mesh[] = [];
  private happyEyes: Mesh[] = [];
  private mouth: Mesh;
  private blush: Mesh[] = [];
  private upper: Mesh[] = [];
  private fore: Mesh[] = [];
  private palms: Mesh[] = [];
  private thighs: Mesh[] = [];
  private shins: Mesh[] = [];
  private shoes: Mesh[] = [];
  private laptop = new Group();
  private screen: ReturnType<typeof screenTexture>;
  private screenLight: PointLight;
  private tools: Record<'hammer' | 'shovel' | 'can' | 'plank' | 'yarn', Group> = {
    hammer: new Group(), shovel: new Group(), can: new Group(), plank: new Group(), yarn: new Group(),
  };
  private craftPiece: Group | null = null;
  private craftKind: Gear | null = null;
  private gear = new Map<Gear, Group>();
  private hitBody: Mesh;
  private hitHead: Mesh;
  private readonly crate: Group;
  readonly spout = new Vector3();
  readonly blade = new Vector3();
  readonly grip = new Vector3();

  constructor() {
    this.root.add(this.rig);
    this.torso = new Mesh(new CapsuleGeometry(0.078, L_TORSO - 0.1, 4, 10), HOODIE);
    this.hood = new Mesh(new TorusGeometry(0.055, 0.03, 6, 12), HOODIE);
    this.rig.add(this.torso, this.hood);

    const skull = new Mesh(new SphereGeometry(0.085, 18, 14), SKIN);
    const hair = new Mesh(new SphereGeometry(0.091, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), HAIR);
    hair.rotation.x = -0.35;
    hair.position.set(0, 0.012, -0.008);
    const fringe = new Mesh(new BoxGeometry(0.12, 0.03, 0.04), HAIR);
    fringe.position.set(0.0, 0.055, 0.06);
    fringe.rotation.x = 0.5;
    this.head.add(skull, hair, fringe);
    for (const s of [-1, 1]) {
      const eye = new Mesh(new SphereGeometry(0.011, 8, 6), DARK);
      eye.position.set(s * 0.03, 0.005, 0.078);
      eye.scale.set(1, 1.3, 0.6);
      this.eyes.push(eye);
      const arc = new Mesh(new TorusGeometry(0.012, 0.0035, 4, 8, Math.PI), DARK);
      arc.position.set(s * 0.03, 0.0, 0.079);
      arc.visible = false;
      this.happyEyes.push(arc);
      const cheek = new Mesh(new SphereGeometry(0.013, 8, 6), new MeshBasicMaterial({ color: '#e07a62', transparent: true, opacity: 0 }));
      cheek.position.set(s * 0.05, -0.02, 0.068);
      cheek.scale.set(1, 0.6, 0.3);
      this.blush.push(cheek);
      const ear = new Mesh(new SphereGeometry(0.018, 8, 6), SKIN);
      ear.position.set(s * 0.083, -0.005, 0);
      this.head.add(eye, arc, cheek, ear);
    }
    this.mouth = new Mesh(new TorusGeometry(0.013, 0.003, 4, 10, Math.PI), DARK);
    this.mouth.position.set(0, -0.032, 0.078);
    this.mouth.rotation.z = Math.PI;
    this.head.add(this.mouth);
    this.rig.add(this.head);

    for (let i = 0; i < 2; i++) {
      this.upper.push(new Mesh(new CapsuleGeometry(0.03, L_UPPER - 0.06, 4, 8), HOODIE));
      this.fore.push(new Mesh(new CapsuleGeometry(0.026, L_FORE - 0.05, 4, 8), HOODIE));
      this.palms.push(new Mesh(new SphereGeometry(0.023, 8, 6), SKIN));
      this.thighs.push(new Mesh(new CapsuleGeometry(0.038, L_THIGH - 0.07, 4, 8), PANTS));
      this.shins.push(new Mesh(new CapsuleGeometry(0.032, L_SHIN - 0.06, 4, 8), PANTS));
      this.shoes.push(new Mesh(new BoxGeometry(0.05, 0.035, 0.085), SHOES));
    }
    this.rig.add(...this.upper, ...this.fore, ...this.palms, ...this.thighs, ...this.shins, ...this.shoes);

    // The laptop: on the lap while typing, on the ground beside the seat otherwise.
    this.screen = screenTexture();
    this.screen.draw(0, 'code');
    const base = new Mesh(new BoxGeometry(0.17, 0.012, 0.115), new MeshStandardMaterial({ color: '#c9c6bd', roughness: 0.4, metalness: 0.4 }));
    const lid = new Group();
    lid.position.set(0, 0.006, -0.055);
    lid.rotation.x = -0.32;
    const lidBack = new Mesh(new BoxGeometry(0.17, 0.11, 0.008), base.material);
    lidBack.position.set(0, 0.055, -0.004);
    const face = new Mesh(new PlaneGeometry(0.155, 0.096), new MeshBasicMaterial({ map: this.screen.tex }));
    face.position.set(0, 0.055, 0.0012);
    lid.add(lidBack, face);
    this.laptop.add(base, lid);
    this.screenLight = new PointLight('#a9c6ff', 0, 0.7, 1.6);
    this.screenLight.position.set(0, 0.09, 0.05);
    this.laptop.add(this.screenLight);
    this.seat.add(this.laptop);

    // The crate the building material comes from, behind the seat.
    this.crate = new Group();
    const box = new Mesh(new BoxGeometry(0.2, 0.13, 0.16), WOOD);
    box.position.y = 0.065;
    const lidBar = new Mesh(new BoxGeometry(0.21, 0.02, 0.03), new MeshStandardMaterial({ color: '#5c4029' }));
    lidBar.position.set(0, 0.13, 0);
    const planks = new Mesh(new BoxGeometry(0.06, 0.04, 0.18), new MeshStandardMaterial({ color: '#b08a5c' }));
    planks.position.set(0.03, 0.15, 0);
    this.crate.add(box, lidBar, planks);
    this.crate.position.set(0.3, 0, -0.3);
    this.crate.rotation.y = 0.3;
    this.seat.add(this.crate);

    this.buildTools();

    const ghost = new MeshBasicMaterial({ visible: false });
    this.hitBody = new Mesh(new CapsuleGeometry(0.16, 0.22, 4, 8), ghost);
    this.hitHead = new Mesh(new SphereGeometry(0.12, 10, 8), ghost);
    this.root.add(this.hitBody, this.hitHead);

    for (const group of [this.root, this.seat]) group.traverse((o) => {
      if ((o as Mesh).isMesh && o !== this.hitBody && o !== this.hitHead) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.root.position.copy(this.home);
    this.seat.position.copy(this.home);
  }

  /** Hammer, shovel, watering can, a plank to carry, yarn and needles. Each hangs off the right hand. */
  private buildTools(): void {
    const t = this.tools;
    const handle = new Mesh(new BoxGeometry(0.02, 0.15, 0.02), new MeshStandardMaterial({ color: '#7a5636' }));
    handle.position.y = 0.04;
    const head = new Mesh(new BoxGeometry(0.07, 0.03, 0.03), IRON);
    head.position.y = 0.11;
    t.hammer.add(handle, head);

    const shaft = new Mesh(new CylinderGeometry(0.008, 0.008, 0.36, 5), new MeshStandardMaterial({ color: '#7a5636' }));
    shaft.position.y = -0.1;
    const spade = new Mesh(new BoxGeometry(0.07, 0.08, 0.008), IRON);
    spade.position.y = -0.3;
    t.shovel.add(shaft, spade);

    const can = new Mesh(new CylinderGeometry(0.035, 0.04, 0.07, 10), new MeshStandardMaterial({ color: '#6f8f86', roughness: 0.5, metalness: 0.3 }));
    can.position.set(0, -0.04, 0.03);
    const spout = new Mesh(new CylinderGeometry(0.006, 0.009, 0.09, 5), can.material);
    spout.position.set(0, -0.02, 0.1);
    spout.rotation.x = 1.1;
    t.can.add(can, spout);

    const plank = new Mesh(new BoxGeometry(0.3, 0.03, 0.07), new MeshStandardMaterial({ color: '#b08a5c', roughness: 0.9 }));
    const plank2 = plank.clone();
    plank2.position.y = 0.032;
    plank2.rotation.y = 0.12;
    t.plank.add(plank, plank2);

    const ball = new Mesh(new SphereGeometry(0.03, 10, 8), new MeshStandardMaterial({ color: '#c05a3c' }));
    ball.position.set(0.09, -0.02, 0.02);
    const needle = new Mesh(new CylinderGeometry(0.003, 0.003, 0.12, 4), IRON);
    needle.rotation.z = 0.9;
    t.yarn.add(ball, needle);

    for (const g of Object.values(t)) {
      g.visible = false;
      this.rig.add(g);
    }
  }

  // ------------------------------------------------------------ gear
  setGear(kind: Gear, on: boolean): Group | null {
    const had = this.gear.get(kind);
    if (!on) {
      if (had) {
        had.removeFromParent();
        this.gear.delete(kind);
      }
      return null;
    }
    if (had) return had;
    const g = makeGear(kind);
    switch (kind) {
      case 'cushion':
        this.seat.add(g);
        break;
      case 'books':
        g.position.set(0.3, 0, 0.06);
        this.seat.add(g);
        break;
      case 'mug':
        g.position.set(-0.27, 0, 0.13);
        g.userData.rest = g.position.clone();
        this.seat.add(g);
        break;
      case 'scarf':
        this.rig.add(g);
        break;
      case 'beanie':
        g.position.set(0, 0.02, -0.005);
        g.rotation.x = -0.15;
        this.head.add(g);
        break;
      default:
        break;
    }
    this.gear.set(kind, g);
    this.place(kind);
    return g;
  }

  hasGear(kind: Gear): boolean {
    return this.gear.has(kind);
  }

  clearGear(): void {
    for (const k of [...this.gear.keys()]) this.setGear(k, false);
  }

  /** The piece in the making on the lap, growing with the work (null puts it away). */
  setCraft(kind: Gear | null, p = 0): void {
    if (kind !== this.craftKind) {
      this.craftPiece?.removeFromParent();
      this.craftPiece = kind ? makeGear(kind) : null;
      this.craftKind = kind;
      if (this.craftPiece) this.rig.add(this.craftPiece);
    }
    if (this.craftPiece) this.craftPiece.userData.p = p;
  }

  /** Headphones go on the ears with the music and rest round the neck without it. */
  private place(kind: Gear): void {
    const g = this.gear.get(kind);
    if (!g || kind !== 'headphones') return;
    if (this.musicOn) {
      this.head.add(g);
      g.position.set(0, 0.01, -0.005);
      g.rotation.set(0, 0, 0);
      g.userData.neck = false;
    } else {
      this.rig.add(g);
      g.userData.neck = true;
    }
  }

  setMusic(on: boolean): void {
    if (on === this.musicOn) return;
    this.musicOn = on;
    if (this.gear.has('headphones')) {
      this.gear.get('headphones')!.removeFromParent();
      this.place('headphones');
    }
  }

  // ------------------------------------------------------------ plans
  /** Replaces whatever the resident was doing with a new plan. */
  run(steps: Step[]): void {
    this.plan = steps;
    this.stepT = 0;
    this.beats = 0;
  }

  get busy(): boolean {
    return this.plan.length > 0;
  }

  get seated(): boolean {
    return this.sit > 0.5;
  }

  get atHome(): boolean {
    return this.root.position.distanceTo(this.home) < 0.05;
  }

  /** The seated act the resident is in, or null when up. */
  get seatAct(): SeatAct | null {
    return SEATED.has(this.act) ? (this.act as SeatAct) : null;
  }

  wave(): void {
    this.waveT = 1.6;
  }

  poke(): void {
    this.pokeT = 0.5;
  }

  private next(): void {
    this.plan.shift();
    this.stepT = 0;
    this.beats = 0;
    if (!this.plan.length) this.onPlanDone?.();
  }

  private runPlan(dt: number): void {
    const step = this.plan[0];
    const pos = this.root.position;
    if (!step) {
      // Nothing planned: sit if at the seat, otherwise stand and look round.
      this.act = this.atHome && this.seated ? (this.seatAct ?? 'sitIdle') : 'stand';
      this.workPoint = null;
      return;
    }
    const turnTo = (x: number, z: number, rate = 8) => {
      const want = Math.atan2(x - pos.x, z - pos.z);
      let d = want - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += d * Math.min(1, dt * rate);
    };
    switch (step.kind) {
      case 'call':
        step.fn();
        this.next();
        return;
      case 'walk': {
        this.workPoint = null;
        // Get up first.
        if (this.sit > 0.2) {
          this.act = 'stand';
          return;
        }
        this.act = step.carry ? 'carry' : 'walk';
        const dx = step.to.x - pos.x, dz = step.to.z - pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.02) turnTo(step.to.x, step.to.z, 10);
        const move = Math.min(d, dt * WALK_SPEED * (step.carry ? 0.8 : 1));
        if (d > 1e-4) {
          pos.x += (dx / d) * move;
          pos.z += (dz / d) * move;
        }
        if (d < 0.025) this.next();
        return;
      }
      case 'do': {
        if (this.sit > 0.2 && !SEATED.has(step.act)) {
          this.act = 'stand';
          return;
        }
        this.act = step.act;
        this.workPoint = step.face ?? null;
        if (step.face) turnTo(step.face.x, step.face.z, 9);
        this.stepT += dt;
        if (step.beat && step.onBeat) {
          const n = Math.floor(this.stepT / step.beat);
          if (n > this.beats) {
            this.beats = n;
            step.onBeat(n);
          }
        }
        if (this.stepT >= step.seconds) this.next();
        return;
      }
      case 'sit': {
        this.workPoint = null;
        let d = 0 - this.heading;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.heading += d * Math.min(1, dt * 6);
        pos.lerp(this.home, Math.min(1, dt * 6));
        this.act = step.act;
        this.stepT += dt;
        if (this.stepT >= step.seconds) this.next();
        return;
      }
    }
  }

  // ------------------------------------------------------------ picking and anchors
  pick(ray: Raycaster): 'head' | 'body' | null {
    if (ray.intersectObject(this.hitHead, false).length) return 'head';
    if (ray.intersectObject(this.hitBody, false).length) return 'body';
    return null;
  }

  bubbleAnchor(camera: Camera, w: number, h: number): { x: number; y: number; visible: boolean } {
    const p = new Vector3(0, 0.2, 0);
    this.head.localToWorld(p);
    p.project(camera);
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, visible: p.z < 1 };
  }

  headWorld(out = new Vector3()): Vector3 {
    return this.head.getWorldPosition(out);
  }

  /** Between the two hands, in the world: where a hauled rope starts. */
  handsWorld(out = new Vector3()): Vector3 {
    out.copy(this.hands[0]).add(this.hands[1]).multiplyScalar(0.5);
    return this.root.localToWorld(out);
  }

  // ------------------------------------------------------------ frame
  update(dt: number, time: number): void {
    this.runPlan(dt);
    const act = this.act;
    const sitTarget = SEATED.has(act) ? 1 : 0;
    this.sit = damp(this.sit, sitTarget, 5, dt);
    const cushion = this.gear.has('cushion') ? 0.055 : 0;
    const seatedHip = 0.085 + cushion;
    const breathe = Math.sin(time * 1.7) * 0.004;
    this.workT += dt;
    const digC = (this.workT % 1.3) / 1.3;
    const dip = act === 'dig' ? Math.max(0, Math.sin(digC * Math.PI * 2)) * 0.05 : 0;
    const crouch = act === 'hammer' ? 0.03 : act === 'dig' ? 0.02 + dip * 0.4 : act === 'water' ? 0.015 : 0;
    this.hipY = seatedHip * this.sit + (0.255 - crouch) * (1 - this.sit) + breathe * 0.3;

    // ---- spine
    const lean = new Vector3(0, 1, 0.06);
    switch (act) {
      case 'type': lean.set(0, 1, 0.32); break;
      case 'craft': lean.set(0, 1, 0.26); break;
      case 'rest': lean.set(0, 1, this.stretchT > 0 ? -0.05 : -0.12); break;
      case 'sleep': lean.set(0.05, 1, 0.42); break;
      case 'walk': lean.set(0, 1, 0.12); break;
      case 'carry': lean.set(0, 1, 0.04); break;
      case 'hammer': lean.set(0, 1, 0.28); break;
      case 'dig': lean.set(0, 1, 0.3 + dip * 2); break;
      case 'water': lean.set(0, 1, 0.16); break;
      case 'haul': lean.set(0, 1, -0.2 + Math.sin(time * 4) * 0.04); break;
      case 'stand': lean.set(0, 1, 0.03); break;
      default: break;
    }
    if (this.petAmount > 0.01) lean.x += Math.sin(time * 3) * 0.06 * this.petAmount;
    lean.normalize();
    this.spine.lerp(lean, 1 - Math.exp(-6 * dt)).normalize();

    const pelvis = new Vector3(0, this.hipY, -0.02);
    const neck = pelvis.clone().addScaledVector(this.spine, L_TORSO + breathe);
    const side = new Vector3(1, 0, 0);
    const forward = new Vector3().crossVectors(side, this.spine).normalize();
    side.crossVectors(this.spine, forward).normalize();
    span(this.torso, pelvis, neck);
    this.hood.position.copy(neck).addScaledVector(forward, -0.035).addScaledVector(this.spine, -0.005);
    this.hood.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), this.spine.clone().multiplyScalar(0.6).add(forward.clone().multiplyScalar(-0.4)).normalize());
    const scarf = this.gear.get('scarf');
    if (scarf) {
      scarf.position.copy(neck).addScaledVector(this.spine, -0.01);
      scarf.quaternion.setFromUnitVectors(UP, this.spine);
    }

    // ---- legs
    const moving = act === 'walk' || act === 'carry';
    if (moving) this.walkPhase += dt * (act === 'carry' ? 7.5 : 9);
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? 1 : -1;
      const seatedFoot = new Vector3(-s * 0.075, 0.035 + cushion * 0.6, 0.12 - i * 0.015);
      const ph = this.walkPhase + i * Math.PI;
      const standFoot = new Vector3(s * (act === 'haul' ? 0.06 : 0.05), moving ? Math.max(0, Math.sin(ph)) * 0.045 : 0.0, moving ? Math.cos(ph) * 0.075 : act === 'haul' ? (i ? -0.06 : 0.05) : 0.01);
      if (act === 'cheer') standFoot.y = Math.max(0, Math.sin(time * 9 + i)) * 0.02;
      const target = standFoot.lerp(seatedFoot, this.sit);
      const pole = new Vector3(s * this.sit, 0.6 * this.sit, 1);
      this.feet[i].lerp(target, 1 - Math.exp(-14 * dt));
      const hip = pelvis.clone().addScaledVector(side, s * 0.045);
      const knee = new Vector3(), foot = new Vector3();
      reach(hip, this.feet[i], L_THIGH, L_SHIN, pole, knee, foot);
      span(this.thighs[i], hip, knee);
      span(this.shins[i], knee, foot);
      this.shoes[i].position.copy(foot).add(new Vector3(0, -0.005, 0.02));
      this.shoes[i].rotation.y = this.sit * -s * 1.2;
    }

    // ---- arms
    const shoulders = [neck.clone().addScaledVector(side, 0.09).addScaledVector(this.spine, -0.03), neck.clone().addScaledVector(side, -0.09).addScaledVector(this.spine, -0.03)];
    const lapY = this.hipY + 0.07;
    const onLap = (act === 'type' || act === 'sitIdle' || act === 'sleep') && this.atHome ? 1 : 0;
    const laptopLap = new Vector3(0, lapY - 0.012, 0.15);
    const laptopGround = new Vector3(-0.2, 0.006, 0.26);
    const lk = clamp(this.sit * 1.4 - 0.4, 0, 1) * onLap;
    this.laptop.position.lerp(laptopGround.clone().lerp(laptopLap, lk), 1 - Math.exp(-8 * dt));
    this.laptop.rotation.y = (1 - lk) * 0.5;
    const R = 1;
    const targets = [new Vector3(), new Vector3()];
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? 1 : -1;
      const t = targets[i];
      switch (act) {
        case 'type': {
          const tap = Math.max(0, Math.sin(time * 15 + i * 2.1 + Math.sin(time * 3.3 + i) * 2)) * 0.012;
          t.set(s * 0.045, lapY + 0.012 + tap, 0.15);
          break;
        }
        case 'craft':
          t.set(s * 0.035 + Math.sin(time * 7 + i * 2) * 0.012, lapY + 0.035 + Math.cos(time * 7 + i * 1.3) * 0.01, 0.14);
          break;
        case 'rest':
          if (this.stretchT > 0) t.set(s * 0.07, this.hipY + 0.47, -0.02);
          else t.set(s * 0.17, this.hipY - 0.03, -0.13);
          break;
        case 'sleep':
          t.set(s * 0.06, lapY + 0.02, 0.1);
          break;
        case 'walk': {
          const ph = this.walkPhase + i * Math.PI + Math.PI;
          t.set(s * 0.12, this.hipY + 0.02, Math.cos(ph) * 0.07);
          break;
        }
        case 'carry':
          t.set(s * 0.075, this.hipY + 0.17, 0.13);
          break;
        case 'hammer':
          t.set(s * 0.09, this.hipY + 0.08, 0.15);
          break;
        case 'dig':
          t.set(i === R ? -0.035 : 0.035, (i === R ? this.hipY + 0.26 : this.hipY + 0.12) - dip, i === R ? 0.06 : 0.14);
          break;
        case 'water':
          t.set(s * 0.12, this.hipY - 0.02, 0.02);
          break;
        case 'haul': {
          const ph = time * 4 + i * Math.PI;
          t.set(s * 0.03, this.hipY + 0.17 + Math.sin(ph) * 0.04, 0.12 + Math.cos(ph) * 0.06);
          break;
        }
        case 'cheer':
