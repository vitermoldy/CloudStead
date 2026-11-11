type Handler = (...args: any[]) => void;

/** A tiny event emitter shared by the timer, the progress and the music queue. */
export class Emitter {
  private handlers = new Map<string, Set<Handler>>();

  on(event: string, fn: Handler): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(fn);
    return () => set!.delete(fn);
  }

  emit(event: string, ...args: unknown[]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const fn of [...set]) fn(...args);
  }
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Frame-rate independent smoothing toward a target. */
export const damp = (a: number, b: number, rate: number, dt: number): number => lerp(a, b, 1 - Math.exp(-rate * dt));
export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
