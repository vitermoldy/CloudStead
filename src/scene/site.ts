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

    // Stakes at the corners, a string between them.
    const stake = new CylinderGeometry(0.012, 0.012, 0.16, 4);
    const corners = [[-0.44, -0.44], [0.44, -0.44], [0.44, 0.44], [-0.44, 0.44]];
    for (const [x, z] of corners) {
      const m = new Mesh(stake, STAKE);
      m.position.set(x, 0.08, z);
      m.castShadow = true;
      this.group.add(m);
    }
    const loop = corners.concat([corners[0]]).map(([x, z]) => new Vector3(x, 0.13, z));
    this.group.add(new Line(new BufferGeometry().setFromPoints(loop), STRING));

    this.build = buildProp(kind);
    this.ghost = buildProp(kind);
    this.group.add(this.ghost, this.build);
    this.group.updateMatrixWorld(true);
    const box = new Box3().setFromObject(this.build);
    this.lo = Math.max(-0.05, box.min.y);
    this.hi = Math.max(this.lo + 0.05, box.max.y);

    const mode = REVEAL[kind];
    this.build.traverse((o) => {
      if (o.userData.late) this.late.push(o);
      const mesh = o as Mesh;
      if (!mesh.material) return;
      if (mode === 'rise') {
        const mat = (mesh.material as Material).clone();
        mat.clippingPlanes = [this.cut];
        mat.clipShadows = true;
        mesh.material = mat;
      }
    });
    this.ghost.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.material) return;
      const isLine = (o as Line).isLine;
      const mat = (isLine ? GHOST_LINE : GHOST).clone();
      if (mode === 'rise') mat.clippingPlanes = [this.ghostCut];
      mesh.material = mat;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    });
    if (mode === 'parts' || mode === 'pond') this.parts = [...this.build.children];

    if (pileAt) {
      this.pile.position.copy(pileAt).sub(this.group.position);
      this.group.add(this.pile);
    }
    this.setProgress(0);
  }

