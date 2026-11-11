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
