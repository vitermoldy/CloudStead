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

  /** p from 0 to 1: how much of the piece stands. */
  setProgress(p: number): void {
    const k = Math.max(0, Math.min(1, p));
    if (Math.abs(k - this.p) < 0.0005) return;
    this.p = k;
    const mode = REVEAL[this.kind];
    if (mode === 'rise') {
      // A sliver shows from the first minute, so the work is visible at once.
      const h = this.lo + (this.hi - this.lo) * (0.04 + 0.96 * k);
      this.cut.constant = h;
      this.ghostCut.constant = -h;
      for (const o of this.late) o.visible = k > 0.8;
    } else if (mode === 'parts') {
      const n = this.parts.length;
      this.parts.forEach((o, i) => {
        o.visible = i < Math.max(1, Math.ceil(k * n));
      });
    } else if (mode === 'pond') {
      // The water widens as the hole is dug; the stones go round it after.
      const [water, ...rest] = this.parts;
      const w = 0.15 + 0.85 * Math.min(1, k * 1.4);
      water.scale.set(w, w, 1);
      rest.forEach((o, i) => {
        o.visible = k > 0.5 && i < Math.ceil(((k - 0.5) / 0.5) * rest.length);
      });
    } else if (mode === 'fall') {
      // The channel first, then the water reaches further down the cliff.
      this.build.children.forEach((o, i) => {
        if (i === 0) o.visible = true;
        else if (i === 1) {
          o.visible = k > 0.15;
          const f = Math.max(0.02, (k - 0.15) / 0.85);
          o.scale.y = f;
          o.position.y = -3.25 * f;
        } else o.visible = k > 0.9;
      });
    }
  }

  /** One more armful of planks on the pile. */
  deliver(): void {
    if (this.planks >= 6) return;
    const m = new Mesh(new BoxGeometry(0.28, 0.025, 0.06), PLANK);
    m.position.set((this.planks % 2) * 0.02, 0.013 + this.planks * 0.026, 0);
    m.rotation.y = (this.planks % 2 ? 1 : -1) * 0.12 + 0.3;
    m.castShadow = true;
    m.receiveShadow = true;
    this.pile.add(m);
    this.planks++;
  }

  /** Takes a plank from the pile as the work goes on. */
  use(): void {
    const last = this.pile.children[this.pile.children.length - 1];
    if (!last || this.planks <= 1) return;
    this.pile.remove(last);
    this.planks--;
  }

  get stock(): number {
    return this.planks;
