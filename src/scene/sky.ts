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
