import { reducedMotion } from '../core/emitter';

export type CursorState = 'idle' | 'char' | 'pet' | 'tile' | 'ghost' | 'prop' | 'grab';

/**
 * The pointer over the island: a dot that sits exactly on the mouse and a ring that follows it a
 * moment later, stretching along fast moves and changing shape over what it can touch. Mouse
 * only; over the interface the system pointer takes over, so every control keeps its own.
 */
export class Cursor {
  readonly enabled: boolean;
  private el: HTMLElement;
  private ring: HTMLElement;
  private dot: HTMLElement;
  private label: HTMLElement;
  private x = -100;
  private y = -100;
  private rx = -100;
  private ry = -100;
  private vx = 0;
  private vy = 0;
  private state: CursorState = 'idle';
  private raf = 0;
  private last = 0;
  private over = false;

  constructor(el: HTMLElement, private surface: HTMLElement) {
    this.el = el;
    this.ring = el.querySelector('.cursor__ring') as HTMLElement;
    this.dot = el.querySelector('.cursor__dot') as HTMLElement;
    this.label = el.querySelector('.cursor__label') as HTMLElement;
    this.enabled = matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!this.enabled) return;
    document.documentElement.classList.add('has-cursor');
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.x = e.clientX;
      this.y = e.clientY;
      const on = e.target === this.surface;
      if (on !== this.over) {
        this.over = on;
        this.el.classList.toggle('is-on', on);
        if (on && this.rx < -50) {
