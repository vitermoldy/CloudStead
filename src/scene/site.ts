import {
  Box3, BoxGeometry, BufferGeometry, CylinderGeometry, Group, Line, LineBasicMaterial, Material, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Object3D, Plane, Vector3,
} from 'three';
import type { Cell, PropKind } from '../sim/milestones';
import { buildProp, REVEAL } from './props';

const GHOST = new MeshBasicMaterial({ color: '#f3efd9', transparent: true, opacity: 0.16, depthWrite: false });
const GHOST_LINE = new LineBasicMaterial({ color: '#f3efd9', transparent: true, opacity: 0.25 });
const STAKE = new MeshStandardMaterial({ color: '#c9a472', roughness: 0.9 });
const PLANK = new MeshStandardMaterial({ color: '#b08a5c', roughness: 0.9 });
const STRING = new LineBasicMaterial({ color: '#f0a04b' });

/**
 * A piece under construction: stakes and a string round its cell, a faint plan of the whole
 * thing, the real thing built up to the progress line, and a pile of the planks carried there.
 */
export class PropSite {
  readonly group = new Group();
  readonly cell: Cell;
  readonly kind: PropKind;
  private build: Group;
  private ghost: Group;
