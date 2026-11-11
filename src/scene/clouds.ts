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
