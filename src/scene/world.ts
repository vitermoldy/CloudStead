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
