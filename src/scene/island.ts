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
