import {
  Box3, BoxGeometry, BufferGeometry, CylinderGeometry, Group, Line, LineBasicMaterial, Material, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Object3D, Plane, Vector3,
} from 'three';
import type { Cell, PropKind } from '../sim/milestones';
import { buildProp, REVEAL } from './props';

