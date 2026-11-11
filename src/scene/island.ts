import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, Group, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Object3D, Quaternion, Vector3, type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { rng, clamp } from '../core/emitter';
import { cellKey, type Cell } from '../sim/milestones';

/** Cells with bare earth: the clearing round the resident and the path east and south. */
const DIRT = new Set(['0,0', '0,1', '1,0', '0,2', '2,0', '0,3', '3,0']);

const hash = (c: Cell) => ((c[0] + 11) * 73856093) ^ ((c[1] + 7) * 19349663);

function tint(hex: string, rand: () => number, spread: number): Color {
  const c = new Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h + (rand() - 0.5) * spread * 0.1, clamp(hsl.s + (rand() - 0.5) * spread * 0.2, 0, 1), clamp(hsl.l + (rand() - 0.5) * spread * 0.12, 0, 1));
  return c;
}

/** The rock under one cell: a tapered, faceted column whose top is the cell's exact square. */
function rockGeometry(cell: Cell, depth: number): BufferGeometry {
  const rand = rng(hash(cell));
  const rings = 6;
  const sides = 12;
  const pts: Vector3[][] = [];
  const tipX = (rand() - 0.5) * 0.5, tipZ = (rand() - 0.5) * 0.5;
  for (let r = 0; r <= rings; r++) {
