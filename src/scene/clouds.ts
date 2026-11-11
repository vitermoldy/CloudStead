import {
  CircleGeometry, Color, DataTexture, DoubleSide, Group, InstancedBufferAttribute, InstancedBufferGeometry, LinearFilter,
  Mesh, PlaneGeometry, RGBAFormat, ShaderMaterial, Vector3, type Camera,
} from 'three';
import { rng } from '../core/emitter';
import type { LiveLook } from './palette';

const VARIANTS = 4;
const CELL = 256;

/**
 * Four cumulus heads drawn once into an atlas. Each is a union of spheres on a flat base; the
 * texture keeps the surface normal (RGB) and the coverage (A), so the shader can light every
 * billow from wherever the sun stands.
 */
function puffAtlas(): DataTexture {
  // Raw bytes, not a canvas: a canvas premultiplies alpha and would crush the normals in the soft rims.
  const width = CELL * VARIANTS;
  const img = { data: new Uint8Array(width * CELL * 4) };
  const rand = rng(7);
  for (let k = 0; k < VARIANTS; k++) {
    const circles: { x: number; y: number; r: number; z: number }[] = [{ x: 0.48 + rand() * 0.04, y: 0.52, r: 0.22 + rand() * 0.06, z: 0.1 }];
    const n = 9 + k * 3;
    for (let i = 0; i < n; i++) {
      const x = 0.14 + rand() * 0.72;
