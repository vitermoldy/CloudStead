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
