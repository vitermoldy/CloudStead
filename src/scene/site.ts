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
  private cut = new Plane(new Vector3(0, -1, 0), 0);
  private ghostCut = new Plane(new Vector3(0, 1, 0), 0);
  private lo = 0;
  private hi = 1;
  private pile = new Group();
  private planks = 0;
  private parts: Object3D[] = [];
  private late: Object3D[] = [];
  private p = -1;

  constructor(kind: PropKind, cell: Cell, pileAt: Vector3 | null) {
    this.kind = kind;
    this.cell = cell;
    this.group.position.set(cell[0], 0, cell[1]);

