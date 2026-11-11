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
