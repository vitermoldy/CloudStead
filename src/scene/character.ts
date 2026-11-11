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
