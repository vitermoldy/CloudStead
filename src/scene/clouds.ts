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
          }
          if (d < c.r) best = Math.max(best, c.z + Math.sqrt(c.r * c.r - d * d));
        }
        let nx = rx, ny = ry, nz = 0;
        if (best > 0) {
          // Where billows overlap, blend their normals over a few texels instead of a hard switch:
          // a hard switch turns into stair steps once a near cloud is magnified.
          let sx = 0, sy = 0, sz = 0, ws = 0;
          for (const c of circles) {
            const dx = x - c.x, dy = y - c.y;
            const d2 = dx * dx + dy * dy;
            if (d2 >= c.r * c.r) continue;
            const h = Math.sqrt(c.r * c.r - d2);
            const wgt = Math.exp((c.z + h - best) * 90);
            sx += (wgt * dx) / c.r;
            sy += (wgt * -dy) / c.r;
            sz += (wgt * h) / c.r;
            ws += wgt;
          }
          nx = sx / ws;
          ny = sy / ws;
          nz = sz / ws;
        }
        // A soft, slightly wavy base: a long straight line under a big cloud reads as a cut.
        const wave = Math.sin(x * 23 + k) * 0.012 + Math.sin(x * 57 + k * 3) * 0.006;
        const bottom = Math.min(1, Math.max(0, (base + wave - y) / 0.07));
        // The flat base faces down; billows near it turn down too, gradually.
        const down = Math.min(1, Math.max(0, (y - (base - 0.12)) / 0.1));
        ny = ny + (Math.min(ny, -0.25) - ny) * down;
        const len = Math.hypot(nx, ny, nz) || 1;
        nx /= len;
        ny /= len;
        const i = ((CELL - 1 - py) * width + k * CELL + px) * 4;
        img.data[i] = Math.round((nx * 0.5 + 0.5) * 255);
        img.data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        img.data[i + 2] = Math.round(bottom * 255);
        img.data[i + 3] = Math.round(cover * 255);
      }
    }
  }
  const tex = new DataTexture(img.data, width, CELL, RGBAFormat);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

interface Puff {
  x: number; y: number; z: number; w: number; h: number; seed: number; alpha: number; speed: number;
}

function layout(count: number): Puff[] {
  const rand = rng(1234);
  const puffs: Puff[] = [];
  const scale = count / 380;
  // Billows on the sea of clouds under the island: big, flat-bottomed, close together.
  for (let i = 0; i < Math.round(150 * scale); i++) {
    const r = 8 + Math.sqrt(rand()) * 95;
    const a = rand() * Math.PI * 2;
    const w = 13 + rand() * 20 + r * 0.1;
    puffs.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: -8 - rand() * 2 + Math.min(3, r * 0.025), w, h: w * (0.5 + rand() * 0.22), seed: rand(), alpha: 1, speed: 0.25 + rand() * 0.2 });
  }
  // A ring hugging the island's rock at mid height, as in the reference.
  for (let i = 0; i < Math.round(40 * scale); i++) {
    const r = 6 + rand() * 10;
    const a = rand() * Math.PI * 2;
    const w = 4 + rand() * 6;
    puffs.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: -3.8 - rand() * 2.8, w, h: w * 0.55, seed: rand(), alpha: 0.95, speed: 0.35 + rand() * 0.2 });
  }
  // Cumulus towers all round, so the frame behind the island is cloud, not sky.
  const towers = Math.round(16 * Math.max(0.6, scale));
  for (let t = 0; t < towers; t++) {
    const a = (t / towers) * Math.PI * 2 + rand() * 0.3;
    const r = 34 + rand() * 40;
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
    const height = 7 + rand() * 15;
    const n = 9 + Math.floor(rand() * 8);
    for (let i = 0; i < n; i++) {
      const k = i / n;
      const w = (15 - k * 7) * (0.8 + rand() * 0.5);
      puffs.push({
        x: cx + (rand() - 0.5) * (16 - k * 9), z: cz + (rand() - 0.5) * (16 - k * 9),
        y: -7 + k * height + rand() * 2, w, h: w * (0.72 + rand() * 0.25), seed: rand(), alpha: 1, speed: 0.12,
      });
    }
  }
  return puffs;
}

/** The floor of the cloud sea: one wide disc, billowing in light and shade, fading into the haze. */
function cloudFloor(): { mesh: Mesh; material: ShaderMaterial } {
  const material = new ShaderMaterial({
    fog: false,
    toneMapped: false,
    // No depth: the puffs that dip below the floor must never be cut by it.
    depthWrite: false,
    uniforms: {
      uLit: { value: new Color() },
      uShade: { value: new Color() },
      uFog: { value: new Color() },
      uSunDir: { value: new Vector3() },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uLit;
      uniform vec3 uShade;
      uniform vec3 uFog;
      uniform vec3 uSunDir;
      uniform float uTime;
      varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
        return v;
      }
      void main() {
        vec2 p = vWorld.xz * 0.05 + vec2(uTime * 0.006, 0.0);
        float h = fbm(p);
        float e = 0.03;
