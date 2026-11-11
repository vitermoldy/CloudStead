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
      const side = Math.abs(x - 0.5);
      const r = 0.06 + rand() * 0.16 * (1 - side * 1.3);
      const rr = Math.max(0.05, r);
      // Every sphere stays inside its cell, so no billow is cut by the atlas edge.
      circles.push({ x: Math.min(0.94 - rr, Math.max(0.06 + rr, x)), y: Math.min(0.76, 0.36 + rand() * 0.28 + side * 0.32), r: rr, z: rand() * 0.1 });
    }
    const base = 0.76;
    for (let py = 0; py < CELL; py++) {
      for (let px = 0; px < CELL; px++) {
        const x = (px + 0.5) / CELL, y = (py + 0.5) / CELL;
        let best = -1, cover = 0, nearest = Infinity, rx = 0, ry = 0;
        for (const c of circles) {
          const dx = x - c.x, dy = y - c.y;
          const d = Math.hypot(dx, dy);
          // Coverage as a distance field: 0.5 on the edge, a ramp 24 texels wide, cut sharp in the shader.
          cover = Math.max(cover, Math.min(1, Math.max(0, 0.5 + (c.r - d) / (24 / CELL))));
          if (d - c.r < nearest && d > 0) {
            nearest = d - c.r;
            rx = dx / d;
            ry = -dy / d;
