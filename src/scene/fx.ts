import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Group, Line, LineBasicMaterial, Points,
  PointsMaterial, SRGBColorSpace, Sprite, SpriteMaterial, Vector3,
} from 'three';

export type FxKind = 'heart' | 'dust' | 'note' | 'z' | 'leaf' | 'steam' | 'drop';

function glyphTexture(draw: (ctx: CanvasRenderingContext2D) => void): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  draw(ctx);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

const TEXTURES: Record<FxKind, () => CanvasTexture> = {
  heart: () => glyphTexture((ctx) => {
    ctx.fillStyle = '#ef6a45';
    ctx.beginPath();
    ctx.moveTo(32, 54);
    ctx.bezierCurveTo(6, 36, 6, 12, 22, 12);
    ctx.bezierCurveTo(28, 12, 32, 18, 32, 22);
    ctx.bezierCurveTo(32, 18, 36, 12, 42, 12);
    ctx.bezierCurveTo(58, 12, 58, 36, 32, 54);
    ctx.fill();
