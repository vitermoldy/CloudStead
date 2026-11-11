import {
  BoxGeometry, CanvasTexture, CapsuleGeometry, CylinderGeometry, Euler, Group, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, PlaneGeometry, PointLight, Quaternion, SphereGeometry, SRGBColorSpace, TorusGeometry, Vector3,
  type Camera, type Raycaster,
} from 'three';
import { clamp, damp } from '../core/emitter';
import type { Gear } from '../sim/milestones';

/** Everything the resident can be doing; the seated ones happen at the seat. */
