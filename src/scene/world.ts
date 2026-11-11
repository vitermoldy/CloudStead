import {
  ACESFilmicToneMapping, BufferGeometry, DirectionalLight, Fog, HemisphereLight, Line, LineBasicMaterial, PCFShadowMap,
  PerspectiveCamera, Plane, Raycaster, Scene, SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Emitter, clamp } from '../core/emitter';
import { HOME, MILESTONES, START_PROPS, cellKey, tilesFor, type Cell, type Milestone } from '../sim/milestones';
import { Character, type Step } from './character';
import { createClouds, type Clouds } from './clouds';
import { Fx } from './fx';
import { Island } from './island';
import { LiveLook, LOOKS, lookForHour, type TimeId } from './palette';
import { PropsLayer, type PropEntry } from './props';
import { PropSite } from './site';
import { createSky } from './sky';

export type TimeMode = TimeId | 'auto';

export interface Hover {
  kind: 'char' | 'prop' | 'tile' | 'ghost' | null;
  part?: 'head' | 'body';
  prop?: PropEntry;
  cell?: Cell;
}

export type WorkMode = 'work' | 'rest' | 'free';

const PRESS_TO_PET = 0.45;

/**
 * The live island. Events: hover (Hover), greet, pet (bool), poke-prop (PropEntry), built (Milestone),
 * knock, land, ink (luminance 0..1), ready.
 */
export class World extends Emitter {
  readonly renderer: WebGLRenderer;
  readonly camera = new PerspectiveCamera(32, 1, 0.1, 1500);
  readonly scene = new Scene();
  readonly controls: OrbitControls;
  readonly island = new Island();
  readonly props = new PropsLayer();
  readonly character = new Character();
  readonly fx = new Fx();
  private clouds: Clouds;
  private sky = createSky();
  private sun = new DirectionalLight('#ffffff', 2);
  private hemi = new HemisphereLight('#ffffff', '#444444', 0.6);
  /** Light thrown back by the cloud sea onto the faces that turn from the sun. */
  private bounce = new DirectionalLight('#ffffff', 0.5);
  private look = new LiveLook();
  private target = new LiveLook();
  private timeMode: TimeMode = 'senja';
  private clockCheck = 0;
  private ray = new Raycaster();
  private ndc = new Vector2(9, 9);
  private pointerIn = false;
  private hoverDirty = true;
  hover: Hover = { kind: null };
  private press: { x: number; y: number; t: number; on: 'char' | 'prop' | 'tile' | null; moved: boolean; petting: boolean; prop?: PropEntry; point?: Vector3 } | null = null;
  private dragging = false;
  private mode: WorkMode = 'free';
  private project: Milestone | null = null;
  private p = 0;
  private site: PropSite | null = null;
  private approach: Vector3 | null = null;
  private loopN = 0;
  private replan = true;
  private celebrating = false;
  private rope: Line;
  private ropeCell: Cell | null = null;
  private tweens: ((dt: number) => boolean)[] = [];
  private refitT = 0;
  private time = 0;
  private last = performance.now();
  private paused = false;
  private instant = false;
  private dist = 14;
  private idleFor = 0;
  private noteClock = 0;
  private zClock = 0;
  private steamClock = 0;
  private heartClock = 0;
  private lookHold = 0;
  private lookPoint = new Vector3();
  private frameMs = 16;
  private pixelRatio: number;
  private maxRatio: number;
  private inkRects: () => DOMRect[] = () => [];
  private inkClock = 0;
  private moving = false;
  private context = { night: 0, time: 0, todayMinutes: 0, totalMinutes: 0 };
  onFrame: ((dt: number) => void) | null = null;

