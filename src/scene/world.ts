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
