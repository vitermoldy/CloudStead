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
