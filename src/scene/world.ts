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
        steps.push(...this.walkTo(this.home.clone()));
      } else {
        steps.push(...this.goHome());
      }
      steps.push({ kind: 'sit', act: 'craft', seconds: 9 });
      c.run(steps);
      return;
    }
    if (m.kind === 'tiles') {
      const cell = this.activeTile();
      const stand = cell ? this.standPoint(cell) : null;
      if (!cell || !stand) return this.planFree();
      const top = new Vector3(cell[0], -1, cell[1]);
      c.run([
        ...this.walkTo(stand),
        { kind: 'call', fn: () => { this.ropeCell = cell; this.rope.visible = true; } },
        { kind: 'do', act: 'haul', seconds: 6, face: top, beat: 1.1, onBeat: () => this.emit('beat', 'haul') },
        { kind: 'call', fn: () => { this.rope.visible = false; } },
      ]);
      return;
    }
    // A piece on a cell.
    const at = m.at!;
    const target = new Vector3(at[0], 0, at[1]);
    const stand = this.approach ?? this.standPoint(at);
    if (!stand) return this.planFree();
    const steps: Step[] = [];
    // Building takes planks: every few rounds the resident fetches an armful from the crate at the seat.
    if (m.work === 'build' && this.site && (this.site.stock < 2 || this.loopN % 3 === 1)) {
      steps.push(...this.walkTo(this.home.clone().add(new Vector3(0.12, 0, -0.1))));
      steps.push({ kind: 'do', act: 'stand', seconds: 0.6, face: c.seat.localToWorld(new Vector3(0.3, 0, -0.3)) });
      steps.push(...this.walkTo(stand, true));
      steps.push({ kind: 'call', fn: () => this.site?.deliver() });
    } else {
      steps.push(...this.walkTo(stand));
    }
    if (m.work === 'build') {
      steps.push({ kind: 'do', act: 'hammer', seconds: 5.4, face: target, beat: 0.6, onBeat: (n) => this.workBeat('hammer', target, n) });
    } else if (m.work === 'plant') {
      steps.push({ kind: 'do', act: 'dig', seconds: 3.9, face: target, beat: 1.3, onBeat: () => this.workBeat('dig', target, 0) });
      steps.push({ kind: 'do', act: 'water', seconds: 3.5, face: target, beat: 0.5, onBeat: () => this.workBeat('water', target, 0) });
    } else {
      steps.push({ kind: 'do', act: 'dig', seconds: 5.2, face: target, beat: 1.3, onBeat: () => this.workBeat('dig', target, 0) });
    }
    c.run(steps);
  }

  private workBeat(kind: 'hammer' | 'dig' | 'water', target: Vector3, n: number): void {
    if (kind === 'hammer') {
      this.fx.spawn('dust', target.clone().setY(0.08), 3);
      if (n % 4 === 0) this.site?.use();
    } else if (kind === 'dig') {
      this.fx.spawn('dust', this.character.blade.clone().setY(0.04), 4);
    } else {
      this.fx.spawn('drop', this.character.spout, 3);
    }
    this.emit('beat', kind);
  }

  /** No timer running: the resident lives on the island, and the work in progress waits. */
  private planFree(): void {
    const c = this.character;
    if (this.idleFor > 150) {
      c.run([...this.goHome(), { kind: 'sit', act: 'sleep', seconds: 1e9 }]);
      return;
    }
    const plants = this.props.entries.filter((e) => ['flowers', 'garden', 'sapling', 'tree', 'pine'].includes(e.kind));
    // Mostly up and about; now and then a sit at the seat or a look at the laptop.
    const options: [number, () => Step[]][] = [
      [1, () => [...this.goHome(), { kind: 'sit', act: 'sitIdle', seconds: 7 + Math.random() * 6 }]],
      [1, () => [...this.goHome(), { kind: 'sit', act: 'type', seconds: 7 + Math.random() * 6 }]],
      [3, () => {
        const cells = this.freeCells();
        const cell = cells[Math.floor(Math.random() * cells.length)];
        if (!cell) return [];
        const spot = new Vector3(cell[0] + (Math.random() - 0.5) * 0.4, 0, cell[1] + (Math.random() - 0.5) * 0.4);
        const view = spot.clone().add(new Vector3(Math.sign(cell[0] || 1) * 3, 0, Math.sign(cell[1] || 1) * 3));
        return [...this.walkTo(spot), { kind: 'do', act: 'stand', seconds: 3 + Math.random() * 3, face: view }];
      }],
    ];
    if (plants.length) {
      options.push([2, () => {
        const pl = plants[Math.floor(Math.random() * plants.length)];
        const stand = this.standPoint(pl.cell);
        if (!stand) return [];
        const t = new Vector3(pl.cell[0], 0, pl.cell[1]);
        return [...this.walkTo(stand), { kind: 'do', act: 'water', seconds: 4, face: t, beat: 0.5, onBeat: () => this.workBeat('water', t, 0) }];
      }]);
    }
    const m = this.project;
    if (m && m.kind === 'prop' && this.approach && this.p > 0) {
      // Goes to look at the unfinished piece now and then.
      const t = new Vector3(m.at![0], 0, m.at![1]);
      const at = this.approach;
      options.push([2, () => [...this.walkTo(at), { kind: 'do', act: 'stand', seconds: 3, face: t }]]);
    }
    const total = options.reduce((n, o) => n + o[0], 0);
    let r = Math.random() * total;
    for (const [w, make] of options) {
      r -= w;
      if (r <= 0) {
        const steps = make();
        c.run(steps.length ? steps : [...this.goHome(), { kind: 'sit', act: 'sitIdle', seconds: 12 }]);
        return;
      }
    }
  }

  // ------------------------------------------------------------ getting around
  private blockedCells(): Set<string> {
    const b = this.props.blocked();
    if (this.site) b.add(cellKey(this.site.cell));
    return b;
  }

  private freeCells(): Cell[] {
    const b = this.blockedCells();
    return this.island.cells().filter((c) => !b.has(cellKey(c)));
  }

  private cellOf(v: Vector3): Cell {
    return [Math.round(v.x), Math.round(v.z)];
  }

  /** A breadth-first walk over free cells (8 directions, no corner cutting) to the first cell the test accepts. */
  private findPath(from: Cell, accept: (c: Cell) => boolean): Cell[] | null {
    const blocked = this.blockedCells();
    const free = (c: Cell) => this.island.has(c) && !blocked.has(cellKey(c));
    const prev = new Map<string, string | null>([[cellKey(from), null]]);
    const queue: Cell[] = [from];
    let goal: Cell | null = accept(from) ? from : null;
    while (queue.length && !goal) {
      const c = queue.shift()!;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const n: Cell = [c[0] + dx, c[1] + dz];
        const nk = cellKey(n);
        if (prev.has(nk) || !free(n)) continue;
        if (dx && dz && (!free([c[0] + dx, c[1]]) || !free([c[0], c[1] + dz]))) continue;
        prev.set(nk, cellKey(c));
        if (accept(n)) {
          goal = n;
          break;
        }
        queue.push(n);
      }
    }
    if (!goal) return null;
    const cells: Cell[] = [];
    let k: string | null = cellKey(goal);
    while (k) {
      const [x, z] = k.split(',').map(Number);
      cells.unshift([x, z]);
      k = prev.get(k) ?? null;
    }
    return cells;
  }

  /** Where to stand to work on a cell: the nearest free neighbour, a step toward it from its middle. */
  private standPoint(target: Cell): Vector3 | null {
    const tk = cellKey(target);
    const ring = (c: Cell) => Math.max(Math.abs(c[0] - target[0]), Math.abs(c[1] - target[1]));
    // Right beside it if a neighbour is free; one cell further off when the neighbours are all built on.
    const path = this.findPath(HOME, (c) => cellKey(c) !== tk && ring(c) === 1)
      ?? this.findPath(HOME, (c) => cellKey(c) !== tk && ring(c) === 2);
    if (!path) return null;
    const cell = path[path.length - 1];
    const mid = new Vector3(cell[0], 0, cell[1]);
    const toward = new Vector3(target[0], 0, target[1]).sub(mid).normalize();
    // At the seat itself, step clear of the cushion and the laptop.
    return mid.addScaledVector(toward, cellKey(cell) === cellKey(HOME) ? 0.4 : 0.3);
  }

  /** Walk steps from where the resident is to a point, cell by cell. */
  private walkTo(to: Vector3, carry = false): Step[] {
    const pos = this.character.root.position;
    if (pos.distanceTo(to) < 0.05) return [];
    const goal = this.cellOf(to);
    const path = this.findPath(this.cellOf(pos), (c) => c[0] === goal[0] && c[1] === goal[1]);
    const steps: Step[] = [];
    if (path) for (const c of path.slice(1, -1)) steps.push({ kind: 'walk', to: new Vector3(c[0], 0, c[1]), carry });
    steps.push({ kind: 'walk', to: to.clone(), carry });
    return steps;
  }

  private goHome(): Step[] {
    const c = this.character;
    if (c.atHome && c.seated) return [];
    return this.walkTo(c.home);
  }

  private get home(): Vector3 {
    return this.character.home;
  }

  /** The rope from the resident's hands down to the cell being hauled, with a little sag. */
  private updateRope(): void {
    if (!this.rope.visible || !this.ropeCell) return;
    const a = this.character.grip;
    const b = this.island.tileTop(this.ropeCell) ?? a;
    const pos = this.rope.geometry.getAttribute('position');
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      const y = a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * 0.12;
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
    this.rope.geometry.computeBoundingSphere();
  }

  // ------------------------------------------------------------ settings
  setTime(mode: TimeMode): void {
    this.timeMode = mode;
    this.applyClock(true);
  }

  private applyClock(jump = false): void {
    if (this.timeMode === 'auto') {
      const d = new Date();
      const { a, b, t } = lookForHour(d.getHours() + d.getMinutes() / 60);
      this.target.set(LOOKS[a], LOOKS[b], t);
    } else {
      this.target.set(LOOKS[this.timeMode]);
    }
    if (jump && (this.instant || this.paused)) this.look.approach(this.target, 1);
  }

  /** Reduced motion: builds appear at once, the camera stays still. */
  setInstant(on: boolean): void {
    this.instant = on;
  }

  setPaused(on: boolean): void {
    this.paused = on;
    if (on) this.renderer.setAnimationLoop(null);
    else this.start();
    if (on) this.frame();
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get night(): number {
    return this.look.night;
  }

  setMusic(on: boolean): void {
    this.character.setMusic(on);
    if (this.paused) this.frame();
  }

  setContext(today: number, total: number): void {
    this.context.todayMinutes = today;
    this.context.totalMinutes = total;
  }

  setInkSource(fn: () => DOMRect[]): void {
    this.inkRects = fn;
  }

  /** Any sign of the visitor keeps the resident awake. */
  nudge(): void {
    this.idleFor = 0;
    if (this.character.act === 'sleep') {
      this.replan = true;
      this.emit('woke');
    }
  }

  resetView(): void {
    const reach = this.island.reach();
    this.fitDistance(reach);
    const az = 0;
    const polar = 0.98;
    this.camera.position.set(Math.sin(az) * Math.sin(polar) * this.dist, Math.cos(polar) * this.dist + 0.25, Math.cos(az) * Math.sin(polar) * this.dist);
    this.controls.target.set(0, 0.25, 0);
    this.controls.update();
    if (this.paused) this.frame();
  }

  private fitDistance(reach: number): void {
    const aspect = this.camera.aspect;
    // Narrow screens step back so the whole island stays in frame, with the clouds round it.
    const narrow = Math.pow(Math.max(1, 1.45 / Math.max(0.5, aspect)), 0.85);
    this.dist = clamp((2.5 + reach * 2.9) * narrow, 7, 34);
    this.controls.minDistance = this.dist * 0.45;
    this.controls.maxDistance = this.dist * 1.6;
  }

  resize(): void {
    const w = this.canvas.clientWidth || innerWidth;
    const h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Lift the island above the big clock: more on a phone held upright.
    const shift = w / h < 0.8 ? 0.16 : 0.09;
    this.camera.setViewOffset(w, h, 0, h * shift, w, h);
    const before = this.dist;
    this.fitDistance(this.island.reach());
    if (Math.abs(before - this.dist) > 0.01) {
      const dir = this.camera.position.clone().sub(this.controls.target).normalize();
      this.camera.position.copy(this.controls.target).addScaledVector(dir, this.dist);
    }
    this.camera.updateProjectionMatrix();
    this.hoverDirty = true;
    if (this.paused || !this.loopOn) this.frame();
  }

  // ------------------------------------------------------------ pointer
  private bindPointer(): void {
    const c = this.canvas;
    const toNdc = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    c.addEventListener('pointermove', (e) => {
      toNdc(e);
      this.pointerIn = true;
      this.hoverDirty = true;
      this.nudge();
      if (this.press && Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > 6) this.press.moved = true;
    });
    c.addEventListener('pointerleave', () => {
      this.pointerIn = false;
      this.ndc.set(9, 9);
      this.hoverDirty = true;
    });
    // Registered before OrbitControls, so a press on the resident never turns the camera.
    c.addEventListener('pointerdown', (e) => {
      toNdc(e);
      this.pointerIn = e.pointerType === 'mouse' ? true : this.pointerIn;
      this.nudge();
      this.pick();
      const on = this.hover.kind === 'char' ? 'char' : this.hover.kind === 'prop' ? 'prop' : this.hover.kind === 'tile' ? 'tile' : null;
      this.press = { x: e.clientX, y: e.clientY, t: performance.now(), on, moved: false, petting: false, prop: this.hover.prop, point: this.hitPoint.clone() };
      if (on === 'char') {
        this.controls.enabled = false;
        c.setPointerCapture(e.pointerId);
      }
    });
    const up = (e: PointerEvent) => {
      const p = this.press;
      this.press = null;
      this.controls.enabled = true;
      if (c.hasPointerCapture(e.pointerId)) c.releasePointerCapture(e.pointerId);
      if (!p) return;
      if (p.petting) {
        this.character.petting = false;
        this.emit('pet', false);
        this.emitHover();
        return;
      }
      if (p.moved) return;
      if (p.on === 'char') {
        this.emit('greet');
      } else if (p.on === 'prop' && p.prop) {
        p.prop.wiggle = 1;
        p.prop.poke?.(p.prop, p.point ?? new Vector3());
        if (p.prop.kind === 'tree' || p.prop.kind === 'sapling' || p.prop.kind === 'pine') {
          this.fx.spawn('leaf', p.prop.group.position.clone().setY(1.0), 4);
        }
        this.lookAt(p.point ?? p.prop.group.position);
        this.emit('poke-prop', p.prop);
      } else if (p.on === 'tile' && p.point) {
        this.lookAt(p.point);
        this.fx.spawn('leaf', p.point.clone().setY(0.06), 2);
