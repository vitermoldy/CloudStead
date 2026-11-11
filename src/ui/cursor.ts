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
          this.rx = this.x;
          this.ry = this.y;
        }
      }
      this.wake();
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => {
      this.over = false;
      this.el.classList.remove('is-on');
    });
    addEventListener('pointerdown', () => this.el.classList.add('is-down'));
    addEventListener('pointerup', () => this.el.classList.remove('is-down'));
    addEventListener('blur', () => this.el.classList.remove('is-on'));
  }

  set(state: CursorState, text = ''): void {
    if (!this.enabled) return;
    this.state = state;
    this.el.dataset.state = state;
    if (text) this.label.textContent = text;
    this.el.dataset.label = text ? 'true' : 'false';
    this.wake();
  }

  private wake(): void {
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame((t) => this.frame(t));
    }
  }

  private frame(now: number): void {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const k = reducedMotion() ? 1 : 1 - Math.exp(-dt * 18);
    const px = this.rx, py = this.ry;
    this.rx += (this.x - this.rx) * k;
    this.ry += (this.y - this.ry) * k;
    this.vx = (this.rx - px) / Math.max(dt, 0.001);
    this.vy = (this.ry - py) / Math.max(dt, 0.001);
    const speed = Math.hypot(this.vx, this.vy);
    // Stretch along the move, round shapes only (a tile's square keeps its corners square to the screen).
    const round = this.state === 'idle' || this.state === 'grab' || this.state === 'prop';
    const stretch = round && !reducedMotion() ? Math.min(0.32, speed / 4200) : 0;
    const angle = Math.atan2(this.vy, this.vx);
    this.ring.style.transform = stretch > 0.01
      ? `translate3d(${this.rx}px, ${this.ry}px, 0) rotate(${angle}rad) scale(${1 + stretch}, ${1 - stretch * 0.55})`
      : `translate3d(${this.rx}px, ${this.ry}px, 0)`;
    this.dot.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
