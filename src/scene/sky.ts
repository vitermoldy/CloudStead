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
        col = mix(col, uBelow, smoothstep(0.0, -0.22, h));
        float sunAmount = max(dot(d, normalize(uSunDir)), 0.0);
        // Wide warm glow round the sun, a tighter halo, and the disc (the moon at night).
        col += uGlow * pow(sunAmount, 6.0) * 0.55;
        col += uGlow * pow(sunAmount, 48.0) * 0.6;
        float disc = smoothstep(0.9993, 0.9997, sunAmount);
        col = mix(col, uGlow * (1.4 - uNight * 0.3), disc * 0.9);
        // Stars: a fixed field on the dome, twinkling slowly, only above the haze.
        if (uStars > 0.01) {
          vec3 cell = floor(d * 220.0);
          float r = hash(cell);
          float star = step(0.9965, r) * smoothstep(0.05, 0.35, h);
          float tw = 0.65 + 0.35 * sin(uTime * (0.6 + r * 2.0) + r * 40.0);
          col += vec3(0.85, 0.9, 1.0) * star * tw * uStars;
        }
        // A whisper of dither so the long gradients never band.
        col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.03;
