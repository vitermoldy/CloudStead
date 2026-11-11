import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import type { LiveLook } from './palette';

/** The sky dome: a gradient from the horizon up, the sun's glow and the night's stars. */
export function createSky(): { mesh: Mesh; update: (look: LiveLook, time: number) => void } {
  const material = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    uniforms: {
      uZenith: { value: null },
      uHorizon: { value: null },
      uGlow: { value: null },
      uBelow: { value: null },
      uSunDir: { value: new Vector3() },
      uStars: { value: 0 },
      uNight: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uGlow;
      uniform vec3 uBelow;
      uniform vec3 uSunDir;
      uniform float uStars;
      uniform float uNight;
      uniform float uTime;
      varying vec3 vDir;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -1.0, 1.0);
        // Below the horizon the sky keeps the horizon colour: the cloud sea covers it.
        float up = pow(clamp(h, 0.0, 1.0), 0.55);
        vec3 col = mix(uHorizon, uZenith, up);
        // Under the horizon the eye meets the cloud sea in shadow, never a glowing void.