  constructor(private canvas: HTMLCanvasElement, opts: { small: boolean }) {
    super();
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.maxRatio = Math.min(window.devicePixelRatio || 1, opts.small ? 1.6 : 2);
    this.pixelRatio = this.maxRatio;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    // Pieces under construction are cut at their progress line.
    this.renderer.localClippingEnabled = true;

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(opts.small ? 1024 : 2048, opts.small ? 1024 : 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 3;
    this.bounce.position.set(-0.5, -0.35, 0.8);
    this.scene.add(this.sun, this.sun.target, this.hemi, this.bounce);
    this.scene.fog = new Fog('#7d6656', 35, 150);
    this.scene.add(this.sky.mesh);
    this.clouds = createClouds(opts.small ? 240 : 380);
    this.scene.add(this.clouds.mesh);
    this.scene.add(this.island.group, this.props.group, this.character.root, this.character.seat, this.fx.group);

    this.camera.position.set(0, 9, 12);
    this.bindPointer();
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.7;
    this.controls.minPolarAngle = 0.5;
    this.controls.maxPolarAngle = 1.36;
    this.controls.target.set(0, 0.25, 0);
    this.controls.addEventListener('start', () => {
      this.dragging = true;
      this.emitHover();
    });
    this.controls.addEventListener('end', () => {
      this.dragging = false;
      this.emitHover();
    });
    this.controls.addEventListener('change', () => {
      this.hoverDirty = true;
      this.moving = true;
    });

    this.rope = new Line(new BufferGeometry().setFromPoints([new Vector3(), new Vector3(), new Vector3(), new Vector3()]), new LineBasicMaterial({ color: '#c9a472' }));
    this.rope.frustumCulled = false;
    this.rope.visible = false;
    this.scene.add(this.rope);
    this.character.onPlanDone = () => {
      this.replan = true;
    };

    this.island.onLanded = (cell) => {
      this.fx.spawn('dust', new Vector3(cell[0], 0.05, cell[1]), 8);
      this.emit('land');
      // Step back so the grown island stays in frame.
      const before = this.dist;
      this.fitDistance(this.island.reach());
      if (this.dist > before) {
        if (this.paused || this.instant) {
          const dir = this.camera.position.clone().sub(this.controls.target).normalize();
          this.camera.position.copy(this.controls.target).addScaledVector(dir, this.dist);
          this.controls.update();
        } else this.refitT = 3;
      }
    };
    this.look.set(LOOKS.senja);
    this.target.set(LOOKS.senja);
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  // ------------------------------------------------------------ setup from progress
  /** Makes the island match the reached milestones at once (first load, import, reset, preview). */
  sync(reached: Set<string>): void {
    this.endProject();
    this.celebrating = false;
    this.character.settle();
    this.props.clear();
    this.island.clearBare();
    this.character.clearGear();
    const done = MILESTONES.filter((m) => reached.has(m.id));
    this.island.setTiles(tilesFor(done));
    for (const p of START_PROPS) this.addProp(p.prop, p.at, false);
    for (const m of done) {
      if (m.kind === 'prop' && m.prop && m.at) this.addProp(m.prop, m.at, false);
      if (m.kind === 'gear' && m.gear) this.character.setGear(m.gear, true);
    }
    this.updateGhosts(reached);
    this.replan = true;
    this.frame();
  }

  private addProp(kind: NonNullable<Milestone['prop']>, at: Cell, animate: boolean): PropEntry {
    const e = this.props.add(kind, at, animate);
    if (kind === 'pond') this.island.setBare(at, 'none');
    if (kind === 'garden' || kind === 'hut' || kind === 'hut-frame') this.island.setBare(at, 'edges');
    return e;
  }

  /** Dashed outlines for the cells the current tile project brings. */
  updateGhosts(reached: Set<string>): void {
    const upcoming = MILESTONES.find((m) => !reached.has(m.id));
    const tiles = upcoming && upcoming.kind === 'tiles' ? upcoming : null;
    this.island.setGhosts(tiles?.tiles ?? []);
    this.ghostMilestone = tiles;
  }

  ghostMilestone: Milestone | null = null;

  // ------------------------------------------------------------ the resident's work
  //
  // The island never changes by itself. Each milestone is a project the resident works on while
  // the visitor focuses: the progress line (0..1) decides how much of it stands, and the resident
  // is seen doing the work: hammering and carrying planks, digging and watering, hauling new
  // cells up from the clouds on a rope, or making a piece by hand at the seat.

  /** work: a focus block runs; rest: a break; free: no timer. */
  setWork(mode: WorkMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    if (mode !== 'free') this.idleFor = 0;
    if (!this.celebrating) this.replan = true;
    this.applyProgress();
  }

  get workMode(): WorkMode {
    return this.mode;
  }

  /** The next milestone and how far its work has got (0..1). */
  setProgress(m: Milestone | null, p: number): void {
    if (m?.id !== this.project?.id) this.startProject(m);
    const next = Math.max(0, Math.min(1, p));
    if (Math.abs(next - this.p) < 0.0004 && this.project === m) return;
    this.p = next;
    this.applyProgress();
  }

  get currentProject(): Milestone | null {
    return this.project;
  }

  private startProject(m: Milestone | null): void {
    this.endProject();
    this.project = m;
    this.loopN = 0;
    if (!m) return;
    if (m.kind === 'prop' && m.prop && m.at) {
      this.approach = this.standPoint(m.at);
      const target = new Vector3(m.at[0], 0, m.at[1]);
      const pileAt = this.approach && m.work === 'build'
        ? this.approach.clone().lerp(target, 0.2).add(new Vector3(this.approach.z - target.z, 0, target.x - this.approach.x).normalize().multiplyScalar(0.22))
        : null;
      this.site = new PropSite(m.prop, m.at, pileAt);
      this.scene.add(this.site.group);
    } else if (m.kind === 'tiles' && m.tiles) {
      this.island.addPending(m.tiles);
    }
    if (!this.celebrating) this.replan = true;
  }

  private endProject(): void {
    this.site?.dispose();
    this.site = null;
    this.rope.visible = false;
    this.character.setCraft(null);
    this.project = null;
    this.approach = null;
  }

  /** Puts the progress line into the picture: the piece built up to it, the cells up the rope, the piece on the lap. */
  private applyProgress(): void {
    const m = this.project;
    if (!m) return;
    if (m.kind === 'prop') this.site?.setProgress(this.p);
    else if (m.kind === 'tiles' && m.tiles) {
      const n = m.tiles.length;
      m.tiles.forEach((c, i) => this.island.setRise(c, Math.max(0, Math.min(0.999, this.p * n - i))));
      if (this.paused || this.instant) this.island.settle();
    } else if (m.kind === 'gear' && m.gear) {
      this.character.setCraft(m.gear, this.p);
    }
    if (this.paused) this.frame();
  }

  /** The cell of a tile project the resident is hauling now. */
  private activeTile(): Cell | null {
    const m = this.project;
    if (!m || m.kind !== 'tiles' || !m.tiles) return null;
    const i = Math.min(m.tiles.length - 1, Math.floor(this.p * m.tiles.length));
    return m.tiles[i];
  }

  /** A milestone was reached: the piece in progress is finished, with a cheer when there is time to watch. */
  reach(m: Milestone): void {
    const instant = this.instant || this.paused || document.hidden;
    if (this.project?.id !== m.id) this.startProject(m);
    if (m.kind === 'prop' && m.prop && m.at) {
      this.site?.dispose();
      this.site = null;
      const e = this.addProp(m.prop, m.at, false);
      e.wiggle = instant ? 0 : 1;
      if (!instant) {
        this.fx.spawn('dust', new Vector3(m.at[0], 0.1, m.at[1]), 10);
        this.emit('pop');
      }
    } else if (m.kind === 'tiles' && m.tiles) {
      for (const c of m.tiles) this.island.setRise(c, 1);
      if (instant) this.island.settle();
      this.island.setGhosts([]);
    } else if (m.kind === 'gear' && m.gear) {
      this.character.setCraft(null);
      const g = this.character.setGear(m.gear, true);
      if (g && !instant) {
        g.scale.setScalar(0.01);
        const grow = { t: 0 };
        this.tweens.push((dt) => {
          grow.t = Math.min(1, grow.t + dt / 0.6);
          g.scale.setScalar(Math.max(0.01, 1 - Math.pow(1 - grow.t, 3)));
          return grow.t >= 1;
        });
        this.fx.spawn('dust', this.character.headWorld().add(new Vector3(0, -0.15, 0.1)), 6);
      }
    }
    this.rope.visible = false;
    this.project = null;
    this.approach = null;
    this.emit('built', m);
    const reached = new Set(MILESTONES.filter((x) => x.minutes <= m.minutes).map((x) => x.id));
    this.updateGhosts(reached);
    if (instant) {
      this.frame();
      this.replan = true;
      return;
    }
    // A short cheer where the work was done, then on to the next project.
    this.celebrating = true;
    this.character.run([
      { kind: 'do', act: 'cheer', seconds: 1.4 },
      { kind: 'call', fn: () => { this.celebrating = false; } },
    ]);
  }

  /** Decides what the resident does next. Runs whenever a plan ends or the situation changes. */
  private think(): void {
    if (this.mode === 'rest') {
      this.character.run([...this.goHome(), { kind: 'sit', act: 'rest', seconds: 1e9 }]);
      return;
    }
    if (this.mode === 'work' && this.project) {
      this.planWork(this.project);
      return;
    }
    this.planFree();
  }

  private planWork(m: Milestone): void {
    const c = this.character;
    this.loopN++;
    if (m.kind === 'gear') {
      // Making it by hand at the seat, up every other round for more material from the crate.
      const steps: Step[] = [];
      if (this.loopN % 2 === 0) {
        steps.push(...this.walkTo(this.home.clone().add(new Vector3(0.12, 0, -0.1))));
        steps.push({ kind: 'do', act: 'stand', seconds: 0.8, face: c.seat.localToWorld(new Vector3(0.3, 0, -0.3)) });
